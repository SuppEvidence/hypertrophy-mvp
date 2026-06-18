-- DropForeignKey
ALTER TABLE "template_exercise_set_plans" DROP CONSTRAINT "template_exercise_set_plans_set_type_id_fkey";

-- DropForeignKey
ALTER TABLE "template_exercise_set_plans" DROP CONSTRAINT "template_exercise_set_plans_template_exercise_id_fkey";

-- AlterTable
ALTER TABLE "template_exercise_set_plans" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "template_exercise_set_plans" ADD CONSTRAINT "template_exercise_set_plans_template_exercise_id_fkey" FOREIGN KEY ("template_exercise_id") REFERENCES "template_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_exercise_set_plans" ADD CONSTRAINT "template_exercise_set_plans_set_type_id_fkey" FOREIGN KEY ("set_type_id") REFERENCES "set_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
