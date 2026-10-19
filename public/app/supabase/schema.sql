-- AutoLedger starter schema for Supabase/PostgreSQL.
-- Run only in a new development project, review before production.
create extension if not exists pgcrypto;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'INR',
  created_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  preferred_language text not null default 'en'
    check (preferred_language in ('en','gu')),
  created_at timestamptz not null default now()
);
create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'partner' check (role in ('admin','partner')),
  joined_at timestamptz not null default now(),
  primary key (business_id,user_id)
);
create table public.cars (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  registration_number text,
  brand text not null,
  model text not null,
  year integer check (year between 1900 and 2100),
  ownership text,
  fuel_type text,
  transmission text,
  color text,
  odometer_km integer check (odometer_km >= 0),
  purchase_date date,
  status text not null default 'available'
    check (status in ('available','repairing','sold','archived')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id,registration_number)
);
create table public.car_costs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  car_id uuid not null references public.cars(id),
  category text not null check (category in ('purchase','repair','transport','commission','other')),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  cost_date date not null default current_date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.cost_contributions (
  id uuid primary key default gen_random_uuid(),
  cost_id uuid not null references public.car_costs(id) on delete cascade,
  business_id uuid not null references public.businesses(id),
  member_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (business_id,member_id) references public.business_members(business_id,user_id)
);
create table public.car_sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  car_id uuid not null unique references public.cars(id),
  sale_price numeric(12,2) not null check (sale_price > 0),
  sale_date date not null default current_date,
  buyer_name text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
-- Stores percentages for both modes. Fixed-amount mode is represented as a
-- percentage equivalent against the finalized net profit; add explicit amount
-- and method columns before using this as a production accounting ledger.
create table public.profit_allocations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  car_id uuid not null references public.cars(id),
  member_id uuid not null,
  share_percent numeric(5,2) not null check (share_percent between 0 and 100),
  agreed_at timestamptz not null default now(),
  foreign key (business_id,member_id) references public.business_members(business_id,user_id),
  unique (car_id,member_id)
);
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id),
  car_id uuid references public.cars(id),
  member_id uuid not null,
  payment_type text not null check (payment_type in ('profit','reimbursement','other')),
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  reference text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (business_id,member_id) references public.business_members(business_id,user_id)
);

create index cars_business_status_idx on public.cars(business_id,status);
create index costs_car_date_idx on public.car_costs(car_id,cost_date);
create index contributions_member_idx on public.cost_contributions(business_id,member_id);
create index sales_business_date_idx on public.car_sales(business_id,sale_date);
create index settlements_member_idx on public.settlements(business_id,member_id);

-- Membership helper. Keep membership changes restricted to a trusted setup/admin flow.
create or replace function public.is_business_member(target_business_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.business_members bm
    where bm.business_id = target_business_id and bm.user_id = (select auth.uid()));
$$;
revoke all on function public.is_business_member(uuid) from public, anon;
grant execute on function public.is_business_member(uuid) to authenticated;

-- Enable RLS on all business tables.
alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.business_members enable row level security;
alter table public.cars enable row level security;
alter table public.car_costs enable row level security;
alter table public.cost_contributions enable row level security;
alter table public.car_sales enable row level security;
alter table public.profit_allocations enable row level security;
alter table public.settlements enable row level security;

-- Membership visibility is limited to one's own membership rows and businesses
-- where the user is already a member.
create policy "Members view their businesses" on public.businesses
for select to authenticated using (public.is_business_member(id));
create policy "Users view own profile" on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy "Users update own profile" on public.profiles
for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Members view workspace membership" on public.business_members
for select to authenticated using (public.is_business_member(business_id));

create policy "Members read cars" on public.cars for select to authenticated
using (public.is_business_member(business_id));
create policy "Members insert cars" on public.cars for insert to authenticated
with check (public.is_business_member(business_id) and created_by = (select auth.uid()));
create policy "Members update cars" on public.cars for update to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Members delete cars" on public.cars for delete to authenticated
using (public.is_business_member(business_id));

create policy "Members read costs" on public.car_costs for select to authenticated
using (public.is_business_member(business_id));
create policy "Members insert costs" on public.car_costs for insert to authenticated
with check (public.is_business_member(business_id) and created_by = (select auth.uid()));
create policy "Members update costs" on public.car_costs for update to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Members delete costs" on public.car_costs for delete to authenticated
using (public.is_business_member(business_id));

create policy "Members read contributions" on public.cost_contributions for select to authenticated
using (public.is_business_member(business_id));
create policy "Members add contributions" on public.cost_contributions for insert to authenticated
with check (public.is_business_member(business_id));
create policy "Members update contributions" on public.cost_contributions for update to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Members delete contributions" on public.cost_contributions for delete to authenticated
using (public.is_business_member(business_id));

create policy "Members read sales" on public.car_sales for select to authenticated
using (public.is_business_member(business_id));
create policy "Members add sales" on public.car_sales for insert to authenticated
with check (public.is_business_member(business_id) and created_by = (select auth.uid()));
create policy "Members update sales" on public.car_sales for update to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Members delete sales" on public.car_sales for delete to authenticated
using (public.is_business_member(business_id));

create policy "Members read allocations" on public.profit_allocations for select to authenticated
using (public.is_business_member(business_id));
create policy "Members add allocations" on public.profit_allocations for insert to authenticated
with check (public.is_business_member(business_id));
create policy "Members update allocations" on public.profit_allocations for update to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Members delete allocations" on public.profit_allocations for delete to authenticated
using (public.is_business_member(business_id));

create policy "Members read settlements" on public.settlements for select to authenticated
using (public.is_business_member(business_id));
create policy "Members add settlements" on public.settlements for insert to authenticated
with check (public.is_business_member(business_id));
create policy "Members update settlements" on public.settlements for update to authenticated
using (public.is_business_member(business_id)) with check (public.is_business_member(business_id));
create policy "Members delete settlements" on public.settlements for delete to authenticated
using (public.is_business_member(business_id));

-- Important production TODOs:
-- 1. Add cross-table checks ensuring each car/cost/sale/allocation belongs to
--    the same business ID; do not trust business_id supplied by the browser.
-- 2. Add transactional RPCs/triggers for cost contribution totals, two-member
--    allocation totals, audit logs, soft deletion, and finalized-sale controls.
-- 3. Add secure admin-only business/member provisioning. Do not allow users to
--    self-assign admin roles or join arbitrary businesses.
-- 4. Add explicit share_method + fixed_amount columns for fixed-amount agreements.
-- 5. Restrict direct DELETE in production and use audited soft-delete RPCs instead.
