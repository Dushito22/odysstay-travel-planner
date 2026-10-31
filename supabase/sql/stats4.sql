select coalesce(region,'?') region, count(*) n, count(*) filter (where price_eur<25000) u25,
 count(*) filter (where price_eur between 25000 and 50000) b25_50, count(*) filter (where price_eur>50000) o50,
 (select count(*) from listing_feed where has_real_photo and not is_scrap and status not in ('closed','withdrawn')) live_real
from listings where sale_type='sale' group by 1 order by n desc;
