-- No-op compatibility migration.
-- The project had no deployed database when `revoked_at` was finalized, so
-- 0000 creates the final auth_sessions shape directly without replacing a
-- table or risking future session data.
SELECT 1;
