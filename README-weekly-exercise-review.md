# Weekly coach exercise conflicts in proposal review

Apply on top of the weekly planner v2, the exercise-validation fix, the timeout/continuity update, and the generated-validator typecheck fix if you have installed it. Extract this ZIP at the app root, replacing five matching files. It has no database migration and no environment-variable change.

## New review behavior

The model may return an exercise stored on a template that your coaching profile marks **Avoid**, or an exercise ID that is no longer active or present in your catalog. The earlier workflow rejected the entire week before you could inspect it. Now it saves an otherwise valid **proposal**, flags the exact workout and exercise, and displays the remaining known weekly muscle work. A missing exercise's contribution cannot be estimated until it is replaced.

- **Active but marked Avoid:** Keep the exercise if you explicitly tick the acknowledgment when approving the week, or select a different active exercise. This approval applies to this week; the coaching profile is not changed. A later week's carry-forward does not automatically reuse exercises still marked Avoid.
- **Inactive, archived, or unknown ID:** Select an active replacement before approval. An unresolved ID cannot be opened by the logger, so approving it as-is would create a workout that cannot be started. The replacement may use the same movement slot or become a temporary exercise slot when its movement differs; the underlying templates do not change.
- Replacing an exercise resets any set types that cannot safely carry to the new exercise to the regular set type. Dates, session capacity, movement compatibility, weekly dose, and other policy checks remain in force. The approval action checks again against the current active catalog, even if a form is submitted directly.

## Test in development

1. Extract the ZIP at the project root. There is no migration to run.
2. Run `npm run typecheck` and `node --import tsx scripts/test-weekly-coach.ts`.
3. Re-run **Plan → Weekly coach**. If the model selects an active Avoid exercise, review the flagged row, then either replace it or explicitly acknowledge it while approving. If the exercise is unavailable, replace it and check the revised dose summary before approving. Your already completed Monday workout remains fixed.

## Production

After the review and logger work in dev, commit and push these five files to `main` for the normal Vercel deployment. No production migration is required for this overlay. Live OpenAI and production database behavior were not available to test in this workspace.

Verified locally: Prisma Client/Next route type generation, TypeScript typecheck, production boundary check, focused weekly tests, targeted ESLint, and whitespace check.
