-- Calendar: the owner's own Personal and Paper events, and how the calendars are shown.
-- Selectstar events stay in Outlook; the server reads them from the published link and
-- never stores them here. Run after selectstar-access.sql (it adds workspace_members.is_owner).
begin;

-- Runs as the caller: members_read_self lets each member read only their own row.
create or replace function public.is_site_owner()
returns boolean language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where user_id = (select auth.uid()) and active and role = 'editor' and is_owner
  );
$$;
revoke all on function public.is_site_owner() from public, anon;
grant execute on function public.is_site_owner() to authenticated, service_role;

-- All-day events are stored as midnight-to-midnight in Korea time (end exclusive);
-- the server turns them back into plain dates.
create table public.calendar_events (
  id uuid primary key,
  cal text not null check (cal in ('personal', 'paper')),
  title text not null check (char_length(title) between 1 and 200),
  all_day boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  place text not null default '' check (char_length(place) <= 200),
  note text not null default '' check (char_length(note) <= 4000),
  revision uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '400 days')
);
create index calendar_events_range_idx on public.calendar_events (starts_at, ends_at);

create table public.calendar_settings (
  id text primary key default 'site' check (id = 'site'),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  revision uuid not null,
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;
alter table public.calendar_settings enable row level security;
revoke all on public.calendar_events, public.calendar_settings from anon, authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;
grant select, insert, update on public.calendar_settings to authenticated;
grant all on public.calendar_events, public.calendar_settings to service_role;

create policy calendar_events_owner_only on public.calendar_events
for all to authenticated
using ((select public.is_site_owner()))
with check ((select public.is_site_owner()));

create policy calendar_settings_owner_only on public.calendar_settings
for all to authenticated
using ((select public.is_site_owner()))
with check ((select public.is_site_owner()));

commit;
