# T2 workout continuity and exercise choice memory

Apply on top of the current T0–T3 app and the manual mesocycle planning update. The ZIP contains complete replacement files at their project-relative paths, plus one new Prisma migration. It does not contain a new `.env.local`.

## Changes

- The pre-workout review gets the most recent completed session for the exact program/template, tagged with whether it belongs to the current mesocycle. The coach sees its exercise choices, completed sets and set types beside the current mesocycle prescription and recent coaching decisions. It is instructed to distinguish changes already in today's plan from new proposals and to avoid repeating a temporary change without a fresh reason.
- The review UI shows a compact comparison with the last same-template workout: currently prescribed adjustments, and differences in selected exercise, completed sets, set type, or order. The main change list remains relative to today's prescription.
- Each session exercise now records whether its exercise selection should persist or apply only to that workout. Coach swaps are temporary by default. Check **Use ... next time too** before accepting a proposed swap if you want it remembered. When changing exercise in the logger, check **Only use this exercise today** for a one-day equipment/pain workaround; otherwise it remains the slot's saved exercise.
- Exercise memory searches completed workouts of the same program and template for the latest lasting selection for each slot, skipping temporary choices. Historic coach substitutions without this flag are treated as temporary; ordinary historic manually chosen exercises still serve as a fallback. Only active, unarchived exercises are eligible.

## Development

1. Extract this archive at the app's project root, replacing existing files.
2. Apply the included migration to the **development database**: `npx prisma migrate deploy`.
3. Run `npm run typecheck` and `node --import tsx scripts/test-exercise-choice-policy.ts`.
4. Run `npm run dev`. Review a workout, accept a coach exercise swap without checking the remember option, complete it, and verify the next same-template workout returns to the saved selection. Repeat with the option checked and verify the swap persists. Try a one-day manual substitution in the logger. Inspect the comparison in the next pre-workout review.

## Production deployment

1. Apply the included migration **to production before deploying the new code**, using your existing secure production database migration method: `npx prisma migrate deploy` in an environment connected to the production `DATABASE_URL`.
2. Commit and push the patched files to `main`; your usual Vercel deployment can build the code after the migration. Verify the new deployment and check the pre-workout review UI.

The migration is additive (one nullable `exercise_choice_intent` column). No backfill, new package, or environment variable is required. Do not run the production migration against your development `.env.local` by accident.

Verification in the workspace: TypeScript typecheck, production boundary check, focused exercise-choice tests, targeted ESLint, and diff whitespace check. The production database and OpenAI service were not used in these checks.
