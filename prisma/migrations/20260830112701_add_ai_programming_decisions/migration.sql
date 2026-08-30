-- CreateTable
CREATE TABLE "ai_programming_decisions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "generation_id" UUID NOT NULL,
    "mesocycle_id" UUID,
    "policy_version" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "decision_type" TEXT NOT NULL,
    "target_muscle_id" UUID NOT NULL,
    "target_muscle_name" TEXT NOT NULL,
    "decision_summary" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "options" JSONB NOT NULL,
    "recommended_option_key" TEXT NOT NULL,
    "keep_as_is_rationale" TEXT NOT NULL,
    "selected_option_key" TEXT,
    "selection_reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "context" JSONB NOT NULL,
    "outcome" JSONB,
    "selected_at" TIMESTAMP(3),
    "outcome_evaluated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_programming_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_programming_decisions_user_id_created_at_idx" ON "ai_programming_decisions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_programming_decisions_user_id_status_created_at_idx" ON "ai_programming_decisions"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "ai_programming_decisions_generation_id_idx" ON "ai_programming_decisions"("generation_id");

-- CreateIndex
CREATE INDEX "ai_programming_decisions_mesocycle_id_idx" ON "ai_programming_decisions"("mesocycle_id");

-- CreateIndex
CREATE INDEX "ai_programming_decisions_target_muscle_id_created_at_idx" ON "ai_programming_decisions"("target_muscle_id", "created_at");
