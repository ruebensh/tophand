import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { r2Client, getR2ObjectStream } from '../services/storageService.ts';
import { verifyVerificationPhotoSig } from '../lib/signedUrl.ts';

// SECURITY (H-07): verification passport/selfie images are personal data and must
// NOT be world-readable. They are blocked from the public /uploads static route
// and served ONLY through this short-lived, HMAC-signed URL (no Bearer needed so
// a plain <img> works). Authorization happens where the signed URL is minted
// (the staff/owner-verified moderation endpoints).
const router = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const VERIFY_DIR = path.join(UPLOADS_DIR, 'verifications');
// Uploaded verification photos are re-encoded to WebP; allow a small image set.
const SAFE_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(webp|png|jpe?g|gif)$/i;

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

  // 2. Verify the short-lived signature.
  if (!verifyVerificationPhotoSig(filename, req.query.exp, req.query.sig)) {
    return denyPublic(res);
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  try {
    // 3. Local file first (containment-asserted under uploads/verifications).
    const localPath = path.resolve(VERIFY_DIR, filename);
    const withSep = VERIFY_DIR.endsWith(path.sep) ? VERIFY_DIR : VERIFY_DIR + path.sep;
    if (localPath.startsWith(withSep) && fs.existsSync(localPath)) {
      const ext = path.extname(localPath).toLowerCase();
      const type = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      res.setHeader('Content-Type', type);
      fs.createReadStream(localPath).pipe(res);
      return;
    }

    // 4. Otherwise stream from R2 under the verifications/ prefix.
    if (r2Client) {
      const r2 = await getR2ObjectStream(`verifications/${filename}`);
      if (r2 && r2.Body) {
        res.setHeader('Content-Type', r2.ContentType || 'image/webp');
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
