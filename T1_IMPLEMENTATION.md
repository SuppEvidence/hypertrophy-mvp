# T1 live workout coach

Extract this archive into the project root, overwriting the included files.
Requires the previously deployed T0 schema and migration. This update contains
no additional database migration and does not change base templates.

## Behavior

- After a completed set is saved, deterministic checks decide whether an AI
  request is worthwhile. Normal performance stays quiet.
- The coach can automatically change the NEXT unstarted set's prescribed load,
  rep range and RIR. A small card explains the change, and the set row shows its
  persisted coach targets. No Apply button is required for these adjustments.
- Targets are separate from performed load/reps/observed RIR. Enter what you
  actually do; the coach never overwrites those observations. If your equipment
  cannot use the suggested load, log the actual available load instead.
- Removing the last remaining set, or stopping an exercise by removing all its
  remaining sets, always requires clicking Approve removal. Keep all sets
  declines the recommendation. Completed or started sets cannot be removed by
  the coach. Approved removals retain prescription snapshots in the ledger.
- No rest recommendations, added sets, exercise swaps, or template changes.
- Uses the existing OPENAI_API_KEY and OPENAI_MODEL. Optional emergency switch:
  LIVE_COACH_ENABLED=false (redeploy after changing a Vercel environment value).

## Sensibility and consistency

- No AI requests for single-set exercises, final sets, completed sessions,
  incomplete sets, or when a later set has already started.
- Performance checks require at least three comparable exposures, with matching
  exercise/set type and set position. Comparisons exclude missing RIR, compromised
  execution, pain, intensifier totals, zero load and high-rep index extrapolation.
  History is limited to the latest eight exposures within 90 days.
- Current pain or execution flags can justify review with less history; pain
  cannot automatically increase exposure. Single/final-set exclusions still apply.
- Product guardrails (not research-derived physiological boundaries): robust
  historical variation, substantial target misses, or unusually large decay
  are required. These thresholds are intentionally conservative.
- Load changes are limited to -10%/+5%; rep-range endpoints to +/-2 reps; RIR
  to +/-1 within 0–4. Harder targets require a clearly too-easy set. Unsupported
  bodyweight/assisted and intensifier adjustments are rejected. Equipment-step
  knowledge remains limited; half-kilogram suggestions may need manual rounding.
- One provider call per qualifying trigger set, including failures. A database
  claim prevents duplicate requests from retries or multiple tabs. No automatic
  provider retries. The provider request has a 20-second timeout; logging remains usable.
- Automatic changes use server-side snapshots and row locks. Changed, started,
  completed or stale targets invalidate the intervention. Removal approvals
  expire after five minutes and are revalidated when clicked.
- Same-exercise intervention history (including declined removals and outcomes)
  is supplied to subsequent decisions. Outcomes describe target attainment,
  not demonstrated hypertrophy or causal benefit. Edited/uncompleted sets
  update their outcome evidence. Removed sets have inconclusive outcomes.
- Live checks start after a save in the open workout logger; no background job
  scans completed workouts. A refresh restores existing pending recommendations.

## Local verification

```bash
npm run typecheck
node --import tsx scripts/test-workout-coach.ts
node scripts/test-workout-coach-engine.mjs
node scripts/test-workout-coach-outcomes.mjs
npm run build
```

The package adds pretypecheck=prisma generate to prevent stale Prisma types.
Tests are offline: model and database calls are mocked for engine/outcome tests.
They cover policy limits, duplicate claims, stale responses, owner checks,
approval-only removal, failure handling, and outcome interpretation.
They do not substitute for an authenticated dev smoke test against your database.

## Dev smoke test

1. Open a draft with several sets for an exercise with comparable history.
2. Confirm an ordinary saved set leaves the coach quiet. A single-set exercise
   and the final set must not call the AI.
3. On a disposable test workout, log a meaningful target miss. The AI may still
   choose KEEP; a qualifying signal does not force an adjustment.
4. If targets change, confirm the next row displays them and entered actual
   values remain intact. Reload and confirm targets persist.
5. If removal is proposed, first choose Keep all sets; confirm nothing disappears.
   On a separate proposal, approve removal and confirm only the listed unstarted
   sets disappear. Do not fabricate pain in your real training history to test this.
6. Start the next set while a request is pending: the late change must not apply.
7. Finish logging and inspect that the workout saves normally if the coach is
   unavailable. Clean up disposable test workouts afterward.

## Deployment

No npm dependency changes or new migration are required. After dev verification:

```bash
git add app/api/workout-coach/route.ts components/workouts/AutosaveSetRow.tsx components/workouts/WorkoutLogger.tsx components/workouts/LiveWorkoutCoach.tsx lib/coaching/workout-coach-policy.ts lib/server/live-coaching-context.ts lib/server/workout-coach-actions.ts lib/server/workout-coach-engine.ts lib/server/workout-coach-outcomes.ts lib/server/workout-set-autosave.ts package.json scripts/test-workout-coach.ts scripts/test-workout-coach-engine.mjs scripts/test-workout-coach-outcomes.mjs T1_IMPLEMENTATION.md
git diff --cached --stat
git commit -m "Add T1 live workout coaching"
git push origin main
```

Vercel builds automatically from main, with Prisma generated by prebuild. Verify
the production logger after deployment. No credential rotation or new secret is
needed. Rolling back the application deployment restores T0 behavior; the
existing additive T0 database schema can remain in place.
