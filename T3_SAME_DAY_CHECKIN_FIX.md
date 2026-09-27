# T3 same-day mesocycle check-in fix

This hotfix overlays the three files in the ZIP onto the previously deployed secondary-contribution / unified-check-in patch. It does not add or change a database migration.

## Issue

The measurement form stores a selected date as noon. The next-block review queried check-ins only up to the current timestamp. A check-in saved in the morning was excluded from both the automatic review and the review page's readiness status until noon server time. The query now covers the entire current calendar day; the existing selector still rejects future dates. The focused regression test checks a morning request against a same-day noon check-in.

## Apply

1. Extract this ZIP in the app repository root, replacing the three files.
2. Run:

   ```bash
   npm run typecheck
   node --import tsx scripts/test-mesocycle-checkins.ts
   ```

3. Commit and push to main for the normal Vercel deployment. **No Prisma migration or seed is needed for this hotfix.** After deployment, save a new mesocycle circumference check-in for today's date (or complete a workout) to trigger the previously missed automatic review. Then check **AI Analysis → Mesocycle**.

A next-block review still requires T3 priorities active, the final week of the mesocycle (or seven days after its end), one start and one end check-in within their seven-day boundary windows with at least one shared circumference, and a completed workout in that block. The end check-in of the preceding block can supply the next block's start. Saving measurements does not itself activate the distinct T3 *weekly volume* coach; that coach is configured by T3 priorities and runs from completed workouts.

The automatic model call is asynchronous. If the page shows check-ins ready but no review after the trigger, inspect the Vercel function logs for `Automatic mesocycle check-in review failed` or `OpenAI returned no parsed mesocycle recommendation`.
