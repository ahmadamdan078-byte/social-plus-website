const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { seed } = require('./backend/seed');
const routerAuth = require('./backend/routes/auth');
const routerContent = require('./backend/routes/content');
const routerUsers = require('./backend/routes/users');
const routerServices = require('./backend/routes/services');
const routerOrders = require('./backend/routes/orders');
const routerSettings = require('./backend/routes/settings');
const routerDesign = require('./backend/routes/design');
const routerNavigation = require('./backend/routes/navigation');
const routerAnalytics = require('./backend/routes/analytics');
const { routerLogs, routerDatabase } = require('./backend/routes/logs');
const routerPublic = require('./backend/routes/public');
const { requireAuth, requirePermission } = require('./backend/middleware/auth');
const { PERMISSIONS } = require('./backend/permissions');
const { db } = require('./backend/db');
const { logAdminAction } = require('./backend/audit');

const PORT = process.env.PORT || 5500;
const ROOT = path.join(__dirname);
const UPLOADS_DIR = path.join(ROOT, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

seed();

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many login attempts' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });

app.post('/api/media/upload', express.raw({ type: '*/*', limit: '15mb' }), requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
  const filename = req.headers['x-filename'];
  const mime = req.headers['content-type'] || 'application/octet-stream';
  if (!filename || !req.body?.length) return res.status(400).json({ error: 'File required' });
  const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const unique = `${Date.now()}-${safe}`;
  const filepath = path.join(UPLOADS_DIR, unique);
  fs.writeFileSync(filepath, req.body);
  const url = `/uploads/${unique}`;
  const r = db.prepare(`
    INSERT INTO media_assets (filename, url, mime_type, size_bytes, uploaded_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(safe, url, mime, req.body.length, req.admin.id);
  logAdminAction(req.admin.id, 'upload_media', 'media', r.lastInsertRowid, { url }, req.ip);
  res.status(201).json({ id: r.lastInsertRowid, url });
});

app.use(express.json({ limit: '10mb' }));

app.use('/api/auth/login', authLimiter);
app.use('/api', apiLimiter);

app.use('/api/auth', routerAuth());
app.use('/api/content', routerContent());
app.use('/api/users', routerUsers());
app.use('/api/services', routerServices());
app.use('/api/orders', routerOrders());
app.use('/api/settings', routerSettings());
app.use('/api/design', routerDesign());
app.use('/api/navigation', routerNavigation());
app.use('/api/analytics', routerAnalytics());
app.use('/api/logs', routerLogs());
app.use('/api/database', routerDatabase());
app.use('/api/public', routerPublic());

app.get('/api/media', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
  const assets = db.prepare(`SELECT * FROM media_assets WHERE deleted_at IS NULL ORDER BY created_at DESC`).all();
  res.json({ assets });
});

app.delete('/api/media/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const asset = db.prepare(`SELECT * FROM media_assets WHERE id = ?`).get(id);
  if (asset) {
    db.prepare(`UPDATE media_assets SET deleted_at = datetime('now') WHERE id = ?`).run(id);
    const fp = path.join(UPLOADS_DIR, path.basename(asset.url));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  res.json({ ok: true });
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(express.static(ROOT, {
  index: 'index.html',
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html') || filePath.includes('/admin/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(ROOT, 'admin', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Social Plus server running on http://localhost:${PORT}`);
  console.log(`Admin Control Center: http://localhost:${PORT}/admin`);
});
