select sale_type src, count(*) n, count(*) filter (where jsonb_array_length(photo_urls)>0) with_photos,
 count(*) filter (where price_eur<=25000) u25, count(*) filter (where price_eur<=60000) u60,
 count(*) filter (where condition='ruin') ruin, count(*) filter (where condition='needs_work') nw, count(*) filter (where condition='ready') rdy
from listings where is_demo=false group by sale_type order by n desc;
