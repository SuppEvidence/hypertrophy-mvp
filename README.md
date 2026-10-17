# Nutrition and Phase Management coach patch

Adds **Plan → Nutrition & phase**: an editable meal baseline, optional approximate macros, outcome check-ins, explicit coaching reviews, targeted discussion, dated accepted changes and separately approved phase transitions.

Built against `08bd308` (unified Mesocycle planner). No dependency changes. No live database changes or deployment have been performed.

## Apply in PowerShell

From your repository directory, with the ZIP in Downloads:

```powershell
$patchDir = Join-Path $env:TEMP "nutrition-phase-coach-patch"
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\nutrition-phase-coach-patch.zip" -DestinationPath $patchDir -Force
powershell -ExecutionPolicy Bypass -File "$patchDir\Apply-NutritionPatch.ps1" -RepoPath (Get-Location).Path
npm run typecheck
node --import tsx scripts/test-nutrition.ts
node --import tsx scripts/test-coaching-models.ts
npm run build
git diff --stat
git status --short
```

The script checks and applies the additive Git patch. It preserves unrelated edits (including later Train-view fixes) and stops without changing files if patch context conflicts. Do not copy the replacement files first and then apply the Git patch; those are alternative methods. `replacement-files/` is included for manual replacement only when your versions match the listed base commit. `FILE-MANIFEST.json` lists the exact files and hashes.

## Database migration required before deploying the updated app

Using the project's configured database environment:

```powershell
npx prisma migrate deploy
```

The new migration is `20261017120000_nutrition_coach`. It adds `nutrition_states` and `nutrition_events`, both with RLS enabled and direct public/anonymous/authenticated grants revoked. There are no storage changes, existing-data rewrites or exercise-library reanalyses. The existing authenticated server-side Prisma connection accesses the data. Review and commit/push the patch through your normal workflow; the apply script does not commit, push, deploy or run migrations.

## AI usage

- Opening, editing, saving, checking in, dismissing and accepting: **zero AI calls**.
- Explicit outcome review: **one T3 call**, using bounded summaries and existing accepted visual assessments; no photo reanalysis.
- Discussion: **one T2 call**, using the saved proposal, compact baseline and recent messages. It returns targeted proposal changes and does not reload outcome history.
- Other coaches receive compact accepted context inside their existing requests. The weekly planner keeps reusable T3 reasoning and considers nutrition changes as new context rather than automatically repeating volume analysis.
- No automatic reviews, provider storage or SDK retries. Actual token usage is logged as metadata. The output caps are 8,192 tokens for review and 4,096 for discussion, not predictions of actual usage.

Accepted meal adjustments update known meal and daily estimates exactly once. Unknown estimates remain unknown. Every acceptance records rationale and a review date. New evidence, baseline edits and outdated proposals are checked before acceptance. Phase approval is separate, updates the existing energy-phase timeline today (UTC) and preserves future scheduled entries. Training programs are not silently changed.

## Verified

Production build, typecheck, new-code lint, model routing and relevant phase/visual/weekly/mesocycle regressions; disposable database migration and service tests; mobile/desktop browser interaction. Tests cover cross-user access, no-AI mutations, targeted follow-ups, duplicate acceptance, phase opt-in, stale evidence and request cleanup. Model responses were mocked; no paid/live-model quality evaluation was performed.

See `docs/nutrition-phase-coach.md` after applying for workflow details, coach handoffs, data limits and test instructions.
