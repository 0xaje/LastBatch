-- The browse grant omitted created_by, so `SELECT *` (used by the app when
-- loading the caller's workspace) fails with "permission denied for table".
-- Row visibility is still governed by RLS (ws_select_browse: USING (true)),
-- so a full table-level SELECT grant is safe here.
GRANT SELECT ON public.workspaces TO authenticated;
