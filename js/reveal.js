/* ============================================================
   reveal.js — 滚动显现动画 + 数字跳动
   所有页面加载。自动跳过 loader 控制的 hero 区域。
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {

  /* ---- IntersectionObserver 滚动显现 ---- */
  var loaderActive = !!document.getElementById('pageLoader');
  var reveals = document.querySelectorAll(
    loaderActive ? '.reveal:not(.hero-index-content .reveal)' : '.reveal'
  );
  if (reveals.length && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -30px 0px' });
    reveals.forEach(function (el) { obs.observe(el); });
  } else if (!loaderActive) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- 数字跳动动画 ---- */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    var countObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var target = parseInt(el.getAttribute('data-count'), 10);
          var duration = 1500;
          var start = performance.now();
          function tick(now) {
            var elapsed = now - start;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(eased * target);
            if (progress < 1) requestAnimationFrame(tick);
            else el.textContent = target;
          }
          requestAnimationFrame(tick);
          countObs.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { countObs.observe(el); });
  }
});
