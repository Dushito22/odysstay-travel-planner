-- One post per house was enforced for every kind, so the answer to a price game (same house as the game) and a
-- story set at a house already shown could never be recorded: the answer went out again every morning.
-- Now only a find and a game can't repeat a house. Safe to re-run.
drop index if exists public.channel_posts_listing;
create unique index if not exists channel_posts_listing_kind on public.channel_posts (listing_id, kind)
  where listing_id is not null and kind in ('house', 'guess', 'reveal');
-- The answer that already went out (twice) for the last game.
insert into public.channel_posts (listing_id, kind, message_id, text)
select '42b8471f-c43c-4840-a9b4-bc7febbcde89', 'reveal', null, 'Ответ: €48 000 (recorded late)'
where not exists (select 1 from public.channel_posts where kind = 'reveal' and listing_id = '42b8471f-c43c-4840-a9b4-bc7febbcde89');
notify pgrst, 'reload schema';
select count(*) as reveals from public.channel_posts where kind = 'reveal';
