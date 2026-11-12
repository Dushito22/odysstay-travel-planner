-- Graded Italian photos for the Telegram channel, and a queue of posts written ahead of time.
insert into storage.buckets (id, name, public) values ('channel-art', 'channel-art', true) on conflict (id) do update set public = true;

create table if not exists public.channel_art (
  id bigserial primary key,
  theme text not null,
  path text not null unique,
  url text not null,
  title text,
  author text,
  license text,
  source text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.channel_art enable row level security;

create table if not exists public.channel_queue (
  id bigserial primary key,
  slot text not null default 'any',          -- am, eve or any
  art_theme text,                            -- picks an unused photo of this theme
  text text not null,                        -- the post, Telegram HTML
  button_text text,
  button_url text,
  posted_at timestamptz,
  message_id bigint,
  created_at timestamptz not null default now()
);
alter table public.channel_queue enable row level security;
-- no policies: only the service role (edge functions and the worker) touches these tables
