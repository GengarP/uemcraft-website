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
  var backdrop  = document.querySelector('.mobile-nav-backdrop');
  var header = document.querySelector('.site-header');

  /* ---- 主题 ---- */
  function getTheme() {
    /* URL ?theme= 预览覆盖(本标签页内有效) */
    try {
      var override = sessionStorage.getItem('uemcraft-theme-override');
      if (override) return override;
    } catch (e) {}
    var stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  }

  /* 万圣夜覆盖层:进入主题时注入,退出时移除(纯装饰,aria-hidden) */
  function syncHalloweenOverlay(active) {
    var existing = document.getElementById('halloween-overlay');
    if (active && !existing) {
      var ov = document.createElement('div');
      ov.id = 'halloween-overlay';
      ov.className = 'halloween-overlay';
      ov.setAttribute('aria-hidden', 'true');
      ov.innerHTML =
        '<div class="hw-stars-a"></div>' +
        '<div class="hw-stars-b"></div>' +
        '<div class="hw-moon"><i class="hw-art"></i></div>' +
        '<div class="hw-bat hw-bat-1"></div>' +
        '<div class="hw-bat hw-bat-2"></div>' +
        '<div class="hw-fog hw-fog-back"></div>' +
        '<div class="hw-fog hw-fog-front"></div>' +
        '<div class="hw-pumpkin"><i class="hw-art"></i></div>' +
        '<div class="hw-web"></div>';
      document.body.appendChild(ov);
    } else if (!active && existing) {
      existing.remove();
    }
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    /* color-scheme 只接受 light/dark,万圣夜按深色处理 */
    document.documentElement.style.colorScheme = t === 'halloween' ? 'dark' : t;
    /* 浏览器地址栏配色跟随(仅万圣夜改写,亮/暗保持原行为) */
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && t === 'halloween') meta.setAttribute('content', '#14172E');
    localStorage.setItem(THEME_KEY, t);
    syncHalloweenOverlay(t === 'halloween');
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
        if (backdrop) backdrop.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        hamburger.setAttribute('aria-expanded', 'false');
        if (header) header.classList.remove('mobile-nav-open');
        document.documentElement.style.overflow = '';
        document.body.style.paddingRight = '';
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

  // 主题按钮(万圣夜期间手动选回亮/暗会写入 opted-out 标记,
  // 本季不再被日期窗口强制拉回;选回万圣夜则清除标记)
  document.querySelectorAll('.theme-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.dataset.theme === 'halloween') {
        localStorage.removeItem('uemcraft-halloween-off');
      } else if (document.documentElement.getAttribute('data-theme') === 'halloween') {
        localStorage.setItem('uemcraft-halloween-off', '1');
      }
      try { sessionStorage.removeItem('uemcraft-theme-override'); } catch (e) {}
      setTheme(btn.dataset.theme);
    });
  });

  // 纹理按钮
  document.querySelectorAll('.texture-option').forEach(function (btn) {
    btn.addEventListener('click', function () { applyTexture(btn.dataset.texture); });
  });

  // 跟随系统主题变化
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem(THEME_KEY) &&
        document.documentElement.getAttribute('data-theme') !== 'halloween') {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
});
