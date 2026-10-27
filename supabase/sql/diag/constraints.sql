select conrelid::regclass::text as t, conname, pg_get_constraintdef(oid) as def
from pg_constraint where contype = 'c' and conrelid::regclass::text in ('listings','sources','documents','public.listings','public.sources','public.documents');
