/**
 * Social Plus — Premium experience layer
 * Theme, loader, scroll progress, magnetic buttons, counters
 */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const STORAGE_KEY = 'sp-theme';

  /* ---- Theme (FOUC handled in head inline script) ---- */
  function getStoredTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) { /* ignore */ }
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  }

  function applyTheme(theme, animate) {
    const root = document.documentElement;
    if (animate && !REDUCED) {
      root.classList.add('theme-transitioning');
      const flash = document.getElementById('theme-flash');
      if (flash) {
        flash.style.opacity = '0.35';
        requestAnimationFrame(() => {
          setTimeout(() => { flash.style.opacity = '0'; }, 80);
        });
      }
      setTimeout(() => root.classList.remove('theme-transitioning'), 560);
    }
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* ignore */ }
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
    window.dispatchEvent(new CustomEvent('sp:themechange', { detail: { theme } }));
  }

  function initTheme() {
    const theme = getStoredTheme();
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    btn?.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      applyTheme(next, true);
    });
    if (btn) {
      btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
      btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
  }

  /* ---- Loader ---- */
  function initLoader() {
    const loader = document.getElementById('sp-loader');
    if (!loader) return;
    const hide = () => {
      loader.classList.add('is-done');
      document.body.classList.add('is-loaded');
    };
    if (document.readyState === 'complete') {
      setTimeout(hide, REDUCED ? 0 : 420);
    } else {
      window.addEventListener('load', () => setTimeout(hide, REDUCED ? 0 : 420), { once: true });
    }
    setTimeout(hide, 2800);
  }

  /* ---- Scroll progress ---- */
  function initScrollProgress() {
    const bar = document.getElementById('scroll-progress');
    if (!bar) return;
    let ticking = false;
    function update() {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const height = doc.scrollHeight - doc.clientHeight;
      const pct = height > 0 ? (scrollTop / height) * 100 : 0;
      bar.style.width = `${pct}%`;
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  /* ---- Magnetic buttons ---- */
  function initMagnetic() {
    if (!FINE || REDUCED) return;
    const strength = 14;
    document.querySelectorAll('.btn--magnetic').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

  /* ---- Animated counters ---- */
  function initCounters() {
    const els = document.querySelectorAll('[data-count]');
    if (!els.length) return;

    const animate = (el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.countSuffix || '';
      const prefix = el.dataset.countPrefix || '';
      const decimals = parseInt(el.dataset.countDecimals || '0', 10);
      if (REDUCED || isNaN(target)) {
        el.textContent = prefix + target + suffix;
        return;
      }
      const duration = 1400;
      const start = performance.now();
      function frame(now) {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = (target * eased).toFixed(decimals);
        el.textContent = prefix + val + suffix;
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    };

    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          o.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    els.forEach((el) => obs.observe(el));
  }

  /* ---- Custom cursor ---- */
  function initCursor() {
    if (!FINE || REDUCED) return;
    if (document.querySelector('.cursor')) return;

    const dot = document.createElement('div');
    dot.className = 'cursor';
    const ring = document.createElement('div');
    ring.className = 'cursor-follower';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add('has-custom-cursor');

    let mx = 0; let my = 0; let rx = 0; let ry = 0;
    document.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.left = `${mx}px`;
      dot.style.top = `${my}px`;
    }, { passive: true });

    function loop() {
      rx += (mx - rx) * 0.15;
      ry += (my - ry) * 0.15;
      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
      requestAnimationFrame(loop);
    }
    loop();

    document.querySelectorAll('a, button, .btn, input, select, textarea, [role="button"]').forEach((el) => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });
    document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
    document.addEventListener('mouseup', () => document.body.classList.remove('cursor-click'));
  }

  /* ---- Boot ---- */
  initTheme();
  initLoader();
  initScrollProgress();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initMagnetic();
      initCounters();
      initCursor();
    });
  } else {
    initMagnetic();
    initCounters();
    initCursor();
  }

  window.SP_EXPERIENCE = { applyTheme, getStoredTheme };
})();
