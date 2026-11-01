select 'total' k, count(*)::text v from listings where not is_demo
union all select 'with_latlng', count(*)::text from listings where not is_demo and lat is not null
union all select 'type:'||coalesce(property_type,'null'), count(*)::text from listings where not is_demo group by property_type
union all select 'cond:'||coalesce(condition,'null'), count(*)::text from listings where not is_demo group by condition
union all select 'sale:'||coalesce(sale_type,'null'), count(*)::text from listings where not is_demo group by sale_type
union all select 'score:'||(score/10*10)::text, count(*)::text from listings where not is_demo and status not in ('closed','withdrawn') group by score/10
union all select 'photos', count(*)::text from listings where not is_demo and has_real_photo
union all select 'cols:'||string_agg(column_name,',' order by column_name), '' from information_schema.columns where table_name='listings' and table_schema='public';
