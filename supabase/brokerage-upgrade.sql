-- NyumbaLink brokerage upgrade. Safe to run after schema.sql.
-- Broker/source contacts are stored separately and never exposed to public visitors.
create table if not exists public.nl_property_sources (
 property_id uuid primary key references public.nl_properties(id) on delete cascade,
 source_name text not null,
 source_phone text not null,
 source_url text,
 source_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.nl_inquiries add column if not exists customer_name text;
alter table public.nl_inquiries add column if not exists customer_email text;
alter table public.nl_inquiries add column if not exists commission_expected numeric(14,2) not null default 0;
alter table public.nl_inquiries add column if not exists commission_received numeric(14,2) not null default 0;
alter table public.nl_inquiries add column if not exists commission_status text not null default 'not_agreed';
alter table public.nl_inquiries drop constraint if exists nl_inquiries_status_check;
alter table public.nl_inquiries add constraint nl_inquiries_status_check
 check (status in ('new','contacted','viewing_arranged','negotiating','closed','lost'));
alter table public.nl_inquiries drop constraint if exists nl_inquiries_commission_status_check;
alter table public.nl_inquiries add constraint nl_inquiries_commission_status_check
 check (commission_status in ('not_agreed','expected','part_paid','paid'));
alter table public.nl_inquiries drop constraint if exists nl_inquiries_commission_expected_check;
alter table public.nl_inquiries add constraint nl_inquiries_commission_expected_check check (commission_expected>=0 and commission_received>=0 and commission_received<=commission_expected);
alter table public.nl_property_sources enable row level security;
drop policy if exists nl_sources_admin_only on public.nl_property_sources;
create policy nl_sources_admin_only on public.nl_property_sources for all to authenticated
 using (exists(select 1 from public.nl_profiles p where p.user_id=auth.uid() and p.account_type='admin'))
 with check (exists(select 1 from public.nl_profiles p where p.user_id=auth.uid() and p.account_type='admin'));
-- Public visitors may submit enquiries. Only admins can read/update them.
drop policy if exists nl_inquiries_buyer_insert on public.nl_inquiries;
drop policy if exists nl_inquiries_public_insert on public.nl_inquiries;
create policy nl_inquiries_public_insert on public.nl_inquiries for insert to anon,authenticated
 with check (property_id in (select id from public.nl_properties where status='available'));
drop policy if exists nl_inquiries_participant_read on public.nl_inquiries;
drop policy if exists nl_inquiries_admin_read on public.nl_inquiries;
create policy nl_inquiries_admin_read on public.nl_inquiries for select to authenticated
 using (exists(select 1 from public.nl_profiles p where p.user_id=auth.uid() and p.account_type='admin'));
drop policy if exists nl_inquiries_admin_update on public.nl_inquiries;
create policy nl_inquiries_admin_update on public.nl_inquiries for update to authenticated
 using (exists(select 1 from public.nl_profiles p where p.user_id=auth.uid() and p.account_type='admin'))
 with check (exists(select 1 from public.nl_profiles p where p.user_id=auth.uid() and p.account_type='admin'));
-- Lock profile role changes from normal browser sessions; role assignment is done in SQL by the project owner.
create or replace function public.nl_prevent_role_escalation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null and new.account_type is distinct from old.account_type then
  raise exception 'Account roles can only be changed by a trusted administrator.';
 end if;
 return new;
end; $$;
drop trigger if exists nl_profiles_role_guard on public.nl_profiles;
create trigger nl_profiles_role_guard before update on public.nl_profiles
 for each row execute function public.nl_prevent_role_escalation();
-- Do not expose legacy contact_phone through public property reads.
revoke select on public.nl_properties from anon, authenticated;
grant select (id,title,property_type,purpose,location,price,bedrooms,bathrooms,description,image_url,status,verified,featured_until,created_at,updated_at,user_id)
 on public.nl_properties to anon,authenticated;
grant insert,update,delete on public.nl_properties to authenticated;
grant insert on public.nl_inquiries to anon,authenticated;
grant select,update on public.nl_inquiries to authenticated;
grant select,insert,update,delete on public.nl_property_sources to authenticated;
-- Make a user an admin after they have registered (replace the email in this statement):
-- update public.nl_profiles p set account_type='admin'
-- from auth.users u where p.user_id=u.id and u.email='YOUR_LOGIN_EMAIL';
