Volume coach remaining-decision refresh patch

Base: 76b3056 (deployed weekly planner availability update).

Merge the included app, lib, scripts and docs folders into your project root, replacing matching files.

Run:
  npm run typecheck
  node scripts/test-t3-decision-refresh-actions.mjs
  npm run build

Then commit and push as usual.

No database migration, Supabase SQL, dependency installation or environment changes.

Accepting one volume change now updates the remaining cards from the saved assessment and current accepted prescription, without another AI review. Partial overlap counts toward the existing goal. Already covered suggestions offer Accept current dose, aligning the approved target without editing more sets. Every change still requires approval.

Refresh a volume page left open during deployment. Current pending suggestions can be used without generating a new review just to initialize this patch.

Full behavior, edge cases and verification: docs/volume-decision-refresh.md.
