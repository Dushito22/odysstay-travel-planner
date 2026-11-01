select conrelid::regclass::text t, conname, pg_get_constraintdef(oid) d from pg_constraint where conrelid in ('public.agent_conversations'::regclass,'public.agent_messages'::regclass) and contype in ('c','f')
union all select 'scores', (score/10)::int::text, count(*)::text from listings where not is_demo and status not in ('closed','withdrawn') group by (score/10)::int
union all select 'land_max', max(score)::text, '' from listings where property_type='land' and not is_demo;
