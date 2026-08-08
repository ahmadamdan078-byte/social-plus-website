const fs = require('fs');
const path = require('path');
const { db, DB_PATH } = require('../db');
const { requireAuth, requirePermission, requireSuperAdmin } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');
const { logAdminAction } = require('../audit');

const ALLOWED_TABLES = [
  'users', 'services', 'orders', 'site_content', 'site_sections',
  'navigation_items', 'faqs', 'testimonials', 'announcements', 'site_settings'
];

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function routerLogs() {
  const express = require('express');
  const router = express.Router();

  router.get('/admin', requireAuth, requirePermission(PERMISSIONS.VIEW_LOGS), (req, res) => {
    const { limit = 100, offset = 0 } = req.query;
    const logs = db.prepare(`
      SELECT l.*, a.email as admin_email FROM admin_logs l
      LEFT JOIN admins a ON a.id = l.admin_id
      ORDER BY l.created_at DESC LIMIT ? OFFSET ?
    `).all(parseInt(limit, 10), parseInt(offset, 10));
    res.json({ logs });
  });

  router.get('/login', requireAuth, requirePermission(PERMISSIONS.VIEW_LOGS), (req, res) => {
    const { limit = 100 } = req.query;
    const history = db.prepare(`
      SELECT h.*, a.email as admin_email FROM login_history h
      LEFT JOIN admins a ON a.id = h.admin_id
      ORDER BY h.created_at DESC LIMIT ?
    `).all(parseInt(limit, 10));
    res.json({ history });
  });

  return router;
}

function routerDatabase() {
  const express = require('express');
  const router = express.Router();

  router.get('/tables', requireAuth, requirePermission(PERMISSIONS.MANAGE_DATABASE), (req, res) => {
    res.json({ tables: ALLOWED_TABLES });
  });

  router.get('/backup/export', requireAuth, requireSuperAdmin, (req, res) => {
    const backup = {};
    ALLOWED_TABLES.forEach((t) => {
      backup[t] = db.prepare(`SELECT * FROM ${t}`).all();
    });
    backup._meta = { exported_at: new Date().toISOString(), by: req.admin.email };
    logAdminAction(req.admin.id, 'db_backup', 'database', null, null, ip(req));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=social-plus-backup-${Date.now()}.json`);
    res.send(JSON.stringify(backup, null, 2));
  });

  router.post('/backup/restore', requireAuth, requireSuperAdmin, (req, res) => {
    const confirm = req.headers['x-confirm-restore'];
    if (confirm !== 'yes') return res.status(400).json({ error: 'Confirmation required', requireConfirm: true });
    const backup = req.body;
    if (!backup || typeof backup !== 'object') return res.status(400).json({ error: 'Invalid backup' });
    const tx = db.transaction(() => {
      ALLOWED_TABLES.forEach((t) => {
        if (Array.isArray(backup[t])) {
          db.prepare(`DELETE FROM ${t}`).run();
          if (backup[t].length) {
            const sample = backup[t][0];
            const keys = Object.keys(sample);
            const ins = db.prepare(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`);
            backup[t].forEach((row) => ins.run(...keys.map((k) => row[k])));
          }
        }
      });
    });
    tx();
    logAdminAction(req.admin.id, 'db_restore', 'database', null, null, ip(req));
    res.json({ ok: true });
  });

  router.get('/:table', requireAuth, requirePermission(PERMISSIONS.MANAGE_DATABASE), (req, res) => {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Table not allowed' });
    const { q, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT * FROM ${table}`;
    const params = [];
    if (q && table === 'users') {
      sql += ` WHERE email LIKE ? OR name LIKE ?`;
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const rows = db.prepare(sql).all(...params);
    res.json({ rows, table });
  });

  router.post('/:table', requireAuth, requireSuperAdmin, (req, res) => {
    const table = req.params.table;
    if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Table not allowed' });
    const data = req.body || {};
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'No data' });
    const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    const r = db.prepare(sql).run(...keys.map((k) => data[k]));
    logAdminAction(req.admin.id, 'db_create', table, r.lastInsertRowid, data, ip(req));
    res.status(201).json({ id: r.lastInsertRowid });
  });

  router.patch('/:table/:id', requireAuth, requireSuperAdmin, (req, res) => {
    const table = req.params.table;
    const id = req.params.id;
    if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Table not allowed' });
    const data = req.body || {};
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'No data' });
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...keys.map((k) => data[k]), id);
    logAdminAction(req.admin.id, 'db_update', table, id, data, ip(req));
    res.json({ ok: true });
  });

  router.delete('/:table/:id', requireAuth, requireSuperAdmin, (req, res) => {
    const table = req.params.table;
    const id = req.params.id;
    if (!ALLOWED_TABLES.includes(table)) return res.status(403).json({ error: 'Table not allowed' });
    const confirm = req.headers['x-confirm-delete'];
    if (confirm !== 'yes') return res.status(400).json({ error: 'Confirmation required', requireConfirm: true });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    logAdminAction(req.admin.id, 'db_delete', table, id, null, ip(req));
    res.json({ ok: true });
  });

  return router;
}

module.exports = { routerLogs, routerDatabase };
