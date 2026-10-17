/*
# Let signed-in users see workspace names so they can join

SetupPage's "Join an existing workspace" needs to know whether any workspace
exists. Users who aren't members yet can't see any rows under the current
policy, so the join button stayed disabled forever.

Fix: allow authenticated users to SELECT the workspace's id, name and
created_at only. Business data stays protected — all production/waste/shift
tables remain member-scoped. Column-level SELECT grant limits exposure to
non-sensitive fields (id, name, created_at); sensitive columns like
created_by are not granted.

Server-side join still enforces single-membership and display-name validity
in join_workspace().
*/

DROP POLICY IF EXISTS "ws_select_member" ON workspaces;
CREATE POLICY "ws_select_browse" ON workspaces FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON workspaces FROM authenticated;
GRANT SELECT (id, name, created_at) ON workspaces TO authenticated;
