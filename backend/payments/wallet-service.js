const { db } = require('../db');

function getOrCreateWallet(customerEmail) {
  const email = String(customerEmail || '').trim().toLowerCase();
  if (!email) return null;
  let wallet = db.prepare(`SELECT * FROM wallets WHERE customer_email = ?`).get(email);
  if (!wallet) {
    const r = db.prepare(`
      INSERT INTO wallets (customer_email, balance_cents, promo_balance_cents)
      VALUES (?, 0, 0)
    `).run(email);
    wallet = db.prepare(`SELECT * FROM wallets WHERE id = ?`).get(r.lastInsertRowid);
  }
  return wallet;
}

function getBalance(customerEmail) {
  const w = getOrCreateWallet(customerEmail);
  if (!w) return { balanceCents: 0, promoBalanceCents: 0, totalCents: 0 };
  return {
    balanceCents: w.balance_cents,
    promoBalanceCents: w.promo_balance_cents,
    totalCents: w.balance_cents + w.promo_balance_cents
  };
}

function logTransaction(walletId, { type, amountCents, balanceAfter, reference, metadata, adminId }) {
  db.prepare(`
    INSERT INTO wallet_transactions (wallet_id, type, amount_cents, balance_after_cents, reference, metadata, admin_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    walletId,
    type,
    amountCents,
    balanceAfter,
    reference || '',
    metadata ? JSON.stringify(metadata) : null,
    adminId || null
  );
}

function applyWalletPayment(customerEmail, amountCents, { paymentId, orderId }) {
  const wallet = getOrCreateWallet(customerEmail);
  if (!wallet) throw new Error('Wallet not found');
  const total = wallet.balance_cents + wallet.promo_balance_cents;
  if (total < amountCents) throw new Error('Insufficient wallet balance');

  let remaining = amountCents;
  let promoUsed = Math.min(wallet.promo_balance_cents, remaining);
  remaining -= promoUsed;
  let balanceUsed = remaining;

  const newPromo = wallet.promo_balance_cents - promoUsed;
  const newBalance = wallet.balance_cents - balanceUsed;
  const newTotal = newPromo + newBalance;

  db.prepare(`
    UPDATE wallets SET balance_cents = ?, promo_balance_cents = ?, updated_at = datetime('now') WHERE id = ?
  `).run(newBalance, newPromo, wallet.id);

  logTransaction(wallet.id, {
    type: 'purchase',
    amountCents: -amountCents,
    balanceAfter: newTotal,
    reference: `payment:${paymentId}`,
    metadata: { orderId, promoUsed, balanceUsed }
  });

  return { walletId: wallet.id, promoUsed, balanceUsed, newTotal };
}

function creditWallet(customerEmail, amountCents, { type = 'credit', reference, metadata, adminId, toPromo = false }) {
  const wallet = getOrCreateWallet(customerEmail);
  if (!wallet || amountCents <= 0) throw new Error('Invalid wallet credit');

  const col = toPromo ? 'promo_balance_cents' : 'balance_cents';
  const newVal = wallet[col] + amountCents;
  db.prepare(`
    UPDATE wallets SET ${col} = ?, updated_at = datetime('now') WHERE id = ?
  `).run(newVal, wallet.id);

  const updated = db.prepare(`SELECT * FROM wallets WHERE id = ?`).get(wallet.id);
  const total = updated.balance_cents + updated.promo_balance_cents;

  logTransaction(wallet.id, {
    type,
    amountCents,
    balanceAfter: total,
    reference,
    metadata,
    adminId
  });

  return updated;
}

function refundToWallet(customerEmail, amountCents, { paymentId, orderId, adminId }) {
  return creditWallet(customerEmail, amountCents, {
    type: 'refund',
    reference: `refund:payment:${paymentId}`,
    metadata: { orderId },
    adminId
  });
}

function listTransactions(walletId, limit = 50) {
  return db.prepare(`
    SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT ?
  `).all(walletId, limit);
}

function listWallets(q = '') {
  let sql = `SELECT * FROM wallets WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ` AND customer_email LIKE ?`;
    params.push(`%${q}%`);
  }
  sql += ` ORDER BY updated_at DESC LIMIT 100`;
  return db.prepare(sql).all(...params);
}

module.exports = {
  getOrCreateWallet,
  getBalance,
  applyWalletPayment,
  creditWallet,
  refundToWallet,
  listTransactions,
  listWallets
};
