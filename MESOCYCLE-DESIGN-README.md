# Program and mesocycle coach patch

Replacement files for hypertrophy-mvp main bb518b1 (the deployed Exercise Coach authority/saved-profile patch). Apply after that version. No new application dependencies. This delivery has not pushed code, deployed an app or changed a live database.

## Where to use it

Plan → Design a program with the coach (`/plan/design`). It is also linked from Mesocycle planning. No existing program or template is required.

1. Enter training days, session duration, a start date and any restrictions. Optionally specify available weekdays, exercise exclusions and the intended energy phase. Existing physique goal settings prefill the goal text.
2. Review dated suggestions from accepted photo check-ins. Add only the priorities you want to pursue. Other priorities remain coach proposals until you approve the complete design.
3. Build the proposal. Discuss changes, answer questions, edit the draft directly or lock individual choices against coach revisions. Saving edits uses no AI. New sessions can contain unresolved slots while discussing the design.
4. Review duration, checkpoint, progression, success/adjustment criteria, priorities, spacing and the weekly schedule. The feasibility panel checks library references, days, dose, formats and restrictions; estimates session duration; and checks spacing across the week boundary. Time and spacing tradeoffs are warnings requiring explicit acknowledgment. Unresolved exercise references and invalid data prevent approval.
5. Approve the design to create a NEW program, ordinary workout templates/set plans and a mesocycle with initialized muscle priorities. Approval is transactional and repeat-safe. Your existing program and workout records are preserved.
6. A program starting today can be activated explicitly during approval. Finish/discard open workouts first. A future program is saved inactive: activate it from Programs on its start date. This patch does not automatically switch the active program in the background.

## Coaching and data alignment

| Layer | Data in / responsibility | Data out |
|---|---|---|
| Photo check-ins | Images and measurements; current approved planning intent is context, never proof of muscle growth | Existing accepted, dated visual summaries and suggested priorities |
| Exercise Coach | Execution evidence, shared muscle catalogue and relevant current program intent | Existing accepted personal mechanics/classification; goals cannot determine which muscles an exercise actually trains |
| Mesocycle design | Confirmed brief; accepted photo summaries; active effective exercise catalogue/preferences; dated phase/metrics; recent exercise history and prior block reviews | Versioned discussion and editable draft; explicit accepted goals, progression, spacing, review criteria and templates |
| T1 | Small exercise-relevant intent plus existing set/history inputs | Existing bounded next-set regulation |
| T2 | Approved block constraints and intent; current prescription; cross-program performance/recovery history | Existing session proposal and approval workflow |
| T3 volume | Approved intent, current priorities/prescription and comparable history from earlier programs | Existing dose/structure recommendations and accepted changes |
| Weekly planner | Approved baseline schedule/reasons, current dose, availability and completed work | Existing approved weekly allocation and temporary adaptations |
| Mesocycle review | Approved success/adjustment criteria and dated outcomes; prior completed blocks across programs | Existing block review and next-block advice |

Current accepted priorities and prescriptions take precedence over historical baseline dose. A temporary weekly or session adjustment does not overwrite the base program. Manual draft edits are marked; coaches are warned that an earlier rationale may no longer describe the edited selection. Confirmed exercise exclusions are filtered from weekly/T2 planning and prescription candidate pools.

Performance/recovery history can cross program boundaries, but block-specific outcomes remain scoped to their mesocycle. Completed work earlier in a week continues to count after a midweek program switch. Exercise workload classifications still use the previously implemented personal mapping and workout snapshots.

The active block's approved intent and checkpoint appear on Mesocycle planning, with links to current volume review and saved designs. Dates are changed through existing mesocycle controls; no new automatic review or date-change trigger is added.

## Evidence and limits

The design request uses current saved data, not a new photo/video analysis. History is bounded to 120 days / 500 exercise exposures, 30 metric rows, six blocks and four accepted photo summaries; missing or sparse evidence is labelled unknown. General evidence supplies starting assumptions, while comparable user exposures support personalization. Model instructions distinguish research principles, user observations and provisional judgments.

