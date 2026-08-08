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

    document.querySelectorAll('.ba-slider__panel--before').forEach(panel => {
      panel.style.width = `${sliderW}px`;
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

  function setLanguage(lang) {
    if (!window.SP_I18N[lang]) return;
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

  langButtons.forEach(btn => {
    btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
  });

  setLanguage(currentLang);

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

  /* ---- Custom cursor (desktop only) ---- */
  if (FINE_POINTER && !REDUCED_MOTION) {
    const cursor = document.getElementById('cursor');
    const follower = document.getElementById('cursor-follower');

    if (cursor && follower) {
      document.body.classList.add('has-custom-cursor');
      let mx = 0;
      let my = 0;
      let fx = 0;
      let fy = 0;
      let rafId = null;

      function moveCursor() {
        fx += (mx - fx) * 0.18;
        fy += (my - fy) * 0.18;
        cursor.style.transform = `translate(${mx}px, ${my}px)`;
        follower.style.transform = `translate(${fx}px, ${fy}px)`;
        rafId = requestAnimationFrame(moveCursor);
      }

      document.addEventListener('mousemove', (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (!rafId) rafId = requestAnimationFrame(moveCursor);
      }, { passive: true });

      document.addEventListener('mouseover', (e) => {
        const interactive = e.target.closest('a, button, .service-card, .portfolio-card, .pricing-card, input, select, textarea, .filter-btn');
        document.body.classList.toggle('cursor-hover', !!interactive);
      });

      document.addEventListener('mousedown', () => document.body.classList.add('cursor-click'));
      document.addEventListener('mouseup', () => document.body.classList.remove('cursor-click'));
    }
  }

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

    document.querySelectorAll('.section__header, .service-card, .process-card, .portfolio-card, .benefit-card, .pricing-card, .audit__card, .instagram__card').forEach(el => {
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

  /* ---- Contact form ---- */
  if (contactForm) {
    bindFormValidation(contactForm);

    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = contactForm.querySelectorAll('input, select, textarea');
      let isValid = true;
      fields.forEach(field => { if (!validateField(field)) isValid = false; });
      if (!isValid) return;

      const data = Object.fromEntries(new FormData(contactForm).entries());
      const serviceSelect = contactForm.querySelector('#service');
      const serviceLabel = serviceSelect.options[serviceSelect.selectedIndex].text;

      const lines = [
        'New message from Social Plus website',
        '',
        `Name: ${data.name.trim()}`,
        `Phone: ${data.phone ? data.phone.trim() : 'Not provided'}`,
        `Email: ${data.email.trim()}`,
        `Service: ${serviceLabel}`,
        '',
        'Message:',
        data.message.trim()
      ];

      contactForm.reset();
      showToast(t('toast.contact'));
      openWhatsApp(lines.join('\n'));
    });
  }

  /* ---- Audit form ---- */
  if (auditForm) {
    bindFormValidation(auditForm);
    const auditSuccess = document.getElementById('audit-success');

    auditForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = auditForm.querySelectorAll('input, select, textarea');
      let isValid = true;
      fields.forEach(field => { if (!validateField(field)) isValid = false; });
      if (!isValid) return;

      const data = Object.fromEntries(new FormData(auditForm).entries());

      const lines = [
        'Free Instagram Audit Request — Social Plus',
        '',
        `Name: ${data.name.trim()}`,
        `Instagram: ${data.username.trim()}`,
        `WhatsApp: ${data.whatsapp.trim()}`,
        `Business: ${data.business.trim()}`
      ];

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

})();
