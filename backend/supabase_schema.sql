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
  type text not null check (type in ('income', 'expense', 'general', 'event')) default 'general',
  color text,
  created_at timestamptz not null default now(),
  unique (user_id, name, type)
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
  account_id uuid references yy_accounts(id) on delete set null,
  end_date date,
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

-- 首頁圖片（使用者上傳，280px 顯示）
alter table yy_users add column if not exists home_image text;

-- 帳戶卡片自訂顏色（#RRGGBB，null = 依主題自動配色）
alter table yy_accounts add column if not exists color text;

-- 介面主題：default（米紙）/ grey（石墨灰），Web 與 APP 共用
alter table yy_users add column if not exists theme text not null default 'default';

-- ============================================================
-- 社群(晴空與雨天 / 養豬小能手 / 小編許願池)
-- ============================================================
create table if not exists yy_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  board text not null check (board in ('mood', 'finance', 'wish')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  anonymous boolean not null default false,
  mood text check (mood in ('sunny', 'cloudy', 'rainy', 'storm', 'rainbow')),
  title text,
  content text not null,
  wish_status text check (wish_status in ('considering', 'planned', 'done')),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists yy_posts_board_idx on yy_posts (board, visibility, hidden, created_at desc);
create index if not exists yy_posts_user_idx on yy_posts (user_id, created_at desc);

create table if not exists yy_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references yy_posts(id) on delete cascade,
  user_id uuid not null references yy_users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists yy_post_comments_post_idx on yy_post_comments (post_id, created_at);

create table if not exists yy_post_reactions (
  post_id uuid not null references yy_posts(id) on delete cascade,
  user_id uuid not null references yy_users(id) on delete cascade,
  type text not null check (type in ('hug', 'cheer', 'understand', 'laugh', 'approve', 'like')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists yy_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references yy_posts(id) on delete cascade,
  user_id uuid not null references yy_users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table yy_posts enable row level security;
alter table yy_post_comments enable row level security;
alter table yy_post_reactions enable row level security;
alter table yy_post_reports enable row level security;

-- 行程提醒：提醒時間 = start_at − remind_before_minutes 分鐘（null = 不提醒）
-- 全天行程用負值表示「當天早上 8 點」（-480）、960 表示「前一天早上 8 點」
alter table yy_events add column if not exists remind_before_minutes int;
alter table yy_events add column if not exists reminder_sent_at timestamptz;
create index if not exists idx_events_reminder on yy_events(start_at) where remind_before_minutes is not null and reminder_sent_at is null;

-- 預算：category = '' 代表「每月總預算」，其餘為各分類預算（金額以 TWD 計）
create table if not exists yy_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  category text not null default '',
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

-- 每日心情（與晴空與雨天同一組天氣）
create table if not exists yy_moods (
  user_id uuid not null references yy_users(id) on delete cascade,
  date date not null,
  mood text not null check (mood in ('sunny', 'cloudy', 'rainy', 'storm', 'rainbow')),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table yy_budgets enable row level security;
alter table yy_moods enable row level security;

-- 通知偏好（存在伺服器，換手機或重新安裝也會保留）
alter table yy_users add column if not exists notify_ledger boolean not null default true;
alter table yy_users add column if not exists notify_calendar boolean not null default true;

-- 循環頻率增加「每年」；day_of_month = -1 代表「每月最後一天」
alter table yy_recurring_items drop constraint if exists yy_recurring_items_frequency_check;
alter table yy_recurring_items add constraint yy_recurring_items_frequency_check check (frequency in ('monthly', 'weekly', 'yearly'));

-- 2026-10-14 公告鈴鐺(未讀數)與重要公告橫幅
alter table yy_users add column if not exists announcements_seen_at timestamptz;
alter table yy_users add column if not exists announcement_banner_dismissed_at timestamptz;
alter table yy_announcements add column if not exists is_important boolean not null default false;

-- 2026-10-15 墨箋絮語(隨手記事)
create table if not exists yy_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  is_done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists yy_notes_user_idx on yy_notes (user_id, is_done, created_at desc);

-- 2026-10-15 本日心情改為九種(rainbow 保留給舊資料)
-- 先移除 yy_moods 上舊的心情檢查(不論名稱)
do $$
declare r record;
begin
  for r in select conname from pg_constraint where conrelid = 'yy_moods'::regclass and contype = 'c' loop
    execute format('alter table yy_moods drop constraint %I', r.conname);
  end loop;
end $$;
alter table yy_moods add constraint yy_moods_mood_check
  check (mood in ('question', 'angry', 'rainy', 'storm', 'love', 'sunny', 'cloudy', 'exclaim', 'flower', 'rainbow'));

-- 2026-10-16 個人資訊「國別」(社群安心專線依國別顯示;未設定時顯示台灣)
alter table yy_users add column if not exists country text
  check (country in ('TW', 'HK', 'JP', 'SG', 'MY', 'CN', 'US', 'GB'));

-- 2026-10-16 資料庫權限檢查:所有 yy_ 資料表都要開啟 RLS
-- 後端用 service role 連線(不受 RLS 影響);開啟 RLS 且不設政策 = 公開金鑰完全讀寫不到
do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'yy\_%' and not c.relrowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end $$;

-- 2026-10-16 管理後台:權限截止日、停用帳號
alter table yy_users add column if not exists plan_expires_at date;
alter table yy_users add column if not exists is_disabled boolean not null default false;
alter table yy_users add column if not exists disabled_reason text;
alter table yy_users add column if not exists disabled_at timestamptz;
