const fs = require('fs');
const path = require('path');
const { db } = require('../db');

const TIERS = ['starter', 'growth', 'pro'];
const DEFAULTS = { starter: 15.99, growth: 27.99, pro: 54.99 };
const TIER_NAMES = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro'
};

const OVERRIDES_PATH = path.join(__dirname, '../../data/site-overrides.json');
const PRICING_PATH = path.join(__dirname, '../../data/pricing.json');

function readSettingPrice(tier) {
  const row = db.prepare(`SELECT value FROM site_settings WHERE key = ?`).get(`pricing_${tier}`);
  if (row?.value != null && row.value !== '') return Number(row.value);
  return null;
}

function readServicePrice(tier) {
  const name = TIER_NAMES[tier];
  const row = db.prepare(`
    SELECT price FROM services
    WHERE category = 'pricing' AND deleted_at IS NULL
      AND title_en = ? COLLATE NOCASE
    ORDER BY id LIMIT 1
  `).get(name);
  if (row?.price != null) return Number(row.price);
  return null;
}

function getPlanPricing() {
  const plans = {};
  TIERS.forEach((tier) => {
    plans[tier] = readSettingPrice(tier) ?? readServicePrice(tier) ?? DEFAULTS[tier];
  });
  return plans;
}

function setPlanPricing(input) {
  const plans = getPlanPricing();
  TIERS.forEach((tier) => {
    if (input[tier] != null && !Number.isNaN(Number(input[tier]))) {
      plans[tier] = Number(input[tier]);
    }
  });

  const upsertSetting = db.prepare(`
    INSERT INTO site_settings (key, value, category, updated_at)
    VALUES (?, ?, 'general', datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  const updateService = db.prepare(`
    UPDATE services SET price = ?, updated_at = datetime('now')
    WHERE category = 'pricing' AND deleted_at IS NULL AND title_en = ? COLLATE NOCASE
  `);

  const tx = db.transaction(() => {
    TIERS.forEach((tier) => {
      upsertSetting.run(`pricing_${tier}`, String(plans[tier]));
      updateService.run(plans[tier], TIER_NAMES[tier]);
    });
  });
  tx();

  writePublicOverridesFile(plans);
  return plans;
}

function writePublicOverridesFile(plans) {
  let data = {};
  try {
    if (fs.existsSync(OVERRIDES_PATH)) {
      data = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
    }
  } catch {
    data = {};
  }
  data.pricing = { ...plans };
  fs.mkdirSync(path.dirname(OVERRIDES_PATH), { recursive: true });
  fs.writeFileSync(OVERRIDES_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.writeFileSync(PRICING_PATH, `${JSON.stringify(plans, null, 2)}\n`, 'utf8');
}

module.exports = {
  TIERS,
  DEFAULTS,
  getPlanPricing,
  setPlanPricing,
  writePublicOverridesFile
};
