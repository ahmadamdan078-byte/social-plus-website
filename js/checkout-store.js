(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const planId = (params.get('plan') || 'growth').toLowerCase();

  const ICONS = { card: '💳', paypal: '🅿️', apple_pay: '', google_pay: 'G', wallet: '👛', digital_wallet: '⌁' };

  let bootstrap = null;
  let selectedMethod = 'card';
  let promoCode = '';
  let fallbackPromo = null;
  let stripe = null;
  let elements = null;
  let paymentElement = null;
  let paying = false;
  let quoteDebounce = null;

  const $ = (id) => document.getElementById(id);

  function money(n, cur) {
    const c = (cur || bootstrap?.settings?.currency || 'usd').toUpperCase();
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: c === 'USD' ? 'USD' : 'USD' }).format(Number(n) || 0);
  }

  function showError(msg) {
    const el = $('co-error');
    el.textContent = msg;
    el.hidden = !msg;
  }

  function setLoading(on) {
    paying = on;
    $('co-submit').disabled = on;
    $('co-submit').querySelector('.store-btn__text').hidden = on;
    $('co-submit').querySelector('.store-btn__loader').hidden = !on;
  }

  async function api(path, opts = {}) {
    const res = await fetch(window.spApi(path), {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {})
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function renderMethods(methods) {
    const wrap = $('co-methods');
    wrap.innerHTML = methods.map((m) => `
      <label class="store-method ${selectedMethod === m.code ? 'is-active' : ''}" data-method="${m.code}">
        <input type="radio" name="paymethod" value="${m.code}" ${selectedMethod === m.code ? 'checked' : ''}>
        <span class="store-method__icon">${ICONS[m.code] || '•'}</span>
        <span>${m.name}</span>
      </label>
    `).join('');

    wrap.querySelectorAll('.store-method').forEach((el) => {
      el.addEventListener('click', () => {
        selectedMethod = el.dataset.method;
        wrap.querySelectorAll('.store-method').forEach((x) => x.classList.toggle('is-active', x.dataset.method === selectedMethod));
        toggleStripeMount();
        refreshQuote();
      });
    });
  }

  function toggleStripeMount() {
    const needsStripe = ['card', 'paypal', 'apple_pay', 'google_pay', 'digital_wallet'].includes(selectedMethod);
    $('co-stripe-wrap').hidden = !needsStripe || !bootstrap?.publishableKey;
    if (needsStripe && bootstrap?.publishableKey && !paymentElement) mountStripe();
  }

  function mountStripe() {
    if (!window.Stripe || !bootstrap?.publishableKey) return;
    stripe = window.Stripe(bootstrap.publishableKey);
    elements = stripe.elements({
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: '#E91E8C',
          colorBackground: '#0a0a0c',
          colorText: '#f0f0f5',
          borderRadius: '10px'
        }
      }
    });
    paymentElement = elements.create('payment', { layout: 'tabs' });
    paymentElement.mount('#co-stripe-element');
  }

  function updateSummary(q) {
    $('sum-plan').textContent = q.planName;
    $('sum-qty').textContent = q.quantity;
    if (bootstrap?.selectedPlan?.image) $('sum-img').src = bootstrap.selectedPlan.image;
    $('sum-sub').textContent = money(q.subtotal);
    $('sum-disc').textContent = q.discount > 0 ? `−${money(q.discount)}` : money(0);
    $('sum-tax').textContent = money(q.tax);
    $('sum-fees').textContent = money(q.fees);
    if (q.walletApplied > 0) {
      $('sum-wallet-row').hidden = false;
      $('sum-wallet').textContent = `−${money(q.walletApplied)}`;
    } else {
      $('sum-wallet-row').hidden = true;
    }
    $('sum-total').textContent = money(q.cardDue);
    $('co-submit').querySelector('.store-btn__text').textContent =
      q.cardDue <= 0 ? 'Complete order' : `Pay Now — ${money(q.cardDue)}`;
  }

  async function refreshQuote() {
    clearTimeout(quoteDebounce);
    quoteDebounce = setTimeout(async () => {
      try {
        const email = $('co-email').value.trim();
        const { quote } = await api('/api/checkout/quote', {
          method: 'POST',
          body: {
            planId,
            quantity: parseInt($('co-qty').value, 10) || 1,
            promoCode: promoCode || undefined,
            customerEmail: email || undefined,
            paymentMethod: selectedMethod,
            useWallet: $('co-use-wallet')?.checked
          }
        });
        updateSummary(quote);
        if (email && bootstrap?.settings?.walletEnabled) {
          const w = await api(`/api/checkout/wallet?email=${encodeURIComponent(email)}`);
          $('co-wallet-bal').textContent = money(w.totalCents / 100);
          $('co-wallet-row').hidden = w.totalCents <= 0;
        }
      } catch (e) {
        /* silent on partial form */
      }
    }, 280);
  }

  const LOCAL_PLANS = {
    starter: { name: 'Starter Plan', image: '/assets/brand-circle.png' },
    growth: { name: 'Growth Plan', image: '/assets/social-plus-logo.png' },
    pro: { name: 'Pro Plan', image: '/assets/social-plus-logo.png' }
  };

  function resolvePlan(id) {
    const tier = (id || planId || 'growth').toLowerCase();
    const params = new URLSearchParams(location.search);
    const urlPlan = (params.get('plan') || 'growth').toLowerCase();
    const urlPrice = parseFloat(String(params.get('price') || '').replace(/[^0-9.]/g, ''));
    let price;
    if (tier === urlPlan && Number.isFinite(urlPrice)) {
      price = urlPrice;
    } else {
      price = window.__SP_GET_PRICE__?.(tier)
        ?? window.SP_PRICING?.getPrice?.(tier)
        ?? 25;
    }
    const base = LOCAL_PLANS[tier] || LOCAL_PLANS.growth;
    return { ...base, id: tier, price: Number(price) };
  }

  const FALLBACK_PROMOS = {
    SAVE18: { type: 'percent', value: 18, plans: ['starter', 'growth', 'pro'] },
    WELCOME10: { type: 'percent', value: 10 },
    SOCIAL5: { type: 'fixed', value: 5, min: 15.99 }
  };

  function computeFallbackDiscount(code, subtotal, tier) {
    const key = String(code || '').trim().toUpperCase();
    const promo = FALLBACK_PROMOS[key];
    if (!promo) return null;
    if (promo.plans && !promo.plans.includes(tier)) {
      return { error: 'Promo code not valid for this plan' };
    }
    if (promo.min != null && subtotal < promo.min) {
      return { error: `Minimum order $${promo.min} for this code` };
    }
    let discount = promo.type === 'percent'
      ? Math.floor(subtotal * (promo.value / 100) * 100) / 100
      : Math.min(subtotal, promo.value);
    return {
      code: key,
      label: promo.type === 'percent' ? `${promo.value}% off` : `$${promo.value} off`,
      discount,
      total: Math.max(0, subtotal - discount)
    };
  }

  async function validateFallbackPromo(code) {
    const trimmed = String(code || '').trim();
    if (!trimmed) return null;
    const subtotal = resolvePlan(planId).price;
    try {
      const res = await api('/api/checkout/validate-promo', {
        method: 'POST',
        body: { code: trimmed, planId, quantity: 1 }
      });
      const discount = Number(res.discount) || 0;
      return {
        code: trimmed.toUpperCase(),
        label: res.label || 'Promo applied',
        discount,
        total: Math.max(0, subtotal - discount)
      };
    } catch (err) {
      const local = computeFallbackDiscount(trimmed, subtotal, planId);
      if (!local) return { error: err.message || 'Invalid promo code' };
      if (local.error) return local;
      return local;
    }
  }

  const WA_NUMBER = '970595052784';

  function showWhatsAppFallback() {
    const plan = resolvePlan(planId);
    const imgPath = plan.image.replace(/^\//, '');

    function renderFallback() {
      const current = resolvePlan(planId);
      const subtotal = current.price;
      const discount = fallbackPromo?.discount || 0;
      const total = fallbackPromo?.total ?? subtotal;

      $('fb-plan').textContent = current.name;
      $('fb-price').textContent = money(subtotal);
      $('fb-total').textContent = money(total);

      const discountRow = $('fb-discount-row');
      if (discount > 0 && fallbackPromo) {
        discountRow.hidden = false;
        $('fb-discount').textContent = `−${money(discount)} (${fallbackPromo.label})`;
      } else {
        discountRow.hidden = true;
      }
      return current;
    }

    function updateWaLink() {
      renderFallback();
      const current = resolvePlan(planId);
      const subtotal = current.price;
      const discount = fallbackPromo?.discount || 0;
      const total = fallbackPromo?.total ?? subtotal;
      const name = $('fb-name').value.trim() || 'Customer';
      const email = $('fb-email').value.trim();
      const phone = $('fb-phone').value.trim();
      const text = [
        'Hello Social Plus! I want to order:',
        '',
        `Plan: ${current.name}`,
        `Price: $${subtotal.toFixed(2)}`,
        fallbackPromo?.code ? `Promo code: ${fallbackPromo.code}` : '',
        discount > 0 ? `Discount: -$${discount.toFixed(2)} (${fallbackPromo.label})` : '',
        `Total: $${total.toFixed(2)}`,
        `Name: ${name}`,
        email ? `Email: ${email}` : '',
        phone ? `WhatsApp: ${phone}` : '',
        '',
        'Please send me secure payment instructions. Thank you!'
      ].filter(Boolean).join('\n');
      $('fb-wa-btn').href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
    }

    renderFallback();
    $('fb-img').src = imgPath;

    ['fb-name', 'fb-email', 'fb-phone'].forEach((id) => {
      $(id)?.addEventListener('input', updateWaLink);
    });

    $('fb-promo-apply')?.addEventListener('click', async () => {
      const code = $('fb-promo')?.value.trim();
      const msg = $('fb-promo-msg');
      if (!code) {
        fallbackPromo = null;
        msg.hidden = true;
        updateWaLink();
        return;
      }
      msg.textContent = 'Checking code…';
      msg.className = 'store-promo-msg';
      msg.hidden = false;
      const result = await validateFallbackPromo(code);
      if (result?.error) {
        fallbackPromo = null;
        msg.textContent = result.error;
        msg.className = 'store-promo-msg is-err';
      } else {
        fallbackPromo = result;
        msg.textContent = `${result.label} applied`;
        msg.className = 'store-promo-msg is-ok';
      }
      updateWaLink();
    });

    $('fb-promo')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('fb-promo-apply')?.click();
      }
    });

    updateWaLink();
    $('store-unavailable').hidden = false;

    function onPricingChange() {
      updateWaLink();
    }
    document.addEventListener('sp:pricing-updated', onPricingChange);
    document.addEventListener('sp:pricing-ready', onPricingChange);
  }

  function populateCountries() {
    const sel = $('co-country');
    if (!sel || sel.dataset.populated === '1') return;
    const list = window.SP_COUNTRIES || [];
    if (!list.length) return;
    sel.innerHTML = list.map((c) =>
      `<option value="${c.code}">${c.name}</option>`
    ).join('');
    sel.value = 'PS';
    sel.dataset.populated = '1';
  }

  async function init() {
    window.__SP_REFRESH_PRICES__?.();
    if (window.SP_PRICING?.ready) await window.SP_PRICING.ready;
    window.__SP_REFRESH_PRICES__?.();

    populateCountries();
    try {
      bootstrap = await api(`/api/checkout/bootstrap?plan=${planId}`);
      window.SP_PRICING?.setFromBootstrap?.(bootstrap.plans);
    } catch {
      bootstrap = { enabled: false };
    }

    if (bootstrap?.selectedPlan?.price != null && bootstrap?.selectedPlan?.id === planId) {
      try {
        const raw = localStorage.getItem('sp_admin_overrides') || '{}';
        const local = JSON.parse(raw);
        const hasLocal = local.pricing?.[planId] != null
          || local.texts?.[`pricing.${planId}.price`];
        if (!hasLocal && !new URLSearchParams(location.search).get('price')) {
          window.__SP_PRICES__ = window.__SP_PRICES__ || {};
          window.__SP_PRICES__[planId] = Number(bootstrap.selectedPlan.price);
        }
      } catch {}
    }

    window.__SP_REFRESH_PRICES__?.();

    $('store-skeleton').hidden = true;

    if (!bootstrap.enabled && !bootstrap.settings?.walletEnabled) {
      showWhatsAppFallback();
      return;
    }

    $('store-grid').hidden = false;
    $('sum-img').src = bootstrap.selectedPlan?.image || 'assets/social-plus-logo.png';
    $('sum-plan').textContent = bootstrap.selectedPlan?.name || planId;

    renderMethods(bootstrap.methods || [{ code: 'card', name: 'Card' }]);
    toggleStripeMount();
    refreshQuote();

    $('co-qty').addEventListener('input', refreshQuote);
    $('co-email').addEventListener('input', refreshQuote);
    $('co-use-wallet')?.addEventListener('change', refreshQuote);

    $('qty-minus').onclick = () => {
      const n = Math.max(1, (parseInt($('co-qty').value, 10) || 1) - 1);
      $('co-qty').value = n;
      refreshQuote();
    };
    $('qty-plus').onclick = () => {
      const n = Math.min(99, (parseInt($('co-qty').value, 10) || 1) + 1);
      $('co-qty').value = n;
      refreshQuote();
    };

    $('co-promo-apply').onclick = async () => {
      promoCode = $('co-promo').value.trim();
      const msg = $('co-promo-msg');
      if (!promoCode) { msg.hidden = true; refreshQuote(); return; }
      try {
        await api('/api/checkout/validate-promo', {
          method: 'POST',
          body: {
            code: promoCode,
            planId,
            quantity: parseInt($('co-qty').value, 10) || 1,
            customerEmail: $('co-email').value.trim()
          }
        });
        msg.textContent = 'Promo applied';
        msg.className = 'store-promo-msg is-ok';
        msg.hidden = false;
        refreshQuote();
      } catch (e) {
        msg.textContent = e.message;
        msg.className = 'store-promo-msg is-err';
        msg.hidden = false;
        promoCode = '';
      }
    };

    $('checkout-form').onsubmit = handlePay;

    window.addEventListener('beforeunload', (e) => {
      if (paying) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  async function handlePay(e) {
    e.preventDefault();
    if (paying) return;
    showError('');
    setLoading(true);

    const idempotencyKey = crypto.randomUUID?.() || String(Date.now());

    try {
      const result = await api('/api/checkout/pay', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: {
          planId,
          customerName: $('co-name').value.trim(),
          customerEmail: $('co-email').value.trim(),
          customerPhone: $('co-phone').value.trim(),
          quantity: parseInt($('co-qty').value, 10) || 1,
          promoCode: promoCode || undefined,
          paymentMethod: selectedMethod,
          useWallet: $('co-use-wallet')?.checked,
          billingCountry: $('co-country').value,
          acceptTerms: $('co-terms').checked
        }
      });

      if (result.status === 'succeeded' || (result.status === 'processing' && !result.clientSecret)) {
        location.href = `receipt.html?payment_id=${result.paymentId}`;
        return;
      }

      if (result.clientSecret && stripe && elements) {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret: result.clientSecret,
          confirmParams: {
            return_url: `${location.origin}${location.pathname.replace('checkout.html', '')}receipt.html?payment_id=${result.paymentId}`
          },
          redirect: 'if_required'
        });

        if (error) {
          throw new Error(friendlyError(error.message));
        }

        if (paymentIntent?.status === 'succeeded') {
          await api('/api/checkout/confirm', {
            method: 'POST',
            body: { paymentId: result.paymentId, paymentIntentId: paymentIntent.id }
          });
          location.href = `receipt.html?payment_id=${result.paymentId}`;
          return;
        }
      }

      throw new Error('Payment could not be completed');
    } catch (err) {
      showError(friendlyError(err.message));
      setLoading(false);
    }
  }

  function friendlyError(msg) {
    const m = (msg || '').toLowerCase();
    if (m.includes('declined') || m.includes('card was declined')) return 'Your card was declined. Try another payment method.';
    if (m.includes('insufficient')) return 'Insufficient funds. Please use another payment method.';
    if (m.includes('duplicate')) return 'This payment was already submitted. Check your email for confirmation.';
    if (m.includes('expired') || m.includes('session')) return 'Your session expired. Please refresh and try again.';
    if (m.includes('network') || m.includes('fetch')) return 'Network error. Check your connection and try again.';
    if (m.includes('unavailable')) return 'Payments are temporarily unavailable. Please try again later.';
    if (m.includes('terms')) return 'Please accept the terms to continue.';
    return msg || 'Payment failed. Please try again.';
  }

  init();
})();
