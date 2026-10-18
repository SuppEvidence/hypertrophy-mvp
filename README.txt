Workout logger focus patch

Base: 968c991 (Weekly slot reference fix).

Merge the included app, components, lib, scripts and docs folders into the project root, replacing matching files.

Run:
  npm run typecheck
  node scripts/test-workout-exercise-guidance.mjs
  node scripts/test-train-weekly-recovery.mjs
  npm run build

Then commit and push as usual. Refresh an open Train page after deployment.

No dependency installation, database migration, Supabase SQL, profile reanalysis or environment changes.

Active sessions now focus on exercise names and logging. Saved setup/execution guidance is expandable per exercise. Planning selectors stay before session start; exercise changes, notes and totals are folded. Existing logging variables, timing, pain, filmed/execution tracking and live coaching remain available.

Opening guidance makes no AI call. It uses saved accepted profile information and suppresses stale/unaccepted execution advice.

Full details and verification: docs/workout-logger-focus.md.
