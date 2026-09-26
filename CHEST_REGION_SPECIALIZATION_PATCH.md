# Chest-region classification and T3 specialization

This overlay applies **after** the prior coaching, energy-phase, dashboard and mesocycle-check-in patches. Extract it at the repository root. It includes a new data migration, so apply the migration before the new code serves traffic.

## Classification

| Exercise movement group | Default primary muscle |
| --- | --- |
| Incline press | Upper chest |
| Low-to-high chest fly/press | Upper chest |
| Flat press | Mid chest |
| Decline/dip press | Lower chest |
| Chest fly | Manual classification |

The migration classifies **existing seed and user exercises** in those movement groups. Explicitly chosen Upper/Mid/Lower chest assignments take precedence; the older generic Chest link is removed for the four mapped groups. New exercise saves use the same rules. Other patterns are not guessed. The old Chest muscle ID remains as **Chest (unclassified)** for ambiguous exercises and historic records; it is excluded from new T3/program priority selections. This avoids counting one exercise simultaneously as a general chest set and as a regional chest set. These labels express emphasis, not exclusive fiber recruitment or independent recovery budgets.

For active programs, the old Chest priority becomes Upper chest (consistent with the current upper-chest emphasis). Existing aggregate numeric targets and active T3 baselines are scaled to their approximate Upper chest share using the program's existing movement slots; Mid and Lower chest start at their planned slot doses as maintenance or no direct focus. T3 can revise those provisional estimates from evidence. Current pending T3 decisions and stored next-block assessments are invalidated for a fresh review; completed workout rows and past mesocycle priority records are preserved. Because past exercise exposure is read through the current exercise classification, the AI instructions explicitly treat old general-chest priorities as uncertain historical evidence.

## Development (PowerShell, repository root)

```powershell
Expand-Archive -Path .\chest-region-specialization-patch.zip -DestinationPath . -Force
npx prisma migrate deploy
npm run typecheck
node --import tsx scripts/test-chest-regions.ts
```

Run `migrate deploy` against the intended development database. It must report `20260926120000_chest_regions` as applied. Do **not** run `prisma db seed` as an extra deployment step: the migration itself adds the new muscles and updates existing exercises; the seed catalog is updated only for future setup.

## Production

1. Commit and push the extracted files using the normal `main` → Vercel workflow.
2. Before the new build serves traffic, run `npx prisma migrate deploy` against the production database with its securely supplied `DATABASE_URL`, or verify that your established Vercel build command runs that migration first. Ensure all earlier patch migrations are applied in order.
3. Inspect one exercise from each mapped movement group, one Chest fly, and the current block's Upper/Mid/Lower chest priorities. Adjust priorities if the former generic Chest focus was intended for a different region. Wait for or request a fresh T3 volume review before approving new structural changes.

Verification here: TypeScript typecheck, production boundary check, targeted ESLint, deterministic mapping tests and diff validation. A connected database was not available, so the production migration and historical-data behavior must be verified against the real database after deployment.
