-- Shared cache of interface and listing text translated for visitors who read Russian.
-- Each distinct English string is translated once and served to everyone after that.
create table if not exists public.ui_translations (
  id text primary key,            -- sha256 of lang + newline + source text
  lang text not null,
  src text not null,
  dst text not null,
  created_at timestamptz not null default now()
);
create index if not exists ui_translations_created_idx on public.ui_translations (created_at);
alter table public.ui_translations enable row level security;
-- No policies on purpose: only the edge function, with the service key, reads and writes this table.
