const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { getPlans, getPlan, markPaymentStatus, findPaymentById } = require('./order-service');
const { validatePromo, redeemPromo } = require('./promo-service');
const { getBalance, applyWalletPayment } = require('./wallet-service');
const { getPublicSettings, getEnabledMethods } = require('./settings-service');
const { getActiveProvider } = require('./index');

const PLAN_IMAGES = {
  starter: '/assets/brand-circle.png',
  growth: '/assets/social-plus-logo.png',
  pro: '/assets/social-plus-logo.png'
};

function computeQuote({ planId, quantity = 1, promoCode, customerEmail, paymentMethod, useWallet }) {
  const settings = getPublicSettings();
  const plan = getPlan(planId);
  const qty = Math.max(1, Math.min(99, parseInt(quantity, 10) || 1));
  const subtotalCents = plan.priceCents * qty;

  let promoDiscountCents = 0;
  let promoMeta = null;
  if (settings.promoEnabled && promoCode) {
    const v = validatePromo(promoCode, { planId, subtotalCents, customerEmail });
    if (v.valid) {
      promoDiscountCents = v.discountCents;
      promoMeta = { id: v.promoId, code: v.code, label: v.label };
    } else {
      return { error: v.error };
    }
  }

  const afterDiscount = Math.max(0, subtotalCents - promoDiscountCents);
  const taxCents = Math.round(afterDiscount * settings.taxRate);
  const feeCents = paymentMethod === 'card' || paymentMethod === 'paypal'
    ? Math.round(afterDiscount * settings.feeRate)
    : 0;
  let totalCents = afterDiscount + taxCents + feeCents;

  let walletAppliedCents = 0;
  let walletBalance = { totalCents: 0 };
  if (settings.walletEnabled && useWallet && customerEmail) {
    walletBalance = getBalance(customerEmail);
    walletAppliedCents = Math.min(walletBalance.totalCents, totalCents);
    totalCents -= walletAppliedCents;
  }

  return {
    planId,
    planName: plan.name,
    planImage: PLAN_IMAGES[planId] || PLAN_IMAGES.growth,
    quantity: qty,
    unitPriceCents: plan.priceCents,
    subtotalCents,
    discountCents: promoDiscountCents,
    taxCents,
    feeCents,
    walletAppliedCents,
    totalCents,
    currency: settings.currency,
    promo: promoMeta,
    walletBalanceCents: walletBalance.totalCents,
    cardDueCents: totalCents
  };
}

function formatQuote(q) {
  const f = (c) => (c / 100);
  return {
    planId: q.planId,
    planName: q.planName,
    planImage: q.planImage,
    quantity: q.quantity,
    unitPrice: f(q.unitPriceCents),
    subtotal: f(q.subtotalCents),
    discount: f(q.discountCents),
    tax: f(q.taxCents),
    fees: f(q.feeCents),
    walletApplied: f(q.walletAppliedCents),
    total: f(q.totalCents + q.walletAppliedCents),
    cardDue: f(q.cardDueCents),
    currency: q.currency,
    promo: q.promo,
    walletBalance: f(q.walletBalanceCents || 0)
  };
}

