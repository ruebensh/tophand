import crypto from 'crypto';
import { queryAll, queryOne, runQuery } from '../db/database.ts';
import {
  getMonetizationConfig,
  resolveActiveDays,
  getListingPrice,
  getRenewPrice,
  getPromoPrice,
} from './monetizationService.ts';
import { charge, refund } from './walletService.ts';
import { sanitizeUserUrlList } from '../lib/urlSecurity.ts';

/**
 * Admin / SUPER_ADMIN accounts are billing-exempt: they are never charged and
 * their wallet balance is never touched (all listing actions are free for them).
 */
async function isBillingExempt(userId: string): Promise<boolean> {
  const row = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = ?', [userId]);
  return row?.role === 'ADMIN' || row?.role === 'SUPER_ADMIN';
}

export interface ListingFilter {
  catalog_id?: string;
  type?: string;
  category_id?: string;
  region_id?: string;
  district_id?: string;
  keyword?: string;
  price_type?: string;
  price_min?: number;
  price_max?: number;
  salary_min?: number;
  salary_max?: number;
  work_format?: string;
  work_formats?: string[];
  experience?: string[];
  // Structured per-category attributes (Avito-style). String/bool/color values
  // are matched with JSONB containment (@>); numeric values with text equality.
  attributes?: Record<string, string | number | boolean>;
  sort_by?: string;
  user_lat?: number;
  user_lng?: number;
  max_distance_km?: number;
  only_followed?: boolean;
  page?: number;
  limit?: number;
  current_user_id?: string;
}

