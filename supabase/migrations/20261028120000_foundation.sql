-- ParmarPro foundation: extensions, private schema, JWT helpers, enums and
-- default-privilege lockdown.
--
-- Identity comes from Clerk session tokens verified by Supabase's native
-- third-party auth. PostgREST exposes the verified claims through the
-- `request.jwt.claims` setting. Relevant claims:
--   sub    Clerk user id (user_...)
--   role   "authenticated" (added to the Clerk session token)
--   o.id   active Clerk organization id (org_...)  -> clinic
--   o.rol  Clerk organization role without the "org:" prefix ("admin"/"member")

-- Supabase grants ALL on new public tables, sequences and functions to the
-- anon and authenticated roles by default. ParmarPro grants every privilege
-- explicitly instead, so a forgotten GRANT fails closed.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- Helper functions live in a schema that the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.jwt()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function private.current_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(private.jwt() ->> 'sub', '')
$$;

create or replace function private.active_org_id()
returns text
language sql
stable
set search_path = ''
as $$
  -- Session token v2 ("o" claim) with a fallback for v1 tokens (org_id).
  select coalesce(nullif(private.jwt() -> 'o' ->> 'id', ''), nullif(private.jwt() ->> 'org_id', ''))
$$;

create or replace function private.active_org_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(private.jwt() -> 'o' ->> 'rol', ''),
                  nullif(replace(private.jwt() ->> 'org_role', 'org:', ''), ''))
$$;

-- Trial length for new clinics. Changing it requires a migration, so a client
-- can never choose its own trial length.
create or replace function private.trial_days()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 14
$$;

create type public.member_role as enum ('owner', 'admin', 'staff', 'viewer');
create type public.member_status as enum ('active', 'removed');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type public.lead_source as enum (
  'walk_in', 'phone_call', 'whatsapp', 'website', 'google', 'instagram',
  'facebook', 'referral', 'practo', 'justdial', 'other'
);
create type public.lead_status as enum (
  'new', 'contacted', 'qualified', 'appointment_booked', 'converted', 'lost'
);
create type public.appointment_type as enum ('consultation', 'follow_up', 'procedure', 'other');
create type public.appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.task_status as enum ('open', 'done', 'cancelled');
create type public.billing_order_status as enum ('created', 'paid', 'failed', 'expired');
create type public.payment_status as enum ('authorized', 'captured', 'failed', 'refunded');
create type public.webhook_status as enum ('received', 'processed', 'ignored', 'failed');
