-- Add per-set planning for template exercises so planned effective volume can use mixed set types.
create table if not exists public.template_exercise_set_plans (
  id uuid primary key default gen_random_uuid(),
  template_exercise_id uuid not null references public.template_exercises(id) on delete cascade,
  set_number integer not null,
  set_type_id uuid not null references public.set_types(id) on delete restrict,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null default current_timestamp,
  constraint template_exercise_set_plans_template_exercise_id_set_number_key unique (template_exercise_id, set_number)
);

create index if not exists template_exercise_set_plans_set_type_id_idx
  on public.template_exercise_set_plans(set_type_id);

insert into public.template_exercise_set_plans (template_exercise_id, set_number, set_type_id)
select
  te.id,
  generated_set.set_number,
  te.default_set_type_id
from public.template_exercises te
cross join lateral generate_series(1, greatest(te.planned_sets, 1)) as generated_set(set_number)
on conflict (template_exercise_id, set_number) do nothing;

alter table public.template_exercise_set_plans enable row level security;
