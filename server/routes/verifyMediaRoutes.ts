import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { r2Client, getVerificationObjectStream } from '../services/storageService.ts';
import { verifyVerificationPhotoSig } from '../lib/signedUrl.ts';
import { queryOne } from '../db/database.ts';

// SECURITY (H-07 / P1-1 / P1-2): verification passport/selfie images are personal
// data and must NOT be world-readable. They are blocked from the public /uploads
// static route and the /api/storage proxy, and served ONLY through this short-
// lived, HMAC-signed URL. The signature binds the OWNER (uid) + object basename;
// on top of that we re-check the DB (a verification_uploads row must exist with
// this owner + object_key) so even a validly-signed link can't be replayed for a
// file the owner no longer has. No Bearer is required so a plain <img> works —
// authorization happens where the signed URL is minted (staff/owner endpoints).
const router = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const VERIFY_DIR = path.join(UPLOADS_DIR, 'verifications');
// Only re-encoded raster images; strict allowlist (no traversal, no query chars).
const SAFE_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(webp|png|jpe?g|gif)$/i;
const IMG_EXT_TO_MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

function denyPublic(res: Response): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.status(403).json({ error: 'Ruxsat yo‘q yoki havola muddati tugagan' });
}

router.get('/:filename', async (req: Request, res: Response) => {
  const filename = req.params.filename;
  // 1. Strict filename allowlist (no traversal, image extensions only).
  if (!SAFE_FILE_RE.test(filename) || filename.includes('..')) return denyPublic(res);

  // 2. Verify the short-lived, owner-bound signature (uid + basename + exp).
  const uid = typeof req.query.uid === 'string' ? req.query.uid : '';
  if (!verifyVerificationPhotoSig(filename, uid, req.query.exp, req.query.sig)) {
    return denyPublic(res);
  }

  // 3. Ownership re-check: a verification_uploads row must exist for this owner
  //    and object_key. This is the authoritative source (never a client URL).
  try {
    const owns = await queryOne<{ id: string }>(
      `SELECT id FROM verification_uploads
       WHERE owner_user_id = ? AND purpose = 'verification' AND object_key = ?`,
      [uid, `verifications/${filename}`]
    );
    if (!owns) return denyPublic(res);
  } catch {
    return denyPublic(res);
  }

  // Content-Type from the VALIDATED extension allowlist (not stored R2 metadata).
  const ext = path.extname(filename).toLowerCase();
  const contentType = IMG_EXT_TO_MIME[ext] || 'application/octet-stream';
  if (contentType === 'application/octet-stream') return denyPublic(res);

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Type', contentType);

  try {
    // 4. Local file first (containment-asserted under uploads/verifications).
    const localPath = path.resolve(VERIFY_DIR, filename);
    const withSep = VERIFY_DIR.endsWith(path.sep) ? VERIFY_DIR : VERIFY_DIR + path.sep;
    if (localPath.startsWith(withSep) && fs.existsSync(localPath)) {
      fs.createReadStream(localPath).pipe(res);
      return;
    }

    // 5. Otherwise stream from the PRIVATE R2 bucket under the verifications/ prefix.
    if (r2Client) {
      const r2 = await getVerificationObjectStream(filename);
      if (r2 && r2.Body) {
        if (r2.ContentLength) res.setHeader('Content-Length', String(r2.ContentLength));
        const body: any = r2.Body;
        if (typeof body.pipe === 'function') body.pipe(res);
        else {
          const bytes = await body.transformToByteArray();
          res.send(Buffer.from(bytes));
        }
        return;
      }
    }

    res.status(404).json({ error: 'Fayl topilmadi' });
  } catch {
    res.status(404).json({ error: 'Fayl topilmadi' });
  }
});

export default router;
