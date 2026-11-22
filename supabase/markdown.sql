-- Private Markdown documents. Apply after schema.sql as the project owner.
begin;

create table public.markdown_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index markdown_folders_updated_by_idx on public.markdown_folders(updated_by);

create table public.markdown_documents (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.markdown_folders(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  content text not null default '' check (char_length(content) <= 500000),
  theme text not null default 'ivory' check (theme in ('ivory','github-dark','chrome','sprinkles')),
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index markdown_documents_folder_id_idx on public.markdown_documents(folder_id);
create index markdown_documents_updated_by_idx on public.markdown_documents(updated_by);

alter table public.markdown_folders enable row level security;
alter table public.markdown_documents enable row level security;

revoke all on public.markdown_folders, public.markdown_documents from anon, authenticated;
grant select, insert, update, delete on public.markdown_folders, public.markdown_documents to authenticated;
grant all on public.markdown_folders, public.markdown_documents to service_role;

create policy markdown_folders_member_read on public.markdown_folders for select to authenticated
using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active));
create policy markdown_documents_member_read on public.markdown_documents for select to authenticated
using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active));

create policy markdown_folders_editor_insert on public.markdown_folders for insert to authenticated
with check (updated_by=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy markdown_folders_editor_update on public.markdown_folders for update to authenticated
using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'))
with check (updated_by=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy markdown_folders_editor_delete on public.markdown_folders for delete to authenticated
using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));

create policy markdown_documents_editor_insert on public.markdown_documents for insert to authenticated
with check (updated_by=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy markdown_documents_editor_update on public.markdown_documents for update to authenticated
using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'))
with check (updated_by=(select auth.uid()) and exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));
create policy markdown_documents_editor_delete on public.markdown_documents for delete to authenticated
using (exists(select 1 from public.workspace_members m where m.user_id=(select auth.uid()) and m.active and m.role='editor'));

commit;
