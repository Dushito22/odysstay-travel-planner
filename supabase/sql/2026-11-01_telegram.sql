-- Argos on Telegram: one row per chat with the last few turns, language, voice preference and a daily count.
create table if not exists public.telegram_chats (
  chat_id bigint primary key,
  user_id uuid references auth.users(id) on delete set null,
  username text,
  lang text not null default 'en',
  voice boolean not null default false,
  history jsonb not null default '[]'::jsonb,
  day date,
  n integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.telegram_chats enable row level security;