Frequency is used to distribute work and fit recovery/time constraints, without a universal split or mandatory spacing rule. Duration is proposed from phase, fatigue, performance, tolerance and practical constraints; the 2–16 week design range is an application bound, not an evidence-defined optimum. Session minutes are a heuristic including warm-up, transitions, rep work and rest; equipment queues, unilateral execution and extended formats can differ. Existing T3 workload bounds remain in force.

Evidence anchors included in the design policy:
- Schoenfeld et al. (2019), frequency with equated volume: https://pubmed.ncbi.nlm.nih.gov/30558493/
- Refalo et al. (2024), proximity to failure, quadriceps hypertrophy and acute fatigue: https://pubmed.ncbi.nlm.nih.gov/38393985/

These sources do not establish an optimal individual recovery interval or fixed phase-specific block duration. The app does not browse research during a coaching request. It does not estimate body fat, prescribe calories or introduce macro tracking.

A library gap can mean no suitable active exercise, insufficient assessment, or an equipment/preference conflict. The coach offers candidates and required equipment. Adding an exercise stays manual. Save the draft, add/assess the exercise, reload the library and choose it or ask the coach to revise. No exercise is created automatically.

## AI calls and reliability

MESOCYCLE_DESIGN uses the existing T3 model configuration (default gpt-5.6-sol, high effort), a 240-second provider timeout, 24,576 maximum output tokens and zero automatic provider retries. Existing OPENAI_T3_MODEL / OPENAI_T3_REASONING_EFFORT overrides apply. The route allows 300 seconds.

Only Build / Send requests AI, once per explicit operation. CREATE, SAVE, APPROVE, ARCHIVE, page reads, feasibility checks and handoffs make no AI requests. Existing unrelated automatic coaching remains governed by its existing triggers. Exercise/photo analysis receives additional text context only when its existing explicit analysis runs.

A five-minute per-draft request lease prevents concurrent duplicate generation. Revision guards prevent stale overwrites. Failed/incomplete responses preserve the saved draft. Locked choices are checked before accepting a revised response. Approval revalidates current exercise/preferences/set-type data inside a serializable transaction. Duplicate approval cannot create a second program. Discussion is bounded to 40 messages; begin a new design if a long discussion reaches that limit.

## Targeted revisions and T3 reuse (included in this replacement ZIP)

Initial generation still receives the full design evidence and returns a complete proposal. Subsequent Build / Send operations return a typed patch: changed plan fields, changed sessions and explicit removals. The server merges it into the current saved draft, preserving unchanged fields and sessions. A discussion answer can return no program changes. Locked items, reference validation, revision guards and the one-call lease remain in place. There is no hidden routing call, second refinement call or automatic fallback regeneration.

Revision context is refreshed from current data. It includes full-window exercise summaries, latest exercise pain signals, current metrics, accepted photo summaries, goals, phase and prior block conclusions. Raw historical sets and previous blocks' approved plan bodies are omitted. All exercise choices and preferences remain discoverable, but detailed mechanics are expanded only for current exercises and current/confirmed focus muscles. Other omitted mechanics are explicitly unknown; the coach must not invent emphasis or resistance profiles. Only the last six discussion messages are resent, with the current brief and complete current draft carrying agreed decisions. A long discussion should keep lasting requirements in the brief/draft.

Weekly planning now receives the fresh T3 assessment's full per-muscle rationale, supporting evidence and priority review, plus global/body-composition summaries. Reuse requires a valid assessment no more than seven days old, covering the newest logged workout, analysis, metric and phase dates, with matching configured muscle priorities. Duplicate muscle assessments and invalid/future dates are rejected for reuse. Current accepted targets remain authoritative; unapproved T3 options are not silently applied.

