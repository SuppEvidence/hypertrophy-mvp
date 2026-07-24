# Speed optimization patch

No database migration is required.

Main changes:
- Deduplicated authentication/profile initialization per request.
- Profile creation is now read-first and write-only when missing or email changed.
- Removed four development count queries from every protected layout render.
- Added conservative PostgreSQL pool limits/timeouts, configurable with optional env vars.
- Workout autosave performs one scoped update and does not revalidate unrelated routes.
- Completed workout changes still revalidate history, Dashboard, and Performance.
- Suggested-weight history is bounded instead of loading lifetime set history.
- Dashboard, Logger, Template Builder, history, and Performance queries use slimmer selects and more parallel reads.
- Template synchronization exits without writes when templates are already aligned.

Optional environment overrides:
- PG_POOL_MAX
- PG_IDLE_TIMEOUT_MS
- PG_CONNECTION_TIMEOUT_MS