export function matchesExperience(itemExp: string | null | undefined, filterExp: string[]): boolean {
  if (!filterExp || filterExp.length === 0) return true;

  let years: number | null = null;
  if (itemExp) {
    const match = itemExp.match(/(\d+)/);
    if (match) {
      years = parseInt(match[1], 10);
    }
  }

  for (const exp of filterExp) {
    if (exp === 'none') {
      if (years === null || years === 0 || !itemExp || itemExp.toLowerCase().includes('tajribasiz')) {
        return true;
      }
    } else if (exp === '1-3') {
      if (years !== null && years >= 1 && years <= 3) return true;
    } else if (exp === '3-5') {
      if (years !== null && years >= 3 && years <= 5) return true;
    } else if (exp === '5+') {
      if (years !== null && years >= 5) return true;
    }
  }
  return false;
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function searchListings(filter: ListingFilter) {
  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(50, Math.max(1, filter.limit || 12));

  // Base query with joins
  let sql = `
    SELECT 
      l.*,
      u.name as owner_name,
      u.telegram_username as owner_username,
      u.profile_photo_url as owner_photo_url,
      u.bio as owner_bio,
      u.verification_status as owner_verification_status,
      u.role as owner_role,
      o.name as organization_name,
      o.logo_url as organization_logo_url,
      o.verification_status as organization_verification_status,
      c.name_uz as category_name,
      c.icon as category_icon,
      r.name_uz as region_name,
      d.name_uz as district_name,
      d.latitude,
      d.longitude
    FROM listings l
    JOIN users u ON l.owner_user_id = u.id
    LEFT JOIN organizations o ON l.organization_id = o.id
    JOIN categories c ON l.category_id = c.id
    JOIN regions r ON l.region_id = r.id
    JOIN districts d ON l.district_id = d.id
    WHERE l.status = 'ACTIVE'
  `;

  const params: any[] = [];

  if (filter.catalog_id) {
    // Match the denormalized catalog_id, with two robust fallbacks so listings
    // never silently disappear from a catalog:
    //  (a) legacy rows (catalog_id NULL) → fall back to the catalog's listing_types;
    //  (b) the listing's own category belongs to this catalog (authoritative). This
    //      rescues rows whose listings.catalog_id is NULL or inconsistent with the
    //      category's catalog — otherwise a matching listing gets dropped.
    sql += ` AND (
      l.catalog_id = ?
      OR (l.catalog_id IS NULL AND l.type IN (
        SELECT unnest(string_to_array((SELECT listing_types FROM catalogs WHERE id = ?), ','))
      ))
      OR l.category_id IN (SELECT id FROM categories WHERE catalog_id = ?)
    )`;
    params.push(filter.catalog_id, filter.catalog_id, filter.catalog_id);
  }

  if (filter.type) {
    sql += ` AND l.type = ?`;
    params.push(filter.type);
  }

  if (filter.category_id) {
    // Include the category AND all of its descendants at any depth (recursive),
    // so listings filed under a subcategory always surface on the parent page.
    sql += ` AND l.category_id IN (
      WITH RECURSIVE cat_sub(id) AS (
        SELECT ?::text
        UNION ALL
        SELECT c.id FROM categories c JOIN cat_sub s ON c.parent_id = s.id
      )
      SELECT id FROM cat_sub
    )`;
    params.push(filter.category_id);
  }

  if (filter.region_id) {
    sql += ` AND l.region_id = ?`;
    params.push(filter.region_id);
  }

  if (filter.district_id) {
    sql += ` AND l.district_id = ?`;
    params.push(filter.district_id);
  }

  if (filter.price_type) {
    sql += ` AND l.price_type = ?`;
    params.push(filter.price_type.toUpperCase());
  }

  if (filter.work_formats && filter.work_formats.length > 0) {
    const placeholders = filter.work_formats.map(() => '?').join(',');
    sql += ` AND UPPER(l.work_format) IN (${placeholders})`;
    params.push(...filter.work_formats.map((f) => f.toUpperCase()));
  } else if (filter.work_format) {
    sql += ` AND UPPER(l.work_format) = ?`;
    params.push(filter.work_format.toUpperCase());
  }

  if (filter.price_min !== undefined && !isNaN(filter.price_min)) {
    sql += ` AND (
      COALESCE(l.price_max, l.price_min, l.salary_max, l.salary_min) >= ?
    )`;
    params.push(filter.price_min);
  }

  if (filter.price_max !== undefined && !isNaN(filter.price_max)) {
    sql += ` AND (
      COALESCE(l.price_min, l.price_max, l.salary_min, l.salary_max) <= ?
    )`;
    params.push(filter.price_max);
  }

  if (filter.salary_min !== undefined && !isNaN(filter.salary_min)) {
    sql += ` AND (COALESCE(l.salary_max, l.salary_min) >= ?)`;
    params.push(filter.salary_min);
  }

  if (filter.salary_max !== undefined && !isNaN(filter.salary_max)) {
    sql += ` AND (COALESCE(l.salary_min, l.salary_max) <= ?)`;
    params.push(filter.salary_max);
  }

  // Structured attributes filter (JSONB).
  //   - Range: `key_from` / `key_to` → (attributes->>'key')::numeric >= / <= ?
  //   - Any-of (multiselect/chips): vergul bilan ajratilgan qiymat → IN (...) text match
  //   - Single string/bool/color → JSONB containment (@> — GIN index)
  //   - Single number → extracted-text equality
  if (filter.attributes) {
    const containment: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(filter.attributes)) {
      if (v === undefined || v === null || v === '') continue;
      const clean = k.replace(/[^a-zA-Z0-9_]/g, '');
      if (!clean) continue;

      // Range: `..._from` / `..._to` (qiymat son bo'lishi shart).
      if (/_from$/.test(clean)) {
        const base = clean.slice(0, -5);
        const num = typeof v === 'number' ? v : parseFloat(String(v));
        if (base && !isNaN(num)) {
          sql += ` AND (NULLIF(l.attributes->>'${base}', ''))::numeric >= ?`;
          params.push(num);
        }
        continue;
      }
      if (/_to$/.test(clean)) {
        const base = clean.slice(0, -3);
        const num = typeof v === 'number' ? v : parseFloat(String(v));
        if (base && !isNaN(num)) {
          sql += ` AND (NULLIF(l.attributes->>'${base}', ''))::numeric <= ?`;
          params.push(num);
        }
        continue;
      }

      // Any-of: bir nechta qiymat vergul bilan (multiselect/chips).
      if (typeof v === 'string' && v.includes(',')) {
        const vals = v.split(',').map((s) => s.trim()).filter(Boolean);
        if (vals.length > 0) {
          const ph = vals.map(() => '?').join(', ');
          sql += ` AND (l.attributes->>'${clean}') IN (${ph})`;
          params.push(...vals);
        }
        continue;
      }

      if (typeof v === 'number') {
        sql += ` AND (l.attributes->>'${clean}') = ?`;
        params.push(String(v));
      } else {
        containment[clean] = v;
      }
    }
    if (Object.keys(containment).length > 0) {
      sql += ` AND l.attributes @> ?::jsonb`;
      params.push(JSON.stringify(containment));
    }
  }

  if (filter.keyword && filter.keyword.trim().length > 0) {
    const term = `%${filter.keyword.trim().toLowerCase()}%`;
    sql += ` AND (
      LOWER(l.title) LIKE ? 
      OR LOWER(l.description) LIKE ? 
      OR LOWER(l.skills) LIKE ?
      OR LOWER(u.name) LIKE ?
      OR LOWER(COALESCE(o.name, '')) LIKE ?
      OR LOWER(c.name_uz) LIKE ?
      OR LOWER(r.name_uz) LIKE ?
      OR LOWER(d.name_uz) LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term, term);
  }

  let allMatching = await queryAll<any>(sql, params);

  // Filter by experience if provided
  if (filter.experience && filter.experience.length > 0) {
    allMatching = allMatching.filter((item) =>
      matchesExperience(item.experience_level, filter.experience!)
    );
  }

  // Fetch followed user IDs for current user
  let followedUserIds = new Set<string>();
  if (filter.current_user_id) {
    const follows = await queryAll<{ followed_user_id: string }>(
      'SELECT followed_user_id FROM follows WHERE follower_user_id = ?',
      [filter.current_user_id]
    );
    followedUserIds = new Set(follows.map((f) => f.followed_user_id));
  }

  // NOTE: listing images are fetched lazily AFTER pagination (see below), so a search
  // never loads media for every matching row — only for the returned page slice.

  // Fetch saved state for current user
  let savedListingIds = new Set<string>();
  if (filter.current_user_id) {
    const saved = await queryAll<{ listing_id: string }>(
      'SELECT listing_id FROM saved_listings WHERE user_id = ?',
      [filter.current_user_id]
    );
    savedListingIds = new Set(saved.map((s) => s.listing_id));
  }

  // Fetch employer ratings from actual submitted reviews — scoped to the owners that
  // appear in the result set (used by scoring and the rating_desc sort) instead of
  // aggregating the entire reviews table on every search.
  const ownerIds = Array.from(new Set(allMatching.map((l) => l.owner_user_id).filter(Boolean)));
  const employerRatingMap = new Map<string, { avg_rating: number; review_count: number }>();
  if (ownerIds.length > 0) {
    const ownerPh = ownerIds.map(() => '?').join(',');
    const employerRatings = await queryAll<{
      target_user_id: string;
      avg_rating: number;
      review_count: number;
    }>(
      `SELECT target_user_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(id) as review_count FROM reviews WHERE target_user_id IN (${ownerPh}) GROUP BY target_user_id`,
      ownerIds
    );
    for (const er of employerRatings) {
      employerRatingMap.set(er.target_user_id, {
        avg_rating: Number(er.avg_rating),
        review_count: Number(er.review_count),
      });
    }
  }

  // Calculate scores according to Section 22 & 23:
  // 1. Followed profiles (Priority 1: +10,000,000 points)
  // 2. Profile completeness (Priority 2: +1,000,000 points)
  //    Complete if: User has profile_photo_url AND meaningful bio (>= 20 chars), or Org has logo AND description.
  // 3. Geographic relevance (Priority 3: up to +100,000 points based on distance/district)
  // 4. Newest listing timestamp (Priority 4: timestamp in seconds)
  const scoredListings = allMatching.map((item) => {
    let score = 0;

    // Faza 8: promoted (paid) listings always surface on top
    const isPromoted = Boolean(item.promoted_until) && new Date(item.promoted_until).getTime() > Date.now();
    if (isPromoted) {
      score += 100_000_000;
    }

    // Follow priority
    const isFollowed = followedUserIds.has(item.owner_user_id);
    if (isFollowed) {
      score += 10_000_000;
    }

    // Profile completeness
    const isCompleteUser = Boolean(
      item.owner_photo_url && item.owner_bio && item.owner_bio.trim().length >= 15
    );
    const isCompleteOrg = Boolean(
      item.organization_id &&
        item.organization_logo_url &&
        item.organization_verification_status === 'VERIFIED'
    );
    const isComplete = isCompleteUser || isCompleteOrg;
    if (isComplete) {
      score += 1_000_000;
    }

    // Rasmiy tasdiq nishoni: faqat pasport/ID admin-moderator tomonidan
    // VERIFIED qilinganda (yoki tashkilot VERIFIED). Profil to'liqligiga emas.
    const isVerifiedUser = item.owner_verification_status === 'VERIFIED';
    const isVerifiedOrg = isCompleteOrg;
    const isVerified = isVerifiedUser || isVerifiedOrg;

    // Geographic relevance
    let distanceKm: number | null = null;
    if (filter.user_lat && filter.user_lng && item.latitude && item.longitude) {
      distanceKm = calculateDistanceKm(
        filter.user_lat,
        filter.user_lng,
        item.latitude,
        item.longitude
      );
      // Closer distance adds up to 100,000 points (decaying with distance)
      const geoScore = Math.max(0, 100_000 - Math.round(distanceKm * 2000));
      score += geoScore;
    } else if (filter.district_id && item.district_id === filter.district_id) {
      score += 80_000; // Same district bonus
    } else if (filter.region_id && item.region_id === filter.region_id) {
      score += 40_000; // Same region bonus
    }

    // Recency (use renewed_at or created_at)
    const activeDate = item.renewed_at ? new Date(item.renewed_at) : new Date(item.created_at);
    const recencySeconds = Math.floor(activeDate.getTime() / 1000);
    // Normalized to thousands so recent listings tie-break
    score += (recencySeconds % 100_000) / 10;

    const ratingStats = employerRatingMap.get(item.owner_user_id);

    return {
      ...item,
      images: [] as string[],
      is_saved: savedListingIds.has(item.id),
      is_followed: isFollowed,
      is_profile_complete: isComplete,
      is_verified: isVerified,
      distance_km: distanceKm ? Math.round(distanceKm * 10) / 10 : null,
      employer_rating: ratingStats?.avg_rating || null,
      employer_review_count: ratingStats?.review_count || 0,
      is_promoted: isPromoted,
      _ranking_score: score,
    };
  });

  // Filter by max distance if requested
  let filteredScored = scoredListings;
  if (filter.max_distance_km && filter.user_lat && filter.user_lng) {
    filteredScored = scoredListings.filter(
      (item) => item.distance_km !== null && item.distance_km <= filter.max_distance_km!
    );
  }

  // Filter by only followed if requested
  if (filter.only_followed && filter.current_user_id) {
    filteredScored = filteredScored.filter((item) => item.is_followed);
  }

  // Sorting:
  // Narx saralashi izchil komparator bilan (QA-02):
  //  - price_type='FREE' → 0 (eng arzon, ascending'da birinchi, descending'da oxirgi).
  //  - FIXED/FROM/RANGE → price_min (yo'q bo'lsa price_max), agar narx bo'sh bo'lsa
  //    salary_min → salary_max qadaridan ishlatamiz.
  //  - NEGOTIABLE / umuman son bermagan → null → QANDAY yo'nalishda bo'lmasin OXIRGA
  //    suriladi (shunda sonli narxlar tartibi buzilmaydi).
  const sortPriceOf = (item: any): number | null => {
    if (item.price_type === 'FREE') return 0;
    const raw = item.price_min ?? item.price_max ?? item.salary_min ?? item.salary_max ?? null;
    if (raw === null || raw === undefined || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  if (filter.sort_by === 'price_asc' || filter.sort_by === 'price_desc') {
    const dir = filter.sort_by === 'price_asc' ? 1 : -1;
    filteredScored.sort((a, b) => {
      const pa = sortPriceOf(a);
      const pb = sortPriceOf(b);
      // null (negotiable / no numeric price) har doim oxirga.
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return (pa - pb) * dir;
    });
  } else if (filter.sort_by === 'rating_desc') {
    filteredScored.sort((a, b) => (b.employer_rating || 0) - (a.employer_rating || 0));
  } else {
    // Default: Sort descending by _ranking_score
    filteredScored.sort((a, b) => b._ranking_score - a._ranking_score);
  }

  // Section 23: Feed Diversification (only when not explicitly sorting by price or rating)
  let finalItems: typeof filteredScored = [];
  if (filter.sort_by === 'price_asc' || filter.sort_by === 'price_desc' || filter.sort_by === 'rating_desc') {
    finalItems = filteredScored;
  } else {
    // Prevent any single owner from having consecutive cards
    const diversified: typeof filteredScored = [];
    const deferred: typeof filteredScored = [];

    for (const item of filteredScored) {
      const ownerKey = item.organization_id || item.owner_user_id;
      const lastItem = diversified[diversified.length - 1];
      const lastOwnerKey = lastItem ? lastItem.organization_id || lastItem.owner_user_id : null;

      if (lastOwnerKey === ownerKey) {
        deferred.push(item);
      } else {
        diversified.push(item);
        if (deferred.length > 0) {
          const nextDeferredIdx = deferred.findIndex(
            (d) => (d.organization_id || d.owner_user_id) !== ownerKey
          );
          if (nextDeferredIdx >= 0) {
            const [popped] = deferred.splice(nextDeferredIdx, 1);
            diversified.push(popped);
          }
        }
      }
    }
    diversified.push(...deferred);
    finalItems = diversified;
  }

  // Pagination slice
  const total = finalItems.length;
  const startIndex = (page - 1) * limit;
  const paginatedItems = finalItems.slice(startIndex, startIndex + limit);

  // Fetch images only for the returned page slice (not the entire result set).
  const pageIds = paginatedItems.map((i) => i.id);
  if (pageIds.length > 0) {
    const placeholders = pageIds.map(() => '?').join(',');
    const images = await queryAll<{ listing_id: string; url: string }>(
      `SELECT listing_id, url FROM listing_images WHERE listing_id IN (${placeholders}) ORDER BY sort_order ASC`,
      pageIds
    );
    const imagesByListingId: Record<string, string[]> = {};
    for (const img of images) {
      if (!imagesByListingId[img.listing_id]) imagesByListingId[img.listing_id] = [];
      imagesByListingId[img.listing_id].push(img.url);
    }
    for (const item of paginatedItems) {
      item.images = imagesByListingId[item.id] || [];
    }
  }

  return {
    items: paginatedItems,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
      has_next: page * limit < total,
      has_prev: page > 1,
    },
  };
}

export async function getListingById(id: string, current_user_id?: string) {
  const listing = await queryOne<any>(
    `SELECT 
      l.*,
      u.name as owner_name,
      u.telegram_username as owner_username,
      u.profile_photo_url as owner_photo_url,
      u.bio as owner_bio,
      u.phone as owner_phone,
      u.verification_status as owner_verification_status,
      u.role as owner_role,
      u.created_at as owner_registered_at,
      o.name as organization_name,
      o.logo_url as organization_logo_url,
      o.description as organization_description,
      o.phone as organization_phone,
      o.website as organization_website,
      o.address as organization_address,
      o.verification_status as organization_verification_status,
      c.name_uz as category_name,
      c.icon as category_icon,
      r.name_uz as region_name,
      d.name_uz as district_name,
      d.latitude,
      d.longitude
    FROM listings l
    JOIN users u ON l.owner_user_id = u.id
    LEFT JOIN organizations o ON l.organization_id = o.id
    JOIN categories c ON l.category_id = c.id
    JOIN regions r ON l.region_id = r.id
    JOIN districts d ON l.district_id = d.id
    WHERE l.id = ?`,
    [id]
  );

  if (!listing) return null;

  // Normalize structured attributes to a plain object (JSONB usually arrives
  // pre-parsed, but defend against a raw string).
  if (typeof listing.attributes === 'string') {
    try { listing.attributes = JSON.parse(listing.attributes); } catch { listing.attributes = {}; }
  }
  if (!listing.attributes || typeof listing.attributes !== 'object') listing.attributes = {};

  // Images
  const images = await queryAll<{ url: string; sort_order: number }>(
    `SELECT url, sort_order FROM listing_images WHERE listing_id = ? ORDER BY sort_order ASC`,
    [id]
  );
  listing.images = images.map((i) => i.url);

  // Stats
  const activeCountRes = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM listings WHERE owner_user_id = ? AND status = 'ACTIVE'`,
    [listing.owner_user_id]
  );
  listing.owner_active_listing_count = activeCountRes?.count || 0;

  const followersCountRes = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM follows WHERE followed_user_id = ?`,
    [listing.owner_user_id]
  );
  listing.owner_followers_count = followersCountRes?.count || 0;

  // Saved & followed status for current viewer
  listing.is_saved = false;
  listing.is_followed = false;
  if (current_user_id) {
    const saved = await queryOne(
      'SELECT id FROM saved_listings WHERE user_id = ? AND listing_id = ?',
      [current_user_id, id]
    );
    listing.is_saved = Boolean(saved);

    const follow = await queryOne(
      'SELECT id FROM follows WHERE follower_user_id = ? AND followed_user_id = ?',
      [current_user_id, listing.owner_user_id]
    );
    listing.is_followed = Boolean(follow);
  }

  // Profile completeness check
  listing.is_profile_complete = Boolean(
    listing.owner_photo_url && listing.owner_bio && listing.owner_bio.trim().length >= 15
  );

  // Rasmiy tasdiq nishoni — faqat pasport/ID (yoki tashkilot) VERIFIED bo'lsa
  listing.is_verified = Boolean(
    listing.owner_verification_status === 'VERIFIED' ||
      (listing.organization_id && listing.organization_verification_status === 'VERIFIED')
  );

  // Employer rating & review count from actual submitted reviews
  const ratingRes = await queryOne<{ avg_rating: number; review_count: number }>(
    `SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(id) as review_count FROM reviews WHERE target_user_id = ?`,
    [listing.owner_user_id]
  );
  listing.employer_rating = ratingRes?.avg_rating ? Number(ratingRes.avg_rating) : null;
  listing.employer_review_count = ratingRes?.review_count ? Number(ratingRes.review_count) : 0;

  return listing;
}

export async function createListing(userId: string, data: any) {
  const id = `lst_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  // Validate images count (Faza 13: videos stored alongside images, media_type inferred by extension)
  const images: string[] = sanitizeUserUrlList(data.images, 8);
  const videos: string[] = sanitizeUserUrlList(data.videos, 2);
  const media: string[] = [...images, ...videos];

  // Determine catalog_id. Prefer the client value; otherwise derive it from the
  // selected category's catalog (authoritative) so a listing never lands in a catalog
  // different from its own category. Fall back to type as a last resort, and leave NULL
  // when undeterminable (browse is category-aware, so a NULL catalog_id is still found).
  let catalogId = data.catalog_id;
  if (!catalogId && data.category_id) {
    const catRow = await queryOne<{ catalog_id: string | null }>(
      'SELECT catalog_id FROM categories WHERE id = ?',
      [data.category_id]
    );
    catalogId = catRow?.catalog_id || null;
  }
  if (!catalogId) {
    if (['SERVICE_OFFER', 'SERVICE_REQUEST'].includes(data.type)) {
      catalogId = 'services';
    } else if (['JOB_OPENING', 'JOB_SEEKER'].includes(data.type)) {
      catalogId = 'jobs';
    }
  }
  // Normalize so we never pass `undefined` as a query parameter downstream.
  catalogId = catalogId || null;

  // Validate the listing type against the catalog's allowed listing_types.
  const catalogRow = await queryOne<{ listing_types: string | null }>(
    'SELECT listing_types FROM catalogs WHERE id = ?',
    [catalogId]
  );
  const allowedTypes = (catalogRow?.listing_types || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowedTypes.length > 0 && !allowedTypes.includes(data.type)) {
    throw new Error(`Bu katalog uchun “${data.type}” e’lon turi ruxsat etilmagan`);
  }

  // Structured attributes: normalize + enforce the category's required schema.
  const attributes: Record<string, any> =
    data.attributes && typeof data.attributes === 'object' ? data.attributes : {};
  const requiredRows = await queryAll<{ key: string; label_uz: string }>(
    'SELECT key, label_uz FROM category_attributes WHERE category_id = ? AND required = 1',
    [data.category_id]
  );
  const missing = requiredRows.filter(
    (r) => attributes[r.key] === undefined || attributes[r.key] === null || attributes[r.key] === ''
  );
  if (missing.length > 0) {
    throw new Error(`Majburiy atributlarni to'ldiring: ${missing.map((m) => m.label_uz).join(', ')}`);
  }

  // Faza 2 + 7: configurable active-days cycle + charge listing price when PAID
  const cfg = await getMonetizationConfig();
  const activeDays = resolveActiveDays(cfg);
  const expiresAt = new Date(Date.now() + activeDays * 24 * 60 * 60 * 1000).toISOString();
  // Admin accounts are billing-exempt — never charged, balance untouched.
  const price = (await isBillingExempt(userId)) ? 0 : getListingPrice(cfg, catalogId);
  // Charge FIRST so an insufficient balance aborts before any DB write.
  if (price > 0) {
    await charge(userId, price, { ref_type: 'LISTING_CREATE', ref_id: id, note: "E'lon joylash" });
  }

  try {
  await runQuery(
    `INSERT INTO listings (
      id, owner_user_id, organization_id, catalog_id, type, title, description, category_id,
      region_id, district_id, latitude, longitude, price_type, price_min, price_max,
      currency, salary_type, salary_min, salary_max, work_format, experience_level,
      skills, contact_time, contact_custom_text, attributes, status, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, 'ACTIVE', ?, ?, ?)`,
    [
      id,
      userId,
      data.organization_id || null,
      catalogId,
      data.type,
      data.title.trim(),
      data.description.trim(),
      data.category_id,
      data.region_id,
      data.district_id,
      data.latitude || null,
      data.longitude || null,
      data.price_type || 'NEGOTIABLE',
      data.price_min ?? null,
      data.price_max ?? null,
      'UZS',
      data.salary_type || null,
      data.salary_min ?? null,
      data.salary_max ?? null,
      data.work_format || 'ONSITE',
      data.experience_level || null,
      data.skills ? JSON.stringify(data.skills) : null,
      data.contact_time || 'ANY_TIME',
      data.contact_custom_text || null,
      JSON.stringify(attributes),
      now,
      now,
      expiresAt,
    ]
  );

  // Insert media (images + videos). Faza 13: media_type inferred from extension.
  for (let i = 0; i < media.length; i++) {
    const imgId = `img_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const mediaType = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(media[i]) ? 'video' : 'image';
    await runQuery(
      `INSERT INTO listing_images (id, listing_id, url, sort_order, media_type, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [imgId, id, media[i], i, mediaType, now]
    );
  }
  } catch (err) {
    // Persist failed after we already charged → refund so the user never loses money.
    if (price > 0) {
      await refund(userId, price, { ref_type: 'LISTING_CREATE', ref_id: id, note: "E'lon yaratilmagani uchun pul qaytarildi" }).catch(() => {});
    }
    throw err;
  }

  return getListingById(id, userId);
}

