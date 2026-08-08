(function () {
  'use strict';

  const cfg = window.SP_PAY_CONFIG;
  let currentLang = localStorage.getItem('sp_lang') || 'en';
  let currentPlan = null;
  let selectedMethod = 'card';

  const params = new URLSearchParams(location.search);
  const planId = (params.get('plan') || 'growth').toLowerCase();

  function t(key) {
    return (window.SP_I18N?.[currentLang]?.[key]) || key;
  }

  function formatCard(num) {
    return String(num).replace(/\s/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  function setLanguage(lang) {
    if (!window.SP_I18N?.[lang]) return;
    currentLang = lang;
    localStorage.setItem('sp_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const val = t(key);
      if (val && val !== key) el.textContent = val;
    });

    document.querySelectorAll('.lang-switch__btn').forEach((btn) => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active);
    });

    if (currentPlan) renderPlan(currentPlan);
    initMethods();
  }

  function renderPlan(plan) {
    currentPlan = plan;
    const nameEl = document.getElementById('pay-plan-name');
    const amountEl = document.getElementById('pay-plan-amount');
    if (nameEl) nameEl.textContent = t(plan.nameKey);
    if (amountEl) amountEl.textContent = `$${plan.price}`;
    document.title = `${t('pay.title')} — ${t(plan.nameKey)} | Social Plus`;
  }

  function initPlan() {
    const plan = cfg.plans[planId] || cfg.plans.growth;
    renderPlan(plan);
  }

  function initMethods() {
    const wrap = document.getElementById('pay-methods');
    if (!wrap || !cfg.methods) return;

    wrap.innerHTML = cfg.methods.map((m, i) => `
      <label class="pay-method ${i === 0 ? 'is-active' : ''}">
        <input type="radio" name="pay-method" value="${m.id}" ${i === 0 ? 'checked' : ''}>
        <span data-i18n="${m.nameKey}">${t(m.nameKey)}</span>
      </label>
    `).join('');

    wrap.querySelectorAll('input[name="pay-method"]').forEach((input) => {
      input.addEventListener('change', () => {
        selectedMethod = input.value;
        wrap.querySelectorAll('.pay-method').forEach((el) => {
          el.classList.toggle('is-active', el.querySelector('input') === input);
        });
      });
    });
  }

  function getMethodLabel() {
    const method = cfg.methods?.find((m) => m.id === selectedMethod);
    return method ? t(method.nameKey) : selectedMethod;
  }

  function initCard() {
    const display = document.getElementById('pay-card-display');
    if (display) display.textContent = formatCard(cfg.cardNumber);

    document.getElementById('pay-copy-card')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(cfg.cardNumber.replace(/\s/g, ''));
        showToast(t('pay.card.copied'));
      } catch {
        showToast(cfg.cardNumber);
      }
    });
  }

  async function submitOrder(data) {
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (window.SP_trackConversion) {
        window.SP_trackConversion({ type: 'payment', plan: planId });
      }
    } catch {}
  }

  function openWhatsApp(name, whatsapp) {
    const plan = cfg.plans[planId] || cfg.plans.growth;
    const lines = [
      'Social Plus — Payment Confirmation',
      '',
      `Plan: ${t(plan.nameKey)}`,
      `Amount: $${plan.price}`,
      `Name: ${name}`,
      `WhatsApp: ${whatsapp}`,
      `Payment method: ${getMethodLabel()}`,
      `Recipient: ${cfg.recipientName}`,
      '',
      'I have sent the payment. Please verify and activate my plan.'
    ];
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${cfg.whatsapp}?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function initForm() {
    document.getElementById('pay-confirm-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('pay-name').value.trim();
      const whatsapp = document.getElementById('pay-whatsapp').value.trim();
      if (!name || !whatsapp) return;

      const plan = cfg.plans[planId] || cfg.plans.growth;
      submitOrder({
        customer_name: name,
        customer_phone: whatsapp,
        service_name: `${t(plan.nameKey)} Plan`,
        amount: plan.price,
        status: 'pending',
        notes: `Payment via ${getMethodLabel()} to ${cfg.recipientName} — card ending ${cfg.cardNumber.slice(-4)}`
      });

      openWhatsApp(name, whatsapp);
      showToast(t('pay.sent'));
    });
  }

  document.querySelectorAll('.lang-switch__btn').forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  initPlan();
  initMethods();
  initCard();
  initForm();
  setLanguage(currentLang);
})();
