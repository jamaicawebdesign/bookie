-- Island Bookkeeping Supabase Schema
-- Run this script in your Supabase Dashboard -> SQL Editor

-- 1. User Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  role text not null default 'Business Owner',
  company text not null default '',
  photo text default '',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- 2. Transactions
create table if not exists public.transactions (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date text not null,
  region text not null,
  category text not null,
  revenue numeric not null default 0,
  cost numeric not null default 0,
  profit numeric not null default 0,
  customers integer not null default 0,
  status text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.transactions enable row level security;
create policy "Users manage own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Budget Categories
create table if not exists public.budget_categories (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  description text,
  color text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.budget_categories enable row level security;
create policy "Users manage own budget_categories" on public.budget_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. Budgets
create table if not exists public.budgets (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category text not null,
  limit_amount numeric not null default 0,
  period text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.budgets enable row level security;
create policy "Users manage own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Invoices
create table if not exists public.invoices (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  client_name text not null,
  amount numeric not null default 0,
  tax_rate numeric,
  tax_amount numeric,
  date text not null,
  due_date text not null,
  status text not null,
  description text,
  line_items jsonb not null default '[]'::jsonb,
  payment_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.invoices enable row level security;
create policy "Users manage own invoices" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Expenses
create table if not exists public.expenses (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category text not null,
  amount numeric not null default 0,
  date text not null,
  due_date text,
  description text,
  status text not null,
  is_recurring boolean default false,
  frequency text,
  duration_months integer,
  end_date text,
  recurring_id text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.expenses enable row level security;
create policy "Users manage own expenses" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. Clients
create table if not exists public.clients (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  email text,
  phone text,
  address text,
  company text,
  notes text,
  created_at text not null,
  primary key (user_id, id)
);

alter table public.clients enable row level security;
create policy "Users manage own clients" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8. Chart of Accounts
create table if not exists public.accounts (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  code text not null,
  name text not null,
  type text not null,
  description text,
  notes text,
  balance numeric not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.accounts enable row level security;
create policy "Users manage own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 9. Journal Entries
create table if not exists public.journal_entries (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date text not null,
  description text not null,
  status text not null,
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.journal_entries enable row level security;
create policy "Users manage own journal_entries" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 10. Application Settings
create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  tax_rate numeric not null default 15,
  currency text not null default 'USD',
  invoice_prefix text not null default 'INV-',
  security_settings jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
create policy "Users manage own app_settings" on public.app_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 11. Notifications
create table if not exists public.notifications (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  message text not null,
  type text not null,
  date text not null,
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.notifications enable row level security;
create policy "Users manage own notifications" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 12. eCommerce Sources
create table if not exists public.ecommerce_sources (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  type text not null,
  status text not null,
  last_sync text not null,
  orders text not null,
  url text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.ecommerce_sources enable row level security;
create policy "Users manage own ecommerce_sources" on public.ecommerce_sources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 13. Sync Logs
create table if not exists public.sync_logs (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source_id text not null,
  timestamp text not null,
  status text not null,
  message text not null,
  details text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.sync_logs enable row level security;
create policy "Users manage own sync_logs" on public.sync_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 14. Multi-User Workspaces & Members
create table if not exists public.workspaces (
  id text primary key,
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'Essential Monthly Bookkeeping',
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id text not null,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  role text not null default 'Viewer' check (role in ('Owner', 'Accountant', 'Bookkeeper', 'Viewer')),
  status text not null default 'Active' check (status in ('Active', 'Invited', 'Suspended')),
  joined_at timestamptz not null default now(),
  last_active timestamptz,
  primary key (workspace_id, id)
);

create table if not exists public.workspace_invites (
  id text primary key,
  workspace_id text not null references public.workspaces(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('Owner', 'Accountant', 'Bookkeeper', 'Viewer')),
  invite_code text not null unique,
  status text not null default 'Pending' check (status in ('Pending', 'Accepted', 'Revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

create policy "Workspace members can view workspace" on public.workspaces
  for select using (
    auth.uid() = owner_id or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspaces.id and wm.user_id = auth.uid() and wm.status = 'Active'
    )
  );
create policy "Owners manage own workspaces" on public.workspaces
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Active members view workspace roster" on public.workspace_members
  for select using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
    ) or user_id = auth.uid()
  );
create policy "Owners manage workspace roster" on public.workspace_members
  for all using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "Owners manage workspace invites" on public.workspace_invites
  for all using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_invites.workspace_id and w.owner_id = auth.uid()
    )
  );

