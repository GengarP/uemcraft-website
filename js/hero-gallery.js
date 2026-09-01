/* ============================================================
   hero-gallery.js — 首页背景画廊（左右滑动 + 无缝循环 + 视差滚动）
   slide 的 img 若 src 为空会被忽略；至少两张有效图才会启用。
   首尾各克隆一张，实现「最后一张向右滑能无缝回到第一张」。
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  var gallery = document.getElementById('heroGallery');
  if (!gallery) return;

  var hero = gallery.parentElement;
  var track = gallery.querySelector('.hero-gallery-track');
  var dotsWrap = document.getElementById('heroGalleryDots');

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

  if (slides.length < 2) {
    if (dotsWrap) dotsWrap.style.display = 'none';
    return;
  }

  // 无缝循环：开头克隆最后一张、末尾克隆第一张
  track.insertBefore(slides[slides.length - 1].cloneNode(true), track.firstChild);
  track.appendChild(slides[0].cloneNode(true));

  var count = slides.length; // 真实张数；DOM 索引 1..count 为真实 slide
  var current = 1;           // 当前 DOM 索引
  var AUTO_MS = 5000;
  var timer = null;

  // 初次载入随机选一张，本次会话内刷新保持不变
  var INDEX_KEY = 'uemcraft-hero-index';
  var saved = parseInt(sessionStorage.getItem(INDEX_KEY), 10);
  var initialIdx = (saved >= 0 && saved < count) ? saved : Math.floor(Math.random() * count);
  if (!(saved >= 0 && saved < count)) {
    sessionStorage.setItem(INDEX_KEY, String(initialIdx));
  }
  current = initialIdx + 1;

  // 指示点
  for (var i = 0; i < count; i++) {
    (function (realIdx) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'hero-gallery-dot' + (realIdx === initialIdx ? ' is-active' : '');
      dot.setAttribute('aria-label', '切换到第 ' + (realIdx + 1) + ' 张背景');
      dot.addEventListener('click', function () { goTo(realIdx + 1); restart(); });
      dotsWrap.appendChild(dot);
    })(i);
  }

  // DOM 索引 -> 真实索引
  function realIndex(domIdx) {
    return (domIdx - 1 + count) % count;
  }

  function updateDots() {
    var r = realIndex(current);
    var dots = dotsWrap.children;
    for (var j = 0; j < dots.length; j++) {
      dots[j].classList.toggle('is-active', j === r);
    }
  }

  function setTransform(domIdx, animate) {
    if (!animate) track.style.transition = 'none';
    track.style.transform = 'translateX(-' + (domIdx * 100) + '%)';
    if (!animate) {
      void track.offsetWidth; // 强制回流，让无过渡定位立即生效
      track.style.transition = '';
    }
  }

  function goTo(domIdx) {
    current = domIdx;
    setTransform(current, true);
    updateDots();
  }

  // 落在克隆位上时，无缝瞬移回对应真实 slide
  function normalize() {
    if (current === 0) { current = count; setTransform(current, false); updateDots(); }
    else if (current === count + 1) { current = 1; setTransform(current, false); updateDots(); }
  }

  function next() { normalize(); goTo(current + 1); }
  function prev() { normalize(); goTo(current - 1); }

  track.addEventListener('transitionend', function (e) {
    if (e.target !== track || e.propertyName !== 'transform') return;
    normalize();
  });

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function start() { stop(); timer = setInterval(next, AUTO_MS); }
  function restart() { start(); }

  // 触摸滑动
  var startX = 0, deltaX = 0, tracking = false;
  gallery.addEventListener('touchstart', function (e) {
    startX = e.touches[0].clientX; tracking = true; stop();
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

  // 键盘左右
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { prev(); restart(); }
    else if (e.key === 'ArrowRight') { next(); restart(); }
  });

  // 悬停暂停自动播放
  gallery.addEventListener('mouseenter', stop);
  gallery.addEventListener('mouseleave', start);

  // 初次定位不播放过渡，避免刷新时滚动动画
  setTransform(current, false);
  updateDots();
  start();

  // ---- 视差滚动效果 ----
  var parallax = document.getElementById('heroParallax');
  var heroSection = document.querySelector('.hero-index');
  if (parallax && heroSection) {
    var ticking = false;
    var PARALLAX_SPEED = 0.4; // 视差速度：0.4 表示背景以 40% 的速度滚动

    function updateParallax() {
      var scrolled = window.pageYOffset;
      var heroHeight = heroSection.offsetHeight;

      // 只在 hero 区域可见时应用视差
      if (scrolled < heroHeight) {
        var parallaxOffset = scrolled * PARALLAX_SPEED;
        parallax.style.transform = 'translate3d(0,' + parallaxOffset + 'px,0)';
      }

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    // 初始化位置
    updateParallax();
  }

});
