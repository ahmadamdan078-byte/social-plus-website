# Deploy & Live Site Troubleshooting

## Live URLs

| Host | URL |
|------|-----|
| GitHub Pages | https://ahmadamdan078-byte.github.io/social-plus-website/ |
| Render | https://social-plus-website.onrender.com/ |

GitHub Pages usually updates within 1–2 minutes after a push to `main`.

## Render not updating?

If Render still shows old content (e.g. old pricing text), auto-deploy is likely broken.

### Fix in 3 steps

1. **Manual deploy (immediate fix)**  
   Render Dashboard → **social-plus-website** → **Manual Deploy** → **Deploy latest commit**

2. **Check GitHub connection**  
   Settings → **Build & Deploy**  
   - Repository: `ahmadamdan078-byte/social-plus-website`  
   - Branch: `main`  
   - Auto-Deploy: **On**  
   - Build Command: `node scripts/inject-firebase-config.js`  
   - Publish Directory: `.`

3. **Add deploy hook (keeps Render in sync forever)**  
   - Render → Settings → **Deploy Hook** → Copy URL  
   - GitHub → repo → **Settings** → **Secrets and variables** → **Actions**  
   - New secret: `RENDER_DEPLOY_HOOK` = paste the URL  
   - Every push to `main` will trigger a Render deploy via GitHub Actions

### After deploy

Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows)

### Verify live version

- Open `/pay.html` — should load the checkout page  
- Pricing should say **Graphic designer**, not Priority support  
- `index.html` scripts should use `?v=25` or newer

## Local preview

```bash
./start.sh
# or for static only:
python3 -m http.server 5500
```
