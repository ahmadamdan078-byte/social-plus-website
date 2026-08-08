/**
 * Social Plus — Admin system
 * Full site control for configured admin emails
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'sp_admin_overrides';
  const cfg = window.SP_ADMIN_CONFIG || { emails: [] };
  const adminEmails = (cfg.emails || []).map(e => e.toLowerCase().trim());

  let isAdmin = false;
  let overrides = {};
  let liveEdit = false;
  let activeTab = 'dashboard';

  const panel = document.getElementById('admin-panel');
  const toggle = document.getElementById('admin-toggle');
  const backdrop = document.getElementById('admin-backdrop');

  function t(key) {
    const lang = localStorage.getItem('sp-lang') || 'en';
    return (window.SP_I18N?.[lang]?.[key]) || key;
  }

  function notify(msg) {
    window.dispatchEvent(new CustomEvent('sp:toast', { detail: { message: msg } }));
  }

  function isAdminEmail(email) {
    return !!email && adminEmails.includes(String(email).toLowerCase().trim());
  }

  function loadLocalOverrides() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (err) {
      return {};
    }
  }

  function saveOverrides() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    applyOverrides();
    renderPanel();
    notify(t('admin.saved'));
  }

  function deepMerge(target, source) {
    const out = { ...target };
    Object.keys(source || {}).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        out[key] = deepMerge(out[key] || {}, source[key]);
      } else {
        out[key] = source[key];
      }
    });
    return out;
  }

  async function fetchRemoteOverrides() {
    if (!cfg.overridesUrl) return {};
    try {
      const res = await fetch(`${cfg.overridesUrl}?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return {};
      return await res.json();
    } catch (err) {
      return {};
    }
  }

  async function initOverrides() {
    const remote = await fetchRemoteOverrides();
    const local = loadLocalOverrides();
    overrides = deepMerge(remote, local);
    applyOverrides();
  }

  function get(path, fallback) {
    return path.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : undefined), overrides) ?? fallback;
  }

  function set(path, value) {
    const keys = path.split('.');
    let obj = overrides;
    keys.forEach((k, i) => {
      if (i === keys.length - 1) obj[k] = value;
      else {
        if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {};
        obj = obj[k];
      }
    });
  }

  function applyOverrides() {
    const maint = get('features.maintenance', false);
    const maintEl = document.getElementById('maintenance-screen');
    if (maint && !isAdmin) {
      if (maintEl) maintEl.hidden = false;
      document.body.classList.add('is-maintenance');
      return;
    }
    if (maintEl) maintEl.hidden = true;
    document.body.classList.remove('is-maintenance');

    /* i18n text overrides */
    const texts = get('texts', {});
    Object.entries(texts).forEach(([key, val]) => {
      if (!val) return;
      document.querySelectorAll(`[data-i18n="${key}"]`).forEach(el => {
        if (el.childElementCount === 0) el.textContent = val;
        else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = val;
      });
      if (window.SP_I18N) {
        ['en', 'ar'].forEach(lang => {
          if (window.SP_I18N[lang]) window.SP_I18N[lang][key] = val;
        });
      }
    });

    /* Section visibility */
    const sections = get('sections', {});
    Object.entries(sections).forEach(([id, visible]) => {
      const el = document.getElementById(id);
      if (el) el.hidden = visible === false;
    });

    /* Pricing */
    ['starter', 'growth', 'pro'].forEach(tier => {
      const price = get(`pricing.${tier}`);
      const el = document.querySelector(`[data-price-tier="${tier}"]`);
      if (price != null && el) el.textContent = `$${price}`;
    });

    /* Contact links */
    const wa = get('contact.whatsapp');
    if (wa) {
      document.querySelectorAll('[data-wa-link]').forEach(a => {
        a.href = `https://wa.me/${wa}?text=${encodeURIComponent("Hello Social Plus! I'd like to learn more about your services.")}`;
      });
    }
    const ig = get('contact.instagram');
    if (ig) {
      document.querySelectorAll('[data-ig-link]').forEach(a => {
        a.href = ig.startsWith('http') ? ig : `https://www.instagram.com/${ig.replace('@', '')}/`;
        if (a.textContent.includes('@')) a.textContent = ig.startsWith('@') ? ig : `@${ig.replace(/^@/, '')}`;
      });
    }

    /* Feature toggles */
    const socialAi = document.getElementById('social-ai');
    if (socialAi) socialAi.hidden = get('features.socialAi', true) === false;
    const floatWa = document.getElementById('float-whatsapp');
    if (floatWa) floatWa.hidden = get('features.whatsapp', true) === false;

    /* Custom CSS */
    let styleEl = document.getElementById('admin-custom-css');
    const css = get('customCss', '');
    if (css) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'admin-custom-css';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = css;
    } else if (styleEl) styleEl.textContent = '';

    /* Announcement banner */
    let banner = document.getElementById('admin-banner');
    const msg = get('announcement', '');
    if (msg) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'admin-banner';
        banner.className = 'admin-banner';
        document.body.prepend(banner);
      }
      banner.textContent = msg;
      banner.hidden = false;
    } else if (banner) banner.hidden = true;

    document.body.classList.toggle('admin-live-edit', liveEdit && isAdmin);
  }

  function setAdmin(user) {
    const wasAdmin = isAdmin;
    isAdmin = !!(user && (user.role === 'admin' || isAdminEmail(user.email)));
    document.body.classList.toggle('is-admin', isAdmin);
    if (toggle) toggle.hidden = !isAdmin;
    if (isAdmin && user) user.role = 'admin';
    if (isAdmin && !wasAdmin) applyOverrides();
    if (!isAdmin) {
      closePanel();
      liveEdit = false;
    }
  }

  function openPanel() {
    if (!isAdmin || !panel) return;
    panel.hidden = false;
    if (backdrop) backdrop.hidden = false;
    document.body.classList.add('admin-open');
    renderPanel();
  }

  function closePanel() {
    if (panel) panel.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('admin-open');
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify(overrides, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site-overrides.json';
    a.click();
    notify(t('admin.exported'));
  }

  function importSettings(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        overrides = JSON.parse(reader.result);
        saveOverrides();
      } catch (err) {
        notify(t('admin.importFail'));
      }
    };
    reader.readAsText(file);
  }

  function resetSettings() {
    if (!confirm(t('admin.resetConfirm'))) return;
    overrides = {};
    localStorage.removeItem(STORAGE_KEY);
    applyOverrides();
    renderPanel();
    notify(t('admin.resetDone'));
  }

  function clearAllData() {
    if (!confirm(t('admin.clearConfirm'))) return;
    Object.keys(localStorage).filter(k => k.startsWith('sp_')).forEach(k => localStorage.removeItem(k));
    notify(t('admin.clearDone'));
    location.reload();
  }

  function listLocalUsers() {
    try {
      return Object.keys(JSON.parse(localStorage.getItem('sp_local_users') || '{}'));
    } catch (err) {
      return [];
    }
  }

  function deleteLocalUser(email) {
    const users = JSON.parse(localStorage.getItem('sp_local_users') || '{}');
    delete users[email.toLowerCase()];
    localStorage.setItem('sp_local_users', JSON.stringify(users));
    renderPanel();
    notify(t('admin.userDeleted'));
  }

  function bindLiveEdit() {
    if (!liveEdit) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.setAttribute('contenteditable', 'true');
      el.classList.add('admin-editable');
      if (!el.dataset.adminBound) {
        el.dataset.adminBound = '1';
        el.addEventListener('blur', () => {
          const key = el.getAttribute('data-i18n');
          if (key) {
            if (!overrides.texts) overrides.texts = {};
            overrides.texts[key] = el.textContent.trim();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
          }
        });
      }
    });
  }

  function renderPanel() {
    const body = document.getElementById('admin-panel-body');
    if (!body) return;

    const users = listLocalUsers();
    const sectionIds = ['services', 'method', 'work', 'before-after', 'audit', 'results', 'pricing', 'instagram', 'about', 'contact'];

    body.innerHTML = `
      <nav class="admin-tabs" role="tablist">
        ${['dashboard', 'content', 'sections', 'features', 'users', 'advanced'].map(tab =>
          `<button type="button" class="admin-tabs__btn${activeTab === tab ? ' is-active' : ''}" data-admin-tab="${tab}">${t('admin.tab.' + tab)}</button>`
        ).join('')}
      </nav>
      <div class="admin-panel__content">
        ${activeTab === 'dashboard' ? `
          <p class="admin-welcome">${t('admin.welcome')}</p>
          <div class="admin-stat-grid">
            <div class="admin-stat"><span>${users.length}</span><small>${t('admin.stat.users')}</small></div>
            <div class="admin-stat"><span>${Object.keys(get('texts', {})).length}</span><small>${t('admin.stat.edits')}</small></div>
            <div class="admin-stat"><span>${sectionIds.filter(id => get('sections.' + id, true) !== false).length}</span><small>${t('admin.stat.sections')}</small></div>
          </div>
          <button type="button" class="admin-btn admin-btn--primary" id="admin-live-edit-btn">${liveEdit ? t('admin.liveEditOff') : t('admin.liveEditOn')}</button>
        ` : ''}
        ${activeTab === 'content' ? `
          <label class="admin-field"><span>${t('admin.hero.title')}</span><input type="text" data-admin-path="texts.hero.title.line1" value="${esc(get('texts.hero.title.line1', ''))}"></label>
          <label class="admin-field"><span>${t('admin.hero.highlight')}</span><input type="text" data-admin-path="texts.hero.title.highlight" value="${esc(get('texts.hero.title.highlight', ''))}"></label>
          <label class="admin-field"><span>${t('admin.hero.subtitle')}</span><textarea data-admin-path="texts.hero.subtitle" rows="2">${esc(get('texts.hero.subtitle', ''))}</textarea></label>
          <label class="admin-field"><span>${t('admin.pricing.starter')}</span><input type="number" data-admin-path="pricing.starter" value="${esc(get('pricing.starter', 12))}"></label>
          <label class="admin-field"><span>${t('admin.pricing.growth')}</span><input type="number" data-admin-path="pricing.growth" value="${esc(get('pricing.growth', 25))}"></label>
          <label class="admin-field"><span>${t('admin.pricing.pro')}</span><input type="number" data-admin-path="pricing.pro" value="${esc(get('pricing.pro', 50))}"></label>
          <label class="admin-field"><span>${t('admin.contact.wa')}</span><input type="text" data-admin-path="contact.whatsapp" value="${esc(get('contact.whatsapp', '970595052784'))}"></label>
          <label class="admin-field"><span>${t('admin.contact.ig')}</span><input type="text" data-admin-path="contact.instagram" value="${esc(get('contact.instagram', 'socialplus.ps'))}"></label>
          <label class="admin-field"><span>${t('admin.announcement')}</span><input type="text" data-admin-path="announcement" value="${esc(get('announcement', ''))}" placeholder="${t('admin.announcementPh')}"></label>
        ` : ''}
        ${activeTab === 'sections' ? sectionIds.map(id =>
          `<label class="admin-check"><input type="checkbox" data-admin-section="${id}" ${get('sections.' + id, true) !== false ? 'checked' : ''}><span>${id}</span></label>`
        ).join('') : ''}
        ${activeTab === 'features' ? `
          <label class="admin-check"><input type="checkbox" data-admin-path="features.socialAi" ${get('features.socialAi', true) !== false ? 'checked' : ''}><span>${t('admin.feat.socialAi')}</span></label>
          <label class="admin-check"><input type="checkbox" data-admin-path="features.whatsapp" ${get('features.whatsapp', true) !== false ? 'checked' : ''}><span>${t('admin.feat.whatsapp')}</span></label>
        ` : ''}
        ${activeTab === 'users' ? (
          users.length ? users.map(u =>
            `<div class="admin-user-row"><span>${esc(u)}</span><button type="button" class="admin-btn admin-btn--danger admin-btn--sm" data-admin-del-user="${esc(u)}">${t('admin.delete')}</button></div>`
          ).join('') : `<p class="admin-hint">${t('admin.noUsers')}</p>`
        ) : ''}
        ${activeTab === 'advanced' ? `
          <label class="admin-field"><span>${t('admin.customCss')}</span><textarea data-admin-path="customCss" rows="4" placeholder="body { }">${esc(get('customCss', ''))}</textarea></label>
          <div class="admin-actions">
            <button type="button" class="admin-btn" id="admin-export">${t('admin.export')}</button>
            <label class="admin-btn admin-btn--file">${t('admin.import')}<input type="file" id="admin-import" accept=".json" hidden></label>
            <button type="button" class="admin-btn admin-btn--danger" id="admin-reset">${t('admin.reset')}</button>
            <button type="button" class="admin-btn admin-btn--danger" id="admin-clear-all">${t('admin.clearAll')}</button>
          </div>
        ` : ''}
      </div>
      ${activeTab !== 'dashboard' || !liveEdit ? `<button type="button" class="admin-btn admin-btn--primary admin-btn--save" id="admin-save">${t('admin.save')}</button>` : ''}
    `;

    body.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.adminTab;
        renderPanel();
      });
    });

    document.getElementById('admin-save')?.addEventListener('click', collectAndSave);
    document.getElementById('admin-live-edit-btn')?.addEventListener('click', () => {
      liveEdit = !liveEdit;
      applyOverrides();
      bindLiveEdit();
      renderPanel();
      notify(liveEdit ? t('admin.liveEditOnMsg') : t('admin.liveEditOffMsg'));
    });
    document.getElementById('admin-export')?.addEventListener('click', exportSettings);
    document.getElementById('admin-import')?.addEventListener('change', e => {
      if (e.target.files[0]) importSettings(e.target.files[0]);
    });
    document.getElementById('admin-reset')?.addEventListener('click', resetSettings);
    document.getElementById('admin-clear-all')?.addEventListener('click', clearAllData);
    body.querySelectorAll('[data-admin-del-user]').forEach(btn => {
      btn.addEventListener('click', () => deleteLocalUser(btn.dataset.adminDelUser));
    });
  }

  function collectAndSave() {
    document.querySelectorAll('[data-admin-path]').forEach(el => {
      const path = el.dataset.adminPath;
      let val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number') val = Number(el.value);
      else val = el.value;
      set(path, val);
    });
    document.querySelectorAll('[data-admin-section]').forEach(el => {
      set(`sections.${el.dataset.adminSection}`, el.checked);
    });
    saveOverrides();
  }

  function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function boot() {
    initOverrides();
    const user = window.SP_AUTH?.getUser?.();
    if (user) setAdmin(user);

    window.addEventListener('sp:authchange', e => setAdmin(e.detail?.user));
    if (window.SP_LOCAL_AUTH) {
      window.SP_LOCAL_AUTH.onChange(u => setAdmin(u));
    }

    toggle?.addEventListener('click', () => {
      if (panel?.hidden) openPanel();
      else closePanel();
    });
    document.getElementById('admin-close')?.addEventListener('click', closePanel);
    backdrop?.addEventListener('click', closePanel);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isAdmin) closePanel();
    });
  }

  window.SP_ADMIN = {
    isAdmin: () => isAdmin,
    setAdmin,
    applyOverrides,
    getOverrides: () => ({ ...overrides })
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
