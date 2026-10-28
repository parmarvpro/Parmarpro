-- Covering indexes for composite tenant foreign keys (Supabase performance
-- advisor 0001). They speed up joins, filters by assignee/patient/lead and
-- ON DELETE checks.
create index if not exists appointments_clinic_assigned_idx on public.appointments (clinic_id, assigned_to);
create index if not exists appointments_clinic_lead_idx on public.appointments (clinic_id, lead_id);
create index if not exists appointments_clinic_patient_idx on public.appointments (clinic_id, patient_id);
create index if not exists leads_clinic_assigned_idx on public.leads (clinic_id, assigned_to);
create index if not exists leads_clinic_patient_idx on public.leads (clinic_id, patient_id);
create index if not exists payments_clinic_order_idx on public.payments (clinic_id, billing_order_id);
create index if not exists tasks_clinic_appointment_idx on public.tasks (clinic_id, appointment_id);
create index if not exists tasks_clinic_assigned_idx on public.tasks (clinic_id, assigned_to);
create index if not exists tasks_clinic_lead_idx on public.tasks (clinic_id, lead_id);
create index if not exists tasks_clinic_patient_idx on public.tasks (clinic_id, patient_id);
