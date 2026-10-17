# Dashboard refresh — 17 October 2026

Base: `fe07593` (deployed Nutrition and Phase Coach).

## Apply

Copy the ZIP's `app`, `components`, `lib`, `scripts`, `docs` folders and `package.json` into the project root, merging folders and replacing the matching files. Do not replace the whole project folder. Then run:

```sh
npm run typecheck
node scripts/test-home-dashboard.mjs
npm run build
```

Commit and push through your usual workflow. No Prisma migration, Supabase SQL, storage-policy changes, environment secrets or dependency upgrades are required. `package-lock.json` stays unchanged. No separate npm approval commands are needed for the four currently locked packages.

## What changes

- Home prioritizes resuming an unfinished session, then the exact remaining workout in the approved current weekly plan. The base rotation is used only without an approved week. Completed weeks and unavailable exercises route to review rather than silently opening a different workout.
- Current/upcoming/latest mesocycle, calendar progress and approved muscle priorities are visible together.
- A review list brings together saved weekly proposals, latest-generation volume decisions, nutrition reviews, photo assessments/check-in dates, and mesocycle planning. Three items are shown initially; additional items expand on demand.
- Nutrition displays the latest accepted adjustment and agreed review date/criteria. A later manual baseline edit clears the old adjustment reminder.
- Photo cadence uses the existing phase/settings policy and the latest photo capture date, including historical uploads: cutting every two weeks; beginner/mid-intermediate gaining every four weeks; advanced gaining at the user's configured 8–12-week interval. Maintenance retains the existing configurable policy. Home does not independently interpret photos.
- Bodyweight/waist averages show the number of logged days. Repeat entries in one day do not overweight the average. Comparison requires at least two logged days in each seven-day window. Older measurements remain explicitly dated instead of appearing current.
- Exercise library/coaching, progress and workout history remain accessible. Nutrition and photos remain visible without an active training program.

## AI, privacy and compatibility

The dedicated Home loader only reads saved, user-scoped records. It does not invoke AI, generate prescriptions, create templates, download photos, sign image URLs or write to the database. Its links disable prefetch; opening Home does not preload coach pages. Visiting a destination retains that page's existing behavior and explicit coaching controls.

The older dashboard data service is left intact because Progress and existing coaching workflows still consume it. This patch changes no coaching prompts, analysis outputs, approvals, workout history or muscle mappings. Saved proposal labels are navigation hints; each coach retains its own freshness/acceptance checks.

## npm warning cleanup

`package.json` explicitly approves install scripts for the versions already in `package-lock.json`: `@prisma/engines@7.10.0`, `prisma@7.10.0`, `esbuild@0.28.2`, and `unrs-resolver@1.12.2`. This was checked with npm 11.21.0: no packages with unreviewed install scripts. Future dependency upgrades may require reviewing their new versions again.

The reported `cache-dir` setting is absent from this repository. If Vercel still reports it, check the project's environment/build settings for `npm_config_cache_dir` or `NPM_CONFIG_CACHE_DIR`. Remove it if unnecessary; if a custom npm cache path was intentional, npm uses the `cache` option (`npm_config_cache`). If Vercel injects the setting itself, the repository patch cannot remove it. Do not add blanket script approvals or run `npm audit fix --force` for these warnings.

## Verification

- Type checking and production build passed against the base above.
- Focused Home regression tests passed: read-only/user-scoped boundaries, approved occurrence selection, unavailable exercise recovery, draft session priority, completed week handling, current-generation volume decisions, nutrition baseline replacement, phase-based photo cadence, sparse/daily-deduplicated measurements and rendering.
- Existing Train weekly recovery regression passed.
- Populated and empty Home fixtures rendered at mobile and desktop widths with no horizontal overflow; review expansion and workout links checked.

Checks used mocked records and an isolated build, not the live Supabase database or a live Vercel deployment.
