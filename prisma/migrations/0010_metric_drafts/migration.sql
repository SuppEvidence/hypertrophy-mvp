alter table "metric_logs"
  add column if not exists "is_draft" boolean not null default false;

create index if not exists "metric_logs_user_id_is_draft_logged_at_idx"
  on "metric_logs"("user_id", "is_draft", "logged_at");
