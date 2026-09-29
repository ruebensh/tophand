import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { initDatabase } from './server/db/init.ts';
import { startExpirationCron } from './server/services/expirationService.ts';

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
import moderationRoutes from './server/routes/moderationRoutes.ts';
import adminRoutes from './server/routes/adminRoutes.ts';
import uploadRoutes from './server/routes/uploadRoutes.ts';
import settingRoutes from './server/routes/settingRoutes.ts';
import reviewRoutes from './server/routes/reviewRoutes.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads folder
const uploadDir = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadDir));

// Static public assets folder (logos, icons, favicons)
const publicDir = path.resolve(process.cwd(), 'public');
app.use(express.static(publicDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/saved-listings', savedRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/reviews', reviewRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Centralized API error handler
app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Serverda ichki xatolik yuz berdi',
  });
});

async function startServer() {
  try {
    // 1. Initialize SQLite Database & Seed Data
    await initDatabase();

    // 2. Start background cron for 30-day listing lifecycle & notifications
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
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distDir, 'index.html'));
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
