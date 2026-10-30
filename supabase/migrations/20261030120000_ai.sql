-- AI (phase 1): model limits and the call log, the job run log, per-lead triage
-- and the enquiry-help setting.
--
-- * ai_model_limits: quotas per lane (free or paid key) and model. Service role
--   only. Seeded with deliberately LOW placeholder values.
-- * ai_calls: one row per model call. ai_reserve() inserts it before the call and
--   ai_settle() records the outcome. Service role only. Counts and statuses only:
--   no prompt, input or output text is ever stored.
-- * job_runs: one row per scheduled job run, with counts only. Service role only.
-- * lead_ai_triage: the AI's triage of one lead. Clinic data under RLS, like leads.
-- * clinic_automation_settings.ai_enquiry_help: owners and admins switch on AI
--   help with enquiries (sorting and reply drafts). Off by default.

-- Model limits -----------------------------------------------------------------------

-- Quotas per lane and model. Service role only: the server reads them through
-- ai_reserve(). The seeded values are deliberately low, so nothing is sent with
-- the wrong quota. The owner replaces each row with the real numbers shown in
-- Google AI Studio for each project (see docs/ai.md, to be written later).
create table public.ai_model_limits (
  lane text not null check (lane in ('free', 'paid')),
  model text not null check (model ~ '^[a-z0-9][a-z0-9.-]{1,60}$'),
  rpm integer not null check (rpm between 0 and 100000),
  tpm integer not null check (tpm between 0 and 100000000),
  rpd integer not null check (rpd between 0 and 10000000),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (lane, model)
);
alter table public.ai_model_limits enable row level security;

insert into public.ai_model_limits (lane, model, rpm, tpm, rpd) values
  ('free', 'gemini-3.8-flash', 5, 100000, 50),
  ('free', 'gemini-3.5-flash-lite', 10, 100000, 200),
  ('free', 'gemini-3.1-flash-lite', 10, 100000, 200),
  ('paid', 'gemini-3.8-flash', 30, 500000, 1000),
  ('paid', 'gemini-3.5-flash-lite', 60, 1000000, 5000)
on conflict do nothing;

-- Call log -----------------------------------------------------------------------------

