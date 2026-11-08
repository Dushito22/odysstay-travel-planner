-- Manual payments for the first customers: a reference on every order, the buyer's "I've paid"
-- (with a transaction id for crypto), and the owner marking it paid from /admin.
alter table public.purchase_requests add column if not exists payment_ref text;
alter table public.purchase_requests add column if not exists paid_note text;
alter table public.purchase_requests add column if not exists paid_claimed_at timestamptz;
alter table public.purchase_requests add column if not exists paid_at timestamptz;
create unique index if not exists purchase_requests_payment_ref on public.purchase_requests (payment_ref) where payment_ref is not null;

create or replace function public.admin_set_request_status(request_id uuid, new_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update public.purchase_requests set status = new_status,
    paid_at = case when new_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where id = request_id;
end $$;
revoke all on function public.admin_set_request_status(uuid, text) from public;
grant execute on function public.admin_set_request_status(uuid, text) to authenticated;

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
