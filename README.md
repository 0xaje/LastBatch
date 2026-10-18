# LastBatch

**Every action accounted for. Every handover documented.**

LastBatch is an operational accountability platform for organizations and teams. It helps teams record daily operations, track stock movements, reconcile differences, and keep responsibilities clear from one shift to the next.

Bakeries and cafés are the first use case: production runs, replenishments, waste, and end-of-shift counts. The underlying model — record activity as it happens, reconcile it against what is actually on hand, and require written explanations for gaps — applies to any team that moves physical stock through a shift.

## Why it exists

In a busy operation, goods leave the storeroom, move to the counter, some are sold, some are given away, some are discarded. At the end of the day the numbers rarely agree. Without a written record of what was produced, moved, thrown away, and counted, nobody can say why. LastBatch closes that gap:

- **Record operational activity** — every production run, replenishment, and waste event is logged as it happens, with who did it, when, and how much.
- **Reconcile quantities and discrepancies** — at close of shift, counted stock is compared against what was produced, replenished, and wasted, so gaps are explained in writing rather than guessed.
- **Hand over responsibilities** — shift closeouts and handover notes are acknowledged by the next person, so nothing falls through between shifts.

## How it works

1. **Set up a catalogue** — create a workspace and list the items your team produces or manages, with their units. Managers invite staff with a single-use code.
2. **Log activity during the shift** — production runs, replenishments to the counter, and waste as it happens. Each entry is recorded with a time and a name.
3. **Count and close the shift** — count what is left. LastBatch compares it against production, replenishment, and waste, and flags anything unaccounted for. A written explanation is required for every unreconciled difference.
4. **Hand over with confidence** — write a handover note, and the next shift acknowledges it. The closeout record keeps the numbers and explanations on file.

## Intended users

- Managers who need a verified record of what happened on each shift, not an estimate.
- Staff who need a fast, minimal way to record what they did while the line is moving.
- Teams working across consecutive shifts where the outgoing shift must hand over state to the incoming one.

## Features

- Workspaces with manager/staff roles, single-use invitation codes, and membership management
- Item catalogue with units and active/inactive state
- Shift lifecycle: open, record activity, count remaining stock, close with reconciliation
- Required written explanations for unreconciled differences at closeout
- Handover notes with explicit acknowledgment by the next shift
- Real activity history (who did what, when) rather than inferred summaries
- Light and dark themes, mobile-first layouts

## Technology stack

- **Frontend:** React 19, TypeScript, Vite, Material UI 7, React Router
- **Backend:** Supabase (PostgreSQL, authentication, row-level security, RPCs)
- **Database security:** row-level security on every table, server-enforced workspace membership, SECURITY DEFINER functions for privileged operations (shift closeout, invitations), no client-side-only permission checks

## Local development

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Copy environment variables into a `.env` file at the project root:

```
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_ANON_KEY=<your Supabase anon key>
```

These are public client-side values (the anon key is protected by row-level security), but they are environment-specific. Never place a service-role key in this file.

Database schema changes live in `supabase/migrations/` and are applied in order. Do not edit applied migrations; add a new one.

```bash
npm run build    # type-check and production build
npm run lint     # ESLint
```

## Security architecture

- Every table has row-level security enabled; policies are scoped to workspace membership via the authenticated user's staff record.
- Shift closeout, invitation creation/redemption, and workspace creation run as SECURITY DEFINER functions that re-verify membership and roles server-side, so a modified client cannot bypass them.
- Invitation codes are single-use, optionally bound to one email, and expire.
- The client never holds or transmits a service-role key.

## Production

LastBatch is developed and deployed primarily on [Bolt.new](https://bolt.new), which serves the production build of this repository. The deployed instance is the source of truth for the live application.

## Limitations

- Bakeries and cafés are currently the only fully modeled use case; the terminology (batches, trays, closeouts) is generalizing but the item categories and examples still lean food-service.
- Sold quantities are inferred at closeout (unaccounted-for stock), not captured as verified transactions. The app labels them accordingly.
- One workspace per staff account; multi-workspace membership is not supported yet.

## Future vision

- Generalizing terminology and workflows to additional operational settings (retail back rooms, commissary kitchens, event concession stands).
- Verified sales integration so reconciliation compares against point-of-sale data instead of inferring from counts.
- Multi-workspace membership and cross-site reporting.
- Scheduled shift templates and forecasted production targets.
