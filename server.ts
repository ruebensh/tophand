// H-03: load .env BEFORE any module reads process.env. ES imports are hoisted
// and evaluated in source order, so this side-effect import must come first —
// the auth module captures JWT_SECRET at load time and would otherwise read an
// empty env (silently falling back to the insecure dev secret).
import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { initDatabase } from './server/db/init.ts';
import { startExpirationCron } from './server/services/expirationService.ts';
import { startMediaCleanupCron } from './server/services/mediaCleanupService.ts';
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
import leadRoutes from './server/routes/leadRoutes.ts';
import uploadRoutes from './server/routes/uploadRoutes.ts';
import settingRoutes from './server/routes/settingRoutes.ts';
import reviewRoutes from './server/routes/reviewRoutes.ts';
import catalogRoutes from './server/routes/catalogRoutes.ts';
import aiRoutes from './server/routes/aiRoutes.ts';
import walletRoutes from './server/routes/walletRoutes.ts';
import monetizationRoutes from './server/routes/monetizationRoutes.ts';
import adsRoutes from './server/routes/adsRoutes.ts';
import seoRoutes from './server/routes/seoRoutes.ts';
import translateRoutes from './server/routes/translateRoutes.ts';
import verifyMediaRoutes from './server/routes/verifyMediaRoutes.ts';
import { EXPOSED, LOCAL_DEV } from './server/lib/envSecurity.ts';
import { MEDIA_SIGNING_ENABLED } from './server/lib/signedUrl.ts';
import { REQUIRES_PRIVATE_BUCKET_CHECK } from './server/services/storageService.ts';
import { buildRateLimit, resolveTrustProxy } from './server/lib/rateLimit.ts';
import { verifiedUserIdFromRequest } from './server/auth/telegram.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const GOOGLE_CLIENT_ID_FOR_STARTUP = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();

// F-03: trust proxy deployment topologiyasiga mos bo'lishi SHART.
// default `1` = bitta ishonchli reverse proxy. Cloudflare→Render kabi IKKI
// hop'lik zanjirda TRUST_PROXY=2 qo'ying; app portiga bevosita tashqi ulanish
// bo'lsa TRUST_PROXY=0 (proxy header'larga umuman ishonilmaydi). Noto'g'ri
// qiymat Express startda fail qiladi — sezgir, sekin buzilmaydigan xatti-harakat.
app.set('trust proxy', resolveTrustProxy(process.env.TRUST_PROXY));

// ESLATMA: www ↔ apex kanonik redirect'ni ilova (app) darajasida QILMAYMIZ.
// Render/Cloudflare o'zi apex→www redirect'ni bajaradi; agarda biz bu yerga
// tesqarisini (www→apex) qo'shsak, ikki redirect cheksiz halqa (ERR_TOO_MANY_
// REDIRECTS) hosil qiladi. Kanonik domen = https://www.tophand.uz (SITE_URL).

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Production hardening: security headers + in-memory rate limiting ──
// Baseline headers are always set; HSTS + a Content-Security-Policy are only
// applied in production (M-13) so local Vite dev (HMR / inline scripts) keeps
// working. The CSP is deliberately permissive on image/script/style origins
// because the app loads Google Identity Services, Google Fonts, arbitrary https
// listing/cover images and R2 media; a stricter nonce/hash CSP is a follow-up.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com https://apis.google.com 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

// Strict security headers (HSTS + CSP) are applied in ANY internet-exposed env
// (production/staging/preview/unset NODE_ENV), not only NODE_ENV=production.
// Local dev/test skips them so Vite HMR / inline scripts keep working.
const IS_PROD_SERVER = EXPOSED;
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(self), camera=(), microphone=(), payment=(), usb=()'
  );
  if (IS_PROD_SERVER) {
    // 2 years + include subdomains + preload. Only meaningful over HTTPS.
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Content-Security-Policy', CSP);
  }
  next();
});

// ── Rate limiting (F-01/F-02 qayta yozilgan) ──
// Bucket kaliti = STATIK scope + TASDIQLANGAN identity (JWT imzosi tekshirilgan
// userId, aks holda trust-proxy orqali hisoblangan req.ip). Xom Authorization
// qiymati va req.path kalitga KIRMAYDI — soxta bearer/dynamic path bilan
// bucket ko'paytirib bo'lmaydi; store bounded (max keys + eviction).
// Multi-instance: RedisBucketStore kabi shared store ulanadi (infra).
function limiterIdentity(req: express.Request): string {
  if (EXPOSED) {
    const uid = verifiedUserIdFromRequest(req);
    if (uid) return `u:${uid}`;
  }
  return `ip:${req.ip || 'unknown'}`;
}

