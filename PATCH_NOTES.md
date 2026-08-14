# Missed-workout completed-volume fix

No database migration is required.

## Fix

The weekly missed-workout allocator now credits actual completed effective volume by movement pattern before deciding how much missed volume still needs to be recovered.

Recovery requirement per movement pattern is:

planned weekly effective volume
- actual completed effective volume this week
- effective volume still planned in non-missed, non-completed workouts

The result is capped at the effective volume actually lost from missed workouts, so this feature does not turn into a general under-performance make-up allocator.

Additional safeguards:
- completed workouts cannot receive redistributed work;
- recipient workouts are balanced by planned/current workload;
- set-type multipliers remain supported;
- if a missed multiplier is larger than the remaining recovery requirement, a smaller available set type can be used instead;
- no recipient workout gets more than one temporary weekly slot for the same movement pattern;
- unplaceable required recovery remains explicitly unallocated.

The Template Builder weekly summary now shows missed effective volume, recovery actually needed, completed effective volume credited, and reallocated/unallocated volume.
