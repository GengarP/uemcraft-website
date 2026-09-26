/* ============================================================
   docs.js — 指南与文档阅读页逻辑
   文档列表与页内目录都渲染在左侧边栏；未选择文档时正文区保留占位提示。
   ============================================================ */
(function () {
  'use strict';

  var escapeHtml = (window.UEMUtils && window.UEMUtils.escapeHtml) || function (str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  var enhanceCodeBlocks = (window.CodeHighlight && window.CodeHighlight.enhanceCodeBlocks) || function () {};

  /* ---- 表格包装：为 <table> 添加可滚动容器 ---- */
  function wrapTables(container) {
    var tables = container.querySelectorAll('table');
    tables.forEach(function (table) {
      // 已包装则跳过
      if (table.parentNode.classList && table.parentNode.classList.contains('docs-table-wrapper')) return;
      var wrapper = document.createElement('div');
      wrapper.className = 'docs-table-wrapper';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  /* ---- 图片：补 <figure> 说明 + 点击放大 ---- */
  var lightboxEl = null;

  function ensureLightbox() {
    if (lightboxEl) return lightboxEl;

    lightboxEl = document.createElement('div');
    lightboxEl.className = 'docs-lightbox';
    lightboxEl.setAttribute('role', 'dialog');
    lightboxEl.setAttribute('aria-modal', 'true');
    lightboxEl.setAttribute('aria-hidden', 'true');
    lightboxEl.innerHTML =
      '<button type="button" class="docs-lightbox-close" aria-label="关闭">×</button>' +
      '<img src="" alt="">';
    document.body.appendChild(lightboxEl);

    function close() {
      lightboxEl.classList.remove('is-open');
      lightboxEl.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
    }

    lightboxEl.querySelector('.docs-lightbox-close').addEventListener('click', close);
    lightboxEl.addEventListener('click', function (e) {
      // 点击图片本身不关闭，点击背景关闭
      if (e.target !== lightboxEl.querySelector('img')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightboxEl.classList.contains('is-open')) close();
    });

    return lightboxEl;
  }

  function enhanceImages(container) {
    var imgs = container.querySelectorAll('img');
    imgs.forEach(function (img) {
      // 图片加载失败时不显示破图占位，避免误以为内容缺失
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        img.classList.add('is-broken');
      });

      // 有 alt 时包成 <figure>，把 alt 作为图注显示
      var alt = img.getAttribute('alt');
      if (alt && !img.closest('figure') && !img.closest('a')) {
        var figure = document.createElement('figure');
        img.parentNode.insertBefore(figure, img);
        figure.appendChild(img);
        var cap = document.createElement('figcaption');
        cap.textContent = alt;
        figure.appendChild(cap);
      }

      // 点击放大
      if (!img.closest('a')) {
        img.classList.add('is-zoomable');
        img.addEventListener('click', function () {
          var lb = ensureLightbox();
          var lbImg = lb.querySelector('img');
          lbImg.src = img.currentSrc || img.src;
          lbImg.alt = alt || '';
          lb.classList.add('is-open');
          lb.setAttribute('aria-hidden', 'false');
          document.documentElement.style.overflow = 'hidden';
        });
      }
    });
  }

  /* ---- 代码块内的空行/超长行不再溢出 ---- */
  function tidyCodeBlocks(container) {
    container.querySelectorAll('pre').forEach(function (pre) {
      pre.setAttribute('tabindex', '0');
    });
  }

  /* ---- 数据加载 ---- */
  function fetchDocsList() {
    return fetch('/api/docs.php?action=list')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success) throw new Error(json.error || 'Failed');
        return json.data || [];
      });
  }

  function fetchDocBySlug(slug) {
    return fetch('/api/docs.php?action=detail&slug=' + encodeURIComponent(slug))
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json || !json.success) return null;
        return json.data;
      })
      .catch(function () { return null; });
  }

  /* ---- 按分类分组 ---- */
  function groupByCategory(docs) {
    var groups = {};
    var order = [];
    docs.forEach(function (doc) {
      var cat = doc.category || '未分类';
      if (!groups[cat]) {
        groups[cat] = [];
        order.push(cat);
      }
      groups[cat].push(doc);
    });
    return { groups: groups, order: order };
  }

  /* ---- 侧边栏渲染 ---- */
  function renderSidebar(docs, currentSlug) {
    var nav = document.getElementById('docsSidebarNav');
    if (!nav) return;

    var grouped = groupByCategory(docs);
    var html = '';

    grouped.order.forEach(function (cat) {
      html += '<div class="docs-sidebar-group">';
      html += '<div class="docs-sidebar-group-title">' + escapeHtml(cat) + '</div>';
      grouped.groups[cat].forEach(function (doc) {
        var isActive = doc.slug === currentSlug;
        // 激活项默认展开：多一个三角折叠按钮 + 承载本页目录的容器，由 buildTOC 填充
        html += '<div class="docs-sidebar-item' + (isActive ? ' is-active is-expanded' : '') + '">';
        html += '<a href="/docs/' + encodeURIComponent(doc.slug) + '" class="docs-sidebar-link'
          + (isActive ? ' is-active' : '') + '">' + escapeHtml(doc.title) + '</a>';
        if (isActive) {
          html += '<button type="button" class="docs-sidebar-caret" aria-expanded="true"'
            + ' aria-controls="docsSubtoc" aria-label="收起本页目录">'
            + '<span class="docs-sidebar-caret-icon" aria-hidden="true">▼</span></button>';
          html += '<nav class="docs-sidebar-subtoc" id="docsSubtoc" aria-label="本页目录"></nav>';
        }
        html += '</div>';
      });
      html += '</div>';
    });

    nav.innerHTML = html || '<div class="docs-sidebar-empty">暂无文档</div>';
  }

  /* ---- 折叠三角：事件委托，绑定一次即可，不受重新渲染影响 ---- */
  function initCaretToggle() {
    var nav = document.getElementById('docsSidebarNav');
    if (!nav) return;

    nav.addEventListener('click', function (e) {
      var caret = e.target.closest('.docs-sidebar-caret');
      if (!caret) return;
      e.preventDefault();
      var item = caret.closest('.docs-sidebar-item');
      if (!item) return;
      var expanded = item.classList.toggle('is-expanded');
      caret.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      caret.setAttribute('aria-label', expanded ? '收起本页目录' : '展开本页目录');
    });
  }

  /* ---- 详情页：上一篇/下一篇导航 ---- */
  function renderFooterNav(docs, currentSlug) {
    var container = document.getElementById('docsFooterNav');
    if (!container) return;

    var idx = -1;
    for (var i = 0; i < docs.length; i++) {
      if (docs[i].slug === currentSlug) { idx = i; break; }
    }
    if (idx === -1) return;

    var html = '<div class="docs-pager">';
    if (idx > 0) {
      var prev = docs[idx - 1];
      html += '<a href="/docs/' + encodeURIComponent(prev.slug) + '" class="docs-pager-item docs-pager-prev">';
      html += '<span class="docs-pager-label">← 上一篇</span>';
      html += '<span class="docs-pager-title">' + escapeHtml(prev.title) + '</span>';
      html += '</a>';
    } else {
      html += '<div></div>';
    }
    if (idx < docs.length - 1) {
      var next = docs[idx + 1];
      html += '<a href="/docs/' + encodeURIComponent(next.slug) + '" class="docs-pager-item docs-pager-next">';
      html += '<span class="docs-pager-label">下一篇 →</span>';
      html += '<span class="docs-pager-title">' + escapeHtml(next.title) + '</span>';
      html += '</a>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  /* ---- 页内目录（内嵌在侧栏激活文档条目下方，默认展开） ---- */
  function buildTOC(contentEl) {
    var tocNav = document.getElementById('docsSubtoc');
    if (!tocNav) return;

    var item = tocNav.closest('.docs-sidebar-item');
    var caret = item ? item.querySelector('.docs-sidebar-caret') : null;
    var headings = contentEl.querySelectorAll('h2, h3');

    // 没有 h2/h3：整个展开项退回成普通条目，不留一个点不动的三角
    if (headings.length === 0) {
      if (caret) caret.remove();
      tocNav.remove();
      if (item) item.classList.remove('is-expanded');
      return;
    }

    headings.forEach(function (h, i) {
      if (!h.id) h.id = 'heading-' + i;
    });

    var html = '';
    // 展开状态由这里与 renderSidebar 共同保证，避免目录建好了却收着
    if (item) item.classList.add('is-expanded');

    headings.forEach(function (h) {
      var level = h.tagName === 'H3' ? ' docs-toc-link-h3' : '';
      html += '<a href="#' + h.id + '" class="docs-toc-link' + level + '">' + escapeHtml(h.textContent) + '</a>';
    });
    tocNav.innerHTML = html;

    // 滚动高亮当前小节
    var links = tocNav.querySelectorAll('.docs-toc-link');
    function onScroll() {
      var scrollY = window.scrollY + 120;
      var current = null;
      headings.forEach(function (h) {
        if (h.offsetTop <= scrollY) current = h;
      });
      links.forEach(function (link) {
        link.classList.toggle('is-active', !!current && link.getAttribute('href') === '#' + current.id);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- 侧边栏移动端折叠（文档列表 + 本页目录一起收起） ---- */
  function initSidebarToggle() {
    var toggle = document.getElementById('docsSidebarToggle');
    var sidebar = document.getElementById('docsSidebar');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', function () {
      var expanded = sidebar.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', expanded);
    });

    // 点击任意链接（文档或目录）后收起
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('.docs-sidebar-link, .docs-toc-link')) {
        sidebar.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- 初始化 ---- */
  function init() {
    var body = document.getElementById('docsBody');
    if (!body) return;

    var currentSlug = window.__DOCS_SLUG__ || '';
    initSidebarToggle();
    initCaretToggle();

    // 无论有没有 slug，左侧文档列表都要渲染
    fetchDocsList().then(function (docs) {
      renderSidebar(docs, currentSlug);

      // 未选择文档：保留 PHP 输出的占位提示
      if (!currentSlug) return null;

      return fetchDocBySlug(currentSlug).then(function (doc) {
        if (!doc) {
          document.title = '文档不存在 — 指南与文档 — UEMCraft';
          var crumb = document.getElementById('docsCrumb');
          if (crumb) crumb.textContent = '文档不存在';
          body.innerHTML = '<p>该文档不存在或尚未发布，请在左侧重新选择。</p>';
          return;
        }

        document.title = doc.title + ' — 指南与文档 — UEMCraft';
        var crumbEl = document.getElementById('docsCrumb');
        if (crumbEl) crumbEl.textContent = doc.title;

        if (typeof marked === 'undefined') {
          body.innerHTML = '<p>Markdown 引擎加载失败，请刷新重试。</p>';
          return;
        }

        marked.setOptions({ gfm: true, breaks: false, headerIds: true, mangle: false, sanitize: false });
        body.innerHTML = marked.parse(doc.content || '');
        wrapTables(body);
        enhanceImages(body);
        tidyCodeBlocks(body);
        enhanceCodeBlocks(body);

        buildTOC(body);
        renderFooterNav(docs, currentSlug);
      });
    }).catch(function () {
      var nav = document.getElementById('docsSidebarNav');
      if (nav) nav.innerHTML = '<div class="docs-sidebar-empty">加载文档列表失败，请刷新重试。</div>';
      if (currentSlug) {
        body.innerHTML = '<p>加载文档失败，请刷新重试。</p>';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
