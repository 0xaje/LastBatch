/*
# Show inviter's display name in invitation preview

1. Problem
- `preview_invitation` returned `created_by` as a raw UUID, so the join screen showed
  "invited by 6f1487da-…" instead of the manager's name.

2. Changes
- Recreate `preview_invitation` to LEFT JOIN `staff` on `created_by` and return the
  manager's `full_name`, falling back to the UUID if no staff row exists.

3. Security
- No grant or RLS changes; function stays SECURITY DEFINER for `authenticated` only.
*/

CREATE OR REPLACE FUNCTION public.preview_invitation(p_code text)
RETURNS TABLE(workspace_name text, inviter_name text, expires_at timestamptz, target_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_code text := lower(btrim(coalesce(p_code, '')));
BEGIN
IF v_code = '' THEN
RAISE EXCEPTION 'Invitation code is required';
END IF;

RETURN QUERY
SELECT w.name, COALESCE(s.full_name, i.created_by::text), i.expires_at, i.target_email
FROM workspace_invitations i
JOIN workspaces w ON w.id = i.workspace_id
LEFT JOIN staff s ON s.id = i.created_by
WHERE i.code = v_code AND i.status = 'pending' AND i.expires_at > now();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.preview_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_invitation(text) TO authenticated;
