import crypto from 'crypto';
import { queryAll, queryOne, runQuery } from '../db/database.ts';

export async function getOrCreateConversation(listingId: string, initiatorUserId: string) {
  // Find listing to get recipient
  const listing = await queryOne<any>('SELECT id, owner_user_id, title FROM listings WHERE id = ?', [listingId]);
  if (!listing) {
    throw new Error("E'lon topilmadi");
  }

  const recipientUserId = listing.owner_user_id;
  if (initiatorUserId === recipientUserId) {
    throw new Error("O'zingizning e'loningiz bo'yicha o'zingizga yozolmaysiz");
  }

  // Check if either user blocked the other
  const block = await queryOne(
    `SELECT id FROM user_blocks 
     WHERE (blocker_user_id = ? AND blocked_user_id = ?) 
        OR (blocker_user_id = ? AND blocked_user_id = ?)`,
    [initiatorUserId, recipientUserId, recipientUserId, initiatorUserId]
  );
  if (block) {
    throw new Error("Foydalanuvchi bloklanganligi sababli suhbat boshlash imkonsiz");
  }

  // Check if conversation already exists
  let conv = await queryOne<any>(
    `SELECT * FROM conversations 
     WHERE listing_id = ? 
       AND ((initiator_user_id = ? AND recipient_user_id = ?) 
         OR (initiator_user_id = ? AND recipient_user_id = ?))`,
    [listingId, initiatorUserId, recipientUserId, recipientUserId, initiatorUserId]
  );

  if (!conv) {
    const id = `conv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();
    await runQuery(
      `INSERT INTO conversations (id, listing_id, initiator_user_id, recipient_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, listingId, initiatorUserId, recipientUserId, now, now]
    );
    conv = await queryOne<any>('SELECT * FROM conversations WHERE id = ?', [id]);
  }

  return conv;
}

export async function getUserConversations(userId: string) {
  const conversations = await queryAll<any>(
    `SELECT 
      c.*,
      l.title as listing_title,
      l.type as listing_type,
      l.price_type as listing_price_type,
      l.price_min as listing_price_min,
      l.price_max as listing_price_max,
      l.salary_min as listing_salary_min,
      l.salary_max as listing_salary_max,
      l.status as listing_status,
      u_init.name as initiator_name,
      u_init.profile_photo_url as initiator_photo,
      u_rec.name as recipient_name,
      u_rec.profile_photo_url as recipient_photo,
      (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY sort_order ASC LIMIT 1) as listing_cover_image,
      (SELECT text FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_text,
      (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_user_id != ? AND read_at IS NULL) as unread_count
    FROM conversations c
    JOIN listings l ON c.listing_id = l.id
    JOIN users u_init ON c.initiator_user_id = u_init.id
    JOIN users u_rec ON c.recipient_user_id = u_rec.id
    WHERE c.initiator_user_id = ? OR c.recipient_user_id = ?
    ORDER BY c.updated_at DESC`,
    [userId, userId, userId]
  );

  return conversations.map((c) => {
    const isInitiator = c.initiator_user_id === userId;
    return {
      id: c.id,
      listing_id: c.listing_id,
      listing_title: c.listing_title,
      listing_type: c.listing_type,
      listing_cover_image: c.listing_cover_image,
      partner_id: isInitiator ? c.recipient_user_id : c.initiator_user_id,
      partner_name: isInitiator ? c.recipient_name : c.initiator_name,
      partner_photo: isInitiator ? c.recipient_photo : c.initiator_photo,
      last_message_text: c.last_message_text || 'Suhbat boshlandi',
      last_message_time: c.last_message_time || c.created_at,
      unread_count: c.unread_count || 0,
    };
  });
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  userRole: string = 'USER'
) {
  const conv = await queryOne<any>(
    `SELECT c.*, l.title as listing_title, l.type as listing_type 
     FROM conversations c
     JOIN listings l ON c.listing_id = l.id
     WHERE c.id = ?`,
    [conversationId]
  );

  if (!conv) {
    throw new Error('Suhbat topilmadi');
  }

  // Authorization check (Section 29 Moderation Privacy Rule)
  // Normal moderators CANNOT view private messages unless legitimately reported or participant
  const isParticipant = conv.initiator_user_id === userId || conv.recipient_user_id === userId;
  if (!isParticipant) {
    if (userRole === 'MODERATOR' || userRole === 'ADMIN') {
      const hasReport = await queryOne(
        `SELECT id FROM reports 
         WHERE (target_type = 'CONVERSATION' AND target_id = ?) 
            OR (target_type = 'MESSAGE' AND target_id IN (SELECT id FROM messages WHERE conversation_id = ?))`,
        [conversationId, conversationId]
      );
      if (!hasReport && userRole !== 'ADMIN') {
        throw new Error("Shaxsiy suhbatlar faqat shikoyat tushgan taqdirdagina tekshirilishi mumkin");
      }
      // Audit privileged access
      const now = new Date().toISOString();
      await runQuery(
        `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
         VALUES (?, ?, 'PRIVATE_CHAT_ACCESSED_FOR_MODERATION', 'CONVERSATION', ?, ?, ?)`,
        [`audit_${crypto.randomUUID().slice(0, 16)}`, userId, conversationId, JSON.stringify({ reason: 'Moderator ko‘rigi' }), now]
      );
    } else {
      throw new Error("Ushbu suhbatga kirish huquqingiz yo‘q");
    }
  }

  // Mark messages sent by the other party as read
  if (isParticipant) {
    const now = new Date().toISOString();
    await runQuery(
      `UPDATE messages 
       SET read_at = ? 
       WHERE conversation_id = ? AND sender_user_id != ? AND read_at IS NULL`,
      [now, conversationId, userId]
    );
  }

  const messages = await queryAll<any>(
    `SELECT 
      m.*,
      u.name as sender_name,
      u.profile_photo_url as sender_photo
    FROM messages m
    JOIN users u ON m.sender_user_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC`,
    [conversationId]
  );

  // Other participant details
  const partnerId = conv.initiator_user_id === userId ? conv.recipient_user_id : conv.initiator_user_id;
  const partner = await queryOne<any>(
    'SELECT id, name, telegram_username, profile_photo_url FROM users WHERE id = ?',
    [partnerId]
  );

  return {
    conversation: conv,
    partner,
    messages,
  };
}

