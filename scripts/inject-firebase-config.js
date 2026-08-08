#!/usr/bin/env node
/**
 * Writes js/firebase-config.js from environment variables (Render deploy).
 * Set in Render Dashboard → Environment:
 *   FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
 *   FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID
 */
const fs = require('fs');
const path = require('path');

const cfg = {
  apiKey: process.env.FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'YOUR_PROJECT.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'YOUR_PROJECT.appspot.com',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: process.env.FIREBASE_APP_ID || 'YOUR_APP_ID'
};

const out = `/**
 * Firebase config — auto-generated at deploy from Render environment variables.
 * Local dev: paste keys here or run with env vars set.
 */
window.SP_FIREBASE_CONFIG = ${JSON.stringify(cfg, null, 2)};

window.SP_AUTH_REQUIRED = false;
window.SP_DB_ENABLED = true;
`;

const target = path.join(__dirname, '..', 'js', 'firebase-config.js');
fs.writeFileSync(target, out, 'utf8');

const ready = cfg.apiKey !== 'YOUR_API_KEY' && cfg.projectId !== 'YOUR_PROJECT_ID';
console.log(ready ? 'Firebase config injected from environment.' : 'Firebase placeholders — set Render env vars for Google sign-in.');
