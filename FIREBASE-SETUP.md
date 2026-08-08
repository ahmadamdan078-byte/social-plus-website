# Enable Google Sign-In (5 minutes)

Google login needs a free Firebase project. Do this **once** on your phone or computer.

## Step 1 — Create project
1. Open https://console.firebase.google.com
2. Sign in with Google
3. **Add project** → name it `social-plus` → Continue → Create project

## Step 2 — Enable Google sign-in
1. Left menu → **Build** → **Authentication**
2. **Get started**
3. **Sign-in method** tab → **Google** → Enable → Save

## Step 3 — Add your website
1. Still in Authentication → **Settings** → **Authorized domains**
2. Make sure these exist (add if missing):
   - `localhost`
   - `social-plus-website.onrender.com`
   - `ahmadamdan078-byte.github.io`

## Step 4 — Copy web app keys
1. Click ⚙️ **Project settings** (gear icon)
2. Scroll to **Your apps** → click **Web** `</>` icon
3. App nickname: `Social Plus Website` → Register app
4. Copy the `firebaseConfig` object values

## Step 5 — Paste into the site
Open `js/firebase-config.js` and replace the placeholders:

```javascript
window.SP_FIREBASE_CONFIG = {
  apiKey: 'PASTE_HERE',
  authDomain: 'PASTE_HERE',
  projectId: 'PASTE_HERE',
  storageBucket: 'PASTE_HERE',
  messagingSenderId: 'PASTE_HERE',
  appId: 'PASTE_HERE'
};
```

Push to GitHub → live site updates in ~3 minutes.

---

### Optional: Render environment variables
Instead of editing the file, set these in Render Dashboard → your site → **Environment**:

| Key | Value |
|-----|--------|
| `FIREBASE_API_KEY` | from config |
| `FIREBASE_AUTH_DOMAIN` | from config |
| `FIREBASE_PROJECT_ID` | from config |
| `FIREBASE_STORAGE_BUCKET` | from config |
| `FIREBASE_MESSAGING_SENDER_ID` | from config |
| `FIREBASE_APP_ID` | from config |

Then redeploy.

---

**Send the 6 values to your developer** and they can paste them for you.
