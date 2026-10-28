-- Row Level Security and least-privilege grants.
--
-- Access requires BOTH a Clerk-signed active-organization claim that maps to
-- a clinic AND an active clinic_members row for the token's subject (see
-- private.current_membership()). Grants are reviewed separately from
-- policies: RLS decides which rows, grants decide which tables/columns/verbs.

-- Start from nothing --------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.clinic_invitations enable row level security;
alter table public.patients enable row level security;
alter table public.leads enable row level security;
alter table public.appointments enable row level security;
alter table public.tasks enable row level security;
alter table public.activity_events enable row level security;
alter table public.clinic_entitlements enable row level security;
alter table public.billing_orders enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.contact_requests enable row level security;

-- Helper functions used inside policies must be executable by the caller.
grant execute on function
  private.jwt(),
  private.current_user_id(),
  private.active_org_id(),
  private.active_org_role(),
  private.current_membership(),
  private.current_clinic_id(),
  private.current_member_role(),
  private.has_role(public.member_role[]),
  private.clinic_has_entitlement(uuid)
to authenticated, service_role;

-- clinics -----------------------------------------------------------------------
grant select on public.clinics to authenticated;
grant update (name, city) on public.clinics to authenticated;

create policy clinics_select on public.clinics
  for select to authenticated
  using (id = (select private.current_clinic_id()));

create policy clinics_update on public.clinics
  for update to authenticated
  using (id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin']::public.member_role[])))
  with check (id = (select private.current_clinic_id()));

-- clinic_members: read-only to clients; changes go through RPCs ------------------
grant select on public.clinic_members to authenticated;

create policy clinic_members_select on public.clinic_members
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id()));

-- clinic_invitations: owners/admins can read; changes go through RPCs ------------
grant select on public.clinic_invitations to authenticated;

create policy clinic_invitations_select on public.clinic_invitations
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin']::public.member_role[])));

-- Operational tables ----------------------------------------------------------------
-- Pattern: every member reads; owner/admin/staff insert and update while the
-- clinic is entitled; owner/admin delete. Column grants exclude id, clinic_id,
-- created_by and timestamps so they can't be set or moved by clients.

-- patients
grant select on public.patients to authenticated;
grant insert (full_name, phone_e164, email, whatsapp_consent, sms_consent, email_consent,
              consent_recorded_at, opted_out_at)
  on public.patients to authenticated;
grant update (full_name, phone_e164, email, whatsapp_consent, sms_consent, email_consent,
              consent_recorded_at, opted_out_at, archived_at)
  on public.patients to authenticated;

create policy patients_select on public.patients
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id()));

create policy patients_insert on public.patients
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[]))
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

create policy patients_update on public.patients
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

-- leads
grant select, delete on public.leads to authenticated;
grant insert (patient_id, full_name, phone_e164, email, source, status, assigned_to,
              next_follow_up_at, notes, lost_reason)
  on public.leads to authenticated;
grant update (patient_id, full_name, phone_e164, email, source, status, assigned_to,
              next_follow_up_at, notes, lost_reason)
  on public.leads to authenticated;

create policy leads_select on public.leads
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id()));

create policy leads_insert on public.leads
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[]))
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

create policy leads_update on public.leads
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

create policy leads_delete on public.leads
  for delete to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin']::public.member_role[])));

-- appointments
grant select, delete on public.appointments to authenticated;
grant insert (patient_id, lead_id, starts_at, duration_minutes, appointment_type, status,
              assigned_to, notes)
  on public.appointments to authenticated;
grant update (starts_at, duration_minutes, appointment_type, status, assigned_to, notes,
              cancel_reason)
  on public.appointments to authenticated;

create policy appointments_select on public.appointments
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id()));

create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[]))
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

create policy appointments_update on public.appointments
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

create policy appointments_delete on public.appointments
  for delete to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin']::public.member_role[])));

-- tasks
grant select, delete on public.tasks to authenticated;
grant insert (title, description, due_at, status, assigned_to, lead_id, patient_id, appointment_id)
  on public.tasks to authenticated;
grant update (title, description, due_at, status, assigned_to, lead_id, patient_id, appointment_id)
  on public.tasks to authenticated;

create policy tasks_select on public.tasks
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id()));

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[]))
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

create policy tasks_update on public.tasks
  for update to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin', 'staff']::public.member_role[])))
  with check (clinic_id = (select private.current_clinic_id())
              and (select private.clinic_has_entitlement(private.current_clinic_id())));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin']::public.member_role[])));

-- activity_events: read-only; written by SECURITY DEFINER triggers --------------
grant select on public.activity_events to authenticated;

create policy activity_events_select on public.activity_events
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id()));

-- Billing: read-only to clients ------------------------------------------------------
grant select on public.clinic_entitlements to authenticated;
grant select on public.billing_orders to authenticated;
grant select on public.payments to authenticated;

create policy clinic_entitlements_select on public.clinic_entitlements
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id()));

create policy billing_orders_select on public.billing_orders
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin']::public.member_role[])));

create policy payments_select on public.payments
  for select to authenticated
  using (clinic_id = (select private.current_clinic_id())
         and (select private.has_role(array['owner', 'admin']::public.member_role[])));

-- webhook_events and contact_requests: no client grants and no policies.
-- RLS is enabled with zero policies, so even an accidental grant reads nothing.
