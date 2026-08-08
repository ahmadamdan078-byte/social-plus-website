(function () {
  'use strict';

  var meta = document.querySelector('meta[name="sp-api-base"]');
  var configured = meta && meta.getAttribute('content');
  var base = configured != null ? configured.trim() : '';

  if (!base && /github\.io$/i.test(location.hostname)) {
    base = '';
  }

  window.SP_API_BASE = base;

  window.spApi = function (path) {
    var p = path.charAt(0) === '/' ? path : '/' + path;
    return (window.SP_API_BASE || '') + p;
  };
})();
