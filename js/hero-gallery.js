/* ============================================================
   hero-gallery.js — 首页背景画廊（左右滑动）
   slide 的 img 若 src 为空会被忽略；至少两张有效图才会启用切换。
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  var gallery = document.getElementById('heroGallery');
  if (!gallery) return;

  var hero = gallery.parentElement;
  var track = gallery.querySelector('.hero-gallery-track');
  var dotsWrap = document.getElementById('heroGalleryDots');
  var prevBtn = hero.querySelector('.hero-gallery-prev');
  var nextBtn = hero.querySelector('.hero-gallery-next');

  // 只保留填了 src 的 slide
  var allSlides = Array.prototype.slice.call(track.querySelectorAll('.hero-slide'));
  var slides = allSlides.filter(function (s) {
    var img = s.querySelector('img');
    return img && img.getAttribute('src') && img.getAttribute('src').trim() !== '';
  });
  allSlides.forEach(function (s) {
    var img = s.querySelector('img');
    if (!img || !img.getAttribute('src') || img.getAttribute('src').trim() === '') {
      s.parentNode.removeChild(s);
    }
  });

  // 不足两张：无需切换，隐藏控制
  if (slides.length < 2) {
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (dotsWrap) dotsWrap.style.display = 'none';
    return;
  }

  // 初次载入随机选一张，本次会话内刷新保持该图不变
  var INDEX_KEY = 'uemcraft-hero-index';
  var index = parseInt(sessionStorage.getItem(INDEX_KEY), 10);
  if (!(index >= 0 && index < slides.length)) {
    index = Math.floor(Math.random() * slides.length);
    sessionStorage.setItem(INDEX_KEY, String(index));
  }
  var timer = null;
  var AUTO_MS = 5000;

  // 指示点
  slides.forEach(function (_, i) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'hero-gallery-dot' + (i === index ? ' is-active' : '');
    dot.setAttribute('aria-label', '切换到第 ' + (i + 1) + ' 张背景');
    dot.addEventListener('click', function () { goTo(i); restart(); });
    dotsWrap.appendChild(dot);
  });

  function update() {
    track.style.transform = 'translateX(-' + (index * 100) + '%)';
    var dots = dotsWrap.children;
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('is-active', i === index);
    }
  }

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    update();
  }
  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1); }

  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  function start() {
    stop();
    timer = setInterval(next, AUTO_MS);
  }
  function restart() { start(); }

  if (prevBtn) prevBtn.addEventListener('click', function () { prev(); restart(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { next(); restart(); });

  // 触摸滑动
  var startX = 0, deltaX = 0, tracking = false;
  gallery.addEventListener('touchstart', function (e) {
    startX = e.touches[0].clientX;
    tracking = true;
    stop();
  }, { passive: true });
  gallery.addEventListener('touchmove', function (e) {
    if (!tracking) return;
    deltaX = e.touches[0].clientX - startX;
  }, { passive: true });
  gallery.addEventListener('touchend', function () {
    if (!tracking) return;
    tracking = false;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) next(); else prev();
    }
    deltaX = 0;
    restart();
  });

  // 键盘左右键
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { prev(); restart(); }
    else if (e.key === 'ArrowRight') { next(); restart(); }
  });

  // 悬停暂停自动播放
  gallery.addEventListener('mouseenter', stop);
  gallery.addEventListener('mouseleave', start);

  // 初次定位不播放过渡动画，避免刷新时从第一张滚动到随机图
  track.style.transition = 'none';
  update();
  void track.offsetWidth; // 强制回流，让无过渡定位立即生效
  track.style.transition = '';

  start();
});
