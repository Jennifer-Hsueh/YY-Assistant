-- ============================================================
-- YY手帳 資料庫結構(完整版)
-- 2026-10-19 依正式資料庫實際結構整理,可在全新的 Supabase 專案一次執行。
-- 之前一路累加的修改紀錄請看 git 歷史。之後新增欄位時,請同步更新這個檔案。
-- 後端使用 service_role 金鑰存取,所有資料表開啟 RLS(不開放前端直接讀寫)。
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- 使用者 ----------
create table if not exists yy_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_active_at timestamptz,
  username text,
  role text not null default 'user' check (role in ('user', 'admin', 'tester')),
  plan text not null default 'basic' check (plan in ('basic', 'adv_a', 'adv_b', 'adv_c', 'full')),
  last_payment_date date,
  home_image text,
  theme text not null default 'default',
  notify_ledger boolean not null default true,
  notify_calendar boolean not null default true,
  announcements_seen_at timestamptz,
  announcement_banner_dismissed_at timestamptz,
  country text check (country in ('TW', 'HK', 'JP', 'SG', 'MY', 'CN', 'US', 'GB')),
  plan_expires_at date,
  is_disabled boolean not null default false,
  disabled_reason text,
  disabled_at timestamptz,
  addon_community boolean not null default false,
  basic_choice text check (basic_choice in ('ledger', 'calendar')),
  basic_choice_changed_at timestamptz,
  trial_ends_at date, -- 空白 = 註冊日 + 3 個月
  terms_version text, -- 同意的使用條款版本(日期)
  terms_accepted_at timestamptz,
  community_suspended_until timestamptz -- 社群暫停到期時間(違規處理)
);

create table if not exists yy_password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table yy_users add column if not exists terms_version text;
alter table yy_users add column if not exists terms_accepted_at timestamptz;
alter table yy_users add column if not exists community_suspended_until timestamptz;
-- 創始會員(測試期間有實際使用,正式上線後送一年全功能)
alter table yy_users add column if not exists founding_member boolean not null default false;
alter table yy_users add column if not exists founding_marked_at timestamptz;
alter table yy_users add column if not exists founding_granted_at date;
-- 有使用的日子(台灣日期,每人每天一筆)
create table if not exists yy_active_days (
  user_id uuid not null references yy_users(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table yy_active_days enable row level security;

create index if not exists idx_password_reset_token_hash on yy_password_reset_tokens (token_hash);
create index if not exists idx_password_reset_user on yy_password_reset_tokens (user_id);

create table if not exists yy_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  fcm_token text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- 記帳 ----------
create table if not exists yy_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  name text not null,
  balance numeric not null default 0,
  created_at timestamptz not null default now(),
  currency text not null default 'TWD',
  color text
);

create table if not exists yy_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  name text not null,
  type text not null default 'general' check (type in ('income', 'expense', 'general', 'event')),
  created_at timestamptz not null default now(),
  color text,
  unique (user_id, name, type)
);
create index if not exists idx_categories_user on yy_categories (user_id);

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
create index if not exists idx_transactions_user_occurred on yy_transactions (user_id, occurred_at desc);

create table if not exists yy_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  category text not null default '', -- '' = 每月總預算
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

-- ---------- 行事曆 ----------
create table if not exists yy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  category text,
  color text,
  note text,
  source text not null default 'app' check (source in ('app', 'google')),
  google_event_id text,
  created_at timestamptz not null default now(),
  remind_before_minutes int, -- 全天行程:-480 = 當天 8 點、960 = 前一天 8 點
  reminder_sent_at timestamptz
);
create index if not exists idx_events_user_start on yy_events (user_id, start_at);
create index if not exists idx_events_reminder on yy_events (start_at) where remind_before_minutes is not null and reminder_sent_at is null;

-- ---------- 循環(記帳與行程) ----------
create table if not exists yy_recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  kind text not null check (kind in ('expense', 'income', 'event')),
  title text not null,
  amount numeric,
  category text,
  frequency text not null check (frequency in ('monthly', 'weekly', 'yearly')),
  day_of_month int,
  day_of_week int,
  next_trigger_date date not null,
  reminder_method text not null default 'push' check (reminder_method in ('push', 'in_app', 'both')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  account_id uuid references yy_accounts(id) on delete set null,
  end_date date
);
create index if not exists idx_recurring_user_next on yy_recurring_items (user_id, next_trigger_date);

-- ---------- 心情、記事 ----------
create table if not exists yy_moods (
  user_id uuid not null references yy_users(id) on delete cascade,
  date date not null,
  mood text not null check (mood in ('question', 'angry', 'rainy', 'storm', 'love', 'sunny', 'cloudy', 'exclaim', 'flower', 'rainbow')),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

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

-- ---------- 公告 ----------
create table if not exists yy_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  is_important boolean not null default false,
  target_user_id uuid references yy_users(id) on delete cascade -- 空白 = 公開
);
create index if not exists idx_announcements_published on yy_announcements (published_at desc);

