/* ============================================================
   loader.js — 页面加载动画
   仅首页需要，其他页面不加载此文件。
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () {
  var loader = document.getElementById('pageLoader');
  if (!loader) return;

  if (!sessionStorage.getItem('introDone')) {
    sessionStorage.setItem('introDone', '1');

    // 为 logo 生成全屏像素涟漪（Canvas2D arc，fixed 定位铺满视口）
    // 与摆动动画同步：通过 animationiteration 事件触发，周期1.5s
    var rippleLogo = loader.querySelector('.loader-logo');
    var spawnRipple;
    (function () {
      var vw = window.innerWidth || 1920;
      var vh = window.innerHeight || 1080;
      var pixelScale = 16;            // ↑ 越大像素越粗，越小越细腻
      var canvasSize = Math.ceil(Math.max(vw, vh) / pixelScale);
      var strokeWidth = 1.5;
      var totalFrames = 90;           // 1.5s × 60fps，与摆动动画周期对齐
      var targetR = canvasSize * 0.6;
      var cssSize = canvasSize * pixelScale;

      spawnRipple = function () {
        var cvs = document.createElement('canvas');
        cvs.setAttribute('aria-hidden', 'true');
        cvs.width = canvasSize;
        cvs.height = canvasSize;
        cvs.style.cssText =
          'position:fixed;top:50%;left:50%;' +
          'width:' + cssSize + 'px;height:' + cssSize + 'px;' +
          'max-width:none;' +
          'transform:translate(-50%,-50%);' +
          'pointer-events:none;z-index:2;' +
          'image-rendering:pixelated;image-rendering:crisp-edges;';
        loader.appendChild(cvs);

        var ctx = cvs.getContext('2d');
        var cx = canvasSize / 2;
        var cy = canvasSize / 2;
        var frame = 0;

        function draw() {
          var progress = frame / totalFrames;
          var r = targetR * progress;
          var opacity = Math.pow(1 - progress, 1.5);
          if (opacity < 0.01 || frame > totalFrames) {
            if (cvs.parentNode) cvs.remove();
            return;
          }
          ctx.clearRect(0, 0, canvasSize, canvasSize);
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,' + opacity.toFixed(3) + ')';
          ctx.lineWidth = strokeWidth;
          ctx.stroke();
          frame++;
          requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);
      };

      // 首个涟漪立即播放，与 CSS 动画同时启动
      spawnRipple();

      // 后续涟漪通过摆动动画 iteration 事件同步触发
      if (rippleLogo) {
        rippleLogo.addEventListener('animationiteration', spawnRipple);
      }
    })();

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
      // 停止涟漪生成并清理已有涟漪 canvas
      if (rippleLogo) { rippleLogo.removeEventListener('animationiteration', spawnRipple); }
      if (bar) bar.style.width = '100%';
      setTimeout(function () {
        loader.classList.add('is-done');
        setTimeout(function () {
          var heroContent = document.querySelector('.hero-index-content');
          if (heroContent) heroContent.classList.add('is-revealed');
          var heroSection = document.querySelector('.hero-index');
          if (heroSection) heroSection.classList.add('is-loaded');
          var reveals = document.querySelectorAll('.hero-index .reveal');
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
    document.querySelectorAll('.hero-index .reveal').forEach(function (el, i) {
      setTimeout(function () { el.classList.add('in'); }, i * 100);
    });
  }
});
