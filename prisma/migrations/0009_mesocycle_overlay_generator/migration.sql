-- Mesocycle overlay controls and minimal workout prescription snapshot.
create table if not exists "mesocycle_muscle_volume_targets" (
  "id" uuid not null default gen_random_uuid(),
  "mesocycle_id" uuid not null,
  "muscle_id" uuid not null,
  "target_sets" decimal(5,2) not null default 0,
  "minimum_sets" decimal(5,2),
  "maximum_sets" decimal(5,2),
  "priority_level" integer not null default 0,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "mesocycle_muscle_volume_targets_pkey" primary key ("id"),
  constraint "mesocycle_muscle_volume_targets_mesocycle_id_fkey" foreign key ("mesocycle_id") references "program_mesocycles"("id") on delete cascade on update cascade,
  constraint "mesocycle_muscle_volume_targets_muscle_id_fkey" foreign key ("muscle_id") references "muscles"("id") on delete restrict on update cascade
);

create unique index if not exists "mesocycle_muscle_volume_targets_mesocycle_id_muscle_id_key"
  on "mesocycle_muscle_volume_targets"("mesocycle_id", "muscle_id");

create index if not exists "mesocycle_muscle_volume_targets_muscle_id_idx"
  on "mesocycle_muscle_volume_targets"("muscle_id");

create table if not exists "mesocycle_rep_policies" (
  "id" uuid not null default gen_random_uuid(),
  "mesocycle_id" uuid not null,
  "rep_bucket" text not null,
  "min_reps" integer not null,
  "max_reps" integer not null,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "mesocycle_rep_policies_pkey" primary key ("id"),
  constraint "mesocycle_rep_policies_mesocycle_id_fkey" foreign key ("mesocycle_id") references "program_mesocycles"("id") on delete cascade on update cascade
);

create unique index if not exists "mesocycle_rep_policies_mesocycle_id_rep_bucket_key"
  on "mesocycle_rep_policies"("mesocycle_id", "rep_bucket");

alter table "template_exercises"
  add column if not exists "min_sets" integer,
  add column if not exists "max_sets" integer,
  add column if not exists "slot_priority" text not null default 'STANDARD',
  add column if not exists "slot_role" text not null default 'ISOLATION',
  add column if not exists "rep_bucket" text not null default 'ISOLATION',
  add column if not exists "auto_adjustable" boolean not null default false;

alter table "workout_sessions"
  add column if not exists "mesocycle_id" uuid,
  add column if not exists "prescription_summary" jsonb;

alter table "workout_sessions"
  add constraint "workout_sessions_mesocycle_id_fkey"
  foreign key ("mesocycle_id") references "program_mesocycles"("id")
  on delete set null on update cascade;

create index if not exists "workout_sessions_mesocycle_id_idx"
  on "workout_sessions"("mesocycle_id");

alter table "workout_session_exercises"
  add column if not exists "base_planned_sets" integer,
  add column if not exists "prescribed_planned_sets" integer,
  add column if not exists "prescribed_min_reps" integer,
  add column if not exists "prescribed_max_reps" integer,
  add column if not exists "prescribed_rep_bucket" text,
  add column if not exists "prescription_note" text;

alter table "mesocycle_muscle_volume_targets" enable row level security;
alter table "mesocycle_rep_policies" enable row level security;
