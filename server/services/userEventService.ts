import crypto from 'crypto';
import { runQuery } from '../db/database.ts';

// LOGIN/LOGOUT — hisobga kirish/chiqish (auth); VISIT/EXIT — sessiya asosidagi
// sayt trafik (ochilish/yopilish). Admin "Saytga kirish/chiqish" grafigi VISIT/EXITni sanaydi.
export type UserEventType = 'LOGIN' | 'LOGOUT' | 'VISIT' | 'EXIT';
export type UserEventAuthMethod = 'PASSWORD' | 'GOOGLE' | 'REGISTER';

/**
 * Admin statistika uchun saytga kirish/chiqish hodisasini yozadi (user_events).
 * Fire-and-forget: hech qachon auth oqimini buzmasin — xato yutib, loglanadi.
 */
export async function recordUserEvent(
  userId: string,
  eventType: UserEventType,
  authMethod?: UserEventAuthMethod | null
): Promise<void> {
  try {
    const id = `uev_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await runQuery(
      `INSERT INTO user_events (id, user_id, event_type, auth_method, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, eventType, authMethod || null, new Date().toISOString()]
    );
  } catch (err) {
    // Statistika auth muvaffaqiyatiga ta'sir qilmasligi kerak.
    console.error('user_events yozishda xatolik:', (err as Error)?.message);
  }
}
