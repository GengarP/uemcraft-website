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
  const themeToggle = document.querySelector('.theme-toggle');
  const yearSpan  = document.getElementById('year');

  /* ---- Mobile nav ---- */
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
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

  /* ---- Theme toggle ---- */
  const STORAGE_KEY = 'uemcraft-theme';

  function getTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
    localStorage.setItem(STORAGE_KEY, t);
  }

  // Init
  const current = getTheme();
  setTheme(current);

  themeToggle?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });

  // Listen for system changes
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', e => {
    if (!localStorage.getItem(STORAGE_KEY)) {
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

  /* ---- Content sync: pull news & events into index ---- */
  const newsGrid = document.getElementById('newsGrid');
  const eventsGrid = document.getElementById('eventsGrid');

  if (newsGrid) {
    fetch('news/index.html').then(r => r.text()).then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const cards = doc.querySelectorAll('.news-card:not(.news-card-empty)');
      const top = Array.from(cards).slice(0, 3);
      if (top.length) {
        newsGrid.innerHTML = '';
        top.forEach(c => {
          // Fix link on the card itself if it's an <a> tag
          if (c.tagName === 'A' && c.hasAttribute('href')) {
            const href = c.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
              c.setAttribute('href', 'news/' + href);
            }
          }
          // Fix relative links in children
          c.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
              a.setAttribute('href', 'news/' + href);
            }
          });
          // Fix image src
          c.querySelectorAll('img[src]').forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http')) {
              img.setAttribute('src', 'news/' + src);
            }
          });
          newsGrid.appendChild(c.cloneNode(true));
        });
        // Fill remaining slots
        while (newsGrid.children.length < 3) {
          const empty = document.createElement('div');
          empty.className = 'news-card news-card-empty';
          empty.setAttribute('aria-hidden', 'true');
          empty.innerHTML = '<div class="news-date">·····</div><div class="news-title">敬请期待</div><div class="news-excerpt">更多动态即将发布</div>';
          newsGrid.appendChild(empty);
        }
      }
    }).catch(() => {});
  }

  if (eventsGrid) {
    fetch('events.html').then(r => r.text()).then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const cards = doc.querySelectorAll('.event-card');
      if (cards.length) {
        eventsGrid.innerHTML = '';
        cards.forEach(c => {
          // Preserve original link from events page
          const parentAnchor = c.closest('a');
          const originalHref = parentAnchor ? parentAnchor.getAttribute('href') : 'events.html';

          const link = document.createElement('a');
          link.className = 'event-card';
          link.href = originalHref;
          link.style.textDecoration = 'none';
          link.style.color = 'inherit';
          // Move card children to link
          while (c.firstChild) link.appendChild(c.firstChild);
          // Copy card attributes
          for (const attr of c.attributes) {
            if (attr.name !== 'class') link.setAttribute(attr.name, attr.value);
          }
          eventsGrid.appendChild(link);
        });
      }
    }).catch(() => {});
  }

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
