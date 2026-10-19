# Exercise-aware rep policy

Built against main commit 7086761 (One off exercise addition).

## Behaviour

Secondary and primary muscle links remain volume-accounting data. Their count no longer classifies an exercise as compound or isolation. Coaches infer purposeful loaded joint actions from the accepted Exercise Coach movement description, setup and execution; stabilization is distinguished from dynamic movement. Existing movement-name and slot-role hints are provisional, not anatomical verdicts.

Shared guidance considers resistance profile, stability, comfortable ROM, load increments, comparable history, symptoms, set format and user preference. Approximate starting priors are 10–20 reps for isolation/accessory work and 6–12 for many multi-joint lifts, with supported exceptions. Low-rep isolation needs a concrete rationale. These are coaching defaults, not mandatory limits or scientifically optimal ranges. RIR is assessed separately; 2 RIR is not inherently wrong.

The Exercise Coach's existing accepted profiles remain usable. Future assessments are asked to distinguish joint actions from stabilization more explicitly. No full library reanalysis is needed. The general training advisor also receives a compact mechanics summary for the latest historical exposure; history retains the application's existing snapshot semantics.

Weekly planning still does not generate rep ranges directly. Its prescription resolver preserves same-exercise targets, otherwise uses the chosen exercise's own complete default range, otherwise marks 8–15 as provisional. It no longer borrows a different exercise's heavy range or slot category. Mesocycle/T3 additions use the same identity-aware resolver. Explicit approved movement/bucket policies remain authoritative where applicable.

A pre-workout (T2) ADJUST proposal may correct an inappropriate inherited range beyond the ordinary ±2 limit. It must provide a specific mechanics/setup, tolerance or user-request rationale, non-low confidence, and a complete range within 3–30. The existing proposal UI shows the old/new range and explanation before approval. Ordinary adjustments remain constrained; RIR limits, volume checks and live T1 limits remain unchanged. Supporting-muscle links no longer disqualify an otherwise eligible isolation from the existing intensifier compatibility list.

## Existing plans and rollout

Copy the replacement lib/, scripts/ and docs/ files into the project root. No package updates, database/Supabase migration, environment variables or scheduled backfill are required.

Existing approved plans and saved proposals are not rewritten. For a current questionable 4–6 prescription, request a new pre-workout review and state the exercise/range concern if necessary; approve the proposed correction. This is a session adjustment, not a permanent edit to the program. Future mesocycle design reviews receive the shared guidance. Existing explicit rep policies may still need editing if they intentionally enforce an unsuitable range.

No new AI call triggers, background analysis, automatic retries or reanalysis jobs are introduced. Existing requests receive additional policy text and, for the general advisor, compact mechanics context. Token usage per affected request can therefore increase slightly; call count does not increase.

## Validation

Passed: TypeScript, ESLint on changed source/tests, production boundary verification, full Next.js production build, rep-target regression tests, 39 T2 policy checks, T3 structure execution, mesocycle design, Train weekly recovery, and 18 offline T1 engine checks. Provider/database concurrency in engine tests is mocked. No live database writes or model calls were used for verification.

The local Next build completed with CI=1 and NEXT_PRIVATE_UPGRADE_BUILD_CHILD=1 to avoid the CLI upgrade-prompt subprocess exiting without a build in this environment. This is a verification-only setting, not a deployment requirement.

Suggested local checks:

    node scripts/test-exercise-rep-targets.mjs
    node --import tsx scripts/test-pre-workout-coach.ts
    npm run typecheck
    npm run build
