ONE-OFF WORKOUT ALTERNATIVES
Base: c756648 (Logger visual update)

Merge the included files into your existing project, preserving paths.
No database migration, dependency update or exercise-library reanalysis.
Commit and deploy normally after running npm run typecheck and npm run build.

Before starting an exercise, open "Different equipment? Use a one-off alternative".
Confirm similar movement and primary/supporting muscle emphasis. Then log the
actual set format, observed RIR and Done. Wait for Saved before finishing.
Pain, execution quality and optional equipment notes remain available.

Completed sets count using the source muscle allocation as an estimate.
Weights/reps stay out of performance history. No permanent exercise is created.
The one-off choice does not become a future preference. Live T1 load coaching is
paused for this exercise; existing post-workout reviews continue normally.

See docs/one-off-workout-alternatives.md for verification and implementation notes.

Verification note: the production build passed before the last client-prop
serialization correction. That correction passed type/browser checks; the final
full-build rerun was blocked by automatic review service capacity. Run npm run
build before deploying. This was a tooling failure, not a code rejection.
