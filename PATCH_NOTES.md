# V1.0.3 missed-workout temporary-slot regression fix

No migration is required.

Fixes a V1.0.3 regression in `getTemplatePrescription` where weekly temporary slots created by missed-workout redistribution were filtered out because they intentionally have `adjustedPlannedSets = 0` and store their allocated work in `weeklyAdjustedPlannedSets`.

Template prescription filtering now keeps an item when either:
- its mesocycle/base adjusted sets are positive, or
- its weekly adjusted sets are positive.

Mesocycle-suppressed slots remain excluded.
