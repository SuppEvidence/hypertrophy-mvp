# T2 pre-workout effective-work update

This package contains the updated files at their normal project paths. Replace those files in your existing project. It builds on the earlier T1–T3 implementation and the model-routing update.

## What changes

- The coach receives the actual set type and multiplier for every planned set and must explicitly prescribe one set type for every proposed set.
- The server compares physical sets, effective sets, intensifier count, movement dose, and estimated primary/secondary muscle dose against the selected base template. It rejects any total physical or effective increase, more than one newly introduced intensifier, movement or muscle increases over one effective set, and local increases under a CAUTION signal.
- New intensifiers are allowed only on an explicit set of single-muscle isolation movements. Lengthened partials can be newly prescribed only for lateral raises and knee extensions. Other intensifiers can be proposed for leg curls, triceps extensions/pressdowns, hammer curls, and straight-leg calf raises. Existing template intensifiers can be retained; a proposed exercise substitution is checked anew.
- New intensifiers are barred under local CAUTION or RECOVERING, with an unsuitable rep/RIR target, and when the effective-dose budget would be exceeded. The user sees estimated dose and proposed set types before approving; accepted set types are written into workout sets.
- Multipliers remain estimates of effective volume, not a deterministic measurement of stimulus or fatigue. Logged performance, symptoms, recovery and completed work still inform readiness.

## Apply and deploy

From the project root in PowerShell, after replacing the included files:

```powershell
npm run typecheck
node --import tsx scripts/test-pre-workout-coach.ts
git add lib/ai/pre-workout-coach-schema.ts lib/coaching/pre-workout-coach-policy.ts lib/server/pre-workout-coach.ts lib/server/prescriptions.ts lib/server/workouts.ts components/workouts/PreWorkoutCoach.tsx scripts/test-pre-workout-coach.ts T2_EFFECTIVE_WORK_UPDATE.md
git commit -m "Validate effective work and set types in pre-workout coaching"
git push origin main
```

Vercel deploys the push to `main`. No database migration and no additional environment variable are needed. Existing in-flight pre-workout proposals should be reviewed again after deployment because their structured payload predates the new required set-type IDs. Your training history and templates are unaffected.

The standard `npm run typecheck` performs Prisma generation first, so it requires the project's configured local `DATABASE_URL`. This package passed `npx tsc --noEmit --pretty false`, the policy tests, and targeted ESLint in the build workspace; the full Prisma generation command could not run there without a local database URL.
