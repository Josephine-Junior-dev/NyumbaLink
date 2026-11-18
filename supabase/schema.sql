-- NyumbaLink database. Run this entire script in Supabase SQL Editor.
create extension if not exists pgcrypto;
create table if not exists public.nl_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text,
 phone text,
 account_type text not null default 'buyer' check (account_type in ('buyer','owner','agent','admin')),
 agency_name text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.nl_properties (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 5 and 120),
 property_type text not null check (property_type in ('House','Apartment','Land','Commercial')),
 purpose text not null default 'For sale' check (purpose in ('For sale','For rent')),
 location text not null,
 price numeric(14,2) not null check (price > 0),
 bedrooms integer not null default 0 check (bedrooms >= 0),
 bathrooms integer not null default 0 check (bathrooms >= 0),
 description text not null,
 image_url text,
 contact_phone text not null,
 status text not null default 'available' check (status in ('available','reserved','sold','rented','draft')),
 verified boolean not null default false,
 featured_until timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists nl_properties_search_idx on public.nl_properties(status,property_type,location,price);
create index if not exists nl_properties_owner_idx on public.nl_properties(user_id,created_at desc);
create table if not exists public.nl_favourites (
 user_id uuid not null references auth.users(id) on delete cascade,
 property_id uuid not null references public.nl_properties(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,property_id)
);
create table if not exists public.nl_inquiries (
 id uuid primary key default gen_random_uuid(),
 property_id uuid not null references public.nl_properties(id) on delete cascade,
 buyer_id uuid not null references auth.users(id) on delete cascade,
 message text not null,
 phone text,
 status text not null default 'new' check (status in ('new','contacted','closed')),
 created_at timestamptz not null default now()
);
create table if not exists public.nl_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan text not null check (plan in ('free','agent_basic','agent_pro','agency')),
 status text not null default 'pending' check (status in ('pending','active','cancelled','expired')),
 starts_at timestamptz,
 ends_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.nl_profiles enable row level security;
alter table public.nl_properties enable row level security;
alter table public.nl_favourites enable row level security;
alter table public.nl_inquiries enable row level security;
alter table public.nl_subscriptions enable row level security;
drop policy if exists nl_profiles_read_own on public.nl_profiles;
create policy nl_profiles_read_own on public.nl_profiles for select to authenticated using(user_id=auth.uid());
drop policy if exists nl_profiles_insert_own on public.nl_profiles;
create policy nl_profiles_insert_own on public.nl_profiles for insert to authenticated with check(user_id=auth.uid());
drop policy if exists nl_profiles_update_own on public.nl_profiles;
create policy nl_profiles_update_own on public.nl_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists nl_properties_public_read on public.nl_properties;
create policy nl_properties_public_read on public.nl_properties for select to anon,authenticated using(status='available' or user_id=auth.uid());
drop policy if exists nl_properties_insert_own on public.nl_properties;
create policy nl_properties_insert_own on public.nl_properties for insert to authenticated with check(user_id=auth.uid());
drop policy if exists nl_properties_update_own on public.nl_properties;
create policy nl_properties_update_own on public.nl_properties for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists nl_properties_delete_own on public.nl_properties;
create policy nl_properties_delete_own on public.nl_properties for delete to authenticated using(user_id=auth.uid());
drop policy if exists nl_favourites_own on public.nl_favourites;
create policy nl_favourites_own on public.nl_favourites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists nl_inquiries_buyer_insert on public.nl_inquiries;
create policy nl_inquiries_buyer_insert on public.nl_inquiries for insert to authenticated with check(buyer_id=auth.uid());
drop policy if exists nl_inquiries_participant_read on public.nl_inquiries;
create policy nl_inquiries_participant_read on public.nl_inquiries for select to authenticated using(buyer_id=auth.uid() or exists(select 1 from public.nl_properties p where p.id=property_id and p.user_id=auth.uid()));
drop policy if exists nl_subscriptions_read_own on public.nl_subscriptions;
create policy nl_subscriptions_read_own on public.nl_subscriptions for select to authenticated using(user_id=auth.uid());
drop policy if exists nl_subscriptions_insert_own on public.nl_subscriptions;
create policy nl_subscriptions_insert_own on public.nl_subscriptions for insert to authenticated with check(user_id=auth.uid() and status='pending');
grant usage on schema public to anon,authenticated;
grant select on public.nl_properties to anon,authenticated;
grant insert,update,delete on public.nl_properties to authenticated;
grant select,insert,update on public.nl_profiles to authenticated;
grant select,insert,delete on public.nl_favourites to authenticated;
grant select,insert on public.nl_inquiries to authenticated;
grant select,insert on public.nl_subscriptions to authenticated;
-- Note: subscription activation and verified/featured status must be performed by trusted admin/server logic, never by browser clients.
