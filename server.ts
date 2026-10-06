import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDatabase } from './server/db/init.ts';
import { startExpirationCron } from './server/services/expirationService.ts';
import { getSeoMeta, injectSeo } from './server/services/seoService.ts';

// Routes
import authRoutes from './server/routes/authRoutes.ts';
import userRoutes from './server/routes/userRoutes.ts';
import listingRoutes from './server/routes/listingRoutes.ts';
import chatRoutes from './server/routes/chatRoutes.ts';
import savedRoutes from './server/routes/savedRoutes.ts';
import locationRoutes from './server/routes/locationRoutes.ts';
import categoryRoutes from './server/routes/categoryRoutes.ts';
import organizationRoutes from './server/routes/organizationRoutes.ts';
import notificationRoutes from './server/routes/notificationRoutes.ts';
import pushRoutes from './server/routes/pushRoutes.ts';
import moderationRoutes from './server/routes/moderationRoutes.ts';
import messagingRoutes from './server/routes/messagingRoutes.ts';
import adminRoutes from './server/routes/adminRoutes.ts';
import uploadRoutes from './server/routes/uploadRoutes.ts';
import settingRoutes from './server/routes/settingRoutes.ts';
import themeRoutes from './server/routes/themeRoutes.ts';
import reviewRoutes from './server/routes/reviewRoutes.ts';
import catalogRoutes from './server/routes/catalogRoutes.ts';
import aiRoutes from './server/routes/aiRoutes.ts';
import walletRoutes from './server/routes/walletRoutes.ts';
import monetizationRoutes from './server/routes/monetizationRoutes.ts';
import adsRoutes from './server/routes/adsRoutes.ts';
import seoRoutes from './server/routes/seoRoutes.ts';
import translateRoutes from './server/routes/translateRoutes.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Trust the first proxy (Render/Cloudflare) so req.ip / X-Forwarded-For is correct.
app.set('trust proxy', 1);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Production hardening: basic security headers + in-memory rate limiting ──
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function rateLimit(opts: { windowMs: number; max: number; message: string }) {
  const hits = new Map<string, { count: number; reset: number }>();
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  }, Math.max(opts.windowMs, 60_000));
  if (typeof sweeper.unref === 'function') sweeper.unref();

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const key = `${ip}|${req.baseUrl}${req.path}`;
    const now = Date.now();
    let rec = hits.get(key);
    if (!rec || now > rec.reset) {
      rec = { count: 0, reset: now + opts.windowMs };
      hits.set(key, rec);
    }
    rec.count++;
    if (rec.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((rec.reset - now) / 1000)));
      return res.status(429).json({ error: opts.message });
    }
    next();
  };
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring." });
const codeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: "Kod yuborish chegarasi oshdi. 1 soatdan so'ng urinib ko'ring." });
// Mashina-tarjimasi pullli API'ni himoya qilish: bir IP uchun soatiga cheklov.
const translateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 300, message: "Tarjima chegarasi oshdi. Birozdan so'ng urinib ko'ring." });

// Static assets with permissive CORS & Cross-Origin-Resource-Policy for browser image loading
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Static uploads folder
const uploadDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadDir, {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// Static public assets folder (logos, icons, favicons)
const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir, {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// SEO: robots.txt va dinamik sitemap.xml (Google Search Console uchun)
app.use(seoRoutes);

// API Routes
// Rate-limit auth endpoints: strict on code-sending (email bombing), general on all auth.
app.use('/api/auth/register/send-code', codeLimiter);
app.use('/api/auth/forgot-password', codeLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/saved-listings', savedRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/messaging', messagingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/storage', uploadRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/theme', themeRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/monetization', monetizationRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/translate', translateLimiter, translateRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Centralized API error handler
app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  const isProd = process.env.NODE_ENV === 'production';
  const status = err.status || 500;
  // In production, never leak internal 5xx messages (DB/SQL details, stack, etc.).
  const expose = !isProd || (status >= 400 && status < 500);
  res.status(status).json({
    error: expose ? (err.message || 'So‘rovni bajarib bo‘lmadi') : 'Serverda ichki xatolik yuz berdi',
  });
});

async function startServer() {
  try {
    // 1. Initialize PostgreSQL database & seed data
    await initDatabase();

    // 2. Start background cron for listing lifecycle (configurable active-days) & notifications
    startExpirationCron();

    // 3. Vite development middleware or static production build
    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distDir, { index: false }));
      app.get('*', async (req, res) => {
        const htmlFile = path.resolve(distDir, 'index.html');
        const googleClientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
        try {
          let html = fs.readFileSync(htmlFile, 'utf8');
          // Dinamik sahifa SEO (e'lon/kategoriya) — Google keng qamrov olsin uchun
          try {
            const meta = await getSeoMeta(req.path);
            if (meta) html = injectSeo(html, meta);
          } catch {
            /* static defaults remain */
          }
          if (googleClientId) {
            html = html.replace(
              '</head>',
              `<script>window.__GOOGLE_CLIENT_ID__ = ${JSON.stringify(googleClientId)};</script></head>`
            );
          }
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.send(html);
        } catch {
          res.sendFile(htmlFile);
        }
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`TopHand server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start TopHand server:', error);
    process.exit(1);
  }
}

startServer();
