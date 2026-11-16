-- Public travel journal; active workspace editors alone may publish changes.
create table public.travel_media (
  path text primary key,
  owner_id uuid not null references auth.users(id),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 12 and 8000000),
  created_at timestamptz not null default now(),
  check (path like owner_id::text || '/%')
);
create index travel_media_owner_id_idx on public.travel_media(owner_id);
create table public.travel_entries (
  region_id text primary key check (region_id ~ '^[A-Z]{3}-[0-9]+$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 3000),
  purpose text not null check (purpose in ('conference','tour')),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 24),
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index travel_entries_updated_by_idx on public.travel_entries(updated_by);
create table public.travel_settings (
  id text primary key check (id = 'site'),
  config jsonb not null,
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index travel_settings_updated_by_idx on public.travel_settings(updated_by);
alter table public.travel_entries enable row level security;
alter table public.travel_settings enable row level security;
alter table public.travel_media enable row level security;
grant select on public.travel_entries, public.travel_settings to anon, authenticated;
grant insert, update on public.travel_entries, public.travel_settings to authenticated;
grant select, insert on public.travel_media to authenticated;
create policy travel_entries_public_read on public.travel_entries for select to anon, authenticated using (true);
create policy travel_settings_public_read on public.travel_settings for select to anon, authenticated using (true);
create policy travel_media_editor_read on public.travel_media for select to authenticated using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy travel_media_editor_insert on public.travel_media for insert to authenticated with check (owner_id=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy travel_entries_editor_insert on public.travel_entries for insert to authenticated with check (
 updated_by=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor')
 and not exists(select 1 from jsonb_array_elements_text(photos) p where not exists(select 1 from public.travel_media media where media.path=p.value))
);
create policy travel_entries_editor_update on public.travel_entries for update to authenticated using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor')) with check (
 updated_by=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor')
 and not exists(select 1 from jsonb_array_elements_text(photos) p where not exists(select 1 from public.travel_media media where media.path=p.value))
);
create policy travel_settings_editor_insert on public.travel_settings for insert to authenticated with check (updated_by=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy travel_settings_editor_update on public.travel_settings for update to authenticated using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor')) with check (updated_by=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
insert into public.travel_settings(id,config) values ('site','{"conference":"#e16a79","tour":"#6098e8","unvisited":"#6f9c80"}'::jsonb);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('travel-photos','travel-photos',true,8000000,array['image/jpeg','image/png','image/webp']);
create policy travel_photos_editor_insert on storage.objects for insert to authenticated with check (bucket_id='travel-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy travel_photos_editor_read on storage.objects for select to authenticated using (bucket_id='travel-photos' and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
