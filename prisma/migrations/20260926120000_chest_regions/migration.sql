BEGIN;

-- Preserve the legacy muscle ID for ambiguous exercises and historical blocks.
UPDATE "muscles" SET "name" = 'Chest (unclassified)', "updated_at" = now()
WHERE "slug" = 'chest' AND "name" = 'Chest';
UPDATE "muscles" SET "sort_order" = "sort_order" + 3, "updated_at" = now()
WHERE "sort_order" > (SELECT "sort_order" FROM "muscles" WHERE "slug" = 'chest');

INSERT INTO "muscles" ("id", "name", "slug", "sort_order", "created_at", "updated_at")
SELECT gen_random_uuid(), region.name, region.slug,
       COALESCE((SELECT "sort_order" FROM "muscles" WHERE "slug" = 'chest'), 0) + region.position,
       now(), now()
FROM (VALUES ('Upper chest', 'upper-chest', 1), ('Mid chest', 'mid-chest', 2),
             ('Lower chest', 'lower-chest', 3)) AS region(name, slug, position)
ON CONFLICT ("slug") DO NOTHING;

-- Only replace the old unclassified Chest link. Manually classified exercises remain unchanged.
INSERT INTO "exercise_primary_muscles" ("exercise_id", "muscle_id")
SELECT ep."exercise_id", region."id"
FROM "exercise_primary_muscles" ep
JOIN "muscles" old ON old."id" = ep."muscle_id" AND old."slug" = 'chest'
JOIN "exercises" e ON e."id" = ep."exercise_id"
JOIN "movement_groups" mg ON mg."id" = e."movement_group_id"
JOIN "muscles" region ON region."slug" = CASE
  WHEN mg."name" IN ('Incline press', 'Low-to-high chest fly/press') THEN 'upper-chest'
  WHEN mg."name" = 'Flat press' THEN 'mid-chest'
  WHEN mg."name" = 'Decline/dip press' THEN 'lower-chest'
  ELSE '' END
WHERE NOT EXISTS (
  SELECT 1 FROM "exercise_primary_muscles" existing
  JOIN "muscles" already ON already."id" = existing."muscle_id"
  WHERE existing."exercise_id" = ep."exercise_id"
    AND already."slug" IN ('upper-chest', 'mid-chest', 'lower-chest'))
ON CONFLICT DO NOTHING;

DELETE FROM "exercise_primary_muscles" ep
USING "exercises" e, "movement_groups" mg, "muscles" old
WHERE ep."exercise_id" = e."id" AND mg."id" = e."movement_group_id"
  AND ep."muscle_id" = old."id" AND old."slug" = 'chest'
  AND mg."name" IN ('Incline press', 'Low-to-high chest fly/press', 'Flat press', 'Decline/dip press');

-- Classify other exercises in these patterns as well unless a chest region was
-- deliberately assigned already. Chest fly and other ambiguous patterns stay manual.
INSERT INTO "exercise_primary_muscles" ("exercise_id", "muscle_id")
SELECT e."id", region."id"
FROM "exercises" e
JOIN "movement_groups" mg ON mg."id" = e."movement_group_id"
JOIN "muscles" region ON region."slug" = CASE
  WHEN mg."name" IN ('Incline press', 'Low-to-high chest fly/press') THEN 'upper-chest'
  WHEN mg."name" = 'Flat press' THEN 'mid-chest'
  WHEN mg."name" = 'Decline/dip press' THEN 'lower-chest'
  ELSE '' END
WHERE NOT EXISTS (
  SELECT 1 FROM "exercise_primary_muscles" existing
  JOIN "muscles" already ON already."id" = existing."muscle_id"
  WHERE existing."exercise_id" = e."id"
    AND already."slug" IN ('upper-chest', 'mid-chest', 'lower-chest'))
ON CONFLICT DO NOTHING;

DELETE FROM "exercise_secondary_muscles" es
USING "exercises" e, "movement_groups" mg, "muscles" old
WHERE es."exercise_id" = e."id" AND mg."id" = e."movement_group_id"
  AND es."muscle_id" = old."id" AND old."slug" = 'chest'
  AND mg."name" IN ('Incline press', 'Low-to-high chest fly/press', 'Flat press', 'Decline/dip press');

-- Program defaults and live block priorities previously used Chest as one unit.
-- Transfer their emphasis to Upper chest, the existing app's upper-chest focus.
INSERT INTO "program_priority_muscles" ("program_id", "muscle_id")
SELECT pp."program_id", region."id"
FROM "program_priority_muscles" pp
JOIN "muscles" old ON old."id" = pp."muscle_id" AND old."slug" = 'chest'
CROSS JOIN "muscles" region
WHERE region."slug" = 'upper-chest'
ON CONFLICT DO NOTHING;
DELETE FROM "program_priority_muscles" pp USING "muscles" old
WHERE pp."muscle_id" = old."id" AND old."slug" = 'chest';

