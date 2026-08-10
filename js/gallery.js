/* ============================================================
   gallery.js — 画廊筛选 + 图片灯箱
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- Filter ---- */
  const filterBtns = document.querySelectorAll('.gallery-filters .filter-btn');
  const tiles = document.querySelectorAll('.gallery-tile');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.getAttribute('data-filter');

      // Active state
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      // Filter tiles
      tiles.forEach(tile => {
        if (cat === 'all' || tile.getAttribute('data-category') === cat) {
          tile.classList.remove('is-hidden');
        } else {
          tile.classList.add('is-hidden');
        }
      });
    });
  });

  /* ---- Lightbox ---- */
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const lightboxImg = lightbox.querySelector('.lightbox-img');
  const lightboxCaption = lightbox.querySelector('.lightbox-caption');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');

  let currentIndex = -1;
  let visibleTiles = [];

  function getVisibleTiles() {
    return Array.from(tiles).filter(t => !t.classList.contains('is-hidden'));
  }

  function openLightbox(index) {
    visibleTiles = getVisibleTiles();
    currentIndex = index;
    const tile = visibleTiles[currentIndex];
    if (!tile) return;

    const img = tile.querySelector('img');
    const title = tile.querySelector('.tile-title');
    const meta = tile.querySelector('.tile-meta');

    if (img) lightboxImg.src = img.src;
    if (title && meta) {
      lightboxCaption.textContent = title.textContent + ' · ' + meta.textContent;
    } else if (title) {
      lightboxCaption.textContent = title.textContent;
    }

    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Focus trap
    closeBtn.focus();
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    currentIndex = -1;
  }

  function navigate(direction) {
    if (currentIndex < 0 || visibleTiles.length === 0) return;
    currentIndex = (currentIndex + direction + visibleTiles.length) % visibleTiles.length;
    const tile = visibleTiles[currentIndex];
    if (!tile) return;

    const img = tile.querySelector('img');
    const title = tile.querySelector('.tile-title');
    const meta = tile.querySelector('.tile-meta');

    if (img) lightboxImg.src = img.src;
    if (title && meta) {
      lightboxCaption.textContent = title.textContent + ' · ' + meta.textContent;
    } else if (title) {
      lightboxCaption.textContent = title.textContent;
    }
  }

  // Attach click to tiles
  tiles.forEach((tile, i) => {
    tile.addEventListener('click', () => {
      visibleTiles = getVisibleTiles();
      const idx = visibleTiles.indexOf(tile);
      if (idx >= 0) openLightbox(idx);
    });
  });

  // Close
  closeBtn?.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  // Nav
  prevBtn?.addEventListener('click', () => navigate(-1));
  nextBtn?.addEventListener('click', () => navigate(1));

  // Keyboard
  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('is-open')) return;
    switch (e.key) {
      case 'Escape': closeLightbox(); break;
      case 'ArrowLeft': navigate(-1); break;
      case 'ArrowRight': navigate(1); break;
    }
  });

});
