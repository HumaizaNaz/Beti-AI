-- Beti AI — Hissa 1 schema. Run once in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null unique,
  safe_pin_hash text,
  duress_pin_hash text,
  failed_pin_count int not null default 0,
  pin_locked_until timestamptz,
  lang text not null default 'ur' check (lang in ('ur', 'en')),
  created_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  relation text not null,
  phone text,
  email text,
  telegram_chat_id text,
  invite_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'connected', 'blocked')),
  created_at timestamptz not null default now()
);
create index contacts_user_idx on public.contacts(user_id);
create index contacts_chat_idx on public.contacts(telegram_chat_id);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_photo_path text,
  duration_min int not null,
  started_at timestamptz not null,
  deadline_at timestamptz not null,
  status text not null check (status in ('active', 'safe', 'alerted')),
  share_token text not null unique,
  share_expires_at timestamptz
);
create index trips_due_idx on public.trips(deadline_at) where status = 'active';
create index trips_user_idx on public.trips(user_id, started_at desc);

create table public.locations (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy_m double precision,
  recorded_at timestamptz not null
);
create index locations_trip_idx on public.locations(trip_id, recorded_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  reason text not null check (reason in ('timer', 'sos', 'duress', 'wrong_pin', 'help_page', 'calculator', 'test')),
  lat double precision,
  lng double precision,
  photo_path text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text
);
create index alerts_user_idx on public.alerts(user_id, created_at desc);

create table public.alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  channel text not null check (channel in ('telegram', 'email')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text
);
create index deliveries_retry_idx on public.alert_deliveries(status) where status <> 'sent';

-- RLS on, no policies: only the server (service_role) can read or write.
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.trips enable row level security;
alter table public.locations enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_deliveries enable row level security;

-- Private bucket for vehicle photos. Users may upload only into their own folder: <user_id>/<file>.
insert into storage.buckets (id, name, public) values ('vehicle-photos', 'vehicle-photos', false)
on conflict (id) do nothing;

create policy "users upload own vehicle photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-photos' and (storage.foldername(name))[1] = auth.uid()::text);
