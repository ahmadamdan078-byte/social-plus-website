/**
 * Social Plus — Premium Agency Website
 */

(function () {
  'use strict';

  const WHATSAPP_NUMBER = '970595052784';
  const WHATSAPP_GREETING = "Hello Social Plus! I'd like to learn more about your services.";
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const header = document.getElementById('header');
  const navToggle = document.getElementById('nav-toggle');
  const navEnd = document.getElementById('nav-end');
  const navLinks = document.querySelectorAll('.nav__link');
  const contactForm = document.getElementById('contact-form');
  const auditForm = document.getElementById('audit-form');
  const toast = document.getElementById('toast');
  const langButtons = document.querySelectorAll('.lang-switch__btn');
  const processTrack = document.getElementById('process-track');
  const processProgress = document.getElementById('process-progress');
  const baInput = document.getElementById('ba-input');
  const baBefore = document.getElementById('ba-before');
  const baHandle = document.getElementById('ba-handle');

  let currentLang = localStorage.getItem('sp-lang') || 'en';
  let scrollTicking = false;

  function updateBaSlider(value) {
    if (!baInput) return;
    const pct = `${value}%`;
    const slider = document.getElementById('ba-slider');
    const sliderW = slider ? slider.offsetWidth : 800;
    const isRtl = document.documentElement.dir === 'rtl';

    if (baBefore) baBefore.style.width = pct;
    if (baHandle) {
      baHandle.style.left = isRtl ? 'auto' : pct;
      baHandle.style.right = isRtl ? pct : 'auto';
    }
    baInput.setAttribute('aria-valuenow', value);

    document.querySelectorAll('.ba-slider__before-inner').forEach((inner) => {
      inner.style.width = `${sliderW}px`;
    });
  }

  /* ---- Home on refresh ---- */
  function goToHome(smooth) {
    if (location.hash) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }

  goToHome(false);

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) goToHome(false);
  });

  document.querySelectorAll('a[href="#home"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileNav();
      goToHome(true);
    });
  });

  /* ---- i18n ---- */
  function t(key) {
    return (window.SP_I18N[currentLang] && window.SP_I18N[currentLang][key]) || key;
  }

  let arLoadPromise = null;

  function loadArabicAssets() {
    if (!arLoadPromise) {
      arLoadPromise = new Promise((resolve) => {
        if (window.SP_I18N?.ar) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.src = 'js/i18n-ar.js?v=26';
        s.onload = () => resolve();
        s.onerror = () => resolve();
        document.head.appendChild(s);
      }).then(() => {
        if (!document.getElementById('sp-ar-font')) {
          const link = document.createElement('link');
          link.id = 'sp-ar-font';
          link.rel = 'stylesheet';
          link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap';
          document.head.appendChild(link);
        }
      });
    }
    return arLoadPromise;
  }

  function applyLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('sp-lang', lang);

    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = t(key);
      if (text && el.childElementCount === 0) {
        el.textContent = text;
      } else if (text && el.tagName === 'OPTION') {
        el.textContent = text;
      }
    });

    const selectPlaceholder = contactForm && contactForm.querySelector('option[value=""]');
    if (selectPlaceholder) {
      selectPlaceholder.textContent = t('contact.select');
    }

    langButtons.forEach(btn => {
      const isActive = btn.dataset.lang === lang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive);
    });

    document.title = lang === 'ar'
      ? 'Social Plus | وكالة السوشial ميديا والنمو الرقمي'
      : 'Social Plus | Social Media & Digital Growth Agency';

    window.dispatchEvent(new CustomEvent('sp:langchange', { detail: { lang } }));

    if (baInput) updateBaSlider(baInput.value);
  }

  async function setLanguage(lang) {
    if (lang === 'ar') await loadArabicAssets();
    if (!window.SP_I18N[lang]) return;
    applyLanguage(lang);
  }

  langButtons.forEach(btn => {
    btn.addEventListener('click', () => { setLanguage(btn.dataset.lang); });
  });

  if (currentLang === 'ar') {
    loadArabicAssets().then(() => applyLanguage('ar'));
  } else {
    applyLanguage(currentLang);
  }

  window.addEventListener('sp:toast', (e) => {
    if (e.detail && e.detail.message) showToast(e.detail.message);
  });

  /* ---- Sticky header + active nav ---- */
  const sections = document.querySelectorAll('section[id]');

  function updateActiveNav() {
    if (!navLinks.length) return;
    const scrollPos = window.scrollY + 120;
    let currentId = 'home';

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = id;
      }
    });

    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${currentId}`);
    });
  }

  function onScroll() {
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 20);
    }
    updateActiveNav();
    updateProcessProgress();
  }

  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      onScroll();
      scrollTicking = false;
    });
  }, { passive: true });

  onScroll();

  /* ---- Mobile nav ---- */
  function closeMobileNav() {
    if (navEnd) navEnd.classList.remove('is-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  window.SP_NAV = { close: closeMobileNav };

  if (navToggle && navEnd) {
    navToggle.addEventListener('click', () => {
      const isOpen = navEnd.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
  }

  navLinks.forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  /* ---- Method scroll progress ---- */
  function updateProcessProgress() {
    if (!processTrack || !processProgress || REDUCED_MOTION) return;

    const rect = processTrack.getBoundingClientRect();
    const viewH = window.innerHeight;
    const start = viewH * 0.85;
    const end = viewH * 0.25;
    const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end + rect.height * 0.5)));

    processProgress.style.transform = `scaleX(${progress})`;
  }

  /* ---- Scroll reveal (single pass, no DOM duplication) ---- */
  if (!REDUCED_MOTION && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.section__header, .service-card, .process-card, .portfolio-card, .benefit-card, .pricing-card, .audit__card, .instagram__card, .stat-strip__item, .hero-metric, .ba-slider').forEach(el => {
      el.classList.add('reveal');
      revealObserver.observe(el);
    });
  }

  /* ---- Toast ---- */
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.hidden = true; }, 300);
    }, 3500);
  }

  /* ---- Form validation ---- */
  function validateField(field) {
    const group = field.closest('.form-group');
    if (!group) return true;

    let valid = true;
    let message = t('error.required');

    group.classList.remove('error');
    const existing = group.querySelector('.error-msg');
    if (existing) existing.remove();

    if (field.required && !field.value.trim()) {
      valid = false;
    } else if (field.type === 'email' && field.value.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(field.value.trim())) {
        valid = false;
        message = t('error.email');
      }
    }

    if (!valid) {
      group.classList.add('error');
      const errorEl = document.createElement('span');
      errorEl.className = 'error-msg';
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = message;
      group.appendChild(errorEl);
    }

    return valid;
  }

  function bindFormValidation(form) {
    if (!form) return;
    form.querySelectorAll('input, select, textarea').forEach(field => {
      field.addEventListener('blur', () => {
        if (field.value.trim() || field.required) validateField(field);
      });
    });
  }

  function openWhatsApp(message) {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function submitOrder(order) {
    try {
      const res = await fetch(window.spApi('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      if (res.ok && window.SP_trackConversion) {
        window.SP_trackConversion({ type: order.service_name || 'contact' });
      }
    } catch {
      /* API unavailable on static-only hosting */
    }
  }

  /* ---- Contact form ---- */
  if (contactForm) {
    bindFormValidation(contactForm);

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (window.SP_SECURITY && window.SP_SECURITY.requireAuthForForms() && !window.SP_SECURITY.isAuthenticated()) {
        showToast(window.SP_SECURITY.authRequiredMessage());
        document.getElementById('nav-auth-btn')?.click();
        return;
      }

      const fields = contactForm.querySelectorAll('input, select, textarea');
      let isValid = true;
      fields.forEach(field => { if (!validateField(field)) isValid = false; });
      if (!isValid) return;

      const data = Object.fromEntries(new FormData(contactForm).entries());
      const serviceSelect = contactForm.querySelector('#service');
      const serviceLabel = serviceSelect.options[serviceSelect.selectedIndex].text;

      const payload = {
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone ? data.phone.trim() : '',
        service: serviceLabel,
        message: data.message.trim()
      };

      if (window.SP_DB && window.SP_DB.isReady() && window.SP_SECURITY && window.SP_SECURITY.isAuthenticated()) {
        try {
          await window.SP_DB.saveContact(payload);
        } catch (err) {
          console.warn('Database save skipped:', err);
        }
      }

      const lines = [
        'New message from Social Plus website',
        '',
        `Name: ${payload.name}`,
        `Phone: ${payload.phone || 'Not provided'}`,
        `Email: ${payload.email}`,
        `Service: ${payload.service}`,
        '',
        'Message:',
        payload.message
      ];

      submitOrder({
        customer_name: payload.name,
        customer_email: payload.email,
        customer_phone: payload.phone,
        service_name: payload.service,
        notes: payload.message,
        status: 'pending'
      });

      contactForm.reset();
      showToast(t('toast.contact'));
      openWhatsApp(lines.join('\n'));
    });
  }

  /* ---- Audit form ---- */
  if (auditForm) {
    bindFormValidation(auditForm);
    const auditSuccess = document.getElementById('audit-success');

    auditForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (window.SP_SECURITY && window.SP_SECURITY.requireAuthForForms() && !window.SP_SECURITY.isAuthenticated()) {
        showToast(window.SP_SECURITY.authRequiredMessage());
        document.getElementById('nav-auth-btn')?.click();
        return;
      }

      const fields = auditForm.querySelectorAll('input, select, textarea');
      let isValid = true;
      fields.forEach(field => { if (!validateField(field)) isValid = false; });
      if (!isValid) return;

      const data = Object.fromEntries(new FormData(auditForm).entries());

      const payload = {
        name: data.name.trim(),
        username: data.username.trim(),
        whatsapp: data.whatsapp.trim(),
        business: data.business.trim()
      };

      if (window.SP_DB && window.SP_DB.isReady() && window.SP_SECURITY && window.SP_SECURITY.isAuthenticated()) {
        try {
          await window.SP_DB.saveAudit(payload);
        } catch (err) {
          console.warn('Database save skipped:', err);
        }
      }

      const lines = [
        'Free Instagram Audit Request — Social Plus',
        '',
        `Name: ${payload.name}`,
        `Instagram: ${payload.username}`,
        `WhatsApp: ${payload.whatsapp}`,
        `Business: ${payload.business}`
      ];

      submitOrder({
        customer_name: payload.name,
        customer_phone: payload.whatsapp,
        service_name: 'Free Instagram Audit',
        notes: `Instagram: ${payload.username}, Business: ${payload.business}`,
        status: 'pending'
      });

      auditForm.reset();
      if (auditSuccess) auditSuccess.hidden = false;
      openWhatsApp(lines.join('\n'));
    });
  }

  /* ---- Before / After slider ---- */
  if (baInput) {
    baInput.addEventListener('input', () => updateBaSlider(baInput.value));
    updateBaSlider(baInput.value);
    window.addEventListener('resize', () => updateBaSlider(baInput.value), { passive: true });
  }

  /* ---- Portfolio filters ---- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const portfolioCards = document.querySelectorAll('.portfolio-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterBtns.forEach(b => {
        const active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', active);
      });

      portfolioCards.forEach(card => {
        const category = card.dataset.category;
        const show = filter === 'all' || category === filter;
        card.classList.toggle('is-hidden', !show);
      });
    });
  });

  ['nav-auth-btn', 'nav-account-mobile', 'social-ai-toggle'].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('pointerenter', () => {
      if (window.SP_loadExtras) window.SP_loadExtras();
    }, { once: true });
  });

})();