export async function sendMessage(
  conversationId: string,
  senderUserId: string,
  text: string,
  attachmentUrl?: string
) {
  const conv = await queryOne<any>('SELECT * FROM conversations WHERE id = ?', [conversationId]);
  if (!conv) {
    throw new Error('Suhbat topilmadi');
  }

  if (conv.initiator_user_id !== senderUserId && conv.recipient_user_id !== senderUserId) {
    throw new Error("Ushbu suhbatga xabar yuborish huquqingiz yo‘q");
  }

  const recipientUserId = conv.initiator_user_id === senderUserId ? conv.recipient_user_id : conv.initiator_user_id;

  // Block check
  const block = await queryOne(
    `SELECT id FROM user_blocks 
     WHERE (blocker_user_id = ? AND blocked_user_id = ?) 
        OR (blocker_user_id = ? AND blocked_user_id = ?)`,
    [senderUserId, recipientUserId, recipientUserId, senderUserId]
  );
  if (block) {
    throw new Error("Foydalanuvchi bloklanganligi sababli xabar yuborib bo‘lmaydi");
  }

  if (!text.trim() && !attachmentUrl) {
    throw new Error('Xabar matni yoki rasm bo‘sh bo‘lishi mumkin emas');
  }

  const id = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();
  const messageType = attachmentUrl ? 'IMAGE' : 'TEXT';

  await runQuery(
    `INSERT INTO messages (id, conversation_id, sender_user_id, message_type, text, attachment_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, conversationId, senderUserId, messageType, text.trim(), attachmentUrl || null, now]
  );

  // Update conversation updated_at
  await runQuery(`UPDATE conversations SET updated_at = ? WHERE id = ?`, [now, conversationId]);

  // Send notification to recipient
  const senderUser = await queryOne<any>('SELECT name FROM users WHERE id = ?', [senderUserId]);
  const notifId = `notif_${crypto.randomUUID().slice(0, 16)}`;
  await runQuery(
    `INSERT INTO notifications (id, user_id, type, title, body, link, created_at)
     VALUES (?, ?, 'NEW_CHAT_MESSAGE', 'Yangi xabar', ?, ?, ?)`,
    [
      notifId,
      recipientUserId,
      `${senderUser?.name || 'Foydalanuvchi'}: ${text.slice(0, 80) || 'Rasm yubordi'}`,
      `/chat?conv=${conversationId}`,
      now,
    ]
  );

  return queryOne('SELECT * FROM messages WHERE id = ?', [id]);
}

export async function toggleBlockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) {
    throw new Error("O'zingizni bloklay olmaysiz");
  }

  const existing = await queryOne(
    'SELECT id FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?',
    [blockerId, blockedId]
  );

  if (existing) {
    await runQuery('DELETE FROM user_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?', [
      blockerId,
      blockedId,
    ]);
    return { blocked: false };
  } else {
    const id = `blk_${crypto.randomUUID().slice(0, 16)}`;
    const now = new Date().toISOString();
    await runQuery(
      'INSERT INTO user_blocks (id, blocker_user_id, blocked_user_id, created_at) VALUES (?, ?, ?, ?)',
      [id, blockerId, blockedId, now]
    );
    return { blocked: true };
  }
}
