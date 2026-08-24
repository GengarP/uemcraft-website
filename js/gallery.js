/**
 * gallery.js — UEMCraft 作品展示前端
 * ---------------------------------
 * 从 API 加载作品列表，渲染卡片网格，提供 Lightbox 预览和下载。
 * 支持分类筛选按钮（从后端数据动态生成）。
 * 依赖：main.js（全局工具函数）
 */
(function () {
  'use strict';

  var API_URL = '../api/works.php';
  var gridEl = document.getElementById('worksGrid');
  var filterEl = document.getElementById('galleryFilter');
  var allWorks = [];
  var displayedWorks = [];
  var currentCategory = '';

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
        buildFilters(allWorks);
        renderGrid(allWorks);
      })
      .catch(function () {
        gridEl.innerHTML = '<div class="wall-empty">加载失败，请刷新重试</div>';
      });
  }

  // ---- 构建分类筛选按钮 ----
  function buildFilters(works) {
    if (!filterEl) return;

    var catMap = {};
    works.forEach(function (w) {
      if (w.category) catMap[w.category] = (catMap[w.category] || 0) + 1;
    });
    var categories = Object.keys(catMap).sort();

    if (categories.length === 0) {
      filterEl.style.display = 'none';
      return;
    }

    var html = '<button class="gallery-filter-btn is-active" data-category="">全部</button>';
    categories.forEach(function (cat) {
      html += '<button class="gallery-filter-btn" data-category="' + escapeHtml(cat) + '">'
        + escapeHtml(cat) + '<span class="gallery-filter-count">' + catMap[cat] + '</span></button>';
    });
    filterEl.innerHTML = html;

    filterEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.gallery-filter-btn');
      if (!btn) return;
      var cat = btn.getAttribute('data-category');
      if (cat === currentCategory) return;
      currentCategory = cat;

      filterEl.querySelectorAll('.gallery-filter-btn').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');

      var filtered = cat ? allWorks.filter(function (w) { return w.category === cat; }) : allWorks;
      renderGrid(filtered);
    });
  }

  // ---- 渲染卡片网格 ----
  function renderGrid(works) {
    displayedWorks = works;
    if (works.length === 0) {
      gridEl.innerHTML = '<div class="wall-empty">该分类下暂无作品</div>';
      return;
    }
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
    var detailUrl = 'detail.html?id=' + encodeURIComponent(item.id);

    return '<a href="' + detailUrl + '" class="works-card" data-index="' + index + '" data-id="' + item.id + '">'
      + '<div class="works-card-img">'
      + (cover ? '<img src="' + escapeHtml(cover) + '" alt="' + title + '" loading="lazy">' : '')
      + '</div>'
      + '<div class="works-card-body">'
      + '<h3 class="works-card-title">' + title + '</h3>'
      + (item.category ? '<span class="works-card-category">' + escapeHtml(item.category) + '</span>' : '')
      + (desc ? '<p class="works-card-desc">' + desc + '</p>' : '')
      + '</div>'
      + '</a>';
  }

  // ---- 卡片点击 → 详情页（链接跳转，无需 JS 绑定） ----
  function bindCardClicks() {
    // 卡片已改为 <a> 标签，点击直接跳转详情页
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
    if (!lightbox || index < 0 || index >= displayedWorks.length) return;
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
    var item = displayedWorks[currentIdx];
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
    if (currentIdx < 0 || displayedWorks.length === 0) return;
    currentIdx = (currentIdx + direction + displayedWorks.length) % displayedWorks.length;
    updateLightboxContent();
  }

  // 下载图片
  function downloadImage() {
    var item = displayedWorks[currentIdx];
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
