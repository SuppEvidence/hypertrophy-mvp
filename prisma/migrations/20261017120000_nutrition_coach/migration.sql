BEGIN;
CREATE TABLE "nutrition_states" (
 "user_id" UUID NOT NULL PRIMARY KEY, "revision" INTEGER NOT NULL DEFAULT 0,
 "baseline" JSONB NOT NULL, "draft" JSONB, "request_token" TEXT,
 "request_started_at" TIMESTAMP(3), "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "nutrition_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);
CREATE TABLE "nutrition_events" (
 "id" UUID NOT NULL PRIMARY KEY, "user_id" UUID NOT NULL, "kind" TEXT NOT NULL,
 "baseline" JSONB, "details" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "nutrition_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE
);
CREATE INDEX "nutrition_events_user_id_created_at_idx" ON "nutrition_events"("user_id", "created_at");
ALTER TABLE "nutrition_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nutrition_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "nutrition_states", "nutrition_events" FROM PUBLIC, anon, authenticated;
COMMIT;
