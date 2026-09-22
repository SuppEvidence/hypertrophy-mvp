# T2 pre-session coach

T2 adds an approval-based coaching review before a workout session is created.
It extends the deployed T0/T1 architecture and requires no database migration.
Accepted plans are stored inside the session's existing `prescriptionSummary`
snapshot for later audit.

## User flow

1. Select the normally scheduled template in the workout logger.
2. Optionally enter today's available time and constraints such as unavailable
   equipment, pain/irritation, or an exercise to avoid.
3. Choose **Review workout with coach**. This is the only action that makes a
   pre-session model request.
4. Review the evidence summary and final proposed exercise order.
5. Choose **Start coached workout** to accept a changed proposal, or start the
   template unchanged. No structural change is silently applied.

The coach can retain or choose another active template in the same program,
reorder or omit slots, import at most two compatible slots from other program
templates, substitute an exercise inside the same movement pattern, and make
small set/rep/RIR changes. The created draft remains editable in the normal
logger.

## Evidence used

- Current program and mesocycle phase, priorities, volume bounds and weekly plan
- The prescribed slots from every active template in the selected program
- Same-exercise normalized performance trends using weight, reps and observed
  RIR; intensifiers and execution-compromised sets are excluded as clean
  progression anchors
- Recent movement-pattern workload, time since exposure, pain and execution
  compromise
- Recent stored workout analyses for stimulus, fatigue and pattern context
- Recovery metrics: sleep, stress, readiness, manual fatigue and soreness/joint
  irritation
- Paired bodyweight and waist trends over time
- The time and constraints entered for the current session

Paired downward bodyweight and waist trends can establish a likely fat-loss
context. In that context, maintenance of training quality/performance can be a
successful outcome; gain-phase strength improvement is not required. The phase
inference calibrates interpretation but cannot by itself change the workout.

## Guardrails

- KEEP is the default under sparse, mixed or noisy evidence.
- Local readiness is labeled as an inference, not a direct recovery measurement
  or medical diagnosis.
- A proposal cannot increase the chosen base template's total physical sets.
- An exercise must remain inside the source movement pattern.
- At most two slots can be imported from outside the chosen base template.
- Rep-range endpoints can move by at most two reps and RIR by at most one.
- A missing rep or RIR target cannot be invented.
- A locally cautioned movement cannot receive more sets or a harder RIR target.
- Provider output is checked against current server-side prescriptions again
  when the user starts the workout. Proposals expire after 30 minutes.
- User-entered constraints are treated as data, not model instructions.
- Provider failure never blocks starting the template unchanged.
- No automatic retries, background requests or page-load model calls are added.

Set-by-set T1 coaching still owns live load, rep and RIR changes after sets are
logged. T2 does not overwrite actual performed values.

## Additional UI fix

The workout-analysis submit button now immediately becomes **Analyzing…**, is
disabled and shows a spinner while its server action is running.

## Local verification

```bash
npm run typecheck
node --import tsx scripts/test-pre-workout-coach.ts
node --import tsx scripts/test-workout-coach.ts
node scripts/test-workout-coach-engine.mjs
node scripts/test-workout-coach-outcomes.mjs
npm run build
```

The pre-workout policy tests are offline. They cover body-composition phase
inference, recovery summaries, localized readiness, template deviation and
hard structural limits. An authenticated dev smoke test is still required for
the live provider request and session creation transaction.

## Dev smoke test

1. Open `/log`, select the suggested template and run a review with no stated
   constraints. Confirm that KEEP remains possible and no draft is created yet.
2. Repeat with a disposable constraint such as a shorter time limit. Confirm
   that any proposed changes are visible before approval.
3. Start the coached workout and confirm the exercise order, set rows, targets
   and T2 prescription notes match the reviewed proposal.
4. Confirm **Start template unchanged** still creates the normal prescription.
5. Enter an impossible or expired proposal only in a disposable dev session;
   confirm server validation refuses it.
6. On the workout-analysis page, press Analyze and confirm the button changes
   immediately to **Analyzing…** and cannot be submitted twice.

## Deployment

No migration, package installation or new required environment variable is
needed. `PRE_WORKOUT_COACH_ENABLED=false` is an optional emergency switch.

After dev verification, commit the included files and push `main`. Vercel can
deploy normally. Rolling back the application deployment removes T2 behavior;
the existing T0/T1 database schema is unchanged.
