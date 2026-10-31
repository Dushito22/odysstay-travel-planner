select count(*) filter (where has_real_photo) real_photo, count(*) filter (where is_scrap) scrap,
 count(*) filter (where not is_scrap and property_type in ('house','apartment','rural_house') and price_eur between 30000 and 50000) band_30_50
from listing_feed where is_demo=false and status not in ('closed','withdrawn');
