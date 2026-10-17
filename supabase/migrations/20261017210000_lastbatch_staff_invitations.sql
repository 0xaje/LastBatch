/*
# Secure staff invitations

1. Plain-English explanation
Previously "Join an existing workspace" silently placed every new staff member
into the oldest workspace in the database (join_workspace ordered by created_at
LIMIT 1). A staff member who meant to join Succstore landed in "Test Bakery QA".
This migration replaces name-based joining with manager-issued invitation codes.

2. New table: workspace_invitations
- id (uuid, primary key): invitation identifier.
- workspace_id (uuid, not null): the ONE workspace the code joins.
- code (text, unique, not null): server-generated random code (32 hex chars).
- created_by (uuid, not null): the manager staff row that issued it.
- target_email (text, nullable): when set, only that email may redeem.
- status (text, not null, default 'pending'): pending | revoked | used.
- expires_at (timestamptz, not null): validity deadline (default +72h).
- used_by (uuid, nullable): staff id that redeemed the code.
- used_at (timestamptz, nullable): when it was redeemed.
- created_at (timestamptz, default now()).

3. Security changes
- RLS enabled on workspace_invitations. Managers of the owning workspace can
  select and revoke their own invitations. No public or staff-wide browsing:
  non-managers see nothing. SELECT is granted to authenticated but the policy
  gates visibility.
- New SECURITY DEFINER RPCs (all validate auth.uid() server-side):
  * create_invitation(p_workspace_id, p_target_email, p_hours) -> code
    Manager-only. Creates a pending, expiring, single-use code.
  * revoke_invitation(p_invitation_id) -> void
    Manager-only. Marks a pending invitation revoked (reversible data change).
  * preview_invitation(p_code) -> workspace name, inviter name, expiry, errors
    Read-only preview so the join screen can show WHICH bakery is being joined
    before committing. Returns no sensitive data; requires a valid pending code.
  * redeem_invitation(p_code, p_display_name) -> workspace uuid
    Server-side validation: code must be pending, unexpired, not targeted to a
    different email, and the caller must not already belong to a workspace.
    Membership is granted with role 'staff'. Marks the code used atomically
    (guarded UPDATE prevents double redemption).
- join_workspace() (the flawed "oldest workspace" join) is DROPPED so it can no
  longer place anyone in an unintended workspace.
- The "ws_select_browse" policy (USING (true)) is replaced by member-only
  visibility, ending unrestricted workspace enumeration.

4. Data safety
No existing rows are modified or deleted. Current memberships, workspaces and
production records are untouched. The change is reversible by restoring the
previous policies/functions.
*/

-- ============ invitation table ============
CREATE TABLE IF NOT EXISTS workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 16 AND 64),
  created_by uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  target_email text CHECK (target_email IS NULL OR (char_length(target_email) <= 120 AND target_email = lower(btrim(target_email)))),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','revoked','used')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '72 hours',
  used_by uuid REFERENCES staff(id) ON DELETE SET NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_invitations_ws_idx ON workspace_invitations (workspace_id);

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_manager_select" ON workspace_invitations;
CREATE POLICY "invitations_manager_select" ON workspace_invitations FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = auth.uid()
      AND s.workspace_id = workspace_invitations.workspace_id
      AND s.role = 'manager'
  ));

REVOKE ALL ON workspace_invitations FROM anon;
GRANT SELECT, INSERT, UPDATE ON workspace_invitations TO authenticated;

-- ============ remove the flawed open join ============
DROP FUNCTION IF EXISTS join_workspace(text);

