/* ============================================================
   lightbox.js — 共享图片查看器：缩放 / 拖拽平移
   ------------------------------------------------------------
   全站三处图片查看器共用：docs 阅读页、作品详情页、作品列表页。
   各页自己负责「打开 / 关闭 / 切换图片 / 上下张」的逻辑，
   本模块只负责「怎么看」：缩放、平移、以及右下角的缩放控件。

   用法：
     var lb = UEMLightbox.enhance(document.getElementById('worksLightbox'));

   约定（DOM 结构）：
     .lightbox
       .lightbox-close           关闭按钮（图标由 CSS 背景提供）
       .lightbox-prev/.lightbox-next   可选，上下张
       .lightbox-body
         .lightbox-img           必需，被缩放的图片
         .lightbox-caption       可选，列表页的标题/描述/下载面板

   enhance() 会创建 .lightbox-stage 包住图片作为裁剪视口，
   并把缩放控件插入 .lightbox。
   ============================================================ */
window.UEMLightbox = (function () {
  'use strict';

  var MIN_SCALE = 0.5;
  var MAX_SCALE = 6;
  var ZOOM_STEP = 1.5;   // 按钮每次缩放的倍率
  var DBLCLICK_SCALE = 2; // 双击放大到的倍率
  var DRAG_SLOP = 3;      // 超过这个位移才算拖拽，用于区分点击

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /**
   * 给一个 .lightbox 元素加上缩放/平移能力。
   * @param {HTMLElement} root - .lightbox 容器
   * @returns {object|null} 实例（含 reset/zoomIn/zoomOut 方法）
   */
  function enhance(root) {
    if (!root) return null;
    if (root.__lbInstance) return root.__lbInstance;

    var body = root.querySelector('.lightbox-body');
    var img = root.querySelector('.lightbox-img');
    if (!body || !img) return null;

    /* ---- 裁剪视口：图片放在 stage 里，缩放后被 stage 裁掉溢出部分 ---- */
    var stage = root.querySelector('.lightbox-stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.className = 'lightbox-stage';
      img.parentNode.insertBefore(stage, img);
      stage.appendChild(img);
    }
    img.draggable = false;

    /* ---- 缩放控件 ---- */
    var controls = document.createElement('div');
    controls.className = 'lightbox-controls';
    controls.innerHTML =
      '<button type="button" class="lightbox-ctl" data-lb="out" aria-label="缩小">'
      + '<span class="lb-ico lb-ico-minus" aria-hidden="true"></span></button>'
      + '<button type="button" class="lightbox-ctl lightbox-ctl-fit" data-lb="reset" aria-label="恢复原始大小">'
      + '<span class="lb-fit" aria-hidden="true">1:1</span></button>'
      + '<button type="button" class="lightbox-ctl" data-lb="in" aria-label="放大">'
      + '<span class="lb-ico lb-ico-plus" aria-hidden="true"></span></button>';
    root.appendChild(controls);

    /* ---- 状态 ---- */
    var scale = 1;
    var tx = 0;
    var ty = 0;

    function apply() {
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      root.classList.toggle('is-zoomed', scale > 1.001);
      root.classList.toggle('is-pannable', isPannable());
    }

    /* 未变换时的图片中心（视口坐标）。
       缩放以中心为原点，不会移动中心；只有 translate 会，所以减去 tx/ty 即可还原。 */
    function imageCenter() {
      var r = img.getBoundingClientRect();
      return { x: (r.left + r.right) / 2 - tx, y: (r.top + r.bottom) / 2 - ty };
    }

    /* 平移上限 = 放大后超出视口的部分的一半。
       图片小于视口时上限为 0（此时整张都看得见，没有可平移的内容），
       大于视口时允许移动到「刚好露出视口边缘」为止，不许拖出视野。
       这个界限是连续的：随着放大逐步放开，不会在某个倍数上突然跳动。 */
    function panLimit(viewSize, natural) {
      return Math.max(0, (natural * scale - viewSize) / 2);
    }

    function clampPan() {
      var sr = stage.getBoundingClientRect();
      var maxX = panLimit(sr.width, img.offsetWidth);
      var maxY = panLimit(sr.height, img.offsetHeight);
      tx = clamp(tx, -maxX, maxX);
      ty = clamp(ty, -maxY, maxY);
    }

    /* 是否已有可平移的余量（供光标样式判断） */
    function isPannable() {
      var sr = stage.getBoundingClientRect();
      return panLimit(sr.width, img.offsetWidth) > 0.5
        || panLimit(sr.height, img.offsetHeight) > 0.5;
    }

    function reset() {
      scale = 1;
      tx = 0;
      ty = 0;
      apply();
    }

    /* 以 (cx, cy) 为定点缩放到 newScale；不传定点时以图片中心缩放 */
    function zoomTo(newScale, cx, cy) {
      newScale = clamp(newScale, MIN_SCALE, MAX_SCALE);
      if (newScale === scale) return;

      var c = imageCenter();
      if (typeof cx !== 'number') { cx = c.x; cy = c.y; }

      var k = newScale / scale;
      tx = cx - c.x - (cx - c.x - tx) * k;
      ty = cy - c.y - (cy - c.y - ty) * k;
      scale = newScale;

      clampPan();
      apply();
    }

    function zoomBy(factor, cx, cy) {
      zoomTo(scale * factor, cx, cy);
    }

    /* ---- 控件 ---- */
    controls.addEventListener('click', function (e) {
      var btn = e.target.closest('.lightbox-ctl');
      if (!btn) return;
      e.stopPropagation();
      var act = btn.getAttribute('data-lb');
      if (act === 'in') zoomBy(ZOOM_STEP);
      else if (act === 'out') zoomBy(1 / ZOOM_STEP);
      else reset();
    });

    /* ---- 滚轮缩放：以光标为定点，需要 passive:false 才能 preventDefault ---- */
    stage.addEventListener('wheel', function (e) {
      if (!root.classList.contains('is-open')) return;
      e.preventDefault();
      // deltaY 在不同设备上量级差别很大，用指数映射拉平手感
      var factor = Math.exp(-e.deltaY * 0.0015);
      zoomBy(factor, e.clientX, e.clientY);
    }, { passive: false });

    /* ---- 双击：放大到 2x / 还原 ---- */
    stage.addEventListener('dblclick', function (e) {
      if (scale > 1.01) reset();
      else zoomTo(DBLCLICK_SCALE, e.clientX, e.clientY);
    });

    /* ---- 拖拽平移（Pointer Events，鼠标 / 触摸 / 触控笔通用） ---- */
    var dragging = false;
    var startX = 0, startY = 0, startTx = 0, startTy = 0;

    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // 必须阻止默认行为：否则浏览器会开始原生图片拖拽 / 文本选择，
      // 进而触发 pointercancel，拖拽刚开始就被中断——这正是「图片拖不动」的原因之一
      e.preventDefault();

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTx = tx;
      startTy = ty;
      stage.classList.add('is-dragging');
      // 捕获指针，拖到 stage 外也能继续跟手
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    });

    function onMove(e) {
      if (!dragging) return;
      tx = startTx + (e.clientX - startX);
      ty = startTy + (e.clientY - startY);
      clampPan();
      apply();
    }

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      try { stage.releasePointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
    }

    // 监听挂在 document 上：指针捕获若失败（部分浏览器/指针类型不支持），
    // 拖拽仍能继续，不会因为指针移出 stage 就断掉
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);

    /* ---- 键盘：+ / - / 0（Esc 与左右方向键仍由各页自己处理） ---- */
    document.addEventListener('keydown', function (e) {
      if (!root.classList.contains('is-open')) return;
      var t = e.target;
      // 输入框里打字时不抢键
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.key === '+' || e.key === '=') { zoomBy(ZOOM_STEP); e.preventDefault(); }
      else if (e.key === '-') { zoomBy(1 / ZOOM_STEP); e.preventDefault(); }
      else if (e.key === '0') { reset(); e.preventDefault(); }
    });

    /* ---- 换图或重新打开时自动复位，避免把上一张的缩放带过来 ---- */
    if (window.MutationObserver) {
      new MutationObserver(reset).observe(img, { attributes: true, attributeFilter: ['src'] });
      new MutationObserver(function () {
        if (root.classList.contains('is-open')) reset();
      }).observe(root, { attributes: true, attributeFilter: ['class'] });
    }

    apply();

    var instance = {
      reset: reset,
      zoomIn: function () { zoomBy(ZOOM_STEP); },
      zoomOut: function () { zoomBy(1 / ZOOM_STEP); },
      stage: stage,
      controls: controls
    };
    root.__lbInstance = instance;
    return instance;
  }

  return { enhance: enhance };
})();
