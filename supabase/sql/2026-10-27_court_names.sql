-- One-off tidy of court-sale rows written before the worker formatted court names and bidding modes.
-- Safe to re-run.
with fixed as (
  select id, court as old_court,
         'Tribunale di ' || initcap(substring(court from '^Tribunale di (.*)$')) as new_court
  from public.listings
  where external_id like 'pvp:%' and court ~ '^Tribunale di [^a-z]+$'
)
update public.listings l
set court = f.new_court,
    summary_en = replace(l.summary_en, f.old_court, f.new_court)
from fixed f where l.id = f.id;

update public.listing_facts
set value_text = 'Tribunale di ' || initcap(substring(value_text from '^Tribunale di ([^,]*)')) ||
                 coalesce(substring(value_text from '^Tribunale di [^,]*(,.*)$'), '')
where key = 'court' and value_text ~ '^Tribunale di [^a-z,]+(,|$)';

update public.listing_facts set value_text = replace(value_text, ', lotto ', ', lot ') where key = 'court';

update public.listing_facts set value_text = quote_en where key = 'sale_mode' and quote_en is not null and value_text <> quote_en;

update public.listings set sale_mode = case sale_mode
    when 'Asincrona Telematica' then 'Online, asynchronous bidding'
    when 'Sincrona Telematica' then 'Online, live bidding'
    when 'Sincrona Mista' then 'Online or in person, live'
    when 'Presso Il Venditore' then 'In person at the delegate''s office'
    else sale_mode end
where external_id like 'pvp:%';
