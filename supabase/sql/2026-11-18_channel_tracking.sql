-- Which channel brings people: one row per first visit with a source (?utm_source, ?ref, /go/<channel>, or the
-- referring site). Anyone may add a row, nobody can read them except through the admin overview. Safe to re-run.
create table if not exists public.visits (
  id bigint generated always as identity primary key,
  source text not null check (length(source) between 1 and 60),
  path text check (length(path) <= 200),
  created_at timestamptz not null default now()
);
alter table public.visits enable row level security;
drop policy if exists "anyone logs a visit" on public.visits;
create policy "anyone logs a visit" on public.visits for insert to anon, authenticated with check (true);
grant insert on public.visits to anon, authenticated;
create index if not exists visits_source_time on public.visits (source, created_at);

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
      select p.id, p.kind, p.status, p.note, p.payment_ref, p.paid_note, p.paid_claimed_at, p.created_at, p.listing_id, u.email, coalesce(l.title_en, l.comune) as listing_title, l.price_eur as listing_price
      from public.purchase_requests p join auth.users u on u.id = p.user_id
      left join public.listings l on l.id = p.listing_id) x), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(x order by x.n desc, x.visits desc) from (
      select s.source,
        coalesce((select count(*) from public.visits v where v.source = s.source and v.created_at > now() - interval '30 days'), 0) as visits,
        coalesce((select count(*) from public.profiles p where coalesce(p.signup_source, 'direct') = s.source), 0) as n,
        coalesce((select count(*) from public.deals d join public.profiles p on p.id = d.user_id where coalesce(p.signup_source, 'direct') = s.source), 0) as deals
      from (select coalesce(signup_source, 'direct') as source from public.profiles
            union select source from public.visits where created_at > now() - interval '30 days') s) x), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select u.email, u.created_at, u.last_sign_in_at, pr.signup_source,
        (select count(*) from public.deals d where d.user_id = u.id) as deals,
        (select count(*) from public.saved_listings s where s.user_id = u.id) as saved
      from auth.users u left join public.profiles pr on pr.id = u.id order by u.created_at desc limit 100) x), '[]'::jsonb)
  ) into out;
  return out;
end $$;
select 'ok' as done;
