/**
 * Synchronous pricing bootstrap — must load before checkout-store.js.
 * Reads admin saves from localStorage / URL / sessionStorage immediately.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'sp_admin_overrides';
  var SESSION_KEY = 'sp_plan_prices';
  var DEFAULTS = { starter: 15.99, growth: 27.99, pro: 54.99 };

  function parsePrice(val) {
    if (val == null || val === '') return null;
    var n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : null;
  }

  function readOverrides(source) {
    var out = {};
    if (!source) return out;
    Object.keys(DEFAULTS).forEach(function (tier) {
      if (source.pricing && source.pricing[tier] != null && source.pricing[tier] !== '') {
        out[tier] = Number(source.pricing[tier]);
        return;
      }
      var textKey = 'pricing.' + tier + '.price';
      if (source.texts && source.texts[textKey]) {
        var parsed = parsePrice(source.texts[textKey]);
        if (parsed != null) out[tier] = parsed;
      }
    });
    return out;
  }

  var remoteOverrides = {};
  var publicPrices = null;

  function isAdminPreview() {
    return document.body && (document.body.classList.contains('is-admin') || document.body.classList.contains('admin-open'));
  }

  function readPrices() {
    var prices = {};
    Object.keys(DEFAULTS).forEach(function (tier) {
      prices[tier] = DEFAULTS[tier];
    });

    if (publicPrices) {
      Object.keys(publicPrices).forEach(function (tier) {
        if (publicPrices[tier] != null) prices[tier] = Number(publicPrices[tier]);
      });
    }

    Object.assign(prices, readOverrides(remoteOverrides));

    if (isAdminPreview()) {
      try {
        var local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        Object.assign(prices, readOverrides(local));
      } catch (e) {}
    }

    try {
      var session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
      Object.keys(session).forEach(function (tier) {
        if (session[tier] != null && session[tier] !== '') prices[tier] = Number(session[tier]);
      });
    } catch (e) {}

    try {
      var params = new URLSearchParams(location.search);
      var plan = (params.get('plan') || (location.pathname.indexOf('checkout') !== -1 ? 'growth' : '')).toLowerCase();
      var urlPrice = parsePrice(params.get('price'));
      if (plan && urlPrice != null) prices[plan] = urlPrice;
    } catch (e) {}

    return prices;
  }

  function hasLocalOverrides() {
    if (!isAdminPreview()) return false;
    try {
      var local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return Object.keys(readOverrides(local)).length > 0;
    } catch (e) {
      return false;
    }
  }

  function mergeApiPrices(plans) {
    if (!plans) return;
    publicPrices = { ...(publicPrices || {}), ...plans };
    window.__SP_PRICES__ = readPrices();
    document.dispatchEvent(new CustomEvent('sp:pricing-updated', {
      detail: { prices: window.__SP_PRICES__ }
    }));
  }

  function mergeRemoteOverrides(data) {
    if (!data || !data.pricing) return;
    remoteOverrides = { pricing: data.pricing };
    window.__SP_PRICES__ = readPrices();
    document.dispatchEvent(new CustomEvent('sp:pricing-updated', {
      detail: { prices: window.__SP_PRICES__ }
    }));
  }

  function fetchRemotePricing() {
    var tasks = [];
    var pricingUrl = (window.SP_ADMIN_CONFIG && window.SP_ADMIN_CONFIG.pricingUrl) || 'data/pricing.json';
    tasks.push(
      fetch(pricingUrl + '?v=' + Date.now(), { cache: 'no-store' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) { if (data) mergeApiPrices(data); })
        .catch(function () {})
    );
    if (typeof window.spApi === 'function') {
      tasks.push(
        fetch(window.spApi('/api/public/pricing'), { cache: 'no-store' })
          .then(function (res) { return res.ok ? res.json() : null; })
          .then(function (data) { if (data && data.plans) mergeApiPrices(data.plans); })
          .catch(function () {})
      );
    }
    var overridesUrl = (window.SP_ADMIN_CONFIG && window.SP_ADMIN_CONFIG.overridesUrl) || 'data/site-overrides.json';
    tasks.push(
      fetch(overridesUrl + '?v=' + Date.now(), { cache: 'no-store' })
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (data) { mergeRemoteOverrides(data); })
        .catch(function () {})
    );
    return Promise.all(tasks);
  }

  function applyCheckoutFallbackPrice() {
    if (location.pathname.indexOf('checkout') === -1) return;
    var params = new URLSearchParams(location.search);
    var plan = (params.get('plan') || 'growth').toLowerCase();
    var price = getPrice(plan);
    var priceEl = document.getElementById('fb-price');
    var totalEl = document.getElementById('fb-total');
    if (priceEl) priceEl.textContent = '$' + Number(price).toFixed(2);
    if (totalEl) totalEl.textContent = '$' + Number(price).toFixed(2);
  }

  function getPrice(tier) {
    var t = (tier || 'growth').toLowerCase();
    var prices = window.__SP_PRICES__ || readPrices();
    return prices[t] != null ? prices[t] : DEFAULTS.growth;
  }

  function refreshPrices() {
    window.__SP_PRICES__ = readPrices();
    document.dispatchEvent(new CustomEvent('sp:pricing-updated', {
      detail: { prices: window.__SP_PRICES__ }
    }));
    return window.__SP_PRICES__;
  }

  window.__SP_PRICES__ = readPrices();
  window.__SP_GET_PRICE__ = getPrice;
  window.__SP_REFRESH_PRICES__ = refreshPrices;

  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[href*="checkout.html"]') : null;
    if (!link) return;
    try {
      var url = new URL(link.getAttribute('href'), location.href);
      var plan = (url.searchParams.get('plan') || '').toLowerCase();
      if (!plan) return;
      var tierEl = document.querySelector('[data-price-tier="' + plan + '"]');
      var domPrice = tierEl ? parsePrice(tierEl.textContent) : null;
      var price = domPrice != null ? domPrice : getPrice(plan);
      url.searchParams.set('price', String(price));
      link.href = url.pathname + url.search;
      var stored = {};
      try { stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}'); } catch (err) {}
      stored[plan] = price;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
    } catch (err) {}
  }, true);

  function formatPrice(amount) {
    var n = Number(amount);
    if (!isFinite(n)) return '$0';
    return Math.floor(n) === n ? '$' + n : '$' + n.toFixed(2);
  }

  function applyDomPrices() {
    document.querySelectorAll('[data-price-tier]').forEach(function (el) {
      var tier = el.getAttribute('data-price-tier');
      if (tier) el.textContent = formatPrice(getPrice(tier));
    });
    applyCheckoutFallbackPrice();
  }

  function bootInline() {
    applyDomPrices();
    fetchRemotePricing().then(function () {
      refreshPrices();
      applyCheckoutFallbackPrice();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootInline);
  } else {
    bootInline();
  }
})();
