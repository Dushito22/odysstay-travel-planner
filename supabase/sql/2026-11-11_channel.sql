-- Small key/value settings the functions read, e.g. the Telegram channel the bot was made admin of.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- Channel posts can now be a house or a light post (an Italian saying plus a nudge to the site).
alter table public.channel_posts drop constraint if exists channel_posts_pkey;
alter table public.channel_posts add column if not exists id bigint generated always as identity;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.channel_posts'::regclass and contype = 'p') then
    alter table public.channel_posts add primary key (id);
  end if;
end $$;
alter table public.channel_posts alter column listing_id drop not null;
alter table public.channel_posts add column if not exists kind text not null default 'house';
create unique index if not exists channel_posts_listing on public.channel_posts(listing_id) where listing_id is not null;
notify pgrst, 'reload schema';
