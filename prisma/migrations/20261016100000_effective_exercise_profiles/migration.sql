BEGIN;
ALTER TABLE exercise_coaching_profiles ADD COLUMN applied_classification JSONB,
  ADD COLUMN classification_synced_revision INTEGER NOT NULL DEFAULT -1;
ALTER TABLE workout_session_exercises ADD COLUMN muscle_snapshot JSONB;

-- Baseline links are retained for unassessed exercises and historical reconstruction.
CREATE FUNCTION exercise_catalog_classification(target_id UUID) RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
 SELECT jsonb_build_object('version',1,'source','CATALOG','primary',
   COALESCE((SELECT jsonb_agg(jsonb_build_object('muscleId',muscle_id) ORDER BY muscle_id) FROM exercise_primary_muscles WHERE exercise_id=target_id),'[]'::jsonb),
   'secondary',COALESCE((SELECT jsonb_agg(jsonb_build_object('muscleId',muscle_id,'contributionEstimate',contribution_estimate) ORDER BY muscle_id) FROM exercise_secondary_muscles WHERE exercise_id=target_id),'[]'::jsonb),
   'profile',NULL,'issues','[]'::jsonb);
$$;

-- Existing sessions used the old mapping. Do not reinterpret them using later analyses.
UPDATE workout_session_exercises SET muscle_snapshot=exercise_catalog_classification(exercise_id);

CREATE FUNCTION capture_exercise_classification() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE owner_id UUID; applied JSONB; source_basis JSONB; current_basis JSONB; setup TEXT;
BEGIN
 IF TG_OP='UPDATE' AND NEW.exercise_id=OLD.exercise_id AND NEW.session_id=OLD.session_id THEN
   NEW.muscle_snapshot := OLD.muscle_snapshot;
   RETURN NEW;
 END IF;
 SELECT user_id INTO owner_id FROM workout_sessions WHERE id=NEW.session_id;
 SELECT applied_classification, execution_setup INTO applied,setup FROM exercise_coaching_profiles
   WHERE user_id=owner_id AND exercise_id=NEW.exercise_id;
 IF applied IS NOT NULL AND applied->>'basis' IS NOT NULL THEN
   source_basis := (applied->>'basis')::jsonb;
   SELECT jsonb_build_object('name',e.name,'setup',e.setup_notes,'movement',e.movement_group_id,
     'primary',COALESCE((SELECT jsonb_agg(muscle_id ORDER BY muscle_id) FROM exercise_primary_muscles WHERE exercise_id=e.id),'[]'::jsonb),
     'secondary',COALESCE((SELECT jsonb_agg(muscle_id ORDER BY muscle_id) FROM exercise_secondary_muscles WHERE exercise_id=e.id),'[]'::jsonb),
     'executionSetup',setup) INTO current_basis FROM exercises e WHERE e.id=NEW.exercise_id;
 END IF;
 NEW.muscle_snapshot := CASE WHEN applied->>'version'='1' AND source_basis=current_basis
   THEN applied ELSE exercise_catalog_classification(NEW.exercise_id) END;
 RETURN NEW;
END $$;
CREATE TRIGGER workout_exercise_classification_snapshot
BEFORE INSERT OR UPDATE ON workout_session_exercises
FOR EACH ROW EXECUTE FUNCTION capture_exercise_classification();
-- Internal routines are not public RPC endpoints. Existing table RLS remains in effect.
REVOKE ALL ON FUNCTION exercise_catalog_classification(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION capture_exercise_classification() FROM PUBLIC;
COMMIT;
