select tablename, policyname, roles::text, qual from pg_policies where tablename in ('listings','documents','listing_red_flags','listing_images') order by 1;
