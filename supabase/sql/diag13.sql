select pg_size_pretty(pg_total_relation_size('public.listings')) total, pg_size_pretty(pg_relation_size('public.listings')) heap,
 n_live_tup, n_dead_tup, last_autovacuum from pg_stat_user_tables where relname='listings';
