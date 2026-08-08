/**
 * Social — Signature AI Co-Pilot for Social Plus
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
  const statusEl = document.getElementById('social-ai-status-text');
  const teaser = document.getElementById('social-ai-teaser');
  const teaserClose = document.getElementById('social-ai-teaser-close');
  const hintEl = document.getElementById('social-ai-hint');
  const config = window.SP_SOCIAL_AI_CONFIG || {};

  const WA_LINK = 'https://wa.me/970595052784?text=' + encodeURIComponent("Hello Social Plus! I'd like to start a project.");

  const PLANS = [
    { id: 'starter', price: 12, key: 'ai.planStarter' },
    { id: 'growth', price: 25, key: 'ai.planGrowth', featured: true },
    { id: 'pro', price: 50, key: 'ai.planPro' }
  ];

  let isOpen = false;
  let isTyping = false;
  let history = [];
  let greeted = false;
  let userName = '';
  let lastChipKeys = ['ai.chip1', 'ai.chip2', 'ai.chip3', 'ai.chip4'];
  let hintIndex = 0;
  let hintTimer = null;

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

  function setStatus(key) {
    if (statusEl) statusEl.textContent = t(key);
  }

  function scrollMessages() {
    if (!messagesEl) return;
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  function bindInteractive(root) {
    root.querySelectorAll('[data-scroll]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.querySelector(btn.dataset.scroll);
        if (target) {
          closePanel();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
    root.querySelectorAll('[data-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => sendUserMessage(btn.dataset.prompt || ''));
    });
    root.querySelectorAll('[data-plan]').forEach((btn) => {
      btn.addEventListener('click', () => {
        location.href = `checkout.html?plan=${btn.dataset.plan}`;
      });
    });
  }

  function renderActions(actions) {
    if (!actions?.length) return '';
    return `<div class="social-ai__actions">${actions.map((a) => {
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

  function renderPlanCards(recommended) {
    return `<div class="social-ai__plans">${PLANS.map((p) => `
      <button type="button" class="social-ai__plan${p.id === recommended ? ' is-pick' : ''}${p.featured ? ' is-featured' : ''}" data-plan="${p.id}">
        <span class="social-ai__plan-name">${escapeHtml(t(p.key))}</span>
        <span class="social-ai__plan-price">$${p.price}<small>/mo</small></span>
        ${p.id === recommended ? `<span class="social-ai__plan-tag">${escapeHtml(t('ai.recommended'))}</span>` : ''}
      </button>
    `).join('')}</div>`;
  }

  function addMessage(role, text, opts = {}) {
    if (!messagesEl) return null;
    const wrap = document.createElement('div');
    wrap.className = `social-ai__msg social-ai__msg--${role}`;

    const extras = (opts.plans ? renderPlanCards(opts.recommendedPlan) : '') + renderActions(opts.actions);

    wrap.innerHTML = role === 'bot'
      ? `<div class="social-ai__msg-avatar" aria-hidden="true"><img src="assets/social-plus-logo.png" alt="" width="28" height="23"></div><div class="social-ai__msg-body"><div class="social-ai__msg-bubble">${formatReply(text)}</div>${extras}</div>`
      : `<div class="social-ai__msg-bubble">${formatReply(text)}</div>`;

    bindInteractive(wrap);
    messagesEl.appendChild(wrap);
    scrollMessages();
    return wrap;
  }

  async function typeBotMessage(text, opts = {}) {
    const wrap = addMessage('bot', '', {});
    if (!wrap) return;
    const body = wrap.querySelector('.social-ai__msg-body');
    const bubble = wrap.querySelector('.social-ai__msg-bubble');
    if (!bubble || !body) return;

    const plain = text;
    let i = 0;
    const speed = Math.max(12, Math.min(28, 1200 / plain.length));

    while (i <= plain.length) {
      bubble.innerHTML = formatReply(plain.slice(0, i));
      scrollMessages();
      i += plain[i] === '\n' ? 1 : (Math.random() > 0.7 ? 2 : 1);
      await delay(speed);
    }

    if (opts.plans || opts.actions?.length) {
      const extras = document.createElement('div');
      extras.innerHTML = (opts.plans ? renderPlanCards(opts.recommendedPlan) : '') + renderActions(opts.actions);
      body.appendChild(extras);
      bindInteractive(extras);
      scrollMessages();
    }
  }

  function showTyping() {
    if (!messagesEl || isTyping) return;
    isTyping = true;
    setStatus('ai.statusThinking');
    const el = document.createElement('div');
    el.className = 'social-ai__typing';
    el.id = 'social-ai-typing';
    el.innerHTML = `<div class="social-ai__typing-avatar"><img src="assets/social-plus-logo.png" alt="" width="20" height="16"></div><div class="social-ai__typing-body"><span class="social-ai__typing-label">${escapeHtml(t('ai.typing'))}</span><span class="social-ai__typing-dots"><span></span><span></span><span></span></span></div>`;
    messagesEl.appendChild(el);
    scrollMessages();
  }

  function hideTyping() {
    isTyping = false;
    setStatus('ai.status');
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

  function extractName(text) {
    const en = text.match(/\b(i'?m|i am|my name is|this is)\s+([a-z\u0600-\u06FF]{2,24})/i);
    if (en) return en[2];
    const ar = text.match(/(?:اسمي|أنا|انا)\s+([a-zA-Z\u0600-\u06FF]{2,24})/i);
    if (ar) return ar[1];
    return '';
  }

  function recommendPlan(q) {
    if (/enterprise|big|large|agency|multiple|team|pro|50|كبير|فريق|وكالة|احتراف/.test(q)) return 'pro';
    if (/small|start|new|begin|solo|personal|12|starter|صغير|جديد|بداية|فرد/.test(q)) return 'starter';
    return 'growth';
  }

  function personalize(text) {
    if (!userName) return text;
    return text.replace(/\{name\}/g, userName);
  }

  function brainReply(text) {
    const q = text.toLowerCase().trim();
    const name = extractName(text);
    if (name) userName = name.charAt(0).toUpperCase() + name.slice(1);

    const hiName = userName ? `, ${userName}` : '';

    const rules = [
      {
        test: /^(hi|hello|hey|salam|marhab|yo|sup|مرحب|السلام|اهلا|أهلا|hola)/,
        key: 'ai.greet',
        chips: ['ai.chip1', 'ai.chip2', 'ai.chip7', 'ai.chip4'],
        actions: () => [
          { label: t('ai.actionPricing'), scroll: '#pricing' },
          { label: t('ai.actionWhatsApp'), href: WA_LINK }
        ],
        prefix: () => `${getTimeGreeting()}${hiName}!`
      },
      {
        test: /who made|who built|who created|are you real|are you bot|are you ai|robot|human|من صنع|هل انت|ذكاء|بشر|روبوت/,
        key: 'ai.personality',
        chips: ['ai.chip1', 'ai.chip2', 'ai.chip4']
      },
      {
        test: /joke|funny|laugh|نكت|ضحك|مضحك/,
        key: 'ai.joke',
        chips: ['ai.chip2', 'ai.chip4']
      },
      {
        test: /service|offer|do you|what can|help me|what do|خدم|ماذا|تقدم|خدمات/,
        key: 'ai.services',
        chips: ['ai.chip2', 'ai.chip5', 'ai.chip7'],
        actions: () => [
          { label: t('ai.actionServices'), scroll: '#services' },
          { label: t('ai.actionWhatsApp'), href: WA_LINK }
        ]
      },
      {
        test: /price|pricing|cost|plan|package|how much|\$12|\$25|\$50|starter|growth|pro|سعر|باق|تكلف|أسعار|كم/,
        key: 'ai.pricing',
        chips: ['ai.chip6', 'ai.chip4', 'ai.chip3'],
        plans: true,
        recommendedPlan: recommendPlan(q),
        actions: () => [
          { label: t('ai.actionPricing'), scroll: '#pricing' }
        ]
      },
      {
        test: /recommend|which plan|best plan|what plan|suggest|انصح|أنصح|أفضل باق|ماذا اختار/,
        key: 'ai.recommend',
        chips: ['ai.chip6', 'ai.chip4'],
        plans: true,
        recommendedPlan: recommendPlan(q),
        prefix: () => personalize(t('ai.recommendPrefix'))
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
        plans: true,
        recommendedPlan: 'growth',
        actions: () => [{ label: t('ai.actionWhatsApp'), href: WA_LINK }]
      },
      {
        test: /arabic|english|language|عرب|لغة|translate/,
        key: 'ai.language',
        chips: ['ai.chip1', 'ai.chip2']
      },
      {
        test: /thank|شكر|merci/,
        key: 'ai.thanks',
        chips: ['ai.chip1', 'ai.chip4'],
        actions: () => [{ label: t('ai.actionWhatsApp'), href: WA_LINK }],
        prefix: () => (userName ? `${userName}, ` : '')
      }
    ];

    for (const rule of rules) {
      if (rule.test.test(q)) {
        let reply = t(rule.key);
        if (rule.prefix) reply = rule.prefix() + reply;
        if (rule.key === 'ai.recommend') {
          const plan = recommendPlan(q);
          reply = reply.replace('{plan}', t(`ai.plan${plan.charAt(0).toUpperCase()}${plan.slice(1)}`));
        }
        lastChipKeys = rule.chips || lastChipKeys;
        return {
          reply: personalize(reply),
          actions: rule.actions ? rule.actions() : [],
          plans: rule.plans,
          recommendedPlan: rule.recommendedPlan || recommendPlan(q),
          typewriter: rule.typewriter !== false
        };
      }
    }

    lastChipKeys = ['ai.chip1', 'ai.chip2', 'ai.chip7', 'ai.chip4'];
    return {
      reply: personalize(t('ai.fallback')),
      actions: [
        { label: t('ai.actionPricing'), scroll: '#pricing' },
        { label: t('ai.actionWhatsApp'), href: WA_LINK }
      ]
    };
  }

  async function respond(userText) {
    showTyping();
    await delay(Math.min(600 + userText.length * 8, 1600));
    hideTyping();

    let result = { reply: '', actions: [] };

    if (config.apiUrl) {
      try {
        result.reply = await fetchFromApi(userText);
      } catch {
        result = brainReply(userText);
      }
    } else {
      result = brainReply(userText);
    }

    history.push({ role: 'assistant', content: result.reply });

    if (result.typewriter !== false && result.reply.length < 320) {
      await typeBotMessage(result.reply, {
        actions: result.actions,
        plans: result.plans,
        recommendedPlan: result.recommendedPlan
      });
    } else {
      addMessage('bot', result.reply, {
        actions: result.actions,
        plans: result.plans,
        recommendedPlan: result.recommendedPlan
      });
    }

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
    hideTeaser();
    addMessage('user', trimmed);
    history.push({ role: 'user', content: trimmed });
    await respond(trimmed);
  }

  function hideTeaser() {
    if (teaser) teaser.hidden = true;
    sessionStorage.setItem('sp-ai-teaser', '1');
  }

  function showTeaser() {
    if (!teaser || isOpen || sessionStorage.getItem('sp-ai-teaser')) return;
    teaser.hidden = false;
  }

  function rotateHint() {
    const hints = ['ai.hint', 'ai.hint2', 'ai.hint3'];
    if (!hintEl) return;
    hintEl.textContent = t(hints[hintIndex % hints.length]);
    hintIndex += 1;
  }

  function startHintRotation() {
    if (hintTimer) return;
    rotateHint();
    hintTimer = setInterval(rotateHint, 4000);
  }

  async function openPanel() {
    if (!panel || !toggle) return;
    isOpen = true;
    hideTeaser();
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
      const welcome = `${getTimeGreeting()}!\n\n${t('ai.welcome')}`;
      history.push({ role: 'assistant', content: welcome });
      await typeBotMessage(welcome, {
        actions: [
          { label: t('ai.actionPricing'), scroll: '#pricing' },
          { label: t('ai.actionAudit'), scroll: '#audit' },
          { label: t('ai.actionWhatsApp'), href: WA_LINK }
        ]
      });
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
    setStatus('ai.status');
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
  teaser?.addEventListener('click', (e) => {
    if (e.target === teaserClose) return;
    openPanel();
  });
  teaserClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideTeaser();
  });
  panel?.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  window.addEventListener('sp:langchange', () => {
    renderChips();
    if (input) input.placeholder = t('ai.placeholder');
    toggle?.setAttribute('aria-label', isOpen ? t('ai.closeLabel') : t('ai.openLabel'));
    if (!isTyping) setStatus('ai.status');
    rotateHint();
  });

  if (config.enabled !== false) {
    renderChips();
    if (input) input.placeholder = t('ai.placeholder');
    toggle?.setAttribute('aria-label', t('ai.openLabel'));
    startHintRotation();

    setTimeout(showTeaser, 12000);

    const pricing = document.getElementById('pricing');
    if (pricing && 'IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) showTeaser();
        });
      }, { threshold: 0.35 });
      obs.observe(pricing);
    }
  } else {
    toggle.hidden = true;
    teaser?.remove();
    backdrop?.remove();
  }

  window.SP_SOCIAL_AI = { open: openPanel, close: closePanel, send: sendUserMessage };
})();
