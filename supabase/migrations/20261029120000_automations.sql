-- Automations (phase 1): per-clinic automation settings, automation triggers,
-- scheduled job functions and the notification log.
--
-- * clinic_automation_settings: one row per clinic (created by trigger and
--   backfilled here). Owners and admins change the toggles; the enquiry form
--   key and the round-robin cursor are server-owned.
-- * Automation triggers: no-show callback tasks and round-robin lead
--   assignment. They run as SECURITY DEFINER and tag their tasks with
--   auto_kind, which no client grant can write.
-- * Scheduled jobs: private.job_* functions, called by pg_cron, and public.job_*
--   query functions, called by the app's job endpoints with the service role.
-- * notification_log: service-role-only record of sent notifications, so that
--   reminders are sent at most once per period.

-- Per-clinic automation settings ----------------------------------------------------

create table public.clinic_automation_settings (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  morning_digest boolean not null default true,
  weekly_summary boolean not null default true,
  untouched_lead_tasks boolean not null default true,
  untouched_lead_hours integer not null default 48 check (untouched_lead_hours between 12 and 168),
  no_show_tasks boolean not null default true,
  round_robin boolean not null default false,
  round_robin_last_member uuid,
  recall_tasks boolean not null default false,
  recall_months integer not null default 6 check (recall_months between 1 and 24),
  patient_email_reminders boolean not null default false,
  enquiry_form_enabled boolean not null default false,
  enquiry_form_key text unique check (enquiry_form_key is null or enquiry_form_key ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now(),
  foreign key (clinic_id, round_robin_last_member) references public.clinic_members (clinic_id, id) on delete set null (round_robin_last_member)
);

create or replace function private.touch_automation_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.clinic_id is distinct from old.clinic_id then
    raise exception 'tenant identifiers are immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_automation_settings() from public, anon, authenticated;

create trigger clinic_automation_settings_touch before update on public.clinic_automation_settings
  for each row execute function private.touch_automation_settings();

create or replace function private.create_automation_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.clinic_automation_settings (clinic_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.create_automation_settings() from public, anon, authenticated;

create trigger clinics_automation_settings after insert on public.clinics
  for each row execute function private.create_automation_settings();

insert into public.clinic_automation_settings (clinic_id) select id from public.clinics on conflict do nothing;

alter table public.clinic_automation_settings enable row level security;
grant select on public.clinic_automation_settings to authenticated;
grant update (morning_digest, weekly_summary, untouched_lead_tasks, untouched_lead_hours, no_show_tasks,
              round_robin, recall_tasks, recall_months, patient_email_reminders, enquiry_form_enabled)
  on public.clinic_automation_settings to authenticated;

create policy clinic_automation_settings_select on public.clinic_automation_settings
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id()));

create policy clinic_automation_settings_update on public.clinic_automation_settings
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id()));

-- Enquiry form key: owners and admins rotate it; the key is never set directly.
create or replace function public.regenerate_enquiry_form_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic_id uuid := private.current_clinic_id();
  v_key text;
begin
  if v_clinic_id is null or not private.has_role(array['owner', 'admin']::public.member_role[]) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  v_key := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.clinic_automation_settings
     set enquiry_form_key = v_key
   where clinic_id = v_clinic_id;
  return v_key;
end;
$$;
revoke all on function public.regenerate_enquiry_form_key() from public, anon, authenticated;
grant execute on function public.regenerate_enquiry_form_key() to authenticated;

-- Members can opt out of the staff morning digest for themselves only.
alter table public.clinic_members add column digest_opt_out boolean not null default false;

