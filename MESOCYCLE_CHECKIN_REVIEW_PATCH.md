# T3 next-block review: measurement gate and shared boundary check-ins

Apply this overlay to the current T0–T3 app **after** the coaching profile and dated energy phase patches (and the optional dashboard follow-up overlay, if desired). It contains only the files for this change. Earlier database migrations still need to be applied as directed by their patches; this overlay adds **no database migration** and changes no environment variables.

## Behavior

- The next-block AI review can run in the final seven days of an active block, within seven days after its planned end, or following an early end, **only after** a saved `MESOCYCLE_END` check-in exists within seven calendar days of the effective end date. It also needs a saved `MESOCYCLE_START` check-in within seven days of the start, or the previous block's `MESOCYCLE_END` check-in when that block ended within seven days of the new start. The start and end check-ins must contain **at least one matching nonempty chest, shoulder, arm, thigh, glute, or calf circumference**. Drafts, future-dated logs, daily weight/waist entries and check-ins outside the windows do not satisfy the gate. Bodyweight and waist remain useful supporting context, but do not substitute for a measured circumference.
- The prior block's end check-in is *read* as the next block's starting observation; no duplicate metric row is created. A separately saved start check-in takes precedence if it has a measurement that overlaps the end; otherwise a comparable prior end check-in can be used.
- Completing a workout, ending a block early, or saving a start/end check-in can trigger the existing automatic review **after** all requirements are met. The end action no longer bypasses the gate. A newly saved or corrected boundary check-in can refresh an older review; unchanged measurements keep the prior cooldown. The review still needs at least one completed workout in the block and does not change the next block automatically.
- The next-block review screen states which check-in is missing. T3 historical dose-response and the mesocycle progress report use the same carry-forward baseline when possible.

## Apply locally (PowerShell in repository root)

```powershell
Expand-Archive -Path .\mesocycle-checkin-review-patch.zip -DestinationPath . -Force
npm run typecheck
node --import tsx scripts/test-mesocycle-checkins.ts
```

Commit/push the extracted files to `main` for the established Vercel deployment. This overlay requires **no new migration**. If earlier patches have pending migrations, run their `npx prisma migrate deploy` against the target database before serving their code. Do not deploy `.env.local`.

After deployment, a final-week workout without boundary check-ins should leave the next-block review waiting. Save the end check-in near the end date after an existing start check-in: the review should run automatically; with a new mesocycle starting shortly after the previous block, the previous end check-in should provide the baseline without another entry. Live AI execution and a connected database were not available here; verification covers boundary selection, typecheck, production boundary checks, targeted lint, and diff validation.
