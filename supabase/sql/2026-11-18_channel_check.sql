-- Read-only: the channel's last posts.
select json_agg(x) as r from (select kind, listing_id, message_id, posted_at, left(text, 40) t from channel_posts order by posted_at desc limit 14) x;
