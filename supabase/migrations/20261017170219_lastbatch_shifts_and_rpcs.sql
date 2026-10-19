/*
# LastBatch shifts, closeouts, handovers + secure RPCs (retry)

Same content as before, with the single-arg create_workspace_with_manager(text)
overload dropped first to resolve the ambiguous-function failure.
*/

DROP FUNCTION IF EXISTS create_workspace_with_manager(text);

-- ============ shifts ============
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES staff(id) ON DELETE RESTRICT,
  closed_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closing_note text CHECK (closing_note IS NULL OR char_length(closing_note) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS shifts_one_open_per_workspace
  ON shifts (workspace_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS shifts_workspace_idx ON shifts (workspace_id, opened_at DESC);

-- ============ shift_closeouts ============
CREATE TABLE IF NOT EXISTS shift_closeouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES food_items(id) ON DELETE RESTRICT,
  produced numeric(12,3) NOT NULL DEFAULT 0,
  replenished numeric(12,3) NOT NULL DEFAULT 0,
  wasted numeric(12,3) NOT NULL DEFAULT 0,
  remaining numeric(12,3) NOT NULL CHECK (remaining >= 0),
  sold_estimate numeric(12,3) NOT NULL DEFAULT 0,
  difference numeric(12,3) NOT NULL DEFAULT 0,
  explanation text CHECK (explanation IS NULL OR char_length(explanation) <= 300)
);

CREATE INDEX IF NOT EXISTS closeouts_shift_idx ON shift_closeouts (shift_id);

-- ============ handover_notes ============
CREATE TABLE IF NOT EXISTS handover_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  shift_id uuid NOT NULL UNIQUE REFERENCES shifts(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  author_id uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ handover_acknowledgments ============
CREATE TABLE IF NOT EXISTS handover_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES handover_notes(id) ON DELETE CASCADE,
  acknowledged_by uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, acknowledged_by)
);

-- ============ RLS ============
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_closeouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_select" ON shifts;
CREATE POLICY "shifts_select" ON shifts FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.workspace_id = shifts.workspace_id));

DROP POLICY IF EXISTS "closeouts_select" ON shift_closeouts;
CREATE POLICY "closeouts_select" ON shift_closeouts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM shifts sh
    JOIN staff s ON s.id = auth.uid() AND s.workspace_id = sh.workspace_id
    WHERE sh.id = shift_closeouts.shift_id
  ));

DROP POLICY IF EXISTS "notes_select" ON handover_notes;
CREATE POLICY "notes_select" ON handover_notes FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.workspace_id = handover_notes.workspace_id));

DROP POLICY IF EXISTS "acks_select" ON handover_acknowledgments;
CREATE POLICY "acks_select" ON handover_acknowledgments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM handover_notes hn
    JOIN staff s ON s.id = auth.uid() AND s.workspace_id = hn.workspace_id
    WHERE hn.id = handover_acknowledgments.note_id
  ));

-- ALL direct writes denied: no INSERT/UPDATE/DELETE policies on these tables.

-- ============ Functions ============

