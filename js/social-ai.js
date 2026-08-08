/**
 * Social — Premium AI Assistant for Social Plus
 */
(function () {
  'use strict';

  const panel = document.getElementById('social-ai-panel');
  const toggle = document.getElementById('social-ai-toggle');
  const closeBtn = document.getElementById('social-ai-close');
  const messagesEl = document.getElementById('social-ai-messages');
  const form = document.getElementById('social-ai-form');
  const input = document.getElementById('social-ai-input');
  const chipsEl = document.getElementById('social-ai-chips');
  const config = window.SP_SOCIAL_AI_CONFIG || {};

  let isOpen = false;
  let isTyping = false;
  let history = [];
  let greeted = false;

  function lang() {
    return localStorage.getItem('sp-lang') || 'en';
  }

  function t(key) {
    return (window.SP_I18N[lang()] && window.SP_I18N[lang()][key]) || key;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatReply(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function addMessage(role, text) {
    if (!messagesEl) return;
    const wrap = document.createElement('div');
    wrap.className = `social-ai__msg social-ai__msg--${role}`;
    wrap.innerHTML = role === 'bot'
      ? `<div class="social-ai__msg-avatar" aria-hidden="true">S</div><div class="social-ai__msg-bubble">${formatReply(text)}</div>`
      : `<div class="social-ai__msg-bubble">${formatReply(text)}</div>`;
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    if (!messagesEl || isTyping) return;
    isTyping = true;
    const el = document.createElement('div');
    el.className = 'social-ai__typing';
    el.id = 'social-ai-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    isTyping = false;
    document.getElementById('social-ai-typing')?.remove();
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function respond(userText) {
    showTyping();
    const thinkTime = Math.min(900 + userText.length * 12, 2200);
    await delay(thinkTime);
    hideTyping();

    let reply = '';
    if (config.apiUrl) {
      try {
        reply = await fetchFromApi(userText);
      } catch (err) {
        reply = brainReply(userText);
      }
    } else {
      reply = brainReply(userText);
    }

    history.push({ role: 'assistant', content: reply });
    addMessage('bot', reply);
  }

  async function fetchFromApi(userText) {
    const res = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.concat([{ role: 'user', content: userText }]) })
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.reply || data.message || t('ai.error');
  }

  function brainReply(text) {
    const q = text.toLowerCase().trim();
    const ar = lang() === 'ar';

    if (/^(hi|hello|hey|مرحب|السلام|اهلا|أهلا)/.test(q)) {
      return t('ai.greet');
    }
    if (/service|offer|do you|what can|help me|خدم|ماذا|تقدم|خدمات/.test(q)) {
      return t('ai.services');
    }
    if (/price|pricing|cost|plan|package|\$12|\$25|\$50|سعر|باق|تكلف|أسعار/.test(q)) {
      return t('ai.pricing');
    }
    if (/audit|instagram|insta|تدقيق|انست|إنست/.test(q)) {
      return t('ai.audit');
    }
    if (/contact|whatsapp|reach|talk|email|message|تواصل|واتس|رسال/.test(q)) {
      return t('ai.contact');
    }
    if (/portfolio|work|project|أعمال|معرض|مشاريع/.test(q)) {
      return t('ai.portfolio');
    }
    if (/social plus|who are|about|من انت|من أنت|عنكم|social/.test(q)) {
      return t('ai.about');
    }
    if (/reel|video|content|محتو|ريل|فيد/.test(q)) {
      return t('ai.content');
    }
    if (/brand|branding|logo|هوية|براند|شعار/.test(q)) {
      return t('ai.branding');
    }
    if (/thank|شكر/.test(q)) {
      return t('ai.thanks');
    }

    return ar ? t('ai.fallback') : t('ai.fallback');
  }

  function renderChips() {
    if (!chipsEl) return;
    const keys = ['ai.chip1', 'ai.chip2', 'ai.chip3', 'ai.chip4'];
    chipsEl.innerHTML = keys.map(k =>
      `<button type="button" class="social-ai__chip" data-prompt="${escapeHtml(t(k))}">${escapeHtml(t(k))}</button>`
    ).join('');
    chipsEl.querySelectorAll('.social-ai__chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (input) input.value = chip.dataset.prompt || '';
        form?.requestSubmit();
      });
    });
  }

  function openPanel() {
    if (!panel || !toggle) return;
    isOpen = true;
    panel.hidden = false;
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('social-ai-open');

    if (!greeted) {
      greeted = true;
      addMessage('bot', t('ai.welcome'));
      history.push({ role: 'assistant', content: t('ai.welcome') });
    }

    input?.focus();
  }

  function closePanel() {
    if (!panel || !toggle) return;
    isOpen = false;
    panel.hidden = true;
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('social-ai-open');
  }

  function togglePanel() {
    if (isOpen) closePanel();
    else openPanel();
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input?.value.trim();
      if (!text || isTyping) return;

      input.value = '';
      addMessage('user', text);
      history.push({ role: 'user', content: text });
      await respond(text);
    });
  }

  toggle?.addEventListener('click', togglePanel);
  closeBtn?.addEventListener('click', closePanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  window.addEventListener('sp:langchange', () => {
    renderChips();
    if (input) input.placeholder = t('ai.placeholder');
  });

  if (config.enabled !== false) {
    renderChips();
    if (input) input.placeholder = t('ai.placeholder');
  } else if (toggle) {
    toggle.hidden = true;
  }

  window.SP_SOCIAL_AI = { open: openPanel, close: closePanel };
})();
