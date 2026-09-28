# Weekly coach: exercise choice and set type update

This archive supersedes `weekly-coach-intensifiers.zip`; apply this archive alone. It includes the earlier weekly intensifier changes plus the exercise-choice corrections.

- Each exercise may appear only once within one proposed workout. Repeated slots with at most eight combined physical sets are combined before a new proposal is saved. Larger duplicates are rejected rather than silently discarding work. Approval checks the rule again.
- Next week's carried starting plan uses the last completed week's set counts and exercise selections. A swap marked “Only use this exercise today” restores the exercise in the prior approved weekly plan; a persistent swap carries forward. An extra temporary exercise without a corresponding planned slot is not carried.
- An older approved or completed workout with the same exercise in two slots is combined into one starting slot for the next week, within the eight-set-per-exercise limit.
- Exercise-compatible intensified set types can be proposed under the existing set-type rules and appear on the proposal and approved workout. EDT requires explicit per-exercise selection.

## Apply (PowerShell, project root)

1. Extract this ZIP into the project root and replace the included files. No database migration or environment change is required.
2. Run `npm run typecheck` and `node --import tsx scripts/test-weekly-coach.ts` using your configured local `.env.local`.
3. In dev, run a weekly review, inspect the exercises and set types, approve the plan, and open the workout. If a previous proposal already shows a duplicated exercise, run the review again; saved proposals are not altered during deployment.
4. Commit the changed files, push to `main`, and verify the Vercel build.
