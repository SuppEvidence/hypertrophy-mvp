Dashboard refresh patch

Base: fe07593 (Nutrition and Phase Coach).

Copy the included folders and package.json into your project root, merging folders and replacing matching files.
No database migration or additional npm approval commands required.

Run:
  npm run typecheck
  node scripts/test-home-dashboard.mjs
  npm run build

Then commit and push as usual.

See docs/dashboard-refresh.md for changes, npm warning details and verification.
