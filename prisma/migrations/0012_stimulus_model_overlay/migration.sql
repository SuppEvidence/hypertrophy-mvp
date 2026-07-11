-- Shift logging toward hypertrophy stimulus while preserving detailed set logs.

do $$ begin
  create type "RepRangeStatus" as enum ('IN_RANGE', 'TOO_LOW', 'TOO_HIGH', 'MIXED', 'NOT_LOGGED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type "EffortStatus" as enum ('TOO_EASY', 'PRODUCTIVE', 'VERY_HARD', 'FAILURE', 'NOT_SURE');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type "MetricLogType" as enum ('DAILY', 'MESOCYCLE_START', 'MESOCYCLE_END', 'OPTIONAL_CHECKIN');
exception when duplicate_object then null;
end $$;

alter table "workout_session_exercises"
  add column if not exists "completed_sets" integer,
  add column if not exists "stimulus_set_type_id" uuid,
  add column if not exists "rep_range_status" "RepRangeStatus" not null default 'NOT_LOGGED',
  add column if not exists "effort_status" "EffortStatus" not null default 'PRODUCTIVE';

do $$ begin
  alter table "workout_session_exercises"
    add constraint "workout_session_exercises_stimulus_set_type_id_fkey"
    foreign key ("stimulus_set_type_id") references "set_types"("id")
    on delete restrict on update cascade;
exception when duplicate_object then null;
end $$;

create index if not exists "workout_session_exercises_stimulus_set_type_id_idx"
  on "workout_session_exercises"("stimulus_set_type_id");

create table if not exists "mesocycle_movement_rep_policies" (
  "id" uuid not null default gen_random_uuid(),
  "mesocycle_id" uuid not null,
  "movement_group_id" uuid not null,
  "min_reps" integer not null,
  "max_reps" integer not null,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "mesocycle_movement_rep_policies_pkey" primary key ("id"),
  constraint "mesocycle_movement_rep_policies_mesocycle_id_fkey" foreign key ("mesocycle_id") references "program_mesocycles"("id") on delete cascade on update cascade,
  constraint "mesocycle_movement_rep_policies_movement_group_id_fkey" foreign key ("movement_group_id") references "movement_groups"("id") on delete restrict on update cascade
);

create unique index if not exists "mesocycle_movement_rep_policies_mesocycle_id_movement_group_id_key"
  on "mesocycle_movement_rep_policies"("mesocycle_id", "movement_group_id");

create index if not exists "mesocycle_movement_rep_policies_movement_group_id_idx"
  on "mesocycle_movement_rep_policies"("movement_group_id");

create table if not exists "mesocycle_movement_volume_targets" (
  "id" uuid not null default gen_random_uuid(),
  "mesocycle_id" uuid not null,
  "movement_group_id" uuid not null,
  "target_sets" decimal(5,2) not null default 0,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "mesocycle_movement_volume_targets_pkey" primary key ("id"),
  constraint "mesocycle_movement_volume_targets_mesocycle_id_fkey" foreign key ("mesocycle_id") references "program_mesocycles"("id") on delete cascade on update cascade,
  constraint "mesocycle_movement_volume_targets_movement_group_id_fkey" foreign key ("movement_group_id") references "movement_groups"("id") on delete restrict on update cascade
);

create unique index if not exists "mesocycle_movement_volume_targets_mesocycle_id_movement_group_id_key"
  on "mesocycle_movement_volume_targets"("mesocycle_id", "movement_group_id");

create index if not exists "mesocycle_movement_volume_targets_movement_group_id_idx"
  on "mesocycle_movement_volume_targets"("movement_group_id");

alter table "metric_logs"
  add column if not exists "log_type" "MetricLogType" not null default 'DAILY',
  add column if not exists "chest" decimal(7,2),
  add column if not exists "shoulders" decimal(7,2),
  add column if not exists "arms" decimal(7,2),
  add column if not exists "thighs" decimal(7,2),
  add column if not exists "glutes" decimal(7,2),
  add column if not exists "calves" decimal(7,2);

create index if not exists "metric_logs_user_id_log_type_logged_at_idx"
  on "metric_logs"("user_id", "log_type", "logged_at");

alter table "mesocycle_movement_rep_policies" enable row level security;
alter table "mesocycle_movement_volume_targets" enable row level security;
