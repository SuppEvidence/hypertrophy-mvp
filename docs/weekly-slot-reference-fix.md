# Weekly planner workout-position fix — 18 October 2026

Base: `c3961b8` (Volume coach card update).

## Apply

Merge the ZIP's `app`, `lib`, `scripts` and `docs` folders into the project root, replacing matching files. Run:

```sh
npm run typecheck
node --import tsx scripts/test-weekly-slot-references.ts
npm run build
```

Then commit/push as usual. No dependency installation, database migration, Supabase SQL or environment changes are needed.

Refresh the weekly planner after deployment and run the failed review once again. The failed proposal was not saved, so it cannot be recovered without that one new review. Existing saved proposals can have their position metadata repaired during normal approval without another AI call.

## Cause and changes

`Unknown workout slot` means a proposed item's internal position ID does not exist in the current prescription and is not in the supported exercise-only format. This can result from an old position, a regenerated mesocycle position or an incorrectly returned model reference. The failed output is not retained, so the exact offending reference in the reported run cannot be identified retrospectively from that error alone.

The planner now repairs missing position references for exercises present in the authorized active catalog. It reconnects an unambiguous current position for the same exercise, preferring the same workout framework. If there is no unambiguous position, it uses the existing supported exercise-only reference. It never picks another exercise or changes sets, set types, dates, duration or the requested work. Known valid references remain unchanged.

Repair runs after exercise-continuity handling and before duplicate consolidation/validation. Associated exercise-change and manual-set metadata follow the repaired reference. Approval also repairs existing draft references and stores the same normalized proposal and allocation, so Train receives the validated references.

The model receives an explicit instruction about valid position references. No retry call or additional automatic AI call is introduced; repair is deterministic processing of the same response.

Unavailable exercises, unknown templates, invalid dates, repeated exercises, physical-set limits and other validation rules stay checked. Remaining position failures identify the workout date and exercise when its name is available, or explain that the missing library exercise must be restored/replaced.

The error panel displays up to three distinct validation problems on separate lines and retains a longer message rather than truncating it after the first vague error. The existing saved plan stays in place on a failed generation.

## Verification

Focused tests cover retired/generated references, exact and ambiguous matches, exercise-only fallback, associated metadata, input immutability, preservation of the exercise/work/schedule, duplicate consolidation and overflow rejection, invalid dates/templates, unavailable exercises and readable multi-issue errors. Existing weekly coach, manual set-type, set-type reasoning, priority continuity and Train recovery regressions passed. Type checking and production build were checked in an isolated workspace; no live Supabase records or Vercel deployment were changed.
