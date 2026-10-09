import { serverError } from '../lib/error.ts';
import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, optionalAuth, AuthRequest } from '../auth/telegram.ts';
import { queryOne, queryAll, runQuery } from '../db/database.ts';
import { autoFlagContentIfProfane } from '../services/autoModerationService.ts';

const router = Router();

// GET /api/reviews/target/:userId - Get all reviews and summary for an employer/user
router.get('/target/:userId', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const listingId = req.query.listing_id as string | undefined;

    let sql = `
      SELECT 
        r.*,
        u.name as author_name,
        u.profile_photo_url as author_photo_url,
        u.telegram_username as author_username,
        emp.name as employer_name,
        l.title as listing_title
      FROM reviews r
      JOIN users u ON r.author_user_id = u.id
      JOIN users emp ON r.target_user_id = emp.id
      LEFT JOIN listings l ON r.listing_id = l.id
      WHERE r.target_user_id = ?
    `;
    const params: any[] = [userId];

    if (listingId) {
      // If scoped to listing or showing employer's reviews
      // Still show employer reviews, but can order or prioritize this listing's reviews
    }

    sql += ` ORDER BY r.created_at DESC`;

    const reviews = await queryAll<any>(sql, params);

    // Calculate aggregated distribution and average
    const total_reviews = reviews.length;
    const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sumRating = 0;

    for (const r of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)));
      distribution[star] = (distribution[star] || 0) + 1;
      sumRating += r.rating;
    }

    const average_rating = total_reviews > 0 ? Math.round((sumRating / total_reviews) * 10) / 10 : 0;

    res.json({
      reviews,
      summary: {
        average_rating,
        total_reviews,
        distribution,
      },
    });
  } catch (err: any) {
    console.error('Error fetching reviews:', err);
    serverError(res, err, 'Sharhlarni yuklashda xatolik yuz berdi');
  }
});

