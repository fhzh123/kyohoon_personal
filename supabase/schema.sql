-- Run manually in a NEW Supabase project's SQL editor as the project owner.
-- No credentials or research content belongs in this migration.
begin;

create table if not exists public.workspace_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'reader' check (role in ('reader', 'editor')),
  active boolean not null default true
);

create table if not exists public.workspaces (
  id text primary key default 'research' check (id = 'research'),
  state jsonb not null check (
    jsonb_typeof(state) = 'object'
    and state ?& array['version','goals','phases','tasks','notes','references']
    and jsonb_typeof(state->'version') = 'number'
    and state->>'version' in ('1','2','3','4')
    and jsonb_typeof(state->'goals') = 'array'
    and jsonb_typeof(state->'phases') = 'array'
    and jsonb_typeof(state->'tasks') = 'array'
    and jsonb_typeof(state->'notes') = 'array'
    and jsonb_typeof(state->'references') = 'array'
  ),
  taxonomy_source jsonb not null check (jsonb_typeof(taxonomy_source) = 'object'),
  legacy_seed jsonb not null check (jsonb_typeof(legacy_seed) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.workspace_members enable row level security;
alter table public.workspaces enable row level security;

-- These helpers inspect ONLY the caller's active membership. They accept no
-- user-id argument. Schema-qualified names + an empty search_path prevent
-- object replacement attacks and avoid a self-referencing RLS query.
create or replace function public.can_read_research()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = (select auth.uid()) and active = true
  );
$$;

create or replace function public.can_edit_research()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = (select auth.uid()) and active = true and role = 'editor'
  );
$$;

revoke all on function public.can_read_research() from public, anon;
revoke all on function public.can_edit_research() from public, anon;
grant execute on function public.can_read_research() to authenticated, service_role;
grant execute on function public.can_edit_research() to authenticated, service_role;

revoke all on public.workspace_members from anon, authenticated;
revoke all on public.workspaces from anon, authenticated;
grant select on public.workspace_members to authenticated;
grant select on public.workspaces to authenticated;
-- Normal website credentials cannot alter the protected taxonomy/legacy seed,
-- create workspaces, or grant membership. The import script is admin-only.
grant update (state, revision, updated_at) on public.workspaces to authenticated;
grant all on public.workspace_members, public.workspaces to service_role;

drop policy if exists members_read_self on public.workspace_members;
create policy members_read_self on public.workspace_members
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists research_members_read on public.workspaces;
create policy research_members_read on public.workspaces
for select to authenticated
using (id = 'research' and (select public.can_read_research()));

drop policy if exists research_editors_update on public.workspaces;
create policy research_editors_update on public.workspaces
for update to authenticated
using (id = 'research' and (select public.can_edit_research()))
with check (id = 'research' and (select public.can_edit_research()));

-- A dedicated PRIVATE bucket. Table RLS alone does not protect a public bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-attachments', 'work-attachments', false, 20971520,
  array['image/png','image/webp','image/jpeg','application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set public = false;

drop policy if exists research_files_members_read on storage.objects;
create policy research_files_members_read on storage.objects
for select to authenticated
using (
  bucket_id = 'work-attachments'
  and (storage.foldername(name))[1] = 'research'
  and (select public.can_read_research())
);

drop policy if exists research_files_editors_insert on storage.objects;
create policy research_files_editors_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'work-attachments'
  and (storage.foldername(name))[1] = 'research'
  and (select public.can_edit_research())
);

drop policy if exists research_files_editors_update on storage.objects;
create policy research_files_editors_update on storage.objects
for update to authenticated
using (
  bucket_id = 'work-attachments'
  and (storage.foldername(name))[1] = 'research'
  and (select public.can_edit_research())
)
with check (
  bucket_id = 'work-attachments'
  and (storage.foldername(name))[1] = 'research'
  and (select public.can_edit_research())
);

drop policy if exists research_files_editors_delete on storage.objects;
create policy research_files_editors_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'work-attachments'
  and (storage.foldername(name))[1] = 'research'
  and (select public.can_edit_research())
);

-- No anonymous policies, no client membership mutation policies, no client
-- workspace insert/delete policies. Keep any additional policies under review.
commit;
