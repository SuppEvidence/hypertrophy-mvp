# Nutrition and Phase Management coach

The coach lives at **Plan → Nutrition & phase**. It works from the athlete's existing meal structure and observed response. There is no daily food diary, required calorie count or body-fat estimator.

## Workflow

1. Save the usual meal structure, preferences/restrictions, activity and goal. Daily and meal protein/carbohydrate/fat estimates are optional and independent; blank means unknown. Approximate meal totals need not reconcile with the daily estimate.
2. Optionally save an outcome check-in: implementation, hunger, energy, digestion and relevant context. Existing metric logs remain the source for bodyweight, circumferences, sleep, stress and recovery. Existing accepted photo assessments provide visual evidence.
3. Explicitly request an outcome review. It can propose holding steady, a few quantified or portion-based changes, questions, a phase direction, a revisable phase duration and an outcome-review interval.
4. Discuss a targeted adjustment. Replies preserve unrelated proposal fields. Discussion does not reread outcome history or reinterpret photos. New evidence is flagged; accepting then requires an explicit fresh outcome review.
5. Accept the dietary proposal. Applying its phase is a separate unchecked checkbox. An accepted phase takes effect today (UTC) in the existing `energy_phases` table. Existing future phase entries remain scheduled and are shown before acceptance. Mesocycle structure and training targets do not change automatically.
6. Review the observed response. The next review date is displayed, not scheduled as an automatic AI job. Photo cadence remains the existing phase/experience-based cadence and is independent of the nutrition review date.

## Baseline and history semantics

An accepted meal adjustment updates its known meal estimate and the known daily estimate once. Unknown estimates remain unknown. A day-wide adjustment has no assumed meal allocation, so affected meal estimates become unknown. An unquantified food/portion change invalidates the affected estimates instead of retaining false precision. Negative/out-of-range totals and nonexistent meal references are rejected before saving.

Applied instructions accompany the original food descriptions and are already reflected in known macro estimates. They are not new increments to repeat each day. The athlete can consolidate them into the food descriptions and remove superseded instructions. The full dated baseline snapshot remains in the immutable event history; the interface shows the most recent 20 events. Manual baseline edits clear an unaccepted proposal. A new review replaces the pending proposal, not accepted history.

Acceptance records the recommendation, rationale, requested changes, actual phase application, review criteria and due date. Acceptance is not adherence: the separate dated self-report is carried to other coaches with its timing. Changes are assessed as trials; the prompt forbids claiming a precise change caused a particular body-composition outcome.

## AI boundaries and token control

| Interaction | AI calls | Context |
| --- | ---: | --- |
| Open page, edit fields, save baseline, save outcome check-in, dismiss, accept | 0 | Database work only |
| Explicit outcome review / refresh | 1 | Current baseline plus bounded deterministic summaries |
| Explicit discussion message | 1 | Compact baseline, saved proposal, latest six messages and lightweight freshness metadata |
| Other coaches' normal requests | No additional calls | Compact accepted nutrition/recovery handoff in their existing request |

Review inputs cover at most 56 days, 240 metric rows, 500 exercise exposures summarized into at most 35 exercises, three mesocycle conclusions, 12 compact nutrition events and existing accepted visual summaries. No raw image bytes, full exercise library, raw set arrays or complete diet history are sent. Weekly measurement means use the latest non-null value per day and expose sample counts. Comparisons remain uncertain when execution, timing, phase or measurement consistency differ.

Discussion abbreviates food descriptions unless a meal is named in the message; it includes at most six abbreviated applied instructions and six recent messages. The coach must ask when the abbreviated context is insufficient. The output is a nullable field patch, not a regenerated baseline or program. Null preserves a proposal field; `clearPhase` explicitly removes phase advice.

`NUTRITION_REVIEW` uses the existing T3 model configuration (default `gpt-5.6-sol`, high reasoning; 8,192 output-token cap, 210-second timeout). `NUTRITION_DISCUSSION` uses T2 (default `gpt-5.6-terra`, medium; 4,096 output-token cap, 90-second timeout). Existing tier environment overrides apply. Output caps are ceilings including reasoning, not expected token usage. Both disable provider storage and automatic SDK retries. Actual input/output/reasoning/cache counts are logged as metadata only via `COACHING_AI`; user prompts are not logged.