-- ---------- 社群 ----------
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
  updated_at timestamptz not null default now(),
  images jsonb not null default '[]'::jsonb, -- 照片 key(私人 bucket「yy-community」)
  edited_at timestamptz
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

-- ---------- 方案與付費 ----------
create table if not exists yy_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references yy_users(id) on delete set null, -- 帳號刪除後保留紀錄
  paid_at date not null,
  plan text not null,
  addon_community boolean not null default false,
  months int not null,
  amount numeric not null default 0,
  period_start date,
  period_end date,
  note text,
  created_by uuid references yy_users(id) on delete set null,
  created_at timestamptz not null default now(),
  user_email text
);
create index if not exists yy_payments_user_idx on yy_payments (user_id, paid_at desc);

create table if not exists yy_plan_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  kind text not null,
  ref_date date not null,
  threshold int not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref_date, threshold)
);

-- ---------- 故障通報 ----------
create table if not exists yy_bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references yy_users(id) on delete set null,
  email text,
  title text not null,
  description text not null,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists yy_bug_reports_status_idx on yy_bug_reports (status, created_at desc);

-- ---------- 所有 yy_ 資料表開啟 RLS ----------

-- 違規處理紀錄(使用條款第 12 條)
create table if not exists yy_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade,
  action text not null check (action in ('hide_post', 'restore_post', 'warn', 'suspend', 'lift', 'disable', 'enable')),
  post_id uuid,
  reason text,
  days integer,
  until timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_moderation_user on yy_moderation_actions (user_id, created_at desc);

-- 系統設定(例如測試版名額 beta = { limit, open })
create table if not exists yy_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into yy_settings (key, value) values ('beta', '{"limit": 50, "open": true}') on conflict (key) do nothing;

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'yy\_%' loop
    execute format('alter table %I enable row level security', t.tablename);
  end loop;
end $$;

-- ---------- 好友 ----------
alter table yy_users add column if not exists friend_code text;
create unique index if not exists uq_users_friend_code on yy_users (friend_code) where friend_code is not null;

create table if not exists yy_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references yy_users(id) on delete cascade,
  addressee_id uuid not null references yy_users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists uq_friend_pair on yy_friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists idx_friend_requester on yy_friendships (requester_id);
create index if not exists idx_friend_addressee on yy_friendships (addressee_id);
alter table yy_friendships enable row level security;

