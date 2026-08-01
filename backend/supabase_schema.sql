-- ============================================================
-- Standalone app schema — MVP tables
-- Run this in the Supabase SQL editor (same project as line-life-app,
-- but a fully separate set of tables, per the project decision).
-- ============================================================

-- Users (email/password auth; independent of any LINE user id)
create table if not exists yy_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

-- Accounts (帳戶管理)
create table if not exists yy_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  name text not null,
  balance numeric not null default 0,
  created_at timestamptz not null default now()
);

-- Transactions (記帳 + 收入功能, unified via `type`)
create table if not exists yy_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  account_id uuid references yy_accounts(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null check (amount > 0),
  category text,
  note text,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Categories (分類管理) — shared list across transactions/events/recurring items.
-- Those tables keep `category` as free text (no FK) to avoid a data migration;
-- this table is the user-managed list that the frontend dropdown reads from.
create table if not exists yy_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense', 'general')) default 'general',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Calendar events (行事曆) — Google sync fields are here but unused until phase 2
create table if not exists yy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  category text,
  color text, -- hex, user-defined per category
  note text,
  source text not null default 'app' check (source in ('app', 'google')),
  google_event_id text, -- populated once phase-2 two-way sync is built
  created_at timestamptz not null default now()
);

-- Recurring items (循環記帳/行程提醒) — covers both recurring expenses and events
create table if not exists yy_recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  kind text not null check (kind in ('expense', 'income', 'event')),
  title text not null,
  amount numeric,
  category text,
  frequency text not null check (frequency in ('monthly', 'weekly')),
  day_of_month int,
  day_of_week int,
  next_trigger_date date not null,
  reminder_method text not null default 'push' check (reminder_method in ('push', 'in_app', 'both')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Password reset tokens (忘記密碼/重設密碼流程)
-- We store a hash of the token, never the raw token, so a DB leak alone
-- can't be used to reset accounts.
create table if not exists yy_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists yy_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  fcm_token text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_user on yy_password_reset_tokens(user_id);
create index if not exists idx_password_reset_token_hash on yy_password_reset_tokens(token_hash);

-- Indexes for the query patterns the controllers use
create index if not exists idx_transactions_user_occurred on yy_transactions(user_id, occurred_at desc);
create index if not exists idx_events_user_start on yy_events(user_id, start_at);
create index if not exists idx_recurring_user_next on yy_recurring_items(user_id, next_trigger_date);
create index if not exists idx_categories_user on yy_categories(user_id);

-- ============================================================
-- Row Level Security
-- The backend uses the Supabase service-role key (bypasses RLS) for now.
-- Enabling RLS here regardless, as defense-in-depth if a client key is
-- ever used directly from the frontend later.
-- ============================================================
alter table yy_users enable row level security;
alter table yy_accounts enable row level security;
alter table yy_transactions enable row level security;
alter table yy_categories enable row level security;
alter table yy_events enable row level security;
alter table yy_recurring_items enable row level security;
alter table yy_password_reset_tokens enable row level security;
alter table yy_push_subscriptions enable row level security;
