select
 (select json_object_agg(coalesce(condition,'none'), n) from (select condition, count(*) n from listings where sale_type='sale' group by 1) x) cond,
 (select count(distinct listing_id) from listing_facts where key='rooms') with_rooms,
 (select count(*) from listing_red_flags where origin='listing') listing_flags,
 (select count(*) from cost_estimates where scenario='refresh') refresh_est,
 (select count(*) from listings where sale_type='sale' and has_real_photo) real_photo_sale,
 (select count(*) from listings where sale_mode ilike '%consultant%') auction_ads;
