-- Signed-in users can ask for a deep dive without starring (the "Read the court report" button).
drop policy if exists "Signed-in users can request a deep dive" on public.deep_dives;
create policy "Signed-in users can request a deep dive" on public.deep_dives
  for insert to authenticated with check (status = 'pending');
grant insert on public.deep_dives to authenticated;
