# Changelog

## 1.0.2

- Made missed-workout redistribution effective-set and set-type multiplier aware.
- Preserved multiplier set types during redistribution and prevented the allocator from adding more than one multiplier set per exercise slot.
- Added temporary weekly movement slots when existing matching slots cannot accept missed volume, starting with the least-loaded eligible workout.
- Added last-used exercise recall for each template movement slot from the previous completed occurrence of the same template.

## 1.0.1

- Added an explicit actual end date and **End mesocycle** action.
- Active prescriptions stop using an ended mesocycle immediately.
- Mesocycle reviews scale targets and planned volume to the actual active duration.
- Clarified reusable program defaults versus optional mesocycle overrides.
- Exercise cards auto-collapse when all set rows are marked complete and can be reopened.

## 1.0.0

- Released as **Ripped Fat Dude Hypertrophy Tracker**.
- Added product branding, active navigation states, refined mobile navigation, updated form controls, and consistent product surfaces.
- Removed remaining prototype and slice-oriented language from user-facing views.
- Added full template duplication, including movement-pattern slots, planned sets, rep ranges, set types, notes, adjustment rules, and expected occurrences.
- Preserved all existing program, mesocycle, workout, metrics, dashboard, and historical-log behavior.
