-- Rate limit for Argos's replies to signed-out visitors (hashed, no IPs stored). Service role only.
create table if not exists public.argos_usage (
  day date not null,
  visitor text not null,
  n int not null default 0,
  primary key (day, visitor)
);
alter table public.argos_usage enable row level security;
