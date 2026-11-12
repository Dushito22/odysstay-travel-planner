-- Game sessions and high scores for the Argos bot games.
alter table public.tg_games add column if not exists photo_message_id bigint;
alter table public.tg_games add column if not exists cleared boolean not null default false;
create table if not exists public.tg_players (
  chat_id bigint primary key,
  session_start timestamptz not null default now(),
  best int not null default 0,
  summary_msg bigint
);
alter table public.tg_players enable row level security;
