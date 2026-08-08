const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { hasPermission } = require('../permissions');

const SECRET_PATH = path.join(__dirname, '..', '..', 'data', '.jwt_secret');

function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  try {
    if (fs.existsSync(SECRET_PATH)) return fs.readFileSync(SECRET_PATH, 'utf8').trim();
    const secret = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(path.dirname(SECRET_PATH), { recursive: true });
    fs.writeFileSync(SECRET_PATH, secret, { mode: 0o600 });
    return secret;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const JWT_SECRET = getJwtSecret();
const SESSION_HOURS = parseInt(process.env.SESSION_HOURS || '8', 10);

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(adminId, ip, userAgent) {
  const token = crypto.randomBytes(48).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO admin_sessions (admin_id, token_hash, ip, user_agent, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(adminId, tokenHash, ip || null, userAgent || null, expiresAt);

  const jwtToken = jwt.sign({ sid: tokenHash, aid: adminId }, JWT_SECRET, { expiresIn: `${SESSION_HOURS}h` });
  return { token: jwtToken, expiresAt };
}

function revokeSession(tokenHash) {
  db.prepare(`UPDATE admin_sessions SET revoked_at = datetime('now') WHERE token_hash = ?`).run(tokenHash);
}

function revokeAllSessions(adminId) {
  db.prepare(`UPDATE admin_sessions SET revoked_at = datetime('now') WHERE admin_id = ? AND revoked_at IS NULL`).run(adminId);
}

function getAdminById(id) {
  return db.prepare(`
    SELECT id, email, name, role, permissions, totp_enabled, status, created_at, last_login_at
    FROM admins WHERE id = ? AND deleted_at IS NULL
  `).get(id);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const cookieToken = req.cookies?.sp_admin_token;
  const raw = header.startsWith('Bearer ') ? header.slice(7) : cookieToken;

  if (!raw) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    const session = db.prepare(`
      SELECT * FROM admin_sessions
      WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')
    `).get(payload.sid);

    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    const admin = getAdminById(session.admin_id);
    if (!admin || admin.status !== 'active') {
      return res.status(403).json({ error: 'Account inactive' });
    }

    req.admin = admin;
    req.sessionId = session.id;
    req.tokenHash = payload.sid;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.admin, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireSuperAdmin(req, res, next) {
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super Admin only' });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  SESSION_HOURS,
  hashToken,
  createSession,
  revokeSession,
  revokeAllSessions,
  getAdminById,
  requireAuth,
  requirePermission,
  requireSuperAdmin
};
