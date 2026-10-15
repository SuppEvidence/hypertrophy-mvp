-- Read-only verification after deploying the physique migration in Supabase SQL Editor.
SELECT 'check-in table RLS' AS check_name,
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid='public.physique_checkins'::regclass),false) AS passed
UNION ALL SELECT 'photo table RLS',
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid='public.physique_photos'::regclass),false)
UNION ALL SELECT 'private photo bucket',
  COALESCE((SELECT NOT public AND file_size_limit=1000000 FROM storage.buckets WHERE id='physique-checkins'),false)
UNION ALL SELECT 'no anonymous metadata API read',
  NOT has_table_privilege('anon','public.physique_checkins','SELECT') AND NOT has_table_privilege('anon','public.physique_photos','SELECT')
UNION ALL SELECT 'no authenticated metadata API read',
  NOT has_table_privilege('authenticated','public.physique_checkins','SELECT') AND NOT has_table_privilege('authenticated','public.physique_photos','SELECT')
UNION ALL SELECT 'owner-only Storage policy installed',
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='physique_storage_owner')
UNION ALL SELECT 'restrictive Storage isolation installed',
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='physique_storage_isolation' AND permissive='RESTRICTIVE');
