-- Esegui dopo supabase/setup.sql. I membri restano in paste_state.data->'team':
-- nome = person[0], eventuale soprannome = person[6], nascita = person[3] (YYYY-MM-DD).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.paste_push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  person_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paste_push_deliveries (
  notification_date date primary key,
  names jsonb not null,
  sent_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.paste_push_subscriptions enable row level security;
alter table public.paste_push_deliveries enable row level security;
revoke all on public.paste_push_subscriptions from anon, authenticated;
revoke all on public.paste_push_deliveries from anon, authenticated;

-- Sostituisci soltanto i tre valori qui sotto prima di eseguire questa sezione.
-- Il CRON_SECRET non è una chiave Supabase: genera una stringa casuale lunga.
select vault.create_secret('https://hoawdjclpuxxjphvcamx.supabase.co', 'paste_project_url');
select vault.create_secret('INCOLLA_QUI_LA_PUBLISHABLE_KEY', 'paste_publishable_key');
select vault.create_secret('INCOLLA_QUI_IL_TUO_CRON_SECRET', 'paste_cron_secret');

-- 06:00 UTC: sempre mattina del giorno corretto in Europe/Rome, anche con ora legale.
select cron.unschedule(jobid) from cron.job where jobname = 'paste-birthday-push-daily';
select cron.schedule(
  'paste-birthday-push-daily',
  '0 6 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'paste_project_url') || '/functions/v1/birthday-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'paste_publishable_key'),
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'paste_cron_secret')
      ),
      body := '{"action":"run"}'::jsonb,
      timeout_milliseconds := 15000
    );
  $$
);
