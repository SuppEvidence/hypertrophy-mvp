# Dated energy phases, Home cleanup and priority-driven slots

This file-replacement patch builds on the **latest coaching-profile-history patch, including its EDT correction**. Copy the ZIP contents into the same repository root. This archive contains only the new/changed files, so apply that earlier patch first if it has not been applied. The previous migration `20260925100000_coaching_profiles_interventions` must precede this patch's migration `20260925120000_energy_phases`.

## Changes

- Metrics now has a separate cutting / maintaining / gaining history. Choose the phase and **start date only**. Each later start date ends the prior phase exclusively; the latest phase remains open. A mistaken entry can be removed; saving a different phase on the same start date replaces that entry. A recently selected phase is marked as a transition; the 14-day caution is a minimum evidential reminder, **not** a fixed physiological adaptation deadline. T2, T3 and the next-block reviewer receive the declared phase and phase history. T2/T3 calculate the current body metric trend from entries since the current phase began, and continue to consider older history separately.
- Home shows the declared phase and transition caveat, hides generic “all fine” signals and old target-ratio alarms, and gives body metrics more room on mobile. The raw seven-day priority volume card and unlabeled muscle chips were removed because they did not convey a useful decision; the latter could list nearly every muscle through legacy program priorities. The full analytics remain available on Progress, and mesocycle priority controls remain available through Adjust mesocycle.
- When a mesocycle priority is changed, the deterministic planner maps available exercises by **primary muscle** and movement pattern. If existing compatible slots cannot implement the selected coaching dose, it proposes a modest additional slot, favoring an exercise the athlete marked Preferred and excluding Avoid. Promoting a muscle with no prescribed work starts with a provisional 2 effective sets/week implementation dose, subject to review rather than a fixed physiological target. If a lower dose makes a base slot unnecessary, it can propose removing it, checking the dose needed by its other primary and secondary muscles. It can sequentially remove every slot from an unneeded pattern. Neither addition nor removal changes the base template, and each proposal needs approval. No direct no-focus increase is inferred.

## Apply to development (PowerShell, repository root)

```powershell
Expand-Archive -Path .\energy-phase-dashboard-structure-patch.zip -DestinationPath . -Force
npm install
npx prisma migrate deploy
npm run typecheck
node --import tsx scripts/test-energy-phases.ts
node --import tsx scripts/test-priority-structure.ts
node --import tsx scripts/test-pre-workout-coach.ts
node --import tsx scripts/test-t3-volume-coach.ts
git status --short
```

The migration adds an `energy_phases` table and does not rewrite workout, metric or mesocycle data. Prisma's existing `.env.local` loading should point `migrate deploy` at the intended **development** database. If not, supply `DATABASE_URL` securely for the command. No phase is backfilled from mesocycle PUSH/HOLD: those describe training, not a verified cutting/gaining selection. Add a dated phase through Metrics when you know the start date.

## Production order

1. Run `npx prisma migrate deploy` against the **production** database using its securely supplied `DATABASE_URL` before this code serves traffic. This also applies the earlier coaching profile migration if pending; verify the migration command succeeds. Do not upload `.env.local` or commit database credentials. If your established Vercel Build Command already runs `prisma migrate deploy` before the build, verify the build log confirms both migrations succeeded.
2. Commit and push the copied files to `main` for the usual Vercel deployment.
3. In production, record two phase starts in Metrics, verify that the earlier phase ends when the next starts, inspect Home, and open a mesocycle with a newly promoted muscle or reduced no-focus muscle to inspect and approve or decline structure proposals. Confirm the base templates are still unchanged.

Verification here: Prisma schema validation, typecheck, lint of changed files and focused phase / structure / T3 policy tests. No connected database or model call was available for live migration or end-to-end testing.
