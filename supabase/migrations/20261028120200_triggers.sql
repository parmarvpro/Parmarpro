-- Integrity triggers: audit fields, immutable tenant ids, valid assignees,
-- state transitions and the append-only activity trail.

-- Audit fields. created_by/created_at always come from the server or token,
-- never from the request body, and clinic_id/id can never change.
create or replace function private.set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(private.current_user_id(), 'system');
    new.created_at := now();
    new.updated_at := now();
  elsif tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.clinic_id is distinct from old.clinic_id then
      raise exception 'tenant and record identifiers are immutable'
        using errcode = '42501';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Same guard for tables without created_by.
create or replace function private.guard_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'record identifiers are immutable' using errcode = '42501';
  end if;
  if tg_table_name <> 'clinics' and (to_jsonb(new) ->> 'clinic_id') is distinct from (to_jsonb(old) ->> 'clinic_id') then
    raise exception 'tenant identifiers are immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger patients_audit before insert or update on public.patients
  for each row execute function private.set_audit_fields();
create trigger leads_audit before insert or update on public.leads
  for each row execute function private.set_audit_fields();
create trigger appointments_audit before insert or update on public.appointments
  for each row execute function private.set_audit_fields();
create trigger tasks_audit before insert or update on public.tasks
  for each row execute function private.set_audit_fields();

create trigger clinics_guard before update on public.clinics
  for each row execute function private.guard_identity();
create trigger clinic_members_guard before update on public.clinic_members
  for each row execute function private.guard_identity();
create trigger clinic_invitations_guard before update on public.clinic_invitations
  for each row execute function private.guard_identity();
create trigger billing_orders_guard before update on public.billing_orders
  for each row execute function private.guard_identity();
create trigger payments_guard before update on public.payments
  for each row execute function private.guard_identity();

-- Assignees must be active members of the same clinic. The composite foreign
-- key already guarantees "same clinic"; this adds "still active".
create or replace function private.validate_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null
     and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to)
     and not exists (
       select 1 from public.clinic_members m
       where m.clinic_id = new.clinic_id and m.id = new.assigned_to and m.status = 'active'
     ) then
    raise exception 'assignee must be an active member of this clinic' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger leads_assignee before insert or update on public.leads
  for each row execute function private.validate_assignee();
create trigger appointments_assignee before insert or update on public.appointments
  for each row execute function private.validate_assignee();
create trigger tasks_assignee before insert or update on public.tasks
  for each row execute function private.validate_assignee();

-- Leads: lost_reason is only meaningful for lost leads.
create or replace function private.lead_status_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'lost' then
    new.lost_reason := null;
  end if;
  return new;
end;
$$;

create trigger leads_status_rules before insert or update on public.leads
  for each row execute function private.lead_status_rules();

-- Appointments: valid state machine. Completed, cancelled and no-show are
-- final; time and type can only change while scheduled or confirmed.
create or replace function private.appointment_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('scheduled', 'confirmed') then
      raise exception 'new appointments must be scheduled or confirmed' using errcode = '23514';
    end if;
    new.cancel_reason := null;
    return new;
  end if;

  if old.status in ('completed', 'cancelled', 'no_show') then
    if new.status is distinct from old.status
       or new.starts_at is distinct from old.starts_at
       or new.duration_minutes is distinct from old.duration_minutes
       or new.appointment_type is distinct from old.appointment_type
       or new.patient_id is distinct from old.patient_id
       or new.lead_id is distinct from old.lead_id then
      raise exception 'appointment is closed (%)', old.status using errcode = '23514';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'scheduled' and new.status in ('confirmed', 'completed', 'cancelled', 'no_show'))
      or (old.status = 'confirmed' and new.status in ('scheduled', 'completed', 'cancelled', 'no_show'))
    ) then
      raise exception 'invalid appointment transition % -> %', old.status, new.status using errcode = '23514';
    end if;
  end if;

  if new.status <> 'cancelled' then
    new.cancel_reason := null;
  end if;
  return new;
end;
$$;

create trigger appointments_rules before insert or update on public.appointments
  for each row execute function private.appointment_rules();

-- Tasks: completion metadata is set by the database, not the client.
create or replace function private.task_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
    new.completed_by := coalesce(private.current_user_id(), 'system');
  elsif new.status <> 'done' then
    new.completed_at := null;
    new.completed_by := null;
  else
    new.completed_at := old.completed_at;
    new.completed_by := old.completed_by;
  end if;
  return new;
end;
$$;

create trigger tasks_rules before insert or update on public.tasks
  for each row execute function private.task_rules();

-- Activity trail ----------------------------------------------------------------

create or replace function private.record_activity(
  p_clinic_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_events (clinic_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (p_clinic_id, coalesce(private.current_user_id(), 'system'), p_entity_type, p_entity_id, p_action, p_metadata)
$$;

-- Records which fields changed and status transitions; never field values
-- that could contain personal data.
create or replace function private.log_row_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_changed text[];
  v_meta jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    if v_entity <> 'patient' and (to_jsonb(new) ? 'status') then
      v_meta := jsonb_build_object('status', to_jsonb(new) ->> 'status');
    end if;
    perform private.record_activity(new.clinic_id, v_entity, new.id, 'created', v_meta);
    return new;
  elsif tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}')
      into v_changed
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key not in ('updated_at', 'completed_at', 'completed_by');
    if cardinality(v_changed) = 0 then
      return new;
    end if;
    v_meta := jsonb_build_object('fields', to_jsonb(v_changed));
    if 'status' = any (v_changed) then
      v_meta := v_meta || jsonb_build_object('from', to_jsonb(old) ->> 'status', 'to', to_jsonb(new) ->> 'status');
    end if;
    perform private.record_activity(new.clinic_id, v_entity, new.id, 'updated', v_meta);
    return new;
  else
    -- Skip when the whole clinic is being deleted (cascade).
    if exists (select 1 from public.clinics c where c.id = old.clinic_id) then
      perform private.record_activity(old.clinic_id, v_entity, old.id, 'deleted', '{}'::jsonb);
    end if;
    return old;
  end if;
end;
$$;

create trigger patients_activity after insert or update or delete on public.patients
  for each row execute function private.log_row_activity('patient');
create trigger leads_activity after insert or update or delete on public.leads
  for each row execute function private.log_row_activity('lead');
create trigger appointments_activity after insert or update or delete on public.appointments
  for each row execute function private.log_row_activity('appointment');
create trigger tasks_activity after insert or update or delete on public.tasks
  for each row execute function private.log_row_activity('task');
