# Payment System Setup (Stripe)

Social Plus uses **Stripe Checkout** for secure payments. Card numbers, CVV, and Apple Pay / Google Pay are handled entirely by Stripe — never stored on this website.

## Architecture

```
Customer → pay.html → POST /api/payments/checkout-session
         → Stripe Checkout (hosted, PCI compliant)
         → Webhook POST /api/payments/webhook/stripe
         → Order marked paid (server-side only)
         → checkout-success.html verifies via GET /api/payments/verify/:sessionId
```

Payment provider code lives in `backend/payments/` and can be swapped without rewriting the checkout UI.

## 1. Create Stripe account

1. Sign up at [stripe.com](https://stripe.com)
2. Dashboard → **Developers → API keys**
3. Copy **Publishable key** and **Secret key** (test mode first)

## 2. Environment variables

Set on your **Node server** (local `.env` or Railway dashboard):

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_BASE_URL=https://YOUR-APP.up.railway.app
PAYMENT_PROVIDER=stripe
```

On GitHub Pages, add your Railway URL to `index.html`:

```html
<meta name="sp-api-base" content="https://YOUR-APP.up.railway.app">
```

Never commit secret keys to Git.

## 3. Webhooks

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://YOUR-DOMAIN/api/payments/webhook/stripe`
3. Events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
4. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET`

## 4. Enable payment methods

In Stripe Dashboard → **Settings → Payment methods**, enable:

- Cards
- Apple Pay
- Google Pay
- PayPal (if available for your region)

## 5. Run the Node server (required)

Payments **do not work** on static-only hosting. Use:

```bash
./start.sh
```

Or deploy on **Railway** (see `railway.toml` and `DEPLOY.md`):

```bash
npm run build && npm install --prefix server
NODE_PATH=./server/node_modules node server.js
```

## 6. Admin

Open `/admin` → **Orders** → **Payments** tab to:

- View payment status (pending, succeeded, failed, cancelled, refunded)
- Search transactions
- Filter by status
- Issue refunds (Stripe)

## 7. Test cards (Stripe test mode)

| Result | Card |
|--------|------|
| Success | 4242 4242 4242 4242 |
| Declined | 4000 0000 0000 0002 |

Use any future expiry and any 3-digit CVC.

## Email receipts

Enable **Customer emails** in Stripe Dashboard → Settings → Emails for automatic receipts.

## Replacing Stripe later

Implement a new file in `backend/payments/` matching the interface in `stripe-provider.js`, register it in `backend/payments/index.js`, and set `PAYMENT_PROVIDER`.
