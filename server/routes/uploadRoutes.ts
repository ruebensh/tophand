import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth/telegram.ts';
import { processAndStoreImage, storeVideo, getR2ObjectStream, r2Client } from '../services/storageService.ts';

const router = Router();

// Store file in memory to allow Sharp to optimize before storing to Cloudflare R2 / disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // Allow up to 15MB upload, Sharp compresses it down to ~100KB WebP!
  },
  fileFilter: (_req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/heic'];
    if (allowedMime.includes(file.mimetype.toLowerCase()) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Faqat rasm fayllari (JPEG, PNG, WebP) yuklanishi mumkin'));
    }
  },
});

// POST /api/upload - Upload and optimize image (WebP + Cloudflare R2)
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Rasm fayli tanlanmadi' });
    }

    const folder = (req.query.folder as string) || 'listings';
    const result = await processAndStoreImage(req.file.buffer, folder);

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
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Rasm yuklashda xatolik yuz berdi' });
  }
});

// POST /api/upload/video - Faza 13: upload a listing video (mp4/webm)
const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
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
    const result = await storeVideo(req.file.buffer, req.file.mimetype, folder);
    res.json({
      url: result.url,
      filename: result.key,
      size: result.size,
      mimetype: result.mimetype,
      media_type: 'video',
      storage: result.storage,
    });
  } catch (err: any) {
    console.error('Video upload error:', err);
    res.status(500).json({ error: err.message || 'Video yuklashda xatolik yuz berdi' });
  }
});

// GET /api/storage/:folder/:file or /api/upload/storage/:folder/:file - Stream image from Cloudflare R2
router.get(['/storage/:folder/:file', '/:folder/:file'], async (req, res) => {
  try {
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
