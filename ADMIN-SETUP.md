# Admin Control Center

Social Plus includes a production Admin Control Center backed by Node.js, SQLite, and REST APIs.

## Access

- **URL:** `/admin` (e.g. `http://localhost:5500/admin`)
- **Super Admin email:** `hamdanmustafa840@gmail.com`
- **Default password (first run):** `SocialPlus2026!` — change immediately under Security.

Set production credentials via environment variables:

```bash
SUPER_ADMIN_EMAIL=you@example.com
SUPER_ADMIN_PASSWORD=your-secure-password
JWT_SECRET=long-random-string
```

## Run locally

```bash
npm install --prefix server
./start.sh
```

## Features

| Module | Capabilities |
|--------|----------------|
| Dashboard | Real stats from database |
| Analytics | Page views, visitors, conversions, charts |
| Content | Text keys, sections, FAQs, announcements |
| Navigation | Menu CRUD, reorder, visibility |
| Services | Products/pricing CRUD |
| Orders | Status management, search, export |
| Users | CRUD, suspend/restore, export |
| Design | Colors, fonts, CSS, live preview, publish |
| Settings | General, SEO, social, security |
| Admins | Multi-admin, roles (Super Admin only) |
| Logs | Admin activity + login history |
| Database | View/edit records, backup/restore |
| Security | Password change, optional 2FA |

## Deploy

- **Website:** GitHub Pages (see `DEPLOY.md`)
- **Admin API:** [Railway](https://railway.app) — deploy this repo; set env vars from `DEPLOY.md`

Open admin at `https://YOUR-APP.up.railway.app/admin`, or set `sp-api-base` in `admin/index.html` to your Railway URL.

## Permissions

Only Super Admin can create/delete admins and restore database backups. All destructive actions require confirmation dialogs and are audit-logged.
