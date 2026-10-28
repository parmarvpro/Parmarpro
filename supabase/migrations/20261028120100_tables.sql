-- ParmarPro tables.
--
-- Tenant integrity rules:
-- * Every clinic-owned table has clinic_id NOT NULL and UNIQUE (clinic_id, id).
-- * Every reference between clinic-owned rows is a composite foreign key on
--   (clinic_id, <ref>_id), so a row can never point at another clinic's row.
-- * clinic_id defaults to the caller's verified clinic. Clients are not
--   granted INSERT on clinic_id at all (see the grants migration).
-- * Emails are stored lower-cased (enforced by CHECK constraints).
-- * Patient data is limited to contact details and communication consent.
--   There are no clinical fields by design.

-- Clinics and membership ------------------------------------------------------

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  clerk_org_id text not null unique check (clerk_org_id ~ '^org_[A-Za-z0-9]{1,64}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  city text not null default 'Mumbai' check (char_length(btrim(city)) between 1 and 80),
  timezone text not null default 'Asia/Kolkata' check (timezone = 'Asia/Kolkata'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  clerk_user_id text not null check (clerk_user_id ~ '^user_[A-Za-z0-9]{1,64}$'),
  role public.member_role not null,
  status public.member_status not null default 'active',
  display_name text check (display_name is null or char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, clerk_user_id),
  unique (clinic_id, id)
);
create index clinic_members_user_idx on public.clinic_members (clerk_user_id);

-- Membership of the caller in the clinic named by the token's active
-- organization. SECURITY DEFINER so that RLS policies on clinic_members can
-- use it without recursing; it only ever returns the caller's own row.
create or replace function private.current_membership()
returns table (clinic_id uuid, member_id uuid, role public.member_role)
language sql
stable
security definer
set search_path = ''
as $$
  select m.clinic_id, m.id, m.role
  from public.clinic_members m
  join public.clinics c on c.id = m.clinic_id
  where c.clerk_org_id = private.active_org_id()
    and m.clerk_user_id = private.current_user_id()
    and m.status = 'active'
    and c.archived_at is null
  limit 1
$$;

create or replace function private.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select clinic_id from private.current_membership()
$$;

create or replace function private.current_member_role()
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from private.current_membership()
$$;

create or replace function private.has_role(roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role from private.current_membership()) = any (roles), false)
$$;

create table public.clinic_invitations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  email text not null check (char_length(email) <= 254 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.member_role not null check (role <> 'owner'),
  clerk_invitation_id text unique,
  status public.invitation_status not null default 'pending',
  invited_by text not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id)
);
create unique index clinic_invitations_pending_email_idx
  on public.clinic_invitations (clinic_id, email) where status = 'pending';

-- Operational records ---------------------------------------------------------

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default private.current_clinic_id() references public.clinics (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (char_length(email) <= 254 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  whatsapp_consent boolean not null default false,
  sms_consent boolean not null default false,
  email_consent boolean not null default false,
  consent_recorded_at timestamptz,
  opted_out_at timestamptz,
  archived_at timestamptz,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id)
);
create index patients_clinic_name_idx on public.patients (clinic_id, lower(full_name));
create index patients_clinic_phone_idx on public.patients (clinic_id, phone_e164);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default private.current_clinic_id() references public.clinics (id) on delete cascade,
  patient_id uuid,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (char_length(email) <= 254 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  source public.lead_source not null default 'other',
  status public.lead_status not null default 'new',
  assigned_to uuid,
  next_follow_up_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 2000),
  lost_reason text check (lost_reason is null or char_length(lost_reason) <= 300),
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id) on delete set null (patient_id),
  foreign key (clinic_id, assigned_to) references public.clinic_members (clinic_id, id)
);
create index leads_clinic_status_idx on public.leads (clinic_id, status, created_at desc);
create index leads_clinic_follow_up_idx on public.leads (clinic_id, next_follow_up_at) where next_follow_up_at is not null;
create index leads_clinic_name_idx on public.leads (clinic_id, lower(full_name));

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default private.current_clinic_id() references public.clinics (id) on delete cascade,
  patient_id uuid,
  lead_id uuid,
  starts_at timestamptz not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 480),
  appointment_type public.appointment_type not null default 'consultation',
  status public.appointment_status not null default 'scheduled',
  assigned_to uuid,
  notes text check (notes is null or char_length(notes) <= 1000),
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id),
  check (patient_id is not null or lead_id is not null),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  foreign key (clinic_id, lead_id) references public.leads (clinic_id, id),
  foreign key (clinic_id, assigned_to) references public.clinic_members (clinic_id, id)
);
create index appointments_clinic_start_idx on public.appointments (clinic_id, starts_at);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null default private.current_clinic_id() references public.clinics (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  due_at timestamptz,
  status public.task_status not null default 'open',
  assigned_to uuid,
  lead_id uuid,
  patient_id uuid,
  appointment_id uuid,
  completed_at timestamptz,
  completed_by text,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id),
  foreign key (clinic_id, assigned_to) references public.clinic_members (clinic_id, id),
  foreign key (clinic_id, lead_id) references public.leads (clinic_id, id) on delete set null (lead_id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id) on delete set null (patient_id),
  foreign key (clinic_id, appointment_id) references public.appointments (clinic_id, id) on delete set null (appointment_id)
);
create index tasks_clinic_status_due_idx on public.tasks (clinic_id, status, due_at);

