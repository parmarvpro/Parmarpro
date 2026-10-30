-- Remove payments, the trial and the access check.
--
-- Product decision: there is no payment system. Every active clinic has full
-- access, so nothing checks a trial or a paid period any more. This migration:
--   1. rebuilds the policies and functions that checked the entitlement,
--   2. drops the billing tables, types and RPCs,
--   3. removes the Razorpay provider from webhook_events (Clerk stays).
-- Earlier migrations are left as they were: they may already be applied, and
-- a new migration is how the change reaches an existing database.

-- 1. Policies ---------------------------------------------------------------------------
-- Same rules as before, minus the private.clinic_has_entitlement() clause.

drop policy patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])));

drop policy patients_update on public.patients;
create policy patients_update on public.patients
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id()));

drop policy leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])));

drop policy leads_update on public.leads;
create policy leads_update on public.leads
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id()));

drop policy appointments_insert on public.appointments;
create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])));

drop policy appointments_update on public.appointments;
create policy appointments_update on public.appointments
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id()));

drop policy tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])));

drop policy tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id()));

drop policy lead_ai_triage_insert on public.lead_ai_triage;
create policy lead_ai_triage_insert on public.lead_ai_triage
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])));

drop policy lead_ai_triage_update on public.lead_ai_triage;
create policy lead_ai_triage_update on public.lead_ai_triage
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id()));

-- 2. Functions that read or write the entitlement ----------------------------------------
-- Copied from their latest definitions, with only the entitlement predicate removed.
-- Signatures are unchanged, so CREATE OR REPLACE keeps each function's grants.

