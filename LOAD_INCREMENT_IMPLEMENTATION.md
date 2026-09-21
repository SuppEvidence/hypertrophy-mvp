# Exercise minimum load increment

This follow-up adds an optional `minimumWeightIncrement` to exercise records.
It is the smallest possible change in the load number entered in the workout
logger. Examples:

- A selectorized stack moving from 60 to 65: enter `5`.
- A bilateral plate-loaded machine logged as total added load, where the
  smallest plates add 1.25 kg per side: enter `2.5`.
- A unilateral machine logged per side, with one 1.25 kg plate: enter `1.25`.

Use the same convention as the exercise's historical logged weight. This is a
change amount, so it does not need to divide every displayed load evenly.

## Coach behavior

- A configured increment produces valid load options relative to the current
  logged load. Only whole increments inside the T1 -10%/+5% guardrails are sent
  to the model, and the server rejects any other suggested load.
- A blank increment disables automatic load changes for that exercise. Rep and
  RIR adjustment remain available.
- The existing pre-workout weight estimate is also rounded to the configured
  increment, anchored to a previously logged load.
- Changing the setting affects future recommendations. It does not rewrite
  historical sets or existing coach-action records.
- Editing a global seed exercise follows the existing app behavior and creates
  a custom copy. Use that equipment-specific custom exercise in the template or
  workout so its increment applies.

## Install and verify

Extract the ZIP into the project root after T1, then run:

```bash
npm install
npx prisma generate
npm run typecheck
node --import tsx scripts/test-exercise-load-increment.ts
npm run build
```

In dev, apply the new migration:

```bash
npx prisma migrate deploy
```

Then edit one custom exercise, set its minimum load increment, and verify:

1. The saved value appears in the exercise list and workout logger.
2. The ordinary suggested weight follows that increment.
3. A qualifying live-coach load change uses an available increment.
4. Leaving the field blank prevents automatic load changes while rep/RIR
   coaching still works.

## Deploy

Apply the production migration before pushing the application:

```bash
npx prisma migrate status
npx prisma migrate deploy
git add prisma/schema.prisma prisma/migrations/20260921120000_add_exercise_minimum_weight_increment lib/validations/exercise.ts lib/types/domain.ts lib/server/exercises.ts components/exercises/ExerciseForm.tsx app/'(protected)'/exercises/page.tsx lib/coaching/workout-coach-policy.ts lib/server/live-coaching-context.ts lib/server/workout-coach-engine.ts lib/server/workouts.ts components/workouts/WorkoutLogger.tsx components/workouts/AutosaveSetRow.tsx scripts/test-workout-coach.ts scripts/test-workout-coach-engine.mjs scripts/test-exercise-load-increment.ts T1_IMPLEMENTATION.md LOAD_INCREMENT_IMPLEMENTATION.md
git diff --cached --stat
git commit -m "Add exercise load increments to live coaching"
git push origin main
```

The migration only adds a nullable decimal column and a positive-value check.
Existing exercises remain valid with a null increment. No new environment
variables or dependencies are required.
