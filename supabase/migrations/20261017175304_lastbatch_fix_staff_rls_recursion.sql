/*
# Fix infinite recursion in staff RLS policies

The staff policies referenced the staff table inside their own USING clauses,
which recurses infinitely (each policy check re-evaluates the same policies).

Fix: replace self-referencing predicates with SECURITY DEFINER helper functions
that read staff rows directly (owner rights, bypassing RLS):

- my_workspace_id() -> uuid: the caller's workspace (or NULL)
- is_workspace_member(ws uuid) -> bool: is the caller staff in ws?

All policies on all tables now use these helpers. Also workspaces SELECT
uses the same helper. No data changes.
*/

CREATE OR REPLACE FUNCTION my_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM staff WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_workspace_member(ws uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM staff WHERE id = auth.uid() AND workspace_id = ws);
$$;

REVOKE EXECUTE ON FUNCTION my_workspace_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION is_workspace_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION my_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid) TO authenticated;

-- ============ rewrite policies ============

-- staff
DROP POLICY IF EXISTS "staff_select_coworkers" ON staff;
CREATE POLICY "staff_select_coworkers" ON staff FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (my_workspace_id() IS NOT NULL AND workspace_id = my_workspace_id())
  );

DROP POLICY IF EXISTS "staff_insert_self" ON staff;
CREATE POLICY "staff_insert_self" ON staff FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- workspaces
DROP POLICY IF EXISTS "ws_select_member" ON workspaces;
CREATE POLICY "ws_select_member" ON workspaces FOR SELECT
  TO authenticated
  USING (is_workspace_member(id));

-- food_items
DROP POLICY IF EXISTS "items_select" ON food_items;
CREATE POLICY "items_select" ON food_items FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "items_insert" ON food_items;
CREATE POLICY "items_insert" ON food_items FOR INSERT
  TO authenticated
  WITH CHECK (workspace_id = my_workspace_id() AND created_by = auth.uid());

DROP POLICY IF EXISTS "items_update" ON food_items;
CREATE POLICY "items_update" ON food_items FOR UPDATE
  TO authenticated
  USING (workspace_id = my_workspace_id())
  WITH CHECK (workspace_id = my_workspace_id());

-- batches
DROP POLICY IF EXISTS "batches_select" ON batches;
CREATE POLICY "batches_select" ON batches FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id));

-- replenishments
DROP POLICY IF EXISTS "repl_select" ON replenishments;
CREATE POLICY "repl_select" ON replenishments FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id));

-- waste_events
DROP POLICY IF EXISTS "waste_select" ON waste_events;
CREATE POLICY "waste_select" ON waste_events FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id));

-- activity_log
DROP POLICY IF EXISTS "activity_select" ON activity_log;
CREATE POLICY "activity_select" ON activity_log FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id));

-- shifts
DROP POLICY IF EXISTS "shifts_select" ON shifts;
CREATE POLICY "shifts_select" ON shifts FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id));

-- shift_closeouts
DROP POLICY IF EXISTS "closeouts_select" ON shift_closeouts;
CREATE POLICY "closeouts_select" ON shift_closeouts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM shifts sh
    WHERE sh.id = shift_closeouts.shift_id AND is_workspace_member(sh.workspace_id)
  ));

-- handover_notes
DROP POLICY IF EXISTS "notes_select" ON handover_notes;
CREATE POLICY "notes_select" ON handover_notes FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id));

-- handover_acknowledgments
DROP POLICY IF EXISTS "acks_select" ON handover_acknowledgments;
CREATE POLICY "acks_select" ON handover_acknowledgments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM handover_notes hn
    WHERE hn.id = handover_acknowledgments.note_id AND is_workspace_member(hn.workspace_id)
  ));
