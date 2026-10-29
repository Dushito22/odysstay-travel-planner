-- Read-only: what is in the feed for houses under 25k, and where the photos come from.
select jsonb_build_object(
 'all_active', (select count(*) from listings where status='active' and is_demo=false),
 'by_source', (select jsonb_object_agg(coalesce(d.source_id,'none'), c) from (select d.source_id, count(*) c from listings l left join documents d on d.id=l.document_id where l.status='active' and l.is_demo=false group by 1) d),
 'u25_types', (select jsonb_object_agg(coalesce(property_type,'null'), c) from (select property_type, count(*) c from listings where status='active' and is_demo=false and price_eur<=25000 group by 1) t),
 'u25_houses', (select count(*) from listings where status='active' and is_demo=false and price_eur<=25000 and property_type in ('house','apartment','rural_house')),
 'u25_houses_with_court_photo', (select count(*) from listings where status='active' and is_demo=false and price_eur<=25000 and property_type in ('house','apartment','rural_house') and hero_image_path ilike '%giustizia.it%'),
 'u25_houses_with_real_photo', (select count(*) from listings where status='active' and is_demo=false and price_eur<=25000 and property_type in ('house','apartment','rural_house') and hero_image_path is not null and hero_image_path not ilike '%giustizia.it%' and hero_image_path not ilike '%astegiudiziarie%'),
 'real_photo_any', (select count(*) from listings where status='active' and is_demo=false and hero_image_path is not null and hero_image_path not ilike '%giustizia.it%' and hero_image_path not ilike '%astegiudiziarie%'),
 'immobiliare', (select count(*) from listings where external_id like 'immobiliare:%'),
 'sample_real', (select jsonb_agg(hero_image_path) from (select hero_image_path from listings where hero_image_path is not null and hero_image_path not ilike '%giustizia.it%' limit 3) s)
) as r;