create table if not exists yy_user_blocks (
  blocker_id uuid not null references yy_users(id) on delete cascade,
  blocked_id uuid not null references yy_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table yy_user_blocks enable row level security;

create table if not exists yy_user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references yy_users(id) on delete cascade,
  reported_id uuid not null references yy_users(id) on delete cascade,
  reason text,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists idx_user_reports_status on yy_user_reports (status, created_at desc);
alter table yy_user_reports enable row level security;

-- ---------- 多帳本 ----------
create table if not exists yy_ledgers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade, -- 建立者(擁有者)
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_ledgers_user on yy_ledgers (user_id);
create unique index if not exists uq_ledgers_default on yy_ledgers (user_id) where is_default;
alter table yy_ledgers enable row level security;

alter table yy_accounts add column if not exists ledger_id uuid references yy_ledgers(id) on delete cascade;
alter table yy_transactions add column if not exists ledger_id uuid references yy_ledgers(id) on delete cascade;
alter table yy_recurring_items add column if not exists ledger_id uuid references yy_ledgers(id) on delete cascade;
alter table yy_budgets add column if not exists ledger_id uuid references yy_ledgers(id) on delete cascade;

-- 每位使用者建立預設帳本「日常」,現有資料歸到日常
insert into yy_ledgers (user_id, name, is_default)
select u.id, '日常', true from yy_users u
where not exists (select 1 from yy_ledgers l where l.user_id = u.id and l.is_default);

update yy_accounts t set ledger_id = l.id from yy_ledgers l where l.user_id = t.user_id and l.is_default and t.ledger_id is null;
update yy_transactions t set ledger_id = l.id from yy_ledgers l where l.user_id = t.user_id and l.is_default and t.ledger_id is null;
update yy_recurring_items t set ledger_id = l.id from yy_ledgers l where l.user_id = t.user_id and l.is_default and t.ledger_id is null and t.kind in ('expense', 'income');
update yy_budgets t set ledger_id = l.id from yy_ledgers l where l.user_id = t.user_id and l.is_default and t.ledger_id is null;

create index if not exists idx_accounts_ledger on yy_accounts (ledger_id);
create index if not exists idx_transactions_ledger on yy_transactions (ledger_id, occurred_at desc);
create index if not exists idx_recurring_ledger on yy_recurring_items (ledger_id);

-- 預算改成「每本帳本、每個分類一筆」
alter table yy_budgets drop constraint if exists yy_budgets_user_id_category_key;
create unique index if not exists uq_budgets_ledger_category on yy_budgets (ledger_id, category);

-- ---------- 共同帳本 ----------
create table if not exists yy_ledger_members (
  ledger_id uuid not null references yy_ledgers(id) on delete cascade,
  user_id uuid not null references yy_users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active', 'left')),
  invited_by uuid references yy_users(id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  left_at timestamptz,
  primary key (ledger_id, user_id)
);
create index if not exists idx_ledger_members_user on yy_ledger_members (user_id);
alter table yy_ledger_members enable row level security;

-- ---------- 共同帳本:失效 ----------
alter table yy_ledgers add column if not exists archived_at timestamptz;
alter table yy_ledgers add column if not exists owner_hidden boolean not null default false;

-- ---------- 共同行程 ----------
create table if not exists yy_event_members (
  event_id uuid not null references yy_events(id) on delete cascade,
  user_id uuid not null references yy_users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid references yy_users(id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (event_id, user_id)
);
create index if not exists idx_event_members_user on yy_event_members (user_id);
alter table yy_event_members enable row level security;

-- ---------- 紀念日 ----------
create table if not exists yy_anniversaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references yy_users(id) on delete cascade, -- 建立者
  title text not null,
  date date not null, -- 第一次的日期(每年同一天)
  remind text not null default 'day' check (remind in ('none', 'day', 'day_1', 'day_3', 'day_7')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_anniversaries_user on yy_anniversaries (user_id);
alter table yy_anniversaries enable row level security;

create table if not exists yy_anniversary_members (
  anniversary_id uuid not null references yy_anniversaries(id) on delete cascade,
  user_id uuid not null references yy_users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid references yy_users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (anniversary_id, user_id)
);
create index if not exists idx_anniversary_members_user on yy_anniversary_members (user_id);
alter table yy_anniversary_members enable row level security;

-- ---------- 生日 ----------
alter table yy_users add column if not exists birthday_md text check (birthday_md is null or birthday_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
alter table yy_users add column if not exists birthday_visible boolean not null default true;
alter table yy_users add column if not exists notify_birthdays boolean not null default true;

-- 每日提醒(紀念日、生日)防重複寄送
create table if not exists yy_reminder_log (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table yy_reminder_log enable row level security;

-- ---------- 紀念日改版 ----------
alter table yy_anniversaries add column if not exists icon text;
alter table yy_anniversaries add column if not exists recurring boolean not null default true;
alter table yy_anniversaries add column if not exists show_years boolean not null default true;
alter table yy_anniversaries add column if not exists show_age boolean not null default false;
alter table yy_anniversaries add column if not exists year_known boolean not null default true;
-- 提醒只剩:不提醒、當天、前 3 天(＋當天)
update yy_anniversaries set remind = 'day' where remind = 'day_1';
update yy_anniversaries set remind = 'day_3' where remind = 'day_7';
alter table yy_anniversaries drop constraint if exists yy_anniversaries_remind_check;
alter table yy_anniversaries add constraint yy_anniversaries_remind_check check (remind in ('none', 'day', 'day_3'));

-- ---------- 成員刪除帳號後,共同帳本裡的紀錄保留 ----------
alter table yy_transactions alter column user_id drop not null;
alter table yy_transactions drop constraint if exists yy_transactions_user_id_fkey;
alter table yy_transactions add constraint yy_transactions_user_id_fkey foreign key (user_id) references yy_users(id) on delete set null;
alter table yy_accounts alter column user_id drop not null;
alter table yy_accounts drop constraint if exists yy_accounts_user_id_fkey;
alter table yy_accounts add constraint yy_accounts_user_id_fkey foreign key (user_id) references yy_users(id) on delete set null;
alter table yy_budgets alter column user_id drop not null;
alter table yy_budgets drop constraint if exists yy_budgets_user_id_fkey;
alter table yy_budgets add constraint yy_budgets_user_id_fkey foreign key (user_id) references yy_users(id) on delete set null;

-- ---------- 社群:僅好友可見、好友篩選 ----------
alter table yy_posts drop constraint if exists yy_posts_visibility_check;
alter table yy_posts add constraint yy_posts_visibility_check check (visibility in ('private', 'friends', 'public'));

-- 好友篩選中選擇不看的好友
create table if not exists yy_feed_hidden (
  user_id uuid not null references yy_users(id) on delete cascade,
  hidden_id uuid not null references yy_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, hidden_id)
);
alter table yy_feed_hidden enable row level security;
