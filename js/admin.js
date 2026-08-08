/**
 * Social Plus — Admin system v2
 * Full site control · live editing · reliable close
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
  let editorSearch = '';

  const panel = document.getElementById('admin-panel');
  const toggle = document.getElementById('admin-toggle');
  const backdrop = document.getElementById('admin-backdrop');
  const toolbar = document.getElementById('admin-toolbar');

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
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (err) { return {}; }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  }

  function saveOverrides(notifyUser) {
    if (overrides.features) delete overrides.features.maintenance;
    persist();
    applyOverrides();
    if (notifyUser) {
      renderPanel();
      notify(t('admin.saved'));
    }
  }

  function deepMerge(target, source) {
    const out = { ...target };
    Object.keys(source || {}).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        out[key] = deepMerge(out[key] || {}, source[key]);
      } else out[key] = source[key];
    });
    return out;
  }

  async function fetchRemoteOverrides() {
    if (!cfg.overridesUrl) return {};
    try {
      const res = await fetch(`${cfg.overridesUrl}?v=${Date.now()}`, { cache: 'no-store' });
      return res.ok ? await res.json() : {};
    } catch (err) { return {}; }
  }

  async function initOverrides() {
    overrides = deepMerge(await fetchRemoteOverrides(), loadLocalOverrides());
    if (overrides.features) delete overrides.features.maintenance;
    persist();
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
      else { if (!obj[k] || typeof obj[k] !== 'object') obj[k] = {}; obj = obj[k]; }
    });
  }

  function textValue(key) {
    const custom = get(`texts.${key}`);
    if (custom != null && custom !== '') return custom;
    const lang = localStorage.getItem('sp-lang') || 'en';
    return (window.SP_I18N?.[lang]?.[key]) || '';
  }

  function applyOverrides() {
    document.body.classList.remove('is-maintenance');

    const texts = get('texts', {});
    Object.entries(texts).forEach(([key, val]) => {
      if (val == null || val === '') return;
      document.querySelectorAll(`[data-i18n="${key}"]`).forEach(el => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = val;
        else if (el.childElementCount === 0) el.textContent = val;
      });
      if (window.SP_I18N) {
        ['en', 'ar'].forEach(lang => {
          if (window.SP_I18N[lang]) window.SP_I18N[lang][key] = val;
        });
      }
    });

    const sections = get('sections', {});
    Object.entries(sections).forEach(([id, visible]) => {
      const el = document.getElementById(id);
      if (el) el.hidden = visible === false;
    });

    ['starter', 'growth', 'pro'].forEach(tier => {
      const price = get(`pricing.${tier}`);
      const el = document.querySelector(`[data-price-tier="${tier}"]`);
      if (price != null && el) el.textContent = `$${price}`;
    });

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

    const socialAi = document.getElementById('social-ai');
    if (socialAi) socialAi.hidden = get('features.socialAi', true) === false;
    const floatWa = document.getElementById('float-whatsapp');
    if (floatWa) floatWa.hidden = get('features.whatsapp', true) === false;

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
    if (toolbar) toolbar.hidden = !(liveEdit && isAdmin);
    bindLiveEdit();
  }

  function setAdmin(user) {
    const wasAdmin = isAdmin;
    isAdmin = !!(user && (user.role === 'admin' || isAdminEmail(user.email)));
    document.body.classList.toggle('is-admin', isAdmin);
    if (toggle) {
      toggle.hidden = !isAdmin;
      toggle.style.display = isAdmin ? '' : 'none';
    }
    if (isAdmin && user) user.role = 'admin';
    if (isAdmin && !wasAdmin) applyOverrides();
    if (!isAdmin) { closePanel(); disableLiveEdit(); }
  }

  function isPanelOpen() {
    return panel && !panel.hidden && panel.classList.contains('is-open');
  }

  function openPanel() {
    if (!isAdmin || !panel) return;
    panel.hidden = false;
    if (backdrop) backdrop.hidden = false;
    requestAnimationFrame(() => {
      panel.classList.add('is-open');
      backdrop?.classList.add('is-open');
    });
    document.body.classList.add('admin-open');
    renderPanel();
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
    document.body.classList.remove('admin-open');
    setTimeout(() => {
      if (!panel.classList.contains('is-open')) {
        panel.hidden = true;
        if (backdrop) backdrop.hidden = true;
      }
    }, 320);
  }

  function enableLiveEdit() {
    liveEdit = true;
    closePanel();
    applyOverrides();
    notify(t('admin.liveEditOnMsg'));
  }

  function disableLiveEdit() {
    liveEdit = false;
    applyOverrides();
    document.querySelectorAll('[data-i18n].admin-editable').forEach(el => {
      el.removeAttribute('contenteditable');
      el.classList.remove('admin-editable');
    });
  }

  function getAllI18nKeys() {
    const keys = new Set();
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (k) keys.add(k);
    });
    return [...keys].sort();
  }

  function groupKeys(keys) {
    const groups = {};
    keys.forEach(key => {
      const g = key.split('.')[0] || 'other';
      if (!groups[g]) groups[g] = [];
      groups[g].push(key);
    });
    return groups;
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
        if (overrides.features) delete overrides.features.maintenance;
        saveOverrides(true);
      } catch (err) { notify(t('admin.importFail')); }
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
    location.reload();
  }

  function listLocalUsers() {
    try { return Object.keys(JSON.parse(localStorage.getItem('sp_local_users') || '{}')); }
    catch (err) { return []; }
  }

  function deleteLocalUser(email) {
    const users = JSON.parse(localStorage.getItem('sp_local_users') || '{}');
    delete users[email.toLowerCase()];
    localStorage.setItem('sp_local_users', JSON.stringify(users));
    renderPanel();
    notify(t('admin.userDeleted'));
  }

  function bindLiveEdit() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (liveEdit && isAdmin) {
        el.setAttribute('contenteditable', 'true');
        el.classList.add('admin-editable');
        if (!el.dataset.adminBound) {
          el.dataset.adminBound = '1';
          el.addEventListener('blur', () => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            if (!overrides.texts) overrides.texts = {};
            overrides.texts[key] = el.textContent.trim();
            persist();
          });
        }
      } else if (!liveEdit) {
        el.removeAttribute('contenteditable');
        el.classList.remove('admin-editable');
      }
    });
  }

  function collectFromForm() {
    document.querySelectorAll('[data-admin-path]').forEach(el => {
      const path = el.dataset.adminPath;
      let val;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number') val = Number(el.value);
      else val = el.value;
      set(path, val);
    });
    document.querySelectorAll('[data-admin-text]').forEach(el => {
      set(`texts.${el.dataset.adminText}`, el.value);
    });
    document.querySelectorAll('[data-admin-section]').forEach(el => {
      set(`sections.${el.dataset.adminSection}`, el.checked);
    });
  }

  function previewFromForm() {
    collectFromForm();
    applyOverrides();
  }

  function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function renderEditorTab() {
    const q = editorSearch.toLowerCase();
    const keys = getAllI18nKeys().filter(k => !q || k.toLowerCase().includes(q) || textValue(k).toLowerCase().includes(q));
    const groups = groupKeys(keys);
    return `
      <div class="admin-search">
        <input type="search" id="admin-editor-search" placeholder="${esc(t('admin.searchPh'))}" value="${esc(editorSearch)}">
        <span class="admin-search__count">${keys.length} ${t('admin.fields')}</span>
      </div>
      <div class="admin-editor-groups">
        ${Object.entries(groups).map(([group, gkeys]) => `
          <details class="admin-editor-group" open>
            <summary>${esc(group)} <span>(${gkeys.length})</span></summary>
            ${gkeys.map(key => `
              <label class="admin-field admin-field--compact">
                <span class="admin-field__key">${esc(key)}</span>
                <textarea data-admin-text="${esc(key)}" rows="2" placeholder="${esc(textValue(key))}">${esc(get(`texts.${key}`, '') || textValue(key))}</textarea>
              </label>
            `).join('')}
          </details>
        `).join('')}
      </div>`;
  }

  function renderPanel() {
    const body = document.getElementById('admin-panel-body');
    if (!body) return;

    const users = listLocalUsers();
    const sectionIds = [
      { id: 'services', label: 'Services' },
      { id: 'method', label: 'Method' },
      { id: 'work', label: 'Work' },
      { id: 'before-after', label: 'Before/After' },
      { id: 'audit', label: 'Audit' },
      { id: 'results', label: 'Results' },
      { id: 'pricing', label: 'Pricing' },
      { id: 'instagram', label: 'Instagram' },
      { id: 'about', label: 'About' },
      { id: 'contact', label: 'Contact' }
    ];

    const tabs = ['dashboard', 'editor', 'content', 'sections', 'features', 'users', 'advanced'];

    body.innerHTML = `
      <nav class="admin-tabs" role="tablist">
        ${tabs.map(tab =>
          `<button type="button" class="admin-tabs__btn${activeTab === tab ? ' is-active' : ''}" data-admin-tab="${tab}">${t('admin.tab.' + tab)}</button>`
        ).join('')}
      </nav>
      <div class="admin-panel__content">
        ${activeTab === 'dashboard' ? `
          <p class="admin-welcome">${t('admin.welcome')}</p>
          <div class="admin-stat-grid">
            <div class="admin-stat"><span>${users.length}</span><small>${t('admin.stat.users')}</small></div>
            <div class="admin-stat"><span>${Object.keys(get('texts', {})).length}</span><small>${t('admin.stat.edits')}</small></div>
            <div class="admin-stat"><span>${getAllI18nKeys().length}</span><small>${t('admin.stat.fields')}</small></div>
          </div>
          <div class="admin-quick">
            <button type="button" class="admin-btn admin-btn--gold" id="admin-live-edit-btn">${t('admin.liveEditOn')}</button>
            <button type="button" class="admin-btn" id="admin-goto-editor">${t('admin.openEditor')}</button>
          </div>
          <p class="admin-hint">${t('admin.dashboardHint')}</p>
          <div class="admin-jumps">
            ${sectionIds.map(s => `<button type="button" class="admin-jump" data-admin-jump="#${s.id}">${s.label}</button>`).join('')}
          </div>
        ` : ''}
        ${activeTab === 'editor' ? renderEditorTab() : ''}
        ${activeTab === 'content' ? `
          <label class="admin-field"><span>${t('admin.hero.title')}</span><input type="text" data-admin-text="hero.title.line1" value="${esc(get('texts.hero.title.line1', '') || textValue('hero.title.line1'))}"></label>
          <label class="admin-field"><span>${t('admin.hero.highlight')}</span><input type="text" data-admin-text="hero.title.highlight" value="${esc(get('texts.hero.title.highlight', '') || textValue('hero.title.highlight'))}"></label>
          <label class="admin-field"><span>${t('admin.hero.line2')}</span><input type="text" data-admin-text="hero.title.line2" value="${esc(get('texts.hero.title.line2', '') || textValue('hero.title.line2'))}"></label>
          <label class="admin-field"><span>${t('admin.hero.subtitle')}</span><textarea data-admin-text="hero.subtitle" rows="3">${esc(get('texts.hero.subtitle', '') || textValue('hero.subtitle'))}</textarea></label>
          <label class="admin-field"><span>${t('admin.services.title')}</span><input type="text" data-admin-text="services.title" value="${esc(get('texts.services.title', '') || textValue('services.title'))}"></label>
          <label class="admin-field"><span>${t('admin.pricing.starter')}</span><input type="number" data-admin-path="pricing.starter" value="${esc(get('pricing.starter', 12))}"></label>
          <label class="admin-field"><span>${t('admin.pricing.growth')}</span><input type="number" data-admin-path="pricing.growth" value="${esc(get('pricing.growth', 25))}"></label>
          <label class="admin-field"><span>${t('admin.pricing.pro')}</span><input type="number" data-admin-path="pricing.pro" value="${esc(get('pricing.pro', 50))}"></label>
          <label class="admin-field"><span>${t('admin.contact.wa')}</span><input type="text" data-admin-path="contact.whatsapp" value="${esc(get('contact.whatsapp', '970595052784'))}"></label>
          <label class="admin-field"><span>${t('admin.contact.ig')}</span><input type="text" data-admin-path="contact.instagram" value="${esc(get('contact.instagram', 'socialplus.ps'))}"></label>
          <label class="admin-field"><span>${t('admin.announcement')}</span><input type="text" data-admin-path="announcement" value="${esc(get('announcement', ''))}" placeholder="${t('admin.announcementPh')}"></label>
        ` : ''}
        ${activeTab === 'sections' ? sectionIds.map(s =>
          `<label class="admin-check"><input type="checkbox" data-admin-section="${s.id}" ${get('sections.' + s.id, true) !== false ? 'checked' : ''}><span>${s.label}</span></label>`
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
          <label class="admin-field"><span>${t('admin.customCss')}</span><textarea data-admin-path="customCss" rows="5" placeholder="body { }">${esc(get('customCss', ''))}</textarea></label>
          <div class="admin-actions">
            <button type="button" class="admin-btn" id="admin-export">${t('admin.export')}</button>
            <label class="admin-btn admin-btn--file">${t('admin.import')}<input type="file" id="admin-import" accept=".json" hidden></label>
            <button type="button" class="admin-btn admin-btn--danger" id="admin-reset">${t('admin.reset')}</button>
            <button type="button" class="admin-btn admin-btn--danger" id="admin-clear-all">${t('admin.clearAll')}</button>
          </div>
        ` : ''}
      </div>`;

    body.querySelectorAll('[data-admin-tab]').forEach(btn => {
      btn.addEventListener('click', () => { activeTab = btn.dataset.adminTab; renderPanel(); });
    });

    document.getElementById('admin-editor-search')?.addEventListener('input', e => {
      editorSearch = e.target.value;
      renderPanel();
    });

    document.getElementById('admin-live-edit-btn')?.addEventListener('click', enableLiveEdit);
    document.getElementById('admin-goto-editor')?.addEventListener('click', () => { activeTab = 'editor'; renderPanel(); });

    body.querySelectorAll('[data-admin-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        closePanel();
        const target = document.querySelector(btn.dataset.adminJump);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    body.querySelectorAll('[data-admin-text], [data-admin-path]').forEach(el => {
      el.addEventListener('input', previewFromForm);
      el.addEventListener('change', previewFromForm);
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

  function boot() {
    initOverrides();
    const user = window.SP_AUTH?.getUser?.();
    if (user) setAdmin(user);

    window.addEventListener('sp:authchange', e => setAdmin(e.detail?.user));
    window.SP_LOCAL_AUTH?.onChange?.(u => setAdmin(u));

    toggle?.addEventListener('click', async () => {
      try {
        const health = await fetch('/api/public/health');
        if (health.ok) {
          window.location.href = '/admin';
          return;
        }
      } catch {}
      if (isPanelOpen()) closePanel();
      else openPanel();
    });

    document.getElementById('admin-close')?.addEventListener('click', closePanel);
    document.getElementById('admin-close-footer')?.addEventListener('click', closePanel);
    backdrop?.addEventListener('click', closePanel);

    document.getElementById('admin-save')?.addEventListener('click', () => {
      collectFromForm();
      saveOverrides(true);
    });

    document.getElementById('admin-toolbar-done')?.addEventListener('click', () => {
      collectFromForm();
      saveOverrides(false);
      disableLiveEdit();
      notify(t('admin.liveEditOffMsg'));
    });

    document.getElementById('admin-toolbar-save')?.addEventListener('click', () => {
      saveOverrides(true);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (liveEdit) { disableLiveEdit(); notify(t('admin.liveEditOffMsg')); }
        else if (isPanelOpen()) closePanel();
      }
    });
  }

  window.SP_ADMIN = {
    isAdmin: () => isAdmin,
    setAdmin,
    applyOverrides,
    openPanel,
    closePanel,
    getOverrides: () => ({ ...overrides })
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
