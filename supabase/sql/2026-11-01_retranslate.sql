-- Translations made before the readable layout: drop them so they are made again, laid out, on next view.
delete from public.listing_translations where created_at < now();
