-- Briefs written before the prompt fix may say "I don't have confirmed details". Clear them; they regenerate on view.
delete from public.area_briefs where brief ilike '%don''t have confirmed%' or brief ilike '%нет подтвержд%' or facts = '{}'::jsonb;
