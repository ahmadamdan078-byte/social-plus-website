const { db } = require('../db');
const { logAdminAction } = require('../audit');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function routerOrders() {
  const express = require('express');
  const router = express.Router();

  router.get('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    const { q, status, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT * FROM orders WHERE deleted_at IS NULL`;
    const params = [];
    if (status) { sql += ` AND status = ?`; params.push(status); }
    if (q) {
      sql += ` AND (customer_name LIKE ? OR customer_email LIKE ? OR service_name LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const orders = db.prepare(sql).all(...params);
    res.json({ orders });
  });

  router.get('/export', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    const orders = db.prepare(`SELECT * FROM orders WHERE deleted_at IS NULL ORDER BY created_at DESC`).all();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=orders-export.json');
    res.send(JSON.stringify(orders, null, 2));
  });

  router.post('/', (req, res) => {
    const b = req.body || {};
    const r = db.prepare(`
      INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, service_name, status, amount, notes, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      b.user_id || null, b.customer_name || '', b.customer_email || '', b.customer_phone || '',
      b.service_name || '', b.status || 'pending', b.amount ?? null, b.notes || '',
      b.metadata ? JSON.stringify(b.metadata) : null
    );
    res.status(201).json({ id: r.lastInsertRowid });
  });

  router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { status, notes, amount } = req.body || {};
    db.prepare(`
      UPDATE orders SET status = COALESCE(?, status), notes = COALESCE(?, notes),
        amount = COALESCE(?, amount), updated_at = datetime('now')
      WHERE id = ? AND deleted_at IS NULL
    `).run(status, notes, amount, id);
    logAdminAction(req.admin.id, 'update_order', 'order', id, req.body, ip(req));
    res.json({ ok: true });
  });

  router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.prepare(`UPDATE orders SET deleted_at = datetime('now'), status = 'cancelled' WHERE id = ?`).run(id);
    logAdminAction(req.admin.id, 'cancel_order', 'order', id, null, ip(req));
    res.json({ ok: true });
  });

  return router;
}

module.exports = routerOrders;