function createCheckoutRecords({ planId, customerName, customerEmail, customerPhone, quantity, quote, paymentMethod, billingCountry, idempotencyKey }) {
  const dup = db.prepare(`
    SELECT p.id FROM payments p
    WHERE p.idempotency_key = ? AND p.status IN ('pending', 'processing', 'succeeded')
  `).get(idempotencyKey);
  if (dup) throw new Error('Duplicate payment attempt detected');

  const plan = getPlan(planId);
  const meta = JSON.stringify({ planId, quantity: quote.quantity, quote });

  const orderResult = db.prepare(`
    INSERT INTO orders (customer_name, customer_email, customer_phone, service_name, status, amount, payment_status, notes, metadata)
    VALUES (?, ?, ?, ?, 'pending', ?, 'pending', ?, ?)
  `).run(
    customerName,
    customerEmail,
    customerPhone || '',
    plan.name,
    (quote.cardDueCents + quote.walletAppliedCents) / 100,
    `Qty: ${quote.quantity}`,
    meta
  );

  const paymentResult = db.prepare(`
    INSERT INTO payments (
      order_id, provider, status, amount, currency, customer_email, customer_name,
      idempotency_key, payment_method, promo_code, promo_discount_cents, wallet_amount_cents,
      tax_cents, fee_cents, subtotal_cents, billing_country, metadata
    ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderResult.lastInsertRowid,
    paymentMethod === 'wallet' ? 'wallet' : 'stripe',
    quote.cardDueCents / 100,
    quote.currency,
    customerEmail,
    customerName,
    idempotencyKey,
    paymentMethod || 'card',
    quote.promo?.code || null,
    quote.discountCents,
    quote.walletAppliedCents,
    quote.taxCents,
    quote.feeCents,
    quote.subtotalCents,
    billingCountry || null,
    JSON.stringify({ planId, quantity: quote.quantity })
  );

  return { orderId: orderResult.lastInsertRowid, paymentId: paymentResult.lastInsertRowid };
}

async function processPayment({
  planId,
  customerName,
  customerEmail,
  customerPhone,
  quantity,
  promoCode,
  paymentMethod,
  useWallet,
  billingCountry,
  acceptTerms,
  idempotencyKey
}) {
  if (!acceptTerms) throw new Error('You must accept the terms to continue');
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new Error('Valid email required');
  }
  if (!customerName || customerName.trim().length < 2) throw new Error('Name required');

  const quote = computeQuote({
    planId: (planId || 'growth').toLowerCase(),
    quantity,
    promoCode,
    customerEmail: customerEmail.trim(),
    paymentMethod,
    useWallet
  });
  if (quote.error) throw new Error(quote.error);

  const { orderId, paymentId } = createCheckoutRecords({
    planId: quote.planId,
    customerName: customerName.trim(),
    customerEmail: customerEmail.trim(),
    customerPhone,
    quantity: quote.quantity,
    quote,
    paymentMethod,
    billingCountry,
    idempotencyKey: idempotencyKey || uuidv4()
  });

  markPaymentStatus(paymentId, 'processing');

  if (quote.promo?.id) {
    redeemPromo(quote.promo.id, {
      orderId,
      paymentId,
      customerEmail: customerEmail.trim(),
      discountCents: quote.discountCents
    });
  }

  if (quote.walletAppliedCents > 0) {
    applyWalletPayment(customerEmail.trim(), quote.walletAppliedCents, { paymentId, orderId });
  }

  const txnId = `SP-${orderId}-${paymentId}-${Date.now().toString(36).toUpperCase()}`;

  if (quote.cardDueCents <= 0) {
    markPaymentStatus(paymentId, 'succeeded', {
      transactionId: txnId,
      paymentId: `wallet_${paymentId}`
    });
    return {
      status: 'succeeded',
      orderId,
      paymentId,
      transactionId: txnId,
      quote: formatQuote(quote),
      clientSecret: null
    };
  }

  if (paymentMethod === 'wallet') {
    markPaymentStatus(paymentId, 'failed', { errorMessage: 'Insufficient wallet balance' });
    throw new Error('Insufficient wallet balance');
  }

  const provider = getActiveProvider();
  if (!provider) {
    markPaymentStatus(paymentId, 'failed', { errorMessage: 'Payment provider unavailable' });
    throw new Error('Payment provider unavailable. Please contact support.');
  }

  const intent = await provider.createPaymentIntent({
    amountCents: quote.cardDueCents,
    currency: quote.currency,
    customerEmail: customerEmail.trim(),
    paymentMethodTypes: paymentMethod === 'paypal' ? ['paypal', 'card'] : undefined,
    metadata: { orderId: String(orderId), paymentId: String(paymentId), planId: quote.planId },
    idempotencyKey: idempotencyKey || uuidv4()
  });

  db.prepare(`
    UPDATE payments SET provider_payment_id = ?, transaction_id = ?, updated_at = datetime('now') WHERE id = ?
  `).run(intent.paymentIntentId, txnId, paymentId);

  return {
    status: 'processing',
    orderId,
    paymentId,
    transactionId: txnId,
    clientSecret: intent.clientSecret,
    publishableKey: provider.getPublishableKey(),
    quote: formatQuote(quote)
  };
}

function confirmPayment(paymentId, providerPaymentId) {
  const provider = getActiveProvider();
  if (!provider) throw new Error('Payment not configured');

  return provider.retrievePaymentIntent(providerPaymentId).then((pi) => {
    const local = findPaymentById(paymentId);
    if (!local) throw new Error('Payment not found');

    if (pi.status === 'succeeded' && local.status !== 'succeeded') {
      markPaymentStatus(paymentId, 'succeeded', {
        paymentId: pi.paymentIntentId,
        transactionId: local.transaction_id || pi.paymentIntentId
      });
    } else if (pi.status === 'processing') {
      markPaymentStatus(paymentId, 'processing', { paymentId: pi.paymentIntentId });
    } else if (['canceled', 'cancelled'].includes(pi.status)) {
      markPaymentStatus(paymentId, 'cancelled', { paymentId: pi.paymentIntentId });
    } else if (pi.status === 'requires_payment_method' || pi.status === 'failed') {
      markPaymentStatus(paymentId, 'failed', {
        paymentId: pi.paymentIntentId,
        errorMessage: pi.errorMessage || 'Payment failed'
      });
    }

    return findPaymentById(paymentId);
  });
}

function getReceipt(paymentId) {
  const p = findPaymentById(paymentId);
  if (!p) return null;
  let meta = {};
  try { meta = JSON.parse(p.metadata || '{}'); } catch { /* ignore */ }
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(p.order_id);
  return {
    orderNumber: p.order_id,
    transactionId: p.transaction_id,
    date: p.updated_at || p.created_at,
    customer: { name: p.customer_name, email: p.customer_email },
    product: { name: p.service_name, planId: meta.planId, quantity: meta.quantity },
    subtotal: (p.subtotal_cents || 0) / 100,
    discount: (p.promo_discount_cents || 0) / 100,
    promoCode: p.promo_code,
    tax: (p.tax_cents || 0) / 100,
    fees: (p.fee_cents || 0) / 100,
    walletApplied: (p.wallet_amount_cents || 0) / 100,
    totalPaid: ((p.subtotal_cents || 0) - (p.promo_discount_cents || 0) + (p.tax_cents || 0) + (p.fee_cents || 0)) / 100 || p.amount,
    currency: p.currency,
    paymentMethod: p.payment_method,
    status: p.status,
    orderStatus: order?.status
  };
}

function getPaymentAnalytics() {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as succeeded,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status IN ('refunded','partially_refunded') THEN 1 ELSE 0 END) as refunded,
      SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as revenue,
      AVG(CASE WHEN status = 'succeeded' THEN amount ELSE NULL END) as avg_order
    FROM payments
  `).get();

  const byMethod = db.prepare(`
    SELECT payment_method as method, COUNT(*) as count, SUM(amount) as revenue
    FROM payments WHERE status = 'succeeded' GROUP BY payment_method
  `).all();

  const daily = db.prepare(`
    SELECT date(created_at) as day, SUM(amount) as revenue, COUNT(*) as orders
    FROM payments WHERE status = 'succeeded' AND created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at) ORDER BY day
  `).all();

  return { stats, byMethod, daily };
}

module.exports = {
  getPlans,
  PLAN_IMAGES,
  computeQuote,
  formatQuote,
  processPayment,
  confirmPayment,
  getReceipt,
  getPaymentAnalytics,
  getEnabledMethods,
  getPublicSettings
};
