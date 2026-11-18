-- The dashboard consumes one read-only Notion snapshot through the member's session.
create table public.team_resource_snapshots (
  id text primary key check (id = 'current'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.team_resource_snapshots enable row level security;

revoke all on public.team_resource_snapshots from public, anon, authenticated;
grant select on public.team_resource_snapshots to authenticated;
grant select, insert, update on public.team_resource_snapshots to service_role;

create policy team_resource_members_read
on public.team_resource_snapshots
for select to authenticated
using (
  exists (
    select 1
    from public.workspace_members
    where user_id = (select auth.uid()) and active
  )
);
