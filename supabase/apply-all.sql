-- =============================================================
-- Anode — complete schema + seed
-- Paste into the Supabase SQL editor and run once.
-- =============================================================

-- ─────── 0001_extensions_enums_helpers.sql ───────
-- =============================================================
-- 0001 · Extensions, enums and shared functions
-- Spec §6.2 – §6.3
-- =============================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext   with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists pg_net   with schema extensions;

create schema if not exists app;

-- -------------------------------------------------------------
-- Enums. The ORDER of app_role is the privilege hierarchy and is
-- load-bearing: policies compare with `role >= 'editor'`.
-- -------------------------------------------------------------
do $$ begin
  create type public.content_status as enum ('draft','scheduled','published','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.app_role as enum ('viewer','sales','editor','admin','owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.quote_status as enum ('new','reviewing','quoted','won','lost','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.project_stage as enum ('idea','schematic','prototype','production');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.media_kind as enum ('image','video','document','model');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- Internal settings store, used by triggers that need secrets.
-- -------------------------------------------------------------
create table if not exists app.settings (
  key   text primary key,
  value text not null
);
revoke all on app.settings from anon, authenticated;

create or replace function app.setting(p_key text)
returns text language sql stable security definer set search_path = '' as $$
  select value from app.settings where key = p_key;
$$;

-- -------------------------------------------------------------
-- Timestamps and authorship
-- -------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function app.set_actor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

-- NOTE: public.has_role() / is_staff() are defined in 0002, immediately
-- after profiles and user_roles exist. Postgres validates SQL function
-- bodies at CREATE time, so they cannot be declared before their tables.

-- -------------------------------------------------------------
-- Sliding-window rate limiter (spec §6.3)
-- -------------------------------------------------------------
create table if not exists public.rate_limits (
  id           bigint generated always as identity primary key,
  key_hash     text        not null,
  bucket       text        not null,
  window_start timestamptz not null default now()
);

create index if not exists rate_limits_lookup
  on public.rate_limits (key_hash, bucket, window_start desc);

create or replace function public.check_rate_limit(
  p_key text, p_bucket text, p_limit int, p_window interval
) returns boolean language plpgsql security definer set search_path = '' as $$
declare c int;
begin
  delete from public.rate_limits
   where window_start < now() - greatest(p_window, interval '1 day');

  select count(*) into c
    from public.rate_limits
   where key_hash = p_key
     and bucket   = p_bucket
     and window_start > now() - p_window;

  if c >= p_limit then
    return false;
  end if;

  insert into public.rate_limits (key_hash, bucket) values (p_key, p_bucket);
  return true;
end $$;

revoke execute on function public.check_rate_limit(text, text, int, interval) from anon, authenticated;

-- -------------------------------------------------------------
-- Cache invalidation. Fires /api/revalidate with the tags that the
-- changed row affects (spec §12.1).
-- -------------------------------------------------------------
create or replace function app.tags_for(p_table text, p_row jsonb)
returns text[] language plpgsql immutable as $$
declare s text := p_row->>'slug';
begin
  return case p_table
    when 'services'           then array_remove(array['services','projects','nav', case when s is not null then 'service:'||s end], null)
    when 'service_features'   then array['services']
    when 'industries'         then array_remove(array['industries','nav', case when s is not null then 'industry:'||s end], null)
    when 'industry_services'  then array['industries']
    when 'projects'           then array_remove(array['projects','industries', case when s is not null then 'project:'||s end], null)
    when 'project_services'   then array['projects']
    when 'project_media'      then array['projects']
    when 'project_metrics'    then array['projects']
    when 'posts'              then array_remove(array['posts', case when s is not null then 'post:'||s end], null)
    when 'post_topics'        then array['posts','topics']
    when 'process_stages'     then array['process']
    when 'testimonials'       then array['testimonials','projects']
    when 'clients'            then array['clients']
    when 'team_members'       then array['team','posts']
    when 'certifications'     then array['certifications']
    when 'stats'              then array['stats']
    when 'faqs'               then array['faqs']
    when 'media'              then array['media']
    when 'pcb_models'         then array['pcb:hero']
    when 'pcb_hotspots'       then array['pcb:hero']
    when 'pcb_model_variants' then array['pcb:hero']
    when 'site_settings'      then array['settings']
    when 'navigation_items'   then array['nav']
    else array[]::text[]
  end;
end $$;

create or replace function app.content_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tags text[];
  v_url  text := app.setting('revalidate_url');
  v_key  text := app.setting('revalidate_secret');
begin
  if v_url is null or v_key is null then
    return null;  -- not wired up yet; nothing to purge
  end if;

  v_tags := app.tags_for(tg_table_name, to_jsonb(coalesce(new, old)));
  if array_length(v_tags, 1) is null then
    return null;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('content-type','application/json','x-revalidate-secret', v_key),
    body    := jsonb_build_object('tags', to_jsonb(v_tags))
  );
  return null;
end $$;

-- ─────── 0002_identity_media_system.sql ───────
-- =============================================================
-- 0002 · Identity, media and system tables
-- Spec §6.4 – §6.5
-- =============================================================

-- -------------------------------------------------------------
-- Media folders must exist before media, and media before profiles
-- (profiles.avatar_id references it).
-- -------------------------------------------------------------
create table if not exists public.media_folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  parent_id   uuid references public.media_folders(id) on delete cascade,
  order_index int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null default 'media',
  path        text not null,
  filename    text not null,
  mime_type   text not null,
  kind        public.media_kind not null,
  size_bytes  bigint not null,
  width       int,
  height      int,
  blurhash    text,
  focal_x     numeric(4,3) not null default 0.5 check (focal_x between 0 and 1),
  focal_y     numeric(4,3) not null default 0.5 check (focal_y between 0 and 1),
  alt_text    text,
  caption     text,
  credit      text,
  folder_id   uuid references public.media_folders(id) on delete set null,
  uploaded_by uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (bucket, path),
  -- Enforced in the database, not the form: an image row without alt text
  -- cannot exist, so no public page can render one (spec §14.2).
  constraint media_alt_required check (
    kind <> 'image' or (alt_text is not null and length(btrim(alt_text)) > 0)
  ),
  constraint media_dims_for_images check (
    kind <> 'image' or (width is not null and height is not null)
  )
);

-- -------------------------------------------------------------
-- Profiles and roles — deliberately two tables (spec §7.4)
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  avatar_id    uuid references public.media(id) on delete set null,
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.media
  drop constraint if exists media_uploaded_by_fkey,
  add  constraint media_uploaded_by_fkey
       foreign key (uploaded_by) references public.profiles(id) on delete set null;

create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);

-- A new account can sign in and see nothing until an owner grants a role.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- The trigger only fires on INSERT, so any account that already existed when
-- the schema was applied would never get a profile — and would then be locked
-- out of /admin. Backfill them once, still with no role attached.
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- -------------------------------------------------------------
-- Audit log — append only
-- -------------------------------------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null,
  table_name text not null,
  record_id  uuid,
  diff       jsonb,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_record
  on public.audit_log (table_name, record_id, created_at desc);

create or replace function app.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  begin
    v_id := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);
  exception when others then
    v_id := null;
  end;

  insert into public.audit_log (actor_id, action, table_name, record_id, diff)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_id,
    jsonb_strip_nulls(jsonb_build_object(
      'old', case when tg_op <> 'INSERT' then to_jsonb(old) end,
      'new', case when tg_op <> 'DELETE' then to_jsonb(new) end
    ))
  );
  return null;
end $$;

-- -------------------------------------------------------------
-- Site settings, navigation, redirects
-- -------------------------------------------------------------
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  group_name text not null check (group_name in ('contact','seo','social','hero','copy','features')),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.navigation_items (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.navigation_items(id) on delete cascade,
  label        text not null,
  href         text not null,
  description  text,
  icon         text,
  location     text not null check (location in ('header','footer','mobile')),
  column_group text,
  order_index  int  not null default 0,
  is_external  boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.redirects (
  id          uuid primary key default gen_random_uuid(),
  source      text not null unique,
  destination text not null,
  permanent   boolean not null default true,
  hit_count   int not null default 0,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- The only privilege test. SECURITY DEFINER so that policies on
-- user_roles do not recurse into themselves.
-- -------------------------------------------------------------
create or replace function public.has_role(uid uuid, required public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles  p on p.id = r.user_id
    where r.user_id = uid
      and p.is_active
      and r.role >= required
  );
$$;

revoke execute on function public.has_role(uuid, public.app_role) from anon;
grant  execute on function public.has_role(uuid, public.app_role) to authenticated;

-- Convenience wrapper for policies
create or replace function public.is_staff(required public.app_role default 'viewer')
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role(auth.uid(), required);
$$;

-- -------------------------------------------------------------
-- Commercial access is NOT a rank comparison.
--
-- app_role is ordered viewer < sales < editor < admin < owner, so
-- `role >= 'sales'` would also match editor — and an editor must not
-- see quote requests or contact messages. sales and editor are sibling
-- capabilities: one handles commercial records, the other content.
-- Only admin and owner hold both.
-- -------------------------------------------------------------
create or replace function public.is_sales()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_roles r
    join public.profiles  p on p.id = r.user_id
    where r.user_id = auth.uid()
      and p.is_active
      and (r.role = 'sales' or r.role >= 'admin')
  );
$$;

revoke execute on function public.is_sales() from anon;
grant  execute on function public.is_sales() to authenticated;

-- ─────── 0003_content.sql ───────
-- =============================================================
-- 0003 · Content domain — 17 tables
-- Spec §6.6 – §6.7
-- =============================================================

-- Shared column set on every content table:
--   id, status, published_at, order_index, created_by, updated_by,
--   created_at, updated_at

create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_light_id uuid references public.media(id) on delete set null,
  logo_dark_id  uuid references public.media(id) on delete set null,
  logo_mark     text,
  website_url   text,
  featured      boolean not null default false,
  order_index   int not null default 0,
  status        public.content_status not null default 'published',
  published_at  timestamptz default now(),
  created_by    uuid references public.profiles(id),
  updated_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.services (
  id              uuid primary key default gen_random_uuid(),
  slug            citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           text not null,
  tagline         text,
  summary         text not null check (length(summary) <= 200),
  body_html       text,
  body            jsonb,
  icon            text not null default 'circuit-board',
  accent          text,
  hero_image_id   uuid references public.media(id) on delete set null,
  og_image_id     uuid references public.media(id) on delete set null,
  deliverables    text[] not null default '{}',
  tooling         jsonb  not null default '[]'::jsonb,
  order_index     int not null default 0,
  status          public.content_status not null default 'draft',
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  search_vector   tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')),   'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_html, '')), 'C')
  ) stored
);

create table if not exists public.service_features (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.services(id) on delete cascade,
  title       text not null,
  description text,
  icon        text,
  order_index int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.industries (
  id              uuid primary key default gen_random_uuid(),
  slug            citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null,
  summary         text not null,
  body_html       text,
  body            jsonb,
  icon            text not null default 'factory',
  standards       text[] not null default '{}',
  hero_image_id   uuid references public.media(id) on delete set null,
  order_index     int not null default 0,
  status          public.content_status not null default 'draft',
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.industry_services (
  industry_id uuid not null references public.industries(id) on delete cascade,
  service_id  uuid not null references public.services(id)   on delete cascade,
  order_index int not null default 0,
  primary key (industry_id, service_id)
);

create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  slug             citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            text not null,
  client_name      text,
  client_id        uuid references public.clients(id)   on delete set null,
  industry_id      uuid references public.industries(id) on delete set null,
  summary          text not null check (length(summary) <= 300),
  challenge        text,
  approach         text,
  outcome          text,
  body_html        text,
  body             jsonb,
  cover_image_id   uuid references public.media(id) on delete set null,
  year             int check (year between 2000 and 2100),
  duration_weeks   int check (duration_weeks > 0),
  board_spec       jsonb not null default '{}'::jsonb,
  is_confidential  boolean not null default false,
  featured         boolean not null default false,
  order_index      int not null default 0,
  status           public.content_status not null default 'draft',
  published_at     timestamptz,
  seo_title        text,
  seo_description  text,
  created_by       uuid references public.profiles(id),
  updated_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  search_vector    tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')),   'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english',
      coalesce(challenge, '') || ' ' || coalesce(approach, '') || ' ' || coalesce(outcome, '')), 'C')
  ) stored,
  -- A confidential case study may carry a description but never a linked client
  constraint confidential_has_no_client check (not is_confidential or client_id is null)
);

create table if not exists public.project_services (
  project_id  uuid not null references public.projects(id) on delete cascade,
  service_id  uuid not null references public.services(id) on delete cascade,
  order_index int not null default 0,
  primary key (project_id, service_id)
);

create table if not exists public.project_media (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  media_id    uuid not null references public.media(id)    on delete cascade,
  kind        public.media_kind not null default 'image',
  caption     text,
  order_index int not null default 0
);

create table if not exists public.project_metrics (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  label       text not null,
  value       text not null,
  unit        text,
  order_index int not null default 0
);

create table if not exists public.process_stages (
  id                uuid primary key default gen_random_uuid(),
  step_number       int not null unique,
  title             text not null,
  short_description text not null check (length(short_description) <= 140),
  detail            jsonb not null default '{}'::jsonb,
  icon              text not null default 'lightbulb',
  status            public.content_status not null default 'published',
  published_at      timestamptz default now(),
  order_index       int not null default 0,
  created_by        uuid references public.profiles(id),
  updated_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.team_members (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  role         text not null,
  bio          text,
  photo_id     uuid references public.media(id) on delete set null,
  linkedin_url text,
  email        text,
  order_index  int not null default 0,
  status       public.content_status not null default 'published',
  published_at timestamptz default now(),
  created_by   uuid references public.profiles(id),
  updated_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.post_topics (
  id          uuid primary key default gen_random_uuid(),
  slug        citext not null unique,
  name        text not null,
  description text,
  order_index int not null default 0
);

create table if not exists public.posts (
  id              uuid primary key default gen_random_uuid(),
  slug            citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title           text not null,
  excerpt         text not null,
  body_html       text,
  body            jsonb,
  cover_image_id  uuid references public.media(id) on delete set null,
  topic_id        uuid references public.post_topics(id) on delete set null,
  author_id       uuid references public.team_members(id) on delete set null,
  read_minutes    int not null default 1,
  order_index     int not null default 0,
  status          public.content_status not null default 'draft',
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  created_by      uuid references public.profiles(id),
  updated_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  search_vector   tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')),   'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body_html, '')), 'C')
  ) stored
);

