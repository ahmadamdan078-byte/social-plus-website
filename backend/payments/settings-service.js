const { db } = require('../db');

const DEFAULT_METHODS = [
  { code: 'card', name: 'Credit / Debit Card', icon: 'card', provider: 'stripe', sort_order: 1 },
  { code: 'paypal', name: 'PayPal', icon: 'paypal', provider: 'stripe', sort_order: 2 },
  { code: 'apple_pay', name: 'Apple Pay', icon: 'apple', provider: 'stripe', sort_order: 3 },
  { code: 'google_pay', name: 'Google Pay', icon: 'google', provider: 'stripe', sort_order: 4 },
  { code: 'wallet', name: 'Social Plus Wallet', icon: 'wallet', provider: 'internal', sort_order: 5 },
  { code: 'digital_wallet', name: 'Digital Wallet', icon: 'wallet', provider: 'stripe', sort_order: 6 }
];

function seedPaymentMethods() {
  const count = db.prepare(`SELECT COUNT(*) as c FROM payment_methods`).get().c;
  if (count > 0) return;
  const ins = db.prepare(`
    INSERT INTO payment_methods (code, name, icon, provider, enabled, sort_order)
    VALUES (?, ?, ?, ?, 1, ?)
  `);
  DEFAULT_METHODS.forEach((m) => ins.run(m.code, m.name, m.icon, m.provider, m.sort_order));
}

function getSetting(key, fallback = '') {
  const row = db.prepare(`SELECT value FROM payment_settings WHERE key = ?`).get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO payment_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, String(value));
}

function getPublicSettings() {
  return {
    currency: getSetting('currency', 'usd'),
    taxRate: parseFloat(getSetting('tax_rate', '0')) || 0,
    feeRate: parseFloat(getSetting('fee_rate', '0')) || 0,
    walletEnabled: getSetting('wallet_enabled', 'true') === 'true',
    promoEnabled: getSetting('promo_enabled', 'true') === 'true'
  };
}

function getEnabledMethods() {
  seedPaymentMethods();
  return db.prepare(`
    SELECT id, code, name, icon, provider FROM payment_methods
    WHERE enabled = 1 ORDER BY sort_order ASC, id ASC
  `).all();
}

function listAllMethods() {
  seedPaymentMethods();
  return db.prepare(`SELECT * FROM payment_methods ORDER BY sort_order ASC`).all();
}

function updateMethod(id, patch) {
  const fields = [];
  const params = [];
  if (patch.enabled !== undefined) { fields.push('enabled = ?'); params.push(patch.enabled ? 1 : 0); }
  if (patch.name) { fields.push('name = ?'); params.push(patch.name); }
  if (patch.sort_order !== undefined) { fields.push('sort_order = ?'); params.push(patch.sort_order); }
  if (!fields.length) return;
  params.push(id);
  db.prepare(`UPDATE payment_methods SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}

module.exports = {
  seedPaymentMethods,
  getSetting,
  setSetting,
  getPublicSettings,
  getEnabledMethods,
  listAllMethods,
  updateMethod
};
