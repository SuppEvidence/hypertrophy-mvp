import fs from "node:fs";
import path from "node:path";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
let schema = fs.readFileSync(schemaPath, "utf8");
let changed = false;

if (!schema.includes('painLocation')) {
  const marker = '  painNote                  String?  @map("pain_note")';
  if (!schema.includes(marker)) {
    throw new Error("Could not find WorkoutSessionExercise pain fields in prisma/schema.prisma");
  }
  schema = schema.replace(
    marker,
    `${marker}\n  painLocation              String?  @map("pain_location")\n  painSide                  String?  @map("pain_side")\n  painImpact                String?  @map("pain_impact")`,
  );
  changed = true;
}

if (!schema.includes('aiRecommendation      Json?')) {
  const marker = '  structureOverrides Json?     @map("structure_overrides")';
  if (!schema.includes(marker)) {
    throw new Error("Could not find ProgramMesocycle structureOverrides in prisma/schema.prisma");
  }
  schema = schema.replace(
    marker,
    `${marker}\n  aiRecommendation      Json?     @map("ai_recommendation")\n  aiRecommendationModel String?   @map("ai_recommendation_model")\n  aiRecommendedAt       DateTime? @map("ai_recommended_at")`,
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(schemaPath, schema, "utf8");
  console.log("Updated prisma/schema.prisma with exercise symptom context and mesocycle AI recommendation fields.");
} else {
  console.log("Schema already contains the required fields. No changes made.");
}
