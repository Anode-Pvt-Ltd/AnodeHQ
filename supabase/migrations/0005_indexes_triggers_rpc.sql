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
  order by rank desc
  limit greatest(1, least(lim, 50));
$$;

grant execute on function public.search_all(text, int) to anon, authenticated;

-- Status change and history in one transaction
create or replace function public.move_quote_status(
  p_id uuid, p_to public.quote_status, p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_from public.quote_status;
begin
  if not public.has_role(auth.uid(), 'sales') then
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
