const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { db } = require('../db');
const { logAdminAction, logLogin } = require('../audit');
const {
  createSession,
  revokeSession,
  revokeAllSessions,
  getAdminById,
  hashToken,
  requireAuth,
  requireSuperAdmin
} = require('../middleware/auth');
const { PERMISSIONS, ALL_PERMISSIONS, ROLE_DEFAULTS } = require('../permissions');

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function routerAuth() {
  const express = require('express');
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { email, password, totpCode } = req.body || {};
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const admin = db.prepare(`
      SELECT * FROM admins WHERE email = ? COLLATE NOCASE AND deleted_at IS NULL
    `).get(email.trim());

    if (!admin || admin.status !== 'active') {
      logLogin({ email, success: false, ip, userAgent: ua, reason: 'invalid_account' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!bcrypt.compareSync(password, admin.password_hash)) {
      logLogin({ adminId: admin.id, email, success: false, ip, userAgent: ua, reason: 'bad_password' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (admin.totp_enabled) {
      if (!totpCode) {
        return res.json({ requires2FA: true });
      }
      const valid = speakeasy.totp.verify({
        secret: admin.totp_secret,
        encoding: 'base32',
        token: String(totpCode),
        window: 1
      });
      if (!valid) {
        logLogin({ adminId: admin.id, email, success: false, ip, userAgent: ua, reason: 'bad_2fa' });
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }

    db.prepare(`UPDATE admins SET last_login_at = datetime('now') WHERE id = ?`).run(admin.id);
    const session = createSession(admin.id, ip, ua);
    logLogin({ adminId: admin.id, email, success: true, ip, userAgent: ua });
    logAdminAction(admin.id, 'login', 'admin', admin.id, null, ip);

    res.cookie('sp_admin_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    res.json({ token: session.token, admin: getAdminById(admin.id), expiresAt: session.expiresAt });
  });

  router.post('/logout', requireAuth, (req, res) => {
    revokeSession(req.tokenHash);
    logAdminAction(req.admin.id, 'logout', 'admin', req.admin.id, null, getClientIp(req));
    res.clearCookie('sp_admin_token');
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ admin: req.admin, permissions: ALL_PERMISSIONS.filter((p) => {
      const { hasPermission } = require('../permissions');
      return hasPermission(req.admin, p);
    })});
  });

  router.post('/change-password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const row = db.prepare(`SELECT password_hash FROM admins WHERE id = ?`).get(req.admin.id);
    if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }
    const hash = bcrypt.hashSync(newPassword, 12);
    db.prepare(`UPDATE admins SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, req.admin.id);
    revokeAllSessions(req.admin.id);
    logAdminAction(req.admin.id, 'change_password', 'admin', req.admin.id, null, getClientIp(req));
    res.json({ ok: true, message: 'Password updated. Please sign in again.' });
  });

  router.post('/2fa/setup', requireAuth, async (req, res) => {
    const secret = speakeasy.generateSecret({ name: `Social Plus (${req.admin.email})` });
    db.prepare(`UPDATE admins SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`).run(secret.base32, req.admin.id);
    const qr = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ secret: secret.base32, qrCode: qr });
  });

  router.post('/2fa/enable', requireAuth, (req, res) => {
    const { code } = req.body || {};
    const row = db.prepare(`SELECT totp_secret FROM admins WHERE id = ?`).get(req.admin.id);
    if (!row?.totp_secret) return res.status(400).json({ error: 'Run 2FA setup first' });
    const valid = speakeasy.totp.verify({ secret: row.totp_secret, encoding: 'base32', token: String(code), window: 1 });
    if (!valid) return res.status(400).json({ error: 'Invalid code' });
    db.prepare(`UPDATE admins SET totp_enabled = 1 WHERE id = ?`).run(req.admin.id);
    logAdminAction(req.admin.id, 'enable_2fa', 'admin', req.admin.id, null, getClientIp(req));
    res.json({ ok: true });
  });

  router.post('/2fa/disable', requireAuth, (req, res) => {
    const { password, code } = req.body || {};
    const row = db.prepare(`SELECT password_hash, totp_secret, totp_enabled FROM admins WHERE id = ?`).get(req.admin.id);
    if (!bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: 'Password incorrect' });
    }
    if (row.totp_enabled) {
      const valid = speakeasy.totp.verify({ secret: row.totp_secret, encoding: 'base32', token: String(code), window: 1 });
      if (!valid) return res.status(400).json({ error: 'Invalid 2FA code' });
    }
    db.prepare(`UPDATE admins SET totp_enabled = 0, totp_secret = NULL WHERE id = ?`).run(req.admin.id);
    logAdminAction(req.admin.id, 'disable_2fa', 'admin', req.admin.id, null, getClientIp(req));
    res.json({ ok: true });
  });

  router.get('/admins', requireAuth, requireSuperAdmin, (req, res) => {
    const admins = db.prepare(`
      SELECT id, email, name, role, permissions, totp_enabled, status, created_at, last_login_at
      FROM admins WHERE deleted_at IS NULL ORDER BY id
    `).all();
    res.json({ admins });
  });

  router.post('/admins', requireAuth, requireSuperAdmin, (req, res) => {
    const { email, name, password, role = 'admin', permissions } = req.body || {};
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'Valid email and password (8+ chars) required' });
    }
    const perms = permissions || ROLE_DEFAULTS[role] || ROLE_DEFAULTS.admin;
    try {
      const hash = bcrypt.hashSync(password, 12);
      const result = db.prepare(`
        INSERT INTO admins (email, name, password_hash, role, permissions)
        VALUES (?, ?, ?, ?, ?)
      `).run(email.trim(), name || '', hash, role, JSON.stringify(perms));
      logAdminAction(req.admin.id, 'create_admin', 'admin', result.lastInsertRowid, { email }, getClientIp(req));
      res.status(201).json({ id: result.lastInsertRowid });
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
      throw e;
    }
  });

  router.patch('/admins/:id', requireAuth, requireSuperAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { name, role, permissions, status } = req.body || {};
    const existing = db.prepare(`SELECT * FROM admins WHERE id = ? AND deleted_at IS NULL`).get(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.role === 'super_admin' && req.admin.id !== id && role && role !== 'super_admin') {
      return res.status(400).json({ error: 'Cannot demote another super admin' });
    }
    db.prepare(`
      UPDATE admins SET
        name = COALESCE(?, name),
        role = COALESCE(?, role),
        permissions = COALESCE(?, permissions),
        status = COALESCE(?, status),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ?? null,
      role ?? null,
      permissions ? JSON.stringify(permissions) : null,
      status ?? null,
      id
    );
    logAdminAction(req.admin.id, 'update_admin', 'admin', id, req.body, getClientIp(req));
    res.json({ ok: true });
  });

  router.delete('/admins/:id', requireAuth, requireSuperAdmin, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (id === req.admin.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    const existing = db.prepare(`SELECT role FROM admins WHERE id = ?`).get(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.role === 'super_admin') return res.status(400).json({ error: 'Cannot delete super admin' });
    db.prepare(`UPDATE admins SET deleted_at = datetime('now'), status = 'deleted' WHERE id = ?`).run(id);
    revokeAllSessions(id);
    logAdminAction(req.admin.id, 'delete_admin', 'admin', id, null, getClientIp(req));
    res.json({ ok: true });
  });

  return router;
}

module.exports = routerAuth;
