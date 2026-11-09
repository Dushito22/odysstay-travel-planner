-- Official market values (OMI, Agenzia delle Entrate) for each listing's zone, filled by the worker's omi step.
alter table public.listings
  add column if not exists omi_zone text,
  add column if not exists omi_zone_descr text,
  add column if not exists omi_type text,
  add column if not exists omi_eur_m2_min numeric,
  add column if not exists omi_eur_m2_max numeric,
  add column if not exists omi_rent_m2_min numeric,
  add column if not exists omi_rent_m2_max numeric,
  add column if not exists omi_semester text,
  add column if not exists omi_match text;
notify pgrst, 'reload schema';