create table if not exists public.testimonials (
  id           uuid primary key default gen_random_uuid(),
  quote        text not null,
  author_name  text not null,
  author_role  text,
  company      text,
  avatar_id    uuid references public.media(id) on delete set null,
  project_id   uuid references public.projects(id) on delete set null,
  industry_id  uuid references public.industries(id) on delete set null,
  featured     boolean not null default false,
  order_index  int not null default 0,
  status       public.content_status not null default 'published',
  published_at timestamptz default now(),
  created_by   uuid references public.profiles(id),
  updated_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.certifications (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  issuer       text not null,
  logo_id      uuid references public.media(id) on delete set null,
  description  text,
  valid_until  date,
  order_index  int not null default 0,
  status       public.content_status not null default 'published',
  published_at timestamptz default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.stats (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  value        numeric not null,
  prefix       text not null default '',
  suffix       text not null default '',
  context      text not null default 'home' check (context in ('home','about','why')),
  order_index  int not null default 0,
  status       public.content_status not null default 'published',
  published_at timestamptz default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.faqs (
  id           uuid primary key default gen_random_uuid(),
  question     text not null,
  answer       text not null,
  scope        text not null default 'services',
  order_index  int not null default 0,
  status       public.content_status not null default 'published',
  published_at timestamptz default now(),
  created_by   uuid references public.profiles(id),
  updated_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─────── 0004_pcb_leads.sql ───────
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

-- ─────── 0005_indexes_triggers_rpc.sql ───────
-- =============================================================
-- 0005 · Indexes, triggers and RPC functions
-- Spec §6.9 – §6.11
-- =============================================================

-- -------------------------------------------------------------
-- Indexes.  now() is not IMMUTABLE so it cannot appear in a partial
-- index predicate — index both columns and let the planner use the
-- composite (spec §6.9).
-- -------------------------------------------------------------
create index if not exists services_publication   on public.services   (status, published_at desc);
create index if not exists projects_publication    on public.projects   (status, published_at desc);
create index if not exists posts_publication       on public.posts      (status, published_at desc);
create index if not exists industries_publication  on public.industries (status, published_at desc);

create index if not exists projects_industry on public.projects (industry_id) where industry_id is not null;
create index if not exists projects_featured on public.projects (featured, order_index) where featured;
create index if not exists project_services_service on public.project_services (service_id);
create index if not exists industry_services_service on public.industry_services (service_id);
create index if not exists posts_topic  on public.posts (topic_id);
create index if not exists posts_author on public.posts (author_id);

create index if not exists services_search on public.services using gin (search_vector);
create index if not exists projects_search on public.projects using gin (search_vector);
create index if not exists posts_search    on public.posts    using gin (search_vector);
create index if not exists projects_title_trgm on public.projects using gin (title extensions.gin_trgm_ops);

create index if not exists media_folder on public.media (folder_id);
create index if not exists media_kind_idx on public.media (kind);
-- The "missing alt text" queue in the admin media library
create index if not exists media_missing_alt on public.media (id) where alt_text is null;
create index if not exists hotspots_model on public.pcb_hotspots (model_id, order_index);

-- Ordering integrity: one order_index per parent
create unique index if not exists service_features_order on public.service_features (service_id, order_index);
create unique index if not exists project_media_order    on public.project_media    (project_id, order_index);
create unique index if not exists project_metrics_order  on public.project_metrics  (project_id, order_index);
create unique index if not exists pcb_hotspots_order     on public.pcb_hotspots     (model_id, order_index);

-- -------------------------------------------------------------
-- Attach the shared triggers everywhere they belong
-- -------------------------------------------------------------
do $$
declare
  t text;
  updated_at_tables text[] := array[
    'media','media_folders','profiles','site_settings','navigation_items',
    'services','service_features','industries','projects','process_stages','team_members',
    'posts','testimonials','clients','certifications','stats','faqs',
    'pcb_models','pcb_hotspots','pcb_model_variants','quote_requests','contact_messages'
  ];
  actor_tables text[] := array[
    'services','industries','projects','process_stages','team_members','posts',
    'testimonials','clients','faqs','pcb_models'
  ];
  audit_tables text[] := array[
    'services','service_features','industries','industry_services','projects',
    'project_services','project_media','project_metrics','process_stages','posts',
    'post_topics','testimonials','clients','team_members','certifications','stats','faqs',
    'media','media_folders','pcb_models','pcb_hotspots','pcb_model_variants',
    'quote_requests','quote_attachments','contact_messages','newsletter_subscribers',
    'site_settings','navigation_items','redirects','user_roles','profiles'
  ];
  revalidate_tables text[] := array[
    'services','service_features','industries','industry_services','projects',
    'project_services','project_media','project_metrics','process_stages','posts',
    'post_topics','testimonials','clients','team_members','certifications','stats','faqs',
    'media','pcb_models','pcb_hotspots','pcb_model_variants','site_settings','navigation_items'
  ];
begin
  foreach t in array updated_at_tables loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function app.set_updated_at()', t);
  end loop;

  foreach t in array actor_tables loop
    execute format('drop trigger if exists set_actor on public.%I', t);
    execute format(
      'create trigger set_actor before insert or update on public.%I
       for each row execute function app.set_actor()', t);
  end loop;

  foreach t in array audit_tables loop
    execute format('drop trigger if exists audit_row on public.%I', t);
    execute format(
      'create trigger audit_row after insert or update or delete on public.%I
       for each row execute function app.audit_row()', t);
  end loop;

  foreach t in array revalidate_tables loop
    execute format('drop trigger if exists content_changed on public.%I', t);
    execute format(
      'create trigger content_changed after insert or update or delete on public.%I
       for each row execute function app.content_changed()', t);
  end loop;
end $$;

drop trigger if exists assign_quote_reference on public.quote_requests;
create trigger assign_quote_reference
  before insert on public.quote_requests
  for each row execute function app.assign_quote_reference();

drop trigger if exists log_quote_status on public.quote_requests;
create trigger log_quote_status
  after update of status on public.quote_requests
  for each row execute function app.log_quote_status();

-- -------------------------------------------------------------
-- Slug change writes a redirect so old links never 404 (spec §16.3)
-- -------------------------------------------------------------
create or replace function app.redirect_on_slug_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare prefix text;
begin
  if new.slug is not distinct from old.slug then
    return null;
  end if;

  prefix := case tg_table_name
    when 'services'   then '/services/'
    when 'industries' then '/industries/'
    when 'projects'   then '/projects/'
    when 'posts'      then '/insights/'
  end;

  if prefix is null then
    return null;
  end if;

  insert into public.redirects (source, destination, permanent)
  values (prefix || old.slug, prefix || new.slug, true)
  on conflict (source) do update set destination = excluded.destination;

  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['services','industries','projects','posts'] loop
    execute format('drop trigger if exists redirect_on_slug_change on public.%I', t);
    execute format(
      'create trigger redirect_on_slug_change after update of slug on public.%I
       for each row execute function app.redirect_on_slug_change()', t);
  end loop;
end $$;

-- Read time computed on save, never typed
create or replace function app.compute_read_minutes()
returns trigger language plpgsql as $$
begin
  new.read_minutes := greatest(
    1,
    round(array_length(regexp_split_to_array(coalesce(new.body_html, ''), '\s+'), 1) / 220.0)::int
  );
  return new;
end $$;

drop trigger if exists compute_read_minutes on public.posts;
create trigger compute_read_minutes
  before insert or update of body_html on public.posts
  for each row execute function app.compute_read_minutes();

-- =============================================================
-- RPC — spec §6.10
-- =============================================================

create or replace function public.industries_with_counts()
returns table (
  id uuid, slug citext, name text, summary text, icon text,
  standards text[], order_index int, status public.content_status,
  published_at timestamptz, project_count bigint
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.slug, i.name, i.summary, i.icon, i.standards, i.order_index,
         i.status, i.published_at,
         count(p.id) filter (
           where p.status = 'published' and p.published_at <= now()
         ) as project_count
  from public.industries i
  left join public.projects p on p.industry_id = i.id
  where i.status = 'published' and i.published_at <= now()
  group by i.id
  order by i.order_index;
$$;

grant execute on function public.industries_with_counts() to anon, authenticated;

create or replace function public.search_all(q text, lim int default 20)
returns table (kind text, slug citext, title text, excerpt text, rank real)
language sql stable security definer set search_path = '' as $$
  with query as (select websearch_to_tsquery('english', q) as tsq)
  select 'service'::text, s.slug, s.title, s.summary,
         ts_rank(s.search_vector, query.tsq)
    from public.services s, query
   where s.status = 'published' and s.published_at <= now()
     and s.search_vector @@ query.tsq
  union all
  select 'project'::text, p.slug, p.title, p.summary,
         ts_rank(p.search_vector, query.tsq)
    from public.projects p, query
   where p.status = 'published' and p.published_at <= now()
     and p.search_vector @@ query.tsq
  union all
  select 'post'::text, b.slug, b.title, b.excerpt,
         ts_rank(b.search_vector, query.tsq)
    from public.posts b, query
   where b.status = 'published' and b.published_at <= now()
     and b.search_vector @@ query.tsq
  order by 5 desc   -- ordinal: UNION output names come from the first branch
  limit greatest(1, least(lim, 50));
$$;

grant execute on function public.search_all(text, int) to anon, authenticated;

-- Status change and history in one transaction
create or replace function public.move_quote_status(
  p_id uuid, p_to public.quote_status, p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_from public.quote_status;
begin
  if not public.is_sales() then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select status into v_from from public.quote_requests where id = p_id for update;
  if not found then
    raise exception 'quote not found' using errcode = 'P0002';
  end if;

  update public.quote_requests set status = p_to where id = p_id;

  insert into public.quote_status_history (quote_request_id, from_status, to_status, changed_by, note)
  values (p_id, v_from, p_to, auth.uid(), p_note);
end $$;

revoke execute on function public.move_quote_status(uuid, public.quote_status, text) from anon;
grant  execute on function public.move_quote_status(uuid, public.quote_status, text) to authenticated;

-- Rewrites a whole sibling set in one statement, so drag-and-drop is one request
create or replace function public.reorder(p_table text, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role(auth.uid(), 'editor') then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_table not in (
    'services','service_features','industries','projects','project_media','project_metrics',
    'process_stages','posts','testimonials','clients','team_members','certifications',
    'stats','faqs','pcb_hotspots','pcb_model_variants','navigation_items','post_topics'
  ) then
    raise exception 'table not reorderable: %', p_table using errcode = '22023';
  end if;

  execute format(
    'update public.%I t
        set order_index = v.idx
       from (select unnest($1::uuid[]) as id, generate_subscripts($1::uuid[], 1) as idx) v
      where t.id = v.id', p_table)
  using p_ids;
end $$;

revoke execute on function public.reorder(text, uuid[]) from anon;
grant  execute on function public.reorder(text, uuid[]) to authenticated;

-- ─────── 0006_rls.sql ───────
-- =============================================================
-- 0006 · Row Level Security
-- Spec §7. Every table falls into exactly one of three categories.
-- =============================================================

-- =============================================================
-- Category A — public content
--   anon: SELECT where published
--   authenticated: SELECT all if viewer; write if editor; delete if admin
-- Child tables test their PARENT's publication state, otherwise a
-- draft project's metrics are readable by anyone who guesses the
-- table name (spec §7.2).
-- =============================================================

do $$
declare
  t text;
  parented text[][] := array[
    ['service_features',   'services',   'service_id'],
    ['project_media',      'projects',   'project_id'],
    ['project_metrics',    'projects',   'project_id'],
    ['pcb_hotspots',       'pcb_models', 'model_id'],
    ['pcb_model_variants', 'pcb_models', 'model_id']
  ];
  -- Tables that carry status + published_at of their own
  standalone text[] := array[
    'services','industries','projects','process_stages','team_members','posts',
    'testimonials','clients','certifications','stats','faqs','pcb_models'
  ];
  i int;
begin
  ---------------------------------------------------------------
  -- Standalone content tables
  ---------------------------------------------------------------
  foreach t in array standalone loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);

    execute format('drop policy if exists "anon reads published" on public.%I', t);
    execute format($f$
      create policy "anon reads published" on public.%I
        for select to anon, authenticated
        using (status = 'published' and published_at is not null and published_at <= now())
    $f$, t);

    execute format('drop policy if exists "staff read all" on public.%I', t);
    execute format($f$
      create policy "staff read all" on public.%I
        for select to authenticated using (public.is_staff('viewer'))
    $f$, t);

    execute format('drop policy if exists "editors insert" on public.%I', t);
    execute format($f$
      create policy "editors insert" on public.%I
        for insert to authenticated with check (public.is_staff('editor'))
    $f$, t);

    execute format('drop policy if exists "editors update" on public.%I', t);
    execute format($f$
      create policy "editors update" on public.%I
        for update to authenticated
        using (public.is_staff('editor')) with check (public.is_staff('editor'))
    $f$, t);

    execute format('drop policy if exists "admins delete" on public.%I', t);
    execute format($f$
      create policy "admins delete" on public.%I
        for delete to authenticated using (public.is_staff('admin'))
    $f$, t);
  end loop;

  ---------------------------------------------------------------
  -- Child tables — visibility inherited from the parent
  ---------------------------------------------------------------
  for i in 1 .. array_length(parented, 1) loop
    t := parented[i][1];
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);

    execute format('drop policy if exists "anon reads published parent" on public.%I', t);
    execute format($f$
      create policy "anon reads published parent" on public.%I
        for select to anon, authenticated
        using (exists (
          select 1 from public.%I p
          where p.id = %I
            and p.status = 'published'
            and p.published_at is not null
            and p.published_at <= now()
        ))
    $f$, t, parented[i][2], parented[i][3]);

    execute format('drop policy if exists "staff read all" on public.%I', t);
    execute format($f$
      create policy "staff read all" on public.%I
        for select to authenticated using (public.is_staff('viewer'))
    $f$, t);

    execute format('drop policy if exists "editors write" on public.%I', t);
    execute format($f$
      create policy "editors write" on public.%I
        for all to authenticated
        using (public.is_staff('editor')) with check (public.is_staff('editor'))
    $f$, t);
  end loop;
end $$;

-- Join tables: readable by anyone, writable by editors.
do $$
declare t text;
begin
  foreach t in array array['industry_services','project_services','post_topics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format($f$
      create policy "public read" on public.%I for select to anon, authenticated using (true)
    $f$, t);
    execute format('drop policy if exists "editors write" on public.%I', t);
    execute format($f$
      create policy "editors write" on public.%I for all to authenticated
        using (public.is_staff('editor')) with check (public.is_staff('editor'))
    $f$, t);
  end loop;
end $$;

-- Media: public read (files are public anyway), editors write, admins delete.
alter table public.media         enable row level security;
alter table public.media         force  row level security;
alter table public.media_folders enable row level security;
alter table public.media_folders force  row level security;

drop policy if exists "public read media" on public.media;
create policy "public read media" on public.media
  for select to anon, authenticated using (true);

drop policy if exists "editors write media" on public.media;
create policy "editors write media" on public.media
  for insert to authenticated with check (public.is_staff('editor'));

drop policy if exists "editors update media" on public.media;
create policy "editors update media" on public.media
  for update to authenticated
  using (public.is_staff('editor')) with check (public.is_staff('editor'));

drop policy if exists "admins delete media" on public.media;
create policy "admins delete media" on public.media
  for delete to authenticated using (public.is_staff('admin'));

drop policy if exists "public read folders" on public.media_folders;
create policy "public read folders" on public.media_folders
  for select to anon, authenticated using (true);

drop policy if exists "editors write folders" on public.media_folders;
create policy "editors write folders" on public.media_folders
  for all to authenticated
  using (public.is_staff('editor')) with check (public.is_staff('editor'));

-- =============================================================
-- Category B — private records
-- RLS is on and there is deliberately NO anon policy at all, so an
-- anonymous SELECT returns zero rows and an anonymous INSERT is
-- denied. The only writer is the service-role client behind the
-- gate in §10.2.
-- =============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'quote_requests','quote_request_services','quote_attachments',
    'quote_status_history','contact_messages','newsletter_subscribers'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);

    execute format('drop policy if exists "sales read" on public.%I', t);
    execute format($f$
      create policy "sales read" on public.%I
        for select to authenticated using (public.is_sales())
    $f$, t);

    execute format('drop policy if exists "sales update" on public.%I', t);
    execute format($f$
      create policy "sales update" on public.%I
        for update to authenticated
        using (public.is_sales()) with check (public.is_sales())
    $f$, t);

    execute format('drop policy if exists "owners delete" on public.%I', t);
    execute format($f$
      create policy "owners delete" on public.%I
        for delete to authenticated using (public.is_staff('owner'))
    $f$, t);
  end loop;
end $$;

-- =============================================================
-- Category C — system tables
-- =============================================================

-- profiles: read self or any staff; update only your own name and avatar.
-- RLS cannot restrict columns, so the column grant does that part.
alter table public.profiles enable row level security;
alter table public.profiles force  row level security;

drop policy if exists "read self or staff" on public.profiles;
create policy "read self or staff" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff('viewer'));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant  update (full_name, avatar_id, last_seen_at) on public.profiles to authenticated;

-- user_roles: owners only, and never your own row. This is the
-- privilege-escalation door, closed explicitly (spec §7.4).
alter table public.user_roles enable row level security;
alter table public.user_roles force  row level security;

drop policy if exists "read own or admin" on public.user_roles;
create policy "read own or admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff('admin'));

drop policy if exists "only owners grant roles" on public.user_roles;
create policy "only owners grant roles" on public.user_roles
  for all to authenticated
  using      (public.is_staff('owner') and user_id <> auth.uid())
  with check (public.is_staff('owner') and user_id <> auth.uid());

-- audit_log: admins may read. NO insert/update/delete policy for any
-- role — rows arrive only through the SECURITY DEFINER trigger, so the
-- log cannot be edited from the application at all.
alter table public.audit_log enable row level security;
alter table public.audit_log force  row level security;

drop policy if exists "admins read audit" on public.audit_log;
create policy "admins read audit" on public.audit_log
  for select to authenticated using (public.is_staff('admin'));

-- site_settings: anon may read the public groups only.
alter table public.site_settings enable row level security;
alter table public.site_settings force  row level security;

drop policy if exists "anon reads public groups" on public.site_settings;
create policy "anon reads public groups" on public.site_settings
  for select to anon, authenticated
  using (group_name in ('contact','social','seo','hero','copy'));

drop policy if exists "staff read all settings" on public.site_settings;
create policy "staff read all settings" on public.site_settings
  for select to authenticated using (public.is_staff('viewer'));

drop policy if exists "admins write settings" on public.site_settings;
create policy "admins write settings" on public.site_settings
  for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- navigation_items: public read, admins write.
alter table public.navigation_items enable row level security;
alter table public.navigation_items force  row level security;

drop policy if exists "public read nav" on public.navigation_items;
create policy "public read nav" on public.navigation_items
  for select to anon, authenticated using (is_active or public.is_staff('viewer'));

drop policy if exists "admins write nav" on public.navigation_items;
create policy "admins write nav" on public.navigation_items
  for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- redirects: middleware reads them with the anon key.
alter table public.redirects enable row level security;
alter table public.redirects force  row level security;

drop policy if exists "public read redirects" on public.redirects;
create policy "public read redirects" on public.redirects
  for select to anon, authenticated using (true);

drop policy if exists "admins write redirects" on public.redirects;
create policy "admins write redirects" on public.redirects
  for all to authenticated
  using (public.is_staff('admin')) with check (public.is_staff('admin'));

-- rate_limits: no policy for anyone. Reached only through
-- check_rate_limit(), which is SECURITY DEFINER.
alter table public.rate_limits enable row level security;
alter table public.rate_limits force  row level security;

-- ─────── 0007_storage.sql ───────
-- =============================================================
-- 0007 · Storage buckets and policies
-- Spec §9.1 – §9.2
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 10485760, array[
    'image/jpeg','image/png','image/webp','image/avif','image/svg+xml','video/mp4'
  ]),
  ('pcb-models', 'pcb-models', true, 8388608, array[
    'model/gltf-binary','model/gltf+json','application/octet-stream',
    'image/ktx2','image/vnd.radiance','image/webp','image/png'
  ]),
  ('quote-attachments', 'quote-attachments', false, 26214400, array[
    'application/pdf','application/zip','application/x-zip-compressed',
    'application/x-7z-compressed','application/octet-stream',
    'image/png','image/jpeg','text/csv','text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]),
  ('brand', 'brand', true, 2097152, array['image/svg+xml','image/png'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- -------------------------------------------------------------
-- Public buckets: anyone reads, editors write, admins delete.
-- -------------------------------------------------------------
drop policy if exists "public read public buckets" on storage.objects;
create policy "public read public buckets" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('media', 'pcb-models', 'brand'));

drop policy if exists "editors insert public buckets" on storage.objects;
create policy "editors insert public buckets" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('media', 'pcb-models', 'brand') and public.is_staff('editor'));

drop policy if exists "editors update public buckets" on storage.objects;
create policy "editors update public buckets" on storage.objects
  for update to authenticated
  using (bucket_id in ('media', 'pcb-models', 'brand') and public.is_staff('editor'))
  with check (bucket_id in ('media', 'pcb-models', 'brand') and public.is_staff('editor'));

drop policy if exists "admins delete public buckets" on storage.objects;
create policy "admins delete public buckets" on storage.objects
  for delete to authenticated
  using (bucket_id in ('media', 'pcb-models', 'brand') and public.is_staff('admin'));

-- -------------------------------------------------------------
-- quote-attachments is private and has NO select policy at all —
-- not even for staff. Sales reach files only through a 60-second
-- signed URL minted server-side after a role check, and every mint
-- is written to audit_log (spec §9.4).
-- The client upload arrives on a signed upload URL, which is issued
-- by the service role and so does not consult these policies either.
-- -------------------------------------------------------------

-- Objects with no matching database row after 24 hours are orphans.
create or replace function app.sweep_orphan_media()
returns integer language plpgsql security definer set search_path = '' as $$
declare removed int := 0;
begin
  with orphans as (
    select o.name
      from storage.objects o
     where o.bucket_id = 'media'
       and o.created_at < now() - interval '24 hours'
       and not exists (select 1 from public.media m where m.path = o.name and m.bucket = 'media')
  )
  delete from storage.objects o using orphans
   where o.bucket_id = 'media' and o.name = orphans.name;

  get diagnostics removed = row_count;
  return removed;
end $$;

revoke execute on function app.sweep_orphan_media() from anon, authenticated;

-- ─────── seed.sql ───────
-- =============================================================
-- Anode seed data
-- GENERATED by scripts/gen-seed.ts — do not edit by hand.
-- Idempotent: ids are derived from slugs, so re-running upserts.
-- =============================================================

begin;

-- ---------- site_settings ----------
insert into public.site_settings (key, value, group_name) values ('hero.eyebrow', '"Electronics Design Services"'::jsonb, 'hero')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('hero.headline_lines', '["We design.","Engineer.","Bring ideas to life."]'::jsonb, 'hero')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('hero.accent_word', '"life."'::jsonb, 'hero')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('hero.subcopy', '"Anode delivers end-to-end electronic design solutions from concept and prototyping to production-ready products that make an impact."'::jsonb, 'hero')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('hero.cta_primary', '{"label":"Explore Services","href":"/services"}'::jsonb, 'hero')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('hero.cta_secondary', '{"label":"View Our Work","href":"/projects"}'::jsonb, 'hero')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('hero.proof_caption', '"for startups and brands worldwide"'::jsonb, 'hero')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('copy.process_heading', '"A streamlined process.\nBuilt for results."'::jsonb, 'copy')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('copy.section_headings', '{"services":{"eyebrow":"What We Do","heading":"Complete electronics design solutions under one roof.","intro":"We handle every stage of the product development lifecycle with precision, innovation and care."},"work":{"eyebrow":"Featured Work","heading":"Ideas we''ve brought to life."},"clients":{"eyebrow":"Trusted by Innovators","heading":""},"industries":{"eyebrow":"Industries","heading":"Sectors we build for.","intro":"Each one imposes its own constraints — compliance, environment, lifecycle. We design to them from the first schematic sheet."},"why":{"eyebrow":"Why Anode","heading":"Engineering judgement you can audit.","intro":"Four things clients tell us make the difference, each one measurable rather than asserted."},"insights":{"eyebrow":"Insights","heading":"Notes from the bench.","intro":"Practical write-ups from problems we have actually had to solve."},"process":{"eyebrow":"Our Process","heading":"A streamlined process. Built for results."}}'::jsonb, 'copy')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('copy.cta_band', '{"heading":"Have a board that needs designing?","body":"Send us the constraints — schematic, mechanical envelope, volume, timeline. You will get a considered response from an engineer within one business day, not a brochure.","primary":{"label":"Request a Quote","href":"/quote"},"secondary":{"label":"Talk to an engineer","href":"/contact"}}'::jsonb, 'copy')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('copy.differentiators', '[{"icon":"search-check","title":"We tell you what we measured","claim":"Every claim in a report traces to a number from a bench.","evidence":"Efficiency curves, noise floors, thermal images and current traces are delivered as data, not adjectives. Where margin is thin we say so rather than averaging it away."},{"icon":"layers","title":"Hardware and firmware in one team","claim":"Test points land where debug actually needs them.","evidence":"Because the same engineers lay out the board and write the bring-up firmware, pin assignments respect the routing and the peripheral matrix at the same time — and bring-up starts the day boards arrive."},{"icon":"file-check","title":"Documentation is a deliverable","claim":"You receive source files, not a PDF and a dependency on us.","evidence":"Altium or KiCad projects, firmware repositories, build systems, test procedures and an issue register with every finding, its root cause and its disposition."},{"icon":"shield-check","title":"Compliance designed in, not chased","claim":"First-time EMC pass rate across the last 24 projects: 21 of 24.","evidence":"Pre-compliance probing happens on the first prototype, while the layout can still change. The three that failed did so on findings we had already flagged as accepted risks."}]'::jsonb, 'copy')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('copy.comparison', '{"columns":["In-house hire","Freelance contractor","Anode"],"rows":[{"label":"Time to productive output","cells":["3–6 months","1–3 weeks","1 week"]},{"label":"Breadth across analog, PCB, firmware","cells":["One specialism","One specialism","Full team"]},{"label":"Lab and instrumentation","cells":["You buy it","Usually none","Included"]},{"label":"Cover during absence","cells":["None","None","Team continuity"]},{"label":"Compliance experience","cells":["Varies","Varies","Standing capability"]},{"label":"You own the source files","cells":["Yes","Negotiable","Yes, always"]},{"label":"Commitment","cells":["Permanent headcount","Per engagement","Per project or retained"]}]}'::jsonb, 'copy')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('contact.company_name', '"Anode"'::jsonb, 'contact')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('contact.legal_name', '"Anode Electronics Ltd"'::jsonb, 'contact')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('contact.email', '"hello@anode.example"'::jsonb, 'contact')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('contact.sales_email', '"quotes@anode.example"'::jsonb, 'contact')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('contact.phone', '"+44 20 7946 0231"'::jsonb, 'contact')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('contact.address_lines', '["Unit 12, Kestrel Works","48 Faraday Road","Cambridge CB1 3TN","United Kingdom"]'::jsonb, 'contact')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('contact.hours', '[{"day":"Monday – Thursday","hours":"08:30 – 18:00"},{"day":"Friday","hours":"08:30 – 16:30"},{"day":"Saturday – Sunday","hours":"Closed"}]'::jsonb, 'contact')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('contact.response_promise', '"We reply within one business day, from an engineer."'::jsonb, 'contact')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('contact.geo', '{"lat":52.2053,"lng":0.1218,"zoom":13}'::jsonb, 'contact')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('social.links', '[{"label":"LinkedIn","href":"https://www.linkedin.com/company/anode","icon":"linkedin"},{"label":"GitHub","href":"https://github.com/anode","icon":"github"},{"label":"YouTube","href":"https://youtube.com/@anode","icon":"youtube"}]'::jsonb, 'social')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('seo.title_template', '"%s | Anode"'::jsonb, 'seo')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('seo.default_title', '"Anode — Electronics Design & Engineering"'::jsonb, 'seo')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('seo.description', '"Anode delivers end-to-end electronics design: circuit and schematic design, high-speed multilayer PCB layout, embedded firmware, prototyping, test and manufacturing support."'::jsonb, 'seo')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('seo.timezone', '"Europe/London"'::jsonb, 'seo')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;
insert into public.site_settings (key, value, group_name) values ('features.flags', '{"pcb3d":true,"newsletter":true,"search":true,"insights":true}'::jsonb, 'features')
  on conflict (key) do update set value = excluded.value, group_name = excluded.group_name;

-- ---------- navigation_items ----------
insert into public.navigation_items (id, label, href, description, icon, location, column_group, order_index, is_external)
  values ('21723e50-8405-476e-a577-a93ea577d5be', 'Services', '/services', null, null, 'header', null, 1, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, order_index = excluded.order_index;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('b617fc18-1d33-42fa-ab24-3ee2d34bbf12', '21723e50-8405-476e-a577-a93ea577d5be', 'Circuit & Schematic Design', '/services/circuit-and-schematic-design', 'Topology, analog front ends and manufacturable schematics.', 'cpu', 'header', 1, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('b91800d1-a2c6-43f3-abde-a3225bdea4c4', '21723e50-8405-476e-a577-a93ea577d5be', 'PCB Layout & High-Speed', '/services/pcb-layout-and-high-speed-design', 'Controlled impedance, clean returns, dense assemblies.', 'circuit-board', 'header', 2, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('b817ff3e-07e1-44a0-aff6-cb9ebff933de', '21723e50-8405-476e-a577-a93ea577d5be', 'Embedded & Firmware', '/services/embedded-systems-and-firmware', 'Testable firmware with secure boot and OTA update.', 'microchip', 'header', 3, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('bb1803f7-d502-4309-ae1a-20fe901a2700', '21723e50-8405-476e-a577-a93ea577d5be', 'Prototyping & Bring-Up', '/services/prototyping-and-bring-up', 'Structured bring-up and characterisation you can trust.', 'box', 'header', 4, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('ba180264-36ae-477e-acb6-b51af0c6b9e2', '21723e50-8405-476e-a577-a93ea577d5be', 'Test & Compliance', '/services/test-and-compliance', 'Pre-compliance, verification and production test.', 'clipboard-check', 'header', 5, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('bd18071d-4656-4887-ab4e-5f9a036e5fa4', '21723e50-8405-476e-a577-a93ea577d5be', 'Manufacturing Support', '/services/manufacturing-support', 'DFM, DFA, BOM optimisation and transfer.', 'factory', 'header', 6, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, label, href, description, icon, location, column_group, order_index, is_external)
  values ('408bd67d-cdd0-4723-ad5b-315e0e5cbda0', 'Work', '/projects', null, null, 'header', null, 2, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, order_index = excluded.order_index;
insert into public.navigation_items (id, label, href, description, icon, location, column_group, order_index, is_external)
  values ('5e40077e-8fe6-4a2c-a1a6-dd52ee26e1aa', 'Industries', '/industries', null, null, 'header', null, 3, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, order_index = excluded.order_index;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('3a4ee5de-72d3-41ec-a89d-2432ad22a7ca', '5e40077e-8fe6-4a2c-a1a6-dd52ee26e1aa', 'Medical Devices', '/industries/medical-devices', null, 'heart-pulse', 'header', 1, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('394ee44b-5354-41c1-aa1a-858a8ca3460c', '5e40077e-8fe6-4a2c-a1a6-dd52ee26e1aa', 'Industrial & IIoT', '/industries/industrial-and-iiot', null, 'factory', 'header', 2, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('384ee2b8-3c5e-4116-a410-33ae74adb3ce', '5e40077e-8fe6-4a2c-a1a6-dd52ee26e1aa', 'Automotive & EV', '/industries/automotive-and-ev', null, 'car-front', 'header', 3, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('3f4eedbd-0939-4a6b-a677-27d64888b828', '5e40077e-8fe6-4a2c-a1a6-dd52ee26e1aa', 'Consumer Products', '/industries/consumer-products', null, 'smartphone', 'header', 4, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('3e4eec2a-b815-4418-a65b-9832f6646042', '5e40077e-8fe6-4a2c-a1a6-dd52ee26e1aa', 'Energy & Power', '/industries/energy-and-power', null, 'zap', 'header', 5, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('3d4eea97-62cb-458d-af85-df1aa01a2024', '5e40077e-8fe6-4a2c-a1a6-dd52ee26e1aa', 'Agritech', '/industries/agritech', null, 'sprout', 'header', 6, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('3c4ee904-0f3e-4612-a370-df164b8d1f16', '5e40077e-8fe6-4a2c-a1a6-dd52ee26e1aa', 'Aerospace & Defence', '/industries/aerospace-and-defence', null, 'plane', 'header', 7, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, label, href, description, icon, location, column_group, order_index, is_external)
  values ('443b9fed-c42b-45b1-a010-0a5c0867359e', 'Process', '/process', null, null, 'header', null, 4, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, order_index = excluded.order_index;
insert into public.navigation_items (id, label, href, description, icon, location, column_group, order_index, is_external)
  values ('1df14445-c339-4ed5-aec8-6a90e12a731a', 'About', '/about', null, null, 'header', null, 5, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, order_index = excluded.order_index;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('2a3b44f6-69b7-4854-a38c-bca293f33d4a', '1df14445-c339-4ed5-aec8-6a90e12a731a', 'About Anode', '/about', null, 'building-2', 'header', 1, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('293b4363-bdf0-4c89-a4cb-8feae72c0fec', '1df14445-c339-4ed5-aec8-6a90e12a731a', 'Why Anode', '/why-anode', null, 'award', 'header', 2, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('283b41d0-1f9d-40fe-a7a6-212e47d8a2ce', '1df14445-c339-4ed5-aec8-6a90e12a731a', 'The Team', '/about/team', null, 'users', 'header', 3, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, parent_id, label, href, description, icon, location, order_index, is_external)
  values ('2f3b4cd5-8bb5-4d73-a48e-01a6baf09a48', '1df14445-c339-4ed5-aec8-6a90e12a731a', 'Lab & Facilities', '/about/facilities', null, 'flask-conical', 'header', 4, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, description = excluded.description;
insert into public.navigation_items (id, label, href, description, icon, location, column_group, order_index, is_external)
  values ('1c133255-c13b-4c63-ad28-7e36dd4e7eb8', 'Insights', '/insights', null, null, 'header', null, 6, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, order_index = excluded.order_index;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('76b65519-16b2-49b7-a004-0cae8d68aed0', 'Circuit & Schematic Design', '/services/circuit-and-schematic-design', 'footer', 'Services', 1, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('73b65060-8508-4b6e-a6be-ab0ef8bf4bce', 'PCB Layout & High-Speed', '/services/pcb-layout-and-high-speed-design', 'footer', 'Services', 2, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('74b651f3-2655-4b39-a2e3-3aca9b0bbd2c', 'Embedded & Firmware', '/services/embedded-systems-and-firmware', 'footer', 'Services', 3, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('79b659d2-563b-4890-af8d-2142cff1d262', 'Prototyping & Bring-Up', '/services/prototyping-and-bring-up', 'footer', 'Services', 4, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('7ab65b65-efe0-4a63-a556-21066a96d5c8', 'Test & Compliance', '/services/test-and-compliance', 'footer', 'Services', 5, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('77b656ac-817c-42aa-a6ca-6406f9328956', 'Manufacturing Support', '/services/manufacturing-support', 'footer', 'Services', 6, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('f6de2e09-e7e6-4947-a138-e74edec4f750', 'About Anode', '/about', 'footer', 'Company', 1, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('f3de2950-a5de-4b3e-a600-526e99bca48e', 'Why Anode', '/why-anode', 'footer', 'Company', 2, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('f4de2ae3-f789-4ac9-a357-f02aec6805ac', 'The Team', '/about/team', 'footer', 'Company', 3, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('f9de32c2-f808-4f60-a1d6-0da2f1e67222', 'Lab & Facilities', '/about/facilities', 'footer', 'Company', 4, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('fade3455-3021-4fb3-aaff-4be62affb408', 'Our Process', '/process', 'footer', 'Company', 5, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('7ab899fc-4483-48fa-ae3b-b106bf3bc2f6', 'Case Studies', '/projects', 'footer', 'Resources', 1, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('7db89eb5-ca16-49f3-a7ae-974647cea8a8', 'Industries', '/industries', 'footer', 'Resources', 2, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('7cb89d22-2f30-4aa0-a388-0782abe937c2', 'Insights', '/insights', 'footer', 'Resources', 3, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('77b89543-fc51-4909-abe9-1c4a740a1e4c', 'Request a Quote', '/quote', 'footer', 'Resources', 4, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('76b893b0-5dfe-4d7e-ab46-8eced4b6b12e', 'Contact', '/contact', 'footer', 'Resources', 5, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('06e502fe-e683-46f0-a066-740eed6879ee', 'Privacy Policy', '/legal/privacy', 'footer', 'Legal', 1, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('05e5016b-d0ea-4a45-a50f-3b2ed6cf3bb0', 'Terms of Service', '/legal/terms', 'footer', 'Legal', 2, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;
insert into public.navigation_items (id, label, href, location, column_group, order_index, is_external)
  values ('04e4ffd8-1304-4e8a-a7e0-615217e99e62', 'Cookie Policy', '/legal/cookies', 'footer', 'Legal', 3, false)
  on conflict (id) do update set label = excluded.label, href = excluded.href, column_group = excluded.column_group;

-- ---------- services ----------
insert into public.services (id, slug, title, tagline, summary, body_html, icon, deliverables, tooling, order_index, status, published_at, seo_title, seo_description)
  values ('f30086ca-79c3-4338-aac3-05f26cc40a02', 'circuit-and-schematic-design', 'Circuit & Schematic Design', 'Architecture, topology and a schematic your manufacturer can read.', 'Clean, scalable and well documented schematics that form a solid foundation.', '<p>A schematic is the contract every later stage is held to. If the topology is wrong, no amount of careful layout rescues it; if the documentation is thin, the cost surfaces later as a bring-up problem, a compliance failure or a purchase order for the wrong part.</p>
<h3>How we approach a new circuit</h3>
<p>We start from your requirements rather than a reference design. Load profile, ambient range, efficiency target, noise budget, safety class and expected volume determine the topology — and we write down why each was chosen, so the decision survives a handover.</p>
<p>Power comes first. A complete power tree with per-rail efficiency, dissipation and sequencing tells us early whether the enclosure can shed the heat and whether the battery meets its runtime claim. It is far cheaper to find a 400&nbsp;mW problem here than after tooling.</p>
<h3>Analog gets the attention it needs</h3>
<p>Signal chains are designed against a stated budget: input-referred noise, gain error, drift over temperature and the ADC''s real effective number of bits. We simulate the parts that warrant it — control loops, filter responses, start-up transients — and leave the rest to well-understood design rules.</p>
<h3>Documentation you can hand to anyone</h3>
<p>Every sheet carries a title block, a revision and a purpose. Nets are named for what they carry. Parts carry manufacturer part numbers, tolerances and voltage ratings on the face of the schematic, because the person reading it during a shortage is rarely the person who drew it.</p>
<p>You receive the source project, not just a PDF. The design is yours, in a format you can open without us.</p>', 'cpu', array['System block diagram and power tree','Hierarchical schematic set with a title block per sheet','Component selection matrix with second sources','Worst-case and tolerance analysis','Simulation results (SPICE / LTspice)','Design review pack and issue register'], '[{"label":"EDA","items":["Altium Designer","KiCad 8","OrCAD Capture"]},{"label":"Simulation","items":["LTspice","TINA-TI","QSPICE","Python control loop models"]},{"label":"Standards","items":["IPC-2221B","IPC-7351B","IEC 60950 / 62368-1 clearances"]}]'::jsonb, 1, 'published', now(), 'Circuit & Schematic Design Services', 'Analog and mixed-signal circuit design, topology selection, worst-case analysis and manufacturable schematic capture in Altium and KiCad.')
  on conflict (id) do update set title = excluded.title, tagline = excluded.tagline, summary = excluded.summary,
    body_html = excluded.body_html, icon = excluded.icon, deliverables = excluded.deliverables, tooling = excluded.tooling,
    order_index = excluded.order_index, seo_title = excluded.seo_title, seo_description = excluded.seo_description;
delete from public.service_features where service_id = 'f30086ca-79c3-4338-aac3-05f26cc40a02';
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('eadaa6a8-9a5b-4f8c-a081-59248536a634', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 'Topology selection with the trade-offs written down', 'Buck, boost, SEPIC, LDO or charge pump — chosen against efficiency at your real load profile, ripple budget, EMI headroom and board area, with the reasoning recorded so a later reviewer can follow it.', 'git-branch', 1);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('eddaab61-d9a1-4cb5-a47b-b7d4c77bc816', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 'Analog and mixed-signal front ends', 'Precision amplification, anti-alias filtering, current sensing, isolation barriers and ADC drive networks designed against a stated noise and accuracy budget rather than a reference design copied wholesale.', 'activity', 2);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('ecdaa9ce-61b5-4e3e-ad6f-b7f04e8fc80c', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 'Power architecture and sequencing', 'Complete power tree with efficiency at each rail, thermal headroom, inrush and sequencing logic, brown-out behaviour and the reset topology that keeps an MCU from latching in an undefined state.', 'zap', 3);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('efdaae87-dc87-4aaf-a35d-2428cc623936', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 'Worst-case analysis before layout', 'Tolerance stack-up, temperature coefficients and end-of-life drift checked against the specification, so a circuit that works on the bench still works at −40 °C on the thousandth unit.', 'sigma', 4);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('eedaacf4-4204-47c8-acde-eb3c30def4bc', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 'Schematics built for review, not just capture', 'Signal flow left to right, power top to bottom, consistent reference designators, net labels that mean something, and every part carrying manufacturer part number, tolerance and voltage rating on the sheet.', 'file-text', 5);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('f1dab1ad-8baf-44a1-aa75-750c7d8a764e', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 'Second sources designed in from day one', 'Critical parts carry an approved alternate with a footprint that accepts both. A single-source passive is a schedule risk we remove at schematic stage, not during a shortage.', 'layers', 6);
insert into public.services (id, slug, title, tagline, summary, body_html, icon, deliverables, tooling, order_index, status, published_at, seo_title, seo_description)
  values ('6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 'pcb-layout-and-high-speed-design', 'PCB Layout & High-Speed Design', 'Controlled impedance, clean returns, manufacturable the first time.', 'High speed, high density PCBs designed with precision and reliability.', '<p>High-speed layout is where a design either becomes manufacturable or becomes a series of expensive respins. The difference is rarely one dramatic mistake — it is an accumulation of small compromises in the stack-up, the return paths and the placement.</p>
<h3>Placement is most of the work</h3>
<p>Before a single track is routed we settle placement: power stages away from sensitive analog, crystals close and quiet, connectors where the mechanics need them, and decoupling on the same side as the pin it serves. A board that places well routes quickly. A board that places badly never routes cleanly at any effort.</p>
<h3>The stack-up is a decision, not a default</h3>
<p>We agree the build with your fabricator first — dielectric materials, copper weights, prepreg and core thicknesses — and calculate impedance against that specific build. A four-layer board with an honest stack-up outperforms a six-layer board with an assumed one.</p>
<h3>Signal and power integrity, quantified</h3>
<p>Interfaces are routed to their published budgets and then verified: impedance profiles, crosstalk between aggressor and victim pairs, eye diagrams where the data rate warrants simulation, and a power delivery network checked against target impedance across frequency. DC drop is simulated so a 1.0&nbsp;V core rail arrives as 1.0&nbsp;V.</p>
<h3>EMC designed in, not chased later</h3>
<p>Continuous reference planes, controlled loop areas, filtered and guarded I/O, deliberate chassis-ground strategy and a shielding plan agreed with mechanical. Boards that follow these rules routinely pass radiated emissions on the first visit to the chamber — which is the single largest schedule risk we can remove for you.</p>', 'circuit-board', array['Layer stack-up with impedance targets and the fabricator''s build','Placement study and mechanical fit review','Routed board with length and skew matching report','Signal and power integrity analysis','Fabrication and assembly data (Gerber X2 / ODB++, IPC-2581)','DRC, DFM and netlist verification reports'], '[{"label":"Layout","items":["Altium Designer","KiCad 8","Allegro PCB Editor"]},{"label":"Analysis","items":["Polar Si9000 / Si8000","HyperLynx SI/PI","Saturn PCB Toolkit","Ansys SIwave"]},{"label":"Standards","items":["IPC-2221B","IPC-2222","IPC-6012 Class 2/3","IPC-A-600","IPC-2581B"]}]'::jsonb, 2, 'published', now(), 'PCB Layout & High-Speed Multilayer Design', 'Multilayer PCB layout, controlled-impedance stack-ups, DDR and gigabit routing, signal and power integrity analysis, EMC-aware design.')
  on conflict (id) do update set title = excluded.title, tagline = excluded.tagline, summary = excluded.summary,
    body_html = excluded.body_html, icon = excluded.icon, deliverables = excluded.deliverables, tooling = excluded.tooling,
    order_index = excluded.order_index, seo_title = excluded.seo_title, seo_description = excluded.seo_description;
delete from public.service_features where service_id = '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba';
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('7ac418d4-c73f-4ae0-adfb-a2344203d3b4', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 'Stack-ups designed with the fabricator, not guessed', 'We agree the build with your fab house before routing: dielectric constants, prepreg and core selection, copper weights and finished thickness, so the 50 Ω on the drawing is the 50 Ω on the board.', 'layers', 1);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('7dc41d8d-b06a-4059-adae-0dd42e2e2de6', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 'Controlled impedance and length matching', 'Single-ended and differential targets held to ±10 %, intra-pair skew inside 5 mils, inter-pair matching to the interface''s budget. DDR3/DDR4 fly-by, USB 3.x, PCIe Gen3, MIPI, gigabit Ethernet and LVDS.', 'ruler', 2);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('7cc41bfa-0a73-4c92-a6b7-87688737b88c', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 'Return paths treated as real signals', 'Reference plane continuity checked across every layer transition, stitching vias placed at the transitions that need them, and split-plane crossings eliminated rather than tolerated. Most EMC failures start here.', 'waves', 3);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('77c4141b-685e-460b-af9a-1210e0221a26', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 'Power delivery network analysis', 'Target impedance derived from the transient current profile, decoupling chosen by measured mounted inductance rather than a rule of thumb, plane resonances checked, and DC drop simulated before fabrication.', 'battery-charging', 4);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('76c41288-8639-42e4-a0fd-d06cfcfdd56c', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 'Thermal and mechanical co-design', 'Copper pours and thermal vias sized against real dissipation, keep-outs and connector positions reconciled with the enclosure in 3D, and board outline exchanged with mechanical as STEP rather than a sketch.', 'thermometer', 5);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('79c41741-d181-4cad-a845-abec4b45d3ee', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 'HDI and dense assemblies', 'Microvias, via-in-pad with filled and capped process, blind and buried structures, 0.4 mm pitch BGA fan-out and rigid-flex where the mechanics demand it — specified only when the density genuinely requires it.', 'grid-3x3', 6);
insert into public.services (id, slug, title, tagline, summary, body_html, icon, deliverables, tooling, order_index, status, published_at, seo_title, seo_description)
  values ('e37f40b7-6f66-4607-ac19-66b052e566be', 'embedded-systems-and-firmware', 'Embedded Systems & Firmware', 'Firmware that is testable, updatable and safe to ship.', 'Firmware and embedded solutions that bring intelligence to your product.', '<p>Firmware is the part of a product that keeps changing after launch. That single fact drives every architectural decision we make: if it cannot be tested, updated and diagnosed in the field, it is not finished.</p>
<h3>Architecture before code</h3>
<p>We separate hardware access, protocol handling and application logic so that the interesting behaviour can be exercised on a development machine at commit speed. Peripheral drivers sit behind narrow interfaces; the application above them is portable and testable.</p>
<h3>Updates are a first-class requirement</h3>
<p>Every connected product we ship carries a bootloader with image signing, dual-bank storage and automatic rollback. An update that bricks a fielded fleet is the most expensive possible failure, so the recovery path is designed and tested before the first feature is written.</p>
<h3>Power is a measurement, not a promise</h3>
<p>Battery life claims are validated on hardware with a current analyser across the full duty cycle — advertising interval, sensor wake, radio transmit and deep sleep. You receive the traces and the arithmetic, not a figure from a datasheet.</p>
<h3>Hardware and firmware developed together</h3>
<p>Because the same team designs the board, test points land where the debug actually needs them, pin assignments respect both the routing and the peripheral matrix, and bring-up starts the day boards arrive rather than a fortnight later.</p>', 'microchip', array['Firmware architecture and module decomposition','Board support package and peripheral drivers','Application firmware with unit and integration tests','Bootloader with signed over-the-air update','Power profile and duty-cycle measurements','Source, build system and CI pipeline'], '[{"label":"Silicon","items":["STM32 (F/G/H/L/U)","Nordic nRF52 / nRF53","ESP32-S3 / C6","NXP i.MX RT","TI MSP430 / CC13xx","Raspberry Pi RP2350"]},{"label":"Stacks","items":["Zephyr RTOS","FreeRTOS","Bare metal C11","Embedded Rust","MCUboot","lwIP","littlefs"]},{"label":"Tooling","items":["CMake + GCC ARM","Segger J-Link / Ozone","Saleae Logic","Unity + Ceedling","GitHub Actions"]}]'::jsonb, 3, 'published', now(), 'Embedded Systems & Firmware Development', 'Bare-metal and RTOS firmware, secure boot, OTA update, BLE and industrial protocol stacks, driver development and hardware bring-up.')
  on conflict (id) do update set title = excluded.title, tagline = excluded.tagline, summary = excluded.summary,
    body_html = excluded.body_html, icon = excluded.icon, deliverables = excluded.deliverables, tooling = excluded.tooling,
    order_index = excluded.order_index, seo_title = excluded.seo_title, seo_description = excluded.seo_description;
delete from public.service_features where service_id = 'e37f40b7-6f66-4607-ac19-66b052e566be';
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b6316cd9-fe7a-4d7d-a84b-01a4b4abda56', 'e37f40b7-6f66-4607-ac19-66b052e566be', 'Bare metal, RTOS or Zephyr — chosen deliberately', 'A sensor node that sleeps 99 % of the time does not need a scheduler. A gateway juggling a radio, a filesystem and a display does. We pick against your real concurrency and power requirements and say why.', 'cpu', 1);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b3316820-09b7-4774-aa86-bf54bce93f94', 'e37f40b7-6f66-4607-ac19-66b052e566be', 'Secure boot and signed OTA update', 'Chain of trust from ROM, ECDSA-signed images, A/B partitions with automatic rollback on a failed health check, and an update path that survives a power cut mid-write. Shipping without this is shipping a product you cannot fix.', 'shield-check', 2);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b43169b3-7ae3-47db-aed2-8e682f15518e', 'e37f40b7-6f66-4607-ac19-66b052e566be', 'Connectivity that works outside the lab', 'BLE 5.x including mesh, Wi-Fi, LoRaWAN, NB-IoT and LTE-M, plus Modbus RTU/TCP, CAN and CANopen, Ethernet/IP and MQTT with TLS. Reconnection, backoff and offline buffering designed as features rather than bolted on.', 'radio', 3);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b9317192-576e-4d62-ae5f-1cf0109fdef4', 'e37f40b7-6f66-4607-ac19-66b052e566be', 'Low-power design measured, not estimated', 'Duty cycles profiled on real hardware with a current analyser. We report average consumption and projected battery life against your usage model, and we show you the traces.', 'battery-low', 4);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('ba317325-0334-4729-a905-840cbd666a4e', 'e37f40b7-6f66-4607-ac19-66b052e566be', 'Testable by construction', 'Hardware access sits behind interfaces so logic runs on the host under unit test. CI builds every commit, runs the test suite, checks static analysis and produces a flashable artefact — no more ''it built on my machine''.', 'flask-conical', 5);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b7316e6c-0e35-4f70-a904-b11cc5674ddc', 'e37f40b7-6f66-4607-ac19-66b052e566be', 'Bring-up and debug on your bench or ours', 'First power-on, peripheral validation, protocol analysis and the fault-finding that follows. Logic analysers, oscilloscopes and JTAG/SWD traces — with a written record of what was found and how it was fixed.', 'bug', 6);
insert into public.services (id, slug, title, tagline, summary, body_html, icon, deliverables, tooling, order_index, status, published_at, seo_title, seo_description)
  values ('1dddaf30-2615-4152-abc8-3e6243f34082', 'prototyping-and-bring-up', 'Prototyping & Bring-Up', 'From first article to a board you can trust on a bench.', 'Rapid prototyping and testing to validate ideas and reduce time to market.', '<p>Prototyping exists to answer questions, and the value of a prototype is measured by how many it answers per revision. A build that arrives without a bring-up plan usually answers one.</p>
<h3>Before boards arrive</h3>
<p>The bring-up procedure is written while the boards are in fabrication: what gets powered, in what order, at what current limit, and what each rail should read. Test points are already on the board because the same team laid it out.</p>
<h3>Power first, always</h3>
<p>Rails are brought up on a current-limited supply with the processor held in reset. A short found at 50&nbsp;mA is a curiosity; the same short found at full current is a scrapped board and a day lost.</p>
<h3>Characterise, do not just demonstrate</h3>
<p>A prototype that "works" tells you little. We measure against the specification across the operating range — temperature, supply tolerance, load — and report where the margin actually sits. That data is what makes the next revision the last one.</p>
<h3>Every finding recorded</h3>
<p>Issues get a number, a root cause, a proposed disposition and a decision. Nothing is fixed silently. When you take the design to manufacture, the register is the evidence that the remaining risks are known and accepted.</p>', 'box', array['Prototype build package and kitted BOM','First-article inspection report','Structured bring-up procedure and results','Characterisation data against the specification','Issue register with root cause and disposition','Release-candidate revision and change log'], '[{"label":"Build","items":["Quick-turn 2–8 layer fabrication","Prototype SMT assembly","Manual rework to 0201 / BGA"]},{"label":"Bench","items":["4-channel 500 MHz scopes","Current analysers","Thermal camera","Spectrum analyser","Near-field probe set","Programmable loads"]},{"label":"Mechanical","items":["FDM and SLA printing","STEP exchange with mechanical CAD"]}]'::jsonb, 4, 'published', now(), 'Electronics Prototyping & Hardware Bring-Up', 'Rapid prototype builds, first-article inspection, structured bring-up, characterisation against specification and iteration to a release candidate.')
  on conflict (id) do update set title = excluded.title, tagline = excluded.tagline, summary = excluded.summary,
    body_html = excluded.body_html, icon = excluded.icon, deliverables = excluded.deliverables, tooling = excluded.tooling,
    order_index = excluded.order_index, seo_title = excluded.seo_title, seo_description = excluded.seo_description;
delete from public.service_features where service_id = '1dddaf30-2615-4152-abc8-3e6243f34082';
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('df2c598a-1c3b-43ea-a317-4a60fb676d74', '1dddaf30-2615-4152-abc8-3e6243f34082', 'Build packages that survive contact with an assembler', 'Complete fabrication and assembly data, a kitted BOM with real part numbers and reels, centroid and paste data, and an assembly drawing that answers the questions before they are asked by email.', 'package', 1);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('de2c57f7-57a7-473f-a98b-10c835d39f36', '1dddaf30-2615-4152-abc8-3e6243f34082', 'Bring-up as a written procedure', 'Power rails verified in sequence at low current before the processor is allowed to run, then clocks, then reset, then each peripheral. Every step has an expected value and a recorded result.', 'list-checks', 2);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('dd2c5664-ecd8-4218-a1f4-d47cca04d87c', '1dddaf30-2615-4152-abc8-3e6243f34082', 'Characterisation against the specification', 'Efficiency curves, ripple, thermal images under load, sensor accuracy across the operating range, radio range and sensitivity, and current draw per mode. Measured, tabulated and compared with the target.', 'line-chart', 3);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('dc2c54d1-145f-4205-a873-96d4f08c16d6', '1dddaf30-2615-4152-abc8-3e6243f34082', 'Fast, honest iteration', 'Two to three prototype revisions is normal and healthy. We batch findings, prove the fix on reworked hardware where we can, and carry a change log that explains every difference between revisions.', 'refresh-cw', 4);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('db2c533e-3e2f-47ce-a503-e4f0195c0b0c', '1dddaf30-2615-4152-abc8-3e6243f34082', 'Enclosure and mechanical fit checks', '3D-printed housings and board-level fit checks catch the connector that fouls a boss or the standoff that lands on a track, at a stage where moving it costs nothing.', 'boxes', 5);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('da2c51ab-c585-4ec3-afa9-8f689fb2306e', '1dddaf30-2615-4152-abc8-3e6243f34082', 'Pre-compliance early, not at the end', 'Near-field probing and conducted emissions on the first prototype find the problems while the layout can still change, instead of during a booked chamber slot with tooling already committed.', 'radar', 6);
insert into public.services (id, slug, title, tagline, summary, body_html, icon, deliverables, tooling, order_index, status, published_at, seo_title, seo_description)
  values ('d0cb963e-8125-4206-a1ee-d43851f0d844', 'test-and-compliance', 'Test & Compliance', 'Get through the chamber the first time, and test at volume.', 'Design verification, EMC pre-compliance and production test that scales.', '<p>Compliance failures are rarely surprises in hindsight. They are the predictable consequence of decisions made months earlier in the stack-up, the I/O filtering or the grounding strategy — and they are cheapest to fix while those things are still editable.</p>
<h3>Pre-compliance is a design activity</h3>
<p>We probe the first prototype rather than the release candidate. A 3&nbsp;dB margin problem found on revision A is a layout change; found on revision C it is tooling, inventory and a rebooked chamber slot.</p>
<h3>Verification with a paper trail</h3>
<p>Each requirement maps to a verification method, a procedure and a recorded result. This is unglamorous and it is exactly what a medical or industrial customer will ask to see.</p>
<h3>Production test designed for the line, not the bench</h3>
<p>A fixture that needs an engineer to interpret it does not belong in a factory. Ours give an unambiguous pass or fail, capture the serial number, write calibration constants, and log results in a form your quality team can query.</p>
<h3>Coverage stated honestly</h3>
<p>No functional test catches everything. We tell you what ours catches and what it does not, so you can decide where to spend the next increment of test effort.</p>', 'clipboard-check', array['Design verification plan and traceability matrix','EMC pre-compliance report with mitigations','Environmental and reliability test results','Functional test fixture design and software','Production test coverage and yield analysis','Technical file support for certification'], '[{"label":"EMC","items":["Spectrum analyser + LISN","Near-field probe set","ESD simulator","TEM cell"]},{"label":"Environmental","items":["Thermal chamber −40 to +125 °C","Humidity chamber","Vibration table"]},{"label":"Standards","items":["EN 55032 / 55035","IEC 61000-4-2/-4/-5","IEC 62368-1","IEC 60601-1-2","ISO 7637-2"]}]'::jsonb, 5, 'published', now(), 'Design Verification, EMC Pre-Compliance & Production Test', 'Verification planning, EMC and safety pre-compliance, environmental testing, and functional test fixtures with traceability for volume production.')
  on conflict (id) do update set title = excluded.title, tagline = excluded.tagline, summary = excluded.summary,
    body_html = excluded.body_html, icon = excluded.icon, deliverables = excluded.deliverables, tooling = excluded.tooling,
    order_index = excluded.order_index, seo_title = excluded.seo_title, seo_description = excluded.seo_description;
delete from public.service_features where service_id = 'd0cb963e-8125-4206-a1ee-d43851f0d844';
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('d5e3db7e-8d9e-431e-a87d-886063822e9c', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 'Verification traced back to requirements', 'Every requirement carries a test that proves it and a result that records it. When an auditor or a customer asks how you know, the matrix answers in one page.', 'table-2', 1);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('d4e3d9eb-c70a-4513-a3e9-5cf89bee5efe', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 'EMC pre-compliance before you book the chamber', 'Radiated and conducted emissions, ESD, EFT and surge exercised in-house. Problems found here are layout changes; the same problems found at an accredited lab are a rebooked slot and a schedule slip.', 'radio-tower', 2);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('d3e3d858-0bfa-46ec-a819-beb4dfde3f44', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 'Environmental and reliability testing', 'Temperature cycling, humidity, vibration and mechanical shock to the profile your market demands, plus HALT-style margin discovery where the application justifies finding the limits early.', 'thermometer-snowflake', 3);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('dae3e35d-5028-4a81-aacb-19dc2b0cddde', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 'Functional test fixtures that scale', 'Bed-of-nails or pogo-pin fixtures with guided operator flow, per-unit pass/fail records, serial number capture and calibration data written to the device — designed so a contract manufacturer can run them unattended.', 'cable', 4);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('d9e3e1ca-f826-45fa-a1c5-7430d20a77c4', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 'Test coverage measured, not assumed', 'We report what the fixture actually catches: net coverage, parametric limits and the failure modes it does not see, so the residual risk at your line is a number rather than an assumption.', 'target', 5);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('d8e3e037-b8e8-400f-a00b-b03891cc3046', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 'Support through certification', 'Technical construction file inputs, test-house liaison, and the design changes that follow a finding. We stay engaged until the certificate is issued.', 'badge-check', 6);
insert into public.services (id, slug, title, tagline, summary, body_html, icon, deliverables, tooling, order_index, status, published_at, seo_title, seo_description)
  values ('e44e69aa-1bf4-450e-afba-3ca40042beb8', 'manufacturing-support', 'Manufacturing Support', 'DFM, DFA, BOM optimisation and a transfer that actually transfers.', 'From BOM optimization to manufacturing support, we''ve got you covered.', '<p>Design for manufacture is not a checklist run at the end. It is a set of constraints applied throughout, informed by the specific factory that will build the product.</p>
<h3>Reviewed against a real capability set</h3>
<p>Generic DFM rules either over-constrain a capable shop or miss the limits of a cheaper one. We review against your fabricator''s published capability, so the feedback is actionable rather than theoretical.</p>
<h3>BOM optimisation, with the reasoning visible</h3>
<p>We consolidate part numbers, relax tolerances only where the analysis supports it, and identify where a slightly more expensive part removes an assembly step or a test failure mode. Every proposed change carries its saving and its risk, and you decide.</p>
<h3>Supply chain treated as a design input</h3>
<p>A design that cannot be sourced is not finished. Lifecycle status, sourcing breadth and lead time sit alongside price on every line, and critical parts carry a footprint-compatible alternate that has been checked, not assumed.</p>
<h3>Through to a stable first run</h3>
<p>We support first-article inspection, attend or review the first build, help tune the process window, and close out findings. The measure of a good transfer is that the second run needs us less than the first.</p>', 'factory', array['DFM and DFA review report with severity ranking','Optimised BOM with alternates and lifecycle status','Panelisation and assembly drawing set','Manufacturing data pack (IPC-2581 / ODB++)','CM evaluation and quote comparison','NPI support through first production run'], '[{"label":"Data","items":["IPC-2581B","ODB++","Gerber X2","IPC-D-356 netlist"]},{"label":"Analysis","items":["Valor NPI-style DFM checks","Silicon Expert / Octopart lifecycle data","Cost roll-up modelling"]},{"label":"Standards","items":["IPC-A-610 Class 2/3","IPC-J-STD-001","IPC-7351B","IPC-6012 Class 2/3"]}]'::jsonb, 6, 'published', now(), 'DFM, DFA, BOM Optimisation & Manufacturing Support', 'Design for manufacture and assembly review, BOM cost and risk optimisation, panelisation, CM selection and new product introduction support.')
  on conflict (id) do update set title = excluded.title, tagline = excluded.tagline, summary = excluded.summary,
    body_html = excluded.body_html, icon = excluded.icon, deliverables = excluded.deliverables, tooling = excluded.tooling,
    order_index = excluded.order_index, seo_title = excluded.seo_title, seo_description = excluded.seo_description;
delete from public.service_features where service_id = 'e44e69aa-1bf4-450e-afba-3ca40042beb8';
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b3dbbc5e-26bc-4cb6-a567-d0e8da982914', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 'DFM review against your fabricator''s real capability', 'Annular ring, minimum trace and space, drill-to-copper, solder mask sliver and aspect ratio checked against the shop that will actually build it — not a generic rule set that either over-constrains or misses.', 'scan-line', 1);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b2dbbacb-4910-488b-abcb-7240fbec8356', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 'DFA that reduces assembly cost and defects', 'Component orientation consistency, courtyard spacing, fiducial placement, thermal relief balance to prevent tombstoning, paste aperture design and rework access on the parts most likely to need it.', 'wrench', 2);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b1dbb938-66ec-4564-a737-3c5c18c83e9c', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 'BOM optimisation with the trade-offs shown', 'Part consolidation across values and packages, tolerance relaxation where the circuit genuinely allows it, and lifecycle and lead-time risk flagged per line. Typical result on a mature design is a 15–35 % cost reduction.', 'receipt', 3);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b8dbc43d-911c-42d9-a9c7-16e449f89716', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 'Supply-chain risk made visible', 'Every line carries lifecycle status, sourcing count, lead time and an approved alternate where one exists. Single-sourced, NRND and long-lead parts are surfaced as a ranked list before they become an expedite fee.', 'truck', 4);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b7dbc2aa-eb26-4f12-acfd-9db8a30221bc', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 'Panelisation and process data', 'Array layout with rails, tooling holes and fiducials, tab-route or V-score chosen for the depanel stress the board can take, and complete process data in IPC-2581 or ODB++ rather than a folder of loose Gerbers.', 'layout-grid', 5);
insert into public.service_features (id, service_id, title, description, icon, order_index)
  values ('b6dbc117-6dc2-48c7-ab19-09d0249e89de', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 'Transfer that survives without us', 'CM evaluation and quote comparison on like-for-like terms, first-article review, process window support during ramp, and documentation written so your manufacturer does not need to call the designer.', 'handshake', 6);

-- ---------- industries ----------
insert into public.industries (id, slug, name, summary, body_html, icon, standards, order_index, status, published_at, seo_title, seo_description)
  values ('7afb0784-b2fd-4526-a806-a2a22df8acaa', 'medical-devices', 'Medical Devices', 'Patient-connected electronics designed for isolation, traceability and a technical file that survives audit.', '<p>Medical electronics carry constraints that do not appear in other sectors, and they appear early. Isolation barriers, creepage and clearance, leakage current limits and single-fault safety shape the schematic before a single component is placed.</p>
<h3>What changes in a medical design</h3>
<p>Patient-connected circuits need a defined means of protection, and the classification drives everything downstream: isolation voltage, barrier width, the transformer specification and the layout keep-outs that protect them. We size these against IEC&nbsp;60601-1 at schematic stage rather than discovering a 4&nbsp;mm clearance problem during layout review.</p>
<p>Leakage current is a system property, not a component property. Y-capacitor selection, enclosure bonding and the mains input filter all contribute, so the budget is allocated deliberately across them.</p>
<h3>Firmware under IEC 62304</h3>
<p>Software safety classification determines how much process a project carries. We work to a documented architecture, unit-tested modules, traceable requirements and a change history that an auditor can follow — proportionate to Class A, B or C rather than uniformly heavy.</p>
<h3>Documentation as a deliverable</h3>
<p>Design inputs, verification results, risk analysis inputs under ISO&nbsp;14971 and the traceability between them are produced as the work happens. Reconstructing a design history file after the fact is the most expensive way to build one.</p>', 'heart-pulse', array['IEC 60601-1','IEC 60601-1-2','ISO 13485','IEC 62304','ISO 14971'], 1, 'published', now(), 'Medical Device Electronics Design', 'IEC 60601 aligned medical electronics: patient isolation, leakage current control, IEC 62304 firmware and design history file support.')
  on conflict (id) do update set name = excluded.name, summary = excluded.summary, body_html = excluded.body_html,
    standards = excluded.standards, order_index = excluded.order_index;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('7afb0784-b2fd-4526-a806-a2a22df8acaa', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 1) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('7afb0784-b2fd-4526-a806-a2a22df8acaa', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 2) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('7afb0784-b2fd-4526-a806-a2a22df8acaa', 'e37f40b7-6f66-4607-ac19-66b052e566be', 3) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('7afb0784-b2fd-4526-a806-a2a22df8acaa', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 4) on conflict do nothing;
insert into public.industries (id, slug, name, summary, body_html, icon, standards, order_index, status, published_at, seo_title, seo_description)
  values ('9b23275a-0a2a-4cd4-a109-bb8ea54dc42e', 'industrial-and-iiot', 'Industrial & IIoT', 'Rugged controllers, gateways and sensor nodes that survive a factory floor and speak the protocols already installed there.', '<p>Industrial electronics fail differently. The threat is not a dropped phone; it is a 4&nbsp;kV surge on a 24&nbsp;V line, a variable-speed drive two metres away, condensation, and an expectation of ten years in service.</p>
<h3>Immunity is the design driver</h3>
<p>EN&nbsp;61000-6-2 immunity levels are harder to meet than the emissions limits alongside them. Surge and EFT protection is designed into every port, isolation is placed where the ground reference genuinely differs, and the layout keeps transient energy away from logic rather than routing it through it.</p>
<h3>Protocols that already exist on site</h3>
<p>Modbus RTU and TCP, CANopen, EtherNet/IP, IO-Link and MQTT over TLS. New equipment has to join the installed base, not replace it, so protocol conformance and graceful degradation matter more than feature count.</p>
<h3>Designed for a long life</h3>
<p>Component selection favours lifecycle over unit price: parts with a published longevity programme, second sources on every critical line, and a BOM reviewed annually. A 30&nbsp;cent saving that forces a redesign in year four is not a saving.</p>', 'factory', array['IEC 61131-2','EN 61000-6-2','EN 61000-6-4','ATEX / IECEx','IP65–IP68'], 2, 'published', now(), 'Industrial & IIoT Electronics Design', 'Industrial controllers and IIoT gateways: wide-range supplies, surge immunity, Modbus and CAN, extended temperature and long product lifecycles.')
  on conflict (id) do update set name = excluded.name, summary = excluded.summary, body_html = excluded.body_html,
    standards = excluded.standards, order_index = excluded.order_index;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('9b23275a-0a2a-4cd4-a109-bb8ea54dc42e', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 1) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('9b23275a-0a2a-4cd4-a109-bb8ea54dc42e', 'e37f40b7-6f66-4607-ac19-66b052e566be', 2) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('9b23275a-0a2a-4cd4-a109-bb8ea54dc42e', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 3) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('9b23275a-0a2a-4cd4-a109-bb8ea54dc42e', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 4) on conflict do nothing;
insert into public.industries (id, slug, name, summary, body_html, icon, standards, order_index, status, published_at, seo_title, seo_description)
  values ('a3d51512-ad45-41ec-ae90-f4fe511af6fe', 'automotive-and-ev', 'Automotive & EV', 'Power electronics, battery management and vehicle-network hardware built to automotive transient and thermal expectations.', '<p>A vehicle is an electrically hostile environment with a long warranty attached. Load dump, cold crank, reverse polarity and a −40 to +125&nbsp;°C junction expectation are the starting conditions, not edge cases.</p>
<h3>Transients first</h3>
<p>ISO&nbsp;7637-2 pulses define the front end: reverse-battery protection, load-dump clamping sized to the alternator, and a supply that rides through cold-crank without resetting the processor. Getting this wrong is not a compliance finding, it is a field return.</p>
<h3>Qualified parts, and the discipline that follows</h3>
<p>AEC-Q100 and Q200 parts throughout, with the temperature grade chosen for the actual mounting location rather than the ambient in the cabin. Derating is applied and documented.</p>
<h3>Networks and functional safety</h3>
<p>CAN FD, LIN and automotive Ethernet with correct termination and shielding. Where a function carries an ASIL rating, we work to a documented safety concept with the diagnostic coverage that rating demands — and we say plainly when a requirement needs a certified partner rather than us.</p>', 'car-front', array['ISO 26262','ISO 7637-2','AEC-Q100 / Q200','CISPR 25','IATF 16949'], 3, 'published', now(), 'Automotive & EV Electronics Design', 'Automotive-grade electronics: ISO 7637-2 transient immunity, AEC-Q qualified parts, CAN FD and LIN, battery management and traction-adjacent power design.')
  on conflict (id) do update set name = excluded.name, summary = excluded.summary, body_html = excluded.body_html,
    standards = excluded.standards, order_index = excluded.order_index;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('a3d51512-ad45-41ec-ae90-f4fe511af6fe', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 1) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('a3d51512-ad45-41ec-ae90-f4fe511af6fe', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 2) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('a3d51512-ad45-41ec-ae90-f4fe511af6fe', 'e37f40b7-6f66-4607-ac19-66b052e566be', 3) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('a3d51512-ad45-41ec-ae90-f4fe511af6fe', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 4) on conflict do nothing;
insert into public.industries (id, slug, name, summary, body_html, icon, standards, order_index, status, published_at, seo_title, seo_description)
  values ('eee771a2-7e53-4724-a0b4-86866d3b68c6', 'consumer-products', 'Consumer Products', 'Compact, cost-sensitive designs where board area, battery life and unit cost are all constraints at once.', '<p>Consumer hardware is an optimisation problem with three axes pulling against each other: size, battery life and cost. Improving one usually costs another, so the trade-offs have to be made explicitly and early.</p>
<h3>Density with a purpose</h3>
<p>HDI, via-in-pad and rigid-flex are specified when the mechanics genuinely require them, because each adds fabrication cost. A well-placed four-layer board frequently beats a poorly planned eight-layer one on both size and price.</p>
<h3>Battery and charging done properly</h3>
<p>Cell selection, charge topology, protection, fuel gauging and thermal behaviour designed together, with runtime validated by measurement across the real duty cycle. Safety testing to IEC&nbsp;62133 is planned from the start.</p>
<h3>Cost engineering that holds up</h3>
<p>At volume, small decisions compound. Part consolidation, tolerance relaxation where the analysis allows, a test strategy that fits the line, and panelisation tuned to the assembler routinely take 15–35&nbsp;% out of a mature BOM without touching the specification.</p>', 'smartphone', array['IEC 62368-1','EN 55032 Class B','EN 300 328','IEC 62133 (battery)','FCC Part 15B/15C'], 4, 'published', now(), 'Consumer Electronics Design', 'Compact consumer electronics: HDI layout, BLE and Wi-Fi integration, battery and charging design, and BOM cost reduction for volume manufacture.')
  on conflict (id) do update set name = excluded.name, summary = excluded.summary, body_html = excluded.body_html,
    standards = excluded.standards, order_index = excluded.order_index;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('eee771a2-7e53-4724-a0b4-86866d3b68c6', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 1) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('eee771a2-7e53-4724-a0b4-86866d3b68c6', 'e37f40b7-6f66-4607-ac19-66b052e566be', 2) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('eee771a2-7e53-4724-a0b4-86866d3b68c6', '1dddaf30-2615-4152-abc8-3e6243f34082', 3) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('eee771a2-7e53-4724-a0b4-86866d3b68c6', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 4) on conflict do nothing;
insert into public.industries (id, slug, name, summary, body_html, icon, standards, order_index, status, published_at, seo_title, seo_description)
  values ('5918f90b-60e3-4263-a9fb-3b68b9fcbb6e', 'energy-and-power', 'Energy & Power', 'Converters, inverters and metering hardware where efficiency, isolation and thermal design decide the product.', '<p>In power electronics the layout is the circuit. Loop inductance in a switching cell determines ringing, EMI and switching loss far more than the schematic suggests, and it cannot be fixed in firmware.</p>
<h3>Switching cells laid out deliberately</h3>
<p>Commutation loops kept small and tight, gate drive returned to the source pin, current sense placed where it measures what you think it measures, and thermal paths designed alongside the electrical ones.</p>
<h3>Wide bandgap where it earns its place</h3>
<p>GaN and SiC deliver real efficiency gains and real layout difficulty: faster edges mean tighter loops, more careful gate drive and more attention to common-mode paths. We use them when the application justifies the discipline.</p>
<h3>Measured efficiency, not claimed efficiency</h3>
<p>Efficiency curves across load and line, thermal imaging at worst case, and ripple measured with correct probing. Numbers you can put in a datasheet because they came off a bench.</p>', 'zap', array['IEC 62109','IEC 61010-1','EN 50549','IEC 62053 (metering)','UL 1741'], 5, 'published', now(), 'Energy & Power Electronics Design', 'Power conversion and energy metering electronics: high-efficiency topologies, GaN and SiC switching, isolation, thermal design and grid-code compliance.')
  on conflict (id) do update set name = excluded.name, summary = excluded.summary, body_html = excluded.body_html,
    standards = excluded.standards, order_index = excluded.order_index;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('5918f90b-60e3-4263-a9fb-3b68b9fcbb6e', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 1) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('5918f90b-60e3-4263-a9fb-3b68b9fcbb6e', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 2) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('5918f90b-60e3-4263-a9fb-3b68b9fcbb6e', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 3) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('5918f90b-60e3-4263-a9fb-3b68b9fcbb6e', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 4) on conflict do nothing;
insert into public.industries (id, slug, name, summary, body_html, icon, standards, order_index, status, published_at, seo_title, seo_description)
  values ('725e78be-47a7-4474-a5f9-7ccaba057d32', 'agritech', 'Agritech', 'Outdoor sensing and control that runs for years on a battery, in weather, with intermittent connectivity.', '<p>An agritech node is judged on one number: how long it runs before someone has to walk to it. Everything else follows from that.</p>
<h3>Microamps matter</h3>
<p>Sleep current is engineered down to single-digit microamps: leakage paths audited, pull-ups sized, sensors switched rather than left biased, and the radio duty cycle designed against the actual reporting requirement rather than a convenient default.</p>
<h3>Connectivity that assumes failure</h3>
<p>LoRaWAN, NB-IoT and LTE-M with store-and-forward buffering, exponential backoff and a firmware update path that tolerates a partial download. Coverage at the edge of a field is not coverage in a lab.</p>
<h3>Sealed, and proven sealed</h3>
<p>Conformal coating, gasket and gland selection reviewed with mechanical, condensation considered explicitly, and IP performance verified by test rather than by the enclosure''s datasheet.</p>', 'sprout', array['IP67 / IP68','EN 301 511 / 301 908','EN 62368-1','IEC 60068-2 (environmental)'], 6, 'published', now(), 'Agritech & Environmental Sensing Electronics', 'Battery-powered outdoor sensing: LoRaWAN and NB-IoT nodes, energy harvesting, sealed enclosures and multi-year field deployments.')
  on conflict (id) do update set name = excluded.name, summary = excluded.summary, body_html = excluded.body_html,
    standards = excluded.standards, order_index = excluded.order_index;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('725e78be-47a7-4474-a5f9-7ccaba057d32', 'e37f40b7-6f66-4607-ac19-66b052e566be', 1) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('725e78be-47a7-4474-a5f9-7ccaba057d32', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 2) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('725e78be-47a7-4474-a5f9-7ccaba057d32', '1dddaf30-2615-4152-abc8-3e6243f34082', 3) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('725e78be-47a7-4474-a5f9-7ccaba057d32', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 4) on conflict do nothing;
insert into public.industries (id, slug, name, summary, body_html, icon, standards, order_index, status, published_at, seo_title, seo_description)
  values ('24a601c5-dce6-45f9-a840-043c018c07be', 'aerospace-and-defence', 'Aerospace & Defence', 'High-reliability electronics with the environmental qualification and documentation the sector requires.', '<p>High-reliability work is mostly a documentation and margin discipline. The circuits are often conventional; the difference is how much is proven rather than assumed.</p>
<h3>Class 3 from the start</h3>
<p>IPC-6012 Class 3 fabrication and IPC-A-610 Class 3 workmanship impose annular ring, plating and acceptance criteria that must be designed for, not requested at the end. We apply them from the first layout.</p>
<h3>Derating and margin analysis</h3>
<p>Every component derated against a published policy, worst-case analysis across temperature and end-of-life, and the results tabulated. Where margin is thin, it is called out rather than averaged away.</p>
<h3>Qualification planned, not improvised</h3>
<p>DO-160 or MIL-STD-810 profiles drive mechanical design, potting and connector selection from day one, and the qualification plan is written alongside the specification.</p>', 'plane', array['DO-160G','MIL-STD-810H','MIL-STD-461G','IPC-6012 Class 3','IPC-A-610 Class 3'], 7, 'published', now(), 'Aerospace & Defence Electronics Design', 'High-reliability electronics to IPC Class 3, DO-160 and MIL-STD-810 environmental qualification, with full traceability and derating analysis.')
  on conflict (id) do update set name = excluded.name, summary = excluded.summary, body_html = excluded.body_html,
    standards = excluded.standards, order_index = excluded.order_index;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('24a601c5-dce6-45f9-a840-043c018c07be', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 1) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('24a601c5-dce6-45f9-a840-043c018c07be', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 2) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('24a601c5-dce6-45f9-a840-043c018c07be', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 3) on conflict do nothing;
insert into public.industry_services (industry_id, service_id, order_index)
  values ('24a601c5-dce6-45f9-a840-043c018c07be', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 4) on conflict do nothing;

-- ---------- team_members ----------
insert into public.team_members (id, name, role, bio, linkedin_url, order_index, status, published_at)
  values ('b287d0d3-d6f2-4b0f-a475-9bdc897a1be2', 'Dr Priya Raghavan', 'Founder & Principal Engineer', 'Eighteen years in mixed-signal and power electronics, previously leading hardware for a medical diagnostics platform through IEC 60601 certification in four markets. Writes most of our worst-case analysis.', 'https://linkedin.com/in/example', 1, 'published', now())
  on conflict (id) do update set name = excluded.name, role = excluded.role, bio = excluded.bio;
insert into public.team_members (id, name, role, bio, linkedin_url, order_index, status, published_at)
  values ('b387d266-a038-4de0-a3bf-5f8653c06046', 'Tomas Lindqvist', 'Head of PCB Engineering', 'Specialist in high-speed and HDI layout — DDR4, PCIe Gen3 and gigabit interfaces. Maintains our stack-up library and the relationships with the fabricators who build to it.', 'https://linkedin.com/in/example', 2, 'published', now())
  on conflict (id) do update set name = excluded.name, role = excluded.role, bio = excluded.bio;
insert into public.team_members (id, name, role, bio, linkedin_url, order_index, status, published_at)
  values ('b487d3f9-1241-45fd-a6c6-a604c6c949f6', 'Marcus Adeyemi', 'Lead Firmware Engineer', 'Zephyr and bare-metal C across STM32, nRF and ESP32. Built the secure boot and OTA framework we reuse across connected projects, and insists that everything is testable on a host.', 'https://linkedin.com/in/example', 3, 'published', now())
  on conflict (id) do update set name = excluded.name, role = excluded.role, bio = excluded.bio;
insert into public.team_members (id, name, role, bio, linkedin_url, order_index, status, published_at)
  values ('b587d58c-d37c-41f6-a6fb-a47a89044782', 'Elena Fischer', 'Test & Compliance Lead', 'Runs our pre-compliance lab and production test development. Has taken more than sixty products through EMC and safety testing and keeps the record of why each one passed or did not.', 'https://linkedin.com/in/example', 4, 'published', now())
  on conflict (id) do update set name = excluded.name, role = excluded.role, bio = excluded.bio;
insert into public.team_members (id, name, role, bio, linkedin_url, order_index, status, published_at)
  values ('b687d71f-01e2-4c3b-a765-4b24b86a735a', 'Daniel Okonkwo', 'Manufacturing Engineer', 'Ten years on the CM side before joining us, which is why our DFM feedback is specific rather than generic. Owns BOM optimisation and supplier risk analysis.', null, 5, 'published', now())
  on conflict (id) do update set name = excluded.name, role = excluded.role, bio = excluded.bio;
insert into public.team_members (id, name, role, bio, linkedin_url, order_index, status, published_at)
  values ('b787d8b2-43f1-4edc-a476-766efb79878e', 'Sara Beltrán', 'Analog & Power Engineer', 'Switching converters, GaN and SiC gate drive, and the precision front ends where a microvolt matters. Responsible for our lowest-noise designs and our highest-efficiency ones.', 'https://linkedin.com/in/example', 6, 'published', now())
  on conflict (id) do update set name = excluded.name, role = excluded.role, bio = excluded.bio;

-- ---------- clients ----------
insert into public.clients (id, name, logo_mark, website_url, featured, order_index, status, published_at)
  values ('3012ee33-399b-4215-a989-3c2669aec048', 'TechNova', 'grid-2x2', null, true, 1, 'published', now())
  on conflict (id) do update set name = excluded.name, featured = excluded.featured, order_index = excluded.order_index;
insert into public.clients (id, name, logo_mark, website_url, featured, order_index, status, published_at)
  values ('3112efc6-a09e-4baa-a18c-b46cd1b14b70', 'Intelliq', 'square-dashed', null, true, 2, 'published', now())
  on conflict (id) do update set name = excluded.name, featured = excluded.featured, order_index = excluded.order_index;
insert into public.clients (id, name, logo_mark, website_url, featured, order_index, status, published_at)
  values ('3212f159-d4d5-4fab-a6c7-9ef206e86104', 'Voltix', 'diamond', null, true, 3, 'published', now())
  on conflict (id) do update set name = excluded.name, featured = excluded.featured, order_index = excluded.order_index;
insert into public.clients (id, name, logo_mark, website_url, featured, order_index, status, published_at)
  values ('3312f2ec-658b-4b88-a699-9964989e5e74', 'Nexora', 'hexagon', null, true, 4, 'published', now())
  on conflict (id) do update set name = excluded.name, featured = excluded.featured, order_index = excluded.order_index;
insert into public.clients (id, name, logo_mark, website_url, featured, order_index, status, published_at)
  values ('3412f47f-1de7-44b9-a9f5-c0c651fa2938', 'Bluente', 'anchor', null, true, 5, 'published', now())
  on conflict (id) do update set name = excluded.name, featured = excluded.featured, order_index = excluded.order_index;
insert into public.clients (id, name, logo_mark, website_url, featured, order_index, status, published_at)
  values ('3512f612-bfae-402e-aabc-863cf4c16640', 'CorePeak', 'circle-dot', null, true, 6, 'published', now())
  on conflict (id) do update set name = excluded.name, featured = excluded.featured, order_index = excluded.order_index;
insert into public.clients (id, name, logo_mark, website_url, featured, order_index, status, published_at)
  values ('3612f7a5-0917-40ff-af05-975a3f2a58a4', 'Aeris', 'wind', null, false, 7, 'published', now())
  on conflict (id) do update set name = excluded.name, featured = excluded.featured, order_index = excluded.order_index;
insert into public.clients (id, name, logo_mark, website_url, featured, order_index, status, published_at)
  values ('3712f938-6cbc-492c-abae-3014a3cfc264', 'Kessler', 'cog', null, false, 8, 'published', now())
  on conflict (id) do update set name = excluded.name, featured = excluded.featured, order_index = excluded.order_index;

-- ---------- projects ----------
insert into public.projects (id, slug, title, client_name, industry_id, summary, challenge, approach, outcome, body_html, year, duration_weeks, board_spec, is_confidential, featured, order_index, status, published_at, seo_title, seo_description)
  values ('58f42bba-ccd2-4a92-a426-d12825c7264c', 'iot-environmental-monitor', 'IoT Environmental Monitor', 'Aeris Building Systems', '9b23275a-0a2a-4cd4-a109-bb8ea54dc42e', 'A wall-mounted indoor air quality monitor measuring CO₂, PM2.5, VOC, temperature and humidity, reporting over Wi-Fi with a two-year calibration interval.', 'The client''s previous unit read 2–3 °C high because the temperature sensor sat in the thermal plume of the Wi-Fi module and the switching regulator. Calibration drift meant field re-calibration every nine months, and the sensor fusion could not distinguish a real CO₂ event from a self-heating artefact.', 'We treated self-heating as a layout problem rather than a firmware correction. The temperature and humidity sensors moved onto a thermally isolated tab connected by a 1.2 mm neck with the copper deliberately starved, and slots were milled either side to break the conduction path. The radio and the buck converter were relocated to the opposite end of the board with a ground pour discontinuity between the zones. Firmware duty-cycles the NDIR lamp and takes the temperature reading 400 ms into the sleep window, after the plume has settled.', 'Self-heating error fell from 2.6 °C to 0.4 °C, which removed the need for the correction table entirely. Drift over the first twelve months of field data stayed inside the sensor''s own specification, allowing the calibration interval to be extended to two years. The unit passed EN 55032 Class B radiated emissions on the first chamber visit with 6 dB of margin.', '<h3>Why self-heating dominated the design</h3>
<p>An NDIR CO₂ sensor compensates against temperature, so an error in the temperature reading propagates directly into the gas reading. A 2.6&nbsp;°C offset was producing roughly 40&nbsp;ppm of CO₂ error — enough to trigger ventilation in an empty room.</p>
<h3>Zoning the board</h3>
<p>The six-layer stack-up gave us a continuous ground reference for the radio while allowing a deliberate discontinuity under the sensor tab. Heat travels through copper far more readily than through FR-4, so the neck carries only the four signals the sensor needs, on 0.15&nbsp;mm tracks, with no pour.</p>
<h3>Firmware that respects the physics</h3>
<p>Rather than correcting in software, the sampling schedule avoids the problem: the lamp fires, the radio stays quiet, and the temperature sample is taken once the local gradient has settled. The correction table that the previous product depended on was deleted.</p>', 2025, 18, '{"layers":6,"sizeMm":[78,52],"componentCount":214,"ipcClass":"Class 2","stackup":"1.6 mm FR-4 Tg150, 1 oz outer / 0.5 oz inner, ENIG"}'::jsonb, false, true, 1, 'published', now(), 'IoT Environmental Monitor — Case Study', 'Six-layer NDIR air quality monitor with 0.4 °C self-heating error, Wi-Fi reporting and a two-year calibration interval.')
  on conflict (id) do update set title = excluded.title, summary = excluded.summary, challenge = excluded.challenge,
    approach = excluded.approach, outcome = excluded.outcome, body_html = excluded.body_html,
    board_spec = excluded.board_spec, featured = excluded.featured, order_index = excluded.order_index;
insert into public.project_services (project_id, service_id, order_index)
  values ('58f42bba-ccd2-4a92-a426-d12825c7264c', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 1) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('58f42bba-ccd2-4a92-a426-d12825c7264c', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 2) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('58f42bba-ccd2-4a92-a426-d12825c7264c', 'e37f40b7-6f66-4607-ac19-66b052e566be', 3) on conflict do nothing;
delete from public.project_metrics where project_id = '58f42bba-ccd2-4a92-a426-d12825c7264c';
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('503949bb-3748-43b7-a771-7a0c87817d72', '58f42bba-ccd2-4a92-a426-d12825c7264c', 'Self-heating error', '−2.2', '°C', 1);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('4f394828-5de9-44da-a2d0-2cf2ad22ad02', '58f42bba-ccd2-4a92-a426-d12825c7264c', 'Calibration interval', '9 → 24', 'months', 2);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('52394ce1-fcba-496d-ae83-758c4ef3864e', '58f42bba-ccd2-4a92-a426-d12825c7264c', 'EMC margin', '6', 'dB', 3);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('51394b4e-9305-40c0-a23c-bb8ee43f3c0e', '58f42bba-ccd2-4a92-a426-d12825c7264c', 'Prototype revisions', '2', null, 4);
insert into public.projects (id, slug, title, client_name, industry_id, summary, challenge, approach, outcome, body_html, year, duration_weeks, board_spec, is_confidential, featured, order_index, status, published_at, seo_title, seo_description)
  values ('0cf4affd-1241-4963-aeb5-c69e1f361960', 'portable-health-device', 'Portable Health Monitoring Device', null, '7afb0784-b2fd-4526-a806-a2a22df8acaa', 'A wrist-worn continuous vitals monitor with a Type BF applied part, seven-day battery life and BLE upload to a clinician dashboard.', 'The analog front end needed a 20 µVpp noise floor to resolve the PPG signal at low perfusion, on a board 32 mm across that also carried a BLE radio, a buck-boost converter and a colour display. The first-pass prototype from a previous supplier measured 140 µVpp and could not hold a reading during movement.', 'The AFE was moved onto its own quiet island with a dedicated low-noise LDO fed from the switcher, and the display and radio were placed on the opposite side of an eight-layer HDI stack-up with a solid ground layer between them. The buck-boost switching frequency was moved to 2.2 MHz and synchronised to the AFE conversion clock so its residual sits outside the measurement band. Firmware gates the radio so no transmission occurs during a conversion window.', 'Measured noise floor came in at 18 µVpp, inside the target. Battery life reached seven days against a five-day requirement. IEC 62304 Class B documentation was produced alongside the firmware, and the device cleared IEC 60601-1-2 immunity testing without modification.', '<h3>Noise as a system budget</h3>
<p>We allocated the 20&nbsp;µVpp target across contributors before layout: LDO output noise, conversion clock jitter, switching residual and radio coupling each received a share. That made the design decisions arithmetic rather than argument.</p>
<h3>Synchronisation instead of suppression</h3>
<p>Filtering a switching residual out of a PPG band costs area and settling time. Moving the converter to 2.2&nbsp;MHz and locking it to the conversion clock puts the residual where it does no harm — a firmware and clocking decision that saved four passive components and a millimetre of height.</p>
<h3>Isolation and applied-part classification</h3>
<p>The Type&nbsp;BF classification set creepage and clearance requirements at the electrode interface which fixed the connector position and the keep-out geometry before routing began.</p>', 2025, 26, '{"layers":8,"sizeMm":[32,24],"componentCount":186,"ipcClass":"Class 2","stackup":"0.8 mm HDI, 1+N+1 microvia, ENIG, via-in-pad filled and capped"}'::jsonb, true, true, 2, 'published', now(), 'Portable Health Monitoring Device — Case Study', 'IEC 60601-1 Type BF wearable vitals monitor: analog front-end noise reduction, seven-day battery life and IEC 62304 Class B firmware.')
  on conflict (id) do update set title = excluded.title, summary = excluded.summary, challenge = excluded.challenge,
    approach = excluded.approach, outcome = excluded.outcome, body_html = excluded.body_html,
    board_spec = excluded.board_spec, featured = excluded.featured, order_index = excluded.order_index;
insert into public.project_services (project_id, service_id, order_index)
  values ('0cf4affd-1241-4963-aeb5-c69e1f361960', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 1) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('0cf4affd-1241-4963-aeb5-c69e1f361960', 'e37f40b7-6f66-4607-ac19-66b052e566be', 2) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('0cf4affd-1241-4963-aeb5-c69e1f361960', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 3) on conflict do nothing;
delete from public.project_metrics where project_id = '0cf4affd-1241-4963-aeb5-c69e1f361960';
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('75ea7c16-a5f9-4160-a013-ad761be44d76', '0cf4affd-1241-4963-aeb5-c69e1f361960', 'AFE noise floor', '140 → 18', 'µVpp', 1);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('76ea7da9-9888-490d-ae62-44a40f72b6b6', '0cf4affd-1241-4963-aeb5-c69e1f361960', 'Battery life', '7', 'days', 2);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('73ea78f0-c155-437a-a2bf-cb8a35402c6a', '0cf4affd-1241-4963-aeb5-c69e1f361960', 'Board area', '32 × 24', 'mm', 3);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('74ea7a83-a88b-45d7-ac61-ef541d76105a', '0cf4affd-1241-4963-aeb5-c69e1f361960', 'Immunity retest', '0', 'cycles', 4);
insert into public.projects (id, slug, title, client_name, industry_id, summary, challenge, approach, outcome, body_html, year, duration_weeks, board_spec, is_confidential, featured, order_index, status, published_at, seo_title, seo_description)
  values ('fc784f16-053f-4036-a947-3f2001b7bf4c', 'industrial-controller', 'Industrial Controller & Protocol Gateway', 'Kessler Automation', '9b23275a-0a2a-4cd4-a109-bb8ea54dc42e', 'A DIN-rail controller bridging Modbus RTU, CANopen and EtherNet/IP with a 9–36 V input and 4 kV surge immunity on every port.', 'Five isolated ports on one board, each requiring 4 kV surge immunity, inside a 22.5 mm DIN enclosure with no forced airflow. The client''s existing product used four separate isolated DC-DC modules and could not hold its price point at the volume they had won.', 'We consolidated four isolated supplies into a single multi-output flyback with independent post-regulation, which removed three modules and their footprints. Surge protection was designed per port with a coordinated TVS and gas-discharge arrangement rather than an identical circuit repeated five times, sized against each port''s actual exposure. Two-ounce outer copper and a via field under the flyback carried the heat into the DIN rail bracket, avoiding a heatsink.', 'BOM cost fell 31 % and part count by 46 lines. All five ports passed IEC 61000-4-5 at 4 kV line-to-earth. Sustained thermal testing at 60 °C ambient showed a 21 °C rise at the hottest component, leaving comfortable derating margin.', '<h3>Consolidation without losing isolation</h3>
<p>Four isolated modules exist because they are easy, not because they are right. A single multi-output flyback with a properly designed transformer and independent post-regulation gave the same isolation with a third of the footprint — at the cost of a transformer specification that had to be got right first time.</p>
<h3>Surge protection sized per port</h3>
<p>Copying one protection circuit five times over-protects some ports and under-protects others. We assessed each port''s exposure separately and coordinated the TVS and arrester clamping so energy is shared correctly during a strike.</p>
<h3>Thermal path through the mechanics</h3>
<p>With no airflow available, the DIN bracket became the heatsink. Two-ounce copper and a dense via field under the switch move heat into the bracket, which is why the assembly runs 21&nbsp;°C over ambient rather than needing a fan the enclosure cannot accommodate.</p>', 2024, 22, '{"layers":6,"sizeMm":[98,76],"componentCount":340,"ipcClass":"Class 2","stackup":"1.6 mm FR-4 Tg170, 2 oz outer, 35 µm inner, HASL lead-free"}'::jsonb, false, true, 3, 'published', now(), 'Industrial Controller & Protocol Gateway — Case Study', 'DIN-rail industrial gateway with isolated Modbus, CANopen and EtherNet/IP ports, 4 kV surge immunity and a 31 % BOM cost reduction.')
  on conflict (id) do update set title = excluded.title, summary = excluded.summary, challenge = excluded.challenge,
    approach = excluded.approach, outcome = excluded.outcome, body_html = excluded.body_html,
    board_spec = excluded.board_spec, featured = excluded.featured, order_index = excluded.order_index;
insert into public.project_services (project_id, service_id, order_index)
  values ('fc784f16-053f-4036-a947-3f2001b7bf4c', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 1) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('fc784f16-053f-4036-a947-3f2001b7bf4c', 'e37f40b7-6f66-4607-ac19-66b052e566be', 2) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('fc784f16-053f-4036-a947-3f2001b7bf4c', 'e44e69aa-1bf4-450e-afba-3ca40042beb8', 3) on conflict do nothing;
delete from public.project_metrics where project_id = 'fc784f16-053f-4036-a947-3f2001b7bf4c';
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('85e79e77-a529-4573-a0ce-5b042b1163ea', 'fc784f16-053f-4036-a947-3f2001b7bf4c', 'BOM cost', '−31', '%', 1);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('84e79ce4-c95b-4126-adbc-3dc24e433e0a', 'fc784f16-053f-4036-a947-3f2001b7bf4c', 'BOM line count', '−46', 'lines', 2);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('87e7a19d-9c3d-4cd9-abda-7d4424257e76', 'fc784f16-053f-4036-a947-3f2001b7bf4c', 'Surge immunity', '4', 'kV', 3);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('86e7a00a-cb6a-4d5c-ad8d-7d5652527d66', 'fc784f16-053f-4036-a947-3f2001b7bf4c', 'Temperature rise', '21', '°C', 4);
insert into public.projects (id, slug, title, client_name, industry_id, summary, challenge, approach, outcome, body_html, year, duration_weeks, board_spec, is_confidential, featured, order_index, status, published_at, seo_title, seo_description)
  values ('0be09b84-bd3e-420a-a6de-598ec91f5d8e', 'ev-charging-module', 'EV Charging Control Module', 'Voltix Mobility', '5918f90b-60e3-4263-a9fb-3b68b9fcbb6e', 'A 22 kW AC charge controller with residual current detection, PLC communication and grid-code compliant load management.', 'Detecting 6 mA of DC residual current per IEC 62955 while sitting beside three 32 A conductors carrying switching noise, and running ISO 15118 power-line communication over the same cable. Two earlier prototypes had produced nuisance trips at roughly one per fourteen days.', 'The residual current sensor was moved to a fluxgate type with a differential drive and given its own shielded compartment with a slotted, guarded ground. The PLC coupling network was redesigned with a common-mode choke and the injection point relocated away from the sensor aperture. Firmware added a coherent averaging window synchronised to the mains cycle so switching transients, which are not mains-coherent, average out rather than accumulating.', 'Nuisance trips fell to zero across a 90-day field trial on twelve units. The module met IEC 62955 6 mA DC detection with margin and passed EN 61851-21-2 EMC on the first attempt. It has since shipped in three of the client''s product lines.', '<h3>The trip was a measurement problem, not a threshold problem</h3>
<p>Raising the trip threshold would have failed the standard. The real issue was that switching transients were being integrated as though they were residual current. Synchronising the averaging window to the mains cycle discriminates between the two without touching sensitivity.</p>
<h3>Shielding the sensor properly</h3>
<p>A fluxgate sensor is only as good as its magnetic environment. Its own compartment, a guarded slot in the ground plane and a relocated PLC injection point removed the coupling that the previous revisions had been fighting in firmware.</p>', 2024, 30, '{"layers":4,"sizeMm":[140,90],"componentCount":268,"ipcClass":"Class 2","stackup":"2.0 mm FR-4 Tg170, 2 oz outer, reinforced isolation slots"}'::jsonb, false, true, 4, 'published', now(), 'EV Charging Control Module — Case Study', '22 kW AC charge controller with 6 mA DC residual current detection, ISO 15118 PLC and IEC 62955 compliance, passing EMC first time.')
  on conflict (id) do update set title = excluded.title, summary = excluded.summary, challenge = excluded.challenge,
    approach = excluded.approach, outcome = excluded.outcome, body_html = excluded.body_html,
    board_spec = excluded.board_spec, featured = excluded.featured, order_index = excluded.order_index;
insert into public.project_services (project_id, service_id, order_index)
  values ('0be09b84-bd3e-420a-a6de-598ec91f5d8e', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 1) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('0be09b84-bd3e-420a-a6de-598ec91f5d8e', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 2) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('0be09b84-bd3e-420a-a6de-598ec91f5d8e', 'd0cb963e-8125-4206-a1ee-d43851f0d844', 3) on conflict do nothing;
delete from public.project_metrics where project_id = '0be09b84-bd3e-420a-a6de-598ec91f5d8e';
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('c978b5c3-7b7d-4faf-a205-da6c44f62572', '0be09b84-bd3e-420a-a6de-598ec91f5d8e', 'Nuisance trips', '0', 'in 90 days', 1);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('c878b430-e416-48b2-ac6e-3c82ac8f3ce2', '0be09b84-bd3e-420a-a6de-598ec91f5d8e', 'DC residual detection', '6', 'mA', 2);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('cb78b8e9-8172-4f45-aa0a-47ac4cebb82e', '0be09b84-bd3e-420a-a6de-598ec91f5d8e', 'EMC attempts', '1', null, 3);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('ca78b756-1fea-4118-a592-864eea62e86e', '0be09b84-bd3e-420a-a6de-598ec91f5d8e', 'Product lines shipped', '3', null, 4);
insert into public.projects (id, slug, title, client_name, industry_id, summary, challenge, approach, outcome, body_html, year, duration_weeks, board_spec, is_confidential, featured, order_index, status, published_at, seo_title, seo_description)
  values ('741fdd4b-8173-451b-a56c-6850f5939266', 'high-efficiency-motor-drive', 'High-Efficiency GaN Motor Drive', 'Nexora Robotics', 'a3d51512-ad45-41ec-ae90-f4fe511af6fe', 'A 3 kW three-phase servo drive using GaN half-bridges, reaching 97.4 % peak efficiency in a 40 % smaller envelope.', 'Replacing a silicon IGBT drive with GaN to reach the efficiency and size targets, without the gate ringing and common-mode noise that had made two earlier in-house attempts unusable above 60 kHz.', 'Commutation loop inductance was the design target from the first placement study. Half-bridges were laid out with vertical loops through the stack rather than lateral ones, giving roughly 1.8 nH of loop inductance. Gate loops were kept under 4 mm with the driver returned to the source sense pin, and a Kelvin connection separated gate return from power return. Current sensing moved to shunts with a dedicated differential path away from the switching node.', 'The drive runs at 100 kHz with 97.4 % peak efficiency and gate ringing under 1.2 V overshoot. Volume fell 40 % against the outgoing IGBT design, and conducted emissions met CISPR 25 Class 3 with the filter originally budgeted.', '<h3>Loop inductance is the whole game</h3>
<p>GaN switches fast enough that a few nanohenries of commutation loop turns into tens of volts of overshoot. Routing the loop vertically through the stack-up, rather than around the board, is what makes 100&nbsp;kHz operation calm rather than marginal.</p>
<h3>Kelvin returns everywhere they matter</h3>
<p>Separating gate return from power return removes the source inductance from the gate loop. Without it, the device turns itself partially back on during a fast transition — the mechanism behind both earlier attempts.</p>', 2023, 24, '{"layers":6,"sizeMm":[110,84],"componentCount":292,"ipcClass":"Class 2","stackup":"1.6 mm FR-4, 2 oz outer with 3 oz plated power layers, IMS heat path"}'::jsonb, false, false, 5, 'published', now(), 'High-Efficiency GaN Motor Drive — Case Study', '3 kW GaN three-phase servo drive: 97.4 % peak efficiency, minimised commutation loops, and CISPR 25 Class 3 conducted emissions.')
  on conflict (id) do update set title = excluded.title, summary = excluded.summary, challenge = excluded.challenge,
    approach = excluded.approach, outcome = excluded.outcome, body_html = excluded.body_html,
    board_spec = excluded.board_spec, featured = excluded.featured, order_index = excluded.order_index;
insert into public.project_services (project_id, service_id, order_index)
  values ('741fdd4b-8173-451b-a56c-6850f5939266', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 1) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('741fdd4b-8173-451b-a56c-6850f5939266', '6cb7c3ae-40a8-420c-ac1f-c1a2ad5fc5ba', 2) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('741fdd4b-8173-451b-a56c-6850f5939266', '1dddaf30-2615-4152-abc8-3e6243f34082', 3) on conflict do nothing;
delete from public.project_metrics where project_id = '741fdd4b-8173-451b-a56c-6850f5939266';
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('4805969e-33f9-4698-abfc-70067bff7d36', '741fdd4b-8173-451b-a56c-6850f5939266', 'Peak efficiency', '97.4', '%', 1);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('49059831-9582-44c5-ac87-2cf4de884cf6', '741fdd4b-8173-451b-a56c-6850f5939266', 'Volume', '−40', '%', 2);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('46059378-f826-4e32-ae23-ad4a3e2bd1aa', '741fdd4b-8173-451b-a56c-6850f5939266', 'Loop inductance', '1.8', 'nH', 3);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('4705950b-8f8d-452f-a888-b024d692ba3a', '741fdd4b-8173-451b-a56c-6850f5939266', 'Switching frequency', '100', 'kHz', 4);
insert into public.projects (id, slug, title, client_name, industry_id, summary, challenge, approach, outcome, body_html, year, duration_weeks, board_spec, is_confidential, featured, order_index, status, published_at, seo_title, seo_description)
  values ('53ff46c6-b95f-46d2-aaa0-b0140d5f3d98', 'soil-sensing-node', 'Multi-Depth Soil Sensing Node', 'Bluente Agritech', '725e78be-47a7-4474-a5f9-7ccaba057d32', 'A solar-assisted LoRaWAN soil probe measuring moisture and temperature at four depths, with a five-year field life.', 'A five-year life on a single primary cell with solar assist, in a sealed housing, reporting four sensor depths every fifteen minutes over LoRaWAN. The client''s existing node managed fourteen months.', 'We audited every leakage path on the previous design and found 62 µA of the 78 µA sleep current came from three sources: a permanently biased sensor divider, an unnecessary pull-up on an I²C bus that was powered down, and a regulator with poor quiescent behaviour at light load. Sensors were switched through a load switch, the bus was properly isolated, and the regulator was replaced. The radio duty cycle was recalculated against the real reporting requirement, and unconfirmed uplinks were adopted with periodic confirmation rather than per-message acknowledgement.', 'Sleep current fell from 78 µA to 3.1 µA. With the solar assist contributing, projected field life exceeds five years against the fourteen months previously achieved. Thirty units have now run two full seasons without a battery change.', '<h3>Sleep current is found, not designed</h3>
<p>Nobody sets out to leave a sensor divider biased. These paths accumulate, and the only way to remove them is to measure the board section by section with everything else powered down. The audit took two days and returned four years of field life.</p>
<h3>Protocol choices are power choices</h3>
<p>Confirmed LoRaWAN uplinks on every message double the radio energy and can triple it when the gateway is marginal. Periodic confirmation gives the same delivery assurance for a fraction of the budget.</p>', 2023, 16, '{"layers":4,"sizeMm":[46,46],"componentCount":98,"ipcClass":"Class 2","stackup":"1.0 mm FR-4, 1 oz, ENIG, conformal coated"}'::jsonb, false, false, 6, 'published', now(), 'Multi-Depth Soil Sensing Node — Case Study', 'LoRaWAN soil moisture node with 3.1 µA sleep current, solar assist and a projected five-year field life in sealed IP68 housing.')
  on conflict (id) do update set title = excluded.title, summary = excluded.summary, challenge = excluded.challenge,
    approach = excluded.approach, outcome = excluded.outcome, body_html = excluded.body_html,
    board_spec = excluded.board_spec, featured = excluded.featured, order_index = excluded.order_index;
insert into public.project_services (project_id, service_id, order_index)
  values ('53ff46c6-b95f-46d2-aaa0-b0140d5f3d98', 'e37f40b7-6f66-4607-ac19-66b052e566be', 1) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('53ff46c6-b95f-46d2-aaa0-b0140d5f3d98', 'f30086ca-79c3-4338-aac3-05f26cc40a02', 2) on conflict do nothing;
insert into public.project_services (project_id, service_id, order_index)
  values ('53ff46c6-b95f-46d2-aaa0-b0140d5f3d98', '1dddaf30-2615-4152-abc8-3e6243f34082', 3) on conflict do nothing;
delete from public.project_metrics where project_id = '53ff46c6-b95f-46d2-aaa0-b0140d5f3d98';
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('0cbda53b-0a82-4ff7-a63f-cacc17401532', '53ff46c6-b95f-46d2-aaa0-b0140d5f3d98', 'Sleep current', '78 → 3.1', 'µA', 1);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('0bbda3a8-6583-421a-ae3e-01b2714145c2', '53ff46c6-b95f-46d2-aaa0-b0140d5f3d98', 'Projected field life', '5+', 'years', 2);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('0ebda861-bbbe-40ad-a503-48ccca7c890e', '53ff46c6-b95f-46d2-aaa0-b0140d5f3d98', 'Reporting interval', '15', 'min', 3);
insert into public.project_metrics (id, project_id, label, value, unit, order_index)
  values ('0dbda6ce-aed5-4300-a368-65cebc9369ce', '53ff46c6-b95f-46d2-aaa0-b0140d5f3d98', 'Units in field trial', '30', null, 4);

-- ---------- process_stages ----------
insert into public.process_stages (id, step_number, title, short_description, detail, icon, order_index, status, published_at)
  values ('68449a4e-90f7-4bd6-a8b3-e198f93c1624', 1, 'Discover', 'We understand your idea, goals and requirements.', '{"inputs":["Product concept or existing design","Target market and compliance regime","Volume, cost and timeline targets","Any existing schematics, BOM or field data"],"activities":["Requirements workshop","Feasibility and risk assessment","Architecture options with trade-offs","Preliminary BOM cost and lead-time modelling"],"outputs":["Written requirements specification","System architecture and power tree","Risk register with mitigations","Fixed-price proposal and schedule"],"duration":"1–2 weeks","gate":"You sign off the requirements specification. Nothing is designed against an assumption we have not written down."}'::jsonb, 'lightbulb', 1, 'published', now())
  on conflict (id) do update set title = excluded.title, short_description = excluded.short_description, detail = excluded.detail;
insert into public.process_stages (id, step_number, title, short_description, detail, icon, order_index, status, published_at)
  values ('674498bb-32b0-4933-a5f4-c18899f4f1ee', 2, 'Design', 'We design and engineer with accuracy and insight.', '{"inputs":["Approved requirements specification","Mechanical envelope as STEP","Preferred suppliers and approved vendor list"],"activities":["Schematic capture and simulation","Component selection with second sources","Layer stack-up agreed with the fabricator","PCB layout, SI/PI analysis, DFM review"],"outputs":["Reviewed schematic set","Routed board with analysis reports","Manufacturing data pack","Design review minutes and issue register"],"duration":"4–10 weeks","gate":"Formal design review with you present. Every open issue is dispositioned before fabrication is released."}'::jsonb, 'pen-tool', 2, 'published', now())
  on conflict (id) do update set title = excluded.title, short_description = excluded.short_description, detail = excluded.detail;
insert into public.process_stages (id, step_number, title, short_description, detail, icon, order_index, status, published_at)
  values ('66449728-1bb7-462c-adf3-f10481fbfd54', 3, 'Develop', 'We build, test and refine until it''s perfect.', '{"inputs":["Released fabrication and assembly data","Firmware requirements","Test and acceptance criteria"],"activities":["Prototype build and first-article inspection","Structured bring-up against a written procedure","Firmware development with CI and unit tests","Characterisation and EMC pre-compliance"],"outputs":["Working prototypes with measured data","Firmware with test suite and build pipeline","Characterisation report","Revised design for release"],"duration":"6–14 weeks","gate":"Measured performance meets the specification across the operating range, with the evidence attached."}'::jsonb, 'settings-2', 3, 'published', now())
  on conflict (id) do update set title = excluded.title, short_description = excluded.short_description, detail = excluded.detail;
insert into public.process_stages (id, step_number, title, short_description, detail, icon, order_index, status, published_at)
  values ('6d44a22d-19ac-44d9-a4e8-a6f486f0a706', 4, 'Deliver', 'Production ready, on time and beyond expectations.', '{"inputs":["Release-candidate design","Target contract manufacturer","Volume forecast"],"activities":["Final DFM/DFA and BOM optimisation","Panelisation and process data","Production test fixture and software","CM liaison and first-article support"],"outputs":["Complete manufacturing data pack","Optimised BOM with alternates","Test fixture and coverage report","Handover documentation and source files"],"duration":"3–6 weeks","gate":"A successful first production run at your manufacturer, with yield data reviewed together."}'::jsonb, 'rocket', 4, 'published', now())
  on conflict (id) do update set title = excluded.title, short_description = excluded.short_description, detail = excluded.detail;

-- ---------- post_topics + posts ----------
insert into public.post_topics (id, slug, name, order_index) values ('58174538-7bfd-4ade-a3ea-5fe6d4146016', 'pcb-design', 'PCB Design', 1)
  on conflict (id) do update set name = excluded.name;
insert into public.post_topics (id, slug, name, order_index) values ('9031a79b-804a-4cb1-a07b-4b2a107c944c', 'firmware', 'Firmware', 2)
  on conflict (id) do update set name = excluded.name;
insert into public.post_topics (id, slug, name, order_index) values ('46313eb8-0a26-4180-ac17-6f3850579038', 'manufacturing', 'Manufacturing', 3)
  on conflict (id) do update set name = excluded.name;
insert into public.post_topics (id, slug, name, order_index) values ('e5e3d385-a779-449b-a29a-171e8d5d9820', 'compliance', 'Compliance', 4)
  on conflict (id) do update set name = excluded.name;
insert into public.posts (id, slug, title, excerpt, body_html, topic_id, author_id, status, published_at, seo_title, seo_description)
  values ('f01050e8-ccef-4f2e-acff-4fc6bcff7016', 'return-paths-are-the-signal', 'Return paths are the signal you forgot to route', 'Most radiated emissions failures are decided long before the chamber, in the two or three places where a return current had nowhere sensible to go.', '<p>A signal is a loop. Whatever the schematic implies, current leaves a driver, travels down a track and comes back — and above a few megahertz it comes back directly underneath the track it went out on, because that is the path of least inductance.</p>
<p>Route a track over a gap in that reference and the return current has to go around. The loop area grows, and loop area is what radiates.</p>
<h3>Three habits that cause most of it</h3>
<h4>1. Crossing a plane split</h4>
<p>Analog and digital ground separated by a slot, with a track crossing between them, is the classic. The current detours to the nearest bridge, sometimes centimetres away. A single 100&nbsp;MHz clock routed across a split can add 15&nbsp;dB at its harmonics.</p>
<p>Either do not split the plane, or do not cross the split. A continuous plane with careful placement beats a split plane with a careful crossing, every time.</p>
<h4>2. Layer changes without a stitching via</h4>
<p>A signal that transitions from layer 1 to layer 6 changes reference plane. The return current has to find its own way between those planes — through whatever decoupling capacitor happens to be nearby. Place a ground via within a couple of millimetres of the signal via and the return has a defined path.</p>
<h4>3. Connectors without a local ground return</h4>
<p>Cables are efficient antennas. If the shield or the return pin does not connect to the same reference the driver sits on, common-mode current flows down the cable. Ground the connector locally, and filter what leaves the board.</p>
<h3>What this looks like in practice</h3>
<p>Before routing, mark the reference layer for every net class. During routing, check plane continuity underneath each critical net rather than trusting the DRC — most tools will not tell you that your reference disappeared. After routing, sweep a near-field probe across the board on the first prototype.</p>
<p>None of this is expensive. It is cheaper than a rebooked chamber slot, and considerably cheaper than a respin after tooling.</p>', '58174538-7bfd-4ade-a3ea-5fe6d4146016', 'b387d266-a038-4de0-a3bf-5f8653c06046', 'published', '2026-05-12T09:00:00.000Z'::timestamptz, 'Return Paths Are the Signal You Forgot to Route', 'Why reference plane continuity decides EMC outcomes, and the three layout habits that cause most radiated emissions failures.')
  on conflict (id) do update set title = excluded.title, excerpt = excluded.excerpt, body_html = excluded.body_html;
insert into public.posts (id, slug, title, excerpt, body_html, topic_id, author_id, status, published_at, seo_title, seo_description)
  values ('ea593ab2-f65e-499c-ac07-832ee0b7f44e', 'bom-risk-is-a-design-input', 'Your BOM is a risk register, not a shopping list', 'Lifecycle status, sourcing breadth and lead time belong beside price on every line — before layout, not during a shortage.', '<p>A bill of materials with only part numbers and prices is a description of what you hope to buy. It says nothing about whether you will be able to.</p>
<h3>Four columns that change the conversation</h3>
<p><strong>Lifecycle status.</strong> Active, NRND or obsolete, taken from a lifecycle data source rather than the distributor''s stock page. An NRND part on a design entering production is a redesign already scheduled, just not yet acknowledged.</p>
<p><strong>Sourcing count.</strong> How many manufacturers make a functionally and mechanically compatible part. One is a risk; the mitigation is a footprint that accepts two.</p>
<p><strong>Lead time.</strong> The real quoted figure, not the catalogue one. A 52-week part in a design with a 12-week schedule is the schedule, whatever the plan says.</p>
<p><strong>Approved alternate.</strong> Checked, not assumed. Same footprint, same critical parameters, verified against the circuit.</p>
<h3>Where the cost actually is</h3>
<p>Cost-down exercises usually attack the most expensive line. That is rarely where the money is. On a typical mature design we find:</p>
<ul>
<li><strong>Part consolidation</strong> — the same board carrying 10&nbsp;kΩ resistors in four tolerances and three packages. Consolidating reduces line count, reel changes and minimum order quantities.</li>
<li><strong>Tolerance that nobody analysed</strong> — 1&nbsp;% parts specified out of habit where the circuit tolerates 5&nbsp;%. Only relax where the worst-case analysis supports it, but do run the analysis.</li>
<li><strong>Assembly steps, not components</strong> — a slightly more expensive integrated part that removes a hand-soldering operation or a test failure mode is usually cheaper in the finished unit.</li>
</ul>
<p>Across the designs we have reviewed, the range is a 15–35&nbsp;% reduction without touching the specification. The important part is that every proposed change carries its saving and its risk, and the customer decides.</p>', '46313eb8-0a26-4180-ac17-6f3850579038', 'b687d71f-01e2-4c3b-a765-4b24b86a735a', 'published', '2026-04-22T09:00:00.000Z'::timestamptz, 'Your BOM Is a Risk Register, Not a Shopping List', 'How to treat lifecycle, sourcing and lead time as design inputs, and the BOM review that typically removes 15–35 % of cost.')
  on conflict (id) do update set title = excluded.title, excerpt = excluded.excerpt, body_html = excluded.body_html;
insert into public.posts (id, slug, title, excerpt, body_html, topic_id, author_id, status, published_at, seo_title, seo_description)
  values ('faa61fc9-cc5f-45b5-a6f9-7a7cc705857e', 'ota-update-you-can-trust', 'An OTA update path you can actually trust', 'Dual-bank storage, signed images and an automatic rollback that triggers on a health check — designed before the first feature is written.', '<p>The most expensive failure a connected product can have is an update that bricks the fleet. Everything else is recoverable by shipping another update; that one is recoverable only by a truck roll.</p>
<h3>Design the recovery path first</h3>
<p>Before any feature work, we build and test the update mechanism, including its failure modes: power removed mid-write, a corrupted download, a valid image that fails to boot, and a valid image that boots but cannot reach the network.</p>
<h3>The four components</h3>
<p><strong>A chain of trust.</strong> An immutable first-stage bootloader verifies an ECDSA signature over the image before it is allowed to run. Keys live in a hardware-backed store where the silicon offers one.</p>
<p><strong>A and B slots.</strong> The running image is never overwritten. The new image lands in the inactive slot, is verified in place, and only then does the bootloader switch on the next reset.</p>
<p><strong>A health check with teeth.</strong> After the first boot of a new image the device must actively confirm it is healthy — peripherals initialised, configuration readable, network reachable — within a watchdog window. If it does not, the bootloader reverts to the previous slot without asking anyone.</p>
<p><strong>Staged rollout.</strong> One per cent, then ten, then the rest, with the metric that gates each stage decided in advance. If you cannot tell whether an update is going badly, you do not have a rollout, you have a hope.</p>
<h3>What this costs</h3>
<p>Roughly double the flash, and about two engineer-weeks. Against a truck roll to a few thousand devices, that is not a close call.</p>', '9031a79b-804a-4cb1-a07b-4b2a107c944c', 'b487d3f9-1241-45fd-a6c6-a604c6c949f6', 'published', '2026-03-30T09:00:00.000Z'::timestamptz, 'An OTA Update Path You Can Actually Trust', 'Secure boot, A/B partitions, signed images and rollback-on-failure — the firmware update architecture that keeps a fielded fleet recoverable.')
  on conflict (id) do update set title = excluded.title, excerpt = excluded.excerpt, body_html = excluded.body_html;
insert into public.posts (id, slug, title, excerpt, body_html, topic_id, author_id, status, published_at, seo_title, seo_description)
  values ('e538eb9d-3c83-408d-a9bb-fb1021bbfc2a', 'emc-is-a-layout-decision', 'EMC is decided at placement, not in the chamber', 'By the time you book the accredited lab, the outcome is already determined. Here is what to probe on revision A instead.', '<p>An accredited chamber tells you whether you passed. It rarely tells you why you failed, and by then the layout is frozen, the tooling is cut and the launch date is public.</p>
<h3>What to do on revision A</h3>
<p><strong>Near-field probing, one hour.</strong> Sweep an H-field probe across the board with the product running its worst-case workload. You are not measuring compliance, you are finding hot spots: a clock harmonic radiating from a specific track, a switcher loop, a connector shell.</p>
<p><strong>Conducted emissions with a LISN.</strong> Cheap, quick and highly correlated with the accredited result. Failures here are almost always input filter design or a common-mode path through a DC-DC transformer.</p>
<p><strong>ESD at the seams.</strong> Contact discharge to every accessible metal part and every connector shell. Look for resets, corrupted displays and hung buses. Immunity failures are usually cheaper to fix in layout than in the enclosure.</p>
<h3>Reading what you find</h3>
<p>A hot spot over a track means loop area. A hot spot over a connector means common-mode current on a cable. A broadband hash that moves with load means the switching converter. Each has a different fix, and all three are layout changes if you find them early enough.</p>
<h3>The arithmetic</h3>
<p>An in-house pre-compliance session costs a day. A failed accredited visit costs the chamber fee, a respin, new tooling if the enclosure moves, and typically six to ten weeks. Across our last twenty-four projects, twenty-one passed radiated emissions on the first accredited visit — and the three that did not failed on findings we had already flagged and the client had accepted as a risk.</p>', 'e5e3d385-a779-449b-a29a-171e8d5d9820', 'b587d58c-d37c-41f6-a6fb-a47a89044782', 'published', '2026-02-18T09:00:00.000Z'::timestamptz, 'EMC Is Decided at Placement, Not in the Chamber', 'A practical in-house pre-compliance routine: near-field probing, conducted emissions and the ESD checks that find problems while layout can still change.')
  on conflict (id) do update set title = excluded.title, excerpt = excluded.excerpt, body_html = excluded.body_html;

-- ---------- testimonials ----------
insert into public.testimonials (id, quote, author_name, author_role, company, project_id, industry_id, featured, status, published_at)
  values ('0915a1c0-20d8-4158-a9cd-c09829ee0318', 'We had spent nine months correcting a sensor error in firmware. Anode found it was a thermal path in the layout, fixed it in one revision, and handed us the measurements that proved it. The calibration interval more than doubled.', 'Helena Vos', 'VP Product', 'Aeris Building Systems', '58f42bba-ccd2-4a92-a426-d12825c7264c', '9b23275a-0a2a-4cd4-a109-bb8ea54dc42e', true, 'published', now())
  on conflict (id) do update set quote = excluded.quote, featured = excluded.featured;
insert into public.testimonials (id, quote, author_name, author_role, company, project_id, industry_id, featured, status, published_at)
  values ('0c15a679-c4c9-49f1-a8dc-4f88d0df906a', 'They took 31 % out of our BOM without touching the specification, and showed the working for every line. That is the first cost-down exercise I have seen that did not quietly move risk somewhere else.', 'Jonas Kessler', 'Managing Director', 'Kessler Automation', 'fc784f16-053f-4036-a947-3f2001b7bf4c', '9b23275a-0a2a-4cd4-a109-bb8ea54dc42e', true, 'published', now())
  on conflict (id) do update set quote = excluded.quote, featured = excluded.featured;
insert into public.testimonials (id, quote, author_name, author_role, company, project_id, industry_id, featured, status, published_at)
  values ('0b15a4e6-e942-49ba-a257-9d5cf457dea0', 'Two suppliers had told us the nuisance trips were inherent to the sensor. Anode reframed it as a measurement window problem and we have had zero trips in ninety days of field trial.', 'Amara Diallo', 'Head of Engineering', 'Voltix Mobility', '0be09b84-bd3e-420a-a6de-598ec91f5d8e', '5918f90b-60e3-4263-a9fb-3b68b9fcbb6e', false, 'published', now())
  on conflict (id) do update set quote = excluded.quote, featured = excluded.featured;
insert into public.testimonials (id, quote, author_name, author_role, company, project_id, industry_id, featured, status, published_at)
  values ('0e15a99f-540b-43eb-aa1e-7a7462217d8a', 'Fourteen months of battery life became five years. The audit that found it took two days. We should have asked them a year earlier.', 'Rory McAllister', 'CTO', 'Bluente Agritech', '53ff46c6-b95f-46d2-aaa0-b0140d5f3d98', '725e78be-47a7-4474-a5f9-7ccaba057d32', false, 'published', now())
  on conflict (id) do update set quote = excluded.quote, featured = excluded.featured;

-- ---------- certifications, stats, faqs ----------
insert into public.certifications (id, name, issuer, description, valid_until, order_index, status, published_at)
  values ('b479e5df-b6cf-4853-a2b6-cd8c6b490e32', 'ISO 9001:2015', 'BSI', 'Quality management system covering design, verification and handover.', '2027-04-30'::date, 1, 'published', now())
  on conflict (id) do update set name = excluded.name, description = excluded.description;
insert into public.certifications (id, name, issuer, description, valid_until, order_index, status, published_at)
  values ('b579e772-7f52-42a4-aa2b-35d634ccba16', 'ISO 13485:2016', 'BSI', 'Medical device design controls, applied to our medical electronics work.', '2027-02-28'::date, 2, 'published', now())
  on conflict (id) do update set name = excluded.name, description = excluded.description;
insert into public.certifications (id, name, issuer, description, valid_until, order_index, status, published_at)
  values ('b679e905-5a20-4a3d-ac59-d338109a2342', 'IPC-A-610 CIS', 'IPC', 'Certified IPC Specialists on staff for Class 2 and Class 3 workmanship.', null, 3, 'published', now())
  on conflict (id) do update set name = excluded.name, description = excluded.description;
insert into public.certifications (id, name, issuer, description, valid_until, order_index, status, published_at)
  values ('af79de00-f4b0-490e-abc9-770ea42a870e', 'IPC CID+', 'IPC', 'Advanced Certified Interconnect Designers leading our layout team.', null, 4, 'published', now())
  on conflict (id) do update set name = excluded.name, description = excluded.description;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('82c2c086-4c1d-4c34-aedf-dcb2cedfdcba', 'Projects Delivered', 100, '', '+', 'home', 1, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('81c2bef3-9e49-404b-af8b-aeb8200bcf3e', 'Years in electronics design', 12, '', '', 'home', 2, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('80c2bd60-6e84-4626-ae46-9b46ef46e386', 'First-time EMC pass rate', 88, '', '%', 'home', 3, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('87c2c865-4eed-4865-a92f-8000d6b010ca', 'Average concept to prototype', 9, '', ' wks', 'home', 4, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('86c2c6d2-6a11-4fe8-acd3-d93af0d3e6ba', 'Boards laid out', 340, '', '+', 'about', 1, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('85c2c53f-e550-458f-a092-90b06b131ace', 'Engineers on the team', 14, '', '', 'about', 2, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('84c2c3ac-c2b4-401a-a676-73b6477773c6', 'Countries shipped to', 23, '', '', 'about', 3, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('8bc2ceb1-20ec-46c9-ab2e-e878acaef57a', 'Average BOM reduction', 24, '', '%', 'why', 1, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('8ac2cd1e-f7cd-472c-ad0f-6a328290744a', 'Median prototype revisions', 2, '', '', 'why', 2, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.stats (id, label, value, prefix, suffix, context, order_index, status, published_at)
  values ('8e955e82-790b-4864-a79e-66e607a096e6', 'Clients who return', 78, '', '%', 'why', 3, 'published', now())
  on conflict (id) do update set label = excluded.label, value = excluded.value;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('c6672d60-2f82-40f8-a9e5-0d98f5e94e58', 'Can you take a project from a napkin sketch through to production?', 'Yes — that is the common case. Discovery turns the concept into a written specification, and we carry it through schematic, layout, firmware, prototyping, compliance and manufacturing transfer. You can also join at any single stage if you already have work in progress.', 'services', 1, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('c9673219-9940-4cfd-a027-eee462a80f16', 'Do we own the design files at the end?', 'Always, and without negotiation. You receive the Altium or KiCad source project, firmware repositories, build systems, test procedures and manufacturing data. There is no scenario where you need us in order to build your own product.', 'services', 2, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('c8673086-6d21-478a-a546-d70c35891810', 'Will you work with our existing manufacturer?', 'Yes. We review against their published capability rather than a generic rule set, and we handle the technical liaison during quoting, first article and ramp. If you would like an introduction to a manufacturer instead, we can evaluate options on like-for-like terms.', 'services', 3, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('cb67353f-c354-4daf-a833-68908ebb92ee', 'How do you handle NDAs and confidential work?', 'We sign your NDA before any technical discussion — sending your own is the fastest route. Roughly a third of our work is under confidentiality and does not appear in our case studies at all.', 'services', 4, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('ca6733ac-74b9-4574-aede-26d83f204920', 'How long does a typical project take?', 'Concept to a working prototype averages nine weeks for a moderate-complexity board. A full programme through compliance and manufacturing transfer typically runs four to eight months. Discovery gives you a fixed schedule before anything is committed.', 'process', 1, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('cd673865-e21a-44d9-af7d-1cbcaf815d3e', 'How many prototype revisions should we budget for?', 'Two is our median; three is normal for a high-speed or high-power design carrying novel risk. A project that reaches revision five usually had an unresolved requirement, which is why discovery ends with a signed specification.', 'process', 2, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('cc6736d2-3176-4d76-ad11-cba4fdde3448', 'What happens if the design does not meet the specification?', 'It is our responsibility to close the gap. Characterisation happens against the written specification, findings go into an issue register with a root cause, and we iterate until the measured performance meets the target or you formally accept a deviation.', 'process', 3, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('cf673b8b-a95d-4a3b-a63a-b1b078c4c5c6', 'What do you need in order to quote?', 'The more constraints you can give, the tighter the quote: what the product does, the environment and compliance regime, expected volume, timeline and any existing schematics or BOM. If you only have a concept, tell us that and we will quote discovery first.', 'quote', 1, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('ce6739f8-f253-4260-ac34-5b98c0ba9c58', 'How do you price work?', 'Fixed price per phase wherever the scope allows it, which is most of the time. Exploratory or research-heavy work is time and materials with a capped budget and a written review point. We do not bill for scope we caused.', 'quote', 2, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('a46c54f0-239b-4bc4-a7f7-3f34c807c0b4', 'Is there a minimum project size?', 'No hard minimum. We take on short reviews — a DFM audit, a BOM risk assessment, an EMC investigation — as readily as full programmes, and they are often how a longer relationship starts.', 'quote', 3, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('a56c5683-b564-43bf-a008-c53c5ad0ea42', 'What is the highest layer count and density you work with?', 'Routinely up to 16 layers, HDI with 1+N+1 and 2+N+2 microvia builds, 0.4 mm pitch BGA fan-out and rigid-flex. We specify density only where the mechanics genuinely require it — a well-placed four-layer board often beats a rushed eight-layer one.', 'pcb-layout-and-high-speed-design', 1, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;
insert into public.faqs (id, question, answer, scope, order_index, status, published_at)
  values ('a66c5816-a185-4646-a7e9-2e5047f1ce5c', 'Do you provide firmware for hardware you did not design?', 'Yes, including bring-up and debugging of boards from other suppliers. We start with a review of the schematic and layout, because roughly a third of ''firmware'' problems we are handed turn out to be hardware.', 'embedded-systems-and-firmware', 1, 'published', now())
  on conflict (id) do update set question = excluded.question, answer = excluded.answer, scope = excluded.scope;

-- ---------- pcb_models, hotspots, variants ----------
insert into public.pcb_models (id, name, slug, storage_path, board_definition, camera_default, camera_limits, scale, is_hero, status, published_at)
  values ('af362222-75c4-4648-aaf2-746a24fa786a', 'Anode reference board — rev 3', 'anode-hero', null, '{"width":3.4,"depth":2.3,"thickness":0.08,"notch":{"x":1.7,"z":0.75,"w":0.42,"d":0.5},"mountingHoles":[{"x":-1.52,"z":-0.98,"r":0.085},{"x":-1.52,"z":0.98,"r":0.085},{"x":1.5,"z":-0.98,"r":0.085}],"parts":[{"id":"u1","kind":"qfp","ref":"U1","x":0.05,"z":0,"w":0.86,"d":0.86,"h":0.075,"pins":24,"color":"#12181c"},{"id":"u2","kind":"qfn","ref":"U2","x":0.98,"z":0.62,"w":0.44,"d":0.44,"h":0.05,"pins":12,"color":"#161d22"},{"id":"u3","kind":"regulator","ref":"U3","x":-0.82,"z":-0.62,"w":0.3,"d":0.24,"h":0.055,"color":"#191f24"},{"id":"l1","kind":"inductor","ref":"L1","x":-0.5,"z":-0.66,"w":0.24,"d":0.24,"h":0.13},{"id":"c1","kind":"electrolytic","ref":"C1","x":0.62,"z":-0.72,"w":0.2,"d":0.2,"h":0.24},{"id":"c2","kind":"electrolytic","ref":"C2","x":0.92,"z":-0.7,"w":0.17,"d":0.17,"h":0.2},{"id":"c3","kind":"electrolytic","ref":"C3","x":1.18,"z":-0.68,"w":0.15,"d":0.15,"h":0.17},{"id":"y1","kind":"crystal","ref":"Y1","x":-0.28,"z":0.52,"w":0.28,"d":0.16,"h":0.05},{"id":"j1","kind":"usbc","ref":"J1","x":-1.52,"z":0.3,"w":0.3,"d":0.5,"h":0.12},{"id":"j2","kind":"header","ref":"J2","x":1.32,"z":-0.12,"w":0.16,"d":1.1,"h":0.26,"pins":10},{"id":"j3","kind":"coax","ref":"J3","x":-0.62,"z":0.86,"w":0.16,"d":0.16,"h":0.3},{"id":"j4","kind":"connector","ref":"J4","x":0.4,"z":0.88,"w":0.72,"d":0.14,"h":0.09},{"id":"d1","kind":"led","ref":"D1","x":-1.18,"z":-0.3,"w":0.07,"d":0.05,"h":0.03,"color":"#3ee08a"},{"id":"d2","kind":"led","ref":"D2","x":-1.18,"z":-0.16,"w":0.07,"d":0.05,"h":0.03,"color":"#ffb340"},{"id":"cd0","kind":"passive","ref":"C11","x":0.7107732071122155,"z":0,"w":0.075,"d":0.045,"h":0.022,"rotation":0},{"id":"cd1","kind":"passive","ref":"C12","x":0.6594795803285779,"z":0.2524547081615592,"w":0.075,"d":0.045,"h":0.022,"rotation":1.5707963267948966},{"id":"cd2","kind":"passive","ref":"C13","x":0.5063375812321826,"z":0.4563375812321826,"w":0.075,"d":0.045,"h":0.022,"rotation":0},{"id":"cd3","kind":"passive","ref":"C14","x":0.31001031198295625,"z":0.6277204215461125,"w":0.075,"d":0.045,"h":0.022,"rotation":1.5707963267948966},{"id":"cd4","kind":"passive","ref":"C15","x":0.050000000000000044,"z":0.6474014006601646,"w":0.075,"d":0.045,"h":0.022,"rotation":0},{"id":"cd5","kind":"passive","ref":"C16","x":-0.18831107503609762,"z":0.5753338294158592,"w":0.075,"d":0.045,"h":0.022,"rotation":1.5707963267948966},{"id":"cd6","kind":"passive","ref":"C17","x":-0.4064897104300552,"z":0.45648971043005526,"w":0.075,"d":0.045,"h":0.022,"rotation":0},{"id":"cd7","kind":"passive","ref":"C18","x":-0.5902095932790624,"z":0.26518349629755084,"w":0.075,"d":0.045,"h":0.022,"rotation":1.5707963267948966},{"id":"cd8","kind":"passive","ref":"C19","x":-0.5769435394136234,"z":7.677843987890064e-17,"w":0.075,"d":0.045,"h":0.022,"rotation":0},{"id":"cd9","kind":"passive","ref":"C20","x":-0.6046057096289502,"z":-0.27114656293517525,"w":0.075,"d":0.045,"h":0.022,"rotation":1.5707963267948966},{"id":"cd10","kind":"passive","ref":"C21","x":-0.4176463639111026,"z":-0.4676463639111025,"w":0.075,"d":0.045,"h":0.022,"rotation":0},{"id":"cd11","kind":"passive","ref":"C22","x":-0.21337873972772675,"z":-0.6358525254914102,"w":0.075,"d":0.045,"h":0.022,"rotation":1.5707963267948966},{"id":"cd12","kind":"passive","ref":"C23","x":0.049999999999999885,"z":-0.625666143191047,"w":0.075,"d":0.045,"h":0.022,"rotation":0},{"id":"cd13","kind":"passive","ref":"C24","x":0.3133322454572406,"z":-0.6357402783930306,"w":0.075,"d":0.045,"h":0.022,"rotation":1.5707963267948966},{"id":"cd14","kind":"passive","ref":"C25","x":0.5265759615355394,"z":-0.4765759615355396,"w":0.075,"d":0.045,"h":0.022,"rotation":0},{"id":"cd15","kind":"passive","ref":"C26","x":0.6591230698183747,"z":-0.2523070366731049,"w":0.075,"d":0.045,"h":0.022,"rotation":1.5707963267948966},{"id":"cp0","kind":"passive","ref":"R17","x":-1.15,"z":0.62,"w":0.08,"d":0.048,"h":0.022,"rotation":1.5707963267948966},{"id":"cp1","kind":"passive","ref":"R18","x":-1,"z":0.72,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp2","kind":"passive","ref":"R19","x":-0.9,"z":0.2,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp3","kind":"passive","ref":"R20","x":-1.1,"z":0.05,"w":0.08,"d":0.048,"h":0.022,"rotation":1.5707963267948966},{"id":"cp4","kind":"passive","ref":"R21","x":-1.22,"z":0.35,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp5","kind":"passive","ref":"R22","x":-0.35,"z":-0.9,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp6","kind":"passive","ref":"R23","x":-0.1,"z":-0.85,"w":0.08,"d":0.048,"h":0.022,"rotation":1.5707963267948966},{"id":"cp7","kind":"passive","ref":"R24","x":0.18,"z":-0.9,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp8","kind":"passive","ref":"R25","x":1.05,"z":0.05,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp9","kind":"passive","ref":"R26","x":1.02,"z":-0.25,"w":0.08,"d":0.048,"h":0.022,"rotation":1.5707963267948966},{"id":"cp10","kind":"passive","ref":"R27","x":0.62,"z":0.5,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp11","kind":"passive","ref":"R28","x":0.75,"z":0.28,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp12","kind":"passive","ref":"R29","x":-0.55,"z":-0.35,"w":0.08,"d":0.048,"h":0.022,"rotation":1.5707963267948966},{"id":"cp13","kind":"passive","ref":"R30","x":-0.3,"z":-0.55,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp14","kind":"passive","ref":"R31","x":1.2,"z":0.35,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp15","kind":"passive","ref":"R32","x":0.35,"z":-0.5,"w":0.08,"d":0.048,"h":0.022,"rotation":1.5707963267948966},{"id":"cp16","kind":"passive","ref":"R33","x":-0.72,"z":0.4,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp17","kind":"passive","ref":"R34","x":1.12,"z":0.78,"w":0.08,"d":0.048,"h":0.022,"rotation":0},{"id":"cp18","kind":"passive","ref":"R35","x":0.15,"z":0.72,"w":0.08,"d":0.048,"h":0.022,"rotation":1.5707963267948966},{"id":"cp19","kind":"passive","ref":"R36","x":-1.35,"z":-0.6,"w":0.08,"d":0.048,"h":0.022,"rotation":0}],"traces":[{"points":[[0.48,-0.38],[0.72,-0.38],[0.82,-0.33],[1,-0.33],[1.1,-0.38],[1.24,-0.38]],"width":0.014,"layer":"top"},{"points":[[0.48,-0.28500000000000003],[0.72,-0.28500000000000003],[0.82,-0.23500000000000004],[1,-0.23500000000000004],[1.1,-0.28500000000000003],[1.24,-0.28500000000000003]],"width":0.014,"layer":"top"},{"points":[[0.48,-0.19],[0.72,-0.19],[0.82,-0.14],[1,-0.14],[1.1,-0.19],[1.24,-0.19]],"width":0.014,"layer":"top"},{"points":[[0.48,-0.09499999999999997],[0.72,-0.09499999999999997],[0.82,-0.04499999999999997],[1,-0.04499999999999997],[1.1,-0.09499999999999997],[1.24,-0.09499999999999997]],"width":0.014,"layer":"top"},{"points":[[0.48,0],[0.72,0],[0.82,0.05],[1,0.05],[1.1,0],[1.24,0]],"width":0.014,"layer":"top"},{"points":[[0.48,0.09499999999999997],[0.72,0.09499999999999997],[0.82,0.14499999999999996],[1,0.14499999999999996],[1.1,0.09499999999999997],[1.24,0.09499999999999997]],"width":0.014,"layer":"top"},{"points":[[0.48,0.19000000000000006],[0.72,0.19000000000000006],[0.82,0.24000000000000005],[1,0.24000000000000005],[1.1,0.19000000000000006],[1.24,0.19000000000000006]],"width":0.014,"layer":"top"},{"points":[[0.48,0.28500000000000003],[0.72,0.28500000000000003],[0.82,0.335],[1,0.335],[1.1,0.28500000000000003],[1.24,0.28500000000000003]],"width":0.014,"layer":"top"},{"points":[[-0.38,0.024999999999999994],[-0.7,0.024999999999999994],[-0.86,0.145],[-1.24,0.145],[-1.38,0.265]],"width":0.016,"layer":"top"},{"points":[[-0.38,0.095],[-0.7,0.095],[-0.86,0.215],[-1.24,0.215],[-1.38,0.33499999999999996]],"width":0.016,"layer":"top"},{"points":[[-0.68,-0.62],[-0.2,-0.62],[-0.05,-0.5],[-0.05,-0.44]],"width":0.05,"layer":"top"},{"points":[[-0.5,-0.54],[-0.5,-0.2],[-0.34,-0.06]],"width":0.045,"layer":"top"},{"points":[[0.1,0.46],[0.1,0.68],[0.12000000000000001,0.78]],"width":0.013,"layer":"top"},{"points":[[0.22,0.46],[0.22,0.68],[0.24,0.78]],"width":0.013,"layer":"top"},{"points":[[0.33999999999999997,0.46],[0.33999999999999997,0.68],[0.36,0.78]],"width":0.013,"layer":"top"},{"points":[[0.45999999999999996,0.46],[0.45999999999999996,0.68],[0.48,0.78]],"width":0.013,"layer":"top"},{"points":[[0.58,0.46],[0.58,0.68],[0.6,0.78]],"width":0.013,"layer":"top"},{"points":[[0.7,0.46],[0.7,0.68],[0.72,0.78]],"width":0.013,"layer":"top"},{"points":[[-0.28,0.44],[-0.28,0.3],[-0.2,0.24]],"width":0.013,"layer":"top"},{"points":[[-0.36,0.44],[-0.36,0.34],[-0.26,0.24]],"width":0.013,"layer":"top"},{"points":[[-1.4,-0.75],[0.9,-0.75],[1.25,-0.5]],"width":0.02,"layer":"inner"},{"points":[[-1.4,0.86],[-0.9,0.86],[-0.75,0.92]],"width":0.02,"layer":"inner"}]}'::jsonb, '{"position":[2.6,2.35,3],"target":[0,0,0],"fov":34}'::jsonb, '{"minPolar":12,"maxPolar":82,"minZoom":0.55,"maxZoom":2.2}'::jsonb, 1, true, 'published', now())
  on conflict (id) do update set board_definition = excluded.board_definition,
    camera_default = excluded.camera_default, camera_limits = excluded.camera_limits;
delete from public.pcb_hotspots where model_id = 'af362222-75c4-4648-aaf2-746a24fa786a';
insert into public.pcb_hotspots (id, model_id, label, value, detail, icon, position, normal, anchor, body, link_url, variant_key, order_index)
  values ('e4741bd1-aecd-458f-aab9-ee5e93421160', 'af362222-75c4-4648-aaf2-746a24fa786a', 'Component', 'MCU', 'STM32H743', 'cpu', '{"x":0.05,"y":0.12,"z":0}'::jsonb, '{"x":0,"y":1,"z":0}'::jsonb, 'right', '480 MHz Cortex-M7 with 2 MB flash and 1 MB SRAM. Chosen for the DSP throughput the sensor fusion needs and for its 15-year longevity commitment.', '/services/embedded-systems-and-firmware', null, 1);
insert into public.pcb_hotspots (id, model_id, label, value, detail, icon, position, normal, anchor, body, link_url, variant_key, order_index)
  values ('3167a9a6-f51a-413a-a47d-589c26829ae0', 'af362222-75c4-4648-aaf2-746a24fa786a', 'Layer 4', 'Signal', '50 Ω ±10 %', 'layers', '{"x":-1.35,"y":0.06,"z":-0.86}'::jsonb, '{"x":-0.6,"y":0.6,"z":-0.5}'::jsonb, 'left', 'Inner signal layer referenced to a solid ground plane on layer 3, giving controlled impedance and a continuous return path under every high-speed net.', '/services/pcb-layout-and-high-speed-design', null, 2);
insert into public.pcb_hotspots (id, model_id, label, value, detail, icon, position, normal, anchor, body, link_url, variant_key, order_index)
  values ('996bf71c-b62e-4118-af45-56044f9a9834', 'af362222-75c4-4648-aaf2-746a24fa786a', 'Temperature', '42 °C', 'ΔT 21 °C', 'thermometer', '{"x":-0.66,"y":0.12,"z":-0.64}'::jsonb, '{"x":0,"y":1,"z":-0.3}'::jsonb, 'bottom', 'Measured at the regulator case at full load in 25 °C ambient. The via field beneath carries heat into the inner planes rather than into the sensor zone.', '/projects/iot-environmental-monitor', null, 3);
insert into public.pcb_hotspots (id, model_id, label, value, detail, icon, position, normal, anchor, body, link_url, variant_key, order_index)
  values ('dca1f9af-f531-4369-a990-6ac6d1d38d18', 'af362222-75c4-4648-aaf2-746a24fa786a', 'Power', '3.3 V', '1.2 A · 94 %', 'zap', '{"x":1.32,"y":0.2,"z":-0.12}'::jsonb, '{"x":0.7,"y":0.7,"z":0}'::jsonb, 'right', 'Synchronous buck at 2.2 MHz, synchronised to the ADC conversion clock so its switching residual falls outside the measurement band.', '/services/circuit-and-schematic-design', null, 4);
delete from public.pcb_model_variants where model_id = 'af362222-75c4-4648-aaf2-746a24fa786a';
insert into public.pcb_model_variants (id, model_id, key, display_name, icon, config, order_index)
  values ('d335a790-246f-4414-a75a-2384f7a52ba4', 'af362222-75c4-4648-aaf2-746a24fa786a', 'components', 'Components', 'cpu', '{"camera":{"position":[2.6,2.35,3],"target":[0,0,0],"fov":34},"showHotspots":["*"],"annotation":{"text":"214 placements · 0.4 mm pitch BGA fan-out","position":"bottom-left"},"autoRotate":true}'::jsonb, 1);
insert into public.pcb_model_variants (id, model_id, key, display_name, icon, config, order_index)
  values ('8ea214c6-131b-4432-adb9-10f4a1bd18f8', 'af362222-75c4-4648-aaf2-746a24fa786a', 'layers', 'Layer stack', 'layers', '{"camera":{"position":[0.6,1.5,4.2],"target":[0,0,0],"fov":30},"materials":{"solderMask":{"opacity":0.28},"components":{"visible":false}},"showHotspots":["layer-4"],"annotation":{"text":"6 layers · 1.6 mm · signal / GND / power / signal","position":"bottom-left"},"autoRotate":false}'::jsonb, 2);
insert into public.pcb_model_variants (id, model_id, key, display_name, icon, config, order_index)
  values ('4580dca4-06e8-4f7c-a368-93d84c692c20', 'af362222-75c4-4648-aaf2-746a24fa786a', 'grid', 'Dimensions', 'grid-3x3', '{"camera":{"position":[0,4.4,0.01],"target":[0,0,0],"fov":28},"showHotspots":[],"annotation":{"text":"78 × 52 mm · IPC-6012 Class 2 · ENIG finish","position":"bottom-left"},"autoRotate":false}'::jsonb, 3);

commit;
