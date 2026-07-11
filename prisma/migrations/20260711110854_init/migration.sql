-- AlterTable
ALTER TABLE "mesocycle_movement_rep_policies" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mesocycle_movement_volume_targets" ALTER COLUMN "id" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "mesocycle_movement_rep_policies_mesocycle_id_movement_group_id_" RENAME TO "mesocycle_movement_rep_policies_mesocycle_id_movement_group_key";

-- RenameIndex
ALTER INDEX "mesocycle_movement_volume_targets_mesocycle_id_movement_group_i" RENAME TO "mesocycle_movement_volume_targets_mesocycle_id_movement_gro_key";