No page effect, cron job, workout completion or saving action launches this coach. A five-minute per-user lease blocks overlapping AI requests. Failed requests release it; expiry permits recovery from an interrupted server. The UI does not automatically retry a failed request. An explicit retry can incur another call.

## Coaching synergies

- **T2/pre-workout:** dated accepted diet/phase-related intent and recent self-reported implementation/energy/hunger inform readiness without automatically changing volume.
- **Workout analysis:** receives nutrition context as of the workout timestamp, so later decisions do not leak into historical analysis.
- **T3 volume:** receives compact accepted changes and recovery context; the nutrition coach reuses T3's saved conclusions and phase flags.
- **Weekly planner:** retains eligible existing T3 dose reasoning. Nutrition-only changes are sent as a delta flag rather than automatically invalidating that reasoning. New symptoms still affect feasibility; an accepted dietary change alone is not proof that volume should change.
- **Mesocycle review/design:** uses accepted nutrition context with the authoritative energy-phase timeline and user goals. A phase transition can motivate a user-requested program review, never silently rebuild the program.
- **Physique coach:** receives date-filtered nutrition context and retains its visual-only remit. It does not calculate macros from photographs. The nutrition coach consumes existing accepted visual findings without another image-analysis call.
- **T1 and exercise analysis:** no added nutrition requests or unrelated meal context. Their existing responsibilities remain unchanged.

The shared coaching policy explicitly permits user-provided approximate macros and accepted quantified adjustments, while prohibiting body-fat estimates and intake inference from photos. Training-layer phase flags are evidence for nutrition review, not a second writable phase source.

## Persistence, privacy and concurrency

The migration adds two server-owned tables, `nutrition_states` and `nutrition_events`, with profile ownership and cascade deletion. RLS is enabled and all direct `PUBLIC`, `anon` and `authenticated` grants are revoked, including inherited default grants. No storage bucket or public client access is added. The app uses its existing authenticated server-side Prisma owner connection. Every service read/write is user-scoped; the endpoint obtains the user ID from authentication, not the submitted body, requires same-origin POST and limits request bodies to 64 KB.

Atomic revision checks prevent duplicate acceptance and lost updates. Baseline writes, check-ins, phase edits, metrics, workouts, photo check-ins, settings and mesocycle changes invalidate old evidence through lightweight timestamps/counts. Reviews older than 14 days also require refresh before acceptance; this is proposal validity, not mandatory review/photo frequency. Accepted phase and baseline updates commit in one serializable transaction. No migration or production database action is performed by creating this patch.

## Verification

- Type checking, production build and production import-boundary verification.
- Nutrition delta/unknown-value/invalid-meal tests and model routing tests.
- Existing phase, visual cadence, weekly token-budget and targeted mesocycle revision regressions.
- Service integration against disposable PostgreSQL-compatible PGlite: migration RLS/grants, cross-user isolation, no-AI mutations, targeted discussion, exact-once application, phase opt-in, stale evidence, request lease and failed-model cleanup. OpenAI is mocked; no paid model calls are needed.
- Browser interaction at 390px and 1280px: explicit request boundaries, dirty baseline guard, discussion/approval flow, default-off phase checkbox and no horizontal overflow or runtime errors.

Pure regression: `node --import tsx scripts/test-nutrition.ts`.
Service regression: initialize an **empty disposable test database** with the current schema, set `DATABASE_URL`, `NUTRITION_TEST_DATABASE=disposable`, and a dummy `OPENAI_API_KEY`, then run `node scripts/test-nutrition-service.mjs`. The script creates test profiles and mocks all model responses; it must not run against production.

## Evidence principles

The policy follows broad principles of adherence, energy balance, uncertainty and repeated athlete response. It does not hardcode contest-preparation targets for recreational users. Useful background includes Aragon et al., *International society of sports nutrition position stand: diets and body composition* (2017), https://doi.org/10.1186/s12970-017-0174-y, and Helms et al., *Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation* (2014), https://doi.org/10.1186/1550-2783-11-20. The latter has contest-specific context and is not a default prescription for this app.
