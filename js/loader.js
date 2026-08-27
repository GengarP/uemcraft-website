/* ============================================================
   loader.js — 页面加载动画
   仅首页需要，其他页面不加载此文件。
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  var loader = document.getElementById('pageLoader');
  if (!loader) return;

  if (!sessionStorage.getItem('introDone')) {
    sessionStorage.setItem('introDone', '1');
    // 生成浮动像素方块
    var blocksContainer = document.getElementById('loaderBlocks');
    if (blocksContainer) {
      var colors = ['#5D8A3C','#966A3B','#7F7F7F','#F5A623','#4AEDD9','#C0392B','#214D87','#8E44AD'];
      var frag = document.createDocumentFragment();
      for (var i = 0; i < 12; i++) {
        var b = document.createElement('span');
        b.className = 'loader-block';
        var size = 8 + Math.floor(Math.random() * 22);
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

    // 进度条模拟
    var bar = document.getElementById('loaderProgressBar');
    var progress = 0;
    var timer = setInterval(function () {
      progress += Math.random() * 15 + 5;
      if (progress > 90) progress = 90;
      if (bar) bar.style.width = progress + '%';
    }, 200);

    var done = function () {
      clearInterval(timer);
      if (bar) bar.style.width = '100%';
      setTimeout(function () {
        loader.classList.add('is-done');
        setTimeout(function () {
          var heroContent = document.querySelector('.hero-index-content');
          if (heroContent) heroContent.classList.add('is-revealed');
          var heroSection = document.querySelector('.hero-index');
          if (heroSection) heroSection.classList.add('is-loaded');
          var reveals = document.querySelectorAll('.hero-index-content .reveal');
          reveals.forEach(function (el, i) {
            setTimeout(function () { el.classList.add('in'); }, i * 100);
          });
        }, 150);
        setTimeout(function () { loader.remove(); }, 650);
      }, 100);
    };
    if (document.readyState === 'complete') {
      setTimeout(done, 800);
    } else {
      window.addEventListener('load', function () { setTimeout(done, 300); });
      setTimeout(done, 1300);
    }
  } else {
    // 本次会话已播放过——跳过动画但保持 hero 效果
    loader.remove();
    var heroContent = document.querySelector('.hero-index-content');
    if (heroContent) heroContent.classList.add('is-revealed');
    var heroSection = document.querySelector('.hero-index');
    if (heroSection) heroSection.classList.add('is-loaded');
    document.querySelectorAll('.hero-index-content .reveal').forEach(function (el, i) {
      setTimeout(function () { el.classList.add('in'); }, i * 100);
    });
  }
});