export async function renewListing(listingId: string, userId: string) {
  const listing = await queryOne<any>('SELECT * FROM listings WHERE id = ?', [listingId]);
  if (!listing) {
    throw new Error("E'lon topilmadi");
  }

  if (listing.owner_user_id !== userId) {
    throw new Error("Siz faqat o'zingizning e'loningizni uzaytirishingiz mumkin");
  }

  // Yakunlangan (COMPLETED) e'lonlarni arxivdan qaytarib bo'lmaydi — faqat
  // platforma tomonidan muddati tugab arxivlangan (ARCHIVED) yoki yashirilgan (HIDDEN) e'lonlar qayta faollashtiriladi.
  if (listing.status === 'COMPLETED') {
    throw new Error("Yakunlangan e'lonni arxivdan qaytarib bo'lmaydi");
  }
  if (!['ACTIVE', 'ARCHIVED', 'HIDDEN'].includes(listing.status)) {
    throw new Error("Bu holatdagi e'lonni uzaytirib bo'lmaydi");
  }

  // Faza 2 + 7: configurable active-days + optional renew charge when PAID
  const cfg = await getMonetizationConfig();
  const activeDays = resolveActiveDays(cfg);
  // Admin accounts are billing-exempt.
  const price = (await isBillingExempt(userId)) ? 0 : getRenewPrice(cfg, listing.catalog_id);
  if (price > 0) {
    await charge(userId, price, { ref_type: 'LISTING_RENEW', ref_id: listingId, note: "E'lon uzaytirish" });
  }

  const now = new Date().toISOString();
  const newExpiresAt = new Date(Date.now() + activeDays * 24 * 60 * 60 * 1000).toISOString();

  // Renew does NOT change created_at (prevents artificial aging change)
  try {
    await runQuery(
      `UPDATE listings 
       SET status = 'ACTIVE', renewed_at = ?, expires_at = ?, archived_at = NULL, completed_at = NULL, updated_at = ? 
       WHERE id = ?`,
      [now, newExpiresAt, now, listingId]
    );
  } catch (err) {
    if (price > 0) {
      await refund(userId, price, { ref_type: 'LISTING_RENEW', ref_id: listingId, note: "Uzaytirish amalga oshmaganligi uchun pul qaytarildi" }).catch(() => {});
    }
    throw err;
  }

  // Create notification
  const notifId = `notif_${crypto.randomUUID().slice(0, 16)}`;
  await runQuery(
    `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
     VALUES (?, ?, 'LISTING_RENEWED', 'E’loningiz muvaffaqiyatli uzaytirildi', ?, ?, ?)`,
    [
      notifId,
      userId,
      `"${listing.title}" nomli e'loningiz amal qilish muddati yana ${activeDays} kunga uzaytirildi.`,
      `/listing/${listingId}`,
      now,
    ]
  );

  return getListingById(listingId, userId);
}

