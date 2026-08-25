/* ============================================================
   gallery-detail.js — UEMCraft 作品详情页逻辑
   通过 ?id= 从 API 加载作品数据，渲染 Markdown 描述、相册、下载链接。
   ============================================================ */
(function () {
  'use strict';

  var API_URL = '../api/works.php';

  /* ---- 工具函数 ---- */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---- 代码高亮（复用 content.js 逻辑） ---- */
  var GENERIC_KEYWORDS = {
    'function':1,'return':1,'if':1,'else':1,'for':1,'while':1,'do':1,
    'const':1,'let':1,'var':1,'new':1,'class':1,'extends':1,'import':1,'export':1,'from':1,'default':1,
    'async':1,'await':1,'try':1,'catch':1,'throw':1,'finally':1,'switch':1,'case':1,'break':1,'continue':1,
    'true':1,'false':1,'null':1,'undefined':1,'this':1,'typeof':1,'instanceof':1,'in':1,'of':1,'void':1,'delete':1
  };

  function highlightJson(src) {
    return src.replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],:])|([\s\S])/g,
      function (m, str, colon, num, kw, punct, other) {
        if (str !== undefined) {
          return colon !== undefined
            ? '<span class="tok-key">' + escapeHtml(str) + '</span>' + colon
            : '<span class="tok-string">' + escapeHtml(str) + '</span>';
        }
        if (num !== undefined) return '<span class="tok-number">' + num + '</span>';
        if (kw !== undefined) return '<span class="tok-keyword">' + kw + '</span>';
        if (punct !== undefined) return '<span class="tok-punct">' + escapeHtml(punct) + '</span>';
        return escapeHtml(other);
      }
    );
  }

  var RE_SLASH_COMMENT = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\b|\b([A-Za-z_$][\w$]*)\b|([\s\S])/g;
  var RE_HASH_COMMENT  = /(#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\b|\b([A-Za-z_$][\w$]*)\b|([\s\S])/g;
  var HASH_COMMENT_LANGS = /^(bash|sh|shell|zsh|python|py|yaml|yml|ruby|rb|perl|pl|nginx|toml|ini|http|text|plaintext)$/;

  function highlightGeneric(src, lang) {
    var re = HASH_COMMENT_LANGS.test(lang || '') ? RE_HASH_COMMENT : RE_SLASH_COMMENT;
    return src.replace(re,
      function (m, comment, str, num, word, other) {
        if (comment !== undefined) return '<span class="tok-comment">' + escapeHtml(comment) + '</span>';
        if (str !== undefined) return '<span class="tok-string">' + escapeHtml(str) + '</span>';
        if (num !== undefined) return '<span class="tok-number">' + num + '</span>';
        if (word !== undefined) {
          return GENERIC_KEYWORDS[word] ? '<span class="tok-keyword">' + word + '</span>' : word;
        }
        return escapeHtml(other);
      }
    );
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); return Promise.resolve(); }
    catch (e) { return Promise.reject(e); }
    finally { document.body.removeChild(ta); }
  }

  function buildCodeHeader(lang) {
    var header = document.createElement('div');
    header.className = 'code-header';
    header.innerHTML =
      '<span class="code-lang">' + escapeHtml(lang || 'code') + '</span>' +
      '<button type="button" class="code-copy" aria-label="复制代码">复制</button>';
    return header;
  }

  function enhanceCodeBlocks(root) {
    if (!root || !root.querySelectorAll) return;
    var blocks = root.querySelectorAll('pre code');
    for (var i = 0; i < blocks.length; i++) {
      (function (code) {
        var pre = code.parentNode;
        var cls = code.className || '';
        var m = cls.match(/language-([\w+-]+)/);
        var lang = m ? m[1].toLowerCase() : '';
        var raw = code.textContent;

        code.innerHTML = (lang === 'json' || lang === 'jsonc')
          ? highlightJson(raw)
          : highlightGeneric(raw, lang);

        var wrapper = document.createElement('div');
        wrapper.className = 'code-block';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
        var header = buildCodeHeader(lang);
        wrapper.insertBefore(header, pre);

        var copyBtn = header.querySelector('.code-copy');
        if (copyBtn) {
          copyBtn.addEventListener('click', function () {
            copyText(raw).then(function () {
              copyBtn.textContent = '已复制';
              setTimeout(function () { copyBtn.textContent = '复制'; }, 2000);
            }).catch(function () {
              copyBtn.textContent = '失败';
              setTimeout(function () { copyBtn.textContent = '复制'; }, 2000);
            });
          });
        }
      })(blocks[i]);
    }
  }

  /* ---- 相册状态 ---- */
  var galleryImages = [];
  var currentGalleryIdx = 0;

  /* ---- Lightbox ---- */
  var lightbox = document.getElementById('worksLightbox');
  var lightboxImg = document.getElementById('lightboxImg');

  function openLightbox(idx) {
    if (!lightbox || !galleryImages.length) return;
    currentGalleryIdx = idx;
    lightboxImg.src = galleryImages[currentGalleryIdx];
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function navigateLightbox(dir) {
    if (!galleryImages.length) return;
    currentGalleryIdx = (currentGalleryIdx + dir + galleryImages.length) % galleryImages.length;
    lightboxImg.src = galleryImages[currentGalleryIdx];
    // 同步高亮缩略图
    updateThumbActive();
  }

  function updateThumbActive() {
    var thumbs = document.querySelectorAll('.detail-hero-thumb');
    for (var i = 0; i < thumbs.length; i++) {
      thumbs[i].classList.toggle('is-active', i === currentGalleryIdx);
    }
  }

  if (lightbox) {
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-prev').addEventListener('click', function () { navigateLightbox(-1); });
    lightbox.querySelector('.lightbox-next').addEventListener('click', function () { navigateLightbox(1); });
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (!lightbox || !lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  /* ---- 渲染 ---- */
  function renderDetail(item) {
    var titleEl = document.getElementById('detailTitle');
    var subEl = document.getElementById('detailSub');
    var crumbEl = document.getElementById('detailCrumb');
    var bodyEl = document.getElementById('detailBody');
    var downloadsEl = document.getElementById('detailDownloads');
    var downloadBtnsEl = document.getElementById('downloadButtons');

    // 标题 & 面包屑
    document.title = item.title + ' — 作品详情 — UEMCraft';
    if (titleEl) titleEl.textContent = item.title;
    if (subEl) subEl.textContent = item.category || '作品详情';
    if (crumbEl) crumbEl.textContent = item.title;

    // 相册
    galleryImages = [];
    if (item.gallery_images && item.gallery_images.length > 0) {
      galleryImages = item.gallery_images;
    } else if (item.image) {
      galleryImages = [item.image];
    } else if (item.cover) {
      galleryImages = [item.cover];
    }

    var galleryWrap = document.getElementById('detailGalleryWrap');
    if (galleryWrap && galleryImages.length > 0) {
      var track = document.getElementById('galleryTrack');
      var thumbsEl = document.getElementById('galleryThumbs');
      var counterEl = document.getElementById('galleryCounter');
      var prevBtn = document.getElementById('galleryPrev');
      var nextBtn = document.getElementById('galleryNext');
      currentGalleryIdx = 0;

      // 构建滑动轨道
      track.innerHTML = '';
      galleryImages.forEach(function (url, idx) {
        var img = document.createElement('img');
        img.src = url;
        img.alt = item.title + ' (' + (idx + 1) + ')';
        img.loading = idx === 0 ? 'eager' : 'lazy';
        track.appendChild(img);
      });

      // 滑动定位
      function setTrackPos(idx, animate) {
        if (!animate) track.style.transition = 'none';
        track.style.transform = 'translateX(-' + (idx * 100) + '%)';
        if (!animate) {
          void track.offsetWidth;
          track.style.transition = '';
        }
      }

      function updateCounter() {
        if (counterEl) counterEl.textContent = (currentGalleryIdx + 1) + ' / ' + galleryImages.length;
      }
      updateCounter();

      function galleryNav(dir) {
        currentGalleryIdx = (currentGalleryIdx + dir + galleryImages.length) % galleryImages.length;
        setTrackPos(currentGalleryIdx, true);
        updateCounter();
        updateThumbActive();
        // 同步缩略图滚动
        scrollThumbIntoView(currentGalleryIdx);
      }

      if (prevBtn) prevBtn.addEventListener('click', function () { galleryNav(-1); });
      if (nextBtn) nextBtn.addEventListener('click', function () { galleryNav(1); });

      // 点击主图打开 Lightbox
      track.addEventListener('click', function (e) {
        if (e.target.tagName === 'IMG') openLightbox(currentGalleryIdx);
      });

      // 渲染缩略图
      if (galleryImages.length > 1 && thumbsEl) {
        thumbsEl.innerHTML = '';
        galleryImages.forEach(function (url, idx) {
          var thumb = document.createElement('div');
          thumb.className = 'detail-hero-thumb' + (idx === 0 ? ' is-active' : '');
          thumb.innerHTML = '<img src="' + escapeHtml(url) + '" alt="图片 ' + (idx + 1) + '" loading="lazy">';
          thumb.addEventListener('click', function () {
            currentGalleryIdx = idx;
            setTrackPos(idx, true);
            updateCounter();
            updateThumbActive();
          });
          thumbsEl.appendChild(thumb);
        });
      }

      // 缩略图滚动到可见
      function scrollThumbIntoView(idx) {
        if (!thumbsEl) return;
        var thumb = thumbsEl.children[idx];
        if (thumb) thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }

      // 触摸滑动
      var touchStartX = 0, touchDeltaX = 0, touchTracking = false;
      galleryWrap.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
        touchTracking = true;
      }, { passive: true });
      galleryWrap.addEventListener('touchmove', function (e) {
        if (!touchTracking) return;
        touchDeltaX = e.touches[0].clientX - touchStartX;
      }, { passive: true });
      galleryWrap.addEventListener('touchend', function () {
        if (!touchTracking) return;
        touchTracking = false;
        if (Math.abs(touchDeltaX) > 40) {
          galleryNav(touchDeltaX < 0 ? 1 : -1);
        }
        touchDeltaX = 0;
      });

      // 初次定位不播放动画
      setTrackPos(0, false);
      galleryWrap.style.display = '';
    }

    // Markdown 描述
    if (bodyEl) {
      var md = item.markdown || item.description || '';
      if (md) {
        if (typeof marked !== 'undefined') {
          marked.setOptions({ gfm: true, breaks: false, headerIds: true, mangle: false, sanitize: false });
          bodyEl.innerHTML = marked.parse(md);
          enhanceCodeBlocks(bodyEl);
        } else {
          bodyEl.innerHTML = '<p>' + escapeHtml(md) + '</p>';
        }
      } else {
        bodyEl.innerHTML = '<p style="color:var(--c-text-muted);">暂无描述。</p>';
      }
    }

    // 侧栏头部：标题 + 分类 + 作者
    var sidebarTitle = document.getElementById('sidebarTitle');
    var sidebarAuthor = document.getElementById('sidebarAuthor');
    var sidebarCategory = document.getElementById('sidebarCategory');
    if (sidebarTitle) sidebarTitle.textContent = item.title;
    if (sidebarCategory) {
      if (item.category) {
        sidebarCategory.textContent = item.category;
        sidebarCategory.style.display = '';
      } else {
        sidebarCategory.style.display = 'none';
      }
    }
    if (sidebarAuthor) sidebarAuthor.textContent = item.author ? 'by ' + item.author : '';

    // 下载链接
    if (item.download_links && item.download_links.length > 0 && downloadsEl && downloadBtnsEl) {
      downloadBtnsEl.innerHTML = '';
      item.download_links.forEach(function (link) {
        var a = document.createElement('a');
        a.href = escapeHtml(link.url);
        a.className = 'btn btn-primary detail-download-btn';
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = link.name || '下载';
        downloadBtnsEl.appendChild(a);
      });
      downloadsEl.style.display = '';
    }

    // 简短描述（侧栏）
    var descCard = document.getElementById('detailDescCard');
    var descText = document.getElementById('detailDescText');
    if (descCard && descText) {
      var shortDesc = item.description || '';
      if (shortDesc) {
        descText.textContent = shortDesc;
        descCard.style.display = '';
      }
    }
  }

  function renderError(msg) {
    var titleEl = document.getElementById('detailTitle');
    var subEl = document.getElementById('detailSub');
    var crumbEl = document.getElementById('detailCrumb');
    var bodyEl = document.getElementById('detailBody');

    document.title = '作品不存在 — UEMCraft';
    if (titleEl) titleEl.textContent = '作品不存在';
    if (subEl) subEl.textContent = msg || '你访问的作品可能已被移动或删除。';
    if (crumbEl) crumbEl.textContent = '作品不存在';
    if (bodyEl) bodyEl.innerHTML = '<p>' + escapeHtml(msg || '没有找到对应的作品。') + '，<a href="/gallery/">返回作品列表</a>。</p>';
  }

  /* ---- 初始化 ---- */
  function init() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');

    if (!id) {
      renderError('未指定作品 ID');
      return;
    }

    fetch(API_URL + '?action=detail&id=' + encodeURIComponent(id))
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success || !json.data) {
          renderError(json.error || '作品不存在');
          return;
        }
        renderDetail(json.data);
      })
      .catch(function () {
        renderError('加载作品时发生错误');
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
