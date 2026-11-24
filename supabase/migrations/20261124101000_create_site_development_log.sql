create table if not exists public.site_development_log (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 160),
  category text not null default 'Marco' check (category in ('Marco','Design','Implementação','Decisão','Infraestrutura','Correção','Planejamento')),
  status text not null default 'Concluído' check (status in ('Concluído','Em andamento','Planejado','Pausado')),
  details text not null default '',
  entry_date date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_development_log enable row level security;
grant select, insert, update, delete on public.site_development_log to authenticated;
create policy "Admins can read development log" on public.site_development_log for select to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));
create policy "Admins can insert development log" on public.site_development_log for insert to authenticated
with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));
create policy "Admins can update development log" on public.site_development_log for update to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));
create policy "Admins can delete development log" on public.site_development_log for delete to authenticated
using (exists (select 1 from public.admin_users au where au.user_id = (select auth.uid())));
insert into public.site_development_log (title,category,status,details)
values ('Registro inicial do desenvolvimento da Brasil Pizzas','Marco','Concluído',
'Registro retrospectivo do que já foi construído, sem atribuir datas exatas às etapas anteriores: identidade visual e landing page com estética marcante; cardápio com produtos e promoções editáveis; painel administrativo para pedidos, clientes e campanhas; configuração de bairros, taxas e prazos de entrega; editor visual com prévia desktop/mobile; fluxo de cadastro e autenticação de clientes; integração do login Google OAuth, testada e funcionando. A partir daqui, registrar neste diário novas decisões, implementações, correções, testes e pendências para manter a evolução documentada.');
