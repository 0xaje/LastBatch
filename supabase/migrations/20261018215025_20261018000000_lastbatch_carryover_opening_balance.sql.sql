/*
# Carry-over stock between shifts (opening balance)

1. Problem
   close_shift computed expected on hand as produced + replenished − wasted
   since the shift opened, implicitly assuming the shelf started empty.
   In reality, leftovers counted at the end of the previous shift are still
   on hand. From the second shift onward, every leftover was mislabeled as
   an unaccounted difference.

2. Changes
   - New column `shift_closeouts.opening` (numeric(12,3), NOT NULL, default 0):
     the counted remainder carried over from the previous closed shift for
     the same item. It is zero for the first shift of an item.
   - close_shift() now computes:
       expected = opening + produced + replenished − wasted
       difference = expected − remaining
       unaccounted (sold_estimate) = GREATEST(difference, 0)
     The opening value is read from the most recent closed shift's closeout
     row for that item in the same workspace, taken from the latest closed
     shift whose close time is on or before the current shift's open time.
   - Backfill: all existing closeout rows get opening = 0 (their shifts
     genuinely had no opening tracked, so their stored differences remain
     historically accurate). No rows are added or deleted.

3. Security
   No RLS changes (opening is covered by the existing closeout policies).
   close_shift keeps its signature, so existing EXECUTE grants remain valid.
*/

ALTER TABLE shift_closeouts
  ADD COLUMN IF NOT EXISTS opening numeric(12,3) NOT NULL DEFAULT 0;

UPDATE shift_closeouts SET opening = 0 WHERE opening IS NULL;

CREATE OR REPLACE FUNCTION close_shift(
  p_shift uuid,
  p_counts jsonb,
  p_handover_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_status text;
  v_item uuid;
  v_name text;
  v_produced numeric;
  v_replenished numeric;
  v_wasted numeric;
  v_opening numeric;
  v_remaining numeric;
  v_expected numeric;
  v_unaccounted numeric;
  v_diff numeric;
  v_explanation text;
  v_note uuid;
  v_rec jsonb;
  v_uncounted int := 0;
  v_opened_at timestamptz;
  v_updated boolean := false;
BEGIN
  SELECT s.workspace_id, sh.status, sh.opened_at
    INTO v_ws, v_status, v_opened_at
  FROM shifts sh
  JOIN staff s ON s.id = auth.uid() AND s.workspace_id = sh.workspace_id
  WHERE sh.id = p_shift;

  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Shift not found';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'Shift is already closed';
  END IF;
  IF p_handover_message IS NULL OR btrim(p_handover_message) = '' OR char_length(btrim(p_handover_message)) > 2000 THEN
    RAISE EXCEPTION 'Handover message is required';
  END IF;
  IF p_counts IS NULL OR jsonb_typeof(p_counts) <> 'array' OR jsonb_array_length(p_counts) = 0 THEN
    RAISE EXCEPTION 'Remaining quantities are required';
  END IF;

  -- atomic single-writer transition
  UPDATE shifts
    SET status = 'closed', closed_by = auth.uid(), closed_at = now()
    WHERE id = p_shift AND status = 'open'
  RETURNING true INTO v_updated;
  IF NOT v_updated THEN
    RAISE EXCEPTION 'Shift is already closed';
  END IF;

  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_counts) LOOP
    v_item := (v_rec->>'item_id')::uuid;
    v_remaining := (v_rec->>'remaining')::numeric;
    v_explanation := NULLIF(btrim(coalesce(v_rec->>'explanation', '')), '');

    SELECT fi.name INTO v_name
    FROM food_items fi
    WHERE fi.id = v_item AND fi.workspace_id = v_ws;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Item not in workspace';
    END IF;
    IF v_remaining IS NULL OR v_remaining < 0 THEN
      RAISE EXCEPTION 'Invalid remaining quantity for %', v_name;
    END IF;

    -- carry-over: counted remainder from the most recent closed shift for this item
    SELECT c.remaining INTO v_opening
    FROM shift_closeouts c
    JOIN shifts sh ON sh.id = c.shift_id
    WHERE c.item_id = v_item
      AND sh.workspace_id = v_ws
      AND sh.status = 'closed'
      AND sh.closed_at <= v_opened_at
    ORDER BY sh.closed_at DESC
    LIMIT 1;
    v_opening := coalesce(v_opening, 0);

    SELECT coalesce(SUM(quantity), 0) INTO v_produced
      FROM batches WHERE item_id = v_item AND workspace_id = v_ws
        AND produced_at >= v_opened_at AND produced_at <= now();
    SELECT coalesce(SUM(quantity), 0) INTO v_replenished
      FROM replenishments WHERE item_id = v_item AND workspace_id = v_ws
        AND recorded_at >= v_opened_at AND recorded_at <= now();
    SELECT coalesce(SUM(quantity), 0) INTO v_wasted
      FROM waste_events WHERE item_id = v_item AND workspace_id = v_ws
        AND wasted_at >= v_opened_at AND wasted_at <= now();

    v_expected := v_opening + v_produced + v_replenished - v_wasted;
    v_diff := v_expected - v_remaining;
    v_unaccounted := GREATEST(v_diff, 0);

    IF v_diff <> 0 AND v_explanation IS NULL THEN
      RAISE EXCEPTION 'Explanation required for % (difference of %)', v_name, v_diff;
    END IF;

    INSERT INTO shift_closeouts (shift_id, item_id, opening, produced, replenished, wasted, remaining, sold_estimate, difference, explanation)
    VALUES (p_shift, v_item, v_opening, v_produced, v_replenished, v_wasted, v_remaining, v_unaccounted, v_diff, v_explanation);

    IF v_diff <> 0 THEN
      v_uncounted := v_uncounted + 1;
    END IF;
  END LOOP;

  INSERT INTO handover_notes (workspace_id, shift_id, message, author_id)
  VALUES (v_ws, p_shift, btrim(p_handover_message), auth.uid())
  RETURNING id INTO v_note;

  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (v_ws, 'shift', p_shift, 'shift_closed',
    'Shift closed; ' || v_uncounted || ' item(s) with unreconciled difference; handover note left');

  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (v_ws, 'handover', v_note, 'handover_written', 'Handover note written');
END;
$$;
