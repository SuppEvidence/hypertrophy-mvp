# Volume coach: remaining decisions refresh — 18 October 2026

Base: `76b3056` (Weekly planner availability update).

## Apply

Merge the ZIP's `app`, `lib`, `scripts` and `docs` folders into the project root, replacing matching files. Run:

```sh
npm run typecheck
node scripts/test-t3-decision-refresh-actions.mjs
node --import tsx scripts/test-t3-volume-coach.ts
node --import tsx scripts/test-t3-structure-execution.ts
node --import tsx scripts/test-t3-pain-opportunity.ts
npm run build
```

Then commit/push as usual. No dependency installation, database migration, Supabase SQL, environment changes or npm configuration changes are required.

## Behavior

Each muscle decision still has its own approval. After an approval, the remaining pending cards in that assessment show updated application previews from the current accepted mesocycle prescription. There is no need to rerun the AI review merely because another card was accepted.

The original assessment, alternatives and rationale remain saved. Ordinary volume options retain their originally reviewed realized muscle-dose goal. Shared-muscle changes already implemented by another approval count toward that goal: if they cover part of the change, only the remaining portion is proposed; if they cover all of it, the card says no further change is needed. Choose **Accept current dose** to close an already covered card and align its approved coach target with the accepted prescription. This makes no additional set change. Reallocation options retain their reviewed movement allocation. Reductions explicitly supported by the saved pain-source evidence retain the affected movement's reduction goal, so reduced work in another exercise cannot silently cancel the symptom-specific change.

Updated cards show their revised sets, movements and muscle effects and still need approval. If a remaining adjustment cannot fit the discrete set increments, staged limits or available capacity, the option is disabled with its reason. A genuinely different approach or changed muscle priority can still need a new coaching review.

Approval recomputes the remaining option on the server and compares its physical/muscle effects with the preview displayed on that page. If another tab changes the prescription, refresh the volume page before submitting again. Existing duplicate/concurrent approval checks, latest-review identity, rolling budgets, priorities, maintenance rules and pain-opportunity capacity checks remain enforced.

Accepted targets, applied previews and intervention history record the actual remaining change. Existing pending cards and previously accepted cards in the current assessment are supported; a new AI run is not required just to initialize this patch. A page left open during deployment should be refreshed.

## AI, storage and scope

These updates are deterministic prescription calculations using saved coaching intent. Reading or accepting the remaining cards does not call AI. The initial volume review keeps its existing model call and normal evidence inputs. No automatic full reassessment is added.

Applied fractional remainders can be stored in the existing JSON outcome and decimal coach-target fields; model proposal schemas retain their integer increments. Base templates and already approved weekly plans retain their existing behavior. User-scoped records and current-block checks remain in place.

## Verification

Focused tests cover an accepted compound reduction partially satisfying another muscle's decision, a fully covered goal, unchanged original previews, symptom-specific movement intent, staged budgets, applied fractional history, stale-page rejection, concurrent/duplicate approvals, current-generation validation and actual coach-target/intervention updates. Existing T3 volume, structure and pain-opportunity regressions also pass. Type checking and the production build were checked in an isolated workspace with mocked approval records; no live Supabase records or Vercel deployment were changed.
