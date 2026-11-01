-- 1) A "refresh" renovation tier for houses described as ready to live in: drop any old check on scenario.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid = 'public.cost_estimates'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%scenario%'
  loop
    execute format('alter table public.cost_estimates drop constraint %I', c.conname);
  end loop;
end $$;

-- 2) Argos's voice: characters spoken per visitor or user, per day, so ElevenLabs credit stays bounded.
create table if not exists public.voice_usage (
  day date not null,
  who text not null,
  chars integer not null default 0,
  primary key (day, who)
);
alter table public.voice_usage enable row level security;

-- 3) Area briefs: a grounded paragraph about the town and region, written once per comune and language.
create table if not exists public.area_briefs (
  comune text not null,
  region text not null default '',
  lang text not null,
  brief text not null,
  facts jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (comune, region, lang)
);
alter table public.area_briefs enable row level security;
drop policy if exists "area briefs are public" on public.area_briefs;
create policy "area briefs are public" on public.area_briefs for select using (true);
grant select on public.area_briefs to anon, authenticated;
