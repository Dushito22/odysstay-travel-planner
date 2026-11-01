select (select count(*) from pg_views where viewname='listing_feed') as view_exists,
 (select string_agg(column_name, ',') from information_schema.columns where table_name='listings' and column_name in ('has_real_photo','is_scrap')) as cols,
 current_setting('statement_timeout') st,
 (select count(*) from pg_stat_activity where state='active') active;
