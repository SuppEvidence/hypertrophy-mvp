# T3 review correction — September 23, 2026

If this file came with the T1–T3 model-routing package, use
`T1_T3_MODEL_ROUTING.md` for model configuration, current request/route timeouts
and installation commands. The coaching policy below still applies.

## Apply to your existing T3 installation

No new database migration, dependency, or environment variable is required.
The archive includes the original T3 migration for first-time installation only;
do not reapply it to an already migrated database.

Download `T3_priority_coaching_update.zip` to Downloads. In PowerShell:

```powershell
cd C:\Users\ilpop\Desktop\hypertrophy-mvp
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\T3_priority_coaching_update.zip" -DestinationPath . -Force
npm run typecheck
node --import tsx scripts/test-t3-volume-coach.ts
node --import tsx scripts/test-pre-workout-coach.ts
npm run build
```

Stop if a check fails. To test locally, run `npm run dev`, open Volume Coaching,
and click **Review volume** or **Retry T3 review**. This also replaces obsolete
pending cards with recommendations that have prescription previews. Existing
priorities and baseline targets do not need to be reset or reactivated.

After the checks pass, inspect `git diff --stat`. Commit your T3 update and push
through the existing Vercel workflow:

```powershell
git add -- "app/(protected)/ai-analysis/volume/page.tsx" "app/(protected)/log/page.tsx" lib/ai/programming-decision-schema.ts lib/coaching/t3-volume-policy.ts lib/coaching/t3-review-validation.ts lib/coaching/t3-prescription-preview.ts lib/coaching/pre-workout-coach-policy.ts lib/server/coaching-evidence.ts lib/server/ai-advisor-actions.ts lib/server/ai-mesocycle-recommendations.ts lib/server/ai-programming-decisions.ts lib/server/mesocycles.ts lib/server/pre-workout-coach.ts lib/server/prescriptions.ts scripts/test-t3-volume-coach.ts T3_IMPLEMENTATION.md T3_CORRECTION.md
git commit -m "Correct T3 review rules, evidence and approval safeguards"
git push origin main
```

The Volume Coaching route allows 120 seconds, the logger 180 seconds for its
sequence of automatic analyses, and the T3 model request 75 seconds. These
route budgets must be supported by the Vercel project configuration. Provider
timeouts can still occur; a failed request retains the previous assessment.

## Corrected policy

| Area | Rule |
| --- | --- |
| Priorities | High priority, Grow, Maintenance, and No direct focus remain user choices. Priority alone never justifies more sets. |
| Estimated range | Each boundary may move by more than two sets when evidence supports it. The range is an estimate, not a prescription or a user quota. The 0–60 envelope is an application sanity limit, not a physiological optimum. |
| Training dose | Usually propose 1–2 weekly effective sets. High-confidence increases can reach 20% of the current target, rounded down, with a minimum allowance of 2 and maximum of 4. High-confidence reductions, or moderate-confidence recovery concerns, can reach 25%, rounded up, with an allowance of 2–6. |
| Sparse evidence | Keep by default. A symptom-related recovery concern may justify a small protective reduction even with low confidence. |
| Approval | All T3 set-count and volume changes require approval. Updating an assessment or range does not approve changes. T1 load/rep/RIR automation retains its existing scope. |
| Repeated changes | Per muscle, seven-day approval budgets are 4 added and 6 removed effective sets, counted separately. Across the block, budgets are 12 added and 16 removed weekly physical sets. These limits apply to the realized previews recorded by this correction. |
| No direct focus | Cannot receive a targeted increase or an option introducing additional targeted work. Incidental compound overlap remains possible and appears in the preview. |
| Movement allocation | Uses the prescribed dose, not recently completed volume, to judge removals. Muscle effective sets, movement effective sets, and physical set counts are distinguished. |
| Implementation | The existing planner simulates each option using template frequency, set types, slot bounds and secondary-muscle contributions. Unimplementable options are withheld with a reason. Structural additions and exercise ordering require their existing separate workflow. |
| Review errors | An invalid option is withheld without discarding valid assessments. Missing/inconsistent muscle assessments retain the prior range with low confidence. A response with no usable assessments still fails visibly. |
| Concurrent changes | Reviews and approvals check block versions. Approval re-runs the planner and requires the effect to match the preview shown to the user. Duplicate approvals cannot apply twice. |

The step and budget numbers are conservative product controls. They are not
presented as experimentally established individual volume thresholds. A larger
desired change can be described by the coach and reached in stages after response
is observed; the model cannot enlarge the application limits itself.

## Evidence and analysis corrections

- T3 receives up to 90 days of compact exercise-history evidence independently
  of whether those workouts were analyzed by AI. Performance comparisons omit
  intensifier and execution-compromised set loads.
- T3 and the pre-workout coach share localized readiness calculations. Exercise
  pain is counted once per exposure rather than multiplied by the number of sets.
- Recent paired weight/waist trends and recovery Metrics are supplied explicitly.
  Stable performance during likely fat loss can be productive; recovery alone
  is not a reason to add work. Readiness and stimulus remain inferences.
- Historical T3 blocks now contribute muscle priorities and coach targets even
  when they have no legacy numerical volume-target rows. Completed blocks are
  distinguished from ongoing blocks; historical Metrics are not truncated to
  the oldest 160 entries. Dose and circumference observations are not treated
  as proof of a causal hypertrophy response.
- Decision memory distinguishes an approved implementation from a measured
  training outcome. Actual response must come from later logs and Metrics.
- Local pain and movement-pattern fatigue/stall signals can trigger the existing
  48-hour adverse review cadence. Normal automatic reviews retain the roughly
  weekly cadence with new evidence. Explicit review remains available.
- Next-block review stays advisory, covering priorities and implementation.
  It may refresh after 48 hours in the final week when a new workout is completed.
- Saving changed priorities clears stale assessment content and supersedes old
  cards. A review finishing against an older block version cannot overwrite it.

## Verification and limits

Offline checks cover range/dose separation, bad-option recovery, uncertain
evidence, adaptive step limits, impossible removals, actual planner previews,
fixed slot limits, and rolling approval budgets. Existing T2 tests cover shared
readiness and body-composition behavior. Typecheck, targeted lint and production
build are also run.

A live authenticated database flow and real model response require testing in
your environment. Check that clicking Review immediately shows its pending state,
that an estimated-range change alone leaves the prescription unchanged, and that
an approved option produces the exact slot effects shown in its preview. Active
workout snapshots retain the app's existing behavior; these previews describe
the underlying mesocycle prescription, before temporary missed-workout/T2 edits.
