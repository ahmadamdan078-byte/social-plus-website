const { db } = require('../db');
const { getPlanPricing } = require('../services/plan-pricing');

function routerPublic() {
  const express = require('express');
  const router = express.Router();

  router.get('/site-config', (req, res) => {
    const contentRows = db.prepare(`SELECT key, value_en, value_ar, section, visible FROM site_content WHERE visible = 1`).all();
    const content = {};
    contentRows.forEach((r) => {
      content[r.key] = { en: r.value_en, ar: r.value_ar, section: r.section };
    });

    const sections = db.prepare(`SELECT * FROM site_sections WHERE enabled = 1 ORDER BY sort_order`).all();
    const navigation = db.prepare(`SELECT * FROM navigation_items WHERE visible = 1 ORDER BY sort_order`).all();
    const services = db.prepare(`SELECT * FROM services WHERE visible = 1 AND deleted_at IS NULL ORDER BY sort_order`).all();
    const faqs = db.prepare(`SELECT * FROM faqs WHERE visible = 1 AND deleted_at IS NULL ORDER BY sort_order`).all();
    const testimonials = db.prepare(`SELECT * FROM testimonials WHERE visible = 1 AND deleted_at IS NULL ORDER BY sort_order`).all();
    const announcement = db.prepare(`SELECT * FROM announcements WHERE active = 1 ORDER BY id DESC LIMIT 1`).get();

    const settingsRows = db.prepare(`SELECT key, value FROM site_settings`).all();
    const settings = {};
    settingsRows.forEach((r) => { settings[r.key] = r.value; });

    const designRows = db.prepare(`SELECT key, value FROM design_settings`).all();
    const design = {};
    designRows.forEach((r) => { design[r.key] = r.value; });

    res.json({
      content,
      sections,
      navigation,
      services,
      faqs,
      testimonials,
      announcement: announcement || null,
      settings,
      design,
      pricing: getPlanPricing()
    });
  });

  router.get('/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  router.get('/pricing', (req, res) => {
    res.json({ plans: getPlanPricing() });
  });

  return router;
}

module.exports = routerPublic;
