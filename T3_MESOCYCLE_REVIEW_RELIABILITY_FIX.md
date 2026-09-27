# T3 next-block review reliability fix

Extract this ZIP in the app repository root over the **already deployed** unified mesocycle check-in and same-day check-in updates. This is a code-only patch: **no Prisma migration and no reseeding**.

## What changed

- A finished workout within the block now counts when its **program and workout date** match, even if a historical session has no `mesocycleId`. This same rule supplies the actual workouts to the AI, rather than merely bypassing the start gate.
- A check-in still requires distinct start and end dates within seven days of the respective boundaries and at least one common circumference. No completed workout is required on the mesocycle end day: any completed workout inside the block qualifies.
- The Metrics and Mesocycle analysis routes allow enough execution time for the long-running background/model call. The next-block page shows the number of qualifying workouts and offers **Run next-block review** with a busy indicator. If model generation fails, it shows the error instead of silently waiting for another event. Saving measurements and completing a review refreshes the review page.
- The recent ended mesocycle remains accessible during its review window, even if the next one has begun.

## Install and verify

```bash
npm run typecheck
node --import tsx scripts/test-mesocycle-training-window.ts
node --import tsx scripts/test-mesocycle-checkins.ts
```

Commit and push to `main` for your normal Vercel deployment. After deployment, open **AI Analysis → Mesocycle**. If check-ins and completed workouts are ready, click **Run next-block review**. You do **not** need to add another measurement or complete another workout. If it fails, the page displays the failure; the Vercel function logs provide additional detail. No `.env.local` upload is needed.

Code and focused tests passed locally. The production database and OpenAI invocation were not available for end-to-end testing here.
