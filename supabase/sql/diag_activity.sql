-- Read-only: what the database is busy with right now, and what feeds the realtime stream. Safe to run any time.
select json_build_object(
  'publication', (select json_agg(tablename) from pg_publication_tables where pubname = 'supabase_realtime'),
  'slots', (select json_agg(json_build_object('slot', slot_name, 'active', active)) from pg_replication_slots),
  'writes', (select json_agg(w) from (select relname, n_tup_ins + n_tup_upd + n_tup_del as changes from pg_stat_user_tables order by 2 desc limit 6) w),
  'active', (select count(*) from pg_stat_activity where state = 'active'),
  'conns', (select count(*) from pg_stat_activity)
) as r;
