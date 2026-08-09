const { db } = require('../db');
const { logAdminAction } = require('../audit');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');
const { getPlanPricing, setPlanPricing } = require('../services/plan-pricing');

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function getSettingsMap(category) {
  let sql = `SELECT key, value, category FROM site_settings`;
  const params = [];
  if (category) { sql += ` WHERE category = ?`; params.push(category); }
  const rows = db.prepare(sql).all(...params);
  const map = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return map;
}

function routerSettings() {
  const express = require('express');
  const router = express.Router();

  router.get('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    res.json({ settings: getSettingsMap() });
  });

  router.put('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    const { settings } = req.body || {};
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object required' });
    const upsert = db.prepare(`
      INSERT INTO site_settings (key, value, category, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, category = excluded.category, updated_at = datetime('now')
    `);
    const tx = db.transaction((obj) => {
      Object.entries(obj).forEach(([key, val]) => {
        const category = key.startsWith('seo_') ? 'seo' : key.startsWith('social_') ? 'social' : key.startsWith('security_') ? 'security' : 'general';
        upsert.run(key, typeof val === 'string' ? val : JSON.stringify(val), category);
      });
    });
    tx(settings);
    logAdminAction(req.admin.id, 'update_settings', 'settings', null, { keys: Object.keys(settings) }, ip(req));
    res.json({ ok: true });
  });

  router.get('/plan-pricing', (req, res) => {
    res.json({ plans: getPlanPricing() });
  });

  router.put('/plan-pricing', requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS), (req, res) => {
    const body = req.body || {};
    const plans = setPlanPricing({
      starter: body.starter,
      growth: body.growth,
      pro: body.pro
    });
    logAdminAction(req.admin.id, 'update_plan_pricing', 'pricing', null, plans, ip(req));
    res.json({ ok: true, plans });
  });

  return router;
}

module.exports = routerSettings;
