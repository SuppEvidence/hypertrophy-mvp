# Exercise coaching profiles and intervention history

This patch builds on the previously delivered T0–T3, model-routing, effective-work and specialization-budget updates. Copy the archive contents over the repository root while preserving the included paths. It contains complete replacement files and one new Prisma migration; do not apply it to an older T3 checkout without those earlier updates.

## What changes

- Each exercise can have a private, athlete-specific coaching profile: preferred, neutral or avoid for new suggestions; whether new intensifiers are allowed; and short coaching notes. Profiles on seed exercises do not change the shared catalog. Editing a seed exercise into a personal copy carries its profile to the copy.
- T2 incorporates the profile in its proposal and validates substitutions and intensifiers against it. Exercise suitability rules still apply. T3 sees profiles when deciding which existing movement implementations are viable, and excludes avoided exercises from new candidate suggestions.
- T2 proposals and T3 volume decisions get intervention records. T2 tracks accepted or explicitly skipped proposals and observed completed sets and symptoms. T3 tracks selected or declined options, a baseline snapshot, and later observed weekly effective work and symptoms. Follow-ups are observations, not proof that an intervention caused growth.
- T3 still sees historical *completed* effective weekly volume, priority status, measurements and prescribed volume across previous mesocycles. Legacy numeric targets remain in the database as historical context and for compatibility with older plans. The unused editor action for legacy mesocycle numeric targets is removed. Numeric range estimates do not cap future coach proposals; the existing staged change, feasible-slot, approval, safety and rolling budget checks still apply. T2 labels old numeric rows as past prescriptions, not quotas.

## Local apply and checks (PowerShell, repository root)

```powershell
Expand-Archive -Path .\coaching-profile-history-patch.zip -DestinationPath . -Force
npm install
npx prisma migrate deploy
npm run typecheck
node --import tsx scripts/test-pre-workout-coach.ts
node --import tsx scripts/test-t3-volume-coach.ts
git status --short
```

`npx prisma migrate deploy` must connect to the local/dev database specified by your existing Prisma configuration. No new environment variables are needed. The migration creates `exercise_coaching_profiles` and `coaching_interventions` and does not delete existing targets or workout history. If your local database is already ahead of the checked-in migrations, resolve that migration history before pushing.

## Production deployment

1. Apply `prisma/migrations/20260925100000_coaching_profiles_interventions/migration.sql` to **production** with `npx prisma migrate deploy` using the production `DATABASE_URL` available from your secure environment, before the new code serves traffic. Do not paste the credential into a commit, `.env.local` upload, or deployment guide. If your existing Vercel build already runs `prisma migrate deploy`, that step can apply the migration before the app build; verify its build log shows success.
2. Commit the copied files and push your usual `main` branch. Vercel can then build and deploy as in prior updates. `.env.local` remains local; Vercel uses its own configured environment variables.
3. In production, open a seed and a custom exercise, save a coach profile, request T2 pre-session coaching and accept or skip a proposal. Review a T3 option; verify existing mesocycles and history still load. A completed coached workout provides the first T2 follow-up; T3 follow-ups need later completed sessions.

The patch was checked with Prisma schema validation, project typecheck and the T2/T3 policy scripts without a connected database. The production migration and live model calls must be verified in your environment.
