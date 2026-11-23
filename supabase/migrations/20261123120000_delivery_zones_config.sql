create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  neighborhood text not null,
  fee numeric(10,2) not null default 0 check (fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists delivery_zones_neighborhood_unique
  on public.delivery_zones (lower(trim(neighborhood)));
alter table public.delivery_zones enable row level security;
grant select on public.delivery_zones to anon, authenticated;
grant insert, update, delete on public.delivery_zones to authenticated;
create policy "Anyone can read active delivery zones"
  on public.delivery_zones for select to anon, authenticated
  using (active = true or exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admins can insert delivery zones"
  on public.delivery_zones for insert to authenticated
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admins can update delivery zones"
  on public.delivery_zones for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())))
  with check (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
create policy "Admins can delete delivery zones"
  on public.delivery_zones for delete to authenticated
  using (exists (select 1 from public.admin_users where user_id = (select auth.uid())));
