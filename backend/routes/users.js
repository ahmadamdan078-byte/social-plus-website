const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { logAdminAction } = require('../audit');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function routerUsers() {
  const express = require('express');
  const router = express.Router();

  router.get('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const { q, status, role, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT id, email, name, role, status, provider, created_at, last_login_at FROM users WHERE deleted_at IS NULL`;
    const params = [];
    if (q) {
      sql += ` AND (email LIKE ? OR name LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    if (status) { sql += ` AND status = ?`; params.push(status); }
    if (role) { sql += ` AND role = ?`; params.push(role); }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const users = db.prepare(sql).all(...params);
    const total = db.prepare(`SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL`).get().c;
    res.json({ users, total });
  });

  router.get('/export', requireAuth, requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const users = db.prepare(`
      SELECT id, email, name, role, status, provider, created_at, last_login_at
      FROM users WHERE deleted_at IS NULL ORDER BY id
    `).all();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=users-export.json');
    res.send(JSON.stringify(users, null, 2));
  });

  router.post('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const { email, name, password, role = 'user' } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required' });
    const hash = password ? bcrypt.hashSync(password, 12) : null;
    try {
      const r = db.prepare(`
        INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)
      `).run(email.trim(), name || '', hash, role);
      logAdminAction(req.admin.id, 'create_user', 'user', r.lastInsertRowid, { email }, ip(req));
      res.status(201).json({ id: r.lastInsertRowid });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Email exists' });
      throw e;
    }
  });

  router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { name, role, status, email } = req.body || {};
    db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        role = COALESCE(?, role),
        status = COALESCE(?, status),
        email = COALESCE(?, email),
        updated_at = datetime('now')
      WHERE id = ? AND deleted_at IS NULL
    `).run(name, role, status, email, id);
    logAdminAction(req.admin.id, 'update_user', 'user', id, req.body, ip(req));
    res.json({ ok: true });
  });

  router.post('/:id/reset-password', requireAuth, requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { password } = req.body || {};
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password 8+ chars' });
    const hash = bcrypt.hashSync(password, 12);
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, id);
    logAdminAction(req.admin.id, 'reset_user_password', 'user', id, null, ip(req));
    res.json({ ok: true });
  });

  router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.prepare(`UPDATE users SET deleted_at = datetime('now'), status = 'deleted' WHERE id = ?`).run(id);
    logAdminAction(req.admin.id, 'soft_delete_user', 'user', id, null, ip(req));
    res.json({ ok: true });
  });

  router.post('/:id/restore', requireAuth, requirePermission(PERMISSIONS.MANAGE_USERS), (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.prepare(`UPDATE users SET deleted_at = NULL, status = 'active' WHERE id = ?`).run(id);
    logAdminAction(req.admin.id, 'restore_user', 'user', id, null, ip(req));
    res.json({ ok: true });
  });

  return router;
}

module.exports = routerUsers;
