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

  /* ---- 全屏像素涟漪（Canvas2D arc，fixed 定位铺满视口） ---- */
  // 与摆动动画同步：通过 animationiteration 事件触发，周期1.5s
  var ptPixelScale = 16;             // ↑ 越大像素越粗，越小越细腻
  var ptCanvasSize = Math.ceil(Math.max(window.innerWidth || 1920, window.innerHeight || 1080) / ptPixelScale);
  var ptStrokeWidth = 1.5;
  var ptTotalFrames = 90;            // 1.5s × 60fps，与摆动动画周期对齐
  var ptTargetR = ptCanvasSize * 0.6;
  var ptCssSize = ptCanvasSize * ptPixelScale;
  var ptLogo = overlay.querySelector('.pt-logo');

  function spawnPtRipple() {
    if (!overlay.classList.contains('is-active')) return;
    var cvs = document.createElement('canvas');
    cvs.setAttribute('aria-hidden', 'true');
    cvs.width = ptCanvasSize;
    cvs.height = ptCanvasSize;
    cvs.style.cssText =
      'position:fixed;top:50%;left:50%;' +
      'width:' + ptCssSize + 'px;height:' + ptCssSize + 'px;' +
      'max-width:none;' +
      'transform:translate(-50%,-50%);' +
      'pointer-events:none;z-index:2;' +
      'image-rendering:pixelated;image-rendering:crisp-edges;';
    overlay.appendChild(cvs);

    var ctx = cvs.getContext('2d');
    var cx = ptCanvasSize / 2;
    var cy = ptCanvasSize / 2;
    var frame = 0;

    function draw() {
      var progress = frame / ptTotalFrames;
      var r = ptTargetR * progress;
      var opacity = Math.pow(1 - progress, 1.5);
      if (opacity < 0.01 || frame > ptTotalFrames) {
        if (cvs.parentNode) cvs.remove();
        return;
      }
      ctx.clearRect(0, 0, ptCanvasSize, ptCanvasSize);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,' + opacity.toFixed(3) + ')';
      ctx.lineWidth = ptStrokeWidth;
      ctx.stroke();
      frame++;
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

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

    // 显示帷幕遮罩 + 全屏涟漪（与摆动动画同步）
    overlay.classList.add('is-active');
    spawnPtRipple();
    if (ptLogo) { ptLogo.addEventListener('animationiteration', spawnPtRipple); }

    // 帷幕合拢后跳转
    setTimeout(function () {
      location.href = url.href;
    }, 500);
  });
})();
