const { db } = require('../db');
const { logAdminAction } = require('../audit');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');
const { getPlanPricing, setPlanPricing } = require('../services/plan-pricing');

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function routerServices() {
  const express = require('express');
  const router = express.Router();

  router.get('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_PRODUCTS), (req, res) => {
    const items = db.prepare(`
      SELECT * FROM services WHERE deleted_at IS NULL ORDER BY sort_order, id
    `).all();
    res.json({ services: items });
  });

  router.post('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_PRODUCTS), (req, res) => {
    const b = req.body || {};
    const r = db.prepare(`
      INSERT INTO services (title_en, title_ar, description_en, description_ar, price, category, image_url, featured, visible, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      b.title_en, b.title_ar || '', b.description_en || '', b.description_ar || '',
      b.price ?? 0, b.category || 'general', b.image_url || null,
      b.featured ? 1 : 0, b.visible ?? 1, b.sort_order ?? 0
    );
    logAdminAction(req.admin.id, 'create_service', 'service', r.lastInsertRowid, null, ip(req));
    res.status(201).json({ id: r.lastInsertRowid });
  });

  router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_PRODUCTS), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    db.prepare(`
      UPDATE services SET
        title_en = COALESCE(?, title_en), title_ar = COALESCE(?, title_ar),
        description_en = COALESCE(?, description_en), description_ar = COALESCE(?, description_ar),
        price = COALESCE(?, price), category = COALESCE(?, category),
        image_url = COALESCE(?, image_url), featured = COALESCE(?, featured),
        visible = COALESCE(?, visible), sort_order = COALESCE(?, sort_order)
      WHERE id = ? AND deleted_at IS NULL
    `).run(
      b.title_en, b.title_ar, b.description_en, b.description_ar, b.price, b.category,
      b.image_url, b.featured != null ? (b.featured ? 1 : 0) : null,
      b.visible != null ? (b.visible ? 1 : 0) : null, b.sort_order, id
    );
    logAdminAction(req.admin.id, 'update_service', 'service', id, b, ip(req));
    if (b.price != null) {
      const row = db.prepare(`SELECT title_en, category FROM services WHERE id = ?`).get(id);
      if (row?.category === 'pricing') {
        const tier = (row.title_en || '').trim().toLowerCase();
        if (['starter', 'growth', 'pro'].includes(tier)) {
          const plans = getPlanPricing();
          plans[tier] = Number(b.price);
          setPlanPricing(plans);
        }
      }
    }
    res.json({ ok: true });
  });

  router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_PRODUCTS), (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.prepare(`UPDATE services SET deleted_at = datetime('now') WHERE id = ?`).run(id);
    logAdminAction(req.admin.id, 'soft_delete_service', 'service', id, null, ip(req));
    res.json({ ok: true });
  });

  router.post('/reorder', requireAuth, requirePermission(PERMISSIONS.MANAGE_PRODUCTS), (req, res) => {
    const { order } = req.body || {};
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array required' });
    const stmt = db.prepare(`UPDATE services SET sort_order = ? WHERE id = ?`);
    const tx = db.transaction((items) => items.forEach((id, i) => stmt.run(i, id)));
    tx(order);
    res.json({ ok: true });
  });

  return router;
}

module.exports = routerServices;