-- Approximate the fraction of former total chest slots that are upper-chest slots.
-- Existing numeric targets are scaled only for transition; T3 can review actual work.
CREATE TEMP TABLE chest_region_doses ON COMMIT DROP AS
SELECT p."id" AS program_id,
       COALESCE(SUM(te."planned_sets" * wt."expected_occurrences") FILTER
         (WHERE mg."name" IN ('Incline press', 'Low-to-high chest fly/press')), 0) AS upper_sets,
       COALESCE(SUM(te."planned_sets" * wt."expected_occurrences") FILTER
         (WHERE mg."name" = 'Flat press'), 0) AS mid_sets,
       COALESCE(SUM(te."planned_sets" * wt."expected_occurrences") FILTER
         (WHERE mg."name" = 'Decline/dip press'), 0) AS lower_sets,
       COALESCE(SUM(te."planned_sets" * wt."expected_occurrences") FILTER
         (WHERE mg."name" = 'Chest fly'), 0) AS fly_sets,
       CASE p."volume_window_type"::text
         WHEN 'ROLLING_10D' THEN 10
         WHEN 'ROLLING_14D' THEN 14
         WHEN 'CUSTOM' THEN GREATEST(COALESCE(p."custom_window_days", 7), 1)
         ELSE 7 END AS window_days
FROM "programs" p
LEFT JOIN "workout_templates" wt ON wt."program_id" = p."id" AND wt."is_active" AND NOT wt."is_archived"
LEFT JOIN "template_exercises" te ON te."template_id" = wt."id"
LEFT JOIN "exercises" e ON e."id" = te."exercise_id"
LEFT JOIN "movement_groups" mg ON mg."id" = COALESCE(te."movement_group_id", e."movement_group_id")
GROUP BY p."id";

-- Preserve the old aggregate target in completed mesocycle history; active plans get the
-- upper-chest portion, with other regions starting at the slots already prescribed.
DELETE FROM "muscle_volume_targets" t USING "muscles" old
WHERE t."muscle_id" = old."id" AND old."slug" = 'chest'
  AND EXISTS (SELECT 1 FROM "muscle_volume_targets" existing
              JOIN "muscles" upper ON upper."id" = existing."muscle_id" AND upper."slug" = 'upper-chest'
              WHERE existing."program_id" = t."program_id");
