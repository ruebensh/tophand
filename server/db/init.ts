import { pool } from './database.ts';
import { CATALOGS_LIST, ALL_CATALOG_CATEGORIES } from './categoriesData.ts';

// ─── Table creation helpers ────────────────────────────────────────────
async function createTableIfNotExists(sql: string) {
  await pool.query(sql);
}

// ─── Main init ─────────────────────────────────────────────────────────
export async function initDatabase() {
  console.log('Initializing PostgreSQL schema...');

  // 0. catalogs (Xizmatlar, Ish o'rinlari va hk)
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS catalogs (
      id TEXT PRIMARY KEY,
      name_uz TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Briefcase',
      description TEXT,
      listing_types TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 1. regions
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name_uz TEXT NOT NULL,
      code TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // 2. districts
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS districts (
      id TEXT PRIMARY KEY,
      region_id TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
      name_uz TEXT NOT NULL,
      latitude NUMERIC,
      longitude NUMERIC,
      sort_order INTEGER DEFAULT 0
    )
  `);

  // 3. categories (with catalog_id)
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      catalog_id TEXT REFERENCES catalogs(id) ON DELETE SET NULL,
      name_uz TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Layers',
      parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Ensure catalog_id column exists if table was already created
  await pool.query(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='categories' AND column_name='catalog_id'
      ) THEN 
        ALTER TABLE categories ADD COLUMN catalog_id TEXT REFERENCES catalogs(id) ON DELETE SET NULL; 
      END IF; 
    END $$;
  `);

  // 4. users
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      telegram_id TEXT UNIQUE,
      telegram_username TEXT,
      name TEXT NOT NULL,
      profile_photo_url TEXT,
      phone TEXT,
      bio TEXT,
      region_id TEXT REFERENCES regions(id),
      district_id TEXT REFERENCES districts(id),
      latitude NUMERIC,
      longitude NUMERIC,
      role TEXT DEFAULT 'USER' CHECK(role IN ('USER','MODERATOR','ADMIN')),
      is_banned INTEGER DEFAULT 0,
      ban_type TEXT DEFAULT 'NONE' CHECK(ban_type IN ('NONE','TEMPORARY','PERMANENT')),
      ban_reason TEXT,
      ban_end_date TIMESTAMPTZ,
      passport_series TEXT,
      passport_number TEXT,
      verification_status TEXT DEFAULT 'UNVERIFIED' CHECK(verification_status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED')),
      verification_photo_url TEXT,
      verified_at TIMESTAMPTZ,
      average_rating NUMERIC DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 5. organizations
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      description TEXT,
      phone TEXT,
      website TEXT,
      region_id TEXT REFERENCES regions(id),
      district_id TEXT REFERENCES districts(id),
      address TEXT,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      verification_status TEXT DEFAULT 'UNVERIFIED' CHECK(verification_status IN ('UNVERIFIED','VERIFIED')),
      verified_at TIMESTAMPTZ,
      verified_by TEXT REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 6. organization_members
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'MEMBER' CHECK(role IN ('OWNER','ADMIN','MEMBER')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(organization_id, user_id)
    )
  `);

  // 7. listings
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK(type IN ('SERVICE_OFFER','SERVICE_REQUEST','JOB_OPENING','JOB_SEEKER')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id),
      region_id TEXT NOT NULL REFERENCES regions(id),
      district_id TEXT NOT NULL REFERENCES districts(id),
      latitude NUMERIC,
      longitude NUMERIC,
      price_type TEXT NOT NULL CHECK(price_type IN ('FIXED','FROM','RANGE','NEGOTIABLE','FREE')),
      price_min NUMERIC,
      price_max NUMERIC,
      currency TEXT DEFAULT 'UZS',
      salary_type TEXT CHECK(salary_type IN ('SALARY_FIXED','SALARY_RANGE','SALARY_NEGOTIABLE')),
      salary_min NUMERIC,
      salary_max NUMERIC,
      work_format TEXT DEFAULT 'ONSITE' CHECK(work_format IN ('ONSITE','REMOTE','HYBRID')),
      experience_level TEXT,
      skills TEXT,
      contact_time TEXT DEFAULT 'ANY_TIME' CHECK(contact_time IN ('ANY_TIME','MORNING','AFTERNOON','EVENING','CUSTOM')),
      contact_custom_text TEXT,
      status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','HIDDEN','ARCHIVED','REMOVED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      archived_at TIMESTAMPTZ,
      renewed_at TIMESTAMPTZ
    )
  `);

  // 8. listing_images
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS listing_images (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      storage_key TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 9. follows
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      follower_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followed_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(follower_user_id, followed_user_id)
    )
  `);

  // 10. saved_listings
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS saved_listings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, listing_id)
    )
  `);

  // 11. conversations
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      initiator_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 12. messages
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_type TEXT DEFAULT 'TEXT' CHECK(message_type IN ('TEXT','IMAGE')),
      text TEXT,
      attachment_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ
    )
  `);

  // 13. user_blocks
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS user_blocks (
      id TEXT PRIMARY KEY,
      blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(blocker_user_id, blocked_user_id)
    )
  `);

  // 14. reports
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK(target_type IN ('LISTING','USER','ORGANIZATION','MESSAGE','CONVERSATION')),
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING','REVIEWED','RESOLVED','DISMISSED')),
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      action_taken TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 15. notifications
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 16. audit_logs
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 17. system_settings
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    )
  `);

  // 18. reviews
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      employer_reply TEXT,
      employer_reply_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 19. profanity_words
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS profanity_words (
      id TEXT PRIMARY KEY,
      word TEXT UNIQUE NOT NULL,
      severity TEXT DEFAULT 'HIGH',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // 20. auto_flagged_content
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS auto_flagged_content (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL CHECK(source_type IN ('LISTING','REVIEW','CHAT_MESSAGE')),
      source_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      matched_words TEXT NOT NULL,
      content_snippet TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING','RESOLVED_BANNED','RESOLVED_CLEARED','DISMISSED')),
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      action_taken TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);

  // 21. search_filter_logs
  await createTableIfNotExists(`
    CREATE TABLE IF NOT EXISTS search_filter_logs (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      category_id TEXT,
      keyword TEXT,
      filter_type TEXT,
      filter_value TEXT,
      user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ─── Indexes ──────────────────────────────────────────────────────────
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_reviews_target_user ON reviews(target_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_reviews_author ON reviews(author_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id)',
    'CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_listings_type_status ON listings(type, status)',
    'CREATE INDEX IF NOT EXISTS idx_listings_category_status ON listings(category_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_listings_location_status ON listings(region_id, district_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_listings_expires_at ON listings(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_listings_owner_status ON listings(owner_user_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_follows_pair ON follows(follower_user_id, followed_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_saved_user_listing ON saved_listings(user_id, listing_id)',
    'CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_conv_listing ON conversations(listing_id)',
    'CREATE INDEX IF NOT EXISTS idx_conv_initiator ON conversations(initiator_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_conv_recipient ON conversations(recipient_user_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at)',
  ];
  for (const idx of indexes) {
    await pool.query(idx);
  }

  // Ensure listings has catalog_id column
  await pool.query(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='listings' AND column_name='catalog_id'
      ) THEN 
        ALTER TABLE listings ADD COLUMN catalog_id TEXT REFERENCES catalogs(id) ON DELETE SET NULL; 
      END IF; 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='email'
      ) THEN 
        ALTER TABLE users ADD COLUMN email TEXT UNIQUE; 
      END IF; 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='password_hash'
      ) THEN 
        ALTER TABLE users ADD COLUMN password_hash TEXT; 
      END IF; 
    END $$;

    CREATE TABLE IF NOT EXISTS email_verification_codes (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_email_verification ON email_verification_codes(email, code);
  `);

  // ─── Seed data ────────────────────────────────────────────────────────
  await seedInitialData();

  console.log('✅ PostgreSQL schema initialized successfully.');
}

// ─── Seed catalogs + categories ────────────────────────────────────────
export async function syncCategories() {
  const now = new Date().toISOString();

  // 1. Sync catalogs (services, jobs, etc.)
  for (const cat of CATALOGS_LIST) {
    await pool.query(`
      INSERT INTO catalogs (id, name_uz, slug, icon, description, listing_types, sort_order, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name_uz = EXCLUDED.name_uz,
        slug = EXCLUDED.slug,
        icon = EXCLUDED.icon,
        description = EXCLUDED.description,
        listing_types = EXCLUDED.listing_types,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
    `, [cat.id, cat.name_uz, cat.slug, cat.icon, cat.description, cat.listing_types, cat.sort_order, now, now]);
  }
  console.log(`✅ Catalogs synced: ${CATALOGS_LIST.length} catalogs.`);

  // 2. Sync categories (services + jobs)
  let order = 1;
  for (const parent of ALL_CATALOG_CATEGORIES) {
    const catalogId = parent.catalog_id || 'services';
    await pool.query(`
      INSERT INTO categories (id, catalog_id, name_uz, slug, icon, parent_id, is_active, sort_order, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,NULL,1,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        catalog_id = EXCLUDED.catalog_id,
        name_uz = EXCLUDED.name_uz,
        slug = EXCLUDED.slug,
        icon = EXCLUDED.icon,
        sort_order = EXCLUDED.sort_order,
        updated_at = EXCLUDED.updated_at
    `, [parent.id, catalogId, parent.name_uz, parent.slug, parent.icon, order++, now, now]);

    let subOrder = 1;
    for (const sub of parent.subs) {
      await pool.query(`
        INSERT INTO categories (id, catalog_id, name_uz, slug, icon, parent_id, is_active, sort_order, created_at, updated_at)
        VALUES ($1,$2,$3,$4,'Layers',$5,1,$6,$7,$8)
        ON CONFLICT (id) DO UPDATE SET
          catalog_id = EXCLUDED.catalog_id,
          name_uz = EXCLUDED.name_uz,
          slug = EXCLUDED.slug,
          parent_id = EXCLUDED.parent_id,
          sort_order = EXCLUDED.sort_order,
          updated_at = EXCLUDED.updated_at
      `, [sub.id, catalogId, sub.name_uz, sub.slug, parent.id, subOrder++, now, now]);
    }
  }

  // Update existing listings catalog_id if null, based on listing type
  await pool.query(`
    UPDATE listings 
    SET catalog_id = CASE 
      WHEN type IN ('SERVICE_OFFER', 'SERVICE_REQUEST') THEN 'services'
      WHEN type IN ('JOB_OPENING', 'JOB_SEEKER') THEN 'jobs'
      ELSE 'services'
    END
    WHERE catalog_id IS NULL;
  `);

  console.log(`✅ Categories synced: ${ALL_CATALOG_CATEGORIES.length} parent categories across catalogs.`);
}

// ─── Seed regions + districts ──────────────────────────────────────────
async function seedInitialData() {
  // Check if regions already seeded
  const existing = await pool.query('SELECT COUNT(*) AS cnt FROM regions');
  const count = parseInt(existing.rows[0]?.cnt ?? existing.rows[0]?.count ?? '0', 10);
  if (count > 0) {
    // Still sync categories in case new ones added
    await syncCategories();
    return;
  }

  console.log('Seeding initial reference data...');

  // Regions
  const regions = [
    { id: 'reg_toshkent_sh', name: 'Toshkent shahri', code: 'TSH', order: 1 },
    { id: 'reg_toshkent', name: 'Toshkent viloyati', code: 'TOS', order: 2 },
    { id: 'reg_samarqand', name: 'Samarqand viloyati', code: 'SAM', order: 3 },
    { id: 'reg_fargona', name: "Farg'ona viloyati", code: 'FAR', order: 4 },
    { id: 'reg_andijon', name: 'Andijon viloyati', code: 'AND', order: 5 },
    { id: 'reg_namangan', name: 'Namangan viloyati', code: 'NAM', order: 6 },
    { id: 'reg_buxoro', name: 'Buxoro viloyati', code: 'BUX', order: 7 },
    { id: 'reg_xorazm', name: 'Xorazm viloyati', code: 'XOR', order: 8 },
    { id: 'reg_qashqadaryo', name: 'Qashqadaryo viloyati', code: 'QAS', order: 9 },
    { id: 'reg_surxondaryo', name: 'Surxondaryo viloyati', code: 'SUR', order: 10 },
    { id: 'reg_jizzax', name: 'Jizzax viloyati', code: 'JIZ', order: 11 },
    { id: 'reg_sirdaryo', name: 'Sirdaryo viloyati', code: 'SIR', order: 12 },
    { id: 'reg_navoiy', name: 'Navoiy viloyati', code: 'NAV', order: 13 },
    { id: 'reg_qoraqalpogiston', name: "Qoraqalpog'iston Respublikasi", code: 'QQR', order: 14 },
  ];

  for (const r of regions) {
    await pool.query(
      'INSERT INTO regions (id, name_uz, code, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
      [r.id, r.name, r.code, r.order]
    );
  }

  // Toshkent districts
  const tashkentDistricts = [
    { id: 'dis_yunusobod', name: 'Yunusobod tumani', lat: 41.37, lon: 69.35, order: 1 },
    { id: 'dis_mirzo_ulugbek', name: 'Mirzo Ulug\'bek tumani', lat: 41.32, lon: 69.37, order: 2 },
    { id: 'dis_chilonzor', name: 'Chilonzor tumani', lat: 41.28, lon: 69.19, order: 3 },
    { id: 'dis_yakkasaroy', name: 'Yakkasaroy tumani', lat: 41.29, lon: 69.26, order: 4 },
    { id: 'dis_shayxontohur', name: 'Shayxontohur tumani', lat: 41.32, lon: 69.27, order: 5 },
    { id: 'dis_olmazor', name: 'Olmazor tumani', lat: 41.31, lon: 69.22, order: 6 },
    { id: 'dis_uchtepa', name: 'Uchtepa tumani', lat: 41.28, lon: 69.24, order: 7 },
    { id: 'dis_bektemir', name: 'Bektemir tumani', lat: 41.26, lon: 69.38, order: 8 },
    { id: 'dis_mirobod', name: 'Mirobod tumani', lat: 41.31, lon: 69.30, order: 9 },
    { id: 'dis_sirg_ali', name: "Sirg'ali tumani", lat: 41.37, lon: 69.20, order: 10 },
    { id: 'dis_yashnobod', name: 'Yashnobod tumani', lat: 41.27, lon: 69.31, order: 11 },
  ];

  for (const d of tashkentDistricts) {
    await pool.query(
      'INSERT INTO districts (id, region_id, name_uz, latitude, longitude, sort_order) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
      [d.id, 'reg_toshkent_sh', d.name, d.lat, d.lon, d.order]
    );
  }

  // Seed categories
  await syncCategories();

  console.log('✅ Initial data seeded successfully.');
}
