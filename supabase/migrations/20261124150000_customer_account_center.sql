-- Customer account center: saved addresses and customer-owned order history.
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Casa',
  street text not null,
  street_number text not null,
  municipality text not null,
  neighborhood text not null,
  reference text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_addresses enable row level security;
grant select, insert, update, delete on public.customer_addresses to authenticated;
drop policy if exists "Customers manage own addresses" on public.customer_addresses;
create policy "Customers manage own addresses"
  on public.customer_addresses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders"
  on public.orders for select to authenticated
  using ((select auth.uid()) = customer_id);

drop policy if exists "Customers read own order items" on public.order_items;
create policy "Customers read own order items"
  on public.order_items for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.customer_id = (select auth.uid())
  ));
