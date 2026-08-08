/**
 * Social — Premium AI Assistant for Social Plus
 */
(function () {
  'use strict';

  const panel = document.getElementById('social-ai-panel');
  const backdrop = document.getElementById('social-ai-backdrop');
  const toggle = document.getElementById('social-ai-toggle');
  const closeBtn = document.getElementById('social-ai-close');
  const messagesEl = document.getElementById('social-ai-messages');
  const form = document.getElementById('social-ai-form');
  const input = document.getElementById('social-ai-input');
  const chipsEl = document.getElementById('social-ai-chips');
  const config = window.SP_SOCIAL_AI_CONFIG || {};

  const WA_LINK = 'https://wa.me/970595052784?text=' + encodeURIComponent("Hello Social Plus! I'd like to start a project.");

  let isOpen = false;
  let isTyping = false;
  let history = [];
  let greeted = false;
  let lastChipKeys = ['ai.chip1', 'ai.chip2', 'ai.chip3', 'ai.chip4'];

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
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return html.replace(/\n/g, '<br>');
  }

  function scrollMessages() {
    if (!messagesEl) return;
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function addMessage(role, text, actions) {
    if (!messagesEl) return;
    const wrap = document.createElement('div');
    wrap.className = `social-ai__msg social-ai__msg--${role}`;

    let actionsHtml = '';
    if (actions && actions.length) {
      actionsHtml = `<div class="social-ai__actions">${actions.map((a) => {
        if (a.href) {
          return `<a class="social-ai__action" href="${escapeHtml(a.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.label)}</a>`;
        }
        if (a.scroll) {
          return `<button type="button" class="social-ai__action" data-scroll="${escapeHtml(a.scroll)}">${escapeHtml(a.label)}</button>`;
        }
        if (a.prompt) {
          return `<button type="button" class="social-ai__action" data-prompt="${escapeHtml(a.prompt)}">${escapeHtml(a.label)}</button>`;
        }
        return '';
      }).join('')}</div>`;
    }

    wrap.innerHTML = role === 'bot'
      ? `<div class="social-ai__msg-avatar" aria-hidden="true"><img src="assets/social-plus-logo.png" alt="" width="28" height="23"></div><div class="social-ai__msg-body"><div class="social-ai__msg-bubble">${formatReply(text)}</div>${actionsHtml}</div>`
      : `<div class="social-ai__msg-bubble">${formatReply(text)}</div>`;

    wrap.querySelectorAll('[data-scroll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.querySelector(btn.dataset.scroll);
        if (target) {
          closePanel();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    wrap.querySelectorAll('[data-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => sendUserMessage(btn.dataset.prompt || ''));
    });

    messagesEl.appendChild(wrap);
    scrollMessages();
  }

  function showTyping() {
    if (!messagesEl || isTyping) return;
    isTyping = true;
    const el = document.createElement('div');
    el.className = 'social-ai__typing';
    el.id = 'social-ai-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(el);
    scrollMessages();
  }

  function hideTyping() {
    isTyping = false;
    document.getElementById('social-ai-typing')?.remove();
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getTimeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return t('ai.greetMorning');
    if (h < 17) return t('ai.greetAfternoon');
    return t('ai.greetEvening');
  }

  function brainReply(text) {
    const q = text.toLowerCase().trim();

    const rules = [
      {
        test: /^(hi|hello|hey|salam|marhab|مرحب|السلام|اهلا|أهلا|hola)/,
        key: 'ai.greet',
        chips: ['ai.chip1', 'ai.chip2', 'ai.chip3', 'ai.chip4'],
        actions: () => [
          { label: t('ai.actionPricing'), scroll: '#pricing' },
          { label: t('ai.actionWhatsApp'), href: WA_LINK }
        ],
        greet: true
      },
      {
        test: /service|offer|do you|what can|help me|what do|خدم|ماذا|تقدم|خدمات/,
        key: 'ai.services',
        chips: ['ai.chip2', 'ai.chip5', 'ai.chip4'],
        actions: () => [
          { label: t('ai.actionServices'), scroll: '#services' },
          { label: t('ai.actionWhatsApp'), href: WA_LINK }
        ]
      },
      {
        test: /price|pricing|cost|plan|package|how much|\$12|\$25|\$50|starter|growth|pro|سعر|باق|تكلف|أسعار|كم/,
        key: 'ai.pricing',
        chips: ['ai.chip6', 'ai.chip4', 'ai.chip3'],
        actions: () => [
          { label: t('ai.actionPricing'), scroll: '#pricing' },
          { label: t('ai.actionCheckout'), href: 'checkout.html?plan=growth' }
        ]
      },
      {
        test: /audit|instagram|insta|review my|حساب|تدقيق|انست|إنست/,
        key: 'ai.audit',
        chips: ['ai.chip4', 'ai.chip2'],
        actions: () => [
          { label: t('ai.actionAudit'), scroll: '#audit' },
          { label: t('ai.actionWhatsApp'), href: WA_LINK }
        ]
      },
      {
        test: /contact|whatsapp|reach|talk|email|message|call|phone|تواصل|واتس|رسال|اتصل/,
        key: 'ai.contact',
        chips: ['ai.chip1', 'ai.chip2'],
        actions: () => [
          { label: t('ai.actionWhatsApp'), href: WA_LINK },
          { label: t('ai.actionContact'), scroll: '#contact' }
        ]
      },
      {
        test: /portfolio|work|project|example|show me|أعمال|معرض|مشاريع|أمثلة/,
        key: 'ai.portfolio',
        chips: ['ai.chip1', 'ai.chip2', 'ai.chip4'],
        actions: () => [{ label: t('ai.actionWork'), scroll: '#work' }]
      },
      {
        test: /social plus|who are|about|company|team|من انت|من أنت|عنكم|من هم/,
        key: 'ai.about',
        chips: ['ai.chip1', 'ai.chip2', 'ai.chip4'],
        actions: () => [{ label: t('ai.actionAbout'), scroll: '#about' }]
      },
      {
        test: /reel|video|content|post|story|tiktok|محتو|ريل|فيد|تيك/,
        key: 'ai.content',
        chips: ['ai.chip5', 'ai.chip2', 'ai.chip4'],
        actions: () => [
          { label: t('ai.actionWork'), scroll: '#work' },
          { label: t('ai.actionWhatsApp'), href: WA_LINK }
        ]
      },
      {
        test: /brand|branding|logo|identity|design|هوية|براند|شعار|تصميم/,
        key: 'ai.branding',
        chips: ['ai.chip1', 'ai.chip2', 'ai.chip4'],
        actions: () => [{ label: t('ai.actionWork'), scroll: '#work' }]
      },
      {
        test: /start|begin|get started|order|buy|subscribe|sign up|ابد|اطلب|اشتر|ابدا/,
        key: 'ai.start',
        chips: ['ai.chip6', 'ai.chip4'],
        actions: () => [
          { label: t('ai.actionCheckout'), href: 'checkout.html?plan=growth' },
          { label: t('ai.actionWhatsApp'), href: WA_LINK }
        ]
      },
      {
        test: /arabic|english|language|عرب|لغة|english|translate/,
        key: 'ai.language',
        chips: ['ai.chip1', 'ai.chip2'],
        actions: () => []
      },
      {
        test: /thank|شكر|merci/,
        key: 'ai.thanks',
        chips: ['ai.chip1', 'ai.chip4'],
        actions: () => [{ label: t('ai.actionWhatsApp'), href: WA_LINK }]
      }
    ];

    for (const rule of rules) {
      if (rule.test.test(q)) {
        let reply = t(rule.key);
        if (rule.greet) {
          reply = getTimeGreeting() + '\n\n' + reply;
        }
        lastChipKeys = rule.chips || lastChipKeys;
        return { reply, actions: rule.actions ? rule.actions() : [] };
      }
    }

    lastChipKeys = ['ai.chip1', 'ai.chip2', 'ai.chip3', 'ai.chip4'];
    return {
      reply: t('ai.fallback'),
      actions: [
        { label: t('ai.actionPricing'), scroll: '#pricing' },
        { label: t('ai.actionWhatsApp'), href: WA_LINK }
      ]
    };
  }

  async function respond(userText) {
    showTyping();
    const thinkTime = Math.min(700 + userText.length * 10, 1800);
    await delay(thinkTime);
    hideTyping();

    let reply = '';
    let actions = [];

    if (config.apiUrl) {
      try {
        reply = await fetchFromApi(userText);
      } catch {
        ({ reply, actions } = brainReply(userText));
      }
    } else {
      ({ reply, actions } = brainReply(userText));
    }

    history.push({ role: 'assistant', content: reply });
    addMessage('bot', reply, actions);
    renderChips(lastChipKeys);
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

  function renderChips(keys) {
    if (!chipsEl) return;
    const chipKeys = keys || lastChipKeys;
    chipsEl.innerHTML = chipKeys.map((k) =>
      `<button type="button" class="social-ai__chip" data-prompt="${escapeHtml(t(k))}">${escapeHtml(t(k))}</button>`
    ).join('');
    chipsEl.querySelectorAll('.social-ai__chip').forEach((chip) => {
      chip.addEventListener('click', () => sendUserMessage(chip.dataset.prompt || ''));
    });
  }

  async function sendUserMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed || isTyping) return;
    if (input) input.value = '';
    addMessage('user', trimmed);
    history.push({ role: 'user', content: trimmed });
    await respond(trimmed);
  }

  function openPanel() {
    if (!panel || !toggle) return;
    isOpen = true;
    panel.hidden = false;
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.setAttribute('aria-hidden', 'false');
    }
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', t('ai.closeLabel'));
    document.body.classList.add('social-ai-open');

    if (!greeted) {
      greeted = true;
      const welcome = getTimeGreeting() + '\n\n' + t('ai.welcome');
      addMessage('bot', welcome, [
        { label: t('ai.actionPricing'), scroll: '#pricing' },
        { label: t('ai.actionAudit'), scroll: '#audit' },
        { label: t('ai.actionWhatsApp'), href: WA_LINK }
      ]);
      history.push({ role: 'assistant', content: welcome });
    }

    scrollMessages();
    requestAnimationFrame(() => input?.focus());
  }

  function closePanel() {
    if (!panel || !toggle) return;
    isOpen = false;
    panel.hidden = true;
    if (backdrop) {
      backdrop.hidden = true;
      backdrop.setAttribute('aria-hidden', 'true');
    }
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', t('ai.openLabel'));
    document.body.classList.remove('social-ai-open');
    hideTyping();
  }

  function togglePanel(e) {
    e?.preventDefault();
    e?.stopPropagation();
    if (isOpen) closePanel();
    else openPanel();
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await sendUserMessage(input?.value || '');
    });
  }

  toggle?.addEventListener('click', togglePanel);
  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePanel();
  });
  backdrop?.addEventListener('click', closePanel);

  panel?.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  window.addEventListener('sp:langchange', () => {
    renderChips();
    if (input) input.placeholder = t('ai.placeholder');
    toggle?.setAttribute('aria-label', isOpen ? t('ai.closeLabel') : t('ai.openLabel'));
  });

  if (config.enabled !== false) {
    renderChips();
    if (input) input.placeholder = t('ai.placeholder');
    toggle?.setAttribute('aria-label', t('ai.openLabel'));
  } else if (toggle) {
    toggle.hidden = true;
    backdrop?.remove();
  }

  window.SP_SOCIAL_AI = { open: openPanel, close: closePanel, send: sendUserMessage };
})();
