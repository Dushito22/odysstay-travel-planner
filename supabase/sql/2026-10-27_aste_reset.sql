-- The first Astegiudiziarie run was throttled and marked thousands of pages as empty. Forget them so they are read again.
delete from public.documents where source_id = 'aste' and status = 'irrelevant';
