ALTER TABLE "programs" ADD COLUMN IF NOT EXISTS "weekly_plan" JSONB;

DO $$
DECLARE
  vertical_legacy_id uuid;
  vertical_lat_id uuid;
  vertical_upper_id uuid;
  horizontal_legacy_id uuid;
  horizontal_lat_id uuid;
  horizontal_upper_id uuid;
  upper_back_row_id uuid;
  lats_id uuid;
  upper_back_id uuid;
  next_sort integer;
BEGIN
  SELECT id INTO lats_id FROM "muscles" WHERE slug = 'lats' LIMIT 1;
  SELECT id INTO upper_back_id FROM "muscles" WHERE slug = 'upper-back' LIMIT 1;
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO next_sort FROM "movement_groups";

  SELECT id INTO vertical_legacy_id
  FROM "movement_groups"
  WHERE name = 'Vertical pull' OR slug = 'vertical-pull'
  ORDER BY CASE WHEN name = 'Vertical pull' THEN 0 ELSE 1 END
  LIMIT 1;

  IF vertical_legacy_id IS NOT NULL THEN
    UPDATE "movement_groups"
    SET name = 'Vertical pull (Lat bias)', slug = 'vertical-pull-lat-bias', updated_at = now()
    WHERE id = vertical_legacy_id;
    vertical_lat_id := vertical_legacy_id;
  ELSE
    SELECT id INTO vertical_lat_id FROM "movement_groups" WHERE name = 'Vertical pull (Lat bias)' LIMIT 1;
    IF vertical_lat_id IS NULL THEN
      INSERT INTO "movement_groups" (id, name, slug, sort_order, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Vertical pull (Lat bias)', 'vertical-pull-lat-bias', next_sort, now(), now())
      RETURNING id INTO vertical_lat_id;
      next_sort := next_sort + 1;
    END IF;
  END IF;

  SELECT id INTO vertical_upper_id FROM "movement_groups" WHERE name = 'Vertical pull (Upper back bias)' LIMIT 1;
  IF vertical_upper_id IS NULL THEN
    INSERT INTO "movement_groups" (id, name, slug, sort_order, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Vertical pull (Upper back bias)', 'vertical-pull-upper-back-bias', next_sort, now(), now())
    RETURNING id INTO vertical_upper_id;
    next_sort := next_sort + 1;
  END IF;

  SELECT id INTO horizontal_legacy_id
  FROM "movement_groups"
  WHERE name = 'Horizontal pull' OR slug = 'horizontal-pull'
  ORDER BY CASE WHEN name = 'Horizontal pull' THEN 0 ELSE 1 END
  LIMIT 1;

  IF horizontal_legacy_id IS NOT NULL THEN
    UPDATE "movement_groups"
    SET name = 'Horizontal pull (Upper back bias)', slug = 'horizontal-pull-upper-back-bias', updated_at = now()
    WHERE id = horizontal_legacy_id;
    horizontal_upper_id := horizontal_legacy_id;
  ELSE
    SELECT id INTO horizontal_upper_id FROM "movement_groups" WHERE name = 'Horizontal pull (Upper back bias)' LIMIT 1;
    IF horizontal_upper_id IS NULL THEN
      INSERT INTO "movement_groups" (id, name, slug, sort_order, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Horizontal pull (Upper back bias)', 'horizontal-pull-upper-back-bias', next_sort, now(), now())
      RETURNING id INTO horizontal_upper_id;
      next_sort := next_sort + 1;
    END IF;
  END IF;

  SELECT id INTO horizontal_lat_id FROM "movement_groups" WHERE name = 'Horizontal pull (Lat bias)' LIMIT 1;
  IF horizontal_lat_id IS NULL THEN
    INSERT INTO "movement_groups" (id, name, slug, sort_order, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Horizontal pull (Lat bias)', 'horizontal-pull-lat-bias', next_sort, now(), now())
    RETURNING id INTO horizontal_lat_id;
    next_sort := next_sort + 1;
  END IF;

  -- Keep the paired bias options adjacent in movement-pattern selectors.
  IF vertical_lat_id IS NOT NULL AND vertical_upper_id IS NOT NULL THEN
    UPDATE "movement_groups"
    SET sort_order = (SELECT sort_order FROM "movement_groups" WHERE id = vertical_lat_id), updated_at = now()
    WHERE id = vertical_upper_id;
  END IF;

  IF horizontal_upper_id IS NOT NULL AND horizontal_lat_id IS NOT NULL THEN
    UPDATE "movement_groups"
    SET sort_order = (SELECT sort_order FROM "movement_groups" WHERE id = horizontal_upper_id), updated_at = now()
    WHERE id = horizontal_lat_id;
  END IF;

  -- Move clearly upper-back-primary vertical pulls into the new upper-back-biased group.
  IF vertical_lat_id IS NOT NULL AND vertical_upper_id IS NOT NULL AND upper_back_id IS NOT NULL THEN
    UPDATE "exercises" e
    SET movement_group_id = vertical_upper_id, updated_at = now()
    WHERE e.movement_group_id = vertical_lat_id
      AND EXISTS (
        SELECT 1 FROM "exercise_primary_muscles" epm
        WHERE epm.exercise_id = e.id AND epm.muscle_id = upper_back_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM "exercise_primary_muscles" epm
        WHERE epm.exercise_id = e.id AND epm.muscle_id = lats_id
      );
  END IF;

  -- Move clearly lat-primary horizontal pulls into the new lat-biased group.
  IF horizontal_upper_id IS NOT NULL AND horizontal_lat_id IS NOT NULL AND lats_id IS NOT NULL THEN
    UPDATE "exercises" e
    SET movement_group_id = horizontal_lat_id, updated_at = now()
    WHERE e.movement_group_id = horizontal_upper_id
      AND EXISTS (
        SELECT 1 FROM "exercise_primary_muscles" epm
        WHERE epm.exercise_id = e.id AND epm.muscle_id = lats_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM "exercise_primary_muscles" epm
        WHERE epm.exercise_id = e.id AND epm.muscle_id = upper_back_id
      );
  END IF;

  -- Merge the older Upper-back row category into Horizontal pull (Upper back bias).
  SELECT id INTO upper_back_row_id
  FROM "movement_groups"
  WHERE name = 'Upper-back row' OR slug = 'upper-back-row'
  LIMIT 1;

  IF upper_back_row_id IS NOT NULL AND horizontal_upper_id IS NOT NULL AND upper_back_row_id <> horizontal_upper_id THEN
    UPDATE "exercises"
    SET movement_group_id = horizontal_upper_id, updated_at = now()
    WHERE movement_group_id = upper_back_row_id;

    UPDATE "template_exercises"
    SET movement_group_id = horizontal_upper_id, updated_at = now()
    WHERE movement_group_id = upper_back_row_id;

    INSERT INTO "mesocycle_movement_rep_policies" (
      id, mesocycle_id, movement_group_id, min_reps, max_reps, created_at, updated_at
    )
    SELECT gen_random_uuid(), mesocycle_id, horizontal_upper_id, min_reps, max_reps, created_at, now()
    FROM "mesocycle_movement_rep_policies"
    WHERE movement_group_id = upper_back_row_id
    ON CONFLICT (mesocycle_id, movement_group_id) DO NOTHING;

    DELETE FROM "mesocycle_movement_rep_policies" WHERE movement_group_id = upper_back_row_id;

    INSERT INTO "mesocycle_movement_volume_targets" (
      id, mesocycle_id, movement_group_id, target_sets, created_at, updated_at
    )
    SELECT gen_random_uuid(), mesocycle_id, horizontal_upper_id, target_sets, created_at, now()
    FROM "mesocycle_movement_volume_targets"
    WHERE movement_group_id = upper_back_row_id
    ON CONFLICT (mesocycle_id, movement_group_id)
    DO UPDATE SET target_sets = GREATEST(
      "mesocycle_movement_volume_targets".target_sets,
      EXCLUDED.target_sets
    ), updated_at = now();

    DELETE FROM "mesocycle_movement_volume_targets" WHERE movement_group_id = upper_back_row_id;
    DELETE FROM "movement_groups" WHERE id = upper_back_row_id;
  END IF;

  -- Keep existing template slots aligned with their compatibility exercise after reclassification.
  UPDATE "template_exercises" te
  SET movement_group_id = e.movement_group_id, updated_at = now()
  FROM "exercises" e
  WHERE te.exercise_id = e.id
    AND te.movement_group_id IS DISTINCT FROM e.movement_group_id
    AND te.movement_group_id IN (
      vertical_lat_id,
      vertical_upper_id,
      horizontal_upper_id,
      horizontal_lat_id
    );
END $$;
