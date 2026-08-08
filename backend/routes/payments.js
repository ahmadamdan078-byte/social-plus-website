const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { logAdminAction } = require('../audit');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');
const { getActiveProvider, getPaymentProvider } = require('../payments');
const {
  computeTotals,
  createPendingOrder,
  markPaymentStatus,
  findPaymentBySession,
  findPaymentById
} = require('../payments/order-service');

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function baseUrl(req) {
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function routerPayments() {
  const express = require('express');
  const router = express.Router();

  router.get('/config', (req, res) => {
    const provider = getPaymentProvider();
    res.json({
      enabled: provider.isConfigured(),
      provider: provider.name,
      publishableKey: provider.getPublishableKey(),
      currency: 'usd'
    });
  });

  router.post('/checkout-session', async (req, res) => {
    try {
      const provider = getActiveProvider();
      if (!provider) {
        return res.status(503).json({ error: 'Payment system is not configured. Contact support.' });
      }

      const { planId, customerName, customerEmail, customerPhone, quantity, acceptTerms } = req.body || {};
      if (!acceptTerms) return res.status(400).json({ error: 'You must accept the terms to continue' });
      if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        return res.status(400).json({ error: 'Valid email required' });
      }
      if (!customerName || customerName.trim().length < 2) {
        return res.status(400).json({ error: 'Name required' });
      }

      const pid = (planId || 'growth').toLowerCase();
      const totals = computeTotals(pid, quantity, 0);
      const idempotencyKey = req.headers['idempotency-key'] || uuidv4();

      const { orderId, paymentId, reused } = createPendingOrder({
        planId: pid,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone?.trim() || '',
        quantity: totals.quantity
      });

      const existingPayment = findPaymentById(paymentId);
      if (reused && existingPayment?.provider_session_id) {
        const existingSession = await provider.retrieveCheckoutSession(existingPayment.provider_session_id);
        if (existingSession.status === 'pending' && existingSession.checkoutUrl) {
          return res.json({
            sessionId: existingSession.sessionId,
            url: existingSession.checkoutUrl,
            orderId,
            paymentId,
            reused: true,
            totals: {
              planName: totals.planName,
              quantity: totals.quantity,
              subtotal: totals.subtotalCents / 100,
              discount: totals.discountCents / 100,
              fees: totals.feesCents / 100,
              total: totals.totalCents / 100,
              currency: totals.currency
            }
          });
        }
      }

      const origin = baseUrl(req);
      const session = await provider.createCheckoutSession({
        orderId,
        paymentId,
        lineItems: [{
          quantity: totals.quantity,
          price_data: {
            currency: totals.currency,
            unit_amount: totals.unitPriceCents,
            product_data: {
              name: totals.planName,
              description: `Social Plus — ${totals.planName}`
            }
          }
        }],
        customerEmail: customerEmail.trim(),
        customerName: customerName.trim(),
        successUrl: `${origin}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/checkout-cancel.html?plan=${pid}&order_id=${orderId}`,
        metadata: { planId: pid, quantity: String(totals.quantity) },
        idempotencyKey
      });

      db.prepare(`
        UPDATE payments SET provider_session_id = ?, idempotency_key = ?, updated_at = datetime('now') WHERE id = ?
      `).run(session.sessionId, idempotencyKey, paymentId);

      db.prepare(`UPDATE orders SET provider_session_id = ? WHERE id = ?`).run(session.sessionId, orderId);

      res.json({
        sessionId: session.sessionId,
        url: session.url,
        orderId,
        paymentId,
        totals: {
          planName: totals.planName,
          quantity: totals.quantity,
          subtotal: totals.subtotalCents / 100,
          discount: totals.discountCents / 100,
          fees: totals.feesCents / 100,
          total: totals.totalCents / 100,
          currency: totals.currency
        }
      });
    } catch (err) {
      console.error('Checkout session error:', err);
      res.status(500).json({ error: err.message || 'Could not start checkout' });
    }
  });

  router.get('/verify/:sessionId', async (req, res) => {
    try {
      const provider = getActiveProvider();
      if (!provider) return res.status(503).json({ error: 'Payment not configured' });

      const { sessionId } = req.params;
      const verified = await provider.retrieveCheckoutSession(sessionId);
      const local = findPaymentBySession(sessionId);

      if (local && verified.status === 'succeeded' && local.status !== 'succeeded') {
        markPaymentStatus(local.id, 'succeeded', {
          sessionId,
          paymentId: verified.paymentId,
          transactionId: verified.transactionId
        });
      } else if (local && verified.status === 'cancelled' && local.status === 'pending') {
        markPaymentStatus(local.id, 'cancelled', { sessionId });
      } else if (local && verified.status === 'failed' && local.status === 'pending') {
        markPaymentStatus(local.id, 'failed', { sessionId, errorMessage: 'Payment failed' });
      }

      const payment = findPaymentBySession(sessionId);
      res.json({
        verified: verified.status === 'succeeded',
        status: payment?.status || verified.status,
        orderId: payment?.order_id || verified.metadata?.orderId,
        transactionId: payment?.transaction_id || verified.transactionId,
        amount: verified.amountCents / 100,
        currency: verified.currency,
        customerEmail: verified.customerEmail,
        planName: payment ? JSON.parse(payment.metadata || '{}').planId : null
      });
    } catch (err) {
      res.status(400).json({ error: 'Invalid or expired session' });
    }
  });

  router.get('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    const { q, status, from, to, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT p.*, o.service_name, o.customer_phone, o.status as order_status
      FROM payments p
      JOIN orders o ON o.id = p.order_id
      WHERE o.deleted_at IS NULL
    `;
    const params = [];
    if (status) { sql += ` AND p.status = ?`; params.push(status); }
    if (q) {
      sql += ` AND (p.customer_email LIKE ? OR p.customer_name LIKE ? OR p.transaction_id LIKE ? OR p.provider_session_id LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (from) { sql += ` AND p.created_at >= ?`; params.push(from); }
    if (to) { sql += ` AND p.created_at <= ?`; params.push(to); }
    sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const payments = db.prepare(sql).all(...params);
    res.json({ payments });
  });

  router.post('/:id/refund', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), async (req, res) => {
    try {
      const provider = getActiveProvider();
      if (!provider) return res.status(503).json({ error: 'Payment provider not configured' });

      const id = parseInt(req.params.id, 10);
      const payment = findPaymentById(id);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });
      if (payment.status !== 'succeeded') return res.status(400).json({ error: 'Only successful payments can be refunded' });
      if (!payment.provider_payment_id) return res.status(400).json({ error: 'No payment intent on record' });

      const refund = await provider.createRefund(payment.provider_payment_id);
      markPaymentStatus(id, 'refunded', { transactionId: refund.id });
      logAdminAction(req.admin.id, 'refund_payment', 'payment', id, { refundId: refund.id }, ip(req));
      res.json({ ok: true, refundId: refund.id, status: 'refunded' });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Refund failed' });
    }
  });

  return router;
}

