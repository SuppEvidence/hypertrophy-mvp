# Workout logger focus — 18 October 2026

Base: `968c991` (Weekly slot reference fix).

## Apply

Merge the ZIP's `app`, `components`, `lib`, `scripts` and `docs` folders into the project root, replacing matching files. Run:

```sh
npm run typecheck
node scripts/test-workout-exercise-guidance.mjs
node scripts/test-train-weekly-recovery.mjs
npm run build
```

Then commit/push through the usual workflow. No dependency installation, database migration, Supabase SQL, environment changes or npm configuration changes are required.

Refresh an open Train page after deployment. Existing sessions, exercise profiles and logs need no conversion or reanalysis.

## In a workout

An open session now leads with the actual workout and exercise names, rep range/load reference, live set coach and set rows. Suggested-next-workout cards, program/template switching and resume lists are shown before starting a session instead of above an active logger. The general training-philosophy banner is removed.

Each exercise has a closed-by-default **Exercise guidance · setup & execution** section. It brings together saved library/personal setup notes and the accepted Exercise Coach summary and execution cues. A nested section offers movement/muscle emphasis, resistance/loading context, observations and assessment limits. Unaccepted drafts are excluded; a stale assessment produces a refresh-profile note and no stale execution advice. Missing profiles leave setup notes available.

The guidance displays the current accepted exercise profile. Historical workout muscle snapshots are not rewritten. Exercises already in an authorized session can retain guidance after archiving; archiving still keeps them out of ordinary exercise choices.

Exercise substitution, temporary/remembered choice scope and notes are grouped under **Change exercise or add a note**. Adding an unplanned exercise, load/prescription detail, exercise totals and draft-session summaries are expandable. Finished-session review remains available.

## Logging retained

The existing set-row component and tracking actions retain weight, reps, RIR, completion, set format, timers, filmed status, execution-compromise reasons, clusters/drop-set details and quality fields. Exercise pain/location/side/impact notes remain available in their expandable control. Set addition/removal, exercise notes, session notes and finish-workout actions remain present. Existing live T1 coaching stays mounted during active training, with its existing approval rules and triggers. Pre-workout review and workout selection remain available before starting.

The exercise header uses the actual exercise name, allows wrapping on small screens and retains the completed-set count and automatic collapse behavior. An existing exercise omitted from current library choices remains explicitly selected when editing its note, preventing a note-only save from silently selecting the first replacement option.

## AI and privacy

Guidance is a projection of saved, authorized exercise records for the current session's exercise IDs. It is read in a batch and rendered as expandable text; expanding it triggers no model call, video analysis, signed image request or background generation. Full analysis envelopes and video evidence are excluded from the returned guidance projection. Existing live/pre-workout coaching behavior remains in place.

No schema, storage permissions or privacy policies change.

## Verification

- Type checking and production build passed.
- Guidance tests cover user-scoped queries, accepted profiles, stale/unaccepted suppression, minimal output and empty-session behavior.
- Existing Train weekly-recovery tests passed.
- Interactive fixtures at 390px and 1440px passed checks for layout overflow, active-session selector removal, closed guidance, opening cues without a coaching request, weight autosave, set-format selection and exercise controls. Pre-start selection and start action remained available.

Verification used mock records and browser fixtures; no live Supabase records or Vercel deployment were changed.
