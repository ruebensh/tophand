import { getDb, persistDb } from './database.ts';

export async function initDatabase() {
  const db = await getDb();

  // Create Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      name_uz TEXT NOT NULL,
      code TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS districts (
      id TEXT PRIMARY KEY,
      region_id TEXT NOT NULL,
      name_uz TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name_uz TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT NOT NULL,
      parent_id TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      telegram_id TEXT UNIQUE,
      telegram_username TEXT,
      name TEXT NOT NULL,
      profile_photo_url TEXT,
      phone TEXT,
      bio TEXT,
      region_id TEXT,
      district_id TEXT,
      latitude REAL,
      longitude REAL,
      role TEXT DEFAULT 'USER' CHECK(role IN ('USER', 'MODERATOR', 'ADMIN')),
      is_banned INTEGER DEFAULT 0,
      ban_type TEXT DEFAULT 'NONE' CHECK(ban_type IN ('NONE', 'TEMPORARY', 'PERMANENT')),
      ban_reason TEXT,
      ban_end_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (region_id) REFERENCES regions(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      logo_url TEXT,
      description TEXT,
      phone TEXT,
      website TEXT,
      region_id TEXT,
      district_id TEXT,
      address TEXT,
      owner_user_id TEXT NOT NULL,
      verification_status TEXT DEFAULT 'UNVERIFIED' CHECK(verification_status IN ('UNVERIFIED', 'VERIFIED')),
      verified_at TEXT,
      verified_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (region_id) REFERENCES regions(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'MEMBER' CHECK(role IN ('OWNER', 'ADMIN', 'MEMBER')),
      created_at TEXT NOT NULL,
      UNIQUE(organization_id, user_id),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      organization_id TEXT,
      type TEXT NOT NULL CHECK(type IN ('SERVICE_OFFER', 'SERVICE_REQUEST', 'JOB_OPENING', 'JOB_SEEKER')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id TEXT NOT NULL,
      region_id TEXT NOT NULL,
      district_id TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      price_type TEXT NOT NULL CHECK(price_type IN ('FIXED', 'FROM', 'RANGE', 'NEGOTIABLE', 'FREE')),
      price_min REAL,
      price_max REAL,
      currency TEXT DEFAULT 'UZS',
      salary_type TEXT CHECK(salary_type IS NULL OR salary_type IN ('SALARY_FIXED', 'SALARY_RANGE', 'SALARY_NEGOTIABLE')),
      salary_min REAL,
      salary_max REAL,
      work_format TEXT DEFAULT 'ONSITE' CHECK(work_format IN ('ONSITE', 'REMOTE', 'HYBRID')),
      experience_level TEXT,
      skills TEXT,
      contact_time TEXT DEFAULT 'ANY_TIME' CHECK(contact_time IN ('ANY_TIME', 'MORNING', 'AFTERNOON', 'EVENING', 'CUSTOM')),
      contact_custom_text TEXT,
      status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'HIDDEN', 'ARCHIVED', 'REMOVED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      archived_at TEXT,
      renewed_at TEXT,
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (region_id) REFERENCES regions(id),
      FOREIGN KEY (district_id) REFERENCES districts(id)
    );

    CREATE TABLE IF NOT EXISTS listing_images (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      url TEXT NOT NULL,
      storage_key TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      follower_user_id TEXT NOT NULL,
      followed_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(follower_user_id, followed_user_id),
      FOREIGN KEY (follower_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (followed_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_listings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user_id, listing_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      initiator_user_id TEXT NOT NULL,
      recipient_user_id TEXT NOT NULL,
      organization_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
      FOREIGN KEY (initiator_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_user_id TEXT NOT NULL,
      message_type TEXT DEFAULT 'TEXT' CHECK(message_type IN ('TEXT', 'IMAGE')),
      text TEXT,
      attachment_url TEXT,
      created_at TEXT NOT NULL,
      read_at TEXT,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_blocks (
      id TEXT PRIMARY KEY,
      blocker_user_id TEXT NOT NULL,
      blocked_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(blocker_user_id, blocked_user_id),
      FOREIGN KEY (blocker_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_user_id TEXT NOT NULL,
      target_type TEXT NOT NULL CHECK(target_type IN ('LISTING', 'USER', 'ORGANIZATION', 'MESSAGE', 'CONVERSATION')),
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED')),
      reviewed_by TEXT,
      reviewed_at TEXT,
      action_taken TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      author_user_id TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      listing_id TEXT,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      employer_reply TEXT,
      employer_reply_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL
    );

    -- Performance Indexes as specified in requirements
    CREATE INDEX IF NOT EXISTS idx_reviews_target_user ON reviews(target_user_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_author ON reviews(author_user_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id);
    CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_listings_type_status ON listings(type, status);
    CREATE INDEX IF NOT EXISTS idx_listings_category_status ON listings(category_id, status);
    CREATE INDEX IF NOT EXISTS idx_listings_location_status ON listings(region_id, district_id, status);
    CREATE INDEX IF NOT EXISTS idx_listings_expires_at ON listings(expires_at);
    CREATE INDEX IF NOT EXISTS idx_listings_owner_status ON listings(owner_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_follows_pair ON follows(follower_user_id, followed_user_id);
    CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_user_id);
    CREATE INDEX IF NOT EXISTS idx_saved_user_listing ON saved_listings(user_id, listing_id);
    CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_conv_listing ON conversations(listing_id);
    CREATE INDEX IF NOT EXISTS idx_conv_initiator ON conversations(initiator_user_id);
    CREATE INDEX IF NOT EXISTS idx_conv_recipient ON conversations(recipient_user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);

    CREATE TABLE IF NOT EXISTS profanity_words (
      id TEXT PRIMARY KEY,
      word TEXT UNIQUE NOT NULL,
      severity TEXT DEFAULT 'HIGH',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auto_flagged_content (
      id TEXT PRIMARY KEY,
      source_type TEXT NOT NULL CHECK(source_type IN ('LISTING', 'REVIEW', 'CHAT_MESSAGE')),
      source_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      matched_words TEXT NOT NULL,
      content_snippet TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'RESOLVED_BANNED', 'RESOLVED_CLEARED', 'DISMISSED')),
      reviewed_by TEXT,
      action_taken TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS search_filter_logs (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      category_id TEXT,
      keyword TEXT,
      filter_type TEXT,
      filter_value TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Seed reference data if empty
  await seedInitialData(db);

  // Add passport & verification columns to users if missing
  const userColumns = [
    'passport_series TEXT',
    'passport_number TEXT',
    'pinfl TEXT',
    'full_legal_name TEXT',
    'birth_date TEXT',
    'passport_issued_by TEXT',
    'passport_issued_date TEXT',
    "verification_status TEXT DEFAULT 'UNVERIFIED'",
    'verification_requested_at TEXT',
    'verified_at TEXT',
    'verified_by TEXT',
    'verification_rejection_reason TEXT',
  ];
  for (const col of userColumns) {
    try {
      db.run(`ALTER TABLE users ADD COLUMN ${col}`);
    } catch {
      // Column might already exist
    }
  }

  // Ensure default active logo setting exists in system_settings
  db.run(`
    INSERT OR IGNORE INTO system_settings (key, value, updated_at, updated_by)
    VALUES ('active_logo_url', '/TOPHAND.uz (1).png', '${new Date().toISOString()}', 'system');
  `);

  // Ensure default platform branding exists in system_settings
  const defaultBranding = JSON.stringify({
    prefix_text: 'top',
    prefix_color: '#111827',
    suffix_text: 'hand',
    suffix_color: '#1673E6',
    domain_suffix: '.uz',
    domain_color: '#1673E6',
    tagline: 'Mahalliy Xizmatlar va Ish Bozori Platformasi',
    logo_url: '/TOPHAND.uz (1).png',
  });
  db.run(`
    INSERT OR IGNORE INTO system_settings (key, value, updated_at, updated_by)
    VALUES ('platform_brand', '${defaultBranding.replace(/'/g, "''")}', '${new Date().toISOString()}', 'system');
  `);

  // Seed default profanity words if empty
  try {
    const profCheck = db.exec('SELECT COUNT(*) as count FROM profanity_words');
    const profCount = profCheck[0]?.values[0]?.[0] || 0;
    if (profCount === 0) {
      const badWords = [
        'ahmoq', 'haromi', 'mol', 'jalap', 'qanjiq', 'la’nat', 'padarla’nat', 'padariga',
        'firibgar', 'skam', 'scam', 'gandon', 'dalbayob', 'itvachcha', 'tuhmatchi', 'kalla'
      ];
      const now = new Date().toISOString();
      for (const w of badWords) {
        db.run('INSERT INTO profanity_words (id, word, severity, created_at) VALUES (?, ?, ?, ?)', [
          `pf_${Math.random().toString(36).slice(2, 10)}`,
          w,
          'HIGH',
          now,
        ]);
      }

      // Seed initial sample auto-flagged content for moderator queue
      db.run(`
        INSERT INTO auto_flagged_content (id, source_type, source_id, user_id, matched_words, content_snippet, status, created_at)
        VALUES 
        ('flg_sample_1', 'REVIEW', 'rev_sample_bad', 'usr_seeker', '["firibgar"]', 'Usta kelib pulni oldi va qochib ketdi, bu haqiqiy firibgar ekan!', 'PENDING', '${now}'),
        ('flg_sample_2', 'CHAT_MESSAGE', 'msg_sample_bad', 'usr_craftsman', '["scam"]', 'Keling pulni karta raqamimga tashlab bering bu scam emas aniq.', 'PENDING', '${now}');
      `);
    }
  } catch (err) {
    console.warn('Profanity seeding error:', err);
  }

  // Seed initial search and filter analytics if empty
  try {
    const logCheck = db.exec('SELECT COUNT(*) as count FROM search_filter_logs');
    const logCount = logCheck[0]?.values[0]?.[0] || 0;
    if (logCount === 0) {
      const sampleEvents = [
        { event_type: 'CATEGORY_FILTER', category_id: 'cat_qurilish', filter_type: 'CATEGORY', filter_value: 'Qurilish & Ta’mirlash', count: 420 },
        { event_type: 'CATEGORY_FILTER', category_id: 'cat_santexnika', filter_type: 'CATEGORY', filter_value: 'Santexnika', count: 315 },
        { event_type: 'CATEGORY_FILTER', category_id: 'cat_it', filter_type: 'CATEGORY', filter_value: 'IT & Dasturlash', count: 280 },
        { event_type: 'CATEGORY_FILTER', category_id: 'cat_tozalash', filter_type: 'CATEGORY', filter_value: 'Tozalash (Klining)', count: 210 },
        { event_type: 'CATEGORY_FILTER', category_id: 'cat_savdo', filter_type: 'CATEGORY', filter_value: 'Savdo & Mijozlar', count: 175 },
        { event_type: 'FILTER_USE', filter_type: 'MAOSH_PRICE', filter_value: 'Narx/Maosh oralig‘i', count: 540 },
        { event_type: 'FILTER_USE', filter_type: 'HUDUD', filter_value: 'Toshkent shahri (Tumanlar)', count: 490 },
        { event_type: 'FILTER_USE', filter_type: 'ISH_TURI', filter_value: 'Masofaviy (Remote)', count: 320 },
        { event_type: 'FILTER_USE', filter_type: 'OBUNALARIM', filter_value: 'Faqat obunalarim e’lonlari', count: 260 },
        { event_type: 'FILTER_USE', filter_type: 'TAJRIBA', filter_value: '3+ yil tajriba', count: 195 },
        { event_type: 'SEARCH_KEYWORD', keyword: 'santexnik usta', count: 310 },
        { event_type: 'SEARCH_KEYWORD', keyword: 'malyar kafelchi', count: 245 },
        { event_type: 'SEARCH_KEYWORD', keyword: 'buxgalter 1C', count: 180 },
        { event_type: 'SEARCH_KEYWORD', keyword: 'elektrik montaj', count: 165 },
      ];
      const now = new Date().toISOString();
      for (const ev of sampleEvents) {
        for (let i = 0; i < Math.min(ev.count, 20); i++) {
          db.run(`
            INSERT INTO search_filter_logs (id, event_type, category_id, keyword, filter_type, filter_value, user_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            `sfl_${Math.random().toString(36).slice(2, 12)}`,
            ev.event_type,
            ev.category_id || null,
            ev.keyword || null,
            ev.filter_type || null,
            ev.filter_value || null,
            null,
            now
          ]);
        }
      }
    }
  } catch (err) {
    console.warn('Analytics seeding error:', err);
  }

  // Update existing seed users with sample verified passport details
  try {
    db.run(`
      UPDATE users SET 
        passport_series = 'AA',
        passport_number = '7654321',
        pinfl = '31205901234567',
        full_legal_name = 'Otajonov Javohir Baxtiyorovich',
        birth_date = '1990-05-12',
        passport_issued_by = 'Chilonzor tumani IIB FMB',
        passport_issued_date = '2020-06-15',
        verification_status = 'VERIFIED',
        verified_at = '${new Date().toISOString()}',
        verified_by = 'usr_admin'
      WHERE id = 'usr_craftsman';

      UPDATE users SET 
        passport_series = 'AB',
        passport_number = '1234987',
        pinfl = '42508859876543',
        full_legal_name = 'Xalimov Alisher Narzullayevich',
        birth_date = '1985-08-25',
        passport_issued_by = 'Yunusobod tumani IIB FMB',
        passport_issued_date = '2019-11-20',
        verification_status = 'VERIFIED',
        verified_at = '${new Date().toISOString()}',
        verified_by = 'usr_admin'
      WHERE id = 'usr_admin';

      UPDATE users SET 
        passport_series = 'AC',
        passport_number = '9876543',
        pinfl = '51509934567890',
        full_legal_name = 'Azizova Malika Sherzod qizi',
        birth_date = '1993-09-15',
        passport_issued_by = 'Mirzo Ulug‘bek tumani IIB FMB',
        passport_issued_date = '2021-04-10',
        verification_status = 'PENDING',
        verification_requested_at = '${new Date().toISOString()}'
      WHERE id = 'usr_seeker';
    `);
  } catch (err) {
    console.warn('Could not update sample passport data:', err);
  }

  // Ensure reviews exist if empty
  try {
    const revCheck = db.exec('SELECT COUNT(*) as count FROM reviews');
    const revCount = revCheck[0]?.values[0]?.[0] || 0;
    if (revCount === 0) {
      const seedReviews = [
        {
          id: 'rev_1',
          author_user_id: 'usr_seeker',
          target_user_id: 'usr_company_owner',
          listing_id: 'lst_bunyodkor_smetachi',
          rating: 5,
          comment: "Kompaniya rahbariyati juda xushmuomala. Suhbat professional darajada o'tdi, sharoitlar va oylik maosh o'z vaqtida ta'minlanadi. Tavsiya qilaman!",
          employer_reply: "Rahmat Malika! Jamoamizda siz kabi o'z ishining ustalarini ko'rishdan doim mamnunmiz.",
          employer_reply_at: new Date(Date.now() - 3600 * 24 * 1000).toISOString(),
          created_at: new Date(Date.now() - 3600 * 48 * 1000).toISOString(),
        },
        {
          id: 'rev_2',
          author_user_id: 'usr_requester',
          target_user_id: 'usr_company_owner',
          listing_id: 'lst_kunuz_reporter',
          rating: 5,
          comment: "O'zbekistondagi eng yaxshi va nufuzli tahririyatlardan biri. Hamma narsa shartnoma asosida halol yuritiladi.",
          employer_reply: null,
          employer_reply_at: null,
          created_at: new Date(Date.now() - 3600 * 72 * 1000).toISOString(),
        },
        {
          id: 'rev_3',
          author_user_id: 'usr_requester',
          target_user_id: 'usr_craftsman',
          listing_id: 'lst_santexnik_usta',
          rating: 5,
          comment: "Usta Bahromjon kelib, vannadagi quvurni yarim soatda ta'mirlab berdi. Narxi ham juda insofli bo'ldi, rahmat!",
          employer_reply: "Salomat bo'ling, har doim xizmatingizdamiz!",
          employer_reply_at: new Date(Date.now() - 3600 * 12 * 1000).toISOString(),
          created_at: new Date(Date.now() - 3600 * 36 * 1000).toISOString(),
        },
        {
          id: 'rev_4',
          author_user_id: 'usr_seeker',
          target_user_id: 'usr_craftsman',
          listing_id: 'lst_santexnik_usta',
          rating: 4,
          comment: "Ish sifatli bajarildi, ozgina kechikib kelishdi lekin ishiga gap yo'q.",
          employer_reply: null,
          employer_reply_at: null,
          created_at: new Date(Date.now() - 3600 * 96 * 1000).toISOString(),
        },
        {
          id: 'rev_5',
          author_user_id: 'usr_company_owner',
          target_user_id: 'usr_seeker',
          listing_id: 'lst_frontend_malika',
          rating: 5,
          comment: "Malika loyihamizning frontend qismini belgilangan muddatda a'lo darajada topshirdi. Juda mas'uliyatli mutaxassis.",
          employer_reply: "Katta rahmat! Hamkorlikdan juda mamnun bo'ldim.",
          employer_reply_at: new Date(Date.now() - 3600 * 15 * 1000).toISOString(),
          created_at: new Date(Date.now() - 3600 * 60 * 1000).toISOString(),
        },
      ];

      for (const r of seedReviews) {
        db.run(
          `INSERT INTO reviews (id, author_user_id, target_user_id, listing_id, rating, comment, employer_reply, employer_reply_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.author_user_id, r.target_user_id, r.listing_id, r.rating, r.comment, r.employer_reply, r.employer_reply_at, r.created_at, r.created_at]
        );
      }
    }
  } catch (err) {
    console.warn('Could not seed reviews:', err);
  }

  persistDb();
  console.log('TopHand relational database schema initialized successfully.');
}

async function seedInitialData(db: any) {
  // Check if regions already exist
  const res = db.exec('SELECT COUNT(*) as count FROM regions');
  const count = res[0]?.values[0]?.[0] || 0;
  if (count > 0) {
    return; // Already seeded
  }

  console.log('Seeding initial TopHand Uzbekistan data...');

  // 1. Regions of Uzbekistan
  const regions = [
    { id: 'reg_tashkent_city', name_uz: 'Toshkent shahri', code: 'TAS_CITY', sort_order: 1 },
    { id: 'reg_tashkent_vil', name_uz: 'Toshkent viloyati', code: 'TAS_VIL', sort_order: 2 },
    { id: 'reg_samarkand', name_uz: 'Samarqand viloyati', code: 'SAM', sort_order: 3 },
    { id: 'reg_bukhara', name_uz: 'Buxoro viloyati', code: 'BUX', sort_order: 4 },
    { id: 'reg_andijan', name_uz: 'Andijon viloyati', code: 'AND', sort_order: 5 },
    { id: 'reg_fergana', name_uz: "Farg'ona viloyati", code: 'FER', sort_order: 6 },
    { id: 'reg_namangan', name_uz: 'Namangan viloyati', code: 'NAM', sort_order: 7 },
    { id: 'reg_kashkadarya', name_uz: 'Qashqadaryo viloyati', code: 'QAS', sort_order: 8 },
    { id: 'reg_surkhandarya', name_uz: 'Surxondaryo viloyati', code: 'SUR', sort_order: 9 },
    { id: 'reg_khorezm', name_uz: 'Xorazm viloyati', code: 'XOR', sort_order: 10 },
    { id: 'reg_navoiy', name_uz: 'Navoiy viloyati', code: 'NAV', sort_order: 11 },
    { id: 'reg_jizzakh', name_uz: 'Jizzax viloyati', code: 'JIZ', sort_order: 12 },
    { id: 'reg_sirdaryo', name_uz: 'Sirdaryo viloyati', code: 'SIR', sort_order: 13 },
    { id: 'reg_karakalpakstan', name_uz: "Qoraqalpog'iston Respublikasi", code: 'QOR', sort_order: 14 },
  ];

  for (const r of regions) {
    db.run('INSERT INTO regions (id, name_uz, code, sort_order) VALUES (?, ?, ?, ?)', [
      r.id, r.name_uz, r.code, r.sort_order
    ]);
  }

  // 2. Districts with coordinates
  const districts = [
    // Tashkent City
    { id: 'dis_yunusobod', region_id: 'reg_tashkent_city', name_uz: 'Yunusobod tumani', lat: 41.3644, lng: 69.2897, sort: 1 },
    { id: 'dis_chilonzor', region_id: 'reg_tashkent_city', name_uz: 'Chilonzor tumani', lat: 41.2721, lng: 69.2045, sort: 2 },
    { id: 'dis_mirzo_ulugbek', region_id: 'reg_tashkent_city', name_uz: "Mirzo Ulug'bek tumani", lat: 41.3385, lng: 69.3346, sort: 3 },
    { id: 'dis_mirobod', region_id: 'reg_tashkent_city', name_uz: 'Mirobod tumani', lat: 41.2858, lng: 69.2777, sort: 4 },
    { id: 'dis_yakkasaroy', region_id: 'reg_tashkent_city', name_uz: 'Yakkasaroy tumani', lat: 41.2798, lng: 69.2483, sort: 5 },
    { id: 'dis_shayxontohur', region_id: 'reg_tashkent_city', name_uz: 'Shayxontohur tumani', lat: 41.3218, lng: 69.2392, sort: 6 },
    { id: 'dis_olmazor', region_id: 'reg_tashkent_city', name_uz: 'Olmazor tumani', lat: 41.3533, lng: 69.2275, sort: 7 },
    { id: 'dis_sergeli', region_id: 'reg_tashkent_city', name_uz: 'Sergeli tumani', lat: 41.2234, lng: 69.2210, sort: 8 },
    { id: 'dis_uchtepa', region_id: 'reg_tashkent_city', name_uz: 'Uchtepa tumani', lat: 41.2982, lng: 69.1764, sort: 9 },
    { id: 'dis_yashnobod', region_id: 'reg_tashkent_city', name_uz: 'Yashnobod tumani', lat: 41.2941, lng: 69.3382, sort: 10 },
    { id: 'dis_bektemir', region_id: 'reg_tashkent_city', name_uz: 'Bektemir tumani', lat: 41.2052, lng: 69.3342, sort: 11 },
    { id: 'dis_yangihayot', region_id: 'reg_tashkent_city', name_uz: 'Yangihayot tumani', lat: 41.2012, lng: 69.1954, sort: 12 },

    // Samarkand
    { id: 'dis_sam_shahar', region_id: 'reg_samarkand', name_uz: 'Samarqand shahri', lat: 39.6542, lng: 66.9597, sort: 1 },
    { id: 'dis_sam_urgut', region_id: 'reg_samarkand', name_uz: 'Urgut tumani', lat: 39.4042, lng: 67.2431, sort: 2 },
    { id: 'dis_sam_pastdargom', region_id: 'reg_samarkand', name_uz: "Pastdarg'om tumani", lat: 39.6894, lng: 66.6914, sort: 3 },

    // Bukhara
    { id: 'dis_bux_shahar', region_id: 'reg_bukhara', name_uz: 'Buxoro shahri', lat: 39.7747, lng: 64.4286, sort: 1 },
    { id: 'dis_bux_gijduvon', region_id: 'reg_bukhara', name_uz: "G'ijduvon tumani", lat: 40.1006, lng: 64.6739, sort: 2 },

    // Andijan
    { id: 'dis_and_shahar', region_id: 'reg_andijan', name_uz: 'Andijon shahri', lat: 40.7821, lng: 72.3442, sort: 1 },
    { id: 'dis_and_asaka', region_id: 'reg_andijan', name_uz: 'Asaka tumani', lat: 40.6417, lng: 72.2389, sort: 2 },

    // Fergana
    { id: 'dis_fer_shahar', region_id: 'reg_fergana', name_uz: "Farg'ona shahri", lat: 40.3842, lng: 71.7843, sort: 1 },
    { id: 'dis_fer_quva', region_id: 'reg_fergana', name_uz: 'Quva tumani', lat: 40.5236, lng: 72.0736, sort: 2 },
    { id: 'dis_fer_qoqon', region_id: 'reg_fergana', name_uz: "Qo'qon shahri", lat: 40.5286, lng: 70.9425, sort: 3 },
  ];

  for (const d of districts) {
    db.run(
      'INSERT INTO districts (id, region_id, name_uz, latitude, longitude, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [d.id, d.region_id, d.name_uz, d.lat, d.lng, d.sort]
    );
  }

  // 3. Categories
  const now = new Date().toISOString();
  const categories = [
    { id: 'cat_santexnika', name_uz: 'Santexnika', slug: 'santexnika', icon: 'Wrench', sort: 1 },
    { id: 'cat_elektrik', name_uz: 'Elektrik', slug: 'elektrik', icon: 'Zap', sort: 2 },
    { id: 'cat_qurilish', name_uz: 'Qurilish & Ta’mirlash', slug: 'qurilish', icon: 'Hammer', sort: 3 },
    { id: 'cat_it_dasturlash', name_uz: 'IT & Dasturlash', slug: 'it-dasturlash', icon: 'Code', sort: 4 },
    { id: 'cat_dizayn', name_uz: 'Dizayn & Ijod', slug: 'dizayn', icon: 'Palette', sort: 5 },
    { id: 'cat_talim', name_uz: 'Ta’lim & Repetitorlik', slug: 'talim', icon: 'GraduationCap', sort: 6 },
    { id: 'cat_transport', name_uz: 'Transport & Logistika', slug: 'transport', icon: 'Truck', sort: 7 },
    { id: 'cat_tozalash', name_uz: 'Tozalash (Klining)', slug: 'tozalash', icon: 'Sparkles', sort: 8 },
    { id: 'cat_gozallik', name_uz: 'Go‘zallik & Salomatlik', slug: 'gozallik', icon: 'HeartPulse', sort: 9 },
    { id: 'cat_media', name_uz: 'OAV & Media', slug: 'media', icon: 'Camera', sort: 10 },
    { id: 'cat_savdo', name_uz: 'Savdo & Mijozlar', slug: 'savdo', icon: 'ShoppingBag', sort: 11 },
    { id: 'cat_oshpazlik', name_uz: 'Oshpazlik & Restoran', slug: 'oshpazlik', icon: 'UtensilsCrossed', sort: 12 },
    { id: 'cat_avto', name_uz: 'Avto ta’mirlash', slug: 'avto', icon: 'Car', sort: 13 },
    { id: 'cat_boshqa', name_uz: 'Boshqa xizmatlar', slug: 'boshqa', icon: 'MoreHorizontal', sort: 14 },
  ];

  for (const c of categories) {
    db.run(
      'INSERT INTO categories (id, name_uz, slug, icon, is_active, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
      [c.id, c.name_uz, c.slug, c.icon, c.sort, now, now]
    );
  }

  // 4. Seed Users
  const users = [
    {
      id: 'usr_admin',
      telegram_id: '10000001',
      telegram_username: 'alisher_admin',
      name: 'Alisher Qodirov',
      profile_photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
      phone: '+998901234567',
      bio: "TopHand Bosh administratori. Platforma tartibi, xavfsizligi va moderatsiyasini nazorat qilaman.",
      region_id: 'reg_tashkent_city',
      district_id: 'dis_mirobod',
      lat: 41.2858,
      lng: 69.2777,
      role: 'ADMIN',
    },
    {
      id: 'usr_moderator',
      telegram_id: '10000002',
      telegram_username: 'dilnoza_mod',
      name: 'Dilnoza Rahimova',
      profile_photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&auto=format&fit=crop&q=80',
      phone: '+998939876543',
      bio: "TopHand moderatori. E'lonlar sifati, shikoyatlar va foydalanuvchilar murojaatlarini o'rganaman.",
      region_id: 'reg_tashkent_city',
      district_id: 'dis_yunusobod',
      lat: 41.3644,
      lng: 69.2897,
      role: 'MODERATOR',
    },
    {
      id: 'usr_craftsman',
      telegram_id: '10000003',
      telegram_username: 'bahrom_usta',
      name: 'Bahrom Usta',
      profile_photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
      phone: '+998971112233',
      bio: "12 yillik tajribaga ega professional santexnik va isitish tizimlari ustasi. Kafolat bilan sifatli xizmat ko'rsataman.",
      region_id: 'reg_tashkent_city',
      district_id: 'dis_chilonzor',
      lat: 41.2721,
      lng: 69.2045,
      role: 'USER',
    },
    {
      id: 'usr_seeker',
      telegram_id: '10000004',
      telegram_username: 'malika_dev',
      name: 'Malika Karimova',
      profile_photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&auto=format&fit=crop&q=80',
      phone: '+998993334455',
      bio: "Middle+ Frontend Developer (React, Next.js, TypeScript). 3 yillik tajriba. Masofaviy yoki Toshkentda ofisda ishlashga tayyorman.",
      region_id: 'reg_tashkent_city',
      district_id: 'dis_mirzo_ulugbek',
      lat: 41.3385,
      lng: 69.3346,
      role: 'USER',
    },
    {
      id: 'usr_company_owner',
      telegram_id: '10000005',
      telegram_username: 'kunuz_hr',
      name: 'Sardor Rahmonov',
      profile_photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&auto=format&fit=crop&q=80',
      phone: '+998915556677',
      bio: "Kun.uz Media Axborot Agentligi kadrlar bo'limi rahbari. Biz iqtidorli jurnalistlar va muharrirlarni qidirmoqdamiz.",
      region_id: 'reg_tashkent_city',
      district_id: 'dis_shayxontohur',
      lat: 41.3218,
      lng: 69.2392,
      role: 'USER',
    },
    {
      id: 'usr_requester',
      telegram_id: '10000006',
      telegram_username: 'javokhir_o',
      name: 'Javohir Otajonov',
      profile_photo_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160&auto=format&fit=crop&q=80',
      phone: '+998947778899',
      bio: "Toshkentda yashayman. Uy-ro'zg'or va loyihalar uchun ishonchli mutaxassislarni qidiraman.",
      region_id: 'reg_tashkent_city',
      district_id: 'dis_chilonzor',
      lat: 41.2721,
      lng: 69.2045,
      role: 'USER',
    },
  ];

  for (const u of users) {
    db.run(
      `INSERT INTO users (id, telegram_id, telegram_username, name, profile_photo_url, phone, bio, region_id, district_id, latitude, longitude, role, is_banned, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [u.id, u.telegram_id, u.telegram_username, u.name, u.profile_photo_url, u.phone, u.bio, u.region_id, u.district_id, u.lat, u.lng, u.role, now, now]
    );
  }

  // 5. Seed Organizations
  const orgs = [
    {
      id: 'org_kunuz',
      name: 'Kun.uz Media Axborot Agentligi',
      logo_url: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=160&auto=format&fit=crop&q=80',
      description: "O'zbekistondagi yetakchi mustaqil internet-nashri va multimediya axborot kompaniyasi.",
      phone: '+998712001122',
      website: 'https://kun.uz',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_shayxontohur',
      address: 'Navoiy ko‘chasi, 30-uy',
      owner_user_id: 'usr_company_owner',
      verification_status: 'VERIFIED',
      verified_by: 'usr_admin',
    },
    {
      id: 'org_bunyodkor',
      name: 'Bunyodkor Qurilish MCHJ',
      logo_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f?w=160&auto=format&fit=crop&q=80',
      description: "Zamonaviy turar-joy va tijorat binolari qurilishi hamda kapital rekonstruksiya.",
      phone: '+998712003344',
      website: 'https://bunyodkor-qurilish.uz',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_mirobod',
      address: 'Amir Temur shoh ko‘chasi, 45-uy',
      owner_user_id: 'usr_company_owner',
      verification_status: 'UNVERIFIED',
      verified_by: null,
    },
  ];

  for (const o of orgs) {
    db.run(
      `INSERT INTO organizations (id, name, logo_url, description, phone, website, region_id, district_id, address, owner_user_id, verification_status, verified_at, verified_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [o.id, o.name, o.logo_url, o.description, o.phone, o.website, o.region_id, o.district_id, o.address, o.owner_user_id, o.verification_status, o.verification_status === 'VERIFIED' ? now : null, o.verified_by, now, now]
    );

    // Organization member owner
    db.run(
      `INSERT INTO organization_members (id, organization_id, user_id, role, created_at) VALUES (?, ?, ?, 'OWNER', ?)`,
      [`mem_${o.id}_${o.owner_user_id}`, o.id, o.owner_user_id, now]
    );
  }

  // 6. Seed Listings (Four primary listing types)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const sampleListings = [
    // 1. SERVICE_OFFER
    {
      id: 'lst_santexnik_usta',
      owner_user_id: 'usr_craftsman',
      organization_id: null,
      type: 'SERVICE_OFFER',
      title: "Professional santexnika va isitish tizimlari ustasi (12 yillik tajriba)",
      description: "Assalomu alaykum! Men 12 yillik tajribaga ega usta Bahromman. Xonadonlar, yangi qurilgan uylar va ofislar uchun barcha turdagi santexnika xizmatlarini kafolat bilan amalga oshiraman.\n\nKo'rsatiladigan xizmatlar:\n- Quvurlarni almashtirish va yangidan o'tkazish (ekoplast, metalloplastik)\n- Dush kabinalari, vanna, unitaz, rakovina o'rnatish va ta'mirlash\n- Isitish tizimlari (tyopliy pol, radiatorlar) montaji va sozlash\n- Suv nasoslari va filtrlarni o'rnatish\n\nNarxlar ish hajmiga qarab kelishiladi, boshlang'ich narx 100 000 UZS dan.",
      category_id: 'cat_santexnika',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_chilonzor',
      lat: 41.2721,
      lng: 69.2045,
      price_type: 'FROM',
      price_min: 100000,
      price_max: null,
      currency: 'UZS',
      salary_type: null,
      salary_min: null,
      salary_max: null,
      work_format: 'ONSITE',
      experience_level: '12 yil',
      skills: JSON.stringify(['Santexnika montaj', 'Tyopliy pol', 'Payka ekoplast', 'Nasoslar']),
      contact_time: 'ANY_TIME',
      contact_custom_text: null,
      images: [
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&auto=format&fit=crop&q=80',
      ],
    },

    // 2. SERVICE_OFFER
    {
      id: 'lst_klining_xizmati',
      owner_user_id: 'usr_craftsman',
      organization_id: null,
      type: 'SERVICE_OFFER',
      title: "Kvartira, hovli va ofislar uchun chuqur tozalash (Klining)",
      description: "Ta'mirdan keyingi va kunlik professional tozalash xizmati. Germaniya uskunalari va ekologik toza yuvish vositalaridan foydalanamiz. Pol, derazalar, qattiq mebellarni tozalash.\n\nNarx: 150 000 UZS dan 500 000 UZS gacha (kvadrat metrga qarab).",
      category_id: 'cat_tozalash',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_yunusobod',
      lat: 41.3644,
      lng: 69.2897,
      price_type: 'RANGE',
      price_min: 150000,
      price_max: 500000,
      currency: 'UZS',
      salary_type: null,
      salary_min: null,
      salary_max: null,
      work_format: 'ONSITE',
      experience_level: '5 yil',
      skills: JSON.stringify(['Klining', 'Kimyoviy tozalash', 'Ta\'mirdan keyingi tozalash']),
      contact_time: 'MORNING',
      contact_custom_text: 'Soat 09:00 dan 18:00 gacha',
      images: [
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&auto=format&fit=crop&q=80',
      ],
    },

    // 3. SERVICE_REQUEST
    {
      id: 'lst_quvur_yorildi',
      owner_user_id: 'usr_requester',
      organization_id: null,
      type: 'SERVICE_REQUEST',
      title: "Suv quvuri oqayapti, shoshilinch santexnik kerak (Chilonzor-9)",
      description: "Oshxonadagi rakovina ostidagi quvurdan suv sizib chiqmoqda. Zudlik bilan kelib yangi shlang yoki ulanmani almashtirib bera oladigan usta qidiryapman. Byudjet: 200 000 UZS.",
      category_id: 'cat_santexnika',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_chilonzor',
      lat: 41.2721,
      lng: 69.2045,
      price_type: 'FIXED',
      price_min: 200000,
      price_max: 200000,
      currency: 'UZS',
      salary_type: null,
      salary_min: null,
      salary_max: null,
      work_format: 'ONSITE',
      experience_level: null,
      skills: JSON.stringify(['Tezkor ta\'mirlash', 'Shlang almashtirish']),
      contact_time: 'ANY_TIME',
      contact_custom_text: null,
      images: [
        'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&auto=format&fit=crop&q=80',
      ],
    },

    // 4. SERVICE_REQUEST
    {
      id: 'lst_elektromontaj_kerak',
      owner_user_id: 'usr_requester',
      organization_id: null,
      type: 'SERVICE_REQUEST',
      title: "Yangi 3 xonali kvartiraga to'liq elektr simlari montaji kerak",
      description: "Novostroykada elektr loyihasi tayyor. Avtomatlar, rozetkalar, lyustralar va umumiy simlarni qoidalar asosida o'tkazish kerak. Sifatli va tezkor ishlaydigan brigada yoki usta takliflarini kutaman. Byudjet: kelishiladi.",
      category_id: 'cat_elektrik',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_yakkasaroy',
      lat: 41.2798,
      lng: 69.2483,
      price_type: 'NEGOTIABLE',
      price_min: null,
      price_max: null,
      currency: 'UZS',
      salary_type: null,
      salary_min: null,
      salary_max: null,
      work_format: 'ONSITE',
      experience_level: null,
      skills: JSON.stringify(['Elektromontaj', 'Shchit yig\'ish', 'Razvodka']),
      contact_time: 'EVENING',
      contact_custom_text: 'Kechki 18:00 dan keyin',
      images: [
        'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&auto=format&fit=crop&q=80',
      ],
    },

    // 5. JOB_OPENING
    {
      id: 'lst_kunuz_reporter',
      owner_user_id: 'usr_company_owner',
      organization_id: 'org_kunuz',
      type: 'JOB_OPENING',
      title: "Kun.uz — Iqtisodiyot va biznes bo'yicha mustaqil muxbir/jurnalist",
      description: "Kun.uz tahririyati o'z jamoasiga tahliliy maqolalar, intervyular va reportajlar tayyorlay oladigan professional jurnalistni taklif etadi.\n\nTalablar:\n- O'zbek tilida savodli va ta'sirchan yozish qobiliyati\n- Iqtisodiy jarayonlar, bozor va moliya sohasini tushunish\n- Manbalar bilan ishlash va faktcheking\n- Kamida 2 yillik media tajribasi\n\nSharoitlar:\n- Toshkent markazidagi zamonaviy ofis\n- Qulay mehnat sharoiti va do'stona muhit\n- Oylik maosh: 8 000 000 – 12 000 000 UZS / oy",
      category_id: 'cat_media',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_shayxontohur',
      lat: 41.3218,
      lng: 69.2392,
      price_type: 'RANGE',
      price_min: null,
      price_max: null,
      currency: 'UZS',
      salary_type: 'SALARY_RANGE',
      salary_min: 8000000,
      salary_max: 12000000,
      work_format: 'HYBRID',
      experience_level: '2+ yil',
      skills: JSON.stringify(['Jurnalistika', 'Iqtisodiy tahlil', 'Intervyu', 'Faktcheking']),
      contact_time: 'ANY_TIME',
      contact_custom_text: null,
      images: [
        'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?w=800&auto=format&fit=crop&q=80',
      ],
    },

    // 6. JOB_OPENING
    {
      id: 'lst_bunyodkor_smetachi',
      owner_user_id: 'usr_company_owner',
      organization_id: 'org_bunyodkor',
      type: 'JOB_OPENING',
      title: "Bosh smetachi muhandis (Qurilish sohasida)",
      description: "Bunyodkor Qurilish kompaniyasiga yangi turar-joy loyihalarining smeta hujjatlarini ishlab chiqish va nazorat qilish uchun tajribali bosh smetachi kerak.\n\nTalablar:\n- Oliy muhandislik/qurilish ma'lumoti\n- Smeta dasturlari (Smeta.RU, GrandSmeta yoki AvtoSmeta)da mukammal ishlash\n- SNiP va qurilish me'yorlarini bilish\n- Maosh: 10 000 000 UZS qat'iy",
      category_id: 'cat_qurilish',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_mirobod',
      lat: 41.2858,
      lng: 69.2777,
      price_type: 'FIXED',
      price_min: null,
      price_max: null,
      currency: 'UZS',
      salary_type: 'SALARY_FIXED',
      salary_min: 10000000,
      salary_max: 10000000,
      work_format: 'ONSITE',
      experience_level: '3+ yil',
      skills: JSON.stringify(['Smeta tuzish', 'GrandSmeta', 'SNiP', 'Qurilish nazorati']),
      contact_time: 'MORNING',
      contact_custom_text: 'Dushanba-Juma 09:00 - 18:00',
      images: [
        'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&auto=format&fit=crop&q=80',
      ],
    },

    // 7. JOB_SEEKER
    {
      id: 'lst_frontend_malika',
      owner_user_id: 'usr_seeker',
      organization_id: null,
      type: 'JOB_SEEKER',
      title: "Senior Frontend Developer (React, Next.js, TypeScript)",
      description: "Salom! Men Malika Karimovaman. 4 yildan beri zamonaviy veb-ilovalarni ishlab chiqish bilan shug'ullanaman. Fintech, marketplace va SaaS loyihalarda muvaffaqiyatli qatnashganman.\n\nTexnologiyalar:\n- TypeScript, React 18+, Next.js (App Router)\n- Tailwind CSS, Shadcn UI, Framer Motion\n- Redux Toolkit, Zustand, React Query\n- REST API, WebSocket integratsiyasi\n- Git, Docker, Jest/Vitest\n\nKutilayotgan oylik maosh: 15 000 000 UZS dan. Toshkentda ofis yoki masofaviy ishlash formatini ko'rib chiqaman.",
      category_id: 'cat_it_dasturlash',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_mirzo_ulugbek',
      lat: 41.3385,
      lng: 69.3346,
      price_type: 'FROM',
      price_min: null,
      price_max: null,
      currency: 'UZS',
      salary_type: 'SALARY_RANGE',
      salary_min: 15000000,
      salary_max: 22000000,
      work_format: 'REMOTE',
      experience_level: '4 yil',
      skills: JSON.stringify(['React', 'TypeScript', 'Next.js', 'TailwindCSS', 'Redux']),
      contact_time: 'ANY_TIME',
      contact_custom_text: null,
      images: [
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&auto=format&fit=crop&q=80',
      ],
    },

    // 8. JOB_SEEKER
    {
      id: 'lst_buxgalter_seeker',
      owner_user_id: 'usr_craftsman',
      organization_id: null,
      type: 'JOB_SEEKER',
      title: "Bosh buxgalter (1C 8.3, soliq hisobotlari, eksport-import)",
      description: "Kichik va o'rta biznes korxonalari uchun to'liq buxgalteriya hisobini yuritish. Soliq hisobotlarini o'z vaqtida topshirish, xodimlarga oylik hisoblash, Didox va soliq kabineti bilan mukammal ishlash.\n\nKutilayotgan maosh: 7 000 000 UZS / oy.",
      category_id: 'cat_savdo',
      region_id: 'reg_tashkent_city',
      district_id: 'dis_chilonzor',
      lat: 41.2721,
      lng: 69.2045,
      price_type: 'FIXED',
      price_min: null,
      price_max: null,
      currency: 'UZS',
      salary_type: 'SALARY_FIXED',
      salary_min: 7000000,
      salary_max: 7000000,
      work_format: 'HYBRID',
      experience_level: '7 yil',
      skills: JSON.stringify(['1C 8.3', 'Soliq hisoboti', 'Didox', 'Buxgalteriya']),
      contact_time: 'MORNING',
      contact_custom_text: null,
      images: [
        'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
      ],
    },
  ];

  for (const l of sampleListings) {
    db.run(
      `INSERT INTO listings (
        id, owner_user_id, organization_id, type, title, description, category_id,
        region_id, district_id, latitude, longitude, price_type, price_min, price_max,
        currency, salary_type, salary_min, salary_max, work_format, experience_level,
        skills, contact_time, contact_custom_text, status, created_at, updated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [
        l.id, l.owner_user_id, l.organization_id, l.type, l.title, l.description, l.category_id,
        l.region_id, l.district_id, l.lat, l.lng, l.price_type, l.price_min, l.price_max,
        l.currency, l.salary_type, l.salary_min, l.salary_max, l.work_format, l.experience_level,
        l.skills, l.contact_time, l.contact_custom_text, now, now, expiresAt
      ]
    );

    // Images
    for (let i = 0; i < l.images.length; i++) {
      db.run(
        `INSERT INTO listing_images (id, listing_id, url, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
        [`img_${l.id}_${i}`, l.id, l.images[i], i, now]
      );
    }
  }

  // 7. Seed Follow
  // Javohir Otajonov follows Bahrom Usta
  db.run(`INSERT INTO follows (id, follower_user_id, followed_user_id, created_at) VALUES (?, ?, ?, ?)`, [
    'fol_jav_bahrom', 'usr_requester', 'usr_craftsman', now
  ]);

  // 8. Seed Saved Listing
  // Javohir saved Bahrom's listing
  db.run(`INSERT INTO saved_listings (id, user_id, listing_id, created_at) VALUES (?, ?, ?, ?)`, [
    'sav_1', 'usr_requester', 'lst_santexnik_usta', now
  ]);

  // 9. Seed Conversation & Messages
  const convId = 'conv_quvur_tamiri';
  db.run(
    `INSERT INTO conversations (id, listing_id, initiator_user_id, recipient_user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [convId, 'lst_santexnik_usta', 'usr_requester', 'usr_craftsman', now, now]
  );

  db.run(
    `INSERT INTO messages (id, conversation_id, sender_user_id, message_type, text, created_at, read_at)
     VALUES (?, ?, ?, 'TEXT', ?, ?, ?)`,
    ['msg_1', convId, 'usr_requester', "Assalomu alaykum, Bahrom aka! Oshxonadagi rakovina ostidagi quvur oqayotgan edi. Bugun kelib ko'rib bera olasizmi?", now, now]
  );

  db.run(
    `INSERT INTO messages (id, conversation_id, sender_user_id, message_type, text, created_at, read_at)
     VALUES (?, ?, ?, 'TEXT', ?, ?, ?)`,
    ['msg_2', convId, 'usr_craftsman', "Va alaykum assalom! Ha, soat 16:00 larda Chilonzor tomonlardaman, kelib qarab beraman. Manzilni yozib yuborsangiz.", now, null]
  );

  // 10. Seed Notifications
  db.run(
    `INSERT INTO notifications (id, user_id, type, title, body, link, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      'notif_1',
      'usr_craftsman',
      'NEW_CHAT_MESSAGE',
      'Yangi xabar keldi',
      'Javohir Otajonov sizning "Professional santexnika..." e\'loningiz bo\'yicha yozdi.',
      '/chat?conv=conv_quvur_tamiri',
      now
    ]
  );

  db.run(
    `INSERT INTO notifications (id, user_id, type, title, body, link, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      'notif_2',
      'usr_craftsman',
      'FOLLOW_ACTIVITY',
      'Yangi obunachi',
      'Javohir Otajonov sizning profilingizga obuna bo\'ldi.',
      '/profile/usr_requester',
      now
    ]
  );

  // 11. Seed Audit Log
  db.run(
    `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'audit_1',
      'usr_admin',
      'ORGANIZATION_VERIFIED',
      'ORGANIZATION',
      'org_kunuz',
      JSON.stringify({ reason: 'Rasmiy media guvohnomasi tekshirildi' }),
      now
    ]
  );

  // 12. Seed Reviews
  const reviewCountResult = db.exec('SELECT COUNT(*) as count FROM reviews');
  const reviewCount = reviewCountResult[0]?.values[0]?.[0] || 0;
  if (reviewCount === 0) {
    const seedReviews = [
      {
        id: 'rev_1',
        author_user_id: 'usr_seeker',
        target_user_id: 'usr_company_owner',
        listing_id: 'lst_bunyodkor_smetachi',
        rating: 5,
        comment: "Kompaniya rahbariyati juda xushmuomala. Suhbat professional darajada o'tdi, sharoitlar va oylik maosh o'z vaqtida ta'minlanadi. Tavsiya qilaman!",
        employer_reply: "Rahmat Malika! Jamoamizda siz kabi o'z ishining ustalarini ko'rishdan doim mamnunmiz.",
        employer_reply_at: new Date(Date.now() - 3600 * 24 * 1000).toISOString(),
        created_at: new Date(Date.now() - 3600 * 48 * 1000).toISOString(),
      },
      {
        id: 'rev_2',
        author_user_id: 'usr_requester',
        target_user_id: 'usr_company_owner',
        listing_id: 'lst_kunuz_reporter',
        rating: 5,
        comment: "O'zbekistondagi eng yaxshi va nufuzli tahririyatlardan biri. Hamma narsa shartnoma asosida halol yuritiladi.",
        employer_reply: null,
        employer_reply_at: null,
        created_at: new Date(Date.now() - 3600 * 72 * 1000).toISOString(),
      },
      {
        id: 'rev_3',
        author_user_id: 'usr_requester',
        target_user_id: 'usr_craftsman',
        listing_id: 'lst_santexnik_usta',
        rating: 5,
        comment: "Usta Bahromjon kelib, vannadagi quvurni yarim soatda ta'mirlab berdi. Narxi ham juda insofli bo'ldi, rahmat!",
        employer_reply: "Salomat bo'ling, har doim xizmatingizdamiz!",
        employer_reply_at: new Date(Date.now() - 3600 * 12 * 1000).toISOString(),
        created_at: new Date(Date.now() - 3600 * 36 * 1000).toISOString(),
      },
      {
        id: 'rev_4',
        author_user_id: 'usr_seeker',
        target_user_id: 'usr_craftsman',
        listing_id: 'lst_santexnik_usta',
        rating: 4,
        comment: "Ish sifatli bajarildi, ozgina kechikib kelishdi lekin ishiga gap yo'q.",
        employer_reply: null,
        employer_reply_at: null,
        created_at: new Date(Date.now() - 3600 * 96 * 1000).toISOString(),
      },
      {
        id: 'rev_5',
        author_user_id: 'usr_requester',
        target_user_id: 'usr_craftsman',
        listing_id: 'lst_klining_xizmati',
        rating: 5,
        comment: "Kvartirani tozalab berishdi, har bir burchak toza va xushbo'y bo'lib qoldi. A'lo xizmat!",
        employer_reply: "Rahmat sizga ham!",
        employer_reply_at: new Date(Date.now() - 3600 * 15 * 1000).toISOString(),
        created_at: new Date(Date.now() - 3600 * 60 * 1000).toISOString(),
      },
    ];

    for (const r of seedReviews) {
      db.run(
        `INSERT INTO reviews (id, author_user_id, target_user_id, listing_id, rating, comment, employer_reply, employer_reply_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.author_user_id, r.target_user_id, r.listing_id, r.rating, r.comment, r.employer_reply, r.employer_reply_at, r.created_at, r.created_at]
      );
    }
  }

  console.log('TopHand seed data initialized successfully.');
}
