const API = {
  base: '/api',
  token: localStorage.getItem('sp_admin_token') || '',

  setToken(token) {
    this.token = token || '';
    if (token) localStorage.setItem('sp_admin_token', token);
    else localStorage.removeItem('sp_admin_token');
  },

  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof ArrayBuffer) && !(options.body instanceof Blob)) {
      if (!headers['Content-Type'] && options.body) headers['Content-Type'] = 'application/json';
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      body: options.body && typeof options.body === 'object' && !(options.body instanceof ArrayBuffer)
        ? JSON.stringify(options.body) : options.body
    });

    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }

    if (!res.ok) {
      const err = new Error(data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  get: (path) => API.request(path),
  post: (path, body, opts) => API.request(path, { method: 'POST', body, ...opts }),
  put: (path, body) => API.request(path, { method: 'PUT', body }),
  patch: (path, body) => API.request(path, { method: 'PATCH', body }),
  delete: (path, opts) => API.request(path, { method: 'DELETE', ...opts }),

  async download(path, filename) {
    const headers = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${this.base}${path}`, { headers, credentials: 'include' });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};

window.API = API;
