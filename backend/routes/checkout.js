const { v4: uuidv4 } = require('uuid');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');
const { logAdminAction } = require('../audit');
const { getActiveProvider } = require('../payments');
const {
  PLAN_IMAGES,
  computeQuote,
  formatQuote,
  processPayment,
  confirmPayment,
  getReceipt,
  getPaymentAnalytics,
  getEnabledMethods,
  getPublicSettings
} = require('../payments/checkout-service');
const { validatePromo, listPromos, createPromo, updatePromo } = require('../payments/promo-service');
const { getBalance, listWallets, creditWallet, listTransactions } = require('../payments/wallet-service');
const {
  listAllMethods,
  updateMethod,
  setSetting,
  getSetting,
  seedPaymentMethods
} = require('../payments/settings-service');
const { findPaymentById, markPaymentStatus, getPlans, getPlan } = require('../payments/order-service');
const { getPaymentProvider } = require('../payments');

function routerCheckout() {
  const express = require('express');
  const router = express.Router();

  seedPaymentMethods();

  router.get('/bootstrap', (req, res) => {
    const provider = getPaymentProvider();
    const planId = (req.query.plan || 'growth').toLowerCase();
    const plans = getPlans();
    const plan = getPlan(planId);
    res.json({
      enabled: provider.isConfigured() || getPublicSettings().walletEnabled,
      provider: provider.name,
      publishableKey: provider.getPublishableKey(),
      settings: getPublicSettings(),
      methods: getEnabledMethods(),
      plans: Object.entries(plans).map(([id, p]) => ({
        id,
        name: p.name,
        price: p.priceCents / 100,
        image: PLAN_IMAGES[id]
      })),
      selectedPlan: {
        id: planId,
        name: plan.name,
        price: plan.priceCents / 100,
        image: PLAN_IMAGES[planId] || PLAN_IMAGES.growth
      }
    });
  });

  router.post('/quote', (req, res) => {
    const { planId, quantity, promoCode, customerEmail, paymentMethod, useWallet } = req.body || {};
    const quote = computeQuote({
      planId,
      quantity,
      promoCode,
      customerEmail,
      paymentMethod,
      useWallet: !!useWallet
    });
    if (quote.error) return res.status(400).json({ error: quote.error });
    res.json({ quote: formatQuote(quote) });
  });

  router.post('/validate-promo', (req, res) => {
    const { code, planId, quantity, customerEmail } = req.body || {};
    const plan = getPlan((planId || 'growth').toLowerCase());
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const subtotalCents = plan.priceCents * qty;
    const result = validatePromo(code, { planId, subtotalCents, customerEmail });
    if (!result.valid) return res.status(400).json({ error: result.error });
    res.json({ ok: true, label: result.label, discount: result.discountCents / 100 });
  });

  router.get('/wallet', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });
    res.json(getBalance(email));
  });

  router.post('/pay', async (req, res) => {
    try {
      const idempotencyKey = req.headers['idempotency-key'] || uuidv4();
      const result = await processPayment({
        ...req.body,
        idempotencyKey
      });
      res.json(result);
    } catch (err) {
      const msg = err.message || 'Payment could not be processed';
      const code = msg.includes('Duplicate') ? 409
        : msg.includes('Insufficient') ? 402
        : msg.includes('unavailable') ? 503
        : 400;
      res.status(code).json({ error: msg });
    }
  });

  router.post('/confirm', async (req, res) => {
    try {
      const { paymentId, paymentIntentId } = req.body || {};
      if (!paymentId || !paymentIntentId) {
        return res.status(400).json({ error: 'Missing payment confirmation data' });
      }
      const payment = await confirmPayment(paymentId, paymentIntentId);
      res.json({
        verified: payment.status === 'succeeded',
        status: payment.status,
        receipt: getReceipt(paymentId)
      });
    } catch (err) {
      res.status(400).json({ error: 'Payment verification failed' });
    }
  });

  router.get('/receipt/:paymentId', (req, res) => {
    const receipt = getReceipt(parseInt(req.params.paymentId, 10));
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    if (receipt.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed', status: receipt.status });
    }
    res.json({ receipt });
  });

  /* ---- Admin ---- */
  router.get('/admin/analytics', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    res.json(getPaymentAnalytics());
  });

  router.get('/admin/methods', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    res.json({ methods: listAllMethods() });
  });

  router.patch('/admin/methods/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    updateMethod(parseInt(req.params.id, 10), req.body);
    logAdminAction(req.admin.id, 'update_payment_method', 'payment_method', req.params.id, req.body, req.ip);
    res.json({ ok: true, methods: listAllMethods() });
  });

  router.get('/admin/promos', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    res.json({ promos: listPromos() });
  });

  router.post('/admin/promos', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    const promo = createPromo(req.body);
    logAdminAction(req.admin.id, 'create_promo', 'promo', promo.id, { code: promo.code }, req.ip);
    res.status(201).json({ promo });
  });

  router.patch('/admin/promos/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    updatePromo(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true });
  });

  router.get('/admin/settings', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    res.json({
      currency: getSetting('currency', 'usd'),
      tax_rate: getSetting('tax_rate', '0'),
      fee_rate: getSetting('fee_rate', '0'),
      wallet_enabled: getSetting('wallet_enabled', 'true'),
      promo_enabled: getSetting('promo_enabled', 'true')
    });
  });

  router.put('/admin/settings', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    const keys = ['currency', 'tax_rate', 'fee_rate', 'wallet_enabled', 'promo_enabled'];
    keys.forEach((k) => {
      if (req.body[k] !== undefined) setSetting(k, req.body[k]);
    });
    logAdminAction(req.admin.id, 'update_payment_settings', 'payment_settings', null, req.body, req.ip);
    res.json(getPublicSettings());
  });

  router.get('/admin/wallets', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    res.json({ wallets: listWallets(req.query.q) });
  });

  router.post('/admin/wallets/credit', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), (req, res) => {
    const { email, amount, toPromo, note } = req.body || {};
    const cents = Math.round(parseFloat(amount) * 100);
    if (!email || cents <= 0) return res.status(400).json({ error: 'Invalid credit request' });
    const wallet = creditWallet(email, cents, {
      type: 'admin_credit',
      reference: note || 'admin_adjustment',
      adminId: req.admin.id,
      toPromo: !!toPromo
    });
    logAdminAction(req.admin.id, 'wallet_credit', 'wallet', wallet.id, { email, cents }, req.ip);
    res.json({ ok: true, wallet });
  });

  router.post('/admin/refund/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_ORDERS), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const payment = findPaymentById(id);
      if (!payment) return res.status(404).json({ error: 'Payment not found' });
      if (!['succeeded', 'partially_refunded'].includes(payment.status)) {
        return res.status(400).json({ error: 'Payment cannot be refunded' });
      }

      const amount = req.body?.amount != null ? Math.round(parseFloat(req.body.amount) * 100) : null;
      const maxRefundable = Math.round(payment.amount * 100) - (payment.refunded_amount_cents || 0);
      const refundCents = amount || maxRefundable;

      if (refundCents <= 0 || refundCents > maxRefundable) {
        return res.status(400).json({ error: 'Invalid refund amount' });
      }

      if (payment.provider === 'stripe' && payment.provider_payment_id) {
        const provider = getActiveProvider();
        if (!provider) return res.status(503).json({ error: 'Provider not configured' });
        await provider.createRefund(payment.provider_payment_id, refundCents);
      } else if (payment.provider === 'wallet') {
        const { refundToWallet } = require('../payments/wallet-service');
        refundToWallet(payment.customer_email, refundCents, { paymentId: id, orderId: payment.order_id, adminId: req.admin.id });
      }

      const newRefunded = (payment.refunded_amount_cents || 0) + refundCents;
      const newStatus = newRefunded >= Math.round(payment.amount * 100) ? 'refunded' : 'partially_refunded';
      markPaymentStatus(id, newStatus, { transactionId: payment.transaction_id });
      const { db } = require('../db');
      db.prepare(`UPDATE payments SET refunded_amount_cents = ? WHERE id = ?`).run(newRefunded, id);

      logAdminAction(req.admin.id, 'refund_payment', 'payment', id, { refundCents, newStatus }, req.ip);
      res.json({ ok: true, status: newStatus, refunded: refundCents / 100 });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Refund failed' });
    }
  });

  return router;
}

module.exports = routerCheckout;
