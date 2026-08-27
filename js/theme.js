/* ============================================================
   theme.js — 主题切换 + 背景纹理
   所有页面加载，通过 localStorage 记忆偏好。
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  var THEME_KEY   = 'uemcraft-theme';
  var TEXTURE_KEY = 'uemcraft-texture';
  var TEXTURE_BASE = '/assets/img/background_textures/';

  var settingsToggle = document.querySelector('.settings-toggle');
  var settingsPanel  = document.querySelector('.settings-panel');
  var mobileNav = document.querySelector('.mobile-nav');
  var hamburger = document.querySelector('.hamburger');

  /* ---- 主题 ---- */
  function getTheme() {
    var stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
    localStorage.setItem(THEME_KEY, t);
    document.querySelectorAll('.theme-option').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.theme === t);
    });
  }

  /* ---- 纹理 ---- */
  function applyTexture(name) {
    if (!name || name === 'none') {
      document.documentElement.removeAttribute('data-texture');
      localStorage.setItem(TEXTURE_KEY, 'none');
    } else {
      document.documentElement.setAttribute('data-texture', name);
      localStorage.setItem(TEXTURE_KEY, name);
      var styleEl = document.getElementById('texture-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'texture-style';
        document.head.appendChild(styleEl);
      }
      var path = TEXTURE_BASE + name + '.png';
      styleEl.textContent = 'body::after{background-image:url(' + path + ');}';
    }
    document.querySelectorAll('.texture-option').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.dataset.texture === (name || 'none'));
    });
  }

  // 初始化
  setTheme(getTheme());
  applyTexture(localStorage.getItem(TEXTURE_KEY) || 'none');

  /* ---- 设置面板交互 ---- */
  if (settingsToggle && settingsPanel) {
    settingsToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      // 打开设置时关闭移动导航
      if (mobileNav && hamburger) {
        mobileNav.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
      var isOpen = settingsPanel.classList.toggle('is-open');
      settingsPanel.setAttribute('aria-hidden', !isOpen);
    });

    // 点击外部关闭
    document.addEventListener('click', function (e) {
      if (settingsPanel.classList.contains('is-open') &&
          !settingsPanel.contains(e.target) &&
          !settingsToggle.contains(e.target)) {
        settingsPanel.classList.remove('is-open');
        settingsPanel.setAttribute('aria-hidden', 'true');
      }
    });

    // ESC 关闭
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && settingsPanel.classList.contains('is-open')) {
        settingsPanel.classList.remove('is-open');
        settingsPanel.setAttribute('aria-hidden', 'true');
      }
    });
  }

  // 主题按钮
  document.querySelectorAll('.theme-option').forEach(function (btn) {
    btn.addEventListener('click', function () { setTheme(btn.dataset.theme); });
  });

  // 纹理按钮
  document.querySelectorAll('.texture-option').forEach(function (btn) {
    btn.addEventListener('click', function () { applyTexture(btn.dataset.texture); });
  });

  // 跟随系统主题变化
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem(THEME_KEY)) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
});
