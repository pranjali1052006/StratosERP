import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { testConnection, ensureAuthSchema, disconnect } from './config/database';
import { ensureBucketsExist } from './config/minio';

// Route imports
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import hodRoutes from './routes/hod.routes';
import classInchargeRoutes from './routes/classIncharge.routes';
import subjectInchargeRoutes from './routes/subjectIncharge.routes';
import practicalTeacherRoutes from './routes/practicalTeacher.routes';
import teacherGuardianRoutes from './routes/teacherGuardian.routes';
import studentRoutes from './routes/student.routes';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/class-incharge', classInchargeRoutes);
app.use('/api/subject-incharge', subjectInchargeRoutes);
app.use('/api/practical-teacher', practicalTeacherRoutes);
app.use('/api/teacher-guardian', teacherGuardianRoutes);
app.use('/api/student', studentRoutes);

// ── Health check ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'StratosERP API is running.', timestamp: new Date().toISOString() });
});

// ── 404 fallback ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Start ───────────────────────────────────────────────────
(async () => {
  try {
    await testConnection();
    await ensureAuthSchema();
    const minioReady = await ensureBucketsExist();
    if (!minioReady) {
      console.warn('[Server] MinIO unavailable at startup. File storage endpoints will return 503 until MinIO is restored.');
    }
    const server = app.listen(PORT, () => {
      console.log(`[Server] StratosERP API running on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('[Server] Shutting down...');
      await disconnect();
      server.close();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
})();

export default app;