function handleStripeWebhook(rawBody, signature) {
  const provider = getActiveProvider();
  if (!provider) throw new Error('Stripe not configured');

  const event = provider.constructWebhookEvent(rawBody, signature);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const local = findPaymentBySession(session.id);
      if (local) {
        markPaymentStatus(local.id, 'succeeded', {
          sessionId: session.id,
          paymentId: session.payment_intent,
          transactionId: session.payment_intent || session.id
        });
      }
      break;
    }
    case 'checkout.session.expired': {
      const session = event.data.object;
      const local = findPaymentBySession(session.id);
      if (local && local.status === 'pending') {
        markPaymentStatus(local.id, 'cancelled', { sessionId: session.id });
      }
      break;
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      let local = db.prepare(`SELECT * FROM payments WHERE provider_payment_id = ?`).get(pi.id);
      if (!local && pi.metadata?.paymentId) {
        local = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(parseInt(pi.metadata.paymentId, 10));
      }
      if (local && local.status !== 'succeeded') {
        markPaymentStatus(local.id, 'succeeded', {
          paymentId: pi.id,
          transactionId: local.transaction_id || pi.id
        });
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object;
      const local = db.prepare(`SELECT * FROM payments WHERE provider_payment_id = ?`).get(pi.id);
      if (local) {
        markPaymentStatus(local.id, 'failed', {
          paymentId: pi.id,
          errorMessage: pi.last_payment_error?.message || 'Payment failed'
        });
      }
      break;
    }
    default:
      break;
  }

  return { received: true, type: event.type };
}

module.exports = { routerPayments, handleStripeWebhook };
