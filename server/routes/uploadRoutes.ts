import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth/telegram.ts';
import { processAndStoreImage, storeVideo, getR2ObjectStream, r2Client, VERIFICATION_FOLDER } from '../services/storageService.ts';
import { recordUpload } from '../services/mediaCleanupService.ts';
import { serverError } from '../lib/error.ts';

const router = Router();

// Store file in memory to allow Sharp to optimize before storing to Cloudflare R2 / disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // Allow up to 15MB upload, Sharp compresses it down to ~100KB WebP!
    files: 1,                    // M-04: only one image per request
    fieldSize: 64 * 1024,        // M-04: cap non-file text fields (folder, etc.)
    parts: 8,                    // M-04: bound multipart parts to curb abuse
  },
  fileFilter: (_req, file, cb) => {
    // P2-3: explicit raster MIME allowlist (no `image/*` wildcard, no SVG). The
    // real magic-byte check in storageService is the authoritative gate; this is
    // just a cheap first pass so garbage never reaches the decoder.
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMime.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Faqat rasm fayllari (JPEG, PNG, WebP, GIF) yuklanishi mumkin'));
    }
  },
});

// F-06: folder'ni NORMALIZACIYA qilib taqqoslash (kichik harf + trailing slash),
// aks holda `VERIFICATIONS`/`Verifications/` kabi variantlar deny'ni chetlab
// ketadi. storageService.sanitizeFolder ichida ham ikkinchi qulf bor.
function isVerificationFolder(raw: unknown): boolean {
  return String(raw ?? '').trim().toLowerCase().replace(/\/+$/, '') === VERIFICATION_FOLDER;
}

// POST /api/upload - Upload and optimize image (WebP + Cloudflare R2)
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Rasm fayli tanlanmadi' });
    }

    const folder = (req.query.folder as string) || 'listings';
    // P1-1: verification images must go through the dedicated PRIVATE endpoint
    // (/api/users/me/verification/upload). The generic path writes public, long-
    // cache objects, so it must never accept the `verifications` folder.
    if (isVerificationFolder(folder)) {
      return res.status(400).json({ error: 'Tasdiq rasmi uchun /api/users/me/verification/upload ishlatiladi' });
    }
    const result = await processAndStoreImage(req.file.buffer, folder);
    // Report #7: manifest the upload so an orphan (never saved) is auto-reclaimed.
    await recordUpload({ key: result.key, url: result.url, storage: result.storage });

    res.json({
      url: result.url,
      filename: result.key,
      size: result.size,
      mimetype: result.mimetype,
      width: result.width,
      height: result.height,
      storage: result.storage,
    });
  } catch (err: any) {
    serverError(res, err, 'Rasm yuklashda xatolik yuz berdi');
  }
});

// POST /api/upload/video - Faza 13: upload a listing video (mp4/webm)
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1, fieldSize: 64 * 1024, parts: 8 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const mt = file.mimetype.toLowerCase();
    if (mt === 'video/mp4' || mt === 'video/webm') {
      cb(null, true);
    } else {
      cb(new Error("Faqat video fayllar (MP4, WebM) yuklanishi mumkin"));
    }
  },
});

router.post('/video', requireAuth, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Video fayl tanlanmadi' });
    }
    const folder = (req.query.folder as string) || 'videos';
    // F-06: video pipeline ham verifications papkasiga yozolmasin.
    if (isVerificationFolder(folder)) {
      return res.status(400).json({ error: 'Tasdiq rasmi uchun /api/users/me/verification/upload ishlatiladi' });
    }
    const result = await storeVideo(req.file.buffer, req.file.mimetype, folder);
    // Report #7: manifest the upload so an orphan (never saved) is auto-reclaimed.
    await recordUpload({ key: result.key, url: result.url, storage: result.storage });
    res.json({
      url: result.url,
      filename: result.key,
      size: result.size,
      mimetype: result.mimetype,
      media_type: 'video',
      storage: result.storage,
    });
  } catch (err: any) {
    serverError(res, err, 'Video yuklashda xatolik yuz berdi');
  }
});

// GET /api/storage/:folder/:file or /api/upload/storage/:folder/:file - Stream image from Cloudflare R2
router.get(['/storage/:folder/:file', '/:folder/:file'], async (req, res) => {
  try {
    // SECURITY (H-07): verification passport/selfie objects are personal data and
    // must not be reachable through the public storage proxy. They are served ONLY
    // via the signed /api/verification-photo endpoint. F-06: case-insensitive.
    if (isVerificationFolder(req.params.folder)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ error: 'Fayl topilmadi' });
    }
    const key = `${req.params.folder}/${req.params.file}`;
    if (!r2Client) {
      return res.status(404).json({ error: 'R2 storage not configured' });
    }

    const r2Response = await getR2ObjectStream(key);
    if (!r2Response || !r2Response.Body) {
      return res.status(404).json({ error: 'Fayl topilmadi' });
    }

    res.setHeader('Content-Type', r2Response.ContentType || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (r2Response.ContentLength) {
      res.setHeader('Content-Length', r2Response.ContentLength);
    }

    const stream = r2Response.Body as any;
    if (typeof stream.pipe === 'function') {
      stream.pipe(res);
    } else {
      const byteArray = await stream.transformToByteArray();
      res.send(Buffer.from(byteArray));
    }
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Rasm topilmadi' });
    }
    console.error('R2 streaming error:', err);
    res.status(500).json({ error: 'Rasm yuklanmadi' });
  }
});

export default router;
