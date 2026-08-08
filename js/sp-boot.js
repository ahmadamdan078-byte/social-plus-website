(function () {
  'use strict';

  var V = '26';
  var queue = [
    'js/admin-config.js',
    'js/firebase-config.js',
    'js/security.js',
    'js/db.js',
    'js/local-auth.js',
    'js/auth.js',
    'js/admin.js',
    'js/social-ai-config.js',
    'js/social-ai.js'
  ];

  function loadNext(i) {
    if (i >= queue.length) return;
    var s = document.createElement('script');
    s.src = queue[i] + '?v=' + V;
    s.async = true;
    s.onload = function () { loadNext(i + 1); };
    s.onerror = function () { loadNext(i + 1); };
    document.body.appendChild(s);
  }

  function boot() {
    window.SP_loadExtras = boot;
    loadNext(0);
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(boot, { timeout: 2000 });
  } else {
    window.addEventListener('load', function () { setTimeout(boot, 150); });
  }
})();
