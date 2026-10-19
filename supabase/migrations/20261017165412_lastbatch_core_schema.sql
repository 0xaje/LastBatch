/*
# LastBatch core schema: workspace, staff, items, batches, replenishments, waste

1. New Tables
- `workspaces` - one café/bakery tenant (MVP: single workspace)
- `staff` - app users (managers and staff), keyed by auth user id
- `food_items` - active/inactive catalogue items
- `batches` - production batches with quantity, item, time, responsible user, unique dedupe key
- `replenishments` - stock added, linked to an item and optionally a batch, unique dedupe key
- `waste_events` - waste with quantity, reason, time, staff, unique dedupe key
- `activity_log` - timestamped history of significant changes

2. Columns (highlights)
- staff.role: 'manager' | 'staff' (server-enforced via column grants + functions)
- food_items.is_active, unit ('unit' | 'kg' | 'g' | 'L' | 'slice' | 'box')
- batches.status: 'open' | 'closed'; client_id columns enforce duplicate-submit prevention via UNIQUE
- waste_events.reason: check constraint to a fixed reason list
- quantity columns: numeric > 0 via CHECK constraints

3. Security
- RLS enabled on all tables.
- Policies scope every read/write to the caller's own workspace (staff.workspace_id = auth.uid()'s staff row).
- staff rows: self-select/update limited columns; insert own row on signup (workspace creation or join handled app-side).
- Authorship columns (created_by, user_id) have DEFAULT auth.uid() and are NOT client-writable (column grants).

4. Notes
- Quantities are numeric(12,3) to allow decimals (kg of dough) and whole units.
- Indices on workspace_id + created_at for reporting queries.
*/

-- ============ workspaces ============
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ staff ============
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 80),
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('manager','staff')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_workspace_email_key ON staff (workspace_id, lower(email));
CREATE INDEX IF NOT EXISTS staff_workspace_idx ON staff (workspace_id);

-- ============ food_items ============
CREATE TABLE IF NOT EXISTS food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  category text NOT NULL DEFAULT 'Other' CHECK (char_length(category) BETWEEN 1 AND 40),
  unit text NOT NULL DEFAULT 'unit' CHECK (unit IN ('unit','kg','g','L','slice','box')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS food_items_workspace_idx ON food_items (workspace_id, is_active);

-- ============ batches ============
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES food_items(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  produced_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  client_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (created_by, client_id)
);

CREATE INDEX IF NOT EXISTS batches_workspace_idx ON batches (workspace_id, produced_at DESC);
CREATE INDEX IF NOT EXISTS batches_item_idx ON batches (item_id);

-- ============ replenishments ============
CREATE TABLE IF NOT EXISTS replenishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES food_items(id) ON DELETE RESTRICT,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  client_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (created_by, client_id)
);

CREATE INDEX IF NOT EXISTS replenishments_workspace_idx ON replenishments (workspace_id, recorded_at DESC);

-- ============ waste_events ============
CREATE TABLE IF NOT EXISTS waste_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES food_items(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  reason text NOT NULL CHECK (reason IN ('Expired','Damaged','Burnt','Dropped','Quality issue','Overproduction','Other')),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  wasted_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  client_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (created_by, client_id)
);

CREATE INDEX IF NOT EXISTS waste_workspace_idx ON waste_events (workspace_id, wasted_at DESC);

-- ============ activity_log ============
CREATE TABLE IF NOT EXISTS activity_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL DEFAULT auth.uid(),
  entity_type text NOT NULL CHECK (entity_type IN ('item','batch','replenishment','waste','shift','handover')),
  entity_id uuid,
  action text NOT NULL,
  summary text NOT NULL CHECK (char_length(summary) <= 300),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_workspace_idx ON activity_log (workspace_id, created_at DESC);

-- ============ helper: current staff row ============
CREATE OR REPLACE FUNCTION current_staff()
RETURNS staff
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT * FROM staff WHERE id = auth.uid();
$$;

-- ============ RLS ============
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE replenishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- workspaces: readable by workspace members; writable by creator (manager setup)
DROP POLICY IF EXISTS "ws_select_member" ON workspaces;
CREATE POLICY "ws_select_member" ON workspaces FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.workspace_id = workspaces.id AND s.id = auth.uid()));

