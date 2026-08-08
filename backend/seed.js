const bcrypt = require('bcryptjs');
const { db } = require('./db');
const { ROLE_DEFAULTS } = require('./permissions');

const SUPER_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'hamdanmustafa840@gmail.com';
const SUPER_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SocialPlus2026!';

function seed() {
  const existing = db.prepare(`SELECT id FROM admins WHERE email = ? COLLATE NOCASE`).get(SUPER_EMAIL);
  if (!existing) {
    const hash = bcrypt.hashSync(SUPER_PASSWORD, 12);
    db.prepare(`
      INSERT INTO admins (email, name, password_hash, role, permissions)
      VALUES (?, ?, ?, 'super_admin', ?)
    `).run(SUPER_EMAIL, 'Super Admin', hash, JSON.stringify(ROLE_DEFAULTS.super_admin));
    console.log(`Super admin created: ${SUPER_EMAIL}`);
    if (!process.env.SUPER_ADMIN_PASSWORD) {
      console.log(`Default password: ${SUPER_PASSWORD} — change immediately after first login.`);
    }
  }

  const sectionCount = db.prepare(`SELECT COUNT(*) as c FROM site_sections`).get().c;
  if (sectionCount === 0) {
    const sections = [
      ['home', 'Hero', 1, 0],
      ['services', 'Services', 1, 1],
      ['method', 'Method', 1, 2],
      ['work', 'Portfolio', 1, 3],
      ['before-after', 'Before / After', 1, 4],
      ['pricing', 'Pricing', 1, 5],
      ['audit', 'Audit Form', 1, 6],
      ['results', 'Results', 1, 7],
      ['instagram', 'Instagram', 1, 8],
      ['about', 'About', 1, 9],
      ['contact', 'Contact', 1, 10]
    ];
    const ins = db.prepare(`INSERT INTO site_sections (id, label, enabled, sort_order) VALUES (?, ?, ?, ?)`);
    sections.forEach((s) => ins.run(...s));
  }

  const serviceCount = db.prepare(`SELECT COUNT(*) as c FROM services`).get().c;
  if (serviceCount === 0) {
    const plans = [
      ['Starter', 'المبتدئ', 'Essential social presence', 'حضور أساسي على السوشيال', 12, 'pricing', 0, 0],
      ['Growth', 'النمو', 'Scale your reach', 'وسّع وصولك', 25, 'pricing', 1, 1],
      ['Pro', 'احترافي', 'Full-service management', 'إدارة شاملة', 50, 'pricing', 0, 2]
    ];
    const ins = db.prepare(`
      INSERT INTO services (title_en, title_ar, description_en, description_ar, price, category, featured, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    plans.forEach((p) => ins.run(...p));
  }

  const settingsDefaults = {
    site_name: 'Social Plus',
    site_description: 'Premium social media agency in Palestine',
    contact_email: 'hello@socialplus.ps',
    contact_whatsapp: '970595052784',
    contact_instagram: 'socialplus.ps',
    seo_title: 'Social Plus — Premium Social Media Agency',
    seo_description: 'Social media management, content, and growth for brands in Palestine.',
    seo_keywords: 'social media, marketing, Palestine, content',
    social_instagram: 'https://instagram.com/socialplus.ps',
    social_tiktok: 'https://tiktok.com/@m2nvm',
    social_whatsapp: 'https://wa.me/970595052784',
    security_session_hours: '8',
    security_password_min: '8',
    security_2fa_optional: 'true'
  };

  const upsertSetting = db.prepare(`
    INSERT INTO site_settings (key, value, category) VALUES (?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `);
  Object.entries(settingsDefaults).forEach(([key, value]) => {
    const cat = key.startsWith('seo_') ? 'seo' : key.startsWith('social_') ? 'social' : key.startsWith('security_') ? 'security' : 'general';
    upsertSetting.run(key, value, cat);
  });

  const designDefaults = {
    primary_color: '#c9a227',
    bg_color: '#0a0a0f',
    text_color: '#f5f5f7',
    accent_color: '#e8c547',
    font_family: 'Inter, system-ui, sans-serif',
    border_radius: '12px',
    dark_mode: 'true',
    nav_style: 'transparent',
    button_style: 'gold-gradient',
    animation_enabled: 'true'
  };
  const upsertDesign = db.prepare(`INSERT INTO design_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`);
  Object.entries(designDefaults).forEach(([k, v]) => upsertDesign.run(k, v));

  console.log('Seed complete.');
}

if (require.main === module) seed();
module.exports = { seed, SUPER_EMAIL };
