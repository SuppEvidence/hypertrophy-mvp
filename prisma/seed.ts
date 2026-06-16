import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { Pool } from "pg";
import {
  defaultExercises,
  defaultMovementGroups,
  defaultMuscles,
  defaultSetTypes,
  slugify,
} from "../lib/data/seedCatalog";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run prisma/seed.ts");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const [index, name] of defaultMuscles.entries()) {
    await prisma.muscle.upsert({
      where: { slug: slugify(name) },
      update: { name, sortOrder: index + 1 },
      create: { name, slug: slugify(name), sortOrder: index + 1 },
    });
  }

  for (const [index, name] of defaultMovementGroups.entries()) {
    await prisma.movementGroup.upsert({
      where: { slug: slugify(name) },
      update: { name, sortOrder: index + 1 },
      create: { name, slug: slugify(name), sortOrder: index + 1 },
    });
  }

  for (const [index, setType] of defaultSetTypes.entries()) {
    await prisma.setType.upsert({
      where: { slug: slugify(setType.name) },
      update: {
        name: setType.name,
        multiplier: setType.multiplier,
        isIntensifier: setType.isIntensifier,
        isEditable: setType.isEditable,
        sortOrder: index + 1,
      },
      create: {
        name: setType.name,
        slug: slugify(setType.name),
        multiplier: setType.multiplier,
        isIntensifier: setType.isIntensifier,
        isEditable: setType.isEditable,
        sortOrder: index + 1,
      },
    });
  }

  const muscles = await prisma.muscle.findMany();
  const movementGroups = await prisma.movementGroup.findMany();
  const muscleByName = new Map(muscles.map((muscle) => [muscle.name, muscle.id]));
  const movementByName = new Map(movementGroups.map((movement) => [movement.name, movement.id]));

  for (const exercise of defaultExercises) {
    const movementGroupId = movementByName.get(exercise.movementGroup);
    if (!movementGroupId) throw new Error(`Missing movement group: ${exercise.movementGroup}`);

    const catalogKey = `seed:${slugify(exercise.name)}`;
    const saved = await prisma.exercise.upsert({
      where: { catalogKey },
      update: {
        name: exercise.name,
        movementGroupId,
        defaultMinReps: exercise.defaultMinReps,
        defaultMaxReps: exercise.defaultMaxReps,
        tags: exercise.tags,
        isSeed: true,
        isActive: true,
        isArchived: false,
      },
      create: {
        name: exercise.name,
        slug: slugify(exercise.name),
        catalogKey,
        movementGroupId,
        defaultMinReps: exercise.defaultMinReps,
        defaultMaxReps: exercise.defaultMaxReps,
        tags: exercise.tags,
        isSeed: true,
      },
    });

    await prisma.exercisePrimaryMuscle.deleteMany({ where: { exerciseId: saved.id } });
    await prisma.exerciseSecondaryMuscle.deleteMany({ where: { exerciseId: saved.id } });

    for (const muscleName of exercise.primary) {
      const muscleId = muscleByName.get(muscleName);
      if (!muscleId) throw new Error(`Missing primary muscle: ${muscleName}`);
      await prisma.exercisePrimaryMuscle.create({ data: { exerciseId: saved.id, muscleId } });
    }

    for (const muscleName of exercise.secondary) {
      const muscleId = muscleByName.get(muscleName);
      if (!muscleId) throw new Error(`Missing secondary muscle: ${muscleName}`);
      await prisma.exerciseSecondaryMuscle.create({ data: { exerciseId: saved.id, muscleId } });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
