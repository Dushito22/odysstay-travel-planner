-- Houses Argos already sent a buyer on Telegram outside the weekly picks, so a house is never pushed twice.
create table if not exists public.bot_pushes (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.bot_pushes enable row level security;
