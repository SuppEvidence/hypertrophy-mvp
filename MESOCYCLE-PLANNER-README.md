# Unified Mesocycle planner

Follow-up replacement patch for main 92d3ff2 (the deployed program/mesocycle coach including targeted AI revisions). Apply after that patch. No new dependencies, database migration or environment variables.

Plan now has one Mesocycle planner entry alongside Plan this week. The separate program-design and current-mesocycle-adjustment entries move inside the planner.

- Current mesocycle: approved intent/checkpoint, block settings and priorities, and links to weekly allocation, current dose review and structure adjustments.
- Plan next mesocycle: existing closing-block review, the full discussion-based designer with saved drafts/designs, and upcoming blocks. Manual scheduling on the existing program remains available as a collapsed alternative. Designing a first program does not require an active program.
- Past mesocycles: select a previous nonarchived program and view its completed blocks and outcome reviews. History includes inactive programs, not only the current one.

The existing /plan/blocks URL is the common planner route. /plan/design links redirect into its next-mesocycle view, preserving the draft ID. Explicit links to older owned, nonarchived designs work even when absent from the latest 15-item navigation. Foreign or invalid explicit IDs return not found. Saving a draft updates the browser URL to the unified planner. Program and coaching-review links point to its next-mesocycle view; a manually requested review returns there on success or error.

This changes navigation and presentation. The designer, existing block actions, approval flow, targeted revision protocol and weekly/T3 reuse remain in use. Page loads and view changes add no AI requests. The optional closing-block review still requires its explicit button and is not a prerequisite for design. No live database, deployment or repository push was performed.

## Apply

Extract this ZIP into the repository root, preserving directories and replacing files. It contains only this follow-up patch; the preceding mesocycle coach patch must already be applied.

```powershell
npm run typecheck
npm run build
npm run lint
git diff --check
git add app components lib MESOCYCLE-PLANNER-README.md MESOCYCLE-PLANNER-FILES.txt
git commit -m "Combine program design and block planning in one mesocycle planner"
git push origin main
```

## Verification

Production build and type checks passed. Lint reported no errors and five existing unused-variable warnings. Existing action authentication/ownership checks are retained; history selection is restricted to the signed-in user's program list. No signed-in live Supabase/browser test or paid AI request was performed.
