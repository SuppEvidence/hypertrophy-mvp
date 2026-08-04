# Mesocycle circumference review fix

No database migration is required.

Changes:
- Mesocycle reviews prefer explicit MESOCYCLE_START and MESOCYCLE_END circumference logs nearest the relevant boundary.
- When no explicit typed log exists for a field, the nearest saved non-draft circumference within seven days of the boundary is used.
- Existing DAILY and OPTIONAL_CHECKIN circumference entries can therefore populate reviews retroactively.
- The completed-mesocycle Metrics link preselects MESOCYCLE_END and the actual/effective end date.
- Metrics supports safe initial log-type/date query parameters.
- Saving Metrics invalidates program pages so reviews refresh instead of retaining stale values.
- Circumference labels in reviews are title-cased.
