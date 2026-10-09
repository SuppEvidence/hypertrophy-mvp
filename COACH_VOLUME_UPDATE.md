# Evidence-based volume and fatigue coaching + weekly set editor

## Prerequisite and application
Use your project with the AI coach token-cleanup update installed. This package includes and preserves the subsequent T3 fatigue-trigger and intra-mesocycle circumference updates; you do not need to apply those ZIPs separately.

Stop the dev server. Extract this ZIP into the hypertrophy-mvp project root, merge folders and replace matching files. It is a replacement-file patch, not a complete repository.

No migration, dependency change, new environment variable or model change is required.

Run in the project directory:
```powershell
npm run typecheck
node --import tsx scripts/test-exposure-tolerance.ts
node --import tsx scripts/test-weekly-coach.ts
node --import tsx scripts/test-pre-workout-coach.ts
npm run dev
```

## What changed
- Recent effective volume and exposure spacing alone no longer set local readiness to CAUTION or RECOVERING. Pain, execution compromise, adverse performance evidence and reported poor recovery remain relevant. Sparse performance history is unknown rather than assumed harm.
- Workout analysis, T2, T3 and weekly planning distinguish acute effort from impaired next-exposure recovery. Intensifier labels, low RIR or effective-set multipliers alone do not prove impaired recovery.
- T2/T3 and weekly planning receive reconstructed weekly muscle doses plus same-exercise next-exposure observations after intensified versus regular work, including spacing, prior mean RIR, pain and execution compromise. The workout analysis receives corresponding context from its already-batched pattern history.
- Clean regular sets use RIR-adjusted comparisons. All-intensifier exposures can use a separate matched-protocol rep comparison only when exercise, type, load, RIR and recorded cluster count or drop-load layout match. Cluster totals are never treated as a straight-set E1RM. Missing protocol/RIR data is unknown, not failed recovery. Comparisons are observational associations, not proof that an intensifier caused an outcome.
- Summary counts are separated by the latest exposure's declared phase period and exclude transitions across a phase start. Date/phase labels remain visible. Cutting-phase performance preservation and shrinking circumferences are not automatically classified as failed stimulus. Gaining-phase tape increases are not automatically classified as muscle gain.
- The general T3 coach retains optional circumference observations and historical block outcomes. Estimates must combine those outcomes with phase, execution/performance and recovery. It does not claim to measure hypertrophy directly.
- The weekly planner is instructed to meet current coach targets using completed PLUS remaining effective work, with primary/secondary contributions, unless specific evidence or availability/time constraints justify an alternative. It must give a per-muscle dose explanation. Actual computed shortfalls are shown rather than hidden. This is an explicit policy and visible reconciliation, not a rigid minimum-set validator that would block constrained weeks or remove user discretion.
- Weekly planning receives all movement-pattern summaries in its selected recent sessions and identifies set types in the performance samples. Existing T3 fatigue labels are treated as estimates to reconcile with observed tolerance, not automatic instructions to cut volume.
- Weekly generation, validation and carry-forward no longer impose a blanket one-new-intensifier-per-workout ceiling. Existing movement suitability, explicit EDT preference, set-type eligibility, exercise preferences and physical/time sanity limits remain. T2's separate day-level introduction limit is unchanged.
- The old 25%-intensifier-share warning heuristic is disabled; share remains descriptive data, not evidence of a recovery problem.
- The weekly page prominently shows effective exercise-set totals and per-priority-muscle dose, target and difference. It excludes completed planned occurrences when counting actual logged work, preventing double counting. Aggregate exercise totals differ from sums of muscle doses because of overlapping contributions.
- Before approval, Adjust sets / set types allows 0-8 sets per exercise and individual eligible set types, with a live exercise-dose preview. Zero removes an exercise while at least one exercise remains in the session. Saving recalculates weekly totals without an AI call. Stale proposals and concurrent changes are rejected. Safety/capacity validation still applies at save and approval.
- Manual edits label the proposal as user-adjusted and remove obsolete per-muscle coach explanations. The original summary remains clearly identified as describing the original allocation. User adjustments do not edit templates or permanent T3 targets.

## Existing plans and live checks
Existing approved plans and stored analyses are not automatically rewritten. The editor is for proposals BEFORE approval; completed and started workouts remain fixed. The existing weekly lifecycle may require waiting for the next planning week once coached workouts have started.

In dev, generate a new weekly proposal when the existing lifecycle permits it:
1. Check that priority targets such as 16.9 and 20 are met or that each actual shortfall has a specific evidence/constraint explanation. Do not expect this patch to retroactively replace an already approved 11/14-set week.
2. Add a set to an exercise, select a suitable preferred intensifier, save, and verify the muscle totals change by that type's multiplier and contribution fractions.
3. Remove a set or exercise and confirm totals decrease. Approve only after reviewing the revised allocation.
4. Confirm completed work appears once after a weekly occurrence is finished.
5. Analyze a productive EDT workout and inspect whether the analysis distinguishes acute fatigue from next-exposure impairment. Historical logging quality can leave tolerance evidence unknown; the coach should not turn that into presumed harm.
6. Run Volume coaching manually if you want an immediate T3 review using the new policy. Otherwise cadence is unchanged.

## Deploy after verification
```powershell
git add "app/(protected)/plan/week/page.tsx" components/weekly/WeeklySetEditor.tsx lib/coaching/exposure-tolerance.ts lib/coaching/pre-workout-coach-policy.ts lib/coaching/weekly-coach-policy.ts lib/coaching/weekly-coach-continuity.ts lib/server/coaching-evidence.ts lib/server/weekly-coach.ts lib/server/pre-workout-coach.ts lib/server/ai-programming-decisions.ts lib/server/ai-workout-analysis.ts lib/ai/training-policy.ts lib/calculations/dashboard.ts scripts/test-pre-workout-coach.ts scripts/test-weekly-coach.ts scripts/test-exposure-tolerance.ts lib/coaching/t3-early-review.ts lib/coaching/intra-mesocycle-circumferences.ts scripts/test-t3-early-review.ts scripts/test-intra-mesocycle-circumferences.ts
git commit -m "Ground coaching dose and fatigue in historical response and add weekly set edits"
git push origin main
```
Your existing Vercel integration deploys main. Do not deploy .env.local.

## Verification and limits
Typecheck including production boundary verification, targeted ESLint, new tolerance/matched-protocol/phase-transition regressions, weekly coach tests, 37 T2 checks, 32 T1 checks, T3 volume/trigger tests, circumference tests and cleanup regressions passed.

Live database-backed AI requests, browser interaction and deployment were not exercised in this environment. The dev checks above cover those remaining integration checks.

The historical sample is bounded by existing queries (shared evidence: up to 500 exercise exposures over 90 days in the program). Weekly doses can be partial weeks, and secondary contributions are reconstructed from current stored estimates. Current-phase summary counts can be sparse after a phase switch. These limitations are supplied to the coach; they do not independently justify reducing established dose.