// ─── Faza 8: Promote (topga ko'tarish) ─────────────────────────────────
export async function promoteListing(listingId: string, userId: string) {
  const listing = await queryOne<any>('SELECT * FROM listings WHERE id = ?', [listingId]);
  if (!listing) throw new Error("E'lon topilmadi");
  if (listing.owner_user_id !== userId) throw new Error("Siz faqat o'zingizning e'loningizni ko'tarishingiz mumkin");

  const cfg = await getMonetizationConfig();
  // Admin accounts are billing-exempt → treated as a free promo.
  const price = (await isBillingExempt(userId)) ? 0 : getPromoPrice(cfg, listing.catalog_id);
  if (price <= 0) {
    // Free-test: still allow a short promo without charge
    const hours = cfg.promo_duration_hours || 24;
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    await runQuery('UPDATE listings SET promoted_until = ?, updated_at = ? WHERE id = ?', [until, new Date().toISOString(), listingId]);
    return getListingById(listingId, userId);
  }

  await charge(userId, price, { ref_type: 'LISTING_PROMO', ref_id: listingId, note: "E'lonni topga ko'tarish" });
  const until = new Date(Date.now() + (cfg.promo_duration_hours || 24) * 60 * 60 * 1000).toISOString();
  try {
    await runQuery('UPDATE listings SET promoted_until = ?, updated_at = ? WHERE id = ?', [until, new Date().toISOString(), listingId]);
  } catch (err) {
    await refund(userId, price, { ref_type: 'LISTING_PROMO', ref_id: listingId, note: "Promo o'rnatilmaganligi uchun pul qaytarildi" }).catch(() => {});
    throw err;
  }
  return getListingById(listingId, userId);
}

