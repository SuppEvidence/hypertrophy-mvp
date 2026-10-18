Weekly planner workout-position fix

Base: c3961b8 (Volume coach card update).

Merge the included app, lib, scripts and docs folders into the project root, replacing matching files.

Run:
  npm run typecheck
  node --import tsx scripts/test-weekly-slot-references.ts
  npm run build

Commit and push as usual. No dependency installation, database migration, Supabase SQL or environment changes.

After deployment, refresh the planner and run the failed review once again. That failed proposal was not saved. The repair itself makes no additional AI call.

The patch reconnects stale/malformed workout-position references to the selected active exercise without changing the exercise, sets, set types or schedule. Existing drafts are repaired during normal approval as well. Unsupported/unavailable exercises and other invalid work still fail validation.

Remaining validation errors identify the date and exercise where available. The error panel displays up to three distinct problems on separate lines, with a longer readable message.

Full details and verification: docs/weekly-slot-reference-fix.md.
