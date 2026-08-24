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
