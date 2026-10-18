/*
# Clean up QA fixture support change (activity_log.actor_id default)

1. Purpose
   A temporary column default was placed on activity_log.actor_id during
   Phase 2 regression testing so fixture rows could be inserted from a
   privileged session where no JWT exists. That testing is complete; this
   migration restores the original behavior: the actor is always the
   authenticated user (auth.uid()), as triggers expect.

2. Changes
   - activity_log.actor_id: default restored from a fixed test UUID to
     auth.uid(). No rows are added, changed, or deleted.
   - No RLS or grant changes.
*/

ALTER TABLE activity_log
  ALTER COLUMN actor_id SET DEFAULT auth.uid();
