# Secondary contribution and mesocycle check-in patch

Apply this overlay **after** the previously delivered chest-region migration. It contains two additional Prisma migrations; the second adds the consolidated `MESOCYCLE_CHECKIN` enum value. Do not ship app code against a database that has not run both migrations.

## Behavior

- The Program and Settings forms no longer ask for a global secondary-muscle percentage. Each exercise × secondary-muscle relationship stores the coach's 0, .25, .5, .75, or 1 estimate, rationale, model, timestamp and version. Primary muscle credit remains 1. The legacy numeric program/settings columns remain in the database for compatibility but no longer control effective-work calculations.
- The same stored estimate is used in T1 context, T2 dose validation, T3 planned and completed volume, dashboard/template volume, workout summary and follow-up observations. The coefficient scales the *set-type-adjusted completed or planned work*. An unassessed relationship counts **zero** until evaluated, preserving the user's prior zero setting and avoiding invented credit.
- Saving a new exercise queues its assessment after the response; Dashboard and Exercises views gradually backfill existing links, two exercises per request, without delaying the page. The Exercises editor shows pending/estimated status. Editing the exercise's movement group, primary muscles, setup or name invalidates its previous assessment; ordinary edits preserve it. Re-running the seed preserves unchanged assessments.
- An end-of-mesocycle T3 review can separately reconsider at most one candidate in the background. It requires comparable check-ins and repeated exclusive secondary exposure across two blocks, then asks a T3 model to review exercise mechanics. Any change is limited to .25 per review and is recorded in an append-only audit table with observational evidence. A measurement trend is never treated as proof that an exercise caused growth. A review may make no changes.
- The Metrics form offers one “Mesocycle circumference check-in” choice. The same saved row serves as a previous mesocycle's end and the following one's start when it is within both seven-day windows. Historical START/END rows remain valid. A review still needs two distinct check-ins with a matching circumference for the block being reviewed.
- A later reassessment changes the calibrated coefficient used when historical volume is recomputed. The audit table records T3 changes; historical effective-set displays may therefore shift without changing any completed workout records.

## Apply and verify

1. Extract `secondary-contribution-boundary-checkin-patch.zip` **into the repository root**, preserving directory names. Its files overwrite the corresponding earlier patch files. Keep your own `.env.local`; it is not included.
2. In your **development** checkout, with your normal development `DATABASE_URL` configured, run:

   ```bash
   npx prisma migrate deploy
   npx prisma generate
   npm run typecheck
   node --import tsx scripts/test-secondary-contributions.ts
   node --import tsx scripts/test-mesocycle-checkins.ts
   node --import tsx scripts/test-priority-structure.ts
   node --import tsx scripts/test-t3-volume-coach.ts
   ```

3. Start dev, open Dashboard or Exercises to let pending assessments start, then inspect a secondary muscle on an exercise. For a new exercise, save and return to the editor after the background call finishes. Check the updated volume previews and save a `Mesocycle circumference check-in` near a boundary. Check Vercel or dev logs for `COACHING_AI` or assessment errors if estimates remain pending. `OPENAI_API_KEY` and the existing T2/T3 model configuration must be available in the environment running the server.
4. Commit the changed files, including **both** `20260926150000_secondary_contribution_profiles` and `20260926151000_metric_checkin`. For production, apply `npx prisma migrate deploy` to the **production** database before new application code starts serving. One option is to set the Vercel production build command to `npx prisma migrate deploy && npm run build` for this deploy, using the protected production `DATABASE_URL` already configured in Vercel; confirm Preview builds do not target production. Then deploy the commit and inspect `npx prisma migrate status` against each environment. Do not copy `.env.local` into Vercel.

The migrations are additive: there is no bulk rewrite of historical check-in types or completed workouts. Seed is not required for this patch. I could validate schema and code locally, but could not execute migrations or call the AI against your database here.
