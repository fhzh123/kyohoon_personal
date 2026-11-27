-- Apply after schema.sql, markdown.sql, and paper.sql as the project owner.
begin;

alter table public.workspace_members
  add column if not exists is_owner boolean not null default false;
alter table public.workspace_members
  drop constraint if exists workspace_members_role_check,
  drop constraint if exists workspace_members_owner_editor_check;
alter table public.workspace_members
  add constraint workspace_members_role_check
    check (role in ('reader', 'editor', 'selectstar_reader')),
  add constraint workspace_members_owner_editor_check
    check (not is_owner or role = 'editor');

-- The existing policies still enforce updated_by and other operation rules.
-- A restrictive policy requires ownership even if another policy permits a row.
drop policy if exists markdown_folders_site_owner_only on public.markdown_folders;
create policy markdown_folders_site_owner_only on public.markdown_folders
as restrictive for all to authenticated
using ((select exists (
  select 1 from public.workspace_members
  where user_id = (select auth.uid()) and active and role = 'editor' and is_owner
)))
with check ((select exists (
  select 1 from public.workspace_members
  where user_id = (select auth.uid()) and active and role = 'editor' and is_owner
)));

drop policy if exists markdown_documents_site_owner_only on public.markdown_documents;
create policy markdown_documents_site_owner_only on public.markdown_documents
as restrictive for all to authenticated
using ((select exists (
  select 1 from public.workspace_members
  where user_id = (select auth.uid()) and active and role = 'editor' and is_owner
)))
with check ((select exists (
  select 1 from public.workspace_members
  where user_id = (select auth.uid()) and active and role = 'editor' and is_owner
)));

-- Paper's original read policies otherwise accept every active member. Write
-- policies for Paper, travel, appearance and Work already require editor.
alter policy paper_projects_owner_read on public.paper_projects
using (user_id = (select auth.uid()) and (select exists (
  select 1 from public.workspace_members
  where user_id = (select auth.uid()) and active and role in ('reader', 'editor')
)));

alter policy paper_files_owner_read on storage.objects
using (bucket_id = 'paper-files' and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select exists (
    select 1 from public.workspace_members
    where user_id = (select auth.uid()) and active and role in ('reader', 'editor')
  )));

commit;
