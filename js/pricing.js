/**
 * Shared plan pricing — public API + site-overrides.json for all visitors.
 * Admin localStorage is preview-only while editing.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'sp_admin_overrides';

  const DEFAULTS = {
    starter: { price: 15.99, name: 'Starter Plan', image: '/assets/brand-circle.png' },
    growth: { price: 27.99, name: 'Growth Plan', image: '/assets/social-plus-logo.png', featured: true },
    pro: { price: 54.99, name: 'Pro Plan', image: '/assets/social-plus-logo.png' }
  };

  const TIERS = ['starter', 'growth', 'pro'];

  let remoteOverrides = {};
  let apiPrices = null;
  let readyResolve;
  const ready = new Promise((resolve) => { readyResolve = resolve; });

  function parsePriceText(val) {
    if (val == null || val === '') return null;
    const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function loadLocalOverrides() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function getUrlPrice(tier) {
    const params = new URLSearchParams(location.search);
    const plan = (params.get('plan') || 'growth').toLowerCase();
    if (plan !== tier) return null;
    return parsePriceText(params.get('price'));
  }

  function getPriceFromOverrides(source, tier) {
    if (!source) return null;
    if (source.pricing?.[tier] != null && source.pricing[tier] !== '') {
      return Number(source.pricing[tier]);
    }
    const textKey = `pricing.${tier}.price`;
    const fromText = parsePriceText(source.texts?.[textKey]);
    if (fromText != null) return fromText;
    return null;
  }

  function isAdminPreview() {
    return document.body?.classList.contains('is-admin') || document.body?.classList.contains('admin-open');
  }

  function getPrice(tier) {
    const t = (tier || 'growth').toLowerCase();

    const fromUrl = getUrlPrice(t);
    if (fromUrl != null) return fromUrl;

    if (apiPrices?.[t] != null) return apiPrices[t];

    const fromRemote = getPriceFromOverrides(remoteOverrides, t);
    if (fromRemote != null) return fromRemote;

    if (isAdminPreview()) {
      const local = loadLocalOverrides();
      const fromLocal = getPriceFromOverrides(local, t);
      if (fromLocal != null) return fromLocal;
    }

    if (typeof window.__SP_GET_PRICE__ === 'function') return window.__SP_GET_PRICE__(t);

    return DEFAULTS[t]?.price ?? DEFAULTS.growth.price;
  }

  function getPlan(tier) {
    const t = (tier || 'growth').toLowerCase();
    const base = DEFAULTS[t] || DEFAULTS.growth;
    return {
      id: t,
      name: base.name,
      price: getPrice(t),
      image: base.image,
      featured: !!base.featured
    };
  }

  function getAllPlans() {
    return TIERS.map(getPlan);
  }

  function formatPrice(amount) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '$0';
    return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
  }

  function applyToDom() {
    TIERS.forEach((tier) => {
      const el = document.querySelector(`[data-price-tier="${tier}"]`);
      if (el) el.textContent = formatPrice(getPrice(tier));
    });
    patchCheckoutLinks();
  }

  function patchCheckoutLinks() {
    document.querySelectorAll('a[href*="checkout.html"]').forEach((a) => {
      try {
        const url = new URL(a.getAttribute('href'), location.href);
        const plan = (url.searchParams.get('plan') || '').toLowerCase();
        if (!plan || !DEFAULTS[plan]) return;
        url.searchParams.set('price', String(getPrice(plan)));
        a.href = `${url.pathname}${url.search}`;
      } catch {
        /* ignore bad href */
      }
    });
  }

  function setFromPublicPricing(plans) {
    if (!plans) return;
    apiPrices = { ...(apiPrices || {}), ...plans };
  }

  function setFromServices(services) {
    if (!services?.length) return;
    const prices = {};
    services
      .filter((s) => s.category === 'pricing')
      .forEach((s) => {
        const id = (s.title_en || '').trim().toLowerCase();
        if (DEFAULTS[id] && s.price != null) prices[id] = Number(s.price);
      });
    if (Object.keys(prices).length) apiPrices = { ...(apiPrices || {}), ...prices };
  }

  function setFromSettings(settings) {
    if (!settings) return;
    const prices = {};
    TIERS.forEach((t) => {
      const key = `pricing_${t}`;
      if (settings[key] != null && settings[key] !== '') prices[t] = Number(settings[key]);
    });
    if (Object.keys(prices).length) apiPrices = { ...(apiPrices || {}), ...prices };
  }

  function setFromBootstrap(plans) {
    if (!plans?.length) return;
    const local = loadLocalOverrides();
    const hasLocal = TIERS.some((t) => getPriceFromOverrides(local, t) != null);
    const hasRemote = TIERS.some((t) => getPriceFromOverrides(remoteOverrides, t) != null);
    if (hasLocal || hasRemote || getUrlPrice(TIERS[0]) != null) return;

    const prices = {};
    plans.forEach((p) => {
      if (p.id && p.price != null) prices[p.id] = Number(p.price);
    });
    apiPrices = { ...(apiPrices || {}), ...prices };
  }

  async function loadRemote() {
    const pricingUrl = window.SP_ADMIN_CONFIG?.pricingUrl || 'data/pricing.json';
    try {
      const res = await fetch(`${pricingUrl}?v=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) setFromPublicPricing(await res.json());
    } catch {
      /* optional file */
    }
    const url = window.SP_ADMIN_CONFIG?.overridesUrl;
    if (!url) return;
    try {
      const res = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) remoteOverrides = await res.json();
    } catch {
      /* static host may not have overrides file */
    }
  }

  async function loadSiteConfig() {
    if (typeof window.spApi !== 'function') return;
    try {
      const res = await fetch(window.spApi('/api/public/site-config'), { cache: 'no-store' });
      if (res.ok) {
        const config = await res.json();
        setFromServices(config.services);
        setFromSettings(config.settings);
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      const res = await fetch(window.spApi('/api/public/pricing'), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.plans) apiPrices = { ...(apiPrices || {}), ...data.plans };
      }
    } catch {
      /* API unavailable on static GitHub Pages */
    }
  }

  document.addEventListener('sp:site-config', (e) => {
    setFromPublicPricing(e.detail?.pricing);
    setFromServices(e.detail?.services);
    setFromSettings(e.detail?.settings);
    applyToDom();
  });

  document.addEventListener('sp:local-overrides', () => applyToDom());

  window.SP_PRICING = {
    DEFAULTS,
    TIERS,
    ready,
    getPrice,
    getPlan,
    getAllPlans,
    applyToDom,
    patchCheckoutLinks,
    setFromServices,
    setFromPublicPricing,
    setFromBootstrap,
    loadRemote,
    loadSiteConfig
  };

  async function boot() {
    window.__SP_REFRESH_PRICES__?.();
    applyToDom();
    await Promise.all([loadRemote(), loadSiteConfig()]);
    window.__SP_REFRESH_PRICES__?.();
    applyToDom();
    readyResolve();
    document.dispatchEvent(new CustomEvent('sp:pricing-ready'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
