const { db } = require('../db');

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function validatePromo(code, { planId, subtotalCents, customerEmail }) {
  const normalized = normalizeCode(code);
  if (!normalized) return { valid: false, error: 'Enter a promo code' };

  const promo = db.prepare(`
    SELECT * FROM promo_codes WHERE code = ? COLLATE NOCASE AND active = 1
  `).get(normalized);

  if (!promo) return { valid: false, error: 'Invalid or expired promo code' };
  if (promo.expires_at && promo.expires_at < new Date().toISOString()) {
    return { valid: false, error: 'This promo code has expired' };
  }
  if (promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
    return { valid: false, error: 'This promo code has reached its usage limit' };
  }
  if (promo.min_amount_cents > 0 && subtotalCents < promo.min_amount_cents) {
    const min = (promo.min_amount_cents / 100).toFixed(2);
    return { valid: false, error: `Minimum purchase of $${min} required` };
  }
  if (promo.plan_ids) {
    try {
      const plans = JSON.parse(promo.plan_ids);
      if (Array.isArray(plans) && plans.length && !plans.includes(planId)) {
        return { valid: false, error: 'Promo code not valid for this product' };
      }
    } catch { /* ignore */ }
  }
  if (promo.per_email_limit > 0 && customerEmail) {
    const used = db.prepare(`
      SELECT COUNT(*) as c FROM promo_redemptions
      WHERE promo_id = ? AND customer_email = ? COLLATE NOCASE
    `).get(promo.id, customerEmail).c;
    if (used >= promo.per_email_limit) {
      return { valid: false, error: 'You have already used this promo code' };
    }
  }

  let discountCents = 0;
  if (promo.type === 'percent') {
    discountCents = Math.floor(subtotalCents * (promo.value / 100));
  } else if (promo.type === 'fixed') {
    discountCents = Math.round(promo.value * 100);
  } else if (promo.type === 'gift') {
    discountCents = Math.round(promo.value * 100);
  }
  discountCents = Math.min(subtotalCents, Math.max(0, discountCents));

  return {
    valid: true,
    promoId: promo.id,
    code: promo.code,
    type: promo.type,
    discountCents,
    label: promo.type === 'percent' ? `${promo.value}% off` : `$${(discountCents / 100).toFixed(2)} off`
  };
}

function redeemPromo(promoId, { orderId, paymentId, customerEmail, discountCents }) {
  db.prepare(`
    INSERT INTO promo_redemptions (promo_id, order_id, payment_id, customer_email, discount_cents)
    VALUES (?, ?, ?, ?, ?)
  `).run(promoId, orderId, paymentId, customerEmail || '', discountCents);
  db.prepare(`
    UPDATE promo_codes SET used_count = used_count + 1, updated_at = datetime('now') WHERE id = ?
  `).run(promoId);
  const promo = db.prepare(`SELECT max_uses, used_count FROM promo_codes WHERE id = ?`).get(promoId);
  if (promo && promo.max_uses > 0 && promo.used_count >= promo.max_uses) {
    db.prepare(`UPDATE promo_codes SET active = 0, updated_at = datetime('now') WHERE id = ?`).run(promoId);
  }
}

function listPromos() {
  return db.prepare(`SELECT * FROM promo_codes ORDER BY created_at DESC`).all();
}

function createPromo(data) {
  const r = db.prepare(`
    INSERT INTO promo_codes (code, type, value, max_uses, expires_at, min_amount_cents, plan_ids, per_email_limit, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    normalizeCode(data.code),
    data.type || 'percent',
    parseFloat(data.value) || 0,
    parseInt(data.max_uses, 10) || 0,
    data.expires_at || null,
    parseInt(data.min_amount_cents, 10) || 0,
    data.plan_ids ? JSON.stringify(data.plan_ids) : null,
    parseInt(data.per_email_limit, 10) || 0,
    data.active !== false ? 1 : 0
  );
  return db.prepare(`SELECT * FROM promo_codes WHERE id = ?`).get(r.lastInsertRowid);
}

function updatePromo(id, patch) {
  if (patch.active !== undefined) {
    db.prepare(`UPDATE promo_codes SET active = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(patch.active ? 1 : 0, id);
  }
}

module.exports = {
  validatePromo,
  redeemPromo,
  listPromos,
  createPromo,
  updatePromo,
  normalizeCode
};
