-- Argos's weekly picks: five houses per buyer, a short spoken note, sent to Telegram and shown in the app.
create table if not exists public.weekly_drops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week date not null,
  lang text not null default 'en',
  listing_ids uuid[] not null default '{}',
  picks jsonb not null default '[]'::jsonb,
  script text,
  audio_url text,
  sent_telegram boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, week)
);
alter table public.weekly_drops enable row level security;
drop policy if exists "own drops" on public.weekly_drops;
create policy "own drops" on public.weekly_drops for select to authenticated using (user_id = auth.uid());
create index if not exists weekly_drops_user_idx on public.weekly_drops(user_id, week desc);

insert into storage.buckets (id, name, public) values ('drops', 'drops', true)
on conflict (id) do nothing;
