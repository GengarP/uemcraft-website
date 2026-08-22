/**
 * works.js — UEMCraft 作品展示前端
 * ---------------------------------
 * 从 API 加载作品列表，渲染卡片网格，提供 Lightbox 预览和下载。
 * 依赖：main.js（全局工具函数）
 */
(function () {
  'use strict';

  var API_URL = '../api/works.php';
  var gridEl = document.getElementById('worksGrid');
  var allWorks = [];

  if (!gridEl) return;

  // ---- 加载作品 ----
  function loadWorks() {
    gridEl.innerHTML = '<div class="wall-loading">正在加载作品…</div>';

    fetch(API_URL + '?action=list')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success || !json.data || json.data.length === 0) {
          gridEl.innerHTML = '<div class="wall-empty">暂无作品，敬请期待</div>';
          return;
        }
        allWorks = json.data;
        renderGrid(allWorks);
      })
      .catch(function () {
        gridEl.innerHTML = '<div class="wall-empty">加载失败，请刷新重试</div>';
      });
  }

  // ---- 渲染卡片网格 ----
  function renderGrid(works) {
    var html = '';
    for (var i = 0; i < works.length; i++) {
      html += renderWorkCard(works[i], i);
    }
    gridEl.innerHTML = html;
    bindCardClicks();
  }

  function renderWorkCard(item, index) {
    var cover = item.cover || item.image || '';
    var title = escapeHtml(item.title);
    var desc = escapeHtml(item.description || '');

    return '<div class="works-card" data-index="' + index + '">'
      + '<div class="works-card-img">'
      + (cover ? '<img src="' + escapeHtml(cover) + '" alt="' + title + '" loading="lazy">' : '')
      + '</div>'
      + '<div class="works-card-body">'
      + '<h3 class="works-card-title">' + title + '</h3>'
      + (desc ? '<p class="works-card-desc">' + desc + '</p>' : '')
      + '</div>'
      + '</div>';
  }

  // ---- 卡片点击 → Lightbox ----
  function bindCardClicks() {
    var cards = gridEl.querySelectorAll('.works-card');
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        card.addEventListener('click', function () {
          var idx = parseInt(card.getAttribute('data-index'), 10);
          openLightbox(idx);
        });
      })(cards[i]);
    }
  }

  // ---- Lightbox ----
  var lightbox = document.getElementById('worksLightbox');
  var lbImg = lightbox ? lightbox.querySelector('.lightbox-img') : null;
  var lbTitle = lightbox ? lightbox.querySelector('.lightbox-title') : null;
  var lbDesc = lightbox ? lightbox.querySelector('.lightbox-desc') : null;
  var lbDownload = lightbox ? lightbox.querySelector('.lightbox-download') : null;
  var closeBtn = lightbox ? lightbox.querySelector('.lightbox-close') : null;
  var prevBtn = lightbox ? lightbox.querySelector('.lightbox-prev') : null;
  var nextBtn = lightbox ? lightbox.querySelector('.lightbox-next') : null;
  var currentIdx = -1;

  function openLightbox(index) {
    if (!lightbox || index < 0 || index >= allWorks.length) return;
    currentIdx = index;
    updateLightboxContent();
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    currentIdx = -1;
  }

  function updateLightboxContent() {
    var item = allWorks[currentIdx];
    if (!item) return;

    var imgSrc = item.image || item.cover || '';
    if (lbImg) {
      lbImg.src = imgSrc;
      lbImg.alt = item.title;
    }
    if (lbTitle) lbTitle.textContent = item.title;
    if (lbDesc) lbDesc.textContent = item.description || '';
    if (lbDownload) {
      lbDownload.style.display = imgSrc ? '' : 'none';
    }
  }

  function navigate(direction) {
    if (currentIdx < 0 || allWorks.length === 0) return;
    currentIdx = (currentIdx + direction + allWorks.length) % allWorks.length;
    updateLightboxContent();
  }

  // 下载图片
  function downloadImage() {
    var item = allWorks[currentIdx];
    if (!item) return;
    var imgSrc = item.image || item.cover || '';
    if (!imgSrc) return;

    fetch(imgSrc)
      .then(function (res) { return res.blob(); })
      .then(function (blob) {
        var ext = 'jpg';
        var mimeType = blob.type || '';
        if (mimeType.indexOf('png') !== -1) ext = 'png';
        else if (mimeType.indexOf('webp') !== -1) ext = 'webp';
        else if (mimeType.indexOf('gif') !== -1) ext = 'gif';

        var filename = (item.title || 'work') + '.' + ext;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(function () {
        // fallback: 在新标签页打开
        window.open(imgSrc, '_blank');
      });
  }

  // 事件绑定
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }
  if (prevBtn) prevBtn.addEventListener('click', function () { navigate(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { navigate(1); });
  if (lbDownload) lbDownload.addEventListener('click', downloadImage);

  document.addEventListener('keydown', function (e) {
    if (!lightbox || !lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') navigate(-1);
    else if (e.key === 'ArrowRight') navigate(1);
  });

  // ---- 工具函数 ----
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ---- 初始化 ----
  loadWorks();
})();
