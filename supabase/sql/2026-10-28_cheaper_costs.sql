-- Renovation price list moved from a premium studio to Cronoshare 2026 averages (about 45% lower).
-- Drop the system-made estimates; the worker's costs step recreates them. User-entered quotes (user_id set) are kept.
delete from cost_estimates where user_id is null;
