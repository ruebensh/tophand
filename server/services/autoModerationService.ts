import crypto from 'crypto';
import { queryAll, queryOne, runQuery } from '../db/database.ts';

export async function getProfanityWords() {
  return await queryAll<any>('SELECT * FROM profanity_words ORDER BY word ASC');
}

export async function addProfanityWord(word: string, severity: string = 'HIGH') {
  const cleanWord = word.trim().toLowerCase();
  if (!cleanWord) throw new Error('So‘z kiritilishi shart');
  const existing = await queryOne('SELECT id FROM profanity_words WHERE word = ?', [cleanWord]);
  if (existing) throw new Error('Ushbu so‘z allaqachon lug‘atda mavjud');

  const id = `pf_${crypto.randomUUID().slice(0, 10)}`;
  const now = new Date().toISOString();
  await runQuery(
    'INSERT INTO profanity_words (id, word, severity, created_at) VALUES (?, ?, ?, ?)',
    [id, cleanWord, severity, now]
  );
  return { id, word: cleanWord, severity };
}

export async function deleteProfanityWord(id: string) {
  await runQuery('DELETE FROM profanity_words WHERE id = ?', [id]);
  return { success: true };
}

export async function scanTextForProfanity(text: string): Promise<{ isFlagged: boolean; matchedWords: string[] }> {
  if (!text || typeof text !== 'string') return { isFlagged: false, matchedWords: [] };
  const words = await getProfanityWords();
  const lowerText = text.toLowerCase();
  const matchedWords: string[] = [];

  for (const item of words) {
    const term = item.word.toLowerCase();
    // Regex for word boundary or enclosed match
    const regex = new RegExp(`(^|[^a-zA-Z0-9_'\`’‘])${term}([^a-zA-Z0-9_'\`’‘]|$)`, 'i');
    if (regex.test(lowerText) || lowerText.includes(` ${term} `) || lowerText.startsWith(`${term} `) || lowerText.endsWith(` ${term}`)) {
      if (!matchedWords.includes(term)) {
        matchedWords.push(term);
      }
    }
  }

  return {
    isFlagged: matchedWords.length > 0,
    matchedWords,
  };
}

export async function autoFlagContentIfProfane(
  sourceType: 'LISTING' | 'REVIEW' | 'CHAT_MESSAGE',
  sourceId: string,
  userId: string,
  text: string
) {
  try {
    const { isFlagged, matchedWords } = await scanTextForProfanity(text);
    if (!isFlagged) return null;

    const id = `flg_${crypto.randomUUID().slice(0, 16)}`;
    const now = new Date().toISOString();
    const snippet = text.slice(0, 250);

    await runQuery(
      `INSERT INTO auto_flagged_content (id, source_type, source_id, user_id, matched_words, content_snippet, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [id, sourceType, sourceId, userId, JSON.stringify(matchedWords), snippet, now]
    );

    return { id, matchedWords };
  } catch (err) {
    console.error('Error auto-flagging content:', err);
    return null;
  }
}

export async function getAutoFlaggedContent(status?: string) {
  let sql = `
    SELECT 
      f.*,
      u.name as user_name,
      u.telegram_username,
      u.role as user_role,
      u.is_banned as user_is_banned,
      rev.name as reviewer_name
    FROM auto_flagged_content f
    JOIN users u ON f.user_id = u.id
    LEFT JOIN users rev ON f.reviewed_by = rev.id
  `;
  const params: any[] = [];
  if (status) {
    sql += ' WHERE f.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY f.created_at DESC';

  const rows = await queryAll<any>(sql, params);
  return rows.map((r) => {
    let parsedMatched: string[] = [];
    try {
      parsedMatched = JSON.parse(r.matched_words);
    } catch {
      parsedMatched = [r.matched_words];
    }
    return {
      ...r,
      matched_words: parsedMatched,
    };
  });
}

export async function resolveAutoFlagged(
  flagId: string,
  reviewerId: string,
  action: 'BAN_USER' | 'DELETE_CONTENT' | 'DISMISS',
  reason?: string,
  banDays: number = 7
) {
  const flag = await queryOne<any>('SELECT * FROM auto_flagged_content WHERE id = ?', [flagId]);
  if (!flag) throw new Error('Ogohlantirish topilmadi');

  const now = new Date().toISOString();

  if (action === 'BAN_USER') {
    const banEndDate = new Date(Date.now() + banDays * 86400 * 1000).toISOString();
    await runQuery(
      `UPDATE users SET is_banned = 1, ban_type = 'TEMPORARY', ban_reason = ?, ban_end_date = ?, updated_at = ? WHERE id = ?`,
      [reason || 'Haqoratli so‘zlar ishlatgani uchun avto-filtr tomonidan bloklandi', banEndDate, now, flag.user_id]
    );
    await runQuery(
      `UPDATE auto_flagged_content SET status = 'RESOLVED_BANNED', reviewed_by = ?, action_taken = ?, resolved_at = ? WHERE id = ?`,
      [reviewerId, `Foydalanuvchi ${banDays} kunga ban qilindi: ${reason || ''}`, now, flagId]
    );
  } else if (action === 'DELETE_CONTENT') {
    if (flag.source_type === 'LISTING') {
      await runQuery(`UPDATE listings SET status = 'REMOVED', updated_at = ? WHERE id = ?`, [now, flag.source_id]);
    } else if (flag.source_type === 'REVIEW') {
      await runQuery(`DELETE FROM reviews WHERE id = ?`, [flag.source_id]);
    } else if (flag.source_type === 'CHAT_MESSAGE') {
      await runQuery(`UPDATE messages SET text = '[Qoidabuzarlik sababli moderator tomonidan o‘chirildi]' WHERE id = ?`, [flag.source_id]);
    }
    await runQuery(
      `UPDATE auto_flagged_content SET status = 'RESOLVED_CLEARED', reviewed_by = ?, action_taken = ?, resolved_at = ? WHERE id = ?`,
      [reviewerId, `Kontent olib tashlandi: ${reason || ''}`, now, flagId]
    );
  } else {
    // DISMISS
    await runQuery(
      `UPDATE auto_flagged_content SET status = 'DISMISSED', reviewed_by = ?, action_taken = 'Asossiz deb topildi', resolved_at = ? WHERE id = ?`,
      [reviewerId, now, flagId]
    );
  }

  return { success: true };
}

// Search and filter analytics logging
export async function logSearchOrFilter(data: {
  event_type: 'SEARCH_KEYWORD' | 'CATEGORY_FILTER' | 'FILTER_USE';
  category_id?: string;
  keyword?: string;
  filter_type?: string;
  filter_value?: string;
  user_id?: string;
}) {
  try {
    const id = `sfl_${crypto.randomUUID().slice(0, 16)}`;
    const now = new Date().toISOString();
    await runQuery(
      `INSERT INTO search_filter_logs (id, event_type, category_id, keyword, filter_type, filter_value, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.event_type,
        data.category_id || null,
        data.keyword || null,
        data.filter_type || null,
        data.filter_value || null,
        data.user_id || null,
        now,
      ]
    );
  } catch (e) {
    // non-blocking
  }
}

