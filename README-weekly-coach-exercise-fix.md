# Weekly coach exercise validation fix

Apply on top of `weekly-coach-planning-v2-completed-workouts.zip`. This is a small replacement overlay. It contains four project files; there is **no database migration** and no environment-variable change.

The earlier message, “Incompatible or avoided exercise,” meant that the model returned an exercise absent from the allowed active catalog, or paired a slot with an exercise from another movement pattern. It also wrongly rejected a valid case where an existing template slot's saved movement label differs from its own exercise's catalog movement group. The invalid draft was rejected before saving; it did not change your workouts or completed Monday session. Without the returned proposal, we cannot tell which of these cases caused your particular attempt.

This fix:

- Permits keeping the exercise already assigned to a template slot even when that slot's historical movement label differs. The same rule is used at approval/application.
- Gives the model each slot's permitted exercise IDs and tells it to use a new temporary `exercise:<id>` slot when adding a different movement.
- Validates every proposed plan. If it fails, sends the exact issues back for **one** corrected proposal within the weekly review's time budget. If the corrected plan is still invalid, it is rejected and the UI identifies the offending date and exercise or slot. An avoided or inactive exercise remains forbidden.

## Development

1. Extract the ZIP into the existing app root, replacing the four matching files. Keep the earlier weekly planner migrations already applied; do not repeat a migration for this fix.
2. Run `npm run typecheck` and `node --import tsx scripts/test-weekly-coach.ts`.
3. Start dev and run **Plan → Weekly coach** again. A previously failed proposal was not saved, so the review should start normally. Check the generated exercises before approving.

## Production

Once the corrected review works in dev, commit and push these four files to `main` for your normal Vercel deployment. No production migration is needed for this overlay. If you have not deployed the original weekly planner to production yet, first apply both migrations included in its v2 archive to production before pushing the combined code.

Verified locally: Prisma Client generation, TypeScript typecheck, production boundary verification, focused weekly/model-routing tests, targeted ESLint and whitespace check. The live OpenAI proposal that triggered your error was not available in this workspace.
