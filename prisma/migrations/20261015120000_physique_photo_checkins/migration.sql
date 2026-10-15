ALTER TABLE "user_settings"
 ADD COLUMN "physique_training_level" TEXT NOT NULL DEFAULT 'UNSPECIFIED',
 ADD COLUMN "physique_gain_weeks" INTEGER NOT NULL DEFAULT 10,
 ADD COLUMN "physique_maintenance_weeks" INTEGER NOT NULL DEFAULT 6,
 ADD COLUMN "physique_goal" VARCHAR(1200);
CREATE TABLE "physique_checkins" (
 "id" UUID NOT NULL, "user_id" UUID NOT NULL, "taken_on" DATE NOT NULL, "metric_log_id" UUID,
 "notes" VARCHAR(1600), "revision" INTEGER NOT NULL DEFAULT 0, "analysis_draft" JSONB, "accepted_analysis" JSONB,
 "analysis_token" UUID, "analysis_started_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "physique_checkins_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "physique_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE,
 CONSTRAINT "physique_checkins_metric_log_id_fkey" FOREIGN KEY ("metric_log_id") REFERENCES "metric_logs"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "physique_checkins_user_id_taken_on_key" ON "physique_checkins"("user_id", "taken_on");
CREATE INDEX "physique_checkins_user_id_metric_log_id_idx" ON "physique_checkins"("user_id", "metric_log_id");
CREATE INDEX "physique_checkins_metric_log_id_idx" ON "physique_checkins"("metric_log_id");
CREATE TABLE "physique_photos" (
 "id" UUID NOT NULL, "checkin_id" UUID NOT NULL, "user_id" UUID NOT NULL, "view" VARCHAR(30) NOT NULL,
 "object_path" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "physique_photos_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "physique_photos_checkin_id_fkey" FOREIGN KEY ("checkin_id") REFERENCES "physique_checkins"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "physique_photos_checkin_id_view_key" ON "physique_photos"("checkin_id", "view");
CREATE UNIQUE INDEX "physique_photos_object_path_key" ON "physique_photos"("object_path");
CREATE INDEX "physique_photos_user_id_checkin_id_idx" ON "physique_photos"("user_id", "checkin_id");
-- Table protection is explicit; app data access remains authenticated server-side Prisma.
ALTER TABLE "physique_checkins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "physique_photos" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "physique_checkins", "physique_photos" FROM PUBLIC, anon, authenticated;
CREATE POLICY "physique_checkin_owner" ON "physique_checkins" FOR ALL TO authenticated
 USING ((select auth.uid()) = user_id)
 WITH CHECK ((select auth.uid()) = user_id AND (metric_log_id IS NULL OR EXISTS (
  SELECT 1 FROM public.metric_logs m WHERE m.id = metric_log_id AND m.user_id = (select auth.uid()) AND m.is_draft = false
 )));
CREATE POLICY "physique_photo_owner" ON "physique_photos" FOR ALL TO authenticated
 USING ((select auth.uid()) = user_id)
 WITH CHECK ((select auth.uid()) = user_id AND EXISTS (
  SELECT 1 FROM public.physique_checkins c WHERE c.id = checkin_id AND c.user_id = (select auth.uid())
 ));
-- A private bucket, no service-role key, and user-prefix rules for Storage JWT access.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
 VALUES ('physique-checkins', 'physique-checkins', false, 1000000, ARRAY['image/jpeg'])
 ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 1000000, allowed_mime_types = ARRAY['image/jpeg'];
CREATE POLICY "physique_storage_owner" ON storage.objects FOR ALL TO authenticated
 USING (bucket_id = 'physique-checkins' AND (storage.foldername(name))[1] = (select auth.uid())::text)
 WITH CHECK (bucket_id = 'physique-checkins' AND (storage.foldername(name))[1] = (select auth.uid())::text);
-- Restrictive guard prevents an older broad permissive Storage policy exposing this bucket.
CREATE POLICY "physique_storage_isolation" ON storage.objects AS RESTRICTIVE FOR ALL TO public
 USING (bucket_id <> 'physique-checkins' OR (storage.foldername(name))[1] = (select auth.uid())::text)
 WITH CHECK (bucket_id <> 'physique-checkins' OR (storage.foldername(name))[1] = (select auth.uid())::text);
