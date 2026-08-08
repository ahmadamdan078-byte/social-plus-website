(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const sessionId = params.get('session_id');

  const icon = document.getElementById('result-icon');
  const title = document.getElementById('result-title');
  const desc = document.getElementById('result-desc');
  const receipt = document.getElementById('receipt');

  async function verify() {
    if (!sessionId) {
      showFailed('Missing session', 'Invalid payment session.');
      return;
    }

    try {
      const res = await fetch(window.spApi(`/api/payments/verify/${encodeURIComponent(sessionId)}`));
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Verification failed');

      if (data.verified && data.status === 'succeeded') {
        icon.textContent = '✓';
        icon.style.background = 'rgba(34,197,94,0.15)';
        icon.style.color = '#22c55e';
        title.textContent = 'Payment successful';
        desc.textContent = 'Thank you! Your order is confirmed. A receipt will be sent to your email when configured with Stripe.';
        document.getElementById('r-order').textContent = data.orderId || '—';
        document.getElementById('r-txn').textContent = data.transactionId || sessionId;
        document.getElementById('r-amount').textContent = data.amount != null ? `$${Number(data.amount).toFixed(2)}` : '—';
        document.getElementById('r-email').textContent = data.customerEmail || '—';
        receipt.hidden = false;
      } else if (data.status === 'pending') {
        icon.textContent = '…';
        title.textContent = 'Payment pending';
        desc.textContent = 'Your payment is being processed. We will update your order once confirmed.';
      } else {
        showFailed('Payment not completed', 'Status: ' + (data.status || 'unknown'));
      }
    } catch (err) {
      showFailed('Verification error', err.message);
    }
  }

  function showFailed(t, d) {
    icon.textContent = '✕';
    icon.style.background = 'rgba(239,68,68,0.15)';
    icon.style.color = '#ef4444';
    title.textContent = t;
    desc.textContent = d;
  }

  verify();
})();
