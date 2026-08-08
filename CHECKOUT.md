# Premium Checkout System

Epic-inspired **original** dark checkout for Social Plus — powered by Stripe (PCI compliant).

## Customer flow

```
Pricing → checkout.html → Select method → Pay → receipt.html
```

**URL:** `/checkout.html?plan=starter|growth|pro`

## Features

| Feature | Status |
|---------|--------|
| Dark premium checkout UI | ✅ |
| Payment methods (admin-configurable) | ✅ |
| Stripe Payment Element (card, PayPal, Apple/Google Pay) | ✅ |
| Website wallet | ✅ |
| Promo / gift codes | ✅ |
| Server-side pricing & validation | ✅ |
| Idempotency / duplicate prevention | ✅ |
| Webhook verification | ✅ |
| Receipt + print | ✅ |
| Admin: transactions, refunds, promos, methods, analytics | ✅ |

## Security

- Card numbers & CVV handled by **Stripe** — never stored locally
- All totals, promos, and wallet deductions computed **on the server**
- Webhooks are the authoritative payment source
- Rate limiting on `/api/checkout`

## Setup

1. Add Stripe keys to `.env` or Railway (see `PAYMENT-SETUP.md`)
2. Run `./start.sh`
3. Open `http://localhost:5500/checkout.html?plan=growth`

## Test promo codes (seeded)

- `WELCOME10` — 10% off
- `SOCIAL5` — $5 off (min $12)

## Admin

`/admin` → **Orders** → tabs: Transactions, Analytics, Promo codes, Methods

Wallet credits: `POST /api/checkout/admin/wallets/credit` (admin only)

## Payment statuses

`pending` · `processing` · `succeeded` · `failed` · `cancelled` · `refunded` · `partially_refunded` · `disputed`
