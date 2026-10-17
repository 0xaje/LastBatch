/*
# Harden function EXECUTE grants

The security advisor flagged SECURITY DEFINER functions as executable by roles
they should not be reachable by. Fix by revoking default broad grants:

- Trigger functions (log_activity_*) are internal only: revoke from anon,
  authenticated, public. They are still invoked by triggers (owner rights).
- All RPC functions: revoke from anon and public; keep EXECUTE for authenticated
  only — every one of them checks auth.uid() internally and raises when
  unauthorized.

No application behavior changes: the app only calls these as an authenticated user.
*/

REVOKE EXECUTE ON FUNCTION log_activity_item() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION log_activity_batch() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION log_activity_replenishment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION log_activity_waste() FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION acknowledge_handover(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION close_shift(uuid, jsonb, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION create_workspace_with_manager(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION join_workspace(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION open_shift() FROM anon, public;
REVOKE EXECUTE ON FUNCTION set_item_active(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION set_staff_role(uuid, text) FROM anon, public;
