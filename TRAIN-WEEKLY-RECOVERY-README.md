# Train weekly-workout recovery fix

Apply over main 08bd308 (the combined Mesocycle planner patch). Replace the files from this ZIP in the repository root. No database migration, dependencies or environment changes.

## Cause and behavior

The server rejects a saved weekly workout if it can no longer be applied to the current mesocycle, active exercise catalogue or set formats, or if it was already started/removed. The Train page automatically previews a selected weekly occurrence. Previously, this expected rejection escaped the page loader and React hid it behind production error #441.

The rejection now uses a specific error class. Train handles only this known error, keeps the weekly selection, and shows recovery options instead of failing the entire view. The user can review the weekly plan, select another workout or explicitly choose the current program prescription. The blocked selection cannot invoke daily coaching or Start. Other database/programming errors are not silently swallowed.

An explicit removed/expired occurrence link no longer silently previews a different occurrence. A weekly workout invalidated between preview and Start returns to Train without creating a session. The strict weekly availability check remains in the prescription service and start path.

This fixes the page crash; it does not edit or regenerate the saved weekly plan. If the recovery notice appears, review the weekly plan against the current block/library, or choose the program option deliberately. No additional AI requests, automatic reanalysis or live database changes are introduced.

## Apply and deploy

```powershell
npm run typecheck
npm run build
npm run lint
node scripts/test-train-weekly-recovery.mjs
git diff --check
git add app components lib scripts TRAIN-WEEKLY-RECOVERY-README.md TRAIN-WEEKLY-RECOVERY-FILES.txt
git commit -m "Keep Train available when a weekly workout needs review"
git push origin main
```

## Verification

Type checks and production build passed. Lint: zero errors and five existing unused-variable warnings. The mocked service regression runs the actual Train loader: valid weekly previews, rejected overlays, removed explicit occurrences, explicit program fallback, unrelated-error propagation, and no session writes when a workout becomes invalid before Start. No paid AI requests or signed-in live database/browser test were used.
