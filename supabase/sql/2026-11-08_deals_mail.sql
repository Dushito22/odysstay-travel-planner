-- Delete a deal in one tap: the owner only, everything under it goes too.
create or replace function public.delete_deal(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.deals where id = target and user_id = auth.uid()) then
    raise exception 'not allowed';
  end if;
  delete from public.messages where thread_id in (select id from public.threads where deal_id = target);
  delete from public.threads where deal_id = target;
  delete from public.deal_tasks where deal_id = target;
  delete from public.quotes where deal_id = target;
  delete from public.deal_events where deal_id = target;
  update public.agent_conversations set deal_id = null where deal_id = target;
  delete from public.deals where id = target;
end $$;
revoke all on function public.delete_deal(uuid) from public;
grant execute on function public.delete_deal(uuid) to authenticated;

-- Emails Argos sends for a buyer: the provider's id, so replies and bounces can be matched.
alter table public.messages add column if not exists provider_id text;
alter table public.messages add column if not exists sent_to text;
