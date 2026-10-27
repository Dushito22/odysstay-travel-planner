-- More sources: notary sales (Avvisinotarili) and the €1 house schemes.
alter table public.listings drop constraint if exists listings_sale_type_check;
alter table public.listings add constraint listings_sale_type_check
  check (sale_type = any (array['sale', 'concession', 'lease', 'one_euro', 'auction_judicial', 'auction_notary', 'other']));

insert into public.sources (id, name, country, kind, homepage, description_en) values
  ('notary', 'Avvisi Notarili', 'IT', 'notary', 'https://www.avvisinotarili.notariato.it',
   'The national notaries'' portal: sales and auctions by private sellers, companies and public bodies, each checked by a notary.'),
  ('one_euro', 'Case a 1 euro', 'IT', 'municipal', 'https://casea1euro.it',
   'Towns selling abandoned houses for a symbolic €1 in exchange for renovating them. We link each town''s official scheme page.')
on conflict (id) do update set name = excluded.name, homepage = excluded.homepage, description_en = excluded.description_en;
