-- Chrome feeder: the owner's own Chrome reads Immobiliare.it search results (cloud servers are blocked)
-- and drops them raw into raw_imports. The worker turns them into listings. The extension authenticates
-- with a key made on /admin; only its SHA-256 is stored, and the key goes in an x-feeder-token header.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.feeder_tokens (
  hash text primary key,
  created_at timestamptz not null default now()
);
alter table public.feeder_tokens enable row level security;

create table if not exists public.raw_imports (
  id bigint generated always as identity primary key,
  source text not null,
  external_id text not null,
  region text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (source, external_id)
);
alter table public.raw_imports enable row level security;

create or replace function public.feeder_ok() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.feeder_tokens
    where hash = encode(extensions.digest(coalesce(current_setting('request.headers', true)::json->>'x-feeder-token', ''), 'sha256'), 'hex')
  );
$$;
grant execute on function public.feeder_ok() to anon, authenticated;

drop policy if exists feeder_insert on public.raw_imports;
create policy feeder_insert on public.raw_imports for insert to anon, authenticated with check (public.feeder_ok() and source = 'immobiliare');
drop policy if exists feeder_update on public.raw_imports;
create policy feeder_update on public.raw_imports for update to anon, authenticated using (public.feeder_ok()) with check (public.feeder_ok() and source = 'immobiliare');
drop policy if exists feeder_select on public.raw_imports;
create policy feeder_select on public.raw_imports for select to anon, authenticated using (public.feeder_ok());
grant insert, update, select on public.raw_imports to anon, authenticated;

-- A new key for the extension, shown once on /admin. Older keys keep working until deleted.
create or replace function public.admin_feeder_key() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare k text;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  k := 'odf_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.feeder_tokens(hash) values (encode(extensions.digest(k, 'sha256'), 'hex'));
  return k;
end $$;
revoke all on function public.admin_feeder_key() from public;
grant execute on function public.admin_feeder_key() to authenticated;

-- Last feeder activity, for the admin page.
create or replace function public.admin_feeder_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.is_admin() then jsonb_build_object(
    'last', (select max(created_at) from public.raw_imports),
    'today', (select count(*) from public.raw_imports where created_at > now() - interval '24 hours'),
    'pending', (select count(*) from public.raw_imports where processed_at is null),
    'keys', (select count(*) from public.feeder_tokens)) end;
$$;
revoke all on function public.admin_feeder_status() from public;
grant execute on function public.admin_feeder_status() to authenticated;
notify pgrst, 'reload schema';
