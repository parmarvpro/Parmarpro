-- RPC functions. Each SECURITY DEFINER function enforces its own rules and is
-- granted to the narrowest role that needs it. All public functions start
-- with EXECUTE revoked from PUBLIC, anon and authenticated.

-- The caller's membership context in one round trip (used by the server-side
-- authorization layer). Returns zero rows when the caller has no active
-- membership in the token's active organization.
create or replace function public.my_membership()
returns table (
  clinic_id uuid,
  clinic_name text,
  clinic_city text,
  member_id uuid,
  role public.member_role,
  display_name text,
  entitled boolean,
  trial_ends_at timestamptz,
  paid_through timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.city, m.member_id, m.role, cm.display_name,
         private.clinic_has_entitlement(c.id), e.trial_ends_at, e.paid_through
  from private.current_membership() m
  join public.clinics c on c.id = m.clinic_id
  join public.clinic_members cm on cm.id = m.member_id
  left join public.clinic_entitlements e on e.clinic_id = c.id
$$;

-- Onboarding: create the clinic for the token's active Clerk organization.
-- Only a Clerk org admin (the organization creator) can do this, once.
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

  insert into public.clinic_entitlements (clinic_id, trial_ends_at)
  values (v_clinic_id, now() + make_interval(days => private.trial_days()));

  insert into public.activity_events (clinic_id, actor_user_id, entity_type, entity_id, action)
  values (v_clinic_id, v_user, 'clinic', v_clinic_id, 'created');

  return v_clinic_id;
end;
$$;

-- Shared rule check for role changes and removals (mirrors
-- src/server/auth/permissions.ts checkRoleChange).
create or replace function private.assert_can_manage_member(
  p_target public.clinic_members,
  p_new_role public.member_role
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_role public.member_role := private.current_member_role();
  v_manageable public.member_role[];
  v_owner_count integer;
begin
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_target.clinic_id is distinct from private.current_clinic_id() or p_target.status <> 'active' then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  if p_target.clerk_user_id = private.current_user_id() then
    raise exception 'members cannot change their own role or membership' using errcode = '42501';
  end if;
  if p_target.role = 'owner' then
    select count(*) into v_owner_count
    from public.clinic_members
    where clinic_id = p_target.clinic_id and role = 'owner' and status = 'active';
    if v_owner_count <= 1 then
      raise exception 'the last owner cannot be changed or removed' using errcode = '42501';
    end if;
  end if;
  v_manageable := case v_actor_role
    when 'owner' then array['admin', 'staff', 'viewer']::public.member_role[]
    else array['staff', 'viewer']::public.member_role[]
  end;
  if not (p_target.role = any (v_manageable)) then
    raise exception 'not permitted to manage this member' using errcode = '42501';
  end if;
  if p_new_role is not null and not (p_new_role = any (v_manageable)) then
    raise exception 'not permitted to assign this role' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.change_member_role(p_member_id uuid, p_new_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.clinic_members;
begin
  select * into v_target from public.clinic_members where id = p_member_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  perform private.assert_can_manage_member(v_target, p_new_role);
  if v_target.role = p_new_role then
    return;
  end if;
  update public.clinic_members set role = p_new_role where id = p_member_id;
  perform private.record_activity(v_target.clinic_id, 'member', v_target.id, 'role_changed',
    jsonb_build_object('from', v_target.role, 'to', p_new_role));
end;
$$;

-- Returns the removed member's Clerk user id so the server can remove the
-- Clerk organization membership afterwards.
create or replace function public.remove_member(p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.clinic_members;
begin
  select * into v_target from public.clinic_members where id = p_member_id for update;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  perform private.assert_can_manage_member(v_target, null);
  update public.clinic_members set status = 'removed' where id = p_member_id;
  perform private.record_activity(v_target.clinic_id, 'member', v_target.id, 'removed',
    jsonb_build_object('role', v_target.role));
  return v_target.clerk_user_id;
end;
$$;

create or replace function public.create_invitation(p_email text, p_role public.member_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.member_role := private.current_member_role();
  v_clinic uuid := private.current_clinic_id();
  v_id uuid;
begin
  if v_clinic is null or v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_role = 'owner' or (v_actor_role = 'admin' and p_role not in ('staff', 'viewer')) then
    raise exception 'not permitted to assign this role' using errcode = '42501';
  end if;
  insert into public.clinic_invitations (clinic_id, email, role, invited_by)
  values (v_clinic, lower(btrim(p_email)), p_role, private.current_user_id())
  returning id into v_id;
  perform private.record_activity(v_clinic, 'invitation', v_id, 'created', jsonb_build_object('role', p_role));
  return v_id;
end;
$$;

-- Links our invitation row to the Clerk invitation created by the server.
create or replace function public.attach_clerk_invitation(p_invitation_id uuid, p_clerk_invitation_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role(array['owner', 'admin']::public.member_role[]) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  update public.clinic_invitations
     set clerk_invitation_id = p_clerk_invitation_id
   where id = p_invitation_id
     and clinic_id = private.current_clinic_id()
     and status = 'pending'
     and clerk_invitation_id is null;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Returns the Clerk invitation id (if any) so the server can revoke it in Clerk.
create or replace function public.revoke_invitation(p_invitation_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.clinic_invitations;
begin
  select * into v_inv from public.clinic_invitations
   where id = p_invitation_id and clinic_id = private.current_clinic_id() and status = 'pending'
   for update;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if not private.has_role(array['owner', 'admin']::public.member_role[])
     or (private.current_member_role() = 'admin' and v_inv.role not in ('staff', 'viewer')) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  update public.clinic_invitations set status = 'revoked' where id = v_inv.id;
  perform private.record_activity(v_inv.clinic_id, 'invitation', v_inv.id, 'revoked', '{}'::jsonb);
  return v_inv.clerk_invitation_id;
end;
$$;

-- Service role only: called after the server has confirmed through the Clerk
-- Backend API that the user holds an organization membership created from
-- this invitation (email match + membership metadata).
create or replace function public.accept_invitation_membership(
  p_clerk_org_id text,
  p_clerk_user_id text,
  p_email text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clinic uuid;
  v_inv public.clinic_invitations;
  v_member uuid;
begin
  select id into v_clinic from public.clinics where clerk_org_id = p_clerk_org_id and archived_at is null;
  if v_clinic is null then
    raise exception 'clinic not found' using errcode = 'P0002';
  end if;

  select * into v_inv from public.clinic_invitations
   where clinic_id = v_clinic and email = lower(btrim(p_email)) and status = 'pending'
   for update;
  if not found then
    raise exception 'no pending invitation' using errcode = 'P0002';
  end if;

  insert into public.clinic_members (clinic_id, clerk_user_id, role, display_name)
  values (v_clinic, p_clerk_user_id, v_inv.role, nullif(btrim(p_display_name), ''))
  on conflict (clinic_id, clerk_user_id) do update
    set role = excluded.role, status = 'active', display_name = coalesce(excluded.display_name, public.clinic_members.display_name)
  returning id into v_member;

  update public.clinic_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;

  insert into public.activity_events (clinic_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (v_clinic, p_clerk_user_id, 'member', v_member, 'joined', jsonb_build_object('role', v_inv.role));
  return v_member;
end;
$$;

-- Service role only: Clerk said the membership/organization no longer exists.
create or replace function public.deactivate_membership_from_clerk(p_clerk_org_id text, p_clerk_user_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clinic_members m
     set status = 'removed'
    from public.clinics c
   where c.id = m.clinic_id
     and c.clerk_org_id = p_clerk_org_id
     and m.clerk_user_id = p_clerk_user_id
     and m.status = 'active'
$$;

create or replace function public.archive_clinic_from_clerk(p_clerk_org_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clinics set archived_at = coalesce(archived_at, now()) where clerk_org_id = p_clerk_org_id
$$;

-- Billing -----------------------------------------------------------------------

-- Service role only. Applies a payment that the server has already verified
-- (signature + server-side fetch from Razorpay). Idempotent: a payment id is
-- applied at most once and an order extends the paid period at most once,
-- even if the verify route and webhooks race.
create or replace function public.apply_verified_payment(
  p_billing_order_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount_paise bigint,
  p_currency text,
  p_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.billing_orders;
  v_paid_through timestamptz;
begin
  select * into v_order from public.billing_orders where id = p_billing_order_id for update;
  if not found or v_order.provider_order_id <> p_provider_order_id then
    raise exception 'unknown order' using errcode = 'P0002';
  end if;
  if p_amount_paise <> v_order.amount_paise or p_currency <> v_order.currency then
    raise exception 'amount or currency mismatch' using errcode = '22023';
  end if;
  if exists (select 1 from public.payments
              where provider_payment_id = p_provider_payment_id and billing_order_id <> v_order.id) then
    raise exception 'payment belongs to a different order' using errcode = '22023';
  end if;

  insert into public.payments (clinic_id, billing_order_id, provider_payment_id, status, amount_paise, currency, method, captured_at)
  values (v_order.clinic_id, v_order.id, p_provider_payment_id, 'captured', p_amount_paise, p_currency, p_method, now())
  on conflict (provider_payment_id) do update
    set status = 'captured', captured_at = coalesce(public.payments.captured_at, now())
    where public.payments.billing_order_id = excluded.billing_order_id;

  if v_order.status = 'paid' then
    select paid_through into v_paid_through from public.clinic_entitlements where clinic_id = v_order.clinic_id;
    return jsonb_build_object('applied', false, 'reason', 'already_paid', 'paid_through', v_paid_through);
  end if;

  update public.billing_orders set status = 'paid', paid_at = now() where id = v_order.id;

  insert into public.clinic_entitlements (clinic_id) values (v_order.clinic_id)
  on conflict (clinic_id) do nothing;

  update public.clinic_entitlements
     set paid_through = greatest(now(), coalesce(paid_through, now()), coalesce(trial_ends_at, now()))
                        + make_interval(months => v_order.period_months),
         plan_code = v_order.plan_code,
         updated_at = now()
   where clinic_id = v_order.clinic_id
  returning paid_through into v_paid_through;

  insert into public.activity_events (clinic_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (v_order.clinic_id, 'system', 'billing', v_order.id, 'payment_applied',
          jsonb_build_object('months', v_order.period_months));

  return jsonb_build_object('applied', true, 'paid_through', v_paid_through);
end;
$$;

-- Service role only. Records a failed (or merely authorized) payment attempt
-- without touching entitlement.
create or replace function public.record_payment_attempt(
  p_billing_order_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text,
  p_status public.payment_status,
  p_amount_paise bigint,
  p_currency text,
  p_method text default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.billing_orders;
begin
  if p_status not in ('authorized', 'failed') then
    raise exception 'only authorized or failed attempts can be recorded here' using errcode = '22023';
  end if;
  select * into v_order from public.billing_orders where id = p_billing_order_id;
  if not found or v_order.provider_order_id <> p_provider_order_id then
    raise exception 'unknown order' using errcode = 'P0002';
  end if;
  insert into public.payments (clinic_id, billing_order_id, provider_payment_id, status, amount_paise, currency, method, error_code)
  values (v_order.clinic_id, v_order.id, p_provider_payment_id, p_status, p_amount_paise, p_currency, p_method, left(p_error_code, 100))
  on conflict (provider_payment_id) do update
    set status = excluded.status, error_code = excluded.error_code
    where public.payments.status not in ('captured', 'refunded')
      and public.payments.billing_order_id = excluded.billing_order_id;
end;
$$;

-- Public contact form. Anonymous callers can submit but never read back. A
-- global ceiling limits floods; the API route adds per-IP limits and a honeypot.
create or replace function public.submit_contact_request(
  p_full_name text,
  p_clinic_name text,
  p_phone_e164 text,
  p_email text,
  p_city text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.contact_requests where created_at > now() - interval '10 minutes') >= 200 then
    raise exception 'too many requests' using errcode = '54000';
  end if;
  insert into public.contact_requests (full_name, clinic_name, phone_e164, email, city, message)
  values (btrim(p_full_name), nullif(btrim(p_clinic_name), ''), nullif(btrim(p_phone_e164), ''),
          nullif(lower(btrim(p_email)), ''), nullif(btrim(p_city), ''), nullif(btrim(p_message), ''));
end;
$$;

-- Dashboard summary. SECURITY INVOKER: every count runs under the caller's
-- RLS, so it can only ever aggregate the caller's own clinic.
create or replace function public.dashboard_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'leads_created', (select count(*) from public.leads where created_at >= p_from and created_at < p_to),
    'leads_by_status', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) as n from public.leads where created_at >= p_from and created_at < p_to group by status) s), '{}'::jsonb),
    'leads_converted', (select count(*) from public.leads where status = 'converted' and updated_at >= p_from and updated_at < p_to),
    'appointments_in_range', (select count(*) from public.appointments where starts_at >= p_from and starts_at < p_to),
    'appointments_by_status', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) as n from public.appointments where starts_at >= p_from and starts_at < p_to group by status) s), '{}'::jsonb),
    'tasks_completed', (select count(*) from public.tasks where status = 'done' and completed_at >= p_from and completed_at < p_to),
    'tasks_overdue', (select count(*) from public.tasks where status = 'open' and due_at < now()),
    'follow_ups_due', (select count(*) from public.leads where next_follow_up_at < now() and status not in ('converted', 'lost')),
    'patients_total', (select count(*) from public.patients where archived_at is null)
  )
$$;

-- Grants -------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

-- private helpers used inside policies, triggers and the functions above
grant execute on function
  private.jwt(),
  private.current_user_id(),
  private.active_org_id(),
  private.active_org_role(),
  private.trial_days(),
  private.current_membership(),
  private.current_clinic_id(),
  private.current_member_role(),
  private.has_role(public.member_role[]),
  private.clinic_has_entitlement(uuid)
to authenticated, service_role;

grant execute on function public.my_membership() to authenticated;
grant execute on function public.create_clinic_for_active_org(text, text, text) to authenticated;
grant execute on function public.change_member_role(uuid, public.member_role) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.create_invitation(text, public.member_role) to authenticated;
grant execute on function public.attach_clerk_invitation(uuid, text) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.dashboard_summary(timestamptz, timestamptz) to authenticated;
grant execute on function public.submit_contact_request(text, text, text, text, text, text) to anon, authenticated;

grant execute on function public.accept_invitation_membership(text, text, text, text) to service_role;
grant execute on function public.deactivate_membership_from_clerk(text, text) to service_role;
grant execute on function public.archive_clinic_from_clerk(text) to service_role;
grant execute on function public.apply_verified_payment(uuid, text, text, bigint, text, text) to service_role;
grant execute on function public.record_payment_attempt(uuid, text, text, public.payment_status, bigint, text, text, text) to service_role;