function rateLimit(opts: { windowMs: number; max: number; message: string; scope: string }) {
  return buildRateLimit({ ...opts, identity: limiterIdentity });
}

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, scope: '/api/auth', message: "Juda ko'p urinish. Birozdan so'ng qayta urinib ko'ring." });
const codeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, scope: '/api/code', message: "Kod yuborish chegarasi oshdi. 1 soatdan so'ng urinib ko'ring." });
// Mashina-tarjimasi pullli API'ni himoya qilish: bir identity uchun soatiga cheklov.
const translateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 300, scope: '/api/translate', message: "Tarjima chegarasi oshdi. Birozdan so'ng urinib ko'ring." });

// ── DDoS / abuse hardening (M-03): mutatsiya-limited rate limiters ──
// Faqat yozuv/og'ir (POST/PUT/PATCH/DELETE) so'rovlar hisoblanadi — GET (o'qish/
// browse) cheklanmaydi. In-memory bounded store; multi-instance uchun Redis kerak.
function mutateLimiter(opts: { windowMs: number; max: number; message: string; scope: string }) {
  const inner = rateLimit(opts);
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const m = req.method.toUpperCase();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
    return inner(req, res, next);
  };
}
const contentLimiter = mutateLimiter({ windowMs: 15 * 60 * 1000, max: 60, scope: '/api/content', message: "Juda ko'p amallar. Birozdan so'ng urinib ko'ring." });
const chatLimiter = mutateLimiter({ windowMs: 60 * 1000, max: 60, scope: '/api/chat', message: "Juda ko'p xabar. Biroz kuting." });
const aiLimiter = mutateLimiter({ windowMs: 60 * 60 * 1000, max: 120, scope: '/api/ai', message: "AI chegarasi oshdi. Birozdan so'ng urinib ko'ring." });
const uploadLimiter = mutateLimiter({ windowMs: 15 * 60 * 1000, max: 120, scope: '/api/upload', message: "Yuklash chegarasi oshdi. Birozdan so'ng urinib ko'ring." });
// P2-4: umumiy mutation guard (users, saved, notifications, push, moderation,
// messaging, admin, settings, theme, ads yozuvlari).
const mutateGuard = mutateLimiter({ windowMs: 15 * 60 * 1000, max: 120, scope: '/api/mutate', message: "Juda ko'p amallar. Birozdan so'ng urinib ko'ring." });
// Admin export GET, lekin qimmat (full-table XLSX) → GET sanovchi limiter.
const exportLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 20, scope: '/api/admin/export', message: "Eksport chegarasi oshdi. Birozdan so'ng urinib ko'ring." });

// F-02: koddagi qat'iy limiter — barcha email-code yuboruvchi route'lar uchun
// (register/send-code, forgot-password, authenticated /email/send-code). Uch
// o'lchovli: identity (verified userId yoki IP) + MAQSADLI EMAIL + cooldown.
// Invalid so'rovlar (emailsiz) faqat identity bucket'ini ishlatadi — cheksiz
// yangi bucket yaralmaydi. 1 soatda 10 ta, bir xil identity+email juftligiga
// 30 sek cooldown.
function codeSendLimiter(scope: string) {
  const perHour = buildRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    scope,
    message: "Kod yuborish chegarasi oshdi. 1 soatdan so'ng urinib ko'ring.",
    identity: (req) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
      return `${limiterIdentity(req)}|${email || '-'}`;
    },
  });
  const cooldown = buildRateLimit({
    windowMs: 30 * 1000,
    max: 1,
    scope: `${scope}:cd`,
    message: "Bu email'ga kod yuborish uchun juda tez — 30 soniya kuting.",
    identity: (req) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
      return `${limiterIdentity(req)}|${email || '-'}`;
    },
  });
  return [cooldown, perHour] as const;
}
const emailCodeLimiters = codeSendLimiter('/api/auth/email/send-code');

// Static assets with permissive CORS & Cross-Origin-Resource-Policy for browser
// image loading. Scoped to NON-/api paths only (L-04): the API is same-origin and
// must not get a wildcard Access-Control-Allow-Origin on every response.
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  next();
});