-- One row per model call. There is deliberately no column for a prompt, input text
-- or output text: only counts, statuses and timings are kept. Service role only.
-- A 'reserved' row still counts against the limits, so concurrent requests cannot
-- overshoot them while a call is in flight.
create table public.ai_calls (
  id bigint generated always as identity primary key,
  lane text not null check (lane in ('free', 'paid')),
  model text not null check (model ~ '^[a-z0-9][a-z0-9.-]{1,60}$'),
  feature text not null check (feature ~ '^[a-z_]{1,40}$'),
  clinic_id uuid references public.clinics (id) on delete cascade,
  status text not null default 'reserved'
    check (status in ('reserved', 'ok', 'failed', 'rate_limited', 'invalid_output')),
  est_input_tokens integer not null check (est_input_tokens between 0 and 10000000),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  thought_tokens integer check (thought_tokens is null or thought_tokens >= 0),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index ai_calls_model_created_idx on public.ai_calls (lane, model, created_at);
create index ai_calls_clinic_created_idx on public.ai_calls (clinic_id, created_at);
-- Retention deletes filter on age only (see private.job_cleanup()).
create index ai_calls_created_idx on public.ai_calls (created_at);
alter table public.ai_calls enable row level security;

-- Reserve a call before it is sent. Returns the call id, or null when a limit is
-- reached or the model is unknown or disabled. Requests in the last 60 seconds
-- count toward rpm and their tokens toward tpm, whatever their status. Daily
-- quotas (rpd) reset at midnight Pacific. The per-clinic cap counts the clinic's
-- calls across all models since midnight IST.
create or replace function public.ai_reserve(
  p_lane text,
  p_model text,
  p_feature text,
  p_clinic_id uuid,
  p_est_tokens integer,
  p_clinic_daily_cap integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_rpm integer;
  v_tpm integer;
  v_rpd integer;
  v_minute_requests bigint;
  v_minute_tokens bigint;
  v_day_requests bigint;
  v_clinic_requests bigint;
  v_pacific_midnight timestamptz :=
    date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  v_ist_midnight timestamptz :=
    date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  v_id bigint;
begin
  -- The row lock holds until the transaction ends, so reservations for the same
  -- lane and model run one at a time and the counts below cannot race.
  select l.enabled, l.rpm, l.tpm, l.rpd
    into v_enabled, v_rpm, v_tpm, v_rpd
    from public.ai_model_limits l
   where l.lane = p_lane and l.model = p_model
     for update;
  if not found or not v_enabled then
    return null;
  end if;
  if p_est_tokens is null or p_est_tokens < 0 then
    raise exception 'estimated tokens must be zero or more' using errcode = '22023';
  end if;

  select count(*), coalesce(sum(coalesce(c.input_tokens, c.est_input_tokens)), 0)
    into v_minute_requests, v_minute_tokens
    from public.ai_calls c
   where c.lane = p_lane and c.model = p_model
     and c.created_at > now() - interval '60 seconds';
  if v_minute_requests >= v_rpm then
    return null;
  end if;
  if v_minute_tokens + p_est_tokens > v_tpm then
    return null;
  end if;

  select count(*) into v_day_requests
    from public.ai_calls c
   where c.lane = p_lane and c.model = p_model
     and c.created_at >= v_pacific_midnight;
  if v_day_requests >= v_rpd then
    return null;
  end if;

  if p_clinic_id is not null and p_clinic_daily_cap is not null then
    select count(*) into v_clinic_requests
      from public.ai_calls c
     where c.clinic_id = p_clinic_id
       and c.created_at >= v_ist_midnight;
    if v_clinic_requests >= p_clinic_daily_cap then
      return null;
    end if;
  end if;

  insert into public.ai_calls (lane, model, feature, clinic_id, est_input_tokens)
  values (p_lane, p_model, p_feature, p_clinic_id, p_est_tokens)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.ai_reserve(text, text, text, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_reserve(text, text, text, uuid, integer, integer) to service_role;

-- Record the outcome of a reserved call. Only a 'reserved' row is updated, so a
-- settled call is never rewritten.
create or replace function public.ai_settle(
  p_id bigint,
  p_status text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_thought_tokens integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('ok', 'failed', 'rate_limited', 'invalid_output') then
    raise exception 'invalid call status' using errcode = '22023';
  end if;
  update public.ai_calls
     set status = p_status,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         thought_tokens = p_thought_tokens,
         settled_at = now()
   where id = p_id
     and status = 'reserved';
end;
$$;
revoke all on function public.ai_settle(bigint, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_settle(bigint, text, integer, integer, integer) to service_role;

-- Job run log ----------------------------------------------------------------------------

-- True only for a JSON object whose every value is a number or a boolean. Job
-- results are counts only, so no personal data can be stored in job_runs.
create or replace function private.jsonb_counts_only(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
     and not exists (
       select 1
         from jsonb_each(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) e
        where jsonb_typeof(e.value) not in ('number', 'boolean')
     )
$$;
revoke all on function private.jsonb_counts_only(jsonb) from public, anon, authenticated;
-- A CHECK constraint runs with the privileges of the role inserting the row, so
-- the service role (the only inserter) needs EXECUTE as well.
grant execute on function private.jsonb_counts_only(jsonb) to service_role;

-- One row per scheduled job run. Service role only.
create table public.job_runs (
  id bigint generated always as identity primary key,
  job text not null check (job ~ '^[a-z][a-z-]{1,40}$'),
  ok boolean not null,
  dry_run boolean not null,
  result jsonb not null check (private.jsonb_counts_only(result)),
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);
create index job_runs_created_idx on public.job_runs (created_at);
alter table public.job_runs enable row level security;

-- Lead AI triage -------------------------------------------------------------------------

-- The AI's triage of one lead. It is clinic data, so RLS follows leads: every
-- member reads, owner, admin and staff write while the clinic is entitled. The
-- row goes with its lead (composite foreign key), and no client can delete it.
create table public.lead_ai_triage (
  lead_id uuid primary key,
  clinic_id uuid not null default private.current_clinic_id() references public.clinics (id) on delete cascade,
  treatment text not null check (treatment in (
    'checkup_cleaning', 'pain_emergency', 'braces_aligners', 'implants', 'root_canal',
    'crowns_bridges', 'whitening_cosmetic', 'dentures', 'children', 'other', 'unclear'
  )),
  urgency text not null check (urgency in ('call_today', 'soon', 'routine')),
  language text not null check (language in ('en', 'hi', 'mr', 'gu', 'other', 'unknown')),
  best_time text check (best_time is null or char_length(best_time) <= 60),
  summary text not null check (char_length(btrim(summary)) between 1 and 160),
  model text not null check (model ~ '^[a-z0-9][a-z0-9.-]{1,60}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (clinic_id, lead_id) references public.leads (clinic_id, id) on delete cascade
);
create index lead_ai_triage_clinic_lead_idx on public.lead_ai_triage (clinic_id, lead_id);

create or replace function private.touch_lead_ai_triage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.clinic_id is distinct from old.clinic_id or new.lead_id is distinct from old.lead_id then
    raise exception 'tenant identifiers are immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_lead_ai_triage() from public, anon, authenticated;

create trigger lead_ai_triage_touch before update on public.lead_ai_triage
  for each row execute function private.touch_lead_ai_triage();

alter table public.lead_ai_triage enable row level security;
grant select on public.lead_ai_triage to authenticated;
grant insert (lead_id, treatment, urgency, language, best_time, summary, model)
  on public.lead_ai_triage to authenticated;
grant update (treatment, urgency, language, best_time, summary, model)
  on public.lead_ai_triage to authenticated;

create policy lead_ai_triage_select on public.lead_ai_triage
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id()));

create policy lead_ai_triage_insert on public.lead_ai_triage
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[]))
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

create policy lead_ai_triage_update on public.lead_ai_triage
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

-- AI help with enquiries --------------------------------------------------------------------

-- Owners and admins switch this on. The existing update policy on
-- clinic_automation_settings already limits who can change it.
alter table public.clinic_automation_settings add column ai_enquiry_help boolean not null default false;
grant update (ai_enquiry_help) on public.clinic_automation_settings to authenticated;

-- Retention: AI calls and job runs are kept for 90 days ----------------------------------

-- Retention: rows older than each window are deleted (webhooks 90 days, contact
-- requests 12 months, notification log 180 days, activity 24 months, AI calls and
-- job runs 90 days).
create or replace function private.job_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhooks integer;
  v_contacts integer;
  v_notifications integer;
  v_activity integer;
  v_ai_calls integer;
  v_job_runs integer;
begin
  delete from public.webhook_events where received_at < now() - interval '90 days';
  get diagnostics v_webhooks = row_count;
  delete from public.contact_requests where created_at < now() - interval '12 months';
  get diagnostics v_contacts = row_count;
  delete from public.notification_log where created_at < now() - interval '180 days';
  get diagnostics v_notifications = row_count;
  delete from public.activity_events where created_at < now() - interval '24 months';
  get diagnostics v_activity = row_count;
  delete from public.ai_calls where created_at < now() - interval '90 days';
  get diagnostics v_ai_calls = row_count;
  delete from public.job_runs where created_at < now() - interval '90 days';
  get diagnostics v_job_runs = row_count;
  return jsonb_build_object(
    'webhook_events', v_webhooks,
    'contact_requests', v_contacts,
    'notification_log', v_notifications,
    'activity_events', v_activity,
    'ai_calls', v_ai_calls,
    'job_runs', v_job_runs
  );
end;
$$;
revoke all on function private.job_cleanup() from public, anon, authenticated;
grant execute on function private.job_cleanup() to service_role;
