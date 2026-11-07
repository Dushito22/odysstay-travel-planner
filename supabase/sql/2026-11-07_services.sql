-- Paid services: a Deal Check on one house, or the purchase itself. One table, one row per request.
alter table public.purchase_requests add column if not exists kind text not null default 'remote_purchase'
  check (kind in ('deal_check', 'remote_purchase', 'search_purchase'));
alter table public.purchase_requests add column if not exists status text not null default 'new'
  check (status in ('new', 'paid', 'in_progress', 'done', 'cancelled'));
drop index if exists public.purchase_requests_user_listing;
create unique index if not exists purchase_requests_user_listing_kind on public.purchase_requests
  (user_id, kind, coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Where each buyer came from (utm_source, ref link or referring site), saved at sign-up.
alter table public.profiles add column if not exists signup_source text;

-- Our public Telegram channel: one find a day, never the same house twice.
create table if not exists public.channel_posts (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  message_id bigint,
  text text,
  posted_at timestamptz not null default now()
);
alter table public.channel_posts enable row level security;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'listings', (select count(*) from public.listings),
      'deals', (select count(*) from public.deals),
      'saved', (select count(*) from public.saved_listings),
      'waitlist', (select count(*) from public.plan_waitlist),
      'purchase', (select count(*) from public.purchase_requests),
      'telegram', (select count(distinct user_id) from public.telegram_chats where user_id is not null)
    ),
    'waitlist', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select w.plan, w.billing, w.created_at, u.email from public.plan_waitlist w join auth.users u on u.id = w.user_id) x), '[]'::jsonb),
    'purchases', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select p.id, p.kind, p.status, p.note, p.created_at, p.listing_id, u.email, coalesce(l.title_en, l.comune) as listing_title, l.price_eur as listing_price
      from public.purchase_requests p join auth.users u on u.id = p.user_id
      left join public.listings l on l.id = p.listing_id) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(x order by x.n desc) from (
      select coalesce(signup_source, 'direct') as source, count(*) as n from public.profiles group by 1) x), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select u.email, u.created_at, u.last_sign_in_at, pr.signup_source,
        (select count(*) from public.deals d where d.user_id = u.id) as deals,
        (select count(*) from public.saved_listings s where s.user_id = u.id) as saved
      from auth.users u left join public.profiles pr on pr.id = u.id order by u.created_at desc limit 100) x), '[]'::jsonb)
  ) into out;
  return out;
end $$;
