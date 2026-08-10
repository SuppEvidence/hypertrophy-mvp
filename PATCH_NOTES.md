# V1.0.2 missed-workout allocator and exercise recall

No database migration is required.

## Missed-workout redistribution

- Redistribution is calculated in effective-set units rather than physical-set counts.
- Each missed physical set carries its original set type and multiplier into the weekly recovery prescription.
- The allocator will not add a multiplier set to an exercise slot that already contains a multiplier set.
- Existing matching movement slots are used first, subject to their physical-set capacity.
- When no matching slot can accept a missed set, a temporary weekly-only movement slot is created.
- Temporary slots are placed into the least-loaded eligible workout first and do not modify the base template.
- Weekly-plan UI now reports both physical sets and effective sets.

## Exercise recall

- Starting a template looks at the most recent completed workout using that same template.
- For each stable template slot, the exercise used in that slot previously is preselected when it is still active and belongs to the same movement group.
- If there is no matching previous completed slot, the existing template/default exercise fallback is used.
- Temporary weekly-only slots use their redistribution fallback exercise.