-- Append-only audit trail. Metadata holds field names, enum transitions and
-- counts only, never personal data.
create table public.activity_events (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  actor_user_id text not null,
  entity_type text not null check (entity_type in ('clinic', 'member', 'invitation', 'lead', 'patient', 'appointment', 'task', 'billing')),
  entity_id uuid,
  action text not null check (action ~ '^[a-z_]{1,40}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) < 4096),
  created_at timestamptz not null default now()
);
create index activity_events_clinic_time_idx on public.activity_events (clinic_id, created_at desc);
create index activity_events_entity_idx on public.activity_events (clinic_id, entity_type, entity_id);

-- Billing ---------------------------------------------------------------------

create table public.clinic_entitlements (
  clinic_id uuid primary key references public.clinics (id) on delete cascade,
  plan_code text not null default 'parmarpro_clinic_monthly',
  trial_ends_at timestamptz,
  paid_through timestamptz,
  updated_at timestamptz not null default now()
);

create table public.billing_orders (
  id uuid primary key,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  provider_order_id text not null unique check (provider_order_id ~ '^order_[A-Za-z0-9]{1,64}$'),
  plan_code text not null,
  period_months integer not null check (period_months = 1),
  base_paise bigint not null check (base_paise > 0),
  gst_paise bigint not null check (gst_paise >= 0),
  amount_paise bigint not null,
  currency text not null default 'INR' check (currency = 'INR'),
  status public.billing_order_status not null default 'created',
  created_by text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, id),
  check (amount_paise = base_paise + gst_paise)
);
create index billing_orders_clinic_idx on public.billing_orders (clinic_id, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  billing_order_id uuid not null,
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  provider_payment_id text not null unique check (provider_payment_id ~ '^pay_[A-Za-z0-9]{1,64}$'),
  status public.payment_status not null,
  amount_paise bigint not null check (amount_paise >= 0),
  currency text not null default 'INR',
  method text check (method is null or method ~ '^[a-z_]{1,20}$'),
  error_code text check (error_code is null or char_length(error_code) <= 100),
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (clinic_id, billing_order_id) references public.billing_orders (clinic_id, id)
);
create index payments_clinic_idx on public.payments (clinic_id, created_at desc);

-- Provider webhooks. Only the service role can touch this table.
create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('razorpay', 'clerk')),
  event_id text not null check (char_length(event_id) between 1 and 200),
  event_type text not null check (char_length(event_type) between 1 and 100),
  status public.webhook_status not null default 'received',
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  error text check (error is null or char_length(error) <= 500),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

-- Marketing contact form (prospective clinics). Insert-only through an RPC.
create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  clinic_name text check (clinic_name is null or char_length(clinic_name) <= 120),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email is null or (char_length(email) <= 254 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  city text check (city is null or char_length(city) <= 80),
  message text check (message is null or char_length(message) <= 2000),
  created_at timestamptz not null default now(),
  check (phone_e164 is not null or email is not null)
);
create index contact_requests_created_idx on public.contact_requests (created_at desc);

create or replace function private.clinic_has_entitlement(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_entitlements e
    where e.clinic_id = p_clinic_id
      and greatest(coalesce(e.trial_ends_at, '-infinity'::timestamptz),
                   coalesce(e.paid_through, '-infinity'::timestamptz)) > now()
  )
$$;