UPDATE "muscle_volume_targets" t
SET "muscle_id" = upper."id",
    "weekly_target_sets" = ROUND(t."weekly_target_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "minimum_sets" = ROUND(t."minimum_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "maximum_sets" = ROUND(t."maximum_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "updated_at" = now()
FROM "muscles" old, "muscles" upper, chest_region_doses d
WHERE t."muscle_id" = old."id" AND old."slug" = 'chest'
  AND upper."slug" = 'upper-chest' AND d.program_id = t."program_id";

-- Active and future mesocycles switch to the three independent regions.
DELETE FROM "mesocycle_muscle_volume_targets" t
USING "program_mesocycles" pm, "muscles" old, "muscles" upper
WHERE t."mesocycle_id" = pm."id" AND t."muscle_id" = old."id" AND old."slug" = 'chest'
  AND pm."actual_end_date" IS NULL AND pm."start_date" + pm."length_weeks" * 7 > CURRENT_DATE
  AND upper."slug" = 'upper-chest' AND EXISTS (
    SELECT 1 FROM "mesocycle_muscle_volume_targets" x
    WHERE x."mesocycle_id" = pm."id" AND x."muscle_id" = upper."id");
UPDATE "mesocycle_muscle_volume_targets" t
SET "muscle_id" = upper."id",
    "target_sets" = ROUND(t."target_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "minimum_sets" = ROUND(t."minimum_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "maximum_sets" = ROUND(t."maximum_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "updated_at" = now()
FROM "program_mesocycles" pm, "muscles" old, "muscles" upper, chest_region_doses d
WHERE t."mesocycle_id" = pm."id" AND pm."program_id" = d.program_id
  AND pm."actual_end_date" IS NULL AND pm."start_date" + pm."length_weeks" * 7 > CURRENT_DATE
  AND t."muscle_id" = old."id" AND old."slug" = 'chest' AND upper."slug" = 'upper-chest';

UPDATE "mesocycle_muscle_priorities" upper_row
SET "priority" = old_row."priority", "coaching_status" = 'BASELINE',
    "confidence" = NULL, "rationale" = NULL, "evidence" = NULL, "last_evaluated_at" = NULL,
    "updated_at" = now()
FROM "mesocycle_muscle_priorities" old_row,
     "program_mesocycles" pm, "muscles" old, "muscles" upper
WHERE old_row."mesocycle_id" = upper_row."mesocycle_id"
  AND pm."id" = upper_row."mesocycle_id" AND pm."actual_end_date" IS NULL
  AND pm."start_date" + pm."length_weeks" * 7 > CURRENT_DATE
  AND old_row."muscle_id" = old."id" AND old."slug" = 'chest'
  AND upper_row."muscle_id" = upper."id" AND upper."slug" = 'upper-chest'
  AND (CASE old_row."priority"::text WHEN 'SPECIALIZE' THEN 3 WHEN 'GROW' THEN 2 WHEN 'MAINTAIN' THEN 1 ELSE 0 END) >
      (CASE upper_row."priority"::text WHEN 'SPECIALIZE' THEN 3 WHEN 'GROW' THEN 2 WHEN 'MAINTAIN' THEN 1 ELSE 0 END);

DELETE FROM "mesocycle_muscle_priorities" row
USING "program_mesocycles" pm, "muscles" old, "muscles" upper
WHERE row."mesocycle_id" = pm."id" AND row."muscle_id" = old."id" AND old."slug" = 'chest'
  AND pm."actual_end_date" IS NULL AND pm."start_date" + pm."length_weeks" * 7 > CURRENT_DATE
  AND upper."slug" = 'upper-chest' AND EXISTS (
    SELECT 1 FROM "mesocycle_muscle_priorities" x WHERE x."mesocycle_id" = pm."id" AND x."muscle_id" = upper."id");

UPDATE "mesocycle_muscle_priorities" row
SET "muscle_id" = upper."id",
    "baseline_weekly_sets" = ROUND(row."baseline_weekly_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "coach_target_weekly_sets" = ROUND(row."coach_target_weekly_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "range_minimum_sets" = ROUND(row."range_minimum_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "range_maximum_sets" = ROUND(row."range_maximum_sets" * d.upper_sets /
      GREATEST(d.upper_sets + d.mid_sets + d.lower_sets + d.fly_sets, 1), 2),
    "coaching_status" = 'BASELINE', "confidence" = NULL, "rationale" = NULL,
    "evidence" = NULL, "last_evaluated_at" = NULL, "updated_at" = now()
FROM "program_mesocycles" pm, "muscles" old, "muscles" upper, chest_region_doses d
WHERE row."mesocycle_id" = pm."id" AND pm."program_id" = d.program_id
  AND pm."actual_end_date" IS NULL AND pm."start_date" + pm."length_weeks" * 7 > CURRENT_DATE
  AND row."muscle_id" = old."id" AND old."slug" = 'chest' AND upper."slug" = 'upper-chest';

INSERT INTO "mesocycle_muscle_priorities"
  ("id", "mesocycle_id", "muscle_id", "priority", "baseline_weekly_sets", "coach_target_weekly_sets",
   "range_minimum_sets", "range_maximum_sets", "coaching_status", "activated_at", "created_at", "updated_at")
SELECT gen_random_uuid(), pm."id", muscle."id",
       (CASE WHEN dose.sets > 0 THEN 'MAINTAIN' ELSE 'INDIRECT_ONLY' END)::"MusclePriority",
       ROUND(dose.sets * 7 / d.window_days, 2), ROUND(dose.sets * 7 / d.window_days, 2),
       ROUND(GREATEST(dose.sets * 7 / d.window_days * 0.8, 0), 2),
       ROUND(dose.sets * 7 / d.window_days * 1.2, 2), 'BASELINE',
       COALESCE(pm."t3_activated_at", now()), now(), now()
FROM "program_mesocycles" pm
JOIN chest_region_doses d ON d.program_id = pm."program_id"
CROSS JOIN LATERAL (VALUES ('upper-chest', d.upper_sets), ('mid-chest', d.mid_sets),
                            ('lower-chest', d.lower_sets)) AS dose(slug, sets)
JOIN "muscles" muscle ON muscle."slug" = dose.slug
WHERE pm."t3_activated_at" IS NOT NULL AND pm."actual_end_date" IS NULL
  AND pm."start_date" + pm."length_weeks" * 7 > CURRENT_DATE
ON CONFLICT ("mesocycle_id", "muscle_id") DO NOTHING;

UPDATE "program_mesocycles" pm SET "t3_evaluation_status" = 'PENDING',
    "t3_assessment" = NULL, "t3_evaluation_error" = NULL, "t3_last_evaluated_at" = NULL,
    "ai_recommendation" = NULL, "ai_recommendation_model" = NULL, "ai_recommended_at" = NULL,
    "updated_at" = now()
WHERE pm."t3_activated_at" IS NOT NULL AND pm."actual_end_date" IS NULL
  AND pm."start_date" + pm."length_weeks" * 7 > CURRENT_DATE;
UPDATE "ai_programming_decisions" dec SET "status" = 'SUPERSEDED', "updated_at" = now()
WHERE dec."decision_type" = 'T3_MUSCLE_VOLUME' AND dec."status" = 'PENDING'
  AND EXISTS (SELECT 1 FROM "program_mesocycles" pm WHERE pm."id" = dec."mesocycle_id"
    AND pm."actual_end_date" IS NULL AND pm."start_date" + pm."length_weeks" * 7 > CURRENT_DATE);

COMMIT;
