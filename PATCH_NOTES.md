# V1.0.3 mesocycle structure planner

A database migration is required.

## Mesocycle structural planning

- Movement-pattern targets are interpreted as weekly effective-set prescription targets.
- The generator first adjusts existing auto-adjustable slots within their configured min/max set limits.
- Added sets are multiplier-aware and may use an intensifier set type when that improves the target match.
- An exercise slot may contain at most one intensifier set. Additional generated sets in the same slot use non-intensifier set types.
- If existing slot capacity cannot satisfy a movement target, the app proposes a mesocycle-only movement slot in the least-loaded suitable workout.
- If a lower target makes a whole slot unnecessary, the app can propose suppressing that slot for the mesocycle.
- Structural proposals require explicit approval. Base program templates are never changed.
- Approved structural overrides can be undone while the block is editable.
- Mesocycle-only added slots are included in workout prescriptions, set-type multipliers, and weekly missed-workout redistribution.

## Data model

`ProgramMesocycle.structureOverrides` stores approved mesocycle-only add/remove actions as JSON. Existing mesocycles remain compatible because the field is nullable.

## Apply

```powershell
npm run db:migrate
npx prisma generate
npm run typecheck
npm run build
```
