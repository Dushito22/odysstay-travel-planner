select row_to_json(f) from public.listing_feed f where price_eur = 11500 and surface_sqm = 85 limit 1;
