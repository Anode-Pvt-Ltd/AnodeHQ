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