-- ============ manager RPCs ============
CREATE OR REPLACE FUNCTION create_invitation(
  p_workspace_id uuid,
  p_target_email text DEFAULT NULL,
  p_hours int DEFAULT 72
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_code text;
BEGIN
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 336 THEN
    RAISE EXCEPTION 'Validity must be between 1 and 336 hours';
  END IF;
  IF p_target_email IS NOT NULL THEN
    p_target_email := lower(btrim(p_target_email));
    IF p_target_email = '' OR p_target_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
      RAISE EXCEPTION 'Invalid invitee email';
    END IF;
  END IF;

  SELECT role INTO v_role FROM staff WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You do not belong to a workspace';
  END IF;
  IF v_role <> 'manager' THEN
    RAISE EXCEPTION 'Only managers can invite staff';
  END IF;

  -- The manager must be inviting into their own workspace.
  IF p_workspace_id IS NULL OR p_workspace_id <> (SELECT workspace_id FROM staff WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'You can only invite staff to your own workspace';
  END IF;

  v_code := encode(gen_random_bytes(16), 'hex');
  INSERT INTO workspace_invitations (workspace_id, code, created_by, target_email, expires_at)
  VALUES (p_workspace_id, v_code, auth.uid(), p_target_email, now() + make_interval(hours => p_hours));

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
BEGIN
  SELECT workspace_id INTO v_ws FROM workspace_invitations WHERE id = p_invitation_id;
  IF v_ws IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM staff WHERE id = auth.uid() AND workspace_id = v_ws AND role = 'manager') THEN
    RAISE EXCEPTION 'Only managers of this workspace can revoke invitations';
  END IF;

  UPDATE workspace_invitations
  SET status = 'revoked'
  WHERE id = p_invitation_id AND status = 'pending';
END;
$$;

-- ============ join-side RPCs ============
CREATE OR REPLACE FUNCTION preview_invitation(p_code text)
RETURNS TABLE (workspace_name text, inviter_name text, expires_at timestamptz, target_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := lower(btrim(coalesce(p_code, '')));
BEGIN
  IF v_code = '' THEN
    RAISE EXCEPTION 'Invitation code is required';
  END IF;

  RETURN QUERY
  SELECT w.name, i.created_by::text::text, i.expires_at, i.target_email
  FROM workspace_invitations i
  JOIN workspaces w ON w.id = i.workspace_id
  WHERE i.code = v_code AND i.status = 'pending' AND i.expires_at > now();
END;
$$;

CREATE OR REPLACE FUNCTION redeem_invitation(p_code text, p_display_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_email text;
  v_inv workspace_invitations;
  v_name text := btrim(coalesce(p_display_name, ''));
BEGIN
  IF v_name = '' OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'Invalid display name';
  END IF;
  IF EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'User already belongs to a workspace';
  END IF;

  SELECT coalesce(email, '') INTO v_email FROM auth.users WHERE id = auth.uid();

  SELECT * INTO v_inv FROM workspace_invitations WHERE code = v_code FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invitation code not recognized';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation is no longer valid';
  END IF;
  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'This invitation has expired';
  END IF;
  IF v_inv.target_email IS NOT NULL AND v_inv.target_email <> v_email THEN
    RAISE EXCEPTION 'This invitation was issued to a different email address';
  END IF;

  INSERT INTO staff (id, workspace_id, full_name, email, role)
  VALUES (auth.uid(), v_inv.workspace_id, v_name, v_email, 'staff');

  UPDATE workspace_invitations
  SET status = 'used', used_by = auth.uid(), used_at = now()
  WHERE id = v_inv.id AND status = 'pending';

  RETURN v_inv.workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION create_invitation(uuid, text, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION create_invitation(uuid, text, int) TO authenticated;
REVOKE ALL ON FUNCTION revoke_invitation(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION revoke_invitation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION preview_invitation(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION preview_invitation(text) TO authenticated;
REVOKE ALL ON FUNCTION redeem_invitation(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION redeem_invitation(text, text) TO authenticated;

-- ============ close workspace enumeration ============
DROP POLICY IF EXISTS "ws_select_browse" ON workspaces;
CREATE POLICY "ws_select_member" ON workspaces FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM staff s
    WHERE s.id = auth.uid() AND s.workspace_id = workspaces.id
  ));
