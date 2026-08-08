/**
 * Firebase + Firestore configuration
 *
 * SETUP CHECKLIST (one time):
 * 1. https://console.firebase.google.com → Create project "social-plus"
 * 2. Build → Firestore Database → Create (Production mode)
 * 3. Authentication → Sign-in method → Enable Email, Google, Apple
 * 4. Project Settings → Your apps → Web → copy config below
 * 5. Authentication → Settings → Authorized domains → add ALL of these:
 *    - localhost
 *    - social-plus-website.onrender.com
 *    - ahmadamdan078-byte.github.io
 *    - your custom domain (e.g. socialplus.ps)
 * 6. Deploy security rules (protects database):
 *    npm install -g firebase-tools
 *    firebase login
 *    firebase use --add   (select your project)
 *    firebase deploy --only firestore:rules
 *    OR paste firestore.rules into Firebase Console → Firestore → Rules
 *
 * VIEW SUBMISSIONS: Firebase Console → Firestore → contact_submissions / audit_submissions
 * VIEW USERS: Firestore → users
 */
window.SP_FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

/** Site locked until sign-in — set false so anyone can browse; Sign In is optional */
window.SP_AUTH_REQUIRED = false;

/** Save form submissions to Firestore (requires auth + rules) */
window.SP_DB_ENABLED = true;
