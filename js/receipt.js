(function () {
  'use strict';

  const id = new URLSearchParams(location.search).get('payment_id');
  const sessionId = new URLSearchParams(location.search).get('session_id');

  function money(n) {
    return `$${Number(n || 0).toFixed(2)}`;
  }

  async function load() {
    if (!id) {
      document.getElementById('r-status').textContent = 'Missing receipt';
      return;
    }

    try {
      let receipt;
      const res = await fetch(window.spApi(`/api/checkout/receipt/${id}`));
      const data = await res.json();
      if (!res.ok) {
        if (sessionId) {
          const v = await fetch(window.spApi(`/api/payments/verify/${encodeURIComponent(sessionId)}`));
          const vd = await v.json();
          if (vd.verified) {
            location.replace(`receipt.html?payment_id=${vd.orderId}`);
            return;
          }
        }
        throw new Error(data.error || 'Receipt unavailable');
      }
      receipt = data.receipt;

      document.getElementById('r-order').textContent = `#${receipt.orderNumber}`;
      document.getElementById('r-txn').textContent = receipt.transactionId || '—';
      document.getElementById('r-date').textContent = receipt.date?.slice(0, 16) || '—';
      document.getElementById('r-product').textContent = `${receipt.product.name} × ${receipt.product.quantity || 1}`;
      document.getElementById('r-email').textContent = receipt.customer.email || '—';
      document.getElementById('r-sub').textContent = money(receipt.subtotal);
      document.getElementById('r-disc').textContent = receipt.discount > 0 ? `−${money(receipt.discount)}` : money(0);
      document.getElementById('r-tax').textContent = money(receipt.tax);
      document.getElementById('r-total').textContent = money(receipt.totalPaid);
      document.getElementById('r-method').textContent = receipt.paymentMethod || '—';

      if (receipt.status === 'pending' || receipt.status === 'processing') {
        document.getElementById('r-status').textContent = '… Payment processing';
        document.getElementById('r-status').className = 'store-receipt__status';
      }
    } catch (e) {
      document.getElementById('r-status').textContent = '✕ ' + e.message;
      document.getElementById('r-status').className = 'store-receipt__status';
      document.getElementById('r-status').style.background = 'rgba(239,68,68,0.15)';
      document.getElementById('r-status').style.color = '#ef4444';
    }
  }

  document.getElementById('r-print').onclick = () => window.print();
  load();
})();
