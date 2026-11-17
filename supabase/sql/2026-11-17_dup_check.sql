-- Read-only: how the duplicates pair up by source, and a sample to eyeball.
select json_build_object(
  'pairs', (select json_agg(x) from (select dd.source_id as dup_src, dk.source_id as keep_src, count(*) n
     from listings d join listings k on k.id = d.duplicate_of
     left join documents dd on dd.id = d.document_id left join documents dk on dk.id = k.document_id
     where d.duplicate_of is not null group by 1, 2 order by 3 desc limit 12) x),
  'sample', (select json_agg(y) from (select d.comune, d.price_eur, k.price_eur kp, d.surface_sqm, k.surface_sqm ks, dd.url, dk.url kurl
     from listings d join listings k on k.id = d.duplicate_of
     left join documents dd on dd.id = d.document_id left join documents dk on dk.id = k.document_id
     where d.duplicate_of is not null order by random() limit 8) y),
  'scores', (select json_agg(z) from (select (score::int / 10) * 10 b, count(*) n from listings
     where not is_demo and not is_scrap and duplicate_of is null and status not in ('closed','withdrawn') group by 1 order by 1) z)
) as r;
