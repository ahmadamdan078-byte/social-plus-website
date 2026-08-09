(function () {
  'use strict';

  function getPlan(id) {
    const price = window.SP_PRICING?.getPrice?.(id) ?? ({ starter: 12, growth: 25, pro: 50 }[id] ?? 25);
    const names = { starter: 'Starter Plan', growth: 'Growth Plan', pro: 'Pro Plan' };
    return { name: names[id] || names.growth, price };
  }

  const params = new URLSearchParams(location.search);
  const planId = (params.get('plan') || 'growth').toLowerCase();
  let config = { enabled: false };

  function $(id) { return document.getElementById(id); }

  function t(key) {
    const lang = localStorage.getItem('sp_lang') || 'en';
    return window.SP_I18N?.[lang]?.[key] || key;
  }

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  function updateSummary(qty) {
    const plan = getPlan(planId);
    const quantity = Math.max(1, Math.min(99, parseInt(qty, 10) || 1));
    const subtotal = plan.price * quantity;
    $('summary-plan').textContent = plan.name;
    $('summary-qty').textContent = quantity;
    $('summary-subtotal').textContent = money(subtotal);
    $('summary-discount').textContent = money(0);
    $('summary-fees').textContent = money(0);
    $('summary-total').textContent = money(subtotal);
    return { plan, quantity, subtotal };
  }

  async function loadConfig() {
    try {
      const res = await fetch(window.spApi('/api/payments/config'));
      config = await res.json();
    } catch {
      config = { enabled: false };
    }

    if (!config.enabled) {
      $('checkout-app').hidden = true;
      $('checkout-unavailable').hidden = false;
    }
  }

  function showError(msg) {
    const el = $('checkout-error');
    el.textContent = msg;
    el.hidden = false;
  }

  async function init() {
    await loadConfig();
    updateSummary($('co-qty').value);

    $('co-qty').addEventListener('input', (e) => updateSummary(e.target.value));

    document.querySelectorAll('.lang-switch__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        localStorage.setItem('sp_lang', btn.dataset.lang);
        document.documentElement.lang = btn.dataset.lang;
        document.documentElement.dir = btn.dataset.lang === 'ar' ? 'rtl' : 'ltr';
        document.querySelectorAll('[data-i18n]').forEach((el) => {
          const v = t(el.getAttribute('data-i18n'));
          if (v !== el.getAttribute('data-i18n')) el.textContent = v;
        });
      });
    });

    $('checkout-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('checkout-error').hidden = true;
      const btn = $('co-submit');
      btn.disabled = true;

      try {
        const idempotencyKey = crypto.randomUUID?.() || String(Date.now());
        const res = await fetch(window.spApi('/api/payments/checkout-session'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify({
            planId,
            customerName: $('co-name').value.trim(),
            customerEmail: $('co-email').value.trim(),
            customerPhone: $('co-phone').value.trim(),
            quantity: parseInt($('co-qty').value, 10) || 1,
            acceptTerms: $('co-terms').checked
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Checkout failed');

        if (data.url) {
          location.href = data.url;
          return;
        }
        throw new Error('No checkout URL returned');
      } catch (err) {
        showError(err.message);
        btn.disabled = false;
      }
    });
  }

  init();
})();
