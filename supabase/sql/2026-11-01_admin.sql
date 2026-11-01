-- Admin access: one fixed account, checked on the server (not in the browser).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users where id = auth.uid() and lower(email) = 'gyurovik@gmail.com');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

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
      select p.id, p.note, p.created_at, p.listing_id, u.email, coalesce(l.title_en, l.comune) as listing_title, l.price_eur as listing_price
      from public.purchase_requests p join auth.users u on u.id = p.user_id
      left join public.listings l on l.id = p.listing_id) x), '[]'::jsonb),
    'users', coalesce((select jsonb_agg(x order by x.created_at desc) from (
      select u.email, u.created_at, u.last_sign_in_at,
        (select count(*) from public.deals d where d.user_id = u.id) as deals,
        (select count(*) from public.saved_listings s where s.user_id = u.id) as saved
      from auth.users u order by u.created_at desc limit 100) x), '[]'::jsonb)
  ) into out;
  return out;
end $$;
revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;
