/*
# LastBatch activity triggers

Automatically record real activity history for item/batch/replenishment/waste
creates, so the timeline and reports are always built from actual records.

- Trigger on food_items INSERT -> activity 'Item added'
- Trigger on batches INSERT -> 'Batch of X produced'
- Trigger on replenishments INSERT -> 'X replenished'
- Trigger on waste_events INSERT -> 'X wasted (reason)'

All run as SECURITY DEFINER with fixed search_path; they only write activity_log,
whose INSERT is otherwise restricted to these triggers.
*/

CREATE OR REPLACE FUNCTION log_activity_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (NEW.workspace_id, 'item', NEW.id, 'item_added', 'Item "' || NEW.name || '" added');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_activity_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT name INTO v_name FROM food_items WHERE id = NEW.item_id;
  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (NEW.workspace_id, 'batch', NEW.id, 'batch_created',
    v_name || ' — batch of ' || trim(trailing '.' from trim(trailing '0' from NEW.quantity::text)) || ' produced');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_activity_replenishment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT name INTO v_name FROM food_items WHERE id = NEW.item_id;
  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (NEW.workspace_id, 'replenishment', NEW.id, 'replenishment_added',
    v_name || ' — replenished with ' || trim(trailing '.' from trim(trailing '0' from NEW.quantity::text)));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_activity_waste()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT name INTO v_name FROM food_items WHERE id = NEW.item_id;
  INSERT INTO activity_log (workspace_id, entity_type, entity_id, action, summary)
  VALUES (NEW.workspace_id, 'waste', NEW.id, 'waste_recorded',
    v_name || ' — ' || trim(trailing '.' from trim(trailing '0' from NEW.quantity::text)) || ' wasted (' || NEW.reason || ')');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_item ON food_items;
CREATE TRIGGER trg_activity_item AFTER INSERT ON food_items
  FOR EACH ROW EXECUTE FUNCTION log_activity_item();

DROP TRIGGER IF EXISTS trg_activity_batch ON batches;
CREATE TRIGGER trg_activity_batch AFTER INSERT ON batches
  FOR EACH ROW EXECUTE FUNCTION log_activity_batch();

DROP TRIGGER IF EXISTS trg_activity_replenishment ON replenishments;
CREATE TRIGGER trg_activity_replenishment AFTER INSERT ON replenishments
  FOR EACH ROW EXECUTE FUNCTION log_activity_replenishment();

DROP TRIGGER IF EXISTS trg_activity_waste ON waste_events;
CREATE TRIGGER trg_activity_waste AFTER INSERT ON waste_events
  FOR EACH ROW EXECUTE FUNCTION log_activity_waste();
