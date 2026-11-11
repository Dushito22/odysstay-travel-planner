-- Languages people ask Argos to learn next, from onboarding.
create table if not exists public.language_requests (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  language text not null check (char_length(language) between 2 and 40),
  created_at timestamptz not null default now()
);
alter table public.language_requests enable row level security;
drop policy if exists language_requests_insert on public.language_requests;
create policy language_requests_insert on public.language_requests for insert to authenticated with check (user_id = auth.uid());
drop policy if exists language_requests_admin on public.language_requests;
create policy language_requests_admin on public.language_requests for select to authenticated using (public.is_admin());
grant insert, select on public.language_requests to authenticated;
