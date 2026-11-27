-- Run as a database administrator on a disposable Supabase database after
-- applying the migrations in docs/deployment.md. All fixtures are rolled back.
begin;

insert into auth.users (id) values
  ('11000000-0000-0000-0000-000000000001'),
  ('11000000-0000-0000-0000-000000000002'),
  ('11000000-0000-0000-0000-000000000003'),
  ('11000000-0000-0000-0000-000000000004'),
  ('11000000-0000-0000-0000-000000000005');

insert into public.workspace_members (user_id, role, active, is_owner) values
  ('11000000-0000-0000-0000-000000000001', 'editor', true, true),
  ('11000000-0000-0000-0000-000000000002', 'editor', true, false),
  ('11000000-0000-0000-0000-000000000003', 'reader', true, false),
  ('11000000-0000-0000-0000-000000000004', 'selectstar_reader', true, false),
  ('11000000-0000-0000-0000-000000000005', 'editor', false, true);

insert into public.workspaces (state, taxonomy_source, legacy_seed)
values ('{"version":4,"goals":[],"phases":[],"tasks":[],"notes":[],"references":[]}', '{}', '{}');

-- Seed existing projects for the Reader and the Company user to test direct reads.
insert into public.paper_projects (id, user_id, revision) values
  (gen_random_uuid(), '11000000-0000-0000-0000-000000000003', gen_random_uuid()),
  (gen_random_uuid(), '11000000-0000-0000-0000-000000000004', gen_random_uuid());

set local role authenticated;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);

insert into public.markdown_folders (id, name, updated_by)
values ('11000000-0000-0000-0000-000000000006', 'Fixture folder', (select auth.uid()));
insert into public.markdown_documents (folder_id, title, updated_by)
values ('11000000-0000-0000-0000-000000000006', 'Fixture document', (select auth.uid()));

do $$
declare
  member integer;
begin
  update public.markdown_documents set title = 'Updated by owner';
  if not found then raise exception 'Owner cannot update Markdown'; end if;

  for member in 2..5 loop
    perform set_config('request.jwt.claim.sub',
      '11000000-0000-0000-0000-00000000000' || member, true);
    if exists (select 1 from public.markdown_folders)
      or exists (select 1 from public.markdown_documents) then
      raise exception 'Membership % can read Markdown', member;
    end if;
    begin
      insert into public.markdown_folders (name, updated_by) values ('Denied', (select auth.uid()));
      raise exception 'Membership % can insert Markdown', member;
    exception when insufficient_privilege then
      null;
    end;
    update public.markdown_documents set title = 'Denied';
    if found then raise exception 'Membership % can update Markdown', member; end if;
    delete from public.markdown_folders;
    if found then raise exception 'Membership % can delete Markdown', member; end if;
  end loop;

  perform set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000004', true);
  if not exists (select 1 from public.workspaces) then raise exception 'Company cannot read Work'; end if;
  update public.workspaces set revision = revision + 1;
  if found then raise exception 'Company can update Work'; end if;
  if exists (select 1 from public.paper_projects) then raise exception 'Company can read Paper'; end if;

  perform set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000003', true);
  if not exists (select 1 from public.paper_projects) then raise exception 'Reader lost Paper read access'; end if;

  perform set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
  update public.workspaces set revision = revision + 1;
  if not found then raise exception 'Editor lost Work write access'; end if;

  perform set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
  delete from public.markdown_folders where id = '11000000-0000-0000-0000-000000000006';
  if not found then raise exception 'Owner cannot delete Markdown'; end if;
end;
$$;

rollback;
