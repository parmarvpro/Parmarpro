-- Least privilege: my_membership() only reads rows the caller can already see
-- under RLS (own clinic, own membership, own entitlement), so it does not
-- need definer rights. (Supabase advisor 0029 review.)
alter function public.my_membership() security invoker;