// POST /api/reviews - Add a new review
router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { target_user_id, listing_id, rating, comment } = req.body;

    if (!target_user_id) {
      return res.status(400).json({ error: 'Ish beruvchi yoki mutaxassis ID si kiritilishi shart' });
    }

    if (currentUserId === target_user_id) {
      return res.status(400).json({ error: 'O‘zingizning profilingizga sharh qoldira olmaysiz' });
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Baho 1 dan 5 gacha bo‘lgan butun son bo‘lishi shart' });
    }

    const trimmedComment = (comment || '').trim();
    if (trimmedComment.length < 3) {
      return res.status(400).json({ error: 'Sharh matni kamida 3 ta belgidan iborat bo‘lishi kerak' });
    }
    if (trimmedComment.length > 1000) {
      return res.status(400).json({ error: 'Sharh matni 1000 ta belgidan oshmasligi kerak' });
    }

    // Verify target user exists
    const targetUser = await queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM users WHERE id = ?',
      [target_user_id]
    );
    if (!targetUser) {
      return res.status(404).json({ error: 'Baho berilayotgan foydalanuvchi topilmadi' });
    }

    const id = `rev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    await runQuery(
      `INSERT INTO reviews (id, author_user_id, target_user_id, listing_id, rating, comment, employer_reply, employer_reply_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      [id, currentUserId, target_user_id, listing_id || null, numRating, trimmedComment, now, now]
    );

    // Auto-flag for moderator queue if contains profanity or prohibited words
    autoFlagContentIfProfane('REVIEW', id, currentUserId, trimmedComment);

    // Send notification to employer
    try {
      const author = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', [currentUserId]);
      const notifId = `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const notifLink = listing_id ? `/listing/${listing_id}` : `/profile/${target_user_id}`;
      await runQuery(
        `INSERT INTO notifications (id, user_id, type, title, body, link, read_at, created_at)
         VALUES (?, ?, 'NEW_REVIEW', 'Yangi sharh qoldirildi', ?, ?, NULL, ?)`,
        [
          notifId,
          target_user_id,
          `${author?.name || 'Foydalanuvchi'} sizga ${numRating} yulduzli baho qoldirdi: "${trimmedComment.slice(0, 60)}${trimmedComment.length > 60 ? '...' : ''}"`,
          notifLink,
          now,
        ]
      );
    } catch (e) {
      console.warn('Could not send notification for new review:', e);
    }

    // Fetch and return the newly created review with relations
    const createdReview = await queryOne<any>(
      `SELECT 
        r.*,
        u.name as author_name,
        u.profile_photo_url as author_photo_url,
        u.telegram_username as author_username,
        emp.name as employer_name,
        l.title as listing_title
      FROM reviews r
      JOIN users u ON r.author_user_id = u.id
      JOIN users emp ON r.target_user_id = emp.id
      LEFT JOIN listings l ON r.listing_id = l.id
      WHERE r.id = ?`,
      [id]
    );

    res.status(201).json(createdReview);
  } catch (err: any) {
    console.error('Error creating review:', err);
    serverError(res, err, 'Sharh yuborishda xatolik yuz berdi');
  }
});

// PUT /api/reviews/:id - Edit own review
router.put('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { id } = req.params;
    const { rating, comment } = req.body;

    const review = await queryOne<{ id: string; author_user_id: string }>(
      'SELECT id, author_user_id FROM reviews WHERE id = ?',
      [id]
    );
    if (!review) {
      return res.status(404).json({ error: 'Sharh topilmadi' });
    }

    if (review.author_user_id !== currentUserId) {
      return res.status(403).json({ error: 'Siz faqat o‘zingiz qoldirgan sharhni tahrirlashingiz mumkin' });
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ error: 'Baho 1 dan 5 gacha bo‘lgan butun son bo‘lishi shart' });
    }

    const trimmedComment = (comment || '').trim();
    if (trimmedComment.length < 3) {
      return res.status(400).json({ error: 'Sharh matni kamida 3 ta belgidan iborat bo‘lishi kerak' });
    }
    if (trimmedComment.length > 1000) {
      return res.status(400).json({ error: 'Sharh matni 1000 ta belgidan oshmasligi kerak' });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE reviews 
       SET rating = ?, comment = ?, updated_at = ?
       WHERE id = ?`,
      [numRating, trimmedComment, now, id]
    );

    // Auto-flag updated review content
    autoFlagContentIfProfane('REVIEW', id, currentUserId, trimmedComment);

    const updated = await queryOne<any>(
      `SELECT 
        r.*,
        u.name as author_name,
        u.profile_photo_url as author_photo_url,
        u.telegram_username as author_username,
        emp.name as employer_name,
        l.title as listing_title
      FROM reviews r
      JOIN users u ON r.author_user_id = u.id
      JOIN users emp ON r.target_user_id = emp.id
      LEFT JOIN listings l ON r.listing_id = l.id
      WHERE r.id = ?`,
      [id]
    );

    res.json(updated);
  } catch (err: any) {
    console.error('Error updating review:', err);
    serverError(res, err, 'Sharhni yangilashda xatolik yuz berdi');
  }
});

