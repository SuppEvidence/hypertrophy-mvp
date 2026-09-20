# T0 live coaching foundation

This package adds the persistence and deterministic context layer required by
set-by-set autoregulation. It does not yet call the AI after a set or render
live recommendations in the logger; those belong to the next implementation
tier.

## Included

- Live exercise coaching context for an active workout
- Exercise history plus 48/72-hour exercise, movement, muscle, symptom, and
  recovery context
- Deterministic eligibility guardrails that run before any future AI request
- Original/current set-prescription snapshots
- A dedicated workout-coach action ledger with proposed/applied/declined state
- Automatic short-horizon outcome evaluation after a target set is completed

## Guardrail behavior

The live context returns `eligibility.shouldCheck = false` when:

- the session is not a draft;
- the trigger set is incomplete or lacks usable data;
- the exercise has only one planned set;
- no future set remains to change;
- a normal first set has fewer than three comparable historical exposures;
- the trigger set has already produced a recorded coach action.

Pain or compromised execution can justify a check earlier, but only while a
future set remains. The unique trigger-set constraint also prevents duplicate
actions if two requests race.

## After extracting to project root

Run:

```bash
npm install
npx prisma migrate deploy
npm run typecheck
npm run build
```

No new environment variables are required.
