import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import { requireAuth, AuthRequest } from '../auth/telegram.ts';
import {
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  toggleBlockUser,
} from '../services/chatService.ts';
import { autoFlagContentIfProfane } from '../services/autoModerationService.ts';

const router = Router();

// Get list of conversations
router.get('/conversations', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await getUserConversations(req.user!.id);
    res.json(list);
  } catch (err: any) {
    serverError(res, err);
  }
});

// Start or get conversation for a listing (Section 28)
router.post('/start', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { listing_id } = req.body;
    if (!listing_id) {
      return res.status(400).json({ error: 'E’lon ID si kiritilmadi' });
    }

    const conversation = await getOrCreateConversation(listing_id, req.user!.id);
    res.json(conversation);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get messages for conversation (Section 29: with moderator privacy enforcement)
router.get('/conversations/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const data = await getConversationMessages(req.params.id, req.user!.id, req.user!.role);
    res.json(data);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// Send message (Section 27 & 30: text or image)
router.post('/conversations/:id/messages', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { text, attachment_url } = req.body;
    if (!text && !attachment_url) {
      return res.status(400).json({ error: 'Xabar yoki rasm bo‘sh bo‘lishi mumkin emas' });
    }

    const message = await sendMessage(
      req.params.id,
      req.user!.id,
      text || '',
      attachment_url
    );

    // Auto-flag chat message if contains profanity or banned phrases
    if (text && text.trim()) {
      autoFlagContentIfProfane('CHAT_MESSAGE', message.id, req.user!.id, text);
    }

    res.status(201).json(message);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Block or unblock a user (Section 28)
router.post('/block', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { blocked_user_id } = req.body;
    if (!blocked_user_id) {
      return res.status(400).json({ error: 'Foydalanuvchi ko‘rsatilmadi' });
    }

    const result = await toggleBlockUser(req.user!.id, blocked_user_id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