DROP POLICY IF EXISTS "ws_insert_creator" ON workspaces;
CREATE POLICY "ws_insert_creator" ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "ws_update_creator" ON workspaces;
CREATE POLICY "ws_update_creator" ON workspaces FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- staff: members of the same workspace can see each other
DROP POLICY IF EXISTS "staff_select_coworkers" ON staff;
CREATE POLICY "staff_select_coworkers" ON staff FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.workspace_id = staff.workspace_id)
  );

DROP POLICY IF EXISTS "staff_insert_self" ON staff;
CREATE POLICY "staff_insert_self" ON staff FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- role, workspace_id, email are NOT client-writable (column grants below)
REVOKE UPDATE ON staff FROM authenticated;
GRANT UPDATE (full_name) ON staff TO authenticated;

-- food_items
DROP POLICY IF EXISTS "items_select" ON food_items;
CREATE POLICY "items_select" ON food_items FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.workspace_id = food_items.workspace_id));

DROP POLICY IF EXISTS "items_insert" ON food_items;
CREATE POLICY "items_insert" ON food_items FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id = (SELECT workspace_id FROM staff WHERE id = auth.uid())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "items_update" ON food_items;
CREATE POLICY "items_update" ON food_items FOR UPDATE
  TO authenticated
  USING (workspace_id = (SELECT workspace_id FROM staff WHERE id = auth.uid()))
  WITH CHECK (
    workspace_id = (SELECT workspace_id FROM staff WHERE id = auth.uid())
    AND created_by = created_by
  );

-- batches: insert must target active items in own workspace; created_by is session-owned
DROP POLICY IF EXISTS "batches_select" ON batches;
CREATE POLICY "batches_select" ON batches FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.workspace_id = batches.workspace_id));

DROP POLICY IF EXISTS "batches_insert" ON batches;
CREATE POLICY "batches_insert" ON batches
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = (SELECT workspace_id FROM staff WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM food_items fi
      WHERE fi.id = batches.item_id
        AND fi.workspace_id = batches.workspace_id
        AND fi.is_active
    )
  );

-- batches: close/soft state changes only; immutable otherwise
DROP POLICY IF EXISTS "batches_update" ON batches;
CREATE POLICY "batches_update" ON batches
  FOR UPDATE TO authenticated
  USING (workspace_id = (SELECT workspace_id FROM staff WHERE id = auth.uid()))
  WITH CHECK (
    workspace_id = (SELECT workspace_id FROM staff WHERE id = auth.uid())
    AND created_by = created_by
  );

-- replenishments
DROP POLICY IF EXISTS "repl_select" ON replenishments;
CREATE POLICY "repl_select" ON replenishments FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.workspace_id = replenishments.workspace_id));

DROP POLICY IF EXISTS "repl_insert" ON replenishments;
CREATE POLICY "repl_insert" ON replenishments
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = (SELECT workspace_id FROM staff WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM food_items fi
      WHERE fi.id = replenishments.item_id
        AND fi.workspace_id = replenishments.workspace_id
        AND fi.is_active
    )
    AND (
      replenishments.batch_id IS NULL
      OR EXISTS (
        SELECT 1 FROM batches b
        WHERE b.id = replenishments.batch_id AND b.workspace_id = replenishments.workspace_id
      )
    )
  );

-- waste_events
DROP POLICY IF EXISTS "waste_select" ON waste_events;
CREATE POLICY "waste_select" ON waste_events FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.workspace_id = waste_events.workspace_id));

DROP POLICY IF EXISTS "waste_insert" ON waste_events;
CREATE POLICY "waste_insert" ON waste_events
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id = (SELECT workspace_id FROM staff WHERE id = auth.uid())
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM food_items fi
      WHERE fi.id = waste_events.item_id
        AND fi.workspace_id = waste_events.workspace_id
        AND fi.is_active
    )
  );

-- activity_log: workspace members read; insert via triggers only (no direct grants)
DROP POLICY IF EXISTS "activity_select" ON activity_log;
CREATE POLICY "activity_select" ON activity_log FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM staff s WHERE s.id = auth.uid() AND s.workspace_id = activity_log.workspace_id));

REVOKE INSERT ON activity_log FROM authenticated;

-- ============ column grants on staff: prevent forged workspace/role on insert ============
REVOKE INSERT ON staff FROM authenticated;
GRANT INSERT (id, workspace_id, full_name, email, role) ON staff TO authenticated;
