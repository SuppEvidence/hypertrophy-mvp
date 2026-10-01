# AI coach input and output cleanup

This cumulative archive includes the preceding weekly planner intensifier, exercise-choice, duplicate-exercise, and set-type recovery fixes. Apply this ZIP alone over the current project files.

## Changes

- T1 uses a short policy specific to live load/rep/RIR and approval-required removal decisions. Its input omits unused bookkeeping, repeated RIR fields and whole-session prescription copies. Trigger targets, observed sets, historical comparisons, recovery, pain and execution evidence remain available.
- T2 omits legacy numeric mesocycle targets, uses compact analysis evidence and shorter intervention history, and supplies the approved weekly schedule instead of also supplying the old scheduling framework. It distinguishes completed and in-progress occurrences and includes effective work for the weekly schedule.
- New workout analyses use shorter, non-repeating explanations. Routine sets can have an empty rationale while retaining their stimulus, fatigue, RIR plausibility and confidence labels. Exercise and movement conclusions still explain material deviations. Stored historical analyses retain their existing schema and detail.
- T2, T3 volume and mesocycle review share a compact analysis projection. Adverse signals, confidence, performance decay, and movement interpretation remain available without repeating workout summaries and per-set narratives downstream.
- Weekly planning can reuse a validated T3 assessment when it is at most seven days old, covers the newest workout/analysis/metric evidence and energy phase, and matches the current priorities. It keeps objective recent workout evidence. New or contradictory evidence requires reassessment.
- T3 volume review now sees actual completed weekly dose and the remaining approved weekly dose separately, including missed-workout redistribution and set-type/secondary-contribution estimates. Completed occurrences are excluded from planned remaining work. In-progress dose is labeled as a plan estimate. Persistent template targets are kept separate for reviewing and applying long-term changes.

## Apply in dev

Extract the ZIP into the project root, replacing the included files. No database migration, new package, or environment variable is required.

Run from the project root with your normal local environment:

```powershell
npm run typecheck
node --import tsx scripts/test-coach-cleanup.ts
node --import tsx scripts/test-weekly-coach.ts
npm run dev
```

Check a completed workout analysis, a daily proposal for an approved weekly occurrence, and a volume review. Confirm the shorter analysis remains useful and the volume review distinguishes completed work from the remaining weekly plan. Previously saved proposals and analyses are not rewritten by applying these files.

## Production

Commit the replaced/new files, push to main, and check the automatic Vercel deployment. No migration or environment updates are needed. Existing model usage logs report input/output tokens and request duration; compare actual requests before estimating savings. The cleanup has been checked with typecheck, targeted lint, and focused evidence, weekly planner, T1 and T2 policy tests. No live model request was made during verification.
