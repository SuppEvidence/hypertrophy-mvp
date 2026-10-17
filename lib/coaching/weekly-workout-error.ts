/** Expected stale-plan failure; callers must not hide unrelated database errors. */
export class WeeklyWorkoutUnavailableError extends Error {
  constructor() {
    super("This weekly workout is no longer available. Open the weekly plan again.");
    this.name = "WeeklyWorkoutUnavailableError";
  }
}
