import { pool } from './database.ts';

// ─── Idempotent column/table helpers ───────────────────────────────────
async function addColumnIfNotExists(table: string, column: string, def: string) {
  await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${def}`);
}

async function seedSetting(key: string, value: string) {
  // Only insert if not already present — never overwrite admin edits.
  await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
    [key, value]
  );
}

/**
 * Runs idempotent schema migrations + seeds default monetization settings.
 * Called at the end of initDatabase(). Safe to run on every boot.
 */
export async function runMigrations() {
  console.log('Running idempotent schema migrations...');

  // ── Faza 16: users passport/legal columns (referenced by adminRoutes) ──
  await addColumnIfNotExists('users', 'email_verified', 'INTEGER DEFAULT 0');
  await addColumnIfNotExists('users', 'pinfl', 'TEXT');
  await addColumnIfNotExists('users', 'full_legal_name', 'TEXT');
  await addColumnIfNotExists('users', 'birth_date', 'TEXT');
  await addColumnIfNotExists('users', 'passport_issued_by', 'TEXT');
  await addColumnIfNotExists('users', 'passport_issued_date', 'TEXT');
  await addColumnIfNotExists('users', 'verification_rejection_reason', 'TEXT');
  await addColumnIfNotExists('users', 'verified_by', 'TEXT REFERENCES users(id)');
  await addColumnIfNotExists('users', 'ban_start_date', 'TIMESTAMPTZ');

  // ── Auth rework: existing accounts are treated as email-verified so the new
  //    mandatory email-code flow only applies to NEW registrations. In the new
  //    model `email` is only written after a code check, so email present ⇒ verified.
  await pool.query(`UPDATE users SET email_verified = 1 WHERE email IS NOT NULL AND email_verified = 0`);

  // ── Faza 17: expand role hierarchy (drop old CHECK, add new) ──
  await pool.query(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = con.connamespace
        WHERE rel.relname = 'users'
          AND nsp.nspname = current_schema()
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%role%'
      LOOP
        EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', r.conname);
      END LOOP;
    END $$;
  `);
  await pool.query(`
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('USER','INTERN_MOD','MODERATOR','LEAD_MOD','ADMIN','SUPER_ADMIN'))
  `);

  // ── Faza 8: promo / featured placement ──
  await addColumnIfNotExists('listings', 'promoted_until', 'TIMESTAMPTZ');

  // ── Faza 17: moderation assignment columns on listings ──
  await addColumnIfNotExists('listings', 'assigned_moderator_id', 'TEXT REFERENCES users(id) ON DELETE SET NULL');
  await addColumnIfNotExists('listings', 'review_status', "TEXT DEFAULT 'UNASSIGNED' CHECK (review_status IN ('UNASSIGNED','IN_PROGRESS','ESCALATED','RESOLVED'))");
  await addColumnIfNotExists('listings', 'priority', "TEXT DEFAULT 'P2' CHECK (priority IN ('P0','P1','P2','P3'))");
  await addColumnIfNotExists('listings', 'sla_due_at', 'TIMESTAMPTZ');
  await addColumnIfNotExists('listings', 'claimed_at', 'TIMESTAMPTZ');

  // ── Faza 13: media type on listing images ──
  await addColumnIfNotExists('listing_images', 'media_type', "TEXT DEFAULT 'image' CHECK (media_type IN ('image','video'))");
  await addColumnIfNotExists('listing_images', 'thumbnail_url', 'TEXT');

  // ── Listing lifecycle: allow an owner to CLOSE a fulfilled request as COMPLETED ──
  await addColumnIfNotExists('listings', 'completed_at', 'TIMESTAMPTZ');
  await pool.query(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = con.connamespace
        WHERE rel.relname = 'listings'
          AND nsp.nspname = current_schema()
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%ACTIVE%'
      LOOP
        EXECUTE format('ALTER TABLE listings DROP CONSTRAINT %I', r.conname);
      END LOOP;
    END $$;
  `);
  await pool.query(`
    ALTER TABLE listings ADD CONSTRAINT listings_status_check
      CHECK (status IN ('ACTIVE','HIDDEN','ARCHIVED','REMOVED','COMPLETED'))
  `);

  // ── Faza 7: wallets ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      balance NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'UZS',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('TOPUP','SPEND','REFUND','ADJUST')),
      amount NUMERIC NOT NULL,
      balance_after NUMERIC NOT NULL,
      ref_type TEXT,
      ref_id TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Faza 9: listing analytics events ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS listing_events (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN ('VIEW','CONTACT','SAVE')),
      user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Indexes for new structures ──
  const idx = [
    'CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_listing_events_listing ON listing_events(listing_id, event_type)',
    'CREATE INDEX IF NOT EXISTS idx_listings_promoted_until ON listings(promoted_until)',
    'CREATE INDEX IF NOT EXISTS idx_listings_assigned_moderator ON listings(assigned_moderator_id, review_status)',
  ];
  for (const q of idx) await pool.query(q);

  // ── Faza 17: moderation distribution engine tables ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS moderator_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      level TEXT NOT NULL DEFAULT 'MODERATOR',
      max_open_tasks INTEGER NOT NULL DEFAULT 10,
      specialty_catalogs TEXT[] NOT NULL DEFAULT '{}',
      regions TEXT[] NOT NULL DEFAULT '{}',
      langs TEXT[] NOT NULL DEFAULT '{}',
      can_message_users BOOLEAN NOT NULL DEFAULT false,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await addColumnIfNotExists('moderator_profiles', 'can_message_users', 'BOOLEAN NOT NULL DEFAULT false');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moderation_notes (
      id TEXT PRIMARY KEY,
      moderator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS canned_responses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_id TEXT,
      listing_id TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
      resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      resolution_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS moderator_stats (
      id TEXT PRIMARY KEY,
      moderator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      tasks_resolved INTEGER NOT NULL DEFAULT 0,
      tasks_claimed INTEGER NOT NULL DEFAULT 0,
      escalations INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (moderator_id, day)
    )
  `);

  // ── Faza 18: staff messaging (TopHand nomidan) ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL,
      scope TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'BROADCAST',
      recipient_count INTEGER NOT NULL DEFAULT 0,
      subject TEXT,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const idx2 = [
    'CREATE INDEX IF NOT EXISTS idx_listings_review_queue ON listings(review_status, priority, sla_due_at)',
    'CREATE INDEX IF NOT EXISTS idx_moderation_notes_target ON moderation_notes(target_user_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_staff_messages_sender ON staff_messages(sender_id, created_at)',
  ];
  for (const q of idx2) await pool.query(q);

  // ── Faza 1: default monetization settings (only if missing) ──
  const defaultTestEnd = new Date(Date.now() + 210 * 24 * 60 * 60 * 1000).toISOString();
  await seedSetting('monetization_mode', 'FREE_TEST');
  await seedSetting('free_test_end_date', defaultTestEnd);
  await seedSetting('listing_active_days_free', '7');
  await seedSetting('listing_active_days_paid', '30');
  await seedSetting('expiry_warning_days', '2');
  await seedSetting('listing_price_services', '0');
  await seedSetting('listing_price_jobs', '0');
  await seedSetting('renew_enabled_paid', '0');
  await seedSetting('renew_price_services', '0');
  await seedSetting('renew_price_jobs', '0');
  await seedSetting('promo_price_services', '0');
  await seedSetting('promo_price_jobs', '0');
  await seedSetting('promo_duration_hours', '24');
  await seedSetting('auto_approve_enabled', '0');

  console.log('✅ Schema migrations complete.');
}
