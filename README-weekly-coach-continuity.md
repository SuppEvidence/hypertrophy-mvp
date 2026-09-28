# Weekly coach timeout and later-week continuity

Apply this overlay on top of the weekly planner v2 **and** its exercise-validation fix. Extract it into the app root, replacing the six matching files. It contains no database migration and no new environment variable.

## What changes

- The first review without an approved and completed prior week in the same mesocycle still creates a full weekly plan with the T3 Sol model at high effort. The model receives a shorter, focused summary of recent performance and metrics. Its per-request time budget rises from 150 to 225 seconds, within the page's 300-second budget. The second full AI request previously made after an invalid proposal is removed: invalid output is rejected with a specific validation error rather than running another lengthy request. No unvalidated plan is saved.
- In later weeks, a week that was approved **and** had at least one completed scheduled workout in the same mesocycle becomes the starting structure. Completed exercises and sets are used where available; accepted nonmissed sessions provide the rest. The coach returns *only changes to individual days* at medium effort. Days it leaves alone retain the carried structure. All dates, exercise compatibility, set types, total weekly muscle work including already completed sessions, and session capacity pass the existing validator before an approval is offered.
- The carried structure is adjusted to available days, current active exercises/templates, and session minutes. Previously missed sessions are excluded. If there is no suitable prior week, the full high-effort review is used again. Existing completed workouts in the current week remain fixed. An explicit `OPENAI_WEEKLY_REASONING_EFFORT` setting still overrides the default effort for both paths.
- Timeout failures give a short message and record only operational metadata (model, tier, duration, status), never workout content or user identifiers. A timed-out request does not save or approve a plan.

## Development

1. Extract this ZIP over the app root, replacing existing files. No `prisma migrate deploy` is needed for this overlay; the earlier v2 migrations must already be applied.
2. Run `npm run typecheck`, `node --import tsx scripts/test-weekly-coach.ts`, and `node --import tsx scripts/test-coaching-models.ts`.
3. Run `npm run dev` and request this week's plan again. Today's completed workout is credited, and the first full review uses the extended time budget. After a week is approved and at least one planned workout is completed, the following week in the same mesocycle should carry its accepted and completed structure forward and review only changes. No live OpenAI call was possible in the patch workspace, so verify the model interaction in dev before deploying.

## Production

Commit and push these six files to your normal `main` branch after dev verification. Vercel then deploys as usual. No database or secret update is needed for this overlay. If the original weekly planner is not in production yet, its v2 archive includes the two migrations that must be run against production before deploying that code.
