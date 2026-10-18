Weekly planner early unlock — 18 October 2026

Base: 6aa59db (Dashboard update).

Apply:
Copy the included app, lib and scripts folders into the project root, merging folders and replacing matching files. Then run:

  npm run typecheck
  node scripts/test-weekly-planner-access.mjs
  node --import tsx scripts/test-weekly-planner-window.ts
  npm run build

Commit/push as usual. No dependency install, Prisma migration, Supabase SQL or environment changes are needed.

Behavior:
The upcoming Monday-to-Sunday week becomes available as soon as every workout occurrence in the current week's approved allocation has a completed logged session. The planner then defaults to the upcoming week; the current week stays selectable. Generation, approval and editing all use the same server-side availability rule.

Started/draft workouts, missed workouts, duplicate completions of a single occurrence and unrelated workouts do not count as completing the full plan. If no approved week exists, or some planned workouts remain incomplete, the existing Sunday 12:00 Helsinki opening still applies.

Upcoming workouts become active in Train on Monday. Early planning does not advance the logger's calendar week. Completion is checked again after coach generation before saving, so a changed completion state cannot silently bypass the gate. A stale open page may need refreshing after the final workout is completed.

AI and data:
The unlock uses small, user/program/week-scoped reads of saved plan and completion metadata. It does not generate a plan or call AI automatically. Existing manual coaching triggers and approval remain in effect. No schema or permissions changes.

Validation:
Typecheck, production build, completion-access regressions, Helsinki calendar/DST/week-boundary tests and existing Train weekly recovery tests passed. Tests used mocks; no live database or Vercel deployment was changed.
