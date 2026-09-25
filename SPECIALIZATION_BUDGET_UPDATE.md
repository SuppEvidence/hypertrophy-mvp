# Specialization budget and placement update

Replace the four included source files at their normal project paths. This update builds on the previous T2 effective-work package and the existing T3 priority model. It does not change the database schema or environment variables.

## Coaching behavior

- T3 now explicitly reviews the overall training budget when suggesting changes: competing muscle priorities, set slots, recovery, overlap and session capacity. A productive lower-priority muscle is not automatically cut to create room.
- For routine pre-workout reductions, T2 protects a higher-priority exercise's primary-muscle dose until lower-priority slots have also been reduced. Credible localized caution or a stated equipment/symptom constraint permits cutting that priority exercise directly.
- T2 may propose moving a late specialization exercise earlier to protect execution. The app preserves the workout order on KEEP and rejects a changed workout order that pushes a higher-priority exercise behind a lower-priority exercise it previously preceded. An earlier move is shown before the user approves the workout.
- This does not force priority exercises to be first when alternating sets, equal-priority exercises or equipment flow make that impractical. It also does not prescribe a fixed specialization volume or a universal maintenance dose.

## Deploy (PowerShell, project root)

```powershell
npm run typecheck
node --import tsx scripts/test-pre-workout-coach.ts
git add lib/coaching/pre-workout-coach-policy.ts lib/server/pre-workout-coach.ts lib/server/ai-programming-decisions.ts scripts/test-pre-workout-coach.ts SPECIALIZATION_BUDGET_UPDATE.md
git commit -m "Protect specialization volume and prioritize workout placement"
git push origin main
```

The push triggers the normal Vercel deployment. The local typecheck command requires your configured `DATABASE_URL` for Prisma generation. Direct TypeScript checking, targeted ESLint and 33 pre-workout policy checks passed in the development workspace.
