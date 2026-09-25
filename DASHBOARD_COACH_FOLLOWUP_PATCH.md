# Dashboard coach follow-up patch

This small overlay is for the current T0–T3 app **after** the `energy-phase-dashboard-structure-patch.zip` has been applied. It replaces only two files. That earlier patch contains the dated energy phase migration and must be installed first if it is not already deployed.

## Changes

- Removes the raw seven-day effective-set card and the unlabeled muscle chips under the current mesocycle. The old chip fallback displayed the legacy program muscle list, which could include nearly every muscle. Volume details remain in Progress; priority editing remains in the program/mesocycle controls.
- Adds **Coach follow-up** on Home only when the current block has pending decisions from the *latest completed* T3 review, its T3 review failed, or a next-block review is ready. Each item links to the existing review screen. It does not call an AI model or change training prescriptions.
- Uses the existing current-mesocycle read. A small indexed count query runs only when a completed T3 review has a generation ID, in parallel with the next-template lookup.

## Apply (PowerShell, repository root)

If the energy-phase patch has not yet been applied, extract it first and follow its migration instructions. Then extract this dashboard overlay:

```powershell
Expand-Archive -Path .\dashboard-coach-followup-patch.zip -DestinationPath . -Force
npm run typecheck
```

Commit and push the resulting changes through your normal Vercel deployment. No migration or new environment variable belongs to this overlay. After deploy, Home should omit both the effective-set card and the muscle chips. For a block with pending T3 decisions, verify that Coach follow-up links to Volume coaching. If there is no pending work, the section stays hidden.

Verification: production boundary check, TypeScript typecheck, targeted ESLint and `git diff --check`. No connected database was used for a live dashboard check.
