# Manual review and scheduled mesocycle planning

Apply these files over the current T3 app after the mesocycle check-in and review reliability update. This package includes the complete versions of the changed files; preserve the listed directory paths.

## Changes

- The next-block AI review runs only when you press **Run next-block review**. Saving measurements, completing workouts, and ending a mesocycle no longer launch it automatically. The automatic in-block T3 volume coaching is unaffected.
- **Plan → Mesocycle planning** places the coach's review and the next-block form together. The complete recommendation remains available through **Read full coaching review**.
- Creating a block saves its muscle priorities in the same operation. Suggestions from a review prefill the selectors; you can change them before saving. If there is no suggestion, priorities copy the previous block or program defaults.
- The suggested start date is the day after the previous block ends (or today if it already ended). A block scheduled Sunday for Monday starts on Monday without ending Sunday's block early. Creation or date edits that overlap another non-archived block are rejected.
- The existing **End active mesocycle early** action is still available for genuinely shortened blocks. No end action is needed at the normal planned boundary.

## Apply locally

1. Extract this ZIP into the app's project root, replacing files at the listed paths.
2. Run `npm install` only if dependencies are missing. Run `npm run typecheck`.
3. Run `npm run dev`. Open **Plan → Mesocycle planning**. With a Sunday end date, confirm the new block defaults to Monday. Review or change the priorities, create the block, and verify Sunday's block remains active until the scheduled transition. Check that a conflicting start date is rejected. If check-ins and completed workouts are ready, press **Run next-block review** and inspect the coach suggestions.

## Deploy to Vercel

1. Commit and push the patched files using your normal git deployment flow. Vercel should deploy that commit.
2. Confirm the build succeeds, then open **Plan → Mesocycle planning** in production and confirm the scheduled date and manual review controls.

There is **no schema change or migration**, and no new environment variable. Do not run `prisma migrate deploy` specifically for this patch. If other undeployed schema migrations exist in your checkout, apply those separately before deploying code that depends on them.

`npm run typecheck`, targeted ESLint, and `git diff --check` passed in the development workspace. No database-backed end-to-end test was run here.
