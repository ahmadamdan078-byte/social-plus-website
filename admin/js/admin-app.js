/* Social Plus Admin Control Center */
(function () {
  'use strict';

  const PERMS = {
    view_dashboard: 'Dashboard',
    manage_users: 'Users',
    manage_content: 'Content',
    manage_products: 'Services',
    manage_orders: 'Orders',
    manage_analytics: 'Analytics',
    manage_settings: 'Settings',
    manage_admins: 'Admins',
    manage_design: 'Design',
    manage_database: 'Database',
    view_logs: 'Logs'
  };

  const NAV = [
    { id: 'dashboard', icon: '📊', perm: 'view_dashboard' },
    { id: 'analytics', icon: '📈', perm: 'manage_analytics' },
    { id: 'content', icon: '📝', perm: 'manage_content' },
    { id: 'navigation', icon: '🧭', perm: 'manage_content' },
    { id: 'services', icon: '💼', perm: 'manage_products' },
    { id: 'orders', icon: '🛒', perm: 'manage_orders' },
    { id: 'users', icon: '👥', perm: 'manage_users' },
    { id: 'design', icon: '🎨', perm: 'manage_design' },
    { id: 'settings', icon: '⚙️', perm: 'manage_settings' },
    { id: 'admins', icon: '🔐', perm: 'manage_admins' },
    { id: 'logs', icon: '📋', perm: 'view_logs' },
    { id: 'database', icon: '🗄️', perm: 'manage_database' },
    { id: 'security', icon: '🛡️', perm: null }
  ];

  let state = { admin: null, permissions: [], page: 'dashboard', sessionTimer: null };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $('#toast-container').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  function confirmDialog(title, message) {
    return new Promise((resolve) => {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal">
            <h3>${esc(title)}</h3>
            <p>${esc(message)}</p>
            <div class="modal-actions">
              <button class="btn btn-secondary" data-action="cancel">Cancel</button>
              <button class="btn btn-danger" data-action="confirm">Confirm</button>
            </div>
          </div>
        </div>`;
      root.querySelector('[data-action="cancel"]').onclick = () => { root.innerHTML = ''; resolve(false); };
      root.querySelector('[data-action="confirm"]').onclick = () => { root.innerHTML = ''; resolve(true); };
    });
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function hasPerm(p) {
    if (state.admin?.role === 'super_admin') return true;
    return state.permissions.includes(p);
  }

  function loading() {
    return '<div class="loading"><div class="spinner"></div>Loading…</div>';
  }

  async function init() {
    bindLogin();
    $('#logout-btn').onclick = logout;
    $('#menu-toggle').onclick = () => $('#sidebar').classList.toggle('open');

    if (API.token) {
      try {
        const data = await API.get('/auth/me');
        state.admin = data.admin;
        state.permissions = data.permissions || [];
        showDashboard();
        return;
      } catch {
        API.setToken('');
      }
    }
    showLogin();
  }

  function showLogin() {
    $('#login-screen').hidden = false;
    $('#dashboard').hidden = true;
  }

  function showDashboard() {
    $('#login-screen').hidden = true;
    $('#dashboard').hidden = false;
    $('#admin-badge').textContent = state.admin.role === 'super_admin' ? 'Super Admin' : state.admin.role;
    renderNav();
    navigate(state.page);
    startSessionTimeout();
  }

  function bindLogin() {
    $('#login-form').onsubmit = async (e) => {
      e.preventDefault();
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      const totpCode = $('#login-totp').value.trim();
      const errEl = $('#login-error');
      errEl.hidden = true;
      $('#login-btn').disabled = true;
      try {
        const data = await API.post('/auth/login', { email, password, totpCode: totpCode || undefined });
        if (data.requires2FA) {
          $('#totp-wrap').hidden = false;
          toast('Enter your 2FA code', 'success');
          return;
        }
        API.setToken(data.token);
        state.admin = data.admin;
        const me = await API.get('/auth/me');
        state.permissions = me.permissions || [];
        showDashboard();
        toast('Welcome back!');
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      } finally {
        $('#login-btn').disabled = false;
      }
    };
  }

  async function logout() {
    try { await API.post('/auth/logout', {}); } catch {}
    API.setToken('');
    clearTimeout(state.sessionTimer);
    state = { admin: null, permissions: [], page: 'dashboard', sessionTimer: null };
    showLogin();
  }

  function startSessionTimeout() {
    clearTimeout(state.sessionTimer);
    state.sessionTimer = setTimeout(() => {
      toast('Session expired', 'error');
      logout();
    }, 8 * 60 * 60 * 1000);
  }

  function renderNav() {
    const nav = $('#sidebar-nav');
    nav.innerHTML = NAV.filter((n) => !n.perm || hasPerm(n.perm) || n.id === 'security')
      .map((n) => `<button class="nav-item" data-page="${n.id}">${n.icon} ${PERMS[n.perm] || n.id.charAt(0).toUpperCase() + n.id.slice(1)}</button>`)
      .join('');
    $$('.nav-item', nav).forEach((btn) => {
      btn.onclick = () => {
        navigate(btn.dataset.page);
        $('#sidebar').classList.remove('open');
      };
    });
  }

  function navigate(page) {
    state.page = page;
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
    $('#page-title').textContent = PERMS[NAV.find(n => n.id === page)?.perm] || page.charAt(0).toUpperCase() + page.slice(1);
    const main = $('#main-content');
    main.innerHTML = loading();

    const views = {
      dashboard: viewDashboard,
      analytics: viewAnalytics,
      content: viewContent,
      navigation: viewNavigation,
      services: viewServices,
      orders: viewOrders,
      users: viewUsers,
      design: viewDesign,
      settings: viewSettings,
      admins: viewAdmins,
      logs: viewLogs,
      database: viewDatabase,
      security: viewSecurity
    };
    (views[page] || viewDashboard)().catch((err) => {
      main.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${esc(err.message)}</p></div>`;
    });
  }

  async function viewDashboard() {
    const main = $('#main-content');
    let stats = {};
    try {
      if (hasPerm('manage_analytics')) stats = await API.get('/analytics/dashboard?period=30');
    } catch {}

    const cards = [
      { label: 'Total Users', value: stats.totalUsers ?? '—' },
      { label: 'New Users (30d)', value: stats.newUsers ?? '—' },
      { label: 'Page Views (30d)', value: stats.pageViews ?? '—' },
      { label: 'Visitors (30d)', value: stats.visitors ?? '—' },
      { label: 'Orders (30d)', value: stats.orders ?? '—' },
      { label: 'Revenue (30d)', value: stats.revenue != null ? `$${Number(stats.revenue).toFixed(0)}` : '—' }
    ];

    main.innerHTML = `
      <div class="stats-grid">${cards.map(c => `
        <div class="stat-card"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>
      `).join('')}</div>
      <div class="card">
        <div class="card-title">Quick Actions</div>
        <div class="toolbar">
          ${hasPerm('manage_content') ? '<button class="btn btn-secondary" data-go="content">Edit Content</button>' : ''}
          ${hasPerm('manage_design') ? '<button class="btn btn-secondary" data-go="design">Customize Design</button>' : ''}
          ${hasPerm('manage_orders') ? '<button class="btn btn-secondary" data-go="orders">View Orders</button>' : ''}
          <a href="/" target="_blank" class="btn btn-secondary">Preview Website ↗</a>
        </div>
      </div>`;

    $$('[data-go]').forEach((b) => b.onclick = () => navigate(b.dataset.go));
  }

  async function viewAnalytics() {
    const main = $('#main-content');
    const period = main.dataset.period || '30';
    const stats = await API.get(`/analytics/dashboard?period=${period}`);

    const maxViews = Math.max(...(stats.dailyStats?.map(d => d.views) || [1]), 1);

    main.innerHTML = `
      <div class="toolbar">
        <select id="period-select">
          <option value="7" ${period==='7'?'selected':''}>Last 7 days</option>
          <option value="30" ${period==='30'?'selected':''}>Last 30 days</option>
          <option value="90" ${period==='90'?'selected':''}>Last 90 days</option>
        </select>
      </div>
      <div class="stats-grid">
        <div class="stat-card"><div class="label">Page Views</div><div class="value">${stats.pageViews}</div></div>
        <div class="stat-card"><div class="label">Unique Visitors</div><div class="value">${stats.visitors}</div></div>
        <div class="stat-card"><div class="label">Conversion Rate</div><div class="value">${stats.conversionRate}%</div></div>
        <div class="stat-card"><div class="label">Revenue</div><div class="value">$${Number(stats.revenue).toFixed(0)}</div></div>
      </div>
      <div class="section-block">
        <div class="card">
          <div class="card-title">Daily Page Views</div>
          <div class="chart-bars">${(stats.dailyStats || []).map(d => `
            <div class="chart-bar-wrap">
              <div class="chart-bar" style="height:${(d.views/maxViews)*100}%"></div>
              <span class="chart-bar-label">${d.day?.slice(5)||''}</span>
            </div>`).join('') || '<p class="empty-state">No data yet</p>'}
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card"><div class="card-title">Top Pages</div>
          <table><thead><tr><th>Page</th><th>Views</th></tr></thead>
          <tbody>${(stats.topPages||[]).map(p=>`<tr><td>${esc(p.page)}</td><td>${p.views}</td></tr>`).join('')||'<tr><td colspan="2">No data</td></tr>'}</tbody></table>
        </div>
        <div class="card"><div class="card-title">Traffic Sources</div>
          <table><thead><tr><th>Referrer</th><th>Visits</th></tr></thead>
          <tbody>${(stats.trafficSources||[]).map(t=>`<tr><td>${esc(t.referrer||'(direct)')}</td><td>${t.visits}</td></tr>`).join('')||'<tr><td colspan="2">No data</td></tr>'}</tbody></table>
        </div>
      </div>`;

    $('#period-select').onchange = (e) => { main.dataset.period = e.target.value; viewAnalytics(); };
  }

  async function viewContent() {
    const main = $('#main-content');
    const data = await API.get('/content');
    let tab = 'text';

    function render() {
      main.innerHTML = `
        <div class="tabs">
          <button class="tab ${tab==='text'?'active':''}" data-tab="text">Site Text</button>
          <button class="tab ${tab==='sections'?'active':''}" data-tab="sections">Sections</button>
          <button class="tab ${tab==='faqs'?'active':''}" data-tab="faqs">FAQs</button>
          <button class="tab ${tab==='announcements'?'active':''}" data-tab="announcements">Announcements</button>
        </div>
        <div id="content-panel"></div>`;

      $$('.tab', main).forEach(t => t.onclick = () => { tab = t.dataset.tab; render(); });

      const panel = $('#content-panel');
      if (tab === 'text') {
        panel.innerHTML = `
          <div class="toolbar">
            <button class="btn btn-primary btn-sm" id="add-content">+ Add Text Key</button>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Key</th><th>English</th><th>Arabic</th><th></th></tr></thead>
            <tbody>${data.content.map(c => `<tr>
              <td><code>${esc(c.key)}</code></td>
              <td>${esc(c.value_en?.slice(0,60))}</td>
              <td dir="rtl">${esc(c.value_ar?.slice(0,60))}</td>
              <td><button class="btn btn-sm btn-secondary" data-edit="${esc(c.key)}">Edit</button></td>
            </tr>`).join('') || '<tr><td colspan="4">No content keys yet</td></tr>'}
          </tbody></table></div>`;
        $('#add-content').onclick = () => editContentItem({});
        $$('[data-edit]').forEach(b => b.onclick = () => {
          const item = data.content.find(c => c.key === b.dataset.edit);
          editContentItem(item);
        });
      } else if (tab === 'sections') {
        panel.innerHTML = `
          <div class="table-wrap"><table>
            <thead><tr><th>Section</th><th>Enabled</th><th>Order</th></tr></thead>
            <tbody>${data.sections.map(s => `<tr>
              <td>${esc(s.label)} <small>(${esc(s.id)})</small></td>
              <td><input type="checkbox" data-sid="${s.id}" data-field="enabled" ${s.enabled?'checked':''}></td>
              <td><input type="number" data-sid="${s.id}" data-field="sort_order" value="${s.sort_order}" style="width:60px"></td>
            </tr>`).join('')}</tbody></table></div>
          <div class="toolbar"><button class="btn btn-primary" id="save-sections">Save Sections</button></div>`;
        $('#save-sections').onclick = async () => {
          const sections = data.sections.map(s => ({
            id: s.id, label: s.label,
            enabled: $(`[data-sid="${s.id}"][data-field="enabled"]`).checked,
            sort_order: parseInt($(`[data-sid="${s.id}"][data-field="sort_order"]`).value, 10)
          }));
          await API.put('/content/sections', { sections });
          toast('Sections saved');
          Object.assign(data, await API.get('/content'));
          render();
        };
      } else if (tab === 'faqs') {
        panel.innerHTML = `
          <div class="toolbar"><button class="btn btn-primary btn-sm" id="add-faq">+ Add FAQ</button></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Question</th><th>Visible</th><th></th></tr></thead>
            <tbody>${data.faqs.map(f => `<tr>
              <td>${esc(f.question_en)}</td>
              <td>${f.visible ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-muted">No</span>'}</td>
              <td><button class="btn btn-sm btn-danger" data-del-faq="${f.id}">Delete</button></td>
            </tr>`).join('') || '<tr><td colspan="3">No FAQs</td></tr>'}
          </tbody></table></div>`;
        $('#add-faq').onclick = () => editFaq({});
        $$('[data-del-faq]').forEach(b => b.onclick = async () => {
          if (!await confirmDialog('Delete FAQ', 'This will soft-delete the FAQ. Continue?')) return;
          await API.delete(`/content/faqs/${b.dataset.delFaq}`);
          toast('FAQ deleted');
          Object.assign(data, await API.get('/content'));
          render();
        });
      } else if (tab === 'announcements') {
        const active = data.announcements.find(a => a.active);
        panel.innerHTML = `
          <div class="form-grid">
            <div class="form-field"><label>Message (EN)<textarea id="ann-en">${esc(active?.message_en||'')}</textarea></label></div>
            <div class="form-field"><label>Message (AR)<textarea id="ann-ar" dir="rtl">${esc(active?.message_ar||'')}</textarea></label></div>
          </div>
          <div class="toolbar">
            <label><input type="checkbox" id="ann-active" ${active?'checked':''}> Active</label>
            <button class="btn btn-primary" id="save-ann">Save Announcement</button>
          </div>`;
        $('#save-ann').onclick = async () => {
          await API.post('/content/announcements', {
            message_en: $('#ann-en').value,
            message_ar: $('#ann-ar').value,
            active: $('#ann-active').checked
          });
          toast('Announcement saved');
          Object.assign(data, await API.get('/content'));
          render();
        };
      }
    }

    function editContentItem(item) {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop"><div class="modal" style="max-width:560px">
          <h3>${item.key ? 'Edit' : 'Add'} Content</h3>
          <div class="form-field"><label>Key<input id="m-key" value="${esc(item.key||'')}" ${item.key?'readonly':''}></label></div>
          <div class="form-field"><label>English<textarea id="m-en">${esc(item.value_en||'')}</textarea></label></div>
          <div class="form-field"><label>Arabic<textarea id="m-ar" dir="rtl">${esc(item.value_ar||'')}</textarea></label></div>
          <div class="form-field"><label>Section<input id="m-section" value="${esc(item.section||'')}"></label></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-cancel>Cancel</button>
            <button class="btn btn-primary" data-save>Save</button>
          </div>
        </div></div>`;
      root.querySelector('[data-cancel]').onclick = () => root.innerHTML = '';
      root.querySelector('[data-save]').onclick = async () => {
        await API.put('/content/item', {
          key: $('#m-key').value.trim(),
          value_en: $('#m-en').value,
          value_ar: $('#m-ar').value,
          section: $('#m-section').value
        });
        root.innerHTML = '';
        toast('Content saved');
        Object.assign(data, await API.get('/content'));
        render();
      };
    }

    function editFaq(item) {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop"><div class="modal">
          <h3>Add FAQ</h3>
          <div class="form-field"><label>Question (EN)<input id="fq-en"></label></div>
          <div class="form-field"><label>Answer (EN)<textarea id="fa-en"></textarea></label></div>
          <div class="form-field"><label>Question (AR)<input id="fq-ar" dir="rtl"></label></div>
          <div class="form-field"><label>Answer (AR)<textarea id="fa-ar" dir="rtl"></textarea></label></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-cancel>Cancel</button>
            <button class="btn btn-primary" data-save>Save</button>
          </div>
        </div></div>`;
      root.querySelector('[data-cancel]').onclick = () => root.innerHTML = '';
      root.querySelector('[data-save]').onclick = async () => {
        await API.post('/content/faqs', {
          question_en: $('#fq-en').value, answer_en: $('#fa-en').value,
          question_ar: $('#fq-ar').value, answer_ar: $('#fa-ar').value, visible: 1
        });
        root.innerHTML = '';
        toast('FAQ added');
        Object.assign(data, await API.get('/content'));
        render();
      };
    }

    render();
  }

  async function viewNavigation() {
    const main = $('#main-content');
    const { items } = await API.get('/navigation');

    main.innerHTML = `
      <div class="toolbar">
        <button class="btn btn-primary btn-sm" id="add-nav">+ Add Menu Item</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Label (EN)</th><th>Link</th><th>Visible</th><th>Order</th><th></th></tr></thead>
        <tbody>${items.map(n => `<tr>
          <td>${esc(n.label_en)}</td>
          <td><code>${esc(n.href)}</code></td>
          <td>${n.visible ? '✓' : '—'}</td>
          <td>${n.sort_order}</td>
          <td>
            <button class="btn btn-sm btn-secondary" data-edit="${n.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del="${n.id}">Delete</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="5">No menu items</td></tr>'}
      </tbody></table></div>`;

    $('#add-nav').onclick = () => editNav({});
    $$('[data-edit]').forEach(b => {
      const item = items.find(i => i.id == b.dataset.edit);
      b.onclick = () => editNav(item);
    });
    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!await confirmDialog('Delete Menu Item', 'Remove this navigation item?')) return;
      await API.delete(`/navigation/${b.dataset.del}`);
      toast('Deleted');
      viewNavigation();
    });

    function editNav(item) {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop"><div class="modal">
          <h3>${item.id ? 'Edit' : 'Add'} Menu Item</h3>
          <div class="form-field"><label>Label (EN)<input id="nv-en" value="${esc(item.label_en||'')}"></label></div>
          <div class="form-field"><label>Label (AR)<input id="nv-ar" value="${esc(item.label_ar||'')}" dir="rtl"></label></div>
          <div class="form-field"><label>Link<input id="nv-href" value="${esc(item.href||'#')}"></label></div>
          <div class="form-field"><label><input type="checkbox" id="nv-vis" ${item.visible!==0?'checked':''}> Visible</label></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-cancel>Cancel</button>
            <button class="btn btn-primary" data-save>Save</button>
          </div>
        </div></div>`;
      root.querySelector('[data-cancel]').onclick = () => root.innerHTML = '';
      root.querySelector('[data-save]').onclick = async () => {
        const body = {
          label_en: $('#nv-en').value, label_ar: $('#nv-ar').value,
          href: $('#nv-href').value, visible: $('#nv-vis').checked ? 1 : 0
        };
        if (item.id) await API.patch(`/navigation/${item.id}`, body);
        else await API.post('/navigation', body);
        root.innerHTML = '';
        toast('Saved');
        viewNavigation();
      };
    }
  }

  async function viewServices() {
    const main = $('#main-content');
    const { services } = await API.get('/services');

    main.innerHTML = `
      <div class="toolbar"><button class="btn btn-primary btn-sm" id="add-svc">+ Add Service</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Price</th><th>Category</th><th>Featured</th><th>Visible</th><th></th></tr></thead>
        <tbody>${services.map(s => `<tr>
          <td>${esc(s.title_en)}</td>
          <td>$${s.price}</td>
          <td>${esc(s.category)}</td>
          <td>${s.featured?'⭐':'—'}</td>
          <td>${s.visible?'✓':'—'}</td>
          <td>
            <button class="btn btn-sm btn-secondary" data-edit="${s.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-del="${s.id}">Delete</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="6">No services</td></tr>'}
      </tbody></table></div>`;

    $('#add-svc').onclick = () => editSvc({});
    $$('[data-edit]').forEach(b => {
      const s = services.find(x => x.id == b.dataset.edit);
      b.onclick = () => editSvc(s);
    });
    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!await confirmDialog('Delete Service', 'Soft-delete this service?')) return;
      await API.delete(`/services/${b.dataset.del}`);
      toast('Deleted');
      viewServices();
    });

    function editSvc(s) {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop"><div class="modal" style="max-width:520px">
          <h3>${s.id?'Edit':'Add'} Service</h3>
          <div class="form-grid">
            <div class="form-field"><label>Title (EN)<input id="sv-te" value="${esc(s.title_en||'')}"></label></div>
            <div class="form-field"><label>Title (AR)<input id="sv-ta" value="${esc(s.title_ar||'')}" dir="rtl"></label></div>
            <div class="form-field"><label>Price ($)<input type="number" id="sv-price" value="${s.price??0}"></label></div>
            <div class="form-field"><label>Category<input id="sv-cat" value="${esc(s.category||'general')}"></label></div>
          </div>
          <div class="form-field"><label>Description (EN)<textarea id="sv-de">${esc(s.description_en||'')}</textarea></label></div>
          <div class="form-field"><label><input type="checkbox" id="sv-feat" ${s.featured?'checked':''}> Featured</label></div>
          <div class="form-field"><label><input type="checkbox" id="sv-vis" ${s.visible!==0?'checked':''}> Visible</label></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-cancel>Cancel</button>
            <button class="btn btn-primary" data-save>Save</button>
          </div>
        </div></div>`;
      root.querySelector('[data-cancel]').onclick = () => root.innerHTML = '';
      root.querySelector('[data-save]').onclick = async () => {
        const body = {
          title_en: $('#sv-te').value, title_ar: $('#sv-ta').value,
          description_en: $('#sv-de').value, price: parseFloat($('#sv-price').value),
          category: $('#sv-cat').value, featured: $('#sv-feat').checked, visible: $('#sv-vis').checked
        };
        if (s.id) await API.patch(`/services/${s.id}`, body);
        else await API.post('/services', body);
        root.innerHTML = '';
        toast('Saved');
        viewServices();
      };
    }
  }

  async function viewOrders() {
    const main = $('#main-content');
    const q = main.dataset.q || '';
    const { orders } = await API.get(`/orders?q=${encodeURIComponent(q)}`);

    main.innerHTML = `
      <div class="toolbar">
        <input type="search" id="order-search" placeholder="Search orders…" value="${esc(q)}">
        <button class="btn btn-secondary btn-sm" id="export-orders">Export JSON</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Customer</th><th>Service</th><th>Status</th><th>Amount</th><th>Date</th><th></th></tr></thead>
        <tbody>${orders.map(o => `<tr>
          <td>#${o.id}</td>
          <td>${esc(o.customer_name||o.customer_email||'—')}</td>
          <td>${esc(o.service_name||'—')}</td>
          <td><span class="badge badge-${o.status==='completed'?'success':o.status==='pending'?'warning':'muted'}">${esc(o.status)}</span></td>
          <td>${o.amount != null ? '$'+o.amount : '—'}</td>
          <td>${esc(o.created_at?.slice(0,10))}</td>
          <td><select data-status="${o.id}" class="status-select">
            ${['pending','processing','completed','cancelled'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}
          </select></td>
        </tr>`).join('') || '<tr><td colspan="7">No orders yet</td></tr>'}
      </tbody></table></div>`;

    $('#order-search').onchange = (e) => { main.dataset.q = e.target.value; viewOrders(); };
    $('#export-orders')?.addEventListener('click', () => API.download('/orders/export', 'orders-export.json').catch(e => toast(e.message, 'error')));
    $$('.status-select').forEach(sel => sel.onchange = async () => {
      await API.patch(`/orders/${sel.dataset.status}`, { status: sel.value });
      toast('Order updated');
    });
  }

  async function viewUsers() {
    const main = $('#main-content');
    const q = main.dataset.q || '';
    const data = await API.get(`/users?q=${encodeURIComponent(q)}`);

    main.innerHTML = `
      <div class="toolbar">
        <input type="search" id="user-search" placeholder="Search users…" value="${esc(q)}">
        <button class="btn btn-primary btn-sm" id="add-user">+ Add User</button>
        <button class="btn btn-secondary btn-sm" id="export-users">Export</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Joined</th><th>Last Login</th><th></th></tr></thead>
        <tbody>${data.users.map(u => `<tr>
          <td>${esc(u.email)}</td>
          <td>${esc(u.name)}</td>
          <td>${esc(u.role)}</td>
          <td><span class="badge badge-${u.status==='active'?'success':'danger'}">${esc(u.status)}</span></td>
          <td>${esc(u.created_at?.slice(0,10))}</td>
          <td>${esc(u.last_login_at?.slice(0,10)||'—')}</td>
          <td>
            ${u.status==='active'
              ? `<button class="btn btn-sm btn-danger" data-ban="${u.id}">Suspend</button>`
              : `<button class="btn btn-sm btn-secondary" data-restore="${u.id}">Restore</button>`}
          </td>
        </tr>`).join('') || '<tr><td colspan="7">No users</td></tr>'}
      </tbody></table></div>`;

    $('#user-search').onchange = (e) => { main.dataset.q = e.target.value; viewUsers(); };
    $('#export-users')?.addEventListener('click', () => API.download('/users/export', 'users-export.json').catch(e => toast(e.message, 'error')));
    $('#add-user').onclick = () => {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop"><div class="modal">
          <h3>Add User</h3>
          <div class="form-field"><label>Email<input type="email" id="u-email"></label></div>
          <div class="form-field"><label>Name<input id="u-name"></label></div>
          <div class="form-field"><label>Password<input type="password" id="u-pass"></label></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-cancel>Cancel</button>
            <button class="btn btn-primary" data-save>Create</button>
          </div>
        </div></div>`;
      root.querySelector('[data-cancel]').onclick = () => root.innerHTML = '';
      root.querySelector('[data-save]').onclick = async () => {
        await API.post('/users', { email: $('#u-email').value, name: $('#u-name').value, password: $('#u-pass').value });
        root.innerHTML = '';
        toast('User created');
        viewUsers();
      };
    };
    $$('[data-ban]').forEach(b => b.onclick = async () => {
      if (!await confirmDialog('Suspend User', 'Suspend this user account?')) return;
      await API.patch(`/users/${b.dataset.ban}`, { status: 'suspended' });
      toast('User suspended');
      viewUsers();
    });
    $$('[data-restore]').forEach(b => b.onclick = async () => {
      await API.post(`/users/${b.dataset.restore}/restore`, {});
      toast('User restored');
      viewUsers();
    });
  }

  async function viewDesign() {
    const main = $('#main-content');
    const { design } = await API.get('/design');
    const defaults = {
      primary_color: '#c9a227', bg_color: '#0a0a0f', text_color: '#f5f5f7',
      accent_color: '#e8c547', font_family: 'Inter, system-ui, sans-serif',
      border_radius: '12px', dark_mode: 'true', animation_enabled: 'true',
      button_style: 'gold-gradient', nav_style: 'transparent', custom_css: ''
    };
    const d = { ...defaults, ...design };

    main.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div class="card">
          <div class="card-title">Design Tokens</div>
          <div class="form-grid">
            ${['primary_color','bg_color','text_color','accent_color'].map(k => `
              <div class="form-field"><label>${k.replace(/_/g,' ')}
                <div class="color-input">
                  <input type="color" id="d-${k}" value="${d[k]}">
                  <input type="text" id="d-${k}-text" value="${esc(d[k])}">
                </div></label></div>`).join('')}
            <div class="form-field"><label>Font Family<input id="d-font_family" value="${esc(d.font_family)}"></label></div>
            <div class="form-field"><label>Border Radius<input id="d-border_radius" value="${esc(d.border_radius)}"></label></div>
            <div class="form-field"><label><input type="checkbox" id="d-dark_mode" ${d.dark_mode==='true'?'checked':''}> Dark Mode</label></div>
            <div class="form-field"><label><input type="checkbox" id="d-animation_enabled" ${d.animation_enabled==='true'?'checked':''}> Animations</label></div>
          </div>
          <div class="form-field"><label>Custom CSS<textarea id="d-custom_css" rows="6">${esc(d.custom_css||'')}</textarea></label></div>
          <div class="toolbar">
            <button class="btn btn-secondary" id="preview-design">Preview</button>
            <button class="btn btn-primary" id="save-design">Save Draft</button>
            <button class="btn btn-primary" id="publish-design">Publish</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Live Preview</div>
          <iframe class="preview-frame" id="design-preview" src="/"></iframe>
        </div>
      </div>`;

    ['primary_color','bg_color','text_color','accent_color'].forEach(k => {
      $(`#d-${k}`).oninput = (e) => { $(`#d-${k}-text`).value = e.target.value; applyPreview(); };
      $(`#d-${k}-text`).oninput = (e) => { $(`#d-${k}`).value = e.target.value; applyPreview(); };
    });

    function collectDesign() {
      return {
        primary_color: $('#d-primary_color-text').value,
        bg_color: $('#d-bg_color-text').value,
        text_color: $('#d-text_color-text').value,
        accent_color: $('#d-accent_color-text').value,
        font_family: $('#d-font_family').value,
        border_radius: $('#d-border_radius').value,
        dark_mode: $('#d-dark_mode').checked ? 'true' : 'false',
        animation_enabled: $('#d-animation_enabled').checked ? 'true' : 'false',
        custom_css: $('#d-custom_css').value
      };
    }

    function applyPreview() {
      const iframe = $('#design-preview');
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const des = collectDesign();
        let style = doc.getElementById('admin-design-preview');
        if (!style) { style = doc.createElement('style'); style.id = 'admin-design-preview'; doc.head.appendChild(style); }
        style.textContent = `
          :root {
            --gold: ${des.primary_color};
            --gold-light: ${des.accent_color};
            --bg: ${des.bg_color};
            --text: ${des.text_color};
            --radius: ${des.border_radius};
          }
          body { font-family: ${des.font_family}; background: ${des.bg_color}; color: ${des.text_color}; }
          ${des.custom_css}`;
      } catch {}
    }

    $('#preview-design').onclick = applyPreview;
    $('#save-design').onclick = async () => {
      await API.put('/design', { design: collectDesign(), publish: false });
      toast('Design draft saved');
    };
    $('#publish-design').onclick = async () => {
      await API.put('/design', { design: collectDesign(), publish: true });
      toast('Design published!');
      $('#design-preview').src = '/?t=' + Date.now();
    };

    $('#design-preview').onload = applyPreview;
  }

  async function viewSettings() {
    const main = $('#main-content');
    const { settings } = await API.get('/settings');
    let tab = 'general';

    const groups = {
      general: ['site_name','site_description','contact_email','contact_whatsapp','contact_instagram'],
      seo: ['seo_title','seo_description','seo_keywords'],
      social: ['social_instagram','social_tiktok','social_whatsapp','social_facebook','social_youtube'],
      security: ['security_session_hours','security_password_min','security_2fa_optional']
    };

    function render() {
      main.innerHTML = `
        <div class="tabs">
          ${Object.keys(groups).map(g => `<button class="tab ${tab===g?'active':''}" data-tab="${g}">${g.charAt(0).toUpperCase()+g.slice(1)}</button>`).join('')}
        </div>
        <div class="card"><div class="form-grid" id="settings-form">
          ${groups[tab].map(k => `
            <div class="form-field"><label>${k.replace(/_/g,' ')}
              <input id="set-${k}" value="${esc(settings[k]||'')}">
            </label></div>`).join('')}
        </div>
        <div class="toolbar"><button class="btn btn-primary" id="save-settings">Save Settings</button></div></div>`;

      $$('.tab', main).forEach(t => t.onclick = () => { tab = t.dataset.tab; render(); });
      $('#save-settings').onclick = async () => {
        const patch = {};
        groups[tab].forEach(k => { patch[k] = $(`#set-${k}`).value; });
        await API.put('/settings', { settings: patch });
        Object.assign(settings, patch);
        toast('Settings saved');
      };
    }
    render();
  }

  async function viewAdmins() {
    if (state.admin.role !== 'super_admin') {
      $('#main-content').innerHTML = '<div class="empty-state"><h3>Super Admin Only</h3></div>';
      return;
    }
    const main = $('#main-content');
    const { admins } = await API.get('/auth/admins');
    const allPerms = Object.keys(PERMS).map(k => k.replace(/([A-Z])/g,'_$1').toLowerCase()).filter(Boolean);
    const permKeys = ['view_dashboard','manage_users','manage_content','manage_products','manage_orders','manage_analytics','manage_settings','manage_admins','manage_design','manage_database','view_logs'];

    main.innerHTML = `
      <div class="toolbar"><button class="btn btn-primary btn-sm" id="add-admin">+ Add Admin</button></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>2FA</th><th>Status</th><th>Last Login</th><th></th></tr></thead>
        <tbody>${admins.map(a => `<tr>
          <td>${esc(a.email)}</td>
          <td>${esc(a.name)}</td>
          <td>${esc(a.role)}</td>
          <td>${a.totp_enabled?'✓':'—'}</td>
          <td><span class="badge badge-${a.status==='active'?'success':'danger'}">${esc(a.status)}</span></td>
          <td>${esc(a.last_login_at?.slice(0,16)||'—')}</td>
          <td>${a.role!=='super_admin'?`<button class="btn btn-sm btn-danger" data-del="${a.id}">Delete</button>`:'—'}</td>
        </tr>`).join('')}</tbody></table></div>`;

    $('#add-admin').onclick = () => {
      const root = $('#modal-root');
      root.innerHTML = `
        <div class="modal-backdrop"><div class="modal" style="max-width:560px">
          <h3>Add Admin</h3>
          <div class="form-field"><label>Email<input type="email" id="a-email"></label></div>
          <div class="form-field"><label>Name<input id="a-name"></label></div>
          <div class="form-field"><label>Password<input type="password" id="a-pass"></label></div>
          <div class="form-field"><label>Role<select id="a-role"><option value="admin">Admin</option><option value="editor">Editor</option></select></label></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-cancel>Cancel</button>
            <button class="btn btn-primary" data-save>Create</button>
          </div>
        </div></div>`;
      root.querySelector('[data-cancel]').onclick = () => root.innerHTML = '';
      root.querySelector('[data-save]').onclick = async () => {
        await API.post('/auth/admins', {
          email: $('#a-email').value, name: $('#a-name').value,
          password: $('#a-pass').value, role: $('#a-role').value
        });
        root.innerHTML = '';
        toast('Admin created');
        viewAdmins();
      };
    };

    $$('[data-del]').forEach(b => b.onclick = async () => {
      if (!await confirmDialog('Delete Admin', 'Remove this admin account? They will lose access immediately.')) return;
      await API.delete(`/auth/admins/${b.dataset.del}`);
      toast('Admin deleted');
      viewAdmins();
    });
  }

  async function viewLogs() {
    const main = $('#main-content');
    const [adminLogs, loginLogs] = await Promise.all([
      API.get('/logs/admin?limit=50'),
      API.get('/logs/login?limit=50')
    ]);

    main.innerHTML = `
      <div class="section-block"><div class="card">
        <div class="card-title">Admin Activity</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Entity</th></tr></thead>
          <tbody>${adminLogs.logs.map(l => `<tr>
            <td>${esc(l.created_at?.slice(0,19))}</td>
            <td>${esc(l.admin_email||'—')}</td>
            <td>${esc(l.action)}</td>
            <td>${esc(l.entity||'')} ${l.entity_id||''}</td>
          </tr>`).join('') || '<tr><td colspan="4">No logs</td></tr>'}
        </tbody></table></div>
      </div></div>
      <div class="section-block"><div class="card">
        <div class="card-title">Login History</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Time</th><th>Email</th><th>Success</th><th>IP</th><th>Reason</th></tr></thead>
          <tbody>${loginLogs.history.map(l => `<tr>
            <td>${esc(l.created_at?.slice(0,19))}</td>
            <td>${esc(l.email)}</td>
            <td>${l.success?'<span class="badge badge-success">Yes</span>':'<span class="badge badge-danger">No</span>'}</td>
            <td>${esc(l.ip||'—')}</td>
            <td>${esc(l.reason||'—')}</td>
          </tr>`).join('') || '<tr><td colspan="5">No history</td></tr>'}
        </tbody></table></div>
      </div></div>`;
  }

  async function viewDatabase() {
    const main = $('#main-content');
    const { tables } = await API.get('/database/tables');
    let table = main.dataset.table || tables[0];
    const data = await API.get(`/database/${table}?limit=30`);

    main.innerHTML = `
      <div class="toolbar">
        <select id="db-table">${tables.map(t => `<option ${t===table?'selected':''}>${t}</option>`).join('')}</select>
        ${state.admin.role==='super_admin'?`
          <button class="btn btn-secondary btn-sm" id="db-backup">Backup</button>
          <label class="btn btn-secondary btn-sm">Restore<input type="file" id="db-restore" accept=".json" hidden></label>
        `:''}
      </div>
      <div class="card"><div class="card-title">${esc(table)} (${data.rows.length} rows)</div>
        <div class="table-wrap" style="max-height:400px;overflow:auto"><table>
          <thead><tr>${data.rows[0]?Object.keys(data.rows[0]).map(k=>`<th>${esc(k)}</th>`).join(''):'<th>—</th>'}</tr></thead>
          <tbody>${data.rows.map(r => `<tr>${Object.values(r).map(v=>`<td>${esc(String(v??'').slice(0,80))}</td>`).join('')}</tr>`).join('')||'<tr><td>No records</td></tr>'}
          </tbody></table></div>
      </div>`;

    $('#db-table').onchange = (e) => { main.dataset.table = e.target.value; viewDatabase(); };
    $('#db-backup')?.addEventListener('click', () => {
      API.download('/database/backup/export', `social-plus-backup-${Date.now()}.json`)
        .then(() => toast('Backup downloading'))
        .catch(e => toast(e.message, 'error'));
    });
    $('#db-restore')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!await confirmDialog('Restore Database', 'This will REPLACE all data in allowed tables. Are you absolutely sure?')) return;
      const text = await file.text();
      const backup = JSON.parse(text);
      await API.post('/database/backup/restore', backup, { headers: { 'X-Confirm-Restore': 'yes' } });
      toast('Database restored');
      viewDatabase();
    });
  }

  async function viewSecurity() {
    const main = $('#main-content');
    main.innerHTML = `
      <div class="card section-block">
        <div class="card-title">Change Password</div>
        <div class="form-grid">
          <div class="form-field"><label>Current Password<input type="password" id="cp-current"></label></div>
          <div class="form-field"><label>New Password<input type="password" id="cp-new"></label></div>
        </div>
        <button class="btn btn-primary btn-sm" id="cp-save">Update Password</button>
      </div>
      <div class="card section-block">
        <div class="card-title">Two-Factor Authentication</div>
        <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:16px">Add an extra layer of security to your account.</p>
        <button class="btn btn-secondary btn-sm" id="setup-2fa">Setup 2FA</button>
        <div id="qr-area" style="margin-top:16px"></div>
        <div class="form-field" id="enable-2fa-wrap" hidden style="margin-top:12px">
          <label>Enter code from app<input id="enable-2fa-code" maxlength="6"></label>
          <button class="btn btn-primary btn-sm" id="enable-2fa" style="margin-top:8px">Enable 2FA</button>
        </div>
        <hr style="border-color:var(--border);margin:20px 0">
        <button class="btn btn-danger btn-sm" id="disable-2fa">Disable 2FA</button>
      </div>`;

    $('#cp-save').onclick = async () => {
      try {
        await API.post('/auth/change-password', {
          currentPassword: $('#cp-current').value,
          newPassword: $('#cp-new').value
        });
        toast('Password updated — please sign in again');
        logout();
      } catch (e) { toast(e.message, 'error'); }
    };

    $('#setup-2fa').onclick = async () => {
      const data = await API.post('/auth/2fa/setup', {});
      $('#qr-area').innerHTML = `<img src="${data.qrCode}" alt="QR" width="180"><p style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">Secret: ${esc(data.secret)}</p>`;
      $('#enable-2fa-wrap').hidden = false;
    };

    $('#enable-2fa').onclick = async () => {
      try {
        await API.post('/auth/2fa/enable', { code: $('#enable-2fa-code').value });
        toast('2FA enabled');
      } catch (e) { toast(e.message, 'error'); }
    };

    $('#disable-2fa').onclick = async () => {
      const password = prompt('Enter your password to disable 2FA:');
      const code = prompt('Enter current 2FA code:');
      if (!password) return;
      try {
        await API.post('/auth/2fa/disable', { password, code });
        toast('2FA disabled');
      } catch (e) { toast(e.message, 'error'); }
    };
  }

  init();
})();
