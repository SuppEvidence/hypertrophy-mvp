alter table programs
  add column if not exists rotation_sequence jsonb;
