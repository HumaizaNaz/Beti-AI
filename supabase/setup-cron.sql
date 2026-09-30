-- Beti AI — scheduled jobs. Run in the Supabase SQL editor AFTER the app is deployed.
-- Before running, replace the two values in the first statement:
--   https://YOUR-APP.vercel.app  → your deployed URL (no trailing slash)
--   YOUR_CRON_SECRET             → the same value as CRON_SECRET in Vercel
create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;
create table if not exists private.app_config (key text primary key, value text not null);
revoke all on schema private from anon, authenticated;

insert into private.app_config (key, value) values
  ('cron_url', 'https://YOUR-APP.vercel.app/api/cron/deadlines'),
  ('cron_secret', 'YOUR_CRON_SECRET')
on conflict (key) do update set value = excluded.value;

-- Every minute: expire overdue trips (Dead-Man's Switch) and retry failed alert deliveries.
select cron.schedule(
  'beti-deadlines',
  '* * * * *',
  $$
  select net.http_post(
    url := (select value from private.app_config where key = 'cron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value from private.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);

-- Daily 03:00 UTC: delete old locations (30 days normal trips, 90 days trips that had an alert).
select cron.schedule(
  'beti-retention',
  '0 3 * * *',
  $$
  delete from public.locations l
  using public.trips t
  where l.trip_id = t.id
    and l.recorded_at < now() - case
      when exists (select 1 from public.alerts a where a.trip_id = t.id) then interval '90 days'
      else interval '30 days'
    end;
  $$
);

-- Check: select jobname, schedule from cron.job;
-- Recent runs: select * from cron.job_run_details order by start_time desc limit 10;
-- HTTP results: select status_code, content from net._http_response order by created desc limit 10;
