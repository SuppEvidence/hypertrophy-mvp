-- DropIndex
DROP INDEX "set_types_name_key";

-- DropIndex
DROP INDEX "set_types_slug_key";

-- AlterTable
ALTER TABLE "program_mesocycles" ALTER COLUMN "id" DROP DEFAULT;
