-- The late-recorded game answer went out on 17 Nov at 17:33 UTC; date it then, so today's morning slot is free.
update public.channel_posts set posted_at = '2026-11-17T17:33:00Z' where kind = 'reveal' and listing_id = '42b8471f-c43c-4840-a9b4-bc7febbcde89';
select count(*) as fixed from public.channel_posts where kind = 'reveal' and posted_at < '2026-11-18';
