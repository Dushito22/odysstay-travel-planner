select pid, usename, state, wait_event_type, wait_event, now()-query_start as age, left(query, 160) q
from pg_stat_activity where state <> 'idle' and pid <> pg_backend_pid() order by query_start;
