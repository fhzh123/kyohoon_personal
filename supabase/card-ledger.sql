-- Add the fourth Work tool. Run after the existing private workspace setup.
-- Original workbooks are small and remain in the same protected database row
-- as their normalized transactions, so month replacement is atomic.
begin;
create table public.card_ledger_months (
  id text primary key,
  year integer not null check(year between 2020 and 2100),
  month integer not null check(month between 1 and 12),
  card_last4 text not null check(card_last4 ~ '^[0-9]{4}$'),
  file_name text not null check(length(file_name) between 1 and 180),
  file_modified_at timestamptz,
  uploaded_at timestamptz not null default now(),
  as_of date not null,
  complete boolean not null default false,
  revision uuid not null default gen_random_uuid(),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  rows jsonb not null check(jsonb_typeof(rows)='array' and jsonb_array_length(rows)<=10000),
  warnings jsonb not null default '[]' check(jsonb_typeof(warnings)='array'),
  file_base64 text not null check(length(file_base64)<=2796204),
  unique(year,month,card_last4),
  check(id=year::text || '-' || lpad(month::text,2,'0') || '-' || card_last4)
);
create table public.card_ledger_settings (
  id text primary key default 'default' check(id='default'),
  config jsonb not null default '{"budgets":{},"recurring":{},"activeUsers":""}' check(jsonb_typeof(config)='object'),
  revision uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);
alter table public.card_ledger_months enable row level security;
alter table public.card_ledger_settings enable row level security;
revoke all on public.card_ledger_months,public.card_ledger_settings from anon,authenticated;
grant select,insert,update on public.card_ledger_months,public.card_ledger_settings to authenticated;
grant all on public.card_ledger_months,public.card_ledger_settings to service_role;
create policy ledger_members_read on public.card_ledger_months for select to authenticated using((select workspace_private.can_read_research()));
create policy ledger_editors_insert on public.card_ledger_months for insert to authenticated with check((select workspace_private.can_edit_research()));
create policy ledger_editors_update on public.card_ledger_months for update to authenticated using((select workspace_private.can_edit_research())) with check((select workspace_private.can_edit_research()));
create policy ledger_settings_members_read on public.card_ledger_settings for select to authenticated using((select workspace_private.can_read_research()));
create policy ledger_settings_editors_insert on public.card_ledger_settings for insert to authenticated with check((select workspace_private.can_edit_research()));
create policy ledger_settings_editors_update on public.card_ledger_settings for update to authenticated using((select workspace_private.can_edit_research())) with check((select workspace_private.can_edit_research()));
commit;
