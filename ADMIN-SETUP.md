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
npm install
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

## Deploy (Render)

The site is configured as a **Node web service** in `render.yaml`. Set `SUPER_ADMIN_PASSWORD` in the Render dashboard. A persistent disk mounts at `data/` for SQLite.

GitHub Pages serves static files only — use Render for the full admin platform.

## Permissions

Only Super Admin can create/delete admins and restore database backups. All destructive actions require confirmation dialogs and are audit-logged.
