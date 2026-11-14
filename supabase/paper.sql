-- Apply after the reviewed Paper implementation is approved.
create table if not exists public.paper_projects (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb,revision uuid not null,updated_at timestamptz not null default now()
);
create index if not exists paper_projects_owner_updated on public.paper_projects(user_id,updated_at desc);
create table if not exists public.paper_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,config jsonb not null default '{}'::jsonb,
 encrypted_keys jsonb not null default '{}'::jsonb,revision uuid not null,updated_at timestamptz not null default now()
);
alter table public.paper_projects enable row level security;
alter table public.paper_settings enable row level security;
revoke all on public.paper_projects,public.paper_settings from anon;
grant select,insert,update,delete on public.paper_projects,public.paper_settings to authenticated;
create policy paper_projects_owner_read on public.paper_projects for select to authenticated
 using ((select auth.uid())=user_id and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active));
create policy paper_projects_owner_write on public.paper_projects for all to authenticated
 using ((select auth.uid())=user_id and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'))
 with check ((select auth.uid())=user_id and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy paper_settings_owner on public.paper_settings for all to authenticated
 using ((select auth.uid())=user_id and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'))
 with check ((select auth.uid())=user_id and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('paper-files','paper-files',false,2500000,array['application/pdf']) on conflict(id) do nothing;
create policy paper_files_owner_read on storage.objects for select to authenticated
 using(bucket_id='paper-files' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active));
create policy paper_files_owner_insert on storage.objects for insert to authenticated
 with check(bucket_id='paper-files' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy paper_files_owner_delete on storage.objects for delete to authenticated
 using(bucket_id='paper-files' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
