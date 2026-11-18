create policy "admins can insert products"
on public.products
for insert
to authenticated
with check (
  exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  )
);