create or replace function public.set_my_digest_opt_out(p_opt_out boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clinic_members
     set digest_opt_out = p_opt_out
   where clinic_id = private.current_clinic_id()
     and clerk_user_id = private.current_user_id()
     and status = 'active';
  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.set_my_digest_opt_out(boolean) from public, anon, authenticated;
grant execute on function public.set_my_digest_opt_out(boolean) to authenticated;

-- Automated tasks ----------------------------------------------------------------------

-- auto_kind marks tasks created by automations. It has no client grant, so
-- users can neither set nor change it.
alter table public.tasks add column auto_kind text
  check (auto_kind is null or auto_kind in ('untouched_lead', 'no_show_callback', 'recall'));

create unique index tasks_auto_untouched_lead_idx on public.tasks (clinic_id, lead_id)
  where auto_kind = 'untouched_lead';
create unique index tasks_auto_no_show_idx on public.tasks (clinic_id, appointment_id)
  where auto_kind = 'no_show_callback';
create unique index tasks_auto_recall_open_idx on public.tasks (clinic_id, patient_id)
  where auto_kind = 'recall' and status = 'open';

-- Contact requests: follow-up fields for the operator. Still no client grants.
alter table public.contact_requests add column handled_at timestamptz, add column follow_up_at timestamptz;

-- Recreated to return the new row id (the marketing form ignores it).
drop function public.submit_contact_request(text, text, text, text, text, text);

create or replace function public.submit_contact_request(
  p_full_name text,
  p_clinic_name text,
  p_phone_e164 text,
  p_email text,
  p_city text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select count(*) from public.contact_requests where created_at > now() - interval '10 minutes') >= 200 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  insert into public.contact_requests (full_name, clinic_name, phone_e164, email, city, message)
  values (btrim(p_full_name), nullif(btrim(p_clinic_name), ''), nullif(btrim(p_phone_e164), ''),
          nullif(lower(btrim(p_email)), ''), nullif(btrim(p_city), ''), nullif(btrim(p_message), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_contact_request(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_contact_request(text, text, text, text, text, text) to anon, authenticated;

-- Notification log ---------------------------------------------------------------------

-- Service role only, like webhook_events: RLS is on with no policies and there
-- are no client grants. Used to make reminders idempotent per period.
create table public.notification_log (
  id bigint generated always as identity primary key,
  kind text not null check (kind ~ '^[a-z_]{1,40}$'),
  clinic_id uuid references public.clinics (id) on delete cascade,
  subject_key text not null check (char_length(subject_key) between 1 and 200),
  period_key text not null check (char_length(period_key) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (kind, subject_key, period_key)
);
create index notification_log_created_idx on public.notification_log (created_at);
alter table public.notification_log enable row level security;

-- Triggers -------------------------------------------------------------------------------

-- A no-show creates a callback task for tomorrow at 10:00 IST, assigned to the
-- appointment's member only while that member is still active.
create or replace function private.no_show_callback_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.clinic_automation_settings s where s.clinic_id = new.clinic_id and s.no_show_tasks) then
    insert into public.tasks (clinic_id, title, due_at, status, assigned_to, lead_id, patient_id, appointment_id, auto_kind)
    values (
      new.clinic_id,
      'Call back after missed appointment',
      ((date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day 10 hours') at time zone 'Asia/Kolkata'),
      'open',
      case when exists (
        select 1 from public.clinic_members m
         where m.clinic_id = new.clinic_id and m.id = new.assigned_to and m.status = 'active'
      ) then new.assigned_to end,
      new.lead_id,
      new.patient_id,
      new.id,
      'no_show_callback'
    )
    on conflict do nothing;
  end if;
  return null;
end;
$$;
revoke all on function private.no_show_callback_task() from public, anon, authenticated;

create trigger appointments_no_show_task after update of status on public.appointments
  for each row when (new.status = 'no_show' and old.status is distinct from 'no_show')
  execute function private.no_show_callback_task();

-- Round robin: new leads without an assignee go to the next active owner, admin
-- or staff member in (created_at, id) order after the last one assigned.
create or replace function private.round_robin_assign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.clinic_automation_settings;
  v_last_created_at timestamptz;
  v_last_id uuid;
  v_next uuid;
begin
  select * into v_settings
    from public.clinic_automation_settings s
   where s.clinic_id = new.clinic_id and s.round_robin
     for update;
  if not found then
    return new;
  end if;

  if v_settings.round_robin_last_member is not null then
    select m.created_at, m.id into v_last_created_at, v_last_id
      from public.clinic_members m
     where m.clinic_id = new.clinic_id and m.id = v_settings.round_robin_last_member;
  end if;

  select c.id into v_next
    from public.clinic_members c
   where c.clinic_id = new.clinic_id
     and c.status = 'active'
     and c.role in ('owner', 'admin', 'staff')
     and (v_last_id is null or (c.created_at, c.id) > (v_last_created_at, v_last_id))
   order by c.created_at, c.id
   limit 1;

  if v_next is null then
    select c.id into v_next
      from public.clinic_members c
     where c.clinic_id = new.clinic_id
       and c.status = 'active'
       and c.role in ('owner', 'admin', 'staff')
     order by c.created_at, c.id
     limit 1;
  end if;

  if v_next is null then
    return new;
  end if;

  new.assigned_to := v_next;
  update public.clinic_automation_settings
     set round_robin_last_member = v_next
   where clinic_id = new.clinic_id;
  return new;
end;
$$;
revoke all on function private.round_robin_assign() from public, anon, authenticated;

create trigger leads_round_robin before insert on public.leads
  for each row when (new.assigned_to is null)
  execute function private.round_robin_assign();

-- Scheduled jobs (pg_cron, as postgres) ------------------------------------------------

-- Leads that have sat untouched in status 'new' get one follow-up task. Once a
-- task exists for the lead, in any status, it is never created again.
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
     and private.clinic_has_entitlement(l.clinic_id)
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
revoke all on function private.job_untouched_lead_tasks() from public, anon, authenticated;
grant execute on function private.job_untouched_lead_tasks() to service_role;

-- Patients whose last completed visit is older than recall_months get one recall
-- task, oldest visit first, at most p_limit_per_clinic per clinic per run.
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
       and private.clinic_has_entitlement(s.clinic_id)
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
revoke all on function private.job_recall_tasks(integer) from public, anon, authenticated;
grant execute on function private.job_recall_tasks(integer) to service_role;

-- Retention: rows older than each window are deleted (webhooks 90 days, contact
-- requests 12 months, notification log 180 days, activity 24 months).
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
begin
  delete from public.webhook_events where received_at < now() - interval '90 days';
  get diagnostics v_webhooks = row_count;
  delete from public.contact_requests where created_at < now() - interval '12 months';
  get diagnostics v_contacts = row_count;
  delete from public.notification_log where created_at < now() - interval '180 days';
  get diagnostics v_notifications = row_count;
  delete from public.activity_events where created_at < now() - interval '24 months';
  get diagnostics v_activity = row_count;
  return jsonb_build_object(
    'webhook_events', v_webhooks,
    'contact_requests', v_contacts,
    'notification_log', v_notifications,
    'activity_events', v_activity
  );
end;
$$;
revoke all on function private.job_cleanup() from public, anon, authenticated;
grant execute on function private.job_cleanup() to service_role;

-- Job queries (app job endpoints, service role) ------------------------------------------
-- SECURITY INVOKER: they read through the caller's privileges. Only the service
-- role is granted execute, and it bypasses RLS, so these see every clinic.

-- One row per active owner, admin or staff member who has not opted out, in a
-- live clinic with the digest on. Counts cover the IST day [d0, d1) and anything
-- overdue before d0.
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
       and private.clinic_has_entitlement(c.id)
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
revoke all on function public.job_staff_digest(timestamptz) from public, anon, authenticated;
grant execute on function public.job_staff_digest(timestamptz) to service_role;

-- Reminders for appointments on the IST day after p_now's IST day.
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
     and private.clinic_has_entitlement(c.id)
$$;
revoke all on function public.job_patient_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.job_patient_reminders(timestamptz) to service_role;

-- Trial and renewal notices. Each notice is keyed by its end date so it is sent
-- once per period (see notification_log).
create or replace function public.job_entitlement_notices(p_now timestamptz)
returns table (
  clinic_id uuid,
  clinic_name text,
  notice text,
  days_left integer,
  period_key text,
  owner_user_ids text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select c.id as clinic_id,
           c.name as clinic_name,
           e.trial_ends_at,
           e.paid_through,
           (p_now at time zone 'Asia/Kolkata')::date as today
      from public.clinics c
      join public.clinic_entitlements e on e.clinic_id = c.id
     where c.archived_at is null
  ),
  ends as (
    -- Trial notices only apply while no paid period is running.
    select b.clinic_id, b.clinic_name, 'trial'::text as kind, b.trial_ends_at as ends_at,
           ((b.trial_ends_at at time zone 'Asia/Kolkata')::date - b.today)::integer as days_left
      from base b
     where b.trial_ends_at is not null
       and (b.paid_through is null or b.paid_through <= p_now)
    union all
    select b.clinic_id, b.clinic_name, 'renewal'::text, b.paid_through,
           ((b.paid_through at time zone 'Asia/Kolkata')::date - b.today)::integer
      from base b
     where b.paid_through is not null
  ),
  notices as (
    select x.clinic_id, x.clinic_name, x.ends_at, x.days_left,
           case
             when x.kind = 'trial' and x.ends_at > p_now and x.days_left between 3 and 7 then 'trial_reminder'
             when x.kind = 'trial' and x.ends_at > p_now and x.days_left between 0 and 2 then 'trial_ending'
             when x.kind = 'trial' and x.ends_at <= p_now and x.ends_at > p_now - interval '3 days' then 'trial_ended'
             when x.kind = 'renewal' and x.ends_at > p_now and x.days_left between 2 and 5 then 'renewal_reminder'
             when x.kind = 'renewal' and x.ends_at > p_now and x.days_left between 0 and 1 then 'renewal_due'
             when x.kind = 'renewal' and x.ends_at <= p_now and x.ends_at > p_now - interval '3 days' then 'access_lapsed'
           end as notice
      from ends x
  ),
  owners as (
    select m.clinic_id, array_agg(m.clerk_user_id order by m.created_at, m.id) as owner_user_ids
      from public.clinic_members m
     where m.role = 'owner' and m.status = 'active'
     group by m.clinic_id
  )
  select n.clinic_id,
         n.clinic_name,
         n.notice,
         n.days_left,
         n.notice || ':' || to_char(n.ends_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as period_key,
         o.owner_user_ids
    from notices n
    join owners o on o.clinic_id = n.clinic_id
   where n.notice is not null
$$;
revoke all on function public.job_entitlement_notices(timestamptz) from public, anon, authenticated;
grant execute on function public.job_entitlement_notices(timestamptz) to service_role;

-- Weekly owner summary: dashboard_summary's keys, counted for one clinic at a time.
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
     and private.clinic_has_entitlement(c.id)
$$;
revoke all on function public.job_weekly_summary(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.job_weekly_summary(timestamptz, timestamptz) to service_role;

-- Founder metrics for the period [p_from, p_to) and the state at p_to.
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
    'trials_active', (select count(*) from public.clinic_entitlements e
                       where e.trial_ends_at > p_to
                         and (e.paid_through is null or e.paid_through <= p_to)),
    'paid_active', (select count(*) from public.clinic_entitlements e
                     where e.paid_through > p_to),
    'payments_captured', (select count(*) from public.payments pay
                           where pay.status = 'captured'
                             and pay.captured_at >= p_from and pay.captured_at < p_to),
    'revenue_paise', (select coalesce(sum(pay.amount_paise), 0) from public.payments pay
                       where pay.status = 'captured'
                         and pay.captured_at >= p_from and pay.captured_at < p_to),
    'enquiries', (select count(*) from public.contact_requests r
                   where r.created_at >= p_from and r.created_at < p_to)
  )
$$;
revoke all on function public.job_founder_metrics(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.job_founder_metrics(timestamptz, timestamptz) to service_role;

-- Indexes ---------------------------------------------------------------------------------
-- Covering indexes for the new foreign keys (as in 20261028120600_fk_indexes.sql)
-- and for the retention deletes in private.job_cleanup(), which filter on age only.
create index if not exists clinic_automation_settings_last_member_idx
  on public.clinic_automation_settings (clinic_id, round_robin_last_member);
create index if not exists notification_log_clinic_idx on public.notification_log (clinic_id);
create index if not exists webhook_events_received_idx on public.webhook_events (received_at);
create index if not exists activity_events_created_idx on public.activity_events (created_at);

-- Scheduling ----------------------------------------------------------------------------
-- pg_cron calls, as postgres: private.job_untouched_lead_tasks(),
-- private.job_recall_tasks() and private.job_cleanup().
-- The app's job endpoints call, with the service role: public.job_staff_digest(),
-- public.job_patient_reminders(), public.job_entitlement_notices(),
-- public.job_weekly_summary() and public.job_founder_metrics().
-- Schedules are configured outside migrations, in supabase/ops/schedules.sql.
