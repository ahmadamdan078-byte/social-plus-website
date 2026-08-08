const stripe = require('./stripe-provider');

/** @returns {typeof stripe} */
function getPaymentProvider(name) {
  const provider = name || process.env.PAYMENT_PROVIDER || 'stripe';
  if (provider === 'stripe') return stripe;
  throw new Error(`Unknown payment provider: ${provider}`);
}

function getActiveProvider() {
  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return null;
  }
  return provider;
}

module.exports = { getPaymentProvider, getActiveProvider };
