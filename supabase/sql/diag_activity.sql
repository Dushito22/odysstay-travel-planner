-- Read-only: what the database is busy with right now, and scheduled jobs. Safe to run any time.
select json_build_object(
  'active', (select json_agg(x) from (select state, wait_event_type as w, round(extract(epoch from now()-query_start)) as secs, left(regexp_replace(query, '\s+', ' ', 'g'), 90) as q
     from pg_stat_activity where state <> 'idle' and pid <> pg_backend_pid() order by query_start limit 8) x),
  'cron', (select json_agg(y) from (select jobname, schedule, left(command, 60) as cmd from cron.job where active limit 10) y),
  'cpus', (select setting from pg_settings where name = 'max_worker_processes'),
  'buffers', (select setting from pg_settings where name = 'shared_buffers'),
  'size_listings', pg_size_pretty(pg_total_relation_size('public.listings')),
  'size_images', pg_size_pretty(pg_total_relation_size('public.listing_images'))
) as r;
