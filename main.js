// ── HVT Main Site JS ──────────────────────────────────────
(function () {
  'use strict';

  // Nav scroll
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  // Hamburger
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.querySelector('.nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => navLinks.classList.remove('open')));
  }

  // Star field
  const starField = document.getElementById('starField');
  if (starField) {
    for (let i = 0; i < 160; i++) {
      const s = document.createElement('div');
      s.className = 'star';
      const size = Math.random() * 2 + 0.5;
      const dur = 2 + Math.random() * 4;
      const del = Math.random() * 5;
      const op = 0.2 + Math.random() * 0.6;
      s.style.cssText = `width:${size}px;height:${size}px;top:${Math.random() * 100}%;left:${Math.random() * 100}%;--dur:${dur}s;--delay:-${del}s;--base-op:${op};`;
      starField.appendChild(s);
    }
  }

  // Scroll reveal
  const cards = document.querySelectorAll('.service-card, .detail-card, .example-card, .pillar-card, .timeline-card');
  if (cards.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const d = parseInt(e.target.dataset.delay || 0, 10);
          setTimeout(() => e.target.classList.add('visible'), d * 100);
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    cards.forEach((c) => observer.observe(c));
  }

  // Contact form
  const form = document.getElementById('contactForm');
  const submitBtn = document.getElementById('submitBtn');
  const success = document.getElementById('formSuccess');
  if (form && submitBtn && success) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.textContent = 'TRANSMITTING...';
      submitBtn.disabled = true;
      await new Promise((r) => setTimeout(r, 1200));
      submitBtn.textContent = 'TRANSMITTED ✓';
      success.classList.add('show');
      form.reset();
      setTimeout(() => {
        submitBtn.textContent = 'TRANSMIT MESSAGE';
        submitBtn.disabled = false;
        success.classList.remove('show');
      }, 5000);
    });
  }

  // Smooth scroll for same-page anchors only
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href');
      if (!href || href === '#') {
        return;
      }
      const t = document.querySelector(href);
      if (t) {
        e.preventDefault();
        t.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
})();
