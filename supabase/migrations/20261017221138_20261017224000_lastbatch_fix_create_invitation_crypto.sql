/*
# Fix invitation RPCs: resolve gen_random_bytes through extensions schema

1. Problem
- `create_invitation` calls `encode(gen_random_bytes(16), 'hex')`.
- `gen_random_bytes` is provided by pgcrypto, which lives in the `extensions` schema on Supabase.
- The function body used bare `gen_random_bytes(...)` while `search_path` is pinned to `public`,
  so at runtime Postgres raised "function gen_random_bytes(integer) does not exist" (42883)
  and every invite attempt failed with a generic client error.

2. Changes
- Recreate `create_invitation` with a schema-qualified call:
  `extensions.gen_random_bytes(16)`. Logic, permissions, and signature unchanged.

3. Security
- No grants, RLS, or role changes. Function remains SECURITY DEFINER with
  `search_path = 'public'` and EXECUTE restricted to `authenticated`.
*/

CREATE OR REPLACE FUNCTION public.create_invitation(p_workspace_id uuid, p_target_email text DEFAULT NULL::text, p_hours integer DEFAULT 72)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

v_code := encode(extensions.gen_random_bytes(16), 'hex');
INSERT INTO workspace_invitations (workspace_id, code, created_by, target_email, expires_at)
VALUES (p_workspace_id, v_code, auth.uid(), p_target_email, now() + make_interval(hours => p_hours));

RETURN v_code;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_invitation(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, text, integer) TO authenticated;