When reuse qualifies, broad historical exposure-tolerance summaries, the historical phase timeline and duplicate recent performance samples are omitted from the weekly prompt. Current pain signals (including individual set pain), completed dose, availability, constraints, current phase, exercise/set-format evidence and accepted mesocycle intent remain. The planner is instructed to solve allocation and explain only affected departures. Without a qualifying assessment, the normal evidence review remains available. Existing weekly delta output continues to preserve unchanged days.

These changes reduce repeated input and output; they do not remove the reasoning required for a meaningful change. Exact token savings depend on library size and requested scope and have not been measured with paid production calls. Existing usage logs record actual input/output/reasoning/cache counts. Output caps and model settings remain unchanged.

No additional database migration or UI action is required for this optimization. This ZIP replaces the earlier full mesocycle-coach ZIP; it contains the original patch plus these changes.

## Migration and privacy

One additive migration:
- New `mesocycle_designs` table for user-owned drafts, discussion, evidence snapshots and approved record IDs.
- Nullable `program_mesocycles.approved_design` JSON for the accepted intent.

The new table has RLS enabled and no PUBLIC, anon or authenticated table grants. Access is through authenticated, ownership-scoped server Prisma operations using the normal application database owner connection. No new storage bucket, photo uploads, client database access or SECURITY DEFINER function is introduced. Existing table policies are not relaxed. Draft discussion/evidence contains personal training information and remains in this user-owned table. Live Supabase advisories were not inspected.

## Apply (PowerShell, repository root)

Commit or stash local edits. Extract the ZIP into the repository root, preserving directories and replacing the listed files. The file manifest lists the full patch. No environment files, node_modules or generated build artifacts are included.

Apply the database migration before deploying the new code:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run typecheck
npm run build
npm run lint
node --import tsx scripts/test-mesocycle-design.ts
node --import tsx scripts/test-design-revisions.ts
node --import tsx scripts/test-coach-cleanup.ts
node --import tsx scripts/test-coaching-models.ts
git diff --check
git status --short
```

After the checks and your review:

```powershell
git add app components lib prisma scripts MESOCYCLE-DESIGN-README.md MESOCYCLE-DESIGN-FILES.txt
git commit -m "Add discussion-based program and mesocycle design coaching"
git push origin main
```

## Verification

- Type-checking and production build passed.
- Lint: no errors; five pre-existing unused-variable warnings.
- Deterministic tests cover valid/unknown references, confirmed priorities, duplicate exercises, excluded exercises, unresolved slots, cross-week spacing, session time, locked revisions and compact handoffs.
- Real Prisma/pg against a disposable PGlite PostgreSQL database: migration and RLS, ownership, revision conflicts, generation lease, mocked provider failures, locked-response preservation, atomic/idempotent approval, generated templates/set plans/priorities, existing prescription generation, cross-program evidence and weekly completed-work accounting.
- Existing model routing, weekly planning, pre-workout policy (37 checks), exercise analysis and physique analysis tests passed.
- Browser editor tests at desktop and 390px mobile width: no load-triggered calls, save without AI, invalid session count blocks approval, exactly one explicit generation, no JavaScript errors or horizontal overflow. UI requests were mocked; this was not a signed-in live Supabase test.
- Targeted revision tests cover no-op answers, field/session preservation, explicit clears, malformed removals, duplicate changes, foreign references, locked edits and the provider structured-output schema. Service tests verify the revision request mode and omission of raw historical sets. Fresh T3 tests cover retained evidence/rationale, legacy compatibility and stale/future/invalid/duplicate rejection.
- No paid model requests or live database changes were used in verification.

The included `test-mesocycle-design-service.mjs` is a database integration test, not an installation command. Run it only on a DISPOSABLE database containing the updated schema, with DATABASE_URL pointed there and MESOCYCLE_DESIGN_DISPOSABLE_DB=1. It creates test rows. The development PGlite/browser harness is not an application dependency.
