/* ============================================================
   nav.js — 导航栏交互
   汉堡菜单 / 移动端导航 / 滚动吸顶 / 回到顶部
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  var header    = document.querySelector('.site-header');
  var hamburger = document.querySelector('.hamburger');
  var mobileNav = document.querySelector('.mobile-nav');
  var backTop   = document.querySelector('.back-to-top');
  var settingsToggle = document.querySelector('.settings-toggle');
  var settingsPanel  = document.querySelector('.settings-panel');

  /* ---- 移动端导航 ---- */
  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      // 打开导航时关闭设置面板
      if (settingsPanel) {
        settingsPanel.classList.remove('is-open');
        settingsPanel.setAttribute('aria-hidden', 'true');
      }
      var open = mobileNav.classList.toggle('is-open');
      hamburger.classList.toggle('is-open', open);
      hamburger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    // 点击导航链接后关闭
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // 窗口跨断点自动关闭
    var mqDesktop = window.matchMedia('(min-width: 992px)');
    mqDesktop.addEventListener('change', function (e) {
      if (e.matches) {
        mobileNav.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /* ---- 滚动：吸顶阴影 + 回到顶部 ---- */
  function onScroll() {
    var y = window.scrollY;
    if (header) header.classList.toggle('is-scrolled', y > 10);
    if (backTop) backTop.classList.toggle('is-visible', y > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- 回到顶部点击 ---- */
  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ---- 平滑锚点滚动 ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  /* ---- 页脚年份 ---- */
  var yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
});
