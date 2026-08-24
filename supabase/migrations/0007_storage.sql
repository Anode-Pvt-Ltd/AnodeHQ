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
