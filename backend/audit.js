const { db } = require('./db');

function logAdminAction(adminId, action, entity = null, entityId = null, details = null, ip = null) {
  db.prepare(`
    INSERT INTO admin_logs (admin_id, action, entity, entity_id, details, ip)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    adminId || null,
    action,
    entity,
    entityId != null ? String(entityId) : null,
    details ? JSON.stringify(details) : null,
    ip || null
  );
}

function logLogin({ adminId, email, success, ip, userAgent, reason }) {
  db.prepare(`
    INSERT INTO login_history (admin_id, email, success, ip, user_agent, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(adminId || null, email || null, success ? 1 : 0, ip || null, userAgent || null, reason || null);
}

module.exports = { logAdminAction, logLogin };
