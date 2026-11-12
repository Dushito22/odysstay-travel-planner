-- Price-guessing game inside the Argos bot (Telegram widgets). One row per round sent.
create table if not exists public.tg_games (
  id bigint generated always as identity primary key,
  chat_id bigint not null,
  message_id bigint,
  listing_id uuid not null,
  guess numeric,
  points int,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
create index if not exists tg_games_chat on public.tg_games (chat_id, created_at desc);
create unique index if not exists tg_games_msg on public.tg_games (chat_id, message_id) where message_id is not null;
alter table public.tg_games enable row level security;
