-- Custom intensifiers/set types and lightweight mesocycle planning.
alter table "set_types" drop constraint if exists "set_types_name_key";
alter table "set_types" drop constraint if exists "set_types_slug_key";

alter table "set_types"
  add column if not exists "user_id" uuid,
  add column if not exists "is_active" boolean not null default true,
  add column if not exists "description" text;

alter table "set_types"
  add constraint "set_types_user_id_fkey"
  foreign key ("user_id") references "profiles"("id")
  on delete cascade on update cascade;

create unique index if not exists "set_types_user_id_slug_key"
  on "set_types"("user_id", "slug");

create unique index if not exists "set_types_builtin_slug_key"
  on "set_types"("slug")
  where "user_id" is null;

create index if not exists "set_types_user_id_is_active_idx"
  on "set_types"("user_id", "is_active");

create table if not exists "program_mesocycles" (
  "id" uuid not null default gen_random_uuid(),
  "user_id" uuid not null,
  "program_id" uuid not null,
  "name" text not null,
  "phase" "ProgramPhase" not null default 'PUSH',
  "start_date" date not null,
  "length_weeks" integer not null default 4,
  "notes" text,
  "is_archived" boolean not null default false,
  "created_at" timestamp(3) not null default current_timestamp,
  "updated_at" timestamp(3) not null,
  constraint "program_mesocycles_pkey" primary key ("id"),
  constraint "program_mesocycles_user_id_fkey" foreign key ("user_id") references "profiles"("id") on delete cascade on update cascade,
  constraint "program_mesocycles_program_id_fkey" foreign key ("program_id") references "programs"("id") on delete cascade on update cascade
);

create index if not exists "program_mesocycles_user_id_start_date_idx"
  on "program_mesocycles"("user_id", "start_date");

create index if not exists "program_mesocycles_program_id_start_date_idx"
  on "program_mesocycles"("program_id", "start_date");

alter table "program_mesocycles" enable row level security;
alter table "set_types" enable row level security;
