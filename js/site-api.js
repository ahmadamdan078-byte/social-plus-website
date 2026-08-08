/**
 * Loads published site config from API and applies to public website.
 * Tracks real page views for analytics.
 */
(function () {
  'use strict';

  if (location.pathname.startsWith('/admin')) return;

  const SESSION_KEY = 'sp_visitor_session';
  function getSessionId() {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function trackPageView() {
    fetch(window.spApi('/api/analytics/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'pageview',
        page: location.pathname + location.hash,
        session_id: getSessionId()
      })
    }).catch(() => {});
  }

  function applyDesign(design) {
    if (!design || !Object.keys(design).length) return;
    let el = document.getElementById('sp-dynamic-design');
    if (!el) {
      el = document.createElement('style');
      el.id = 'sp-dynamic-design';
      document.head.appendChild(el);
    }
    el.textContent = `
      :root {
        --gold: ${design.primary_color || '#E91E8C'};
        --gold-light: ${design.accent_color || '#FF5722'};
        --bg: ${design.bg_color || '#0a0a0f'};
        --text: ${design.text_color || '#f5f5f7'};
        --radius: ${design.border_radius || '12px'};
      }
      ${design.custom_css || ''}`;
    if (design.animation_enabled === 'false') {
      document.documentElement.classList.add('sp-no-animations');
    }
  }

  function applyContent(content, lang) {
    if (!content) return;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const item = content[key];
      if (!item) return;
      const val = lang === 'ar' ? (item.ar || item.en) : (item.en || item.ar);
      if (val) el.textContent = val;
    });
  }

  function applySections(sections) {
    if (!sections?.length) return;
    sections.forEach((s) => {
      const el = document.getElementById(s.id) || document.querySelector(`[data-section="${s.id}"]`);
      if (el) el.hidden = false;
    });
    const disabled = sections.filter(s => !s.enabled).map(s => s.id);
    disabled.forEach((id) => {
      const el = document.getElementById(id) || document.querySelector(`[data-section="${id}"]`);
      if (el) el.hidden = true;
    });
  }

  function applySettings(settings) {
    if (!settings) return;
    if (settings.seo_title) document.title = settings.seo_title;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && settings.seo_description) desc.content = settings.seo_description;
    if (settings.site_name) {
      const brand = document.querySelector('.brand-text, .logo-text');
      if (brand) brand.textContent = settings.site_name;
    }
  }

  function applyAnnouncement(ann) {
    if (!ann?.message_en) return;
    let bar = document.getElementById('sp-announcement-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'sp-announcement-bar';
      bar.style.cssText = 'background:linear-gradient(180deg,#E91E8C,#FF5722);color:#fff;text-align:center;padding:8px 16px;font-size:0.875rem;font-weight:600;position:fixed;top:0;left:0;right:0;z-index:9999';
      document.body.prepend(bar);
      document.body.style.paddingTop = '36px';
    }
    const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    bar.textContent = lang === 'ar' ? (ann.message_ar || ann.message_en) : ann.message_en;
  }

  async function loadSiteConfig() {
    try {
      const res = await fetch(window.spApi('/api/public/site-config'));
      if (!res.ok) return;
      const config = await res.json();
      const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
      applyDesign(config.design);
      applyContent(config.content, lang);
      applySections(config.sections);
      applySettings(config.settings);
      if (config.announcement?.active) applyAnnouncement(config.announcement);

      window.__SP_SITE_CONFIG = config;
      document.dispatchEvent(new CustomEvent('sp:site-config', { detail: config }));
    } catch {
      /* API unavailable on static hosting — fall back to local overrides */
      try {
        const local = localStorage.getItem('sp_admin_overrides');
        if (local) {
          const overrides = JSON.parse(local);
          document.dispatchEvent(new CustomEvent('sp:local-overrides', { detail: overrides }));
        }
      } catch {}
    }
  }

  window.SP_trackConversion = function (metadata) {
    fetch(window.spApi('/api/analytics/event'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'conversion',
        page: location.pathname,
        session_id: getSessionId(),
        metadata
      })
    }).catch(() => {});
  };

  function whenIdle(fn) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(fn, { timeout: 3000 });
    } else {
      setTimeout(fn, 400);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      whenIdle(() => {
        loadSiteConfig();
        trackPageView();
      });
    });
  } else {
    whenIdle(() => {
      loadSiteConfig();
      trackPageView();
    });
  }
})();
