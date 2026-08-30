import fs from "node:fs";
import path from "node:path";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const current = fs.readFileSync(schemaPath, "utf8");

if (current.includes("model AiProgrammingDecision {")) {
  console.log("AiProgrammingDecision already exists in prisma/schema.prisma");
  process.exit(0);
}

const addition = `

model AiProgrammingDecision {
  id                    String   @id @default(uuid()) @db.Uuid
  userId                String   @db.Uuid @map("user_id")
  generationId          String   @db.Uuid @map("generation_id")
  mesocycleId           String?  @db.Uuid @map("mesocycle_id")
  policyVersion         String   @map("policy_version")
  model                 String
  decisionType          String   @map("decision_type")
  targetMuscleId        String   @db.Uuid @map("target_muscle_id")
  targetMuscleName      String   @map("target_muscle_name")
  decisionSummary       String   @map("decision_summary")
  confidence            String
  evidence              Json
  options               Json
  recommendedOptionKey  String   @map("recommended_option_key")
  keepAsIsRationale     String   @map("keep_as_is_rationale")
  selectedOptionKey     String?  @map("selected_option_key")
  selectionReason       String?  @map("selection_reason")
  status                String   @default("PENDING")
  context               Json
  outcome               Json?
  selectedAt            DateTime? @map("selected_at")
  outcomeEvaluatedAt    DateTime? @map("outcome_evaluated_at")
  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@index([userId, createdAt])
  @@index([userId, status, createdAt])
  @@index([generationId])
  @@index([mesocycleId])
  @@index([targetMuscleId, createdAt])
  @@map("ai_programming_decisions")
}
`;

fs.writeFileSync(schemaPath, `${current.trimEnd()}${addition}\n`);
console.log("Added AiProgrammingDecision to prisma/schema.prisma");