// DELETE /api/reviews/:id - Delete own review or moderator/admin delete
router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const userRole = req.user!.role;
    const { id } = req.params;

    const review = await queryOne<{
      id: string;
      author_user_id: string;
      target_user_id: string;
      comment: string;
    }>('SELECT * FROM reviews WHERE id = ?', [id]);

    if (!review) {
      return res.status(404).json({ error: 'Sharh topilmadi' });
    }

    const isAuthor = review.author_user_id === currentUserId;
    const isStaff = userRole === 'MODERATOR' || userRole === 'ADMIN';

    if (!isAuthor && !isStaff) {
      return res.status(403).json({ error: 'Ushbu sharhni o‘chirish uchun ruxsatingiz yetarli emas' });
    }

    await runQuery('DELETE FROM reviews WHERE id = ?', [id]);

    // If deleted by staff, record in audit logs
    if (isStaff && !isAuthor) {
      const now = new Date().toISOString();
      const auditId = `audit_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await runQuery(
        `INSERT INTO audit_logs (id, actor_user_id, action, target_type, target_id, metadata, created_at)
         VALUES (?, ?, 'REVIEW_DELETED_BY_MODERATOR', 'REVIEW', ?, ?, ?)`,
        [
          auditId,
          currentUserId,
          id,
          JSON.stringify({
            author_user_id: review.author_user_id,
            target_user_id: review.target_user_id,
            comment_snippet: review.comment.slice(0, 100),
          }),
          now,
        ]
      );
    }

    res.json({ success: true, message: 'Sharh muvaffaqiyatli o‘chirildi' });
  } catch (err: any) {
    console.error('Error deleting review:', err);
    serverError(res, err, 'Sharhni o‘chirishda xatolik yuz berdi');
  }
});

// POST /api/reviews/:id/reply - Employer reply to a review
router.post('/:id/reply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { id } = req.params;
    const { reply } = req.body;

    const review = await queryOne<{
      id: string;
      target_user_id: string;
      author_user_id: string;
      listing_id?: string;
    }>('SELECT * FROM reviews WHERE id = ?', [id]);

    if (!review) {
      return res.status(404).json({ error: 'Sharh topilmadi' });
    }

    // Only the target employer can reply
    if (review.target_user_id !== currentUserId) {
      return res.status(403).json({ error: 'Faqat baholangan ish beruvchi sharhga javob qaytara oladi' });
    }

    const trimmedReply = (reply || '').trim();
    if (trimmedReply.length < 2) {
      return res.status(400).json({ error: 'Javob matni kamida 2 ta belgidan iborat bo‘lishi kerak' });
    }
    if (trimmedReply.length > 1000) {
      return res.status(400).json({ error: 'Javob matni 1000 ta belgidan oshmasligi kerak' });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE reviews 
       SET employer_reply = ?, employer_reply_at = ?, updated_at = ?
       WHERE id = ?`,
      [trimmedReply, now, now, id]
    );

    // Auto-flag employer reply for inappropriate content
    autoFlagContentIfProfane('REVIEW', id, currentUserId, trimmedReply);

    // Notify review author
    try {
      const employer = await queryOne<{ name: string }>('SELECT name FROM users WHERE id = ?', [currentUserId]);
      const notifId = `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const notifLink = review.listing_id ? `/listing/${review.listing_id}` : `/profile/${review.target_user_id}`;
      await runQuery(
        `INSERT INTO notifications (id, user_id, type, title, body, link, read_at, created_at)
         VALUES (?, ?, 'REVIEW_REPLY', 'Ish beruvchi sharhingizga javob berdi', ?, ?, NULL, ?)`,
        [
          notifId,
          review.author_user_id,
          `${employer?.name || 'Ish beruvchi'} sharhingizga javob qaytardi: "${trimmedReply.slice(0, 60)}${trimmedReply.length > 60 ? '...' : ''}"`,
          notifLink,
          now,
        ]
      );
    } catch (e) {
      console.warn('Could not send notification for review reply:', e);
    }

    const updated = await queryOne<any>(
      `SELECT 
        r.*,
        u.name as author_name,
        u.profile_photo_url as author_photo_url,
        u.telegram_username as author_username,
        emp.name as employer_name,
        l.title as listing_title
      FROM reviews r
      JOIN users u ON r.author_user_id = u.id
      JOIN users emp ON r.target_user_id = emp.id
      LEFT JOIN listings l ON r.listing_id = l.id
      WHERE r.id = ?`,
      [id]
    );

    res.json(updated);
  } catch (err: any) {
    console.error('Error replying to review:', err);
    serverError(res, err, 'Javob berishda xatolik yuz berdi');
  }
});

// DELETE /api/reviews/:id/reply - Remove employer reply
router.delete('/:id/reply', requireAuth, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;
    const { id } = req.params;

    const review = await queryOne<{
      id: string;
      target_user_id: string;
    }>('SELECT id, target_user_id FROM reviews WHERE id = ?', [id]);

    if (!review) {
      return res.status(404).json({ error: 'Sharh topilmadi' });
    }

    const isTarget = review.target_user_id === currentUserId;
    const isStaff = req.user!.role === 'MODERATOR' || req.user!.role === 'ADMIN';

    if (!isTarget && !isStaff) {
      return res.status(403).json({ error: 'Ruxsatingiz yetarli emas' });
    }

    const now = new Date().toISOString();
    await runQuery(
      `UPDATE reviews 
       SET employer_reply = NULL, employer_reply_at = NULL, updated_at = ?
       WHERE id = ?`,
      [now, id]
    );

    res.json({ success: true, message: 'Javob o‘chirildi' });
  } catch (err: any) {
    console.error('Error deleting reply:', err);
    serverError(res, err, 'Javobni o‘chirishda xatolik yuz berdi');
  }
});

export default router;
