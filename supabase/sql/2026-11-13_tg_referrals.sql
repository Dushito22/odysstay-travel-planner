-- Friends brought in through a personal bot link. Each one adds a free active deal for the person who invited them (max 3).
create table if not exists public.tg_referrals (
  new_chat bigint primary key,
  ref_chat bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists tg_referrals_ref on public.tg_referrals (ref_chat);
alter table public.tg_referrals enable row level security;

create or replace function public.referral_bonus() returns int
language sql stable security definer set search_path = public as $$
  select least(3, count(*))::int
  from public.tg_referrals r
  join public.telegram_chats c on c.chat_id = r.ref_chat
  where c.user_id = auth.uid();
$$;
grant execute on function public.referral_bonus() to authenticated;
