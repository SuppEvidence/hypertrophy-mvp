CREATE TABLE "metric_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bodyweight" DECIMAL(7,2),
  "waist" DECIMAL(7,2),
  "sleep_duration" DECIMAL(4,2),
  "sleep_quality" INTEGER,
  "stress" INTEGER,
  "readiness" INTEGER,
  "manual_fatigue" INTEGER,
  "soreness_joint_irritation" INTEGER,
  "steps" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "metric_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "metric_logs_user_id_logged_at_idx" ON "metric_logs"("user_id", "logged_at");

ALTER TABLE "metric_logs" ADD CONSTRAINT "metric_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "metric_logs" ADD CONSTRAINT "metric_logs_sleep_quality_check" CHECK ("sleep_quality" IS NULL OR ("sleep_quality" >= 1 AND "sleep_quality" <= 5));
ALTER TABLE "metric_logs" ADD CONSTRAINT "metric_logs_stress_check" CHECK ("stress" IS NULL OR ("stress" >= 1 AND "stress" <= 5));
ALTER TABLE "metric_logs" ADD CONSTRAINT "metric_logs_readiness_check" CHECK ("readiness" IS NULL OR ("readiness" >= 1 AND "readiness" <= 5));
ALTER TABLE "metric_logs" ADD CONSTRAINT "metric_logs_manual_fatigue_check" CHECK ("manual_fatigue" IS NULL OR ("manual_fatigue" >= 1 AND "manual_fatigue" <= 5));
ALTER TABLE "metric_logs" ADD CONSTRAINT "metric_logs_soreness_joint_irritation_check" CHECK ("soreness_joint_irritation" IS NULL OR ("soreness_joint_irritation" >= 1 AND "soreness_joint_irritation" <= 5));
