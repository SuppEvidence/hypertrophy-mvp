-- Add explicit movement-pattern slot intent to template exercise rows.
-- Existing exercise_id remains as a compatibility/default placeholder.
alter table "template_exercises"
  add column if not exists "movement_group_id" uuid;

update "template_exercises" te
set "movement_group_id" = e."movement_group_id"
from "exercises" e
where te."exercise_id" = e."id"
  and te."movement_group_id" is null;

alter table "template_exercises"
  add constraint "template_exercises_movement_group_id_fkey"
  foreign key ("movement_group_id") references "movement_groups"("id")
  on delete restrict on update cascade;

create index if not exists "template_exercises_movement_group_id_idx"
  on "template_exercises"("movement_group_id");
