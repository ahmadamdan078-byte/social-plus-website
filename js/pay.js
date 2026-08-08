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

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.hidden = true; }, 3500);
  }

  function maskCard(num) {
    const digits = String(num).replace(/\D/g, '');
    if (digits.length < 4) return '****';
    return '**** **** **** ' + digits.slice(-4);
  }

  function formatCardInput(value) {
    return value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  function formatExpiryInput(value) {
    const d = value.replace(/\D/g, '').slice(0, 4);
    if (d.length <= 2) return d;
    return d.slice(0, 2) + '/' + d.slice(2);
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
    renderPlan(cfg.plans[planId] || cfg.plans.growth);
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

  function initCardInputs() {
    const num = document.getElementById('pay-card-number');
    const exp = document.getElementById('pay-card-expiry');
    if (num) {
      num.addEventListener('input', () => { num.value = formatCardInput(num.value); });
    }
    if (exp) {
      exp.addEventListener('input', () => { exp.value = formatExpiryInput(exp.value); });
    }
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

  function notifyAdmin(payload) {
    const plan = cfg.plans[planId] || cfg.plans.growth;
    const lines = [
      'Social Plus — New Payment Request',
      '',
      `Plan: ${t(plan.nameKey)} ($${plan.price})`,
      `Customer: ${payload.name}`,
      `WhatsApp: ${payload.whatsapp}`,
      `Method: ${getMethodLabel()}`,
      `Card name: ${payload.cardName}`,
      `Card: ${maskCard(payload.cardNumber)}`,
      `Expiry: ${payload.expiry}`,
      '',
      'Process payment to recipient account and confirm with customer.'
    ];
    const text = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${cfg.whatsapp}?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function showSuccess() {
    document.querySelector('.pay-main')?.setAttribute('hidden', '');
    document.getElementById('header')?.setAttribute('hidden', '');
    const el = document.getElementById('pay-success');
    if (el) el.hidden = false;
  }

  function initForm() {
    document.getElementById('pay-form')?.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('pay-name').value.trim();
      const whatsapp = document.getElementById('pay-whatsapp').value.trim();
      const cardName = document.getElementById('pay-card-name').value.trim();
      const cardNumber = document.getElementById('pay-card-number').value.replace(/\s/g, '');
      const expiry = document.getElementById('pay-card-expiry').value.trim();
      const cvc = document.getElementById('pay-card-cvc').value.trim();

      if (!name || !whatsapp || !cardName || cardNumber.length < 13 || !expiry || !cvc) {
        showToast(t('pay.error.fill'));
        return;
      }

      const plan = cfg.plans[planId] || cfg.plans.growth;
      const payload = { name, whatsapp, cardName, cardNumber, expiry };

      submitOrder({
        customer_name: name,
        customer_phone: whatsapp,
        service_name: `${t(plan.nameKey)} Plan`,
        amount: plan.price,
        status: 'pending',
        notes: `Payment request via ${getMethodLabel()}. Card: ${maskCard(cardNumber)}. Exp: ${expiry}.`
      });

      notifyAdmin(payload);
      document.getElementById('pay-form').reset();
      showSuccess();
    });
  }

  document.querySelectorAll('.lang-switch__btn').forEach((btn) => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  initPlan();
  initMethods();
  initCardInputs();
  initForm();
  setLanguage(currentLang);
})();
