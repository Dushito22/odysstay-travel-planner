-- One language per buyer: the site, Argos, calls, Telegram and the weekly picks all follow it.
alter table public.profiles add column if not exists language text check (language in ('en', 'ru'));
-- The weekly picks by email; on unless the buyer turns it off in their profile.
alter table public.profiles add column if not exists weekly_email boolean not null default true;
