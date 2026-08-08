#!/usr/bin/env node
'use strict';

/**
 * Payment flow unit tests (no live Stripe keys required).
 * Run: NODE_PATH=./server/node_modules node scripts/test-payments.js
 */

const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
const testDb = path.join(__dirname, '../data/test-payments.db');
if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
process.env.DATABASE_PATH = testDb;

const { db, initSchema } = require('../backend/db');
initSchema();

const {
  computeTotals,
  createPendingOrder,
  markPaymentStatus,
  findPaymentBySession,
  findPaymentById
} = require('../backend/payments/order-service');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log('\nPayment order service tests\n');

const totals = computeTotals('growth', 2);
assert(totals.totalCents === 5000, 'Growth x2 totals $50.00');
assert(totals.planName === 'Growth Plan', 'Plan name correct');

const { orderId, paymentId } = createPendingOrder({
  planId: 'starter',
  customerName: 'Test User',
  customerEmail: 'test@example.com',
  customerPhone: '+970',
  quantity: 1
});
assert(orderId > 0 && paymentId > 0, 'Creates pending order + payment');

const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
assert(order.payment_status === 'pending', 'Order payment_status is pending');

markPaymentStatus(paymentId, 'succeeded', {
  sessionId: 'cs_test_123',
  paymentId: 'pi_test_456',
  transactionId: 'pi_test_456'
});
const paid = findPaymentById(paymentId);
assert(paid.status === 'succeeded', 'Payment marked succeeded');
const paidOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
assert(paidOrder.payment_status === 'succeeded', 'Order payment_status synced');

markPaymentStatus(paymentId, 'failed', { errorMessage: 'Card declined' });
assert(findPaymentById(paymentId).status === 'failed', 'Payment marked failed');

const p2 = createPendingOrder({
  planId: 'pro',
  customerName: 'Test User',
  customerEmail: 'fail@example.com',
  quantity: 1
});
markPaymentStatus(p2.paymentId, 'cancelled', { sessionId: 'cs_cancel' });
assert(findPaymentBySession('cs_cancel')?.status === 'cancelled', 'Payment cancelled by session');

const p3 = createPendingOrder({
  planId: 'starter',
  customerName: 'Reuse Test',
  customerEmail: 'reuse@example.com',
  quantity: 1
});
db.prepare(`UPDATE payments SET provider_session_id = ? WHERE id = ?`).run('cs_existing', p3.paymentId);
const dup = createPendingOrder({
  planId: 'starter',
  customerName: 'Reuse Test',
  customerEmail: 'reuse@example.com',
  quantity: 1
});
assert(dup.reused === true && dup.orderId === p3.orderId, 'Duplicate pending checkout reuses order');

console.log(`\n${passed} passed, ${failed} failed\n`);
if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
process.exit(failed ? 1 : 0);
