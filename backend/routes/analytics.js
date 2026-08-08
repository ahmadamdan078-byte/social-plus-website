const { db } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');

function routerAnalytics() {
  const express = require('express');
  const router = express.Router();

  router.post('/event', (req, res) => {
    const { event_type, page, referrer, session_id, metadata } = req.body || {};
    if (!event_type) return res.status(400).json({ error: 'event_type required' });
    db.prepare(`
      INSERT INTO analytics_events (event_type, page, referrer, session_id, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      event_type,
      page || null,
      referrer || req.headers.referer || null,
      session_id || null,
      metadata ? JSON.stringify(metadata) : null
    );
    res.status(201).json({ ok: true });
  });

  router.get('/dashboard', requireAuth, requirePermission(PERMISSIONS.MANAGE_ANALYTICS), (req, res) => {
    const { period = '30' } = req.query;
    const days = parseInt(period, 10) || 30;
    const since = `datetime('now', '-${days} days')`;

    const totalUsers = db.prepare(`SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL`).get().c;
    const newUsers = db.prepare(`SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND created_at >= ${since}`).get().c;
    const activeUsers = db.prepare(`
      SELECT COUNT(*) as c FROM users WHERE deleted_at IS NULL AND last_login_at >= ${since}
    `).get().c;

    const pageViews = db.prepare(`
      SELECT COUNT(*) as c FROM analytics_events WHERE event_type = 'pageview' AND created_at >= ${since}
    `).get().c;

    const visitors = db.prepare(`
      SELECT COUNT(DISTINCT session_id) as c FROM analytics_events
      WHERE event_type = 'pageview' AND created_at >= ${since} AND session_id IS NOT NULL
    `).get().c;

    const orders = db.prepare(`
      SELECT COUNT(*) as c FROM orders WHERE deleted_at IS NULL AND created_at >= ${since}
    `).get().c;

    const revenue = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM orders
      WHERE deleted_at IS NULL AND status NOT IN ('cancelled') AND created_at >= ${since}
    `).get().total;

    const conversions = db.prepare(`
      SELECT COUNT(*) as c FROM analytics_events WHERE event_type = 'conversion' AND created_at >= ${since}
    `).get().c;

    const conversionRate = pageViews > 0 ? ((conversions / pageViews) * 100).toFixed(2) : '0.00';

    const topPages = db.prepare(`
      SELECT page, COUNT(*) as views FROM analytics_events
      WHERE event_type = 'pageview' AND created_at >= ${since} AND page IS NOT NULL
      GROUP BY page ORDER BY views DESC LIMIT 10
    `).all();

    const trafficSources = db.prepare(`
      SELECT referrer, COUNT(*) as visits FROM analytics_events
      WHERE event_type = 'pageview' AND created_at >= ${since}
      GROUP BY referrer ORDER BY visits DESC LIMIT 10
    `).all();

    const dailyStats = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as views FROM analytics_events
      WHERE event_type = 'pageview' AND created_at >= ${since}
      GROUP BY date(created_at) ORDER BY day
    `).all();

    res.json({
      totalUsers,
      newUsers,
      activeUsers,
      pageViews,
      visitors,
      orders,
      revenue,
      conversionRate,
      topPages,
      trafficSources,
      dailyStats,
      period: days
    });
  });

  return router;
}

module.exports = routerAnalytics;
