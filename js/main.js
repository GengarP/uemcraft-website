/* ============================================================
   main.js — 全局交互
   导航 / 滚动状态 / 主题切换 / 滚动显现 / 回到顶部 / 年份
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- Page Loader ---- */
  const loader = document.getElementById('pageLoader');
  if (loader && !sessionStorage.getItem('introDone')) {
    sessionStorage.setItem('introDone', '1');
    // Generate floating pixel blocks in background
    const blocksContainer = document.getElementById('loaderBlocks');
    if (blocksContainer) {
      const colors = ['#5D8A3C','#966A3B','#7F7F7F','#F5A623','#4AEDD9','#C0392B','#214D87','#8E44AD'];
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 12; i++) {
        const b = document.createElement('span');
        b.className = 'loader-block';
        const size = 8 + Math.floor(Math.random() * 22);
        b.style.cssText =
          'width:' + size + 'px;height:' + size + 'px;' +
          'background:' + colors[i % colors.length] + ';' +
          'top:' + (Math.random() * 100) + '%;' +
          'left:' + (Math.random() * 100) + '%;' +
          'animation-delay:' + (Math.random() * 2) + 's;' +
          'animation-duration:' + (2.5 + Math.random() * 4) + 's;';
        frag.appendChild(b);
      }
      blocksContainer.appendChild(frag);
    }

    const done = function() {
      loader.classList.add('is-done');
      // Trigger hero backdrop + bg image + content fade-in
      setTimeout(function() {
        const heroContent = document.querySelector('.hero-index-content');
        if (heroContent) heroContent.classList.add('is-revealed');
        const heroSection = document.querySelector('.hero-index');
        if (heroSection) heroSection.classList.add('is-loaded');
        // Reveal hero content in sync with backdrop, staggered
        const reveals = document.querySelectorAll('.hero-index-content .reveal');
        reveals.forEach(function(el, i) {
          setTimeout(function() { el.classList.add('in'); }, i * 100);
        });
      }, 150);
      setTimeout(function() { loader.remove(); }, 650);
    };
    if (document.readyState === 'complete') {
      setTimeout(done, 800);
    } else {
      window.addEventListener('load', function() { setTimeout(done, 300); });
      setTimeout(done, 1300);
    }
  } else if (loader) {
    // Intro already played this session — skip curtain, but keep hero animation
    loader.remove();
    const heroContent = document.querySelector('.hero-index-content');
    if (heroContent) heroContent.classList.add('is-revealed');
    const heroSection = document.querySelector('.hero-index');
    if (heroSection) heroSection.classList.add('is-loaded');
    document.querySelectorAll('.hero-index-content .reveal').forEach(function(el, i) {
      setTimeout(function() { el.classList.add('in'); }, i * 100);
    });
  }

  /* ---- Elements ---- */
  const header   = document.querySelector('.site-header');
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  const backTop   = document.querySelector('.back-to-top');
  const settingsToggle = document.querySelector('.settings-toggle');
  const settingsPanel  = document.querySelector('.settings-panel');
  const yearSpan  = document.getElementById('year');

  /* ---- Mobile nav ---- */
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      // Close settings panel when opening mobile nav
      settingsPanel?.classList.remove('is-open');
      settingsPanel?.setAttribute('aria-hidden', 'true');
      const open = mobileNav.classList.toggle('is-open');
      hamburger.classList.toggle('is-open', open);
      hamburger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    // Close on nav link click
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Auto-close when resizing past mobile breakpoint
    const mqDesktop = window.matchMedia('(min-width: 992px)');
    mqDesktop.addEventListener('change', (e) => {
      if (e.matches) {
        mobileNav.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /* ---- Scroll: sticky header shadow ---- */
  let lastScroll = 0;
  function onScroll() {
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 10);

    // Back to top
    if (backTop) {
      backTop.classList.toggle('is-visible', y > 600);
    }
    lastScroll = y;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // init

  /* ---- Back to top click ---- */
  backTop?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ---- Settings: theme + texture ---- */
  const THEME_KEY = 'uemcraft-theme';
  const TEXTURE_KEY = 'uemcraft-texture';
  // Compute relative path prefix based on current page depth
  const _depth = location.pathname.replace(/\\/g, '/').split('/').length - 2;
  const _prefix = _depth > 0 ? '../'.repeat(_depth) : '';
  const TEXTURE_BASE = _prefix + 'assets/img/background_textures/';

  function getTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
    localStorage.setItem(THEME_KEY, t);
    // Update theme option active state
    document.querySelectorAll('.theme-option').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.theme === t);
    });
  }

  function applyTexture(name) {
    if (!name || name === 'none') {
      document.documentElement.removeAttribute('data-texture');
      localStorage.setItem(TEXTURE_KEY, 'none');
    } else {
      document.documentElement.setAttribute('data-texture', name);
      localStorage.setItem(TEXTURE_KEY, name);
      // Set background-image on body::after via a style rule
      let styleEl = document.getElementById('texture-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'texture-style';
        document.head.appendChild(styleEl);
      }
      // Determine correct path prefix based on current directory depth
      const path = TEXTURE_BASE + name + '.png';
      styleEl.textContent = 'body::after{background-image:url(' + path + ');}';
    }
    // Update texture option active state
    document.querySelectorAll('.texture-option').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.texture === (name || 'none'));
    });
  }

  // Init theme
  const currentTheme = getTheme();
  setTheme(currentTheme);

  // Init texture
  const savedTexture = localStorage.getItem(TEXTURE_KEY) || 'none';
  applyTexture(savedTexture);

  // Settings panel toggle
  settingsToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close mobile nav when opening settings
    if (mobileNav && hamburger) {
      mobileNav.classList.remove('is-open');
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
    const isOpen = settingsPanel?.classList.toggle('is-open');
    settingsPanel?.setAttribute('aria-hidden', !isOpen);
  });

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    if (settingsPanel?.classList.contains('is-open') &&
        !settingsPanel.contains(e.target) &&
        !settingsToggle?.contains(e.target)) {
      settingsPanel.classList.remove('is-open');
      settingsPanel.setAttribute('aria-hidden', 'true');
    }
  });

  // Close panel on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsPanel?.classList.contains('is-open')) {
      settingsPanel.classList.remove('is-open');
      settingsPanel.setAttribute('aria-hidden', 'true');
    }
  });

  // Theme option buttons
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      setTheme(btn.dataset.theme);
    });
  });

  // Texture option buttons
  document.querySelectorAll('.texture-option').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTexture(btn.dataset.texture);
    });
  });

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', e => {
    if (!localStorage.getItem(THEME_KEY)) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });

  /* ---- Reveal on scroll (IntersectionObserver) ---- */
  // If loader is active, hero reveals are handled by loader JS; skip them here
  const loaderActive = !!document.getElementById('pageLoader');
  const reveals = document.querySelectorAll(
    loaderActive ? '.reveal:not(.hero-index-content .reveal)' : '.reveal'
  );
  if (reveals.length && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });
    reveals.forEach(el => obs.observe(el));
  } else if (!loaderActive) {
    // Fallback: show all immediately (but not during loader)
    reveals.forEach(el => el.classList.add('in'));
  }

  /* ---- Count-up animation ---- */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    const countObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-count'), 10);
          const duration = 1500;
          const start = performance.now();

          function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(eased * target);
            if (progress < 1) requestAnimationFrame(tick);
            else el.textContent = target;
          }
          requestAnimationFrame(tick);
          countObs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(el => countObs.observe(el));
  }

  /* ---- Footer year ---- */
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  /* ---- Smooth scroll for hash links ---- */
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

});
