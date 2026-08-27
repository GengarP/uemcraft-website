/* ============================================================
   page-transition.js — 页面跳转加载动画 + GitHub 风格顶部进度条
   所有页面加载，提供统一的跳转过渡体验。
   ============================================================ */
(function () {
  /* ---- 顶部进度条（GitHub 风格） ---- */
  var topBar = document.createElement('div');
  topBar.className = 'nprogress-bar';
  topBar.innerHTML = '<div class="nprogress-bar-inner"></div>';
  document.body.appendChild(topBar);
  var topBarInner = topBar.querySelector('.nprogress-bar-inner');
  var topBarTimer = null;

  function showTopBar() {
    topBar.classList.add('is-active');
    topBarInner.style.width = '0%';
    var p = 0;
    clearInterval(topBarTimer);
    topBarTimer = setInterval(function () {
      p += Math.random() * 10 + 3;
      if (p > 85) p = 85;
      topBarInner.style.width = p + '%';
    }, 150);
  }

  function finishTopBar() {
    clearInterval(topBarTimer);
    topBarInner.style.width = '100%';
    setTimeout(function () {
      topBar.classList.remove('is-active');
      topBarInner.style.width = '0%';
    }, 400);
  }

  // 页面加载完成时，如果 sessionStorage 标记了跳转，收尾进度条
  if (sessionStorage.getItem('pt-navigating')) {
    sessionStorage.removeItem('pt-navigating');
    showTopBar();
    window.addEventListener('load', function () {
      setTimeout(finishTopBar, 200);
    });
    // 兜底
    setTimeout(finishTopBar, 2000);
  }

  /* ---- 跳转遮罩（帷幕效果） ---- */
  var overlay = document.createElement('div');
  overlay.className = 'page-transition-overlay';
  overlay.innerHTML =
    '<div class="pt-curtain pt-curtain-l"></div>' +
    '<div class="pt-curtain pt-curtain-r"></div>' +
    '<div class="pt-center">' +
      '<img src="/assets/img/loading.webp" alt="" class="pt-logo" width="60" height="60">' +
      '<div class="pt-sub">加载中…</div>' +
    '</div>';
  document.body.appendChild(overlay);

  /* ---- 拦截内部链接 ---- */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;

    var href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (link.target === '_blank') return;
    if (link.hasAttribute('download')) return;

    // 判断是否同源
    var url;
    try { url = new URL(href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin) return;
    // 如果是当前页面，跳过
    if (url.pathname === location.pathname && url.search === location.search) return;

    // 排除 API 请求等非页面链接
    if (url.pathname.includes('/api/')) return;

    e.preventDefault();

    // 标记正在跳转
    sessionStorage.setItem('pt-navigating', '1');

    // 显示顶部进度条
    showTopBar();

    // 显示帷幕遮罩
    overlay.classList.add('is-active');

    // 帷幕合拢后跳转
    setTimeout(function () {
      location.href = url.href;
    }, 500);
  });
})();
