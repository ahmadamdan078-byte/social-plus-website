/**
 * Social Plus — Client-side security helpers
 * Note: real protection is enforced by Firebase Auth + Firestore rules
 */
(function () {
  'use strict';

  function requireAuthForForms() {
    if (!window.SP_AUTH || !window.SP_AUTH.isConfigured()) return false;
    return true;
  }

  function isAuthenticated() {
    return !!(window.SP_AUTH && window.SP_AUTH.getUser());
  }

  function authRequiredMessage() {
    const lang = localStorage.getItem('sp-lang') || 'en';
    const key = 'auth.error.loginRequired';
    return (window.SP_I18N && window.SP_I18N[lang] && window.SP_I18N[lang][key]) || key;
  }

  window.SP_SECURITY = {
    requireAuthForForms,
    isAuthenticated,
    authRequiredMessage
  };
})();
