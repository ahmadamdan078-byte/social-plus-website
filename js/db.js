/**
 * Social Plus — Secure Firestore database layer
 */
(function () {
  'use strict';

  let db = null;

  function isConfigured() {
    return window.SP_AUTH && window.SP_AUTH.isConfigured && window.SP_AUTH.isConfigured();
  }

  function getDb() {
    if (!isConfigured() || typeof window.firebase === 'undefined') return null;
    if (!db && window.firebase.apps.length) {
      db = window.firebase.firestore();
    }
    return db;
  }

  /** Strip HTML and trim; limit length */
  function sanitize(value, maxLen) {
    if (value == null) return '';
    return String(value)
      .replace(/<[^>]*>/g, '')
      .replace(/[<>"'`]/g, '')
      .trim()
      .slice(0, maxLen);
  }

  function serverTimestamp() {
    return window.firebase.firestore.FieldValue.serverTimestamp();
  }

  async function ensureUserProfile(user) {
    const firestore = getDb();
    if (!firestore || !user) return;

    const lang = localStorage.getItem('sp-lang') || 'en';
    const ref = firestore.collection('users').doc(user.uid);
    const snap = await ref.get();

    const provider = user.providerData && user.providerData[0]
      ? user.providerData[0].providerId
      : 'password';

    if (!snap.exists) {
      await ref.set({
        email: sanitize(user.email, 254),
        displayName: sanitize(user.displayName || '', 100),
        provider: sanitize(provider, 32),
        lang: lang === 'ar' ? 'ar' : 'en',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
    } else {
      await ref.update({
        lastLoginAt: serverTimestamp(),
        lang: lang === 'ar' ? 'ar' : 'en'
      });
    }
  }

  async function saveContact(data) {
    if (window.SP_DB_ENABLED === false) return;
    const firestore = getDb();
    const user = window.SP_AUTH && window.SP_AUTH.getUser();
    if (!firestore || !user) throw new Error('NOT_AUTHENTICATED');

    await firestore.collection('contact_submissions').add({
      uid: user.uid,
      name: sanitize(data.name, 100),
      email: sanitize(data.email, 254),
      phone: sanitize(data.phone || '', 30),
      service: sanitize(data.service, 80),
      message: sanitize(data.message, 2000),
      createdAt: serverTimestamp()
    });
  }

  async function saveAudit(data) {
    if (window.SP_DB_ENABLED === false) return;
    const firestore = getDb();
    const user = window.SP_AUTH && window.SP_AUTH.getUser();
    if (!firestore || !user) throw new Error('NOT_AUTHENTICATED');

    await firestore.collection('audit_submissions').add({
      uid: user.uid,
      name: sanitize(data.name, 100),
      username: sanitize(data.username, 50).replace(/^@+/, '@'),
      whatsapp: sanitize(data.whatsapp, 30),
      business: sanitize(data.business, 80),
      createdAt: serverTimestamp()
    });
  }

  window.SP_DB = {
    init: getDb,
    sanitize,
    ensureUserProfile,
    saveContact,
    saveAudit,
    isReady: () => !!getDb()
  };
})();
