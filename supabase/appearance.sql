create table public.site_appearance (
 id text primary key default 'site' check(id='site'),
 config jsonb not null default '{"images":{"light":null,"dark":null},"speed":40}'::jsonb,
 revision uuid not null,updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 constraint site_appearance_config check(coalesce(jsonb_typeof(config)='object' and jsonb_typeof(config->'images')='object' and jsonb_typeof(config->'speed')='number' and (config->>'speed')::numeric between 0 and 100,false))
);
alter table public.site_appearance enable row level security;
revoke all on public.site_appearance from anon,authenticated;
grant select on public.site_appearance to anon,authenticated;
grant insert,update on public.site_appearance to authenticated;
create policy site_appearance_public_read on public.site_appearance for select to anon,authenticated using (true);
create policy site_appearance_editor_insert on public.site_appearance for insert to authenticated with check (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy site_appearance_editor_update on public.site_appearance for update to authenticated using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor')) with check (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('site-backgrounds','site-backgrounds',true,15000000,array['image/png','image/jpeg','image/webp']);
create policy site_backgrounds_editor_insert on storage.objects for insert to authenticated with check (bucket_id='site-backgrounds' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy site_backgrounds_owner_read on storage.objects for select to authenticated using (bucket_id='site-backgrounds' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active));
