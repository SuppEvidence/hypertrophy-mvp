# One-off workout alternatives

Replacement-file patch based on c756648 (Logger visual update).

## Using it

Before starting an exercise, expand **Different equipment? Use a one-off alternative**. Confirm that the available alternative uses a similar movement and trains the displayed primary and supporting muscles with similar emphasis. Select **Use for this workout only**.

The exercise then logs set format, observed RIR and completion. Execution quality, exercise-level pain and optional equipment/setup notes remain available. Enter actual RIR before marking a set done; there is no prefilled observed effort. Standard sets are the initial format; select another format only if actually performed. Wait for **Saved** before leaving/finishing.

The option is per exercise, so a workout can mix ordinary equipment-specific logs and one-off alternatives. No exercise-library addition is made. Completed or started sets cannot be converted between modes. Switching before starting clears uncompleted entries, so they cannot be misidentified as results from the other equipment. To change equipment after logging work, keep that work intact and add another session exercise using an existing appropriate source entry, then enable the one-off mode on the new entry.

## Accounting and coaching

Completed sets count toward muscle volume using the source exercise's frozen primary/secondary allocation and the actual selected set-format multiplier. This is a user-confirmed approximation, not an exercise assessment. A matching movement name alone is insufficient when muscle emphasis differs substantially; do not confirm equivalence in that case. RIR describes effort and informs coaching, but does not measure hypertrophic stimulus or automatically scale counted volume.

Load/reps are null on the server, including forged or stale core payloads; load/rep detail submissions are refused. No PR/e1RM or source-exercise performance-chart entry is created. Session history labels the work as a one-off equivalent. Source-machine setup and accepted execution profile are withheld from the one-off exposure. Post-workout context identifies intentional missing performance data and omits source-machine comparison history for that entry. The shared coaching policy explains the evidence limitation; general training context retains effort and volume with a one-off marker/count.

Live T1 load coaching is not mounted and the server's eligibility gate blocks it for these entries. Opening the option, enabling it and logging sets start no AI call. Existing post-workout/weekly/volume review triggers remain in place; this patch adds no background analysis or full-context interaction call.

Temporary choice memory ignores these entries. The weekly continuation restores planned set formats rather than making the one-off format a recurring preference. Weekly exercise-selection and availability logic are unchanged.

## Storage and deployment

No Prisma schema change, SQL migration, Supabase/RLS change, dependency update, new storage bucket or exercise-library reanalysis. The existing session-only `exerciseChoiceIntent` string stores `ONE_OFF_EQUIVALENT`; the exercise ID remains the allocation reference, not a claim that its exact equipment was used. Existing classification snapshots remain immutable. Writes are ownership-scoped; mode switches and core set writes share a parent-row lock to guard against stale UI saves.

Merge the files from the ZIP into the existing repository, preserving paths. Do not delete unrelated files. Run the checks below, commit and deploy normally. There is no database command to run.

## Verification

- TypeScript type checking and production boundary verification.
- Offline real-action tests: ownership, required equivalence confirmation, pre-start restriction, blank initial effort, required RIR for completion, null performance data, stale-mode rejection, detail-write protection, volume contribution and temporary-choice memory.
- Existing live-coach engine tests plus a one-off no-model-call regression.
- Weekly continuation, exercise-choice memory, Train recovery and saved exercise-guidance regressions.
- Actual React logger browser fixture at 390px and 1440px: confirmation, RIR-only controls, successful saves, absence of load/reps and live-coach requests, no horizontal overflow. Actions/database are mocked in this fixture.
- Production build passed before the final client-prop serialization correction. That correction passed TypeScript and the browser fixture; the final full-build rerun was blocked by automatic approval review because its review model was at capacity (not a code rejection). Run `npm run build` before deploying. No live Supabase, Vercel deployment or paid AI calls were used for verification.

```sh
npm run typecheck
node scripts/test-one-off-alternative.mjs
node scripts/test-workout-coach-engine.mjs
node scripts/test-train-weekly-recovery.mjs
node scripts/test-workout-exercise-guidance.mjs
node --import tsx scripts/test-weekly-coach.ts
node --import tsx scripts/test-exercise-choice-policy.ts
npm run build
```
