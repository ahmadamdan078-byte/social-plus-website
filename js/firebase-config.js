/**
 * Firebase configuration — replace with your project keys from:
 * https://console.firebase.google.com → Project Settings → Your apps
 *
 * Enable Authentication providers:
 * - Email/Password
 * - Google
 * - Apple
 *
 * Add authorized domains: localhost, social-plus-website.onrender.com, your custom domain
 */
window.SP_FIREBASE_CONFIG = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID'
};

/** Block site access until valid sign-in when Firebase is configured */
window.SP_AUTH_REQUIRED = true;