// ─── Faza 9: Listing analytics events ──────────────────────────────────
export async function recordListingEvent(
  listingId: string,
  eventType: 'VIEW' | 'CONTACT' | 'SAVE',
  userId: string | null
) {
  const id = `lev_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await runQuery(
    `INSERT INTO listing_events (id, listing_id, event_type, user_id, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, listingId, eventType, userId, new Date().toISOString()]
  );
}

export async function getListingStats(listingId: string) {
  const rows = await queryAll<{ event_type: string; count: string }>(
    `SELECT event_type, COUNT(*) as count FROM listing_events WHERE listing_id = ? GROUP BY event_type`,
    [listingId]
  );
  const stats = { views: 0, contacts: 0, saves: 0 };
  for (const r of rows) {
    const c = Number(r.count) || 0;
    if (r.event_type === 'VIEW') stats.views = c;
    else if (r.event_type === 'CONTACT') stats.contacts = c;
    else if (r.event_type === 'SAVE') stats.saves = c;
  }
  return { listing_id: listingId, ...stats };
}

/** Aggregate stats for all listings owned by a user (owner-only analytics). */
export async function getOwnerListingsStats(ownerUserId: string) {
  const listings = await queryAll<{ id: string; title: string; status: string }>(
    `SELECT id, title, status FROM listings WHERE owner_user_id = ? ORDER BY created_at DESC`,
    [ownerUserId]
  );
  const ids = listings.map((l) => l.id);
  const result: Record<string, { views: number; contacts: number; saves: number }> = {};
  for (const id of ids) result[id] = { views: 0, contacts: 0, saves: 0 };
  if (ids.length > 0) {
    const rows = await queryAll<{ listing_id: string; event_type: string; count: string }>(
      `SELECT listing_id, event_type, COUNT(*) as count FROM listing_events WHERE listing_id IN (${ids.map(() => '?').join(',')}) GROUP BY listing_id, event_type`,
      ids
    );
    for (const r of rows) {
      const c = Number(r.count) || 0;
      if (!result[r.listing_id]) continue;
      if (r.event_type === 'VIEW') result[r.listing_id].views = c;
      else if (r.event_type === 'CONTACT') result[r.listing_id].contacts = c;
      else if (r.event_type === 'SAVE') result[r.listing_id].saves = c;
    }
  }
  return listings.map((l) => ({ ...l, stats: result[l.id] }));
}
