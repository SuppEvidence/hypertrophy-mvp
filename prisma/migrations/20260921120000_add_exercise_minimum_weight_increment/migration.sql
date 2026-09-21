-- Smallest selectable change in the load value logged for an exercise.
-- Null means the equipment increment is unknown, so live coaching must not
-- automatically prescribe a different load.
ALTER TABLE "exercises"
ADD COLUMN "minimum_weight_increment" DECIMAL(7, 2);

ALTER TABLE "exercises"
ADD CONSTRAINT "exercises_minimum_weight_increment_positive"
CHECK ("minimum_weight_increment" IS NULL OR "minimum_weight_increment" > 0);
