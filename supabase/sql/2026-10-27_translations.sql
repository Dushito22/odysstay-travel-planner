-- Translations of the official description with short advice, made once per listing and language,
-- then shared by everyone. Written only by the translate-listing edge function.
create table if not exists public.listing_translations (
  listing_id uuid not null references public.listings(id) on delete cascade,
  lang text not null check (lang in ('en', 'ru')),
  translation text not null,
  advice jsonb not null default '[]',
  created_at timestamptz not null default now(),
  primary key (listing_id, lang)
);
alter table public.listing_translations enable row level security;
drop policy if exists "Translations are public" on public.listing_translations;
create policy "Translations are public" on public.listing_translations for select using (true);
grant select on public.listing_translations to anon, authenticated;
