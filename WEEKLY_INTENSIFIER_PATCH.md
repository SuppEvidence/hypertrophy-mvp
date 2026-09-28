# Weekly coach intensifier update

The weekly coach may plan one newly introduced intensified set per workout when exercise movement, primary/secondary muscle links, set type, effective-work multiplier and exercise coaching preferences permit it. It uses the same movement suitability rule as the daily coach. EDT requires that the set type be explicitly selected in the exercise coaching profile. Existing template intensified sets may remain. Approved planned set types now reach the workout logger, and eligible completed set types can carry forward into later weeks. The weekly proposal shows each exercise's set types for review.

## Apply and check (PowerShell, from the project root)

1. Extract the ZIP into the project root, replacing the included paths. There are no schema changes and no database migration.
2. Run `npm run typecheck` and `node --import tsx scripts/test-weekly-coach.ts` with your usual local environment configuration.
3. Run `npm run dev`; review and approve a weekly plan, then open its workout from the weekly coach. Confirm the logger contains its proposed set types.
4. Commit the updated files, push to the branch connected to Vercel, and check the deployment build. No environment variable changes are needed.

The weekly plan already supplies the workout baseline. A separate pre-workout review is optional for the first week and for later weeks. Use it if readiness, time, pain, equipment, or another day-specific constraint changes; set-by-set regulation still runs during the workout.