CREATE OR REPLACE FUNCTION create_workspace_with_manager(p_name text, p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_email text;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' OR char_length(btrim(p_name)) > 80 THEN
    RAISE EXCEPTION 'Invalid workspace name';
  END IF;
  IF p_display_name IS NULL OR btrim(p_display_name) = '' OR char_length(btrim(p_display_name)) > 80 THEN
    RAISE EXCEPTION 'Invalid display name';
  END IF;

  IF EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'User already belongs to a workspace';
  END IF;

  SELECT coalesce(email, '') INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO workspaces (name, created_by) VALUES (btrim(p_name), auth.uid())
  RETURNING id INTO v_ws;

  INSERT INTO staff (id, workspace_id, full_name, email, role)
  VALUES (auth.uid(), v_ws, btrim(p_display_name), v_email, 'manager');

  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (v_ws, 'item', NULL, 'workspace_created', 'Workspace "' || btrim(p_name) || '" created');

  RETURN v_ws;
END;
$$;

REVOKE EXECUTE ON FUNCTION create_workspace_with_manager FROM anon;
GRANT EXECUTE ON FUNCTION create_workspace_with_manager TO authenticated;

CREATE OR REPLACE FUNCTION join_workspace(p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_email text;
BEGIN
  IF p_display_name IS NULL OR btrim(p_display_name) = '' OR char_length(btrim(p_display_name)) > 80 THEN
    RAISE EXCEPTION 'Invalid display name';
  END IF;
  IF EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'User already belongs to a workspace';
  END IF;

  SELECT id INTO v_ws FROM workspaces ORDER BY created_at LIMIT 1;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'No workspace to join';
  END IF;

  SELECT coalesce(email, '') INTO v_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO staff (id, workspace_id, full_name, email, role)
  VALUES (auth.uid(), v_ws, btrim(p_display_name), v_email, 'staff');

  RETURN v_ws;
END;
$$;

REVOKE EXECUTE ON FUNCTION join_workspace FROM anon;
GRANT EXECUTE ON FUNCTION join_workspace TO authenticated;

CREATE OR REPLACE FUNCTION set_staff_role(p_member uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_caller_role text;
BEGIN
  SELECT workspace_id, role INTO v_ws, v_caller_role FROM staff WHERE id = auth.uid();
  IF v_ws IS NULL OR v_caller_role <> 'manager' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role NOT IN ('manager', 'staff') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  IF p_member = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  UPDATE staff SET role = p_role WHERE id = p_member AND workspace_id = v_ws;

  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (v_ws, 'item', p_member, 'role_changed', 'Staff role changed to ' || p_role);
END;
$$;

REVOKE EXECUTE ON FUNCTION set_staff_role FROM anon;
GRANT EXECUTE ON FUNCTION set_staff_role TO authenticated;

CREATE OR REPLACE FUNCTION set_item_active(p_item uuid, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_caller_role text;
  v_name text;
BEGIN
  SELECT workspace_id, role INTO v_ws, v_caller_role FROM staff WHERE id = auth.uid();
  IF v_ws IS NULL OR v_caller_role <> 'manager' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT name INTO v_name FROM food_items WHERE id = p_item AND workspace_id = v_ws;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  UPDATE food_items SET is_active = p_active, updated_at = now() WHERE id = p_item;

  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (v_ws, 'item', p_item,
    CASE WHEN p_active THEN 'item_activated' ELSE 'item_deactivated' END,
    v_name || CASE WHEN p_active THEN ' activated' ELSE ' deactivated' END);
END;
$$;

REVOKE EXECUTE ON FUNCTION set_item_active FROM anon;
GRANT EXECUTE ON FUNCTION set_item_active TO authenticated;

CREATE OR REPLACE FUNCTION open_shift()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_shift uuid;
BEGIN
  SELECT workspace_id INTO v_ws FROM staff WHERE id = auth.uid();
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM shifts WHERE workspace_id = v_ws AND status = 'open') THEN
    RAISE EXCEPTION 'A shift is already open';
  END IF;

  INSERT INTO shifts (workspace_id, opened_by) VALUES (v_ws, auth.uid())
  RETURNING id INTO v_shift;

  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (v_ws, 'shift', v_shift, 'shift_opened', 'Shift opened');

  RETURN v_shift;
END;
$$;

REVOKE EXECUTE ON FUNCTION open_shift FROM anon;
GRANT EXECUTE ON FUNCTION open_shift TO authenticated;

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
  v_shift_opened_by uuid;
  v_item uuid;
  v_name text;
  v_unit text;
  v_produced numeric;
  v_replenished numeric;
  v_wasted numeric;
  v_remaining numeric;
  v_expected numeric;
  v_sold numeric;
  v_diff numeric;
  v_note uuid;
  v_rec jsonb;
  v_uncounted int := 0;
BEGIN
  SELECT s.workspace_id, sh.status, sh.opened_by
    INTO v_ws, v_status, v_shift_opened_by
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

  -- close the shift atomically: single writer wins
  UPDATE shifts
    SET status = 'closed', closed_by = auth.uid(), closed_at = now()
    WHERE id = p_shift AND status = 'open'
    RETURNING id INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Shift is already closed';
  END IF;

  FOR v_rec IN SELECT * FROM jsonb_array_elements(p_counts) LOOP
    v_item := (v_rec->>'item_id')::uuid;
    v_remaining := (v_rec->>'remaining')::numeric;

    SELECT fi.name, fi.unit INTO v_name, v_unit
    FROM food_items fi
    WHERE fi.id = v_item AND fi.workspace_id = v_ws;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Item not in workspace';
    END IF;
    IF v_remaining IS NULL OR v_remaining < 0 THEN
      RAISE EXCEPTION 'Invalid remaining quantity for %', v_name;
    END IF;

    SELECT coalesce(SUM(quantity), 0) INTO v_produced
      FROM batches WHERE item_id = v_item AND workspace_id = v_ws
        AND produced_at >= (SELECT opened_at FROM shifts WHERE id = p_shift)
        AND produced_at <= now();
    SELECT coalesce(SUM(quantity), 0) INTO v_replenished
      FROM replenishments WHERE item_id = v_item AND workspace_id = v_ws
        AND recorded_at >= (SELECT opened_at FROM shifts WHERE id = p_shift)
        AND recorded_at <= now();
    SELECT coalesce(SUM(quantity), 0) INTO v_wasted
      FROM waste_events WHERE item_id = v_item AND workspace_id = v_ws
        AND wasted_at >= (SELECT opened_at FROM shifts WHERE id = p_shift)
        AND wasted_at <= now();

    v_expected := v_produced + v_replenished - v_wasted;
    v_sold := LEAST(v_remaining, v_expected);
    v_diff := v_expected - v_remaining;

    INSERT INTO shift_closeouts (shift_id, item_id, produced, replenished, wasted, remaining, sold_estimate, difference)
    VALUES (p_shift, v_item, v_produced, v_replenished, v_wasted, v_remaining, v_sold, v_diff);

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

REVOKE EXECUTE ON FUNCTION close_shift FROM anon;
GRANT EXECUTE ON FUNCTION close_shift TO authenticated;

CREATE OR REPLACE FUNCTION acknowledge_handover(p_note uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_author uuid;
  v_note_msg text;
BEGIN
  SELECT hn.workspace_id, hn.author_id, hn.message
    INTO v_ws, v_author, v_note_msg
  FROM handover_notes hn
  JOIN staff s ON s.id = auth.uid() AND s.workspace_id = hn.workspace_id
  WHERE hn.id = p_note;

  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Note not found';
  END IF;
  IF v_author = auth.uid() THEN
    RAISE EXCEPTION 'You cannot acknowledge your own note';
  END IF;

  -- atomic single-use claim
  INSERT INTO handover_acknowledgments (note_id, acknowledged_by)
  VALUES (p_note, auth.uid());

  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (v_ws, 'handover', p_note, 'handover_acknowledged', 'Handover note acknowledged');
END;
$$;

REVOKE EXECUTE ON FUNCTION acknowledge_handover FROM anon;
GRANT EXECUTE ON FUNCTION acknowledge_handover TO authenticated;
