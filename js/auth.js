/**
 * Social Plus — Authentication (Firebase)
 * Google · Apple · Email/Password with access gate
 */
(function () {
  'use strict';

  const config = window.SP_FIREBASE_CONFIG || {};
  const AUTH_REQUIRED = window.SP_AUTH_REQUIRED !== false;

  function isConfigured() {
    return !!(config.apiKey && config.apiKey !== 'YOUR_API_KEY' && config.projectId && config.projectId !== 'YOUR_PROJECT_ID');
  }

  const gate = document.getElementById('auth-gate');
  const siteShell = document.getElementById('site-shell');
  const authError = document.getElementById('auth-error');
  const authForm = document.getElementById('auth-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authConfirm = document.getElementById('auth-confirm');
  const authConfirmGroup = document.getElementById('auth-confirm-group');
  const authSubmit = document.getElementById('auth-submit');
  const authTabs = document.querySelectorAll('[data-auth-tab]');
  const navAuthBtn = document.getElementById('nav-auth-btn');
  const navUser = document.getElementById('nav-user');
  const navUserEmail = document.getElementById('nav-user-email');
  const navSignOut = document.getElementById('nav-signout');

  let mode = 'signin';
  let auth = null;
  let firebaseReady = false;

  function t(key) {
    const lang = localStorage.getItem('sp-lang') || 'en';
    return (window.SP_I18N && window.SP_I18N[lang] && window.SP_I18N[lang][key]) || key;
  }

  function showError(message) {
    if (!authError) return;
    authError.textContent = message;
    authError.hidden = false;
  }

  function clearError() {
    if (authError) {
      authError.hidden = true;
      authError.textContent = '';
    }
  }

  function lockSite() {
    document.body.classList.add('is-locked');
    document.body.classList.remove('is-authenticated');
    if (gate) {
      gate.hidden = false;
      gate.setAttribute('aria-hidden', 'false');
    }
    updateNav(null);
  }

  function unlockSite(user) {
    document.body.classList.remove('is-locked');
    document.body.classList.add('is-authenticated');
    if (gate) {
      gate.hidden = true;
      gate.setAttribute('aria-hidden', 'true');
    }
    updateNav(user);
    document.body.style.overflow = '';
  }

  function updateNav(user) {
    if (navAuthBtn) navAuthBtn.hidden = !!user;
    if (navUser) navUser.hidden = !user;
    if (navUserEmail && user) {
      navUserEmail.textContent = user.displayName || user.email || 'Member';
      navUserEmail.title = user.email || '';
    }
  }

  function setMode(next) {
    mode = next;
    clearError();
    authTabs.forEach(tab => {
      const active = tab.dataset.authTab === next;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active);
    });
    if (authConfirmGroup) authConfirmGroup.hidden = next !== 'signup';
    if (authSubmit) authSubmit.textContent = t(next === 'signup' ? 'auth.signup.submit' : 'auth.signin.submit');
    if (authPassword) authPassword.autocomplete = next === 'signup' ? 'new-password' : 'current-password';
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validatePassword(password, isSignup) {
    if (!password || password.length < 8) {
      return t('auth.error.passwordLength');
    }
    if (isSignup) {
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return t('auth.error.passwordWeak');
      }
    }
    return null;
  }

  function validateForm() {
    clearError();
    const email = authEmail ? authEmail.value.trim() : '';
    const password = authPassword ? authPassword.value : '';
    const confirm = authConfirm ? authConfirm.value : '';

    if (!email) {
      showError(t('auth.error.emailRequired'));
      authEmail?.focus();
      return false;
    }
    if (!validateEmail(email)) {
      showError(t('auth.error.emailInvalid'));
      authEmail?.focus();
      return false;
    }

    const passErr = validatePassword(password, mode === 'signup');
    if (passErr) {
      showError(passErr);
      authPassword?.focus();
      return false;
    }

    if (mode === 'signup') {
      if (password !== confirm) {
        showError(t('auth.error.passwordMatch'));
        authConfirm?.focus();
        return false;
      }
    }

    return true;
  }

  function mapFirebaseError(code) {
    const map = {
      'auth/invalid-email': 'auth.error.emailInvalid',
      'auth/user-disabled': 'auth.error.userDisabled',
      'auth/user-not-found': 'auth.error.invalidCredentials',
      'auth/wrong-password': 'auth.error.invalidCredentials',
      'auth/invalid-credential': 'auth.error.invalidCredentials',
      'auth/email-already-in-use': 'auth.error.emailInUse',
      'auth/weak-password': 'auth.error.passwordWeak',
      'auth/popup-closed-by-user': 'auth.error.popupClosed',
      'auth/cancelled-popup-request': 'auth.error.popupClosed',
      'auth/account-exists-with-different-credential': 'auth.error.accountExists',
      'auth/operation-not-allowed': 'auth.error.providerDisabled',
      'auth/network-request-failed': 'auth.error.network'
    };
    return t(map[code] || 'auth.error.generic');
  }

  function setLoading(loading) {
    if (authSubmit) authSubmit.disabled = loading;
    document.querySelectorAll('.auth-oauth-btn, [data-auth-tab]').forEach(el => {
      el.disabled = loading;
    });
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    if (!firebaseReady || !auth) {
      showError(t('auth.error.notConfigured'));
      return;
    }
    if (!validateForm()) return;

    setLoading(true);
    clearError();

    const email = authEmail.value.trim();
    const password = authPassword.value;

    try {
      if (mode === 'signup') {
        await auth.createUserWithEmailAndPassword(email, password);
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
    } catch (err) {
      showError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  }

  function useRedirect() {
    return window.innerWidth < 768 || /iPhone|iPad|Android/i.test(navigator.userAgent);
  }

  async function signInWithProvider(providerId) {
    if (!firebaseReady || !auth) {
      showError(t('auth.error.notConfigured'));
      return;
    }

    setLoading(true);
    clearError();

    const firebase = window.firebase;
    let provider;

    if (providerId === 'google') {
      provider = new firebase.auth.GoogleAuthProvider();
    } else if (providerId === 'apple') {
      provider = new firebase.auth.OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
    } else {
      setLoading(false);
      return;
    }

    try {
      if (useRedirect()) {
        await auth.signInWithRedirect(provider);
      } else {
        await auth.signInWithPopup(provider);
      }
    } catch (err) {
      showError(mapFirebaseError(err.code));
      setLoading(false);
    }
  }

  async function signOut() {
    if (auth) {
      try {
        await auth.signOut();
      } catch (err) {
        showError(mapFirebaseError(err.code));
      }
    }
    if (AUTH_REQUIRED && isConfigured()) lockSite();
  }

  function initFirebase() {
    if (!isConfigured()) {
      if (gate) gate.hidden = true;
      document.body.classList.remove('is-locked');
      if (navAuthBtn) navAuthBtn.hidden = true;
      return;
    }

    if (typeof window.firebase === 'undefined') {
      console.error('Firebase SDK not loaded');
      return;
    }

    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(config);
    }

    auth = window.firebase.auth();
    firebaseReady = true;

    auth.getRedirectResult().catch(err => {
      if (err.code !== 'auth/no-auth-event') showError(mapFirebaseError(err.code));
    }).finally(() => setLoading(false));

    auth.onAuthStateChanged(user => {
      if (user) {
        unlockSite(user);
      } else if (AUTH_REQUIRED) {
        lockSite();
      } else {
        unlockSite(null);
      }
    });
  }

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.authTab));
  });

  if (authForm) authForm.addEventListener('submit', handleEmailAuth);

  document.getElementById('auth-google')?.addEventListener('click', () => signInWithProvider('google'));
  document.getElementById('auth-apple')?.addEventListener('click', () => signInWithProvider('apple'));
  navAuthBtn?.addEventListener('click', () => {
    if (gate) {
      gate.hidden = false;
      gate.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-locked');
      authEmail?.focus();
    }
  });
  navSignOut?.addEventListener('click', signOut);

  window.SP_AUTH = {
    signOut,
    isConfigured,
    getUser: () => (auth ? auth.currentUser : null)
  };

  setMode('signin');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFirebase);
  } else {
    initFirebase();
  }

  window.addEventListener('sp:langchange', () => setMode(mode));
})();
