-- Align delivery-zone schema with the storefront, admin panel, and order validation.
-- Preserve existing neighborhoods and fees while supplying safe defaults for the new fields.
alter table public.delivery_zones
  add column if not exists municipality text;

update public.delivery_zones
set municipality = 'Abreu e Lima'
where municipality is null or trim(municipality) = '';

alter table public.delivery_zones
  alter column municipality set default 'Abreu e Lima',
  alter column municipality set not null;

alter table public.delivery_zones
  add column if not exists estimated_distance_km numeric(8,2) not null default 0
    check (estimated_distance_km >= 0),
  add column if not exists eta_minutes integer not null default 40
    check (eta_minutes >= 0);

-- The previous uniqueness rule ignored municipality, which prevented the same
-- neighborhood name from being used in different municipalities.
drop index if exists public.delivery_zones_neighborhood_unique;
create unique index if not exists delivery_zones_municipality_neighborhood_unique
  on public.delivery_zones (lower(trim(municipality)), lower(trim(neighborhood)));

create index if not exists delivery_zones_active_lookup_idx
  on public.delivery_zones (active, lower(trim(municipality)), lower(trim(neighborhood)));
