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
