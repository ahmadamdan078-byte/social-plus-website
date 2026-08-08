# Deploy Social Plus (no Render, no paid domain required)

## Live website — GitHub Pages (free)

**URL:** https://ahmadamdan078-byte.github.io/social-plus-website/

No custom domain needed. GitHub Pages is free and fast — **no cold start**.

### One-time setup

1. GitHub → repo **social-plus-website** → **Settings** → **Pages**
2. **Source:** GitHub Actions (not “Deploy from branch”)
3. Push to `main` — the workflow `.github/workflows/deploy-pages.yml` deploys automatically

### After each push

Wait 1–2 minutes, then open the live URL. Hard refresh: **Cmd+Shift+R**.

---

## Payments & admin API — Railway (optional)

The public website runs on GitHub Pages. For **Stripe checkout**, **webhooks**, and the **admin dashboard API**, deploy the Node server on [Railway](https://railway.app) (free trial credits, then pay-as-you-go).

### Railway setup

1. Sign up at [railway.app](https://railway.app) with GitHub
2. **New Project** → **Deploy from GitHub repo** → `social-plus-website`
3. Railway reads `railway.toml` and `Procfile` automatically
4. Add environment variables:

```bash
NODE_ENV=production
JWT_SECRET=your-long-random-secret
PUBLIC_BASE_URL=https://YOUR-APP.up.railway.app
SUPER_ADMIN_EMAIL=hamdanmustafa840@gmail.com
SUPER_ADMIN_PASSWORD=your-secure-password
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

5. Copy your Railway URL (e.g. `https://social-plus-production.up.railway.app`)
6. In `index.html`, set the API base (one line):

```html
<meta name="sp-api-base" content="https://YOUR-APP.up.railway.app">
```

Also set `PUBLIC_BASE_URL` on Railway to that same URL.

7. Stripe webhook URL: `https://YOUR-APP.up.railway.app/api/payments/webhook/stripe`

### What works where

| Feature | GitHub Pages only | GitHub Pages + Railway |
|---------|-------------------|-------------------------|
| Website | Yes | Yes |
| Checkout / Stripe | No | Yes |
| Admin `/admin` | UI only | Full (login on Railway URL or with `sp-api-base`) |
| WhatsApp / forms | WhatsApp yes; forms need API | Full |

---

## Custom domain (optional — skip)

You don't need one. Use the GitHub Pages URL above. See `DOMAIN.md` only if you want a paid custom URL later.

---

## Local preview

```bash
./start.sh
# → http://localhost:5500
```

---

## Remove Render (if you used it)

Delete the old Render services in the [Render dashboard](https://dashboard.render.com) — this project no longer uses Render.