create or replace function private.job_untouched_lead_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.tasks (clinic_id, title, due_at, status, assigned_to, lead_id, patient_id, auto_kind)
  select l.clinic_id,
         'Follow up new inquiry',
         now(),
         'open'::public.task_status,
         case when exists (
           select 1 from public.clinic_members m
            where m.clinic_id = l.clinic_id and m.id = l.assigned_to and m.status = 'active'
         ) then l.assigned_to end,
         l.id,
         l.patient_id,
         'untouched_lead'
    from public.leads l
    join public.clinics c on c.id = l.clinic_id
    join public.clinic_automation_settings s on s.clinic_id = l.clinic_id
   where l.status = 'new'
     and l.next_follow_up_at is null
     and l.created_at < now() - make_interval(hours => s.untouched_lead_hours)
     and s.untouched_lead_tasks
     and c.archived_at is null
     and not exists (
       select 1 from public.tasks t
        where t.clinic_id = l.clinic_id and t.lead_id = l.id and t.auto_kind = 'untouched_lead'
     )
     and not exists (
       select 1 from public.tasks t
        where t.clinic_id = l.clinic_id and t.lead_id = l.id and t.status = 'open'
     )
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function private.job_recall_tasks(p_limit_per_clinic integer default 20)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with clinics_on as (
    select s.clinic_id, s.recall_months
      from public.clinic_automation_settings s
      join public.clinics c on c.id = s.clinic_id
     where s.recall_tasks
       and c.archived_at is null
  ),
  last_completed as (
    select a.clinic_id, a.patient_id, max(a.starts_at) as last_starts_at
      from public.appointments a
      join clinics_on co on co.clinic_id = a.clinic_id
     where a.status = 'completed' and a.patient_id is not null
     group by a.clinic_id, a.patient_id
  ),
  due as (
    select lc.clinic_id, lc.patient_id, lc.last_starts_at
      from last_completed lc
      join clinics_on co on co.clinic_id = lc.clinic_id
      join public.patients p on p.clinic_id = lc.clinic_id and p.id = lc.patient_id
     where lc.last_starts_at < now() - make_interval(months => co.recall_months)
       and p.archived_at is null
       and p.opted_out_at is null
       and not exists (
         select 1 from public.appointments f
          where f.clinic_id = lc.clinic_id and f.patient_id = lc.patient_id
            and f.status in ('scheduled', 'confirmed') and f.starts_at > now()
       )
       and not exists (
         select 1 from public.tasks t
          where t.clinic_id = lc.clinic_id and t.patient_id = lc.patient_id
            and t.auto_kind = 'recall' and t.status = 'open'
       )
  ),
  picked as (
    select d.clinic_id, d.patient_id,
           row_number() over (partition by d.clinic_id order by d.last_starts_at, d.patient_id) as rn
      from due d
  )
  insert into public.tasks (clinic_id, title, due_at, status, patient_id, auto_kind)
  select p.clinic_id, 'Recall due: invite for a check-up', now(), 'open'::public.task_status, p.patient_id, 'recall'
    from picked p
   where p.rn <= p_limit_per_clinic
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.job_staff_digest(p_now timestamptz)
returns table (
  clinic_id uuid,
  clinic_name text,
  member_id uuid,
  clerk_user_id text,
  member_role public.member_role,
  tasks_due_today integer,
  tasks_overdue integer,
  follow_ups_due_today integer,
  follow_ups_overdue integer,
  appointments_today integer,
  unassigned_open_tasks integer,
  unassigned_follow_ups integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select (date_trunc('day', p_now at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as d0,
           ((date_trunc('day', p_now at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata') as d1
  ),
  recipients as (
    select c.id as clinic_id, c.name as clinic_name, m.id as member_id,
           m.clerk_user_id, m.role as member_role
      from public.clinic_members m
      join public.clinics c on c.id = m.clinic_id
      join public.clinic_automation_settings s on s.clinic_id = c.id
     where m.status = 'active'
       and m.role in ('owner', 'admin', 'staff')
       and not m.digest_opt_out
       and c.archived_at is null
       and s.morning_digest
  )
  select
    r.clinic_id,
    r.clinic_name,
    r.member_id,
    r.clerk_user_id,
    r.member_role,
    (select count(*)::integer from public.tasks t
      where t.clinic_id = r.clinic_id and t.assigned_to = r.member_id and t.status = 'open'
        and t.due_at >= b.d0 and t.due_at < b.d1) as tasks_due_today,
    (select count(*)::integer from public.tasks t
      where t.clinic_id = r.clinic_id and t.assigned_to = r.member_id and t.status = 'open'
        and t.due_at < b.d0) as tasks_overdue,
    (select count(*)::integer from public.leads l
      where l.clinic_id = r.clinic_id and l.assigned_to = r.member_id
        and l.status not in ('converted', 'lost')
        and l.next_follow_up_at >= b.d0 and l.next_follow_up_at < b.d1) as follow_ups_due_today,
    (select count(*)::integer from public.leads l
      where l.clinic_id = r.clinic_id and l.assigned_to = r.member_id
        and l.status not in ('converted', 'lost')
        and l.next_follow_up_at < b.d0) as follow_ups_overdue,
    (select count(*)::integer from public.appointments a
      where a.clinic_id = r.clinic_id and a.status in ('scheduled', 'confirmed')
        and a.starts_at >= b.d0 and a.starts_at < b.d1
        and (a.assigned_to = r.member_id or r.member_role in ('owner', 'admin'))) as appointments_today,
    case when r.member_role in ('owner', 'admin') then (
      select count(*)::integer from public.tasks t
       where t.clinic_id = r.clinic_id and t.assigned_to is null and t.status = 'open'
         and (t.due_at < b.d1 or t.due_at is null)
    ) else 0 end as unassigned_open_tasks,
    case when r.member_role in ('owner', 'admin') then (
      select count(*)::integer from public.leads l
       where l.clinic_id = r.clinic_id and l.assigned_to is null
         and l.status not in ('converted', 'lost')
         and l.next_follow_up_at < b.d1
    ) else 0 end as unassigned_follow_ups
  from recipients r
  cross join bounds b
$$;

create or replace function public.job_patient_reminders(p_now timestamptz)
returns table (
  appointment_id uuid,
  clinic_id uuid,
  clinic_name text,
  first_name text,
  email text,
  starts_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select ((date_trunc('day', p_now at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata') as d1,
           ((date_trunc('day', p_now at time zone 'Asia/Kolkata') + interval '2 days') at time zone 'Asia/Kolkata') as d2
  )
  select a.id, a.clinic_id, c.name, split_part(btrim(p.full_name), ' ', 1), p.email, a.starts_at
    from public.appointments a
    cross join bounds b
    join public.clinics c on c.id = a.clinic_id
    join public.clinic_automation_settings s on s.clinic_id = a.clinic_id
    join public.patients p on p.clinic_id = a.clinic_id and p.id = a.patient_id
   where a.status in ('scheduled', 'confirmed')
     and a.patient_id is not null
     and a.starts_at >= b.d1 and a.starts_at < b.d2
     and p.email is not null
     and p.email_consent
     and p.opted_out_at is null
     and p.archived_at is null
     and s.patient_email_reminders
     and c.archived_at is null
$$;

create or replace function public.job_weekly_summary(p_from timestamptz, p_to timestamptz)
returns table (
  clinic_id uuid,
  clinic_name text,
  owner_user_ids text[],
  summary jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with owners as (
    select m.clinic_id, array_agg(m.clerk_user_id order by m.created_at, m.id) as owner_user_ids
      from public.clinic_members m
     where m.role = 'owner' and m.status = 'active'
     group by m.clinic_id
  )
  select c.id as clinic_id,
         c.name as clinic_name,
         o.owner_user_ids,
         jsonb_build_object(
           'leads_created', (select count(*) from public.leads l
                              where l.clinic_id = c.id and l.created_at >= p_from and l.created_at < p_to),
           'leads_by_status', coalesce((select jsonb_object_agg(g.status::text, g.n) from (
               select l.status, count(*) as n from public.leads l
                where l.clinic_id = c.id and l.created_at >= p_from and l.created_at < p_to
                group by l.status) g), '{}'::jsonb),
           'leads_converted', (select count(*) from public.leads l
                                where l.clinic_id = c.id and l.status = 'converted'
                                  and l.updated_at >= p_from and l.updated_at < p_to),
           'appointments_in_range', (select count(*) from public.appointments a
                                      where a.clinic_id = c.id and a.starts_at >= p_from and a.starts_at < p_to),
           'appointments_by_status', coalesce((select jsonb_object_agg(g.status::text, g.n) from (
               select a.status, count(*) as n from public.appointments a
                where a.clinic_id = c.id and a.starts_at >= p_from and a.starts_at < p_to
                group by a.status) g), '{}'::jsonb),
           'tasks_completed', (select count(*) from public.tasks t
                                where t.clinic_id = c.id and t.status = 'done'
                                  and t.completed_at >= p_from and t.completed_at < p_to),
           'tasks_overdue', (select count(*) from public.tasks t
                              where t.clinic_id = c.id and t.status = 'open' and t.due_at < now()),
           'follow_ups_due', (select count(*) from public.leads l
                               where l.clinic_id = c.id and l.next_follow_up_at < now()
                                 and l.status not in ('converted', 'lost')),
           'patients_total', (select count(*) from public.patients p
                               where p.clinic_id = c.id and p.archived_at is null)
         ) as summary
    from public.clinics c
    join public.clinic_automation_settings s on s.clinic_id = c.id
    join owners o on o.clinic_id = c.id
   where c.archived_at is null
     and s.weekly_summary
$$;

create or replace function public.create_clinic_for_active_org(
  p_name text,
  p_city text default 'Mumbai',
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user text := private.current_user_id();
  v_org text := private.active_org_id();
  v_clinic_id uuid;
  v_member_id uuid;
begin
  if v_user is null or v_org is null then
    raise exception 'an active organization is required' using errcode = '42501';
  end if;
  if private.active_org_role() is distinct from 'admin' then
    raise exception 'only the organization admin can create the clinic' using errcode = '42501';
  end if;
  if exists (select 1 from public.clinics where clerk_org_id = v_org) then
    raise exception 'clinic already exists for this organization' using errcode = '23505';
  end if;

  insert into public.clinics (clerk_org_id, name, city)
  values (v_org, btrim(p_name), coalesce(nullif(btrim(p_city), ''), 'Mumbai'))
  returning id into v_clinic_id;

  insert into public.clinic_members (clinic_id, clerk_user_id, role, display_name)
  values (v_clinic_id, v_user, 'owner', nullif(btrim(p_display_name), ''))
  returning id into v_member_id;

  insert into public.activity_events (clinic_id, actor_user_id, entity_type, entity_id, action)
  values (v_clinic_id, v_user, 'clinic', v_clinic_id, 'created');

  return v_clinic_id;
end;
$$;


-- The caller's membership context. The return type changes, so the function is
-- dropped and recreated. It stays SECURITY INVOKER: it reads only rows the caller
-- can already see under RLS.
drop function public.my_membership();
create function public.my_membership()
returns table (
  clinic_id uuid,
  clinic_name text,
  clinic_city text,
  member_id uuid,
  role public.member_role,
  display_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.name, c.city, m.member_id, m.role, cm.display_name
  from private.current_membership() m
  join public.clinics c on c.id = m.clinic_id
  join public.clinic_members cm on cm.id = m.member_id
$$;
revoke all on function public.my_membership() from public, anon, authenticated;
grant execute on function public.my_membership() to authenticated;

-- Founder metrics: clinics created and enquiries received. Trial, plan and revenue
-- figures no longer exist.
create or replace function public.job_founder_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'clinics_created', (select count(*) from public.clinics c
                         where c.created_at >= p_from and c.created_at < p_to),
    'enquiries', (select count(*) from public.contact_requests r
                   where r.created_at >= p_from and r.created_at < p_to)
  )
$$;

-- Operations counts: ten integer keys (was eleven). The unpaid-orders key and the
-- reconcile-payments and trial-renewal jobs are gone. src/lib/ops-counts.ts is the
-- contract.
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
          'expire-invitations', 'staff-digest', 'patient-reminders'
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
    -- Provider webhooks (Clerk) that failed to process since p_since.
    'webhooks_failed', (
      select count(*) from public.webhook_events w
       where w.status = 'failed' and w.received_at >= p_since
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

-- 3. Webhook providers -------------------------------------------------------------------
-- Razorpay webhook receipts are removed with the provider; only Clerk remains.
delete from public.webhook_events where provider <> 'clerk';
alter table public.webhook_events drop constraint webhook_events_provider_check;
alter table public.webhook_events add constraint webhook_events_provider_check check (provider = 'clerk');

-- 4. Drop the payment objects ----------------------------------------------------------

drop function public.job_entitlement_notices(timestamptz);
drop function public.apply_verified_payment(uuid, text, text, bigint, text, text);
drop function public.record_payment_attempt(uuid, text, text, public.payment_status, bigint, text, text, text);

drop table public.payments;
drop table public.billing_orders;
drop table public.clinic_entitlements;

drop type public.payment_status;
drop type public.billing_order_status;

drop function private.clinic_has_entitlement(uuid);
drop function private.trial_days();
