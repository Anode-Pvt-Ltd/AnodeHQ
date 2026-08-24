-- =============================================================
-- 0004 · 3D domain and leads domain
-- Spec §6.8
-- =============================================================

-- -------------------------------------------------------------
-- 3D
-- -------------------------------------------------------------
create table if not exists public.pcb_models (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            citext not null unique,
  -- Null means render the procedural board from the board definition.
  storage_path    text,
  poster_image_id uuid references public.media(id) on delete set null,
  env_map_path    text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes <= 8388608),
  triangle_count  int,
  compression     text[] not null default '{draco,ktx2}',
  board_definition jsonb,
  camera_default  jsonb not null default
    '{"position":[2.6,2.35,3.0],"target":[0,0,0],"fov":34}'::jsonb,
  camera_limits   jsonb not null default
    '{"minPolar":12,"maxPolar":82,"minZoom":0.55,"maxZoom":2.2}'::jsonb,
  scale           numeric not null default 1,
  is_hero         boolean not null default false,
  status          public.content_status not null default 'draft',
  published_at    timestamptz,
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Exactly one hero board can exist at a time.
create unique index if not exists one_hero_model
  on public.pcb_models (is_hero) where is_hero;

create table if not exists public.pcb_hotspots (
  id          uuid primary key default gen_random_uuid(),
  model_id    uuid not null references public.pcb_models(id) on delete cascade,
  label       text not null,
  value       text not null,
  detail      text,
  icon        text,
  position    jsonb not null,
  normal      jsonb not null default '{"x":0,"y":1,"z":0}'::jsonb,
  anchor      text not null default 'right' check (anchor in ('left','right','top','bottom')),
  body        text,
  link_url    text,
  variant_key text,
  order_index int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.pcb_model_variants (
  id           uuid primary key default gen_random_uuid(),
  model_id     uuid not null references public.pcb_models(id) on delete cascade,
  key          text not null,
  display_name text not null,
  icon         text not null default 'layers',
  config       jsonb not null default '{}'::jsonb,
  order_index  int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (model_id, key)
);

-- -------------------------------------------------------------
-- Leads — no anon policy is ever written for these (spec §7.3)
-- -------------------------------------------------------------
create table if not exists public.quote_requests (
  id                uuid primary key default gen_random_uuid(),
  reference         citext unique,
  full_name         text not null,
  email             citext not null,
  phone             text,
  company           text,
  country           text,
  how_heard         text,
  project_type      text,
  industry_id       uuid references public.industries(id) on delete set null,
  stage             public.project_stage,
  quantity_estimate text,
  timeline          text,
  budget_range      text,
  description       text not null check (length(description) between 20 and 5000),
  nda_required      boolean not null default false,
  status            public.quote_status not null default 'new',
  assigned_to       uuid references public.profiles(id) on delete set null,
  internal_notes    text,
  source            jsonb not null default '{}'::jsonb,
  ip_hash           text,
  user_agent        text,
  flags             text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists quote_requests_pipeline
  on public.quote_requests (status, created_at desc);
create index if not exists quote_requests_unassigned
  on public.quote_requests (created_at desc) where assigned_to is null;

create table if not exists public.quote_request_services (
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  service_id       uuid not null references public.services(id) on delete cascade,
  primary key (quote_request_id, service_id)
);

create table if not exists public.quote_attachments (
  id               uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  bucket           text not null default 'quote-attachments',
  path             text not null unique,
  filename         text not null,
  mime_type        text not null,
  size_bytes       bigint not null check (size_bytes <= 26214400),
  scanned          boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists public.quote_status_history (
  id               uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  from_status      public.quote_status,
  to_status        public.quote_status not null,
  changed_by       uuid references public.profiles(id) on delete set null,
  note             text,
  created_at       timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       citext not null,
  phone       text,
  subject     text,
  message     text not null check (length(message) between 10 and 5000),
  status      text not null default 'new' check (status in ('new','replied','archived','spam')),
  assigned_to uuid references public.profiles(id) on delete set null,
  source      jsonb not null default '{}'::jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           citext not null unique,
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','unsubscribed')),
  confirm_token   uuid not null default gen_random_uuid(),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz,
  source          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- -------------------------------------------------------------
-- Gapless per-year reference: ANQ-2026-0148
-- -------------------------------------------------------------
create or replace function app.assign_quote_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  y text := to_char(now(), 'YYYY');
  n int;
begin
  if new.reference is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('quote_ref_' || y));

  select coalesce(max(split_part(reference, '-', 3)::int), 0) + 1
    into n
    from public.quote_requests
   where reference like 'ANQ-' || y || '-%';

  new.reference := 'ANQ-' || y || '-' || lpad(n::text, 4, '0');
  return new;
end $$;

create or replace function app.log_quote_status()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.quote_status_history (quote_request_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end $$;
