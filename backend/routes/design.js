const { db } = require('../db');
const { logAdminAction } = require('../audit');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function routerDesign() {
  const express = require('express');
  const router = express.Router();

  router.get('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_DESIGN), (req, res) => {
    const rows = db.prepare(`SELECT key, value FROM design_settings`).all();
    const design = {};
    rows.forEach((r) => { design[r.key] = r.value; });
    res.json({ design });
  });

  router.put('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_DESIGN), (req, res) => {
    const { design, publish } = req.body || {};
    if (!design || typeof design !== 'object') return res.status(400).json({ error: 'design object required' });
    const upsert = db.prepare(`
      INSERT INTO design_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    const tx = db.transaction((obj) => {
      Object.entries(obj).forEach(([key, val]) => upsert.run(key, String(val)));
    });
    tx(design);
    if (publish) {
      db.prepare(`
        INSERT INTO site_settings (key, value, category, updated_at)
        VALUES ('design_published_at', datetime('now'), 'design', datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = datetime('now'), updated_at = datetime('now')
      `).run();
    }
    logAdminAction(req.admin.id, publish ? 'publish_design' : 'update_design', 'design', null, { keys: Object.keys(design) }, ip(req));
    res.json({ ok: true });
  });

  return router;
}

module.exports = routerDesign;
