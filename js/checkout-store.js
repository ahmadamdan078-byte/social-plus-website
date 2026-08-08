(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const planId = (params.get('plan') || 'growth').toLowerCase();

  const ICONS = { card: '💳', paypal: '🅿️', apple_pay: '', google_pay: 'G', wallet: '👛', digital_wallet: '⌁' };

  let bootstrap = null;
  let selectedMethod = 'card';
  let promoCode = '';
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
    starter: { name: 'Starter Plan', price: 12, image: '/assets/brand-circle.png' },
    growth: { name: 'Growth Plan', price: 25, image: '/assets/social-plus-logo.png' },
    pro: { name: 'Pro Plan', price: 50, image: '/assets/social-plus-logo.png' }
  };

  const WA_NUMBER = '970595052784';

  function showWhatsAppFallback() {
    const plan = LOCAL_PLANS[planId] || LOCAL_PLANS.growth;
    const imgPath = plan.image.replace(/^\//, '');
    $('fb-plan').textContent = plan.name;
    $('fb-price').textContent = money(plan.price);
    $('fb-img').src = imgPath;

    function updateWaLink() {
      const name = $('fb-name').value.trim() || 'Customer';
      const email = $('fb-email').value.trim();
      const phone = $('fb-phone').value.trim();
      const text = [
        'Hello Social Plus! I want to order:',
        '',
        `Plan: ${plan.name}`,
        `Price: $${plan.price}`,
        `Name: ${name}`,
        email ? `Email: ${email}` : '',
        phone ? `WhatsApp: ${phone}` : '',
        '',
        'Please send me secure payment instructions. Thank you!'
      ].filter(Boolean).join('\n');
      $('fb-wa-btn').href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
    }

    ['fb-name', 'fb-email', 'fb-phone'].forEach((id) => {
      $(id)?.addEventListener('input', updateWaLink);
    });
    updateWaLink();
    $('store-unavailable').hidden = false;
  }

  async function init() {
    try {
      bootstrap = await api(`/api/checkout/bootstrap?plan=${planId}`);
    } catch {
      bootstrap = { enabled: false };
    }

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
