# T3 volume executor and approval fix

Apply this package on top of the previously deployed coaching-priority-continuity patch. These are complete replacement source files. Extract into the repository root (the folder containing package.json), preserving folders and replacing the matching files. Do not delete other files.

## What was wrong

T3 could propose a reasonable target change, but implementation depended on a template generator that treated fixed/non-adjustable slots and template minimum/maximum sets as restrictions. Small reductions could also disappear inside its tolerance. After withholding an option, the model's original summary could still tell the user to approve it. The reported live hammer-curl failure is consistent with these paths; the specific live slot setting was not available for inspection.

## Result

T3 now deterministically implements approved changes as mesocycle structure overrides. It adjusts existing exercise slots first, preserves retained set types, can exceed template set bounds, remove a slot down to zero, or introduce a suitable allowed exercise slot when needed. Base program templates are not rewritten. New additions use the normal set type; existing intensifier accounting is preserved.

Movement changes are implemented in discrete physical sets at the actual workout frequency and effective-set multipliers. The card shows actual net set changes and all affected muscle doses. The requested weekly delta may therefore differ from the nearest implementable dose. Existing staged muscle-change limits, rolling seven-day approval budgets and priority safeguards remain. New sanity checks stop increases beyond eight physical sets per exercise, worsening sessions beyond 36 sets or 16 exercises, newly introduced duplicates, and increases beyond the existing 60-effective-set ceiling. Existing outlier prescriptions can still be reduced without first completely normalizing them.

Exercise type is inferred from movement-pattern names/roles instead of falsely treating secondary contribution as proof of a compound movement. Approval guidance is rebuilt from surviving options when validation changes the proposal. No second AI call is made. Independent approvals are rechecked against actual reviewed effects, rather than rejected merely because another approval added different internal override IDs. Ownership, concurrency and rolling-budget checks remain transactional.

The current T3 AI request, response schema, model routing, automatic call gates and time/token budgets stay in place. T1 and T2 are untouched. There is no database migration, dependency change or new environment variable in this patch.

## Windows PowerShell: apply and verify

1. Stop the local dev server with Ctrl+C.
2. Open PowerShell in your project folder. Adjust these paths if yours differ:

```powershell
Set-Location "$HOME\Desktop\hypertrophy-mvp"
git status --short
Expand-Archive -LiteralPath "$HOME\Downloads\t3-volume-executor-fix.zip" -DestinationPath . -Force
npm run typecheck
node --import tsx scripts/test-t3-structure-execution.ts
node --import tsx scripts/test-t3-volume-coach.ts
node --import tsx scripts/test-priority-dose-continuity.ts
node --import tsx scripts/test-weekly-coach.ts
node --import tsx scripts/test-weekly-manual-set-types.ts
npm run lint
npm run build
```

Run each check separately. Stop and address any failing command before committing. Use your existing local environment configuration; do not replace it with validation placeholders. No prisma migrate command is needed.

3. Optionally run npm run dev and request a fresh T3 volume review. Inspect the approval cards: reductions must show a real decrease in physical/effective sets, a removal must show n to 0, and additions must show their exercise and actual muscle-dose effects. A rejected option must not remain in the approval instructions. The preview does not change training until you approve it.

4. Stage these exact patch files, inspect the staged diff, then commit and push using your normal deployment branch:

```powershell
git add -- "app/(protected)/ai-analysis/volume/page.tsx" "lib/coaching/t3-exercise-type.ts" "lib/coaching/t3-structure-implementation.ts" "lib/coaching/t3-prescription-preview.ts" "lib/coaching/t3-review-summary.ts" "lib/coaching/t3-volume-policy.ts" "lib/planning/mesocycleStructure.ts" "lib/planning/mesocycleGenerator.ts" "lib/server/ai-programming-decisions.ts" "lib/server/weekly-coach.ts" "scripts/test-t3-volume-coach.ts" "scripts/test-t3-structure-execution.ts"
git diff --cached --stat
git diff --cached
git commit -m "Allow T3 volume changes through approved mesocycle overrides"
git push origin main
```

If your deployment branch is not main, use your actual branch. Review any files that were already staged before committing. The included README and checksum manifest are documentation only and need not be committed.

5. Wait for the linked Vercel deployment to become Ready. No Vercel environment changes are required.

## After deployment

Run a fresh T3 review: older pending options require a new structural preview before approval. Previously accepted decisions remain valid historical budget evidence. Approve only after inspecting the actual dose changes.

Existing approved weekly plans are not overwritten. To apply a newly accepted T3 edit to an already planned upcoming week, explicitly regenerate that weekly plan; otherwise the next weekly planning run uses the updated mesocycle framework. The patch does not trigger an extra review automatically.

## Verification performed

Production build, standard typecheck, structural execution tests, T3 regression tests, priority/continuity regressions, weekly planner regressions and manual set-type tests passed. Lint has no errors and five existing unrelated warnings. No live AI request or production database write was performed during verification.
