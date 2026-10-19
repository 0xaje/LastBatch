/*
# Stamp workspace_id server-side on client-inserted rows

The frontend inserts items/batches/replenishments/waste without a workspace_id
(the browser should not be trusted to declare tenancy). Those columns had no
default, so the row arrived with NULL and the RLS WITH CHECK failed, surfacing
as "permission denied" to users.

Fix: give workspace_id a server-side default of my_workspace_id() (the caller's
own staff row, via SECURITY DEFINER helper). created_by already defaults to
auth.uid(). Client payloads stay minimal; tenancy and authorship are stamped
from the session.

No policy changes needed: WITH CHECK now sees the defaulted values.
*/

ALTER TABLE food_items ALTER COLUMN workspace_id SET DEFAULT my_workspace_id();
ALTER TABLE batches ALTER COLUMN workspace_id SET DEFAULT my_workspace_id();
ALTER TABLE replenishments ALTER COLUMN workspace_id SET DEFAULT my_workspace_id();
ALTER TABLE waste_events ALTER COLUMN workspace_id SET DEFAULT my_workspace_id();
