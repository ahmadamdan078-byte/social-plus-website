/**
 * Payment provider interface — swap implementations without rewriting checkout.
 * @typedef {object} CheckoutLineItem
 * @property {string} name
 * @property {number} amountCents
 * @property {number} quantity
 *
 * @typedef {object} CheckoutSessionResult
 * @property {string} sessionId
 * @property {string} url
 *
 * @typedef {object} VerifiedPayment
 * @property {string} sessionId
 * @property {string} paymentId
 * @property {string} status - succeeded|pending|failed|cancelled
 * @property {number} amountCents
 * @property {string} currency
 * @property {string} customerEmail
 * @property {object} metadata
 */

/**
 * @interface PaymentProvider
 * @property {string} name
 * @property {boolean} isConfigured
 * @method createCheckoutSession
 * @method retrieveCheckoutSession
 * @method parseWebhook
 * @method createRefund
 */

module.exports = {};
