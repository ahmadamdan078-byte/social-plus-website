const { db } = require('../db');
const { logAdminAction } = require('../audit');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../permissions');

function ip(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function routerContent() {
  const express = require('express');
  const router = express.Router();

  router.get('/', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const content = db.prepare(`SELECT * FROM site_content ORDER BY section, sort_order`).all();
    const sections = db.prepare(`SELECT * FROM site_sections ORDER BY sort_order`).all();
    const faqs = db.prepare(`SELECT * FROM faqs WHERE deleted_at IS NULL ORDER BY sort_order`).all();
    const testimonials = db.prepare(`SELECT * FROM testimonials WHERE deleted_at IS NULL ORDER BY sort_order`).all();
    const announcements = db.prepare(`SELECT * FROM announcements ORDER BY id DESC LIMIT 10`).all();
    res.json({ content, sections, faqs, testimonials, announcements });
  });

  router.put('/item', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const { key, value_en, value_ar, section, sort_order, visible } = req.body || {};
    if (!key) return res.status(400).json({ error: 'Key required' });
    db.prepare(`
      INSERT INTO site_content (key, value_en, value_ar, section, sort_order, visible, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value_en = excluded.value_en,
        value_ar = excluded.value_ar,
        section = excluded.section,
        sort_order = excluded.sort_order,
        visible = excluded.visible,
        updated_at = datetime('now')
    `).run(key, value_en || '', value_ar || '', section || null, sort_order ?? 0, visible ?? 1);
    logAdminAction(req.admin.id, 'update_content', 'content', key, req.body, ip(req));
    res.json({ ok: true });
  });

  router.delete('/item/:key', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    db.prepare(`DELETE FROM site_content WHERE key = ?`).run(req.params.key);
    logAdminAction(req.admin.id, 'delete_content', 'content', req.params.key, null, ip(req));
    res.json({ ok: true });
  });

  router.put('/sections', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const { sections } = req.body || {};
    if (!Array.isArray(sections)) return res.status(400).json({ error: 'sections array required' });
    const upsert = db.prepare(`
      INSERT INTO site_sections (id, label, enabled, sort_order)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET label = excluded.label, enabled = excluded.enabled, sort_order = excluded.sort_order
    `);
    const tx = db.transaction((items) => {
      items.forEach((s, i) => upsert.run(s.id, s.label, s.enabled ? 1 : 0, s.sort_order ?? i));
    });
    tx(sections);
    logAdminAction(req.admin.id, 'update_sections', 'sections', null, { count: sections.length }, ip(req));
    res.json({ ok: true });
  });

  router.post('/faqs', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const b = req.body || {};
    const r = db.prepare(`
      INSERT INTO faqs (question_en, question_ar, answer_en, answer_ar, visible, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(b.question_en, b.question_ar || '', b.answer_en, b.answer_ar || '', b.visible ?? 1, b.sort_order ?? 0);
    logAdminAction(req.admin.id, 'create_faq', 'faq', r.lastInsertRowid, null, ip(req));
    res.status(201).json({ id: r.lastInsertRowid });
  });

  router.patch('/faqs/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    db.prepare(`
      UPDATE faqs SET
        question_en = COALESCE(?, question_en),
        question_ar = COALESCE(?, question_ar),
        answer_en = COALESCE(?, answer_en),
        answer_ar = COALESCE(?, answer_ar),
        visible = COALESCE(?, visible),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ? AND deleted_at IS NULL
    `).run(b.question_en, b.question_ar, b.answer_en, b.answer_ar, b.visible, b.sort_order, id);
    logAdminAction(req.admin.id, 'update_faq', 'faq', id, b, ip(req));
    res.json({ ok: true });
  });

  router.delete('/faqs/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const id = parseInt(req.params.id, 10);
    db.prepare(`UPDATE faqs SET deleted_at = datetime('now') WHERE id = ?`).run(id);
    logAdminAction(req.admin.id, 'soft_delete_faq', 'faq', id, null, ip(req));
    res.json({ ok: true });
  });

  router.post('/testimonials', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const b = req.body || {};
    const r = db.prepare(`
      INSERT INTO testimonials (name, role, content_en, content_ar, visible, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(b.name, b.role || '', b.content_en, b.content_ar || '', b.visible ?? 0, b.sort_order ?? 0);
    res.status(201).json({ id: r.lastInsertRowid });
  });

  router.patch('/testimonials/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    db.prepare(`
      UPDATE testimonials SET
        name = COALESCE(?, name), role = COALESCE(?, role),
        content_en = COALESCE(?, content_en), content_ar = COALESCE(?, content_ar),
        visible = COALESCE(?, visible), sort_order = COALESCE(?, sort_order)
      WHERE id = ? AND deleted_at IS NULL
    `).run(b.name, b.role, b.content_en, b.content_ar, b.visible, b.sort_order, id);
    res.json({ ok: true });
  });

  router.delete('/testimonials/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    db.prepare(`UPDATE testimonials SET deleted_at = datetime('now') WHERE id = ?`).run(parseInt(req.params.id, 10));
    res.json({ ok: true });
  });

  router.post('/announcements', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const b = req.body || {};
    if (b.active) db.prepare(`UPDATE announcements SET active = 0`).run();
    const r = db.prepare(`
      INSERT INTO announcements (message_en, message_ar, active) VALUES (?, ?, ?)
    `).run(b.message_en, b.message_ar || '', b.active ? 1 : 0);
    res.status(201).json({ id: r.lastInsertRowid });
  });

  router.patch('/announcements/:id', requireAuth, requirePermission(PERMISSIONS.MANAGE_CONTENT), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    if (b.active) db.prepare(`UPDATE announcements SET active = 0`).run();
    db.prepare(`
      UPDATE announcements SET message_en = COALESCE(?, message_en), message_ar = COALESCE(?, message_ar), active = COALESCE(?, active)
      WHERE id = ?
    `).run(b.message_en, b.message_ar, b.active, id);
    res.json({ ok: true });
  });

  return router;
}

module.exports = routerContent;
