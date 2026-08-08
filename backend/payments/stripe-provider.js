let stripeClient = null;

function getStripe() {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes('YOUR_')) return null;
  // eslint-disable-next-line global-require
  const Stripe = require('stripe');
  stripeClient = new Stripe(key);
  return stripeClient;
}

function isConfigured() {
  return !!getStripe();
}

function getPublishableKey() {
  return process.env.STRIPE_PUBLISHABLE_KEY || '';
}

async function createPaymentIntent({
  amountCents,
  currency = 'usd',
  customerEmail,
  metadata,
  idempotencyKey,
  paymentMethodTypes
}) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const params = {
    amount: amountCents,
    currency,
    receipt_email: customerEmail || undefined,
    metadata: metadata || {},
    automatic_payment_methods: paymentMethodTypes ? undefined : { enabled: true }
  };
  if (paymentMethodTypes) params.payment_method_types = paymentMethodTypes;

  const pi = await stripe.paymentIntents.create(params, idempotencyKey ? { idempotencyKey } : undefined);

  return {
    paymentIntentId: pi.id,
    clientSecret: pi.client_secret,
    status: pi.status
  };
}

async function retrievePaymentIntent(paymentIntentId) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  let status = pi.status;
  if (status === 'requires_payment_method') status = 'failed';
  if (status === 'requires_confirmation' || status === 'requires_action') status = 'processing';

  return {
    paymentIntentId: pi.id,
    status,
    amountCents: pi.amount,
    currency: pi.currency,
    errorMessage: pi.last_payment_error?.message || null
  };
}

async function createCheckoutSession({
  orderId,
  paymentId,
  lineItems,
  customerEmail,
  customerName,
  successUrl,
  cancelUrl,
  metadata,
  idempotencyKey
}) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    automatic_payment_methods: { enabled: true },
    line_items: lineItems,
    customer_email: customerEmail || undefined,
    client_reference_id: String(orderId),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      orderId: String(orderId),
      paymentId: String(paymentId),
      customerName: customerName || '',
      ...metadata
    },
    payment_intent_data: {
      metadata: {
        orderId: String(orderId),
        paymentId: String(paymentId)
      }
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60
  }, idempotencyKey ? { idempotencyKey } : undefined);

  return {
    sessionId: session.id,
    url: session.url,
    status: session.status,
    paymentIntentId: session.payment_intent
  };
}

async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent']
  });

  let status = 'pending';
  if (session.status === 'expired') status = 'cancelled';
  else if (session.payment_status === 'paid') status = 'succeeded';
  else if (session.payment_status === 'unpaid' && session.status === 'open') status = 'pending';
  else if (session.payment_status === 'unpaid') status = 'failed';

  const pi = session.payment_intent;
  const paymentId = typeof pi === 'object' ? pi?.id : pi;

  return {
    sessionId: session.id,
    paymentId: paymentId || null,
    status,
    amountCents: session.amount_total || 0,
    currency: session.currency || 'usd',
    customerEmail: session.customer_details?.email || session.customer_email || '',
    metadata: session.metadata || {},
    transactionId: paymentId || session.id,
    checkoutUrl: session.status === 'open' ? session.url : null
  };
}

function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) throw new Error('Stripe webhook not configured');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

async function createRefund(paymentIntentId, amountCents) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');
  const params = { payment_intent: paymentIntentId };
  if (amountCents) params.amount = amountCents;
  return stripe.refunds.create(params);
}

module.exports = {
  name: 'stripe',
  isConfigured,
  getPublishableKey,
  createCheckoutSession,
  createPaymentIntent,
  retrievePaymentIntent,
  retrieveCheckoutSession,
  constructWebhookEvent,
  createRefund
};
