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
        for select to authenticated using (public.is_staff('sales'))
    $f$, t);

    execute format('drop policy if exists "sales update" on public.%I', t);
    execute format($f$
      create policy "sales update" on public.%I
        for update to authenticated
        using (public.is_staff('sales')) with check (public.is_staff('sales'))
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
