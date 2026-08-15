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

/**
 * Record one failed first-run secret attempt while no household settings
 * have been claimed. A settings claim winning the race makes this return no
 * row, so a late failure cannot recreate or lock the setup state.
 */
export const FAILED_SETUP_ATTEMPT_SQL = `
  INSERT INTO auth_attempts (id, failed_count, locked_until, updated_at)
  SELECT ?, 1, NULL, ?
  WHERE NOT EXISTS (
    SELECT 1
    FROM settings
    WHERE id = 'household'
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

/** Claim the household settings row only while the first-run lock is clear. */
export const CLAIM_SETTINGS_SQL = `
  INSERT INTO settings (id, pin_salt, pin_hash, created_at, updated_at)
  SELECT ?, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1
    FROM settings
    WHERE id = ?
  )
    AND NOT EXISTS (
      SELECT 1
      FROM auth_attempts
      WHERE id = ?
        AND locked_until IS NOT NULL
        AND locked_until > ?
    )
`;