// Static uploads folder
const uploadDir = path.resolve(process.cwd(), 'uploads');
// SECURITY (H-07): verification passport/selfie images are personal data. Block
// them from the public /uploads static route entirely — they are served ONLY via
// the signed /api/verification-photo endpoint below.
app.use('/uploads/verifications', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).json({ error: 'Not found' });
});
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
// F-02: ENDI authenticated `/api/auth/email/send-code` ham strict codeLimiter +
// 30s cooldown ostida (identity + maqsadli email bo'yicha).
app.use('/api/auth/register/send-code', codeLimiter);
app.use('/api/auth/forgot-password', codeLimiter);
app.use('/api/auth/email/send-code', ...emailCodeLimiters);
app.use('/api/auth', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/verification-photo', verifyMediaRoutes);
app.use('/api/users', mutateGuard, userRoutes);
app.use('/api/listings', contentLimiter, listingRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/saved-listings', mutateGuard, savedRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/organizations', contentLimiter, organizationRoutes);
app.use('/api/notifications', mutateGuard, notificationRoutes);
app.use('/api/push', mutateGuard, pushRoutes);
app.use('/api/moderation', mutateGuard, moderationRoutes);
app.use('/api/messaging', mutateGuard, messagingRoutes);
app.use('/api/admin/export', exportLimiter);
app.use('/api/admin', mutateGuard, adminRoutes);
app.use('/api/lead', mutateGuard, leadRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes);
app.use('/api/storage', uploadLimiter, uploadRoutes);
app.use('/api/settings', mutateGuard, settingRoutes);
app.use('/api/reviews', contentLimiter, reviewRoutes);
app.use('/api/wallet', contentLimiter, walletRoutes);
app.use('/api/monetization', contentLimiter, monetizationRoutes);
app.use('/api/ads', mutateGuard, adsRoutes);
app.use('/api/translate', translateLimiter, translateRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Centralized API error handler
app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  const status = err.status || 500;
  // F-10: ichki 5xx xabarlari HECH qanday muhitda (LOCAL_DEV=1 da ham) sizib
  // chiqmaydi. 4xx — mijoz uchun atayli xabar, ko'rsatiladi.
  const expose = status >= 400 && status < 500;
  res.status(status).json({
    error: expose ? (err.message || 'So‘rovni bajarib bo‘lmadi') : 'Serverda ichki xatolik yuz berdi',
  });
});

async function startServer() {
  try {
    // Fail-closed visibility (H-01/H-02): in any internet-exposed env, warn
    // loudly about any missing critical integration so a mis-deploy is caught
    // immediately. The hard failures (JWT_SECRET, DATABASE_URL) throw at module load.
    if (EXPOSED) {
      const hasMail = Boolean(
        (process.env.BREVO_API_KEY || '').trim() ||
        (process.env.SMTP_USER && process.env.SMTP_PASS)
      );
      const hasGoogle = Boolean(GOOGLE_CLIENT_ID_FOR_STARTUP);
      if (!hasMail) console.warn("⚠️  [exposed] Email provider YO'Q — ro'yxatdan o'tish/parol tiklash ishlamaydi (BREVO_API_KEY yoki SMTP).");
      if (!hasGoogle) console.warn("⚠️  [exposed] GOOGLE_CLIENT_ID YO'Q — Google login fail-closed bo'ladi.");
      // P2-1: verification-media signing needs a strong secret. In an exposed env
      // JWT_SECRET is already mandatory, but a short one disables signed serving.
      if (!MEDIA_SIGNING_ENABLED) {
        console.warn("⚠️  [exposed] Verification-media imzolash O'CHIQ (JWT_SECRET/VERIFICATION_MEDIA_SECRET kamida 16 belgi bo'lishi kerak) — tasdiq rasmlari ko'rsatilmaydi.");
      }
      // P1-1/F-07: R2-yoqilgan EXPOSED deploymentda `R2_PRIVATE_BUCKET_NAME`
      // MAJBURIY — aks holda verification obyektlari oddiy (mmkin public-read)
      // bucket'ga yoziladi va provider ACL'siga bog'liq privacy bypass qoladi.
      // Warning bilan DAVOM ETMAYDI — startup fail (fail-closed).
      if (REQUIRES_PRIVATE_BUCKET_CHECK()) {
        throw new Error(
          "FATAL [exposed]: R2_PRIVATE_BUCKET_NAME sozlanmagan — tasdiq hujjatlari public bucket'ga yozilmaydi. Alohida YOPIQ R2 bucket yarating (public read + CDN yo'q), bu env'ga R2_PRIVATE_BUCKET_NAME qo'ying va eski verifications/* obyektlarini ko'chiring (`npm run migrate:verifications`)."
        );
      }
    }

    // 1. Initialize PostgreSQL database & seed data
    await initDatabase();

    // 2. Start background cron for listing lifecycle (configurable active-days) & notifications
    startExpirationCron();

    // 2b. Media cleanup cron (report #6/#7/#10): retry failed deletes + reclaim
    //     orphan uploads and abandoned verification previews past a TTL.
    startMediaCleanupCron();

    // 3. Vite development middleware or static production build.
    // SECURITY (P1-3): the Vite dev middleware binds 0.0.0.0 and exposes source,
    // HMR and unbundled modules — it must NEVER run in an internet-exposed env
    // (staging/preview/unset/production). It is gated ONLY on explicit LOCAL_DEV=1
    // (set by `npm run dev`), not on NODE_ENV. Any other mode serves the built dist/.
    const isDev = LOCAL_DEV;

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

// Eksport: integration testlar (scripts/test-integration.ts) real middleware
// zanjirini `listen(0)` bilan tekshirishi uchun.
export { app };

// Faqat BEVOSITA ishga tushirilganda listen qiladi (testda import qilinganda
// start bo'lmaydi).
const isMainModule = process.argv[1]
  ? path.resolve(process.argv[1]).replace(/\.[cm]?[jt]s$/, '') === path.resolve('server.ts').replace(/\.[cm]?[jt]s$/, '')
  : true;
if (isMainModule) {
  startServer();
}