export async function getAdvancedAnalytics() {
  // 1. Most searched/filtered categories
  const topCategories = await queryAll<{
    category_id: string;
    category_name: string;
    category_icon: string;
    usage_count: number;
  }>(`
    SELECT 
      c.id as category_id,
      c.name_uz as category_name,
      c.icon as category_icon,
      COUNT(s.id) as usage_count
    FROM categories c
    LEFT JOIN search_filter_logs s ON s.category_id = c.id
    GROUP BY c.id
    ORDER BY usage_count DESC
    LIMIT 10
  `);

  // 2. Most used filter types
  const topFilters = await queryAll<{
    filter_type: string;
    filter_name: string;
    usage_count: number;
  }>(`
    SELECT 
      filter_type,
      CASE 
        WHEN filter_type = 'MAOSH_PRICE' OR filter_type = 'PRICE' THEN 'Maosh / Narx oralig‘i'
        WHEN filter_type = 'HUDUD' OR filter_type = 'REGION' THEN 'Hudud (Viloyat/Tuman)'
        WHEN filter_type = 'ISH_TURI' OR filter_type = 'TYPE' THEN 'Ish turi (To‘liq/Masofaviy)'
        WHEN filter_type = 'OBUNALARIM' THEN 'Obunalarim e’lonlari'
        WHEN filter_type = 'TAJRIBA' THEN 'Tajriba darajasi'
        WHEN filter_type = 'CATEGORY' THEN 'Kategoriyalar filtri'
        ELSE filter_type
      END as filter_name,
      COUNT(id) as usage_count
    FROM search_filter_logs
    WHERE filter_type IS NOT NULL
    GROUP BY filter_type
    ORDER BY usage_count DESC
  `);

  // 3. Top search keywords
  const topKeywords = await queryAll<{
    keyword: string;
    search_count: number;
  }>(`
    SELECT 
      LOWER(keyword) as keyword,
      COUNT(id) as search_count
    FROM search_filter_logs
    WHERE keyword IS NOT NULL AND TRIM(keyword) != ''
    GROUP BY LOWER(keyword)
    ORDER BY search_count DESC
    LIMIT 10
  `);

  // 4. Verification & Trust stats
  const verificationStats = await queryOne<any>(`
    SELECT 
      COUNT(*) as total_users,
      SUM(CASE WHEN verification_status = 'VERIFIED' THEN 1 ELSE 0 END) as verified_users,
      SUM(CASE WHEN verification_status = 'PENDING' THEN 1 ELSE 0 END) as pending_verifications,
      SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) as banned_users
    FROM users
  `);

  // 5. Total log events
  const totalEvents = await queryOne<{ total: number }>(`
    SELECT COUNT(*) as total FROM search_filter_logs
  `);

  return {
    top_categories: topCategories,
    top_filters: topFilters,
    top_keywords: topKeywords,
    verification_stats: {
      total_users: Number(verificationStats?.total_users || 0),
      verified_users: Number(verificationStats?.verified_users || 0),
      pending_verifications: Number(verificationStats?.pending_verifications || 0),
      banned_users: Number(verificationStats?.banned_users || 0),
    },
    total_tracked_events: Number(totalEvents?.total || 0),
  };
}
