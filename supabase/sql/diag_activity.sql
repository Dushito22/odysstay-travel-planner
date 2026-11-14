-- Read-only: the plan and timing of one region feed query. Safe to run any time.
create or replace function pg_temp.feed_plan() returns text language plpgsql as $$
declare r text; o text := '';
begin
  for r in execute $q$explain (analyze, buffers, costs off)
    select id, region, score, latest_render_path, red_flag_count from public.listing_feed
    where is_demo = false and is_scrap = false and status not in ('closed','withdrawn') and region = 'Abruzzo'
    order by has_real_photo desc nulls last, score desc nulls last limit 600$q$ loop
    o := o || regexp_replace(r, '\s+', ' ', 'g') || ' / ';
  end loop;
  return o;
end $$;
select pg_temp.feed_plan() as plan;
