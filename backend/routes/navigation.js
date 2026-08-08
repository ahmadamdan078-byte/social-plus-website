const { db } = require('../db');
const { logAdminAction } = require('../audit');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function routerNavigation() {
  const express = require('express');
  const router = express.Router();

  router.get('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const items = db.prepare(`SELECT * FROM navigation_items ORDER BY sort_order, id`).all();
    res.json({ items });
  });

  router.post('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const b = req.body || {};
    const r = db.prepare(`
      INSERT INTO navigation_items (label_en, label_ar, href, parent_id, visible, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(b.label_en, b.label_ar || '', b.href, b.parent_id || null, b.visible ?? 1, b.sort_order ?? 0);
    logAdminAction(req.admin.id, 'create_nav', 'navigation', r.lastInsertRowid, null, ip(req));
    res.status(201).json({ id: r.lastInsertRowid });
  });

  router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    db.prepare(`
      UPDATE navigation_items SET
        label_en = COALESCE(?, label_en), label_ar = COALESCE(?, label_ar),
        href = COALESCE(?, href), parent_id = COALESCE(?, parent_id),
        visible = COALESCE(?, visible), sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(b.label_en, b.label_ar, b.href, b.parent_id, b.visible, b.sort_order, id);
    logAdminAction(req.admin.id, 'update_nav', 'navigation', id, b, ip(req));
    res.json({ ok: true });
  });

  router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.prepare(`DELETE FROM navigation_items WHERE id = ? OR parent_id = ?`).run(id, id);
    logAdminAction(req.admin.id, 'delete_nav', 'navigation', id, null, ip(req));
    res.json({ ok: true });
  });

  router.post('/reorder', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const { order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order required' });
    const stmt = db.prepare(`UPDATE navigation_items SET sort_order = ? WHERE id = ?`);
    db.transaction((items) => items.forEach((id, i) => stmt.run(i, id)))(order);
    res.json({ ok: true });
  });

  return router;
}

module.exports = routerNavigation;
