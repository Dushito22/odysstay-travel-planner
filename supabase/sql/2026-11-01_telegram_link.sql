-- Linking a Telegram chat to an Odysstay account: a one-time code the bot receives through /start.
create table if not exists public.telegram_links (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;
create index if not exists telegram_chats_user_idx on public.telegram_chats(user_id);
-- Where an Argos conversation happened, so Telegram chats live with the account next to web ones.
alter table public.agent_conversations add column if not exists channel text not null default 'web';
