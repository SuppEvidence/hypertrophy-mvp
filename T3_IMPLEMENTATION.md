# T3 priority-based volume coaching

## September 23 correction

For an installation where T3 is already migrated, see `T3_CORRECTION.md` first.
This correction requires no additional migration. The original installation
instructions below still apply only to databases that have not received T3.

This update builds on the already deployed T0–T2 code and the minimum-weight-
increment migration. It adds an additive database migration and converts the
three analysis surfaces into one continuous coaching workflow.

## What changes

- In each mesocycle, choose **High priority**, **Grow**, **Maintenance**, or
  **No direct focus** for every muscle. The form suggests defaults from the
  existing program but requires your confirmation. No user-entered weekly-set
  targets are required at the mesocycle layer.
- The first save snapshots the current generated prescription as each muscle's
  transition baseline. It does not immediately replace an ongoing workout or
  reusable template. Existing numerical mesocycle targets remain stored for
  historical review and rollback, but T3's coach target becomes the active
  volume target for configured blocks.
- At workout completion, analysis runs after the response. T3 evaluates the
  current block when there is new evidence and either no prior review, seven
  days have passed, or at least 48 hours have passed with an adverse fatigue
  signal. Ordinary sessions do not trigger a fresh T3 model call every time.
- T3 assesses all configured muscles, stores a useful-dose range, status,
  confidence, rationale, evidence, and body-composition interpretation. Sparse
  evidence defaults to HOLD. Paired downward bodyweight and waist can make
  maintained performance a successful fat-loss result; it is not a reason on
  its own to cut work.
- Only a meaningful proposed dose/reallocation becomes an approval card.
  Selecting it changes the current block's coach target and movement-level
  prescription; **Keep as is** leaves the plan unchanged. A change is limited
  normally to one or two weekly effective sets, with evidence-dependent staged
  limits and seven-day approval budgets described in `T3_CORRECTION.md`.
  Template slot additions/removals still require separate approval, and T1's
  live set-removal gate remains unchanged.
- Pre-workout coaching receives T3 priorities and coach-owned targets while
  retaining its own approval step for a changed session construction.
- The Volume Coaching page displays automatic assessment and decisions instead
  of requesting an independent analysis. Workout Analysis shows pending,
  completed, or failed status with retry. The Next-block Review runs after a
  final-week workout or early block end. It suggests future priorities and
  qualitative movement/template implications, not another set prescription.

Automatic analyses and T3 reviews use the existing `OPENAI_API_KEY` and
`OPENAI_MODEL`. No new required environment variable or dependency is added.
The T3 review hotfix gives its model call up to 75 seconds and sends a shorter
recent evidence and decision history. The Retry button shows **Reviewing volume…**
and disables itself while the request is pending. The manual Volume Coaching
route allows 120 seconds and the automatic post-workout route allows 180 seconds
for its sequence of analyses. This hotfix has no new migration: if T3 was
already migrated, deploy the changed app files only. Ensure your Vercel plan
supports those function durations; a lower platform limit can still terminate
the request before the model responds.
Optional emergency switches, each set to `false` and redeployed, are
`AUTO_WORKOUT_ANALYSIS_ENABLED`, `T3_VOLUME_COACH_ENABLED`, and
`AUTO_MESOCYCLE_REVIEW_ENABLED`. Disabling automatic analysis leaves a manual
Analyze button; T3 can still inspect raw logs but has less AI synthesis.

## Required dev database update — before opening the app

Extract the archive into the project root, including
`prisma/migrations/20260923120000_add_t3_priority_coaching/migration.sql`.
The new code queries `program_mesocycles.t3_activated_at` on dashboard and
mesocycle pages, so those views fail until the **same database used by dev**
has the migration. `prisma generate`, typecheck, and `npm run build` do not
create database columns.

Check that `.env.local` (or an already-set `DATABASE_URL` in your shell) points
to your intended dev database. From the project root in PowerShell:

```powershell
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
npm run dev
```

The second status check should show no pending migrations. If `migrate status`
lists older migrations that you previously applied manually through SQL, do
not blindly replay them: reconcile their migration history first, or apply
only the T3 `migration.sql` once through the SQL editor connected to that same
dev database. Never apply T3 both ways. If status says T3 is already applied
but `t3_activated_at` is missing, check which database the app and Prisma
commands actually use; a mismatch or migration-history drift needs resolving
before trying again. Restart the dev server after the migration.

## Local verification

```bash
npm run typecheck
node --import tsx scripts/test-t3-volume-coach.ts
node --import tsx scripts/test-pre-workout-coach.ts
node --import tsx scripts/test-workout-coach.ts
node scripts/test-workout-coach-engine.mjs
node scripts/test-workout-coach-outcomes.mjs
node --import tsx scripts/test-exercise-load-increment.ts
npm run build
```

The tests are offline policy and regression checks. They cannot verify a real
database migration, authenticated flow, or provider response. A production
build with a placeholder database URL may log database connection errors while
prerendering public pages; use your real dev database for an authenticated
smoke test.

## Dev smoke test

1. After the required dev migration above, open the current block in Programs,
   inspect the suggested priorities, and save them. Verify that
   its existing templates and already logged sets have not changed.
2. Open AI Advisor → Volume Coaching. Check the captured baseline and coach
   targets. A first assessment can run immediately; if it fails, use Retry.
3. Finish a disposable workout. Confirm its Workout Analysis status moves
   through pending/running to completed or failed, and that the logger remains
   usable. Retry a failed or interrupted analysis from the analysis page.
4. If T3 proposes a change, compare its evidence and choose Keep or an option.
   Verify the block target changes only when an option is approved; slot
   additions/removals still have their own approval control. Do not fabricate
   symptoms in real training history to force a test case.
5. In a disposable near-end block, finish a workout and confirm that the
   Next-block Review contains priority directions but no independent numeric
  weekly-set recommendations. It must not modify the next block automatically.
  In the final week it can refresh after 48 hours when another completed workout
  provides new evidence.

## Deployment for your GitHub/Vercel workflow

The included migration is **additive**; it does not delete old targets or
analyses. Back up the production database first. Check its migration status,
then apply T3 to that production database **before** deploying the code. In an
environment configured with the production `DATABASE_URL`, run:

```bash
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate status
```

If older migrations were applied manually and appear pending, reconcile that
history before using `migrate deploy`. Alternatively, apply only the included
T3 `migration.sql` once in the production SQL editor; do not run both methods
against the same database. Extract the T3 archive into the repository root,
overwriting the included files; check the diff, run the verification commands,
commit and push `main`. Vercel can build normally. Do not place the database
URL in a command, commit, or screenshot.

After deployment, open the current mesocycle in Programs and confirm the T3
priorities. No existing mesocycle is auto-activated by the migration. Finish a
test workout and observe its analysis status and Volume Coaching assessment.
The first AI-era block is treated as a transition baseline when historical
evidence is limited. The next-block review is advisory and requires you to
set the next block's priorities yourself.

If rollback is needed, disable the optional switches or redeploy the previous
app version. Leave the additive T3 tables/columns in place; dropping them
would discard saved priority and assessment history.
