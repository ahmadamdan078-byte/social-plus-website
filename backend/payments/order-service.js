const DEFAULT_PLANS = {
  starter: { priceCents: 1599, name: 'Starter Plan' },
  growth: { priceCents: 2799, name: 'Growth Plan' },
  pro: { priceCents: 5499, name: 'Pro Plan' }
};

const PROCESSING_FEE_CENTS = 0;

function loadPlansFromDb() {
  const plans = JSON.parse(JSON.stringify(DEFAULT_PLANS));
  try {
    const { db } = require('../db');
    const rows = db.prepare(`
      SELECT title_en, price FROM services
      WHERE category = 'pricing' AND deleted_at IS NULL
      ORDER BY sort_order, id
    `).all();
    rows.forEach((r) => {
      const id = (r.title_en || '').trim().toLowerCase();
      if (plans[id] && r.price != null && !Number.isNaN(Number(r.price))) {
        plans[id].priceCents = Math.round(Number(r.price) * 100);
      }
    });
    const settings = db.prepare(`
      SELECT key, value FROM site_settings
      WHERE key IN ('pricing_starter', 'pricing_growth', 'pricing_pro')
    `).all();
    settings.forEach((s) => {
      const id = s.key.replace('pricing_', '');
      if (plans[id] && s.value != null && !Number.isNaN(Number(s.value))) {
        plans[id].priceCents = Math.round(Number(s.value) * 100);
      }
    });
  } catch {
    /* DB not ready — use defaults */
  }
  return plans;
}

function getPlans() {
  return loadPlansFromDb();
}

function getPlan(planId) {
  const plans = getPlans();
  return plans[planId] || plans.growth;
}

function computeTotals(planId, quantity = 1, discountCents = 0) {
  const plan = getPlan(planId);
  const qty = Math.max(1, Math.min(99, parseInt(quantity, 10) || 1));
  const subtotal = plan.priceCents * qty;
  const discount = Math.min(subtotal, Math.max(0, discountCents));
  const fees = PROCESSING_FEE_CENTS;
  const total = Math.max(0, subtotal - discount + fees);
  return {
    planId,
    planName: plan.name,
    quantity: qty,
    unitPriceCents: plan.priceCents,
    subtotalCents: subtotal,
    discountCents: discount,
    feesCents: fees,
    totalCents: total,
    currency: 'usd'
  };
}

function createPendingOrder({ planId, customerName, customerEmail, customerPhone, quantity, discountCents, metadata }) {
  const { db } = require('../db');
  const totals = computeTotals(planId, quantity, discountCents);

  const existing = db.prepare(`
    SELECT o.id FROM orders o
    JOIN payments p ON p.order_id = o.id
    WHERE o.customer_email = ? COLLATE NOCASE
      AND o.service_name = ?
      AND o.deleted_at IS NULL
      AND p.status = 'pending'
      AND p.provider_session_id IS NOT NULL
      AND o.created_at > datetime('now', '-1 hour')
    LIMIT 1
  `).get(customerEmail || '', totals.planName);

  if (existing) {
    const payment = db.prepare(`SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`).get(existing.id);
    if (payment?.provider_session_id) {
      return { orderId: existing.id, paymentId: payment.id, totals, reused: true };
    }
  }

  const orderResult = db.prepare(`
    INSERT INTO orders (customer_name, customer_email, customer_phone, service_name, status, amount, payment_status, notes, metadata)
    VALUES (?, ?, ?, ?, 'pending', ?, 'pending', ?, ?)
  `).run(
    customerName || '',
    customerEmail || '',
    customerPhone || '',
    totals.planName,
    totals.totalCents / 100,
    `Qty: ${totals.quantity}`,
    JSON.stringify({ planId, ...totals, ...(metadata || {}) })
  );

  const paymentResult = db.prepare(`
    INSERT INTO payments (order_id, provider, status, amount, currency, customer_email, customer_name, metadata)
    VALUES (?, 'stripe', 'pending', ?, ?, ?, ?, ?)
  `).run(
    orderResult.lastInsertRowid,
    totals.totalCents / 100,
    totals.currency,
    customerEmail || '',
    customerName || '',
    JSON.stringify({ planId, quantity: totals.quantity })
  );

  return { orderId: orderResult.lastInsertRowid, paymentId: paymentResult.lastInsertRowid, totals, reused: false };
}

function markPaymentStatus(paymentId, status, extra = {}) {
  const { db } = require('../db');
  db.prepare(`
    UPDATE payments SET
      status = ?,
      provider_session_id = COALESCE(?, provider_session_id),
      provider_payment_id = COALESCE(?, provider_payment_id),
      transaction_id = COALESCE(?, transaction_id),
      error_message = COALESCE(?, error_message),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    status,
    extra.sessionId ?? null,
    extra.paymentId ?? null,
    extra.transactionId ?? null,
    extra.errorMessage ?? null,
    paymentId
  );

  const payment = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId);
  if (!payment) return null;

  const orderStatus = status === 'succeeded' ? 'paid'
    : status === 'processing' ? 'processing'
    : status === 'failed' ? 'payment_failed'
    : status === 'cancelled' ? 'cancelled'
    : status === 'refunded' ? 'refunded'
    : status === 'partially_refunded' ? 'partially_refunded'
    : status === 'disputed' ? 'disputed'
    : 'pending';

  db.prepare(`
    UPDATE orders SET
      status = ?,
      payment_status = ?,
      provider_session_id = COALESCE(?, provider_session_id),
      provider_payment_id = COALESCE(?, provider_payment_id),
      transaction_id = COALESCE(?, transaction_id),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(orderStatus, status, extra.sessionId ?? null, extra.paymentId ?? null, extra.transactionId ?? null, payment.order_id);

  return payment;
}

function findPaymentBySession(sessionId) {
  const { db } = require('../db');
  return db.prepare(`SELECT * FROM payments WHERE provider_session_id = ?`).get(sessionId);
}

function findPaymentById(id) {
  const { db } = require('../db');
  return db.prepare(`
    SELECT p.*, o.service_name, o.amount as order_amount, o.status as order_status
    FROM payments p
    JOIN orders o ON o.id = p.order_id
    WHERE p.id = ?
  `).get(id);
}

module.exports = {
  DEFAULT_PLANS,
  getPlans,
  getPlan,
  computeTotals,
  createPendingOrder,
  markPaymentStatus,
  findPaymentBySession,
  findPaymentById
};
