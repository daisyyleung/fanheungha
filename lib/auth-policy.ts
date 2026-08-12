/**
 * Record one failed PIN attempt while checking that the settings snapshot
 * used for verification is still current.
 *
 * The statement deliberately performs the read/compute/write as one SQLite
 * operation. A missing RETURNING row means the settings snapshot was stale,
 * so callers must not treat the attempt as recorded.
 */
export const FAILED_PIN_ATTEMPT_SQL = `
  INSERT INTO auth_attempts (id, failed_count, locked_until, updated_at)
  SELECT ?, 1, NULL, ?
  WHERE EXISTS (
    SELECT 1
    FROM settings
    WHERE id = ? AND pin_salt = ? AND pin_hash = ?
  )
  ON CONFLICT(id) DO UPDATE SET
    failed_count = CASE
      WHEN auth_attempts.locked_until IS NOT NULL
        AND auth_attempts.locked_until > excluded.updated_at
        THEN auth_attempts.failed_count
      WHEN auth_attempts.locked_until IS NOT NULL
        AND auth_attempts.locked_until <= excluded.updated_at
        THEN 1
      ELSE auth_attempts.failed_count + 1
    END,
    locked_until = CASE
      WHEN auth_attempts.locked_until IS NOT NULL
        AND auth_attempts.locked_until > excluded.updated_at
        THEN auth_attempts.locked_until
      WHEN auth_attempts.locked_until IS NOT NULL
        AND auth_attempts.locked_until <= excluded.updated_at
        THEN NULL
      WHEN auth_attempts.failed_count + 1 >= ?
        THEN ?
      ELSE NULL
    END,
    updated_at = CASE
      WHEN auth_attempts.locked_until IS NOT NULL
        AND auth_attempts.locked_until > excluded.updated_at
        THEN auth_attempts.updated_at
      ELSE excluded.updated_at
    END
  RETURNING failed_count, locked_until
`;
