alter table public.tg_games add column if not exists kind text not null default 'price';
alter table public.tg_games add column if not exists result text;
