/**
 * Social Plus — Authentication
 * Firebase when configured · Local auth fallback (no setup required)
 */
(function () {
  'use strict';

  const config = window.SP_FIREBASE_CONFIG || {};
  const AUTH_REQUIRED = window.SP_AUTH_REQUIRED === true;
  const useLocalAuth = !(config.apiKey && config.apiKey !== 'YOUR_API_KEY' && config.projectId && config.projectId !== 'YOUR_PROJECT_ID');

  function isConfigured() {
    return !useLocalAuth;
  }

  const gate = document.getElementById('auth-gate');
  const authMain = document.getElementById('auth-main');
  const authOauthPanel = document.getElementById('auth-oauth-panel');
  const authOauthTitle = document.getElementById('auth-oauth-panel-title');
  const authOauthEmail = document.getElementById('auth-oauth-email');
  const authOauthName = document.getElementById('auth-oauth-name');
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
  const navUserAvatar = document.getElementById('nav-user-avatar');
  const navSignOut = document.getElementById('nav-signout');
  const navAccountMobile = document.getElementById('nav-account-mobile');

  let mode = 'signin';
  let auth = null;
  let firebaseReady = false;
  let initPromise = null;
  let oauthProvider = 'google.com';

  function t(key) {
    const lang = localStorage.getItem('sp-lang') || 'en';
    return (window.SP_I18N && window.SP_I18N[lang] && window.SP_I18N[lang][key]) || key;
  }

  function getCurrentUser() {
    if (useLocalAuth && window.SP_LOCAL_AUTH) return window.SP_LOCAL_AUTH.getUser();
    return auth ? auth.currentUser : null;
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
    if (user) document.body.classList.add('is-authenticated');
    else document.body.classList.remove('is-authenticated');
    if (gate) {
      gate.hidden = true;
      gate.setAttribute('aria-hidden', 'true');
    }
    updateNav(user);
    document.body.style.overflow = '';
    hideOauthPanel();
  }

  function openAuthModal() {
    if (!gate) return;
    gate.hidden = false;
    gate.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    clearError();
    hideOauthPanel();
    authEmail?.focus();
    if (!useLocalAuth) ensureFirebaseReady();
  }

  function closeAuthModal() {
    if (!gate) return;
    gate.hidden = true;
    gate.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    clearError();
    hideOauthPanel();
  }

  function showOauthPanel(providerId) {
    oauthProvider = providerId === 'apple' ? 'apple.com' : 'google.com';
    if (authMain) authMain.hidden = true;
    if (authOauthPanel) authOauthPanel.hidden = false;
    if (authOauthTitle) {
      authOauthTitle.textContent = t(providerId === 'apple' ? 'auth.apple.prompt' : 'auth.google.prompt');
    }
    if (authOauthEmail) authOauthEmail.value = authEmail?.value.trim() || '';
    if (authOauthName) authOauthName.value = '';
    clearError();
    authOauthEmail?.focus();
  }

  function hideOauthPanel() {
    if (authMain) authMain.hidden = false;
    if (authOauthPanel) authOauthPanel.hidden = true;
  }

  function userInitial(user) {
    if (!user) return 'SP';
    const name = user.displayName || user.email || '';
    const letter = name.replace(/^[^a-zA-Z0-9]*@?/, '').charAt(0);
    return (letter || 'U').toUpperCase();
  }

  function updateNav(user) {
    const signedIn = !!user;
    if (navAuthBtn) {
      navAuthBtn.hidden = signedIn;
      navAuthBtn.style.display = signedIn ? 'none' : '';
    }
    if (navUser) {
      navUser.hidden = !signedIn;
      navUser.style.display = signedIn ? '' : 'none';
    }
    if (navAccountMobile) {
      navAccountMobile.classList.toggle('is-signed-in', signedIn);
      navAccountMobile.setAttribute('aria-label', signedIn ? t('auth.signout') : t('auth.signin.nav'));
    }
    if (navUserEmail && user) {
      navUserEmail.textContent = user.displayName || user.email || 'Member';
      navUserEmail.title = user.email || '';
    } else if (navUserEmail) {
      navUserEmail.textContent = '';
      navUserEmail.title = '';
    }
    if (navUserAvatar) navUserAvatar.textContent = userInitial(user);
  }

  function handleAccountAction() {
    if (getCurrentUser()) signOut();
    else {
      window.SP_NAV?.close?.();
      openAuthModal();
    }
  }

  function notify(message) {
    window.dispatchEvent(new CustomEvent('sp:toast', { detail: { message } }));
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
    if (!password || password.length < 8) return t('auth.error.passwordLength');
    if (isSignup && (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) {
      return t('auth.error.passwordWeak');
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
    if (mode === 'signup' && password !== confirm) {
      showError(t('auth.error.passwordMatch'));
      authConfirm?.focus();
      return false;
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
      'auth/unauthorized-domain': 'auth.error.unauthorizedDomain',
      'auth/network-request-failed': 'auth.error.network'
    };
    return t(map[code] || 'auth.error.generic');
  }

  function setLoading(loading) {
    if (authSubmit) authSubmit.disabled = loading;
    document.querySelectorAll('.auth-oauth-btn, [data-auth-tab], #auth-oauth-continue').forEach(el => {
      el.disabled = loading;
    });
  }

  async function handleLocalEmailAuth() {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    try {
      if (mode === 'signup') await window.SP_LOCAL_AUTH.signUpEmail(email, password);
      else await window.SP_LOCAL_AUTH.signInEmail(email, password);
      unlockSite(getCurrentUser());
      closeAuthModal();
      notify(t('auth.signin.success'));
    } catch (err) {
      showError(mapFirebaseError(err.message || err.code));
    }
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    clearError();

    if (useLocalAuth) {
      await handleLocalEmailAuth();
      setLoading(false);
      return;
    }

    if (!(await ensureFirebaseReady())) {
      setLoading(false);
      return;
    }

    const email = authEmail.value.trim();
    const password = authPassword.value;

    try {
      if (mode === 'signup') await auth.createUserWithEmailAndPassword(email, password);
      else await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      showError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleLocalOauthContinue() {
    const email = authOauthEmail?.value.trim() || '';
    const name = authOauthName?.value.trim() || '';
    if (!email) {
      showError(t('auth.error.emailRequired'));
      authOauthEmail?.focus();
      return;
    }
    if (!validateEmail(email)) {
      showError(t('auth.error.emailInvalid'));
      authOauthEmail?.focus();
      return;
    }
    setLoading(true);
    clearError();
    try {
      window.SP_LOCAL_AUTH.signInOAuth(email, name, oauthProvider);
      unlockSite(getCurrentUser());
      closeAuthModal();
      notify(t('auth.signin.success'));
    } catch (err) {
      showError(t('auth.error.generic'));
    } finally {
      setLoading(false);
    }
  }

  function useRedirect() {
    return window.innerWidth < 768 || /iPhone|iPad|Android/i.test(navigator.userAgent);
  }

  async function signInWithProvider(providerId) {
    if (useLocalAuth) {
      showOauthPanel(providerId);
      return;
    }

    if (!(await ensureFirebaseReady())) return;

    setLoading(true);
    clearError();

    const firebase = window.firebase;
    let provider;

    if (providerId === 'google') {
      provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });
    } else if (providerId === 'apple') {
      provider = new firebase.auth.OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
    } else {
      setLoading(false);
      return;
    }

    try {
      if (useRedirect()) await auth.signInWithRedirect(provider);
      else await auth.signInWithPopup(provider);
    } catch (err) {
      showError(mapFirebaseError(err.code));
      setLoading(false);
    }
  }

  async function signOut(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    window.SP_NAV?.close?.();

    if (useLocalAuth && window.SP_LOCAL_AUTH) {
      window.SP_LOCAL_AUTH.signOut();
      unlockSite(null);
      closeAuthModal();
      notify(t('auth.signout.success'));
      return;
    }

    if (!auth || !firebaseReady) {
      unlockSite(null);
      closeAuthModal();
      notify(t('auth.signout.success'));
      return;
    }

    try {
      await auth.signOut();
      unlockSite(null);
      closeAuthModal();
      notify(t('auth.signout.success'));
    } catch (err) {
      notify(mapFirebaseError(err.code));
    }
  }

  function loadFirebaseSdk() {
    if (typeof window.firebase !== 'undefined') return Promise.resolve();

    const urls = [
      'https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth-compat.js',
      'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore-compat.js'
    ];

    return urls.reduce((chain, src) => chain.then(() => new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Firebase SDK failed to load'));
      document.head.appendChild(script);
    })), Promise.resolve());
  }

  async function ensureFirebaseReady() {
    if (useLocalAuth) return true;
    if (firebaseReady && auth) return true;

    try {
      await initFirebase();
    } catch (err) {
      console.error('Firebase init failed:', err);
      showError(t('auth.error.generic'));
      return false;
    }

    return !!(firebaseReady && auth);
  }

  async function initFirebase() {
    if (useLocalAuth) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      if (navAuthBtn) {
        navAuthBtn.hidden = false;
        navAuthBtn.style.display = '';
      }

      try {
        await loadFirebaseSdk();
      } catch (err) {
        console.error('Firebase SDK not loaded', err);
        throw err;
      }

      if (typeof window.firebase === 'undefined') return;

      if (!window.firebase.apps.length) window.firebase.initializeApp(config);

      auth = window.firebase.auth();
      firebaseReady = true;

      if (window.SP_DB) window.SP_DB.init();

      auth.getRedirectResult().catch(err => {
        if (err.code !== 'auth/no-auth-event') showError(mapFirebaseError(err.code));
      }).finally(() => setLoading(false));

      auth.onAuthStateChanged(async user => {
        if (user) {
          if (window.SP_DB?.ensureUserProfile) {
            try { await window.SP_DB.ensureUserProfile(user); } catch (err) { console.error(err); }
          }
          unlockSite(user);
        } else if (AUTH_REQUIRED) lockSite();
        else unlockSite(null);
      });
    })();

    return initPromise;
  }

  function initLocalAuth() {
    if (!window.SP_LOCAL_AUTH) return;
    const user = window.SP_LOCAL_AUTH.init();
    if (navAuthBtn) {
      navAuthBtn.hidden = !!user;
      navAuthBtn.style.display = user ? 'none' : '';
    }
    window.SP_LOCAL_AUTH.onChange(u => updateNav(u));
    if (user) unlockSite(user);
    else if (AUTH_REQUIRED) lockSite();
    else updateNav(null);
  }

  authTabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.authTab)));
  if (authForm) authForm.addEventListener('submit', handleEmailAuth);

  document.getElementById('auth-google')?.addEventListener('click', () => signInWithProvider('google'));
  document.getElementById('auth-apple')?.addEventListener('click', () => signInWithProvider('apple'));
  document.getElementById('auth-oauth-continue')?.addEventListener('click', handleLocalOauthContinue);
  document.getElementById('auth-oauth-back')?.addEventListener('click', hideOauthPanel);

  navAuthBtn?.addEventListener('click', openAuthModal);
  navAccountMobile?.addEventListener('click', handleAccountAction);
  document.getElementById('auth-close')?.addEventListener('click', closeAuthModal);
  gate?.addEventListener('click', (e) => {
    if (e.target === gate && !AUTH_REQUIRED) closeAuthModal();
  });
  navSignOut?.addEventListener('click', (e) => signOut(e));

  window.SP_AUTH = {
    signOut,
    isConfigured,
    useLocalAuth: () => useLocalAuth,
    getUser: getCurrentUser,
    openAuthModal,
    closeAuthModal
  };

  setMode('signin');
  updateNav(null);

  function bootAuth() {
    if (useLocalAuth) initLocalAuth();
    else if ('requestIdleCallback' in window) requestIdleCallback(() => initFirebase(), { timeout: 2500 });
    else initFirebase();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootAuth);
  else bootAuth();

  window.addEventListener('sp:langchange', () => setMode(mode));
})();
