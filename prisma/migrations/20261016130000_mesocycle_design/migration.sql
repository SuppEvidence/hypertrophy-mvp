BEGIN;
ALTER TABLE "program_mesocycles" ADD COLUMN "approved_design" JSONB;
CREATE TABLE "mesocycle_designs" (
 "id" UUID NOT NULL, "user_id" UUID NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0,
 "user_edited" BOOLEAN NOT NULL DEFAULT false,
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "brief" JSONB NOT NULL, "proposal" JSONB,
 "messages" JSONB NOT NULL, "evidence" JSONB, "model" TEXT, "request_token" TEXT,
 "request_started_at" TIMESTAMP(3), "approved_program_id" UUID, "approved_mesocycle_id" UUID,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "mesocycle_designs_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "mesocycle_designs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);
CREATE INDEX "mesocycle_designs_user_id_updated_at_idx" ON "mesocycle_designs"("user_id","updated_at");
-- Only the authenticated server-side owner connection accesses this table.
ALTER TABLE "mesocycle_designs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "mesocycle_designs" FROM PUBLIC, anon, authenticated;
COMMIT;
