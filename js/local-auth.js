/**
 * Social Plus — Local auth (works without Firebase)
 * Used when Firebase is not configured. Sessions stored in this browser only.
 */
(function () {
  'use strict';

  const SESSION_KEY = 'sp_session';
  const USERS_KEY = 'sp_local_users';

  let currentUser = null;
  const listeners = [];

  function readUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
    } catch (err) {
      return {};
    }
  }

  function writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (err) {
      return null;
    }
  }

  function writeSession(user) {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }

  async function hashPassword(email, password) {
    const raw = `${email.toLowerCase()}:${password}`;
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return btoa(raw);
  }

  function makeUser(email, displayName, provider) {
    const cleanEmail = String(email).trim().toLowerCase();
    const name = displayName || cleanEmail.split('@')[0] || 'Member';
    return {
      uid: `local_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`,
      email: cleanEmail,
      displayName: name,
      providerData: [{ providerId: provider }]
    };
  }

  function setUser(user) {
    currentUser = user;
    writeSession(user);
    listeners.forEach(fn => fn(user));
    return user;
  }

  function signInOAuth(email, displayName, provider) {
    const user = makeUser(email, displayName, provider);
    return setUser(user);
  }

  async function signUpEmail(email, password) {
    const users = readUsers();
    const key = email.trim().toLowerCase();
    if (users[key]) throw new Error('auth/email-already-in-use');
    users[key] = {
      hash: await hashPassword(key, password),
      provider: 'password'
    };
    writeUsers(users);
    return setUser(makeUser(key, key.split('@')[0], 'password'));
  }

  async function signInEmail(email, password) {
    const key = email.trim().toLowerCase();
    const users = readUsers();
    const record = users[key];
    if (!record) throw new Error('auth/user-not-found');
    const hash = await hashPassword(key, password);
    if (record.hash !== hash) throw new Error('auth/wrong-password');
    return setUser(makeUser(key, key.split('@')[0], 'password'));
  }

  function signOut() {
    currentUser = null;
    writeSession(null);
    listeners.forEach(fn => fn(null));
  }

  function init() {
    currentUser = readSession();
    return currentUser;
  }

  function onChange(fn) {
    listeners.push(fn);
    return () => {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  window.SP_LOCAL_AUTH = {
    init,
    getUser: () => currentUser,
    signInOAuth,
    signUpEmail,
    signInEmail,
    signOut,
    onChange
  };
})();
