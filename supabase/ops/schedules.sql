-- ============================================================================
-- ParmarPro scheduled jobs: pg_cron schedules and the app job caller.
-- ============================================================================
-- OPERATIONS FILE, NOT A MIGRATION. scripts/local-db/start.sh and CI never run
-- it. The owner runs it by hand in the Supabase SQL editor, once per environment
-- (local test stack, staging, production), after every migration in
-- supabase/migrations has been applied.
--
-- It is idempotent. A re-run replaces the parmarpro_* schedules and nothing
-- else, and the function is replaced in place.
--
-- ---------------------------------------------------------------------------
-- Step 1: create the Vault secrets. Do this OUTSIDE this file, once per
-- environment. Replace each <placeholder> with the real value and never commit
-- the real value anywhere.
--
--   select vault.create_secret('<https://your-app-url>', 'parmarpro_app_url');
--   select vault.create_secret('<CRON_SECRET>', 'parmarpro_cron_secret');
--   -- Optional, only for protected preview deployments (Vercel Deployment
--   -- Protection, "Protection Bypass for Automation"):
--   select vault.create_secret('<VERCEL_AUTOMATION_BYPASS_SECRET>', 'parmarpro_vercel_bypass');
--
-- parmarpro_app_url is the app's base URL with no trailing slash, for example
-- the staging or production domain. parmarpro_cron_secret must equal the
-- CRON_SECRET set in Vercel for the same environment.
--
-- To change a value later, update it instead of creating a second secret.
-- Rotate CRON_SECRET in Vercel and in Vault together: while they differ, every
-- job call is refused with 401.
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'parmarpro_cron_secret'),
--     '<NEW_CRON_SECRET>'
--   );
--
-- ---------------------------------------------------------------------------
-- Step 2: run this file. Then list the schedules:
--
--   select jobname, schedule, command from cron.job where jobname like 'parmarpro\_%' order by jobname;
--
-- ---------------------------------------------------------------------------
-- Inspect runs:
--
--   select * from cron.job_run_details order by start_time desc limit 20;  -- did pg_cron run each command, and did it error?
--   select * from net._http_response order by created desc limit 20;      -- HTTP status of each app job call
--
-- A job call can succeed in pg_cron and still fail in the app, so check both.
-- The app's own response is in net._http_response.
--
-- Times in the cron expressions are UTC. Each line also gives the IST time
-- (UTC+05:30).
-- ============================================================================

-- Extensions --------------------------------------------------------------------
-- pg_cron runs the schedules below. pg_net makes the HTTP calls to the app.
-- Vault stores the app URL and the secrets, encrypted at rest. It is enabled by
-- default on Supabase projects, so this is normally a no-op.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- The app job caller ------------------------------------------------------------
-- POSTs to <app URL>/api/jobs/<job> with the cron secret as a bearer token, and
-- returns the pg_net request id. The app's response is recorded in
-- net._http_response. Only the seven names in the allowlist are accepted, so an
-- unknown job raises before any request is sent. Runs as the owner (postgres),
-- which pg_cron uses; no other role may execute it.
create or replace function private.call_job(p_job text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app_url text;
  v_cron_secret text;
  v_bypass text;
  v_headers jsonb;
begin
  if p_job is null or p_job not in (
    'expire-invitations',
    'staff-digest',
    'weekly-summary',
    'patient-reminders',
    'founder-digest'
  ) then
    raise exception 'private.call_job: unknown job %', p_job;
  end if;

  select ds.decrypted_secret into v_app_url
    from vault.decrypted_secrets ds
   where ds.name = 'parmarpro_app_url';
  select ds.decrypted_secret into v_cron_secret
    from vault.decrypted_secrets ds
   where ds.name = 'parmarpro_cron_secret';
  select ds.decrypted_secret into v_bypass
    from vault.decrypted_secrets ds
   where ds.name = 'parmarpro_vercel_bypass';

  if coalesce(v_app_url, '') = '' then
    raise exception 'private.call_job: Vault secret parmarpro_app_url is missing (see supabase/ops/schedules.sql)';
  end if;
  if coalesce(v_cron_secret, '') = '' then
    raise exception 'private.call_job: Vault secret parmarpro_cron_secret is missing (see supabase/ops/schedules.sql)';
  end if;

  v_headers := jsonb_build_object(
    'authorization', 'Bearer ' || v_cron_secret,
    'content-type', 'application/json'
  );
  -- Only protected preview deployments need the bypass header. Production and
  -- unprotected environments simply do not store the optional secret.
  if coalesce(v_bypass, '') <> '' then
    v_headers := v_headers || jsonb_build_object('x-vercel-protection-bypass', v_bypass);
  end if;

  return net.http_post(
    url := rtrim(v_app_url, '/') || '/api/jobs/' || p_job,
    headers := v_headers,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke all on function private.call_job(text) from public, anon, authenticated, service_role;

-- Schedules ---------------------------------------------------------------------
-- Remove the previous parmarpro_* schedules, so a re-run leaves exactly one of
-- each.
select cron.unschedule(jobid) from cron.job where jobname like 'parmarpro\_%';

-- Direct database jobs (the functions do the work inside Postgres).
select cron.schedule('parmarpro_untouched_lead_tasks', '0 2 * * *', $$select private.job_untouched_lead_tasks()$$);  -- 07:30 IST daily
select cron.schedule('parmarpro_recall_tasks', '5 2 * * *', $$select private.job_recall_tasks()$$);  -- 07:35 IST daily

-- App jobs (the app's /api/jobs/<name> endpoints, through private.call_job).
select cron.schedule('parmarpro_staff_digest', '30 2 * * *', $$select private.call_job('staff-digest')$$);  -- 08:00 IST daily
select cron.schedule('parmarpro_weekly_summary', '45 3 * * 1', $$select private.call_job('weekly-summary')$$);  -- 09:15 IST Mondays
select cron.schedule('parmarpro_founder_digest', '0 4 * * *', $$select private.call_job('founder-digest')$$);  -- 09:30 IST daily
select cron.schedule('parmarpro_patient_reminders', '30 4 * * *', $$select private.call_job('patient-reminders')$$);  -- 10:00 IST daily
select cron.schedule('parmarpro_expire_invitations', '0 20 * * *', $$select private.call_job('expire-invitations')$$);  -- 01:30 IST daily

-- Retention deletes (the database function does the work).
select cron.schedule('parmarpro_cleanup', '0 21 * * 0', $$select private.job_cleanup()$$);  -- 02:30 IST Mondays (Sunday 21:00 UTC)

-- Check the result: one row per schedule.
select jobname, schedule, command from cron.job where jobname like 'parmarpro\_%' order by jobname;
