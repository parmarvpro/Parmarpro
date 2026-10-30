-- Operations counts (AI phase 3): the figures the founder's daily digest reports for
-- the last 24 hours, read in one call.
--
-- * public.ops_counts(p_since) returns a jsonb object with exactly eleven integer
--   keys (listed below). It holds counts only: no names, emails, ids, messages or
--   error text. The keys are the contract with src/lib/ops-counts.ts.
-- * Security definer, so it reads the tables without granting them. Service role
--   only: it is revoked from public, anon and authenticated.

create or replace function public.ops_counts(p_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ist_midnight timestamptz :=
    date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if p_since is null then
    raise exception 'p_since is required' using errcode = '22004';
  end if;

  return jsonb_build_object(
    -- Scheduled job runs since p_since, and those that failed. A dry run is not a real run.
    'job_runs', (
      select count(*) from public.job_runs r
       where not r.dry_run and r.created_at >= p_since
    ),
    'job_runs_failed', (
      select count(*) from public.job_runs r
       where not r.dry_run and r.created_at >= p_since and not r.ok
    ),
    -- Scheduled jobs with no successful, non-dry-run run since p_since.
    'jobs_not_run', (
      select count(*)
        from unnest(array[
          'reconcile-payments', 'expire-invitations', 'staff-digest', 'trial-renewal', 'patient-reminders'
        ]::text[]) as j(job)
       where not exists (
         select 1 from public.job_runs r
          where r.job = j.job and r.ok and not r.dry_run and r.created_at >= p_since
       )
    ),
    -- Emails that failed to send, and times the daily email budget stopped a send, as the jobs reported them.
    -- A result value that is not a number (a missing key, a boolean) counts as 0.
    'emails_failed', (
      select coalesce(sum((r.result->>'failed')::integer), 0) from public.job_runs r
       where not r.dry_run and r.created_at >= p_since and jsonb_typeof(r.result->'failed') = 'number'
    ),
    'email_budget_hits', (
      select coalesce(sum((r.result->>'budget_exhausted')::integer), 0) from public.job_runs r
       where not r.dry_run and r.created_at >= p_since and jsonb_typeof(r.result->'budget_exhausted') = 'number'
    ),
    -- Emails recorded as sent since midnight IST, across all clinics.
    'emails_sent_today', (
      select count(*) from public.notification_log n where n.created_at >= v_ist_midnight
    ),
    -- Provider webhooks that failed to process since p_since.
    'webhooks_failed', (
      select count(*) from public.webhook_events w
       where w.status = 'failed' and w.received_at >= p_since
    ),
    -- Orders still unpaid an hour after they were created. Not limited to p_since.
    'orders_unpaid_over_1h', (
      select count(*) from public.billing_orders o
       where o.status = 'created' and o.created_at < now() - interval '1 hour'
    ),
    -- AI calls since p_since, and the ones that failed or were rate limited.
    'ai_calls', (
      select count(*) from public.ai_calls c where c.created_at >= p_since
    ),
    'ai_calls_failed', (
      select count(*) from public.ai_calls c
       where c.created_at >= p_since and c.status in ('failed', 'invalid_output')
    ),
    'ai_calls_rate_limited', (
      select count(*) from public.ai_calls c
       where c.created_at >= p_since and c.status = 'rate_limited'
    )
  );
end;
$$;

revoke all on function public.ops_counts(timestamptz) from public, anon, authenticated;
grant execute on function public.ops_counts(timestamptz) to service_role;
