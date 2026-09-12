/* ============================================================
   docs.js — 指南与文档页面逻辑
   处理文档列表页和详情页的内容加载与渲染。
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
        var active = doc.slug === currentSlug ? ' is-active' : '';
        html += '<a href="/docs/' + encodeURIComponent(doc.slug) + '" class="docs-sidebar-link' + active + '">' + escapeHtml(doc.title) + '</a>';
      });
      html += '</div>';
    });

    nav.innerHTML = html || '<div class="docs-sidebar-empty">暂无文档</div>';
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

  /* ---- TOC 生成 ---- */
  function buildTOC(contentEl) {
    var tocNav = document.getElementById('docsTocNav');
    if (!tocNav) return;

    var headings = contentEl.querySelectorAll('h2, h3');
    if (headings.length === 0) {
      var tocAside = document.getElementById('docsToc');
      if (tocAside) tocAside.style.display = 'none';
      return;
    }

    var html = '';
    headings.forEach(function (h, i) {
      var id = h.id || ('heading-' + i);
      h.id = id;
      var level = h.tagName === 'H3' ? ' docs-toc-link-h3' : '';
      html += '<a href="#' + id + '" class="docs-toc-link' + level + '">' + escapeHtml(h.textContent) + '</a>';
    });
    tocNav.innerHTML = html;

    // Scroll spy
    var links = tocNav.querySelectorAll('.docs-toc-link');
    function onScroll() {
      var scrollY = window.scrollY + 120;
      var current = null;
      headings.forEach(function (h) {
        if (h.offsetTop <= scrollY) current = h;
      });
      links.forEach(function (link) {
        link.classList.toggle('is-active', current && link.getAttribute('href') === '#' + current.id);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- 侧边栏移动端折叠 ---- */
  function initSidebarToggle() {
    var toggle = document.getElementById('docsSidebarToggle');
    var sidebar = document.getElementById('docsSidebar');
    if (!toggle || !sidebar) return;

    toggle.addEventListener('click', function () {
      var expanded = sidebar.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', expanded);
    });

    // 点击链接后关闭
    sidebar.addEventListener('click', function (e) {
      if (e.target.classList.contains('docs-sidebar-link')) {
        sidebar.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---- 初始化 ---- */
  function init() {
    var currentSlug = window.__DOCS_SLUG__ || '';

    // 文档详情页
    if (document.getElementById('docsBody')) {
      if (!currentSlug) return;

      // 加载侧边栏 + 详情
      Promise.all([
        fetchDocsList(),
        fetchDocBySlug(currentSlug)
      ]).then(function (results) {
        var docs = results[0];
        var doc = results[1];

        renderSidebar(docs, currentSlug);

        if (!doc) {
          document.title = '文档不存在 — 指南与文档 — UEMCraft';
          document.getElementById('docsBody').innerHTML = '<p>文档不存在，<a href="/docs/">返回文档列表</a>。</p>';
          return;
        }

        document.title = doc.title + ' — 指南与文档 — UEMCraft';
        var crumb = document.getElementById('docsCrumb');
        if (crumb) crumb.textContent = doc.title;

        var body = document.getElementById('docsBody');
        if (typeof marked !== 'undefined') {
          marked.setOptions({ gfm: true, breaks: false, headerIds: true, mangle: false, sanitize: false });
          body.innerHTML = marked.parse(doc.content || '');
          enhanceCodeBlocks(body);
        } else {
          body.innerHTML = '<p>Markdown 引擎加载失败，请刷新重试。</p>';
        }

        buildTOC(body);
        renderFooterNav(docs, currentSlug);
      }).catch(function () {
        var body = document.getElementById('docsBody');
        if (body) body.innerHTML = '<p>加载文档失败，请刷新重试。</p>';
      });

      initSidebarToggle();
      return;
    }

    // 文档首页
    var indexGrid = document.getElementById('docsIndexGrid');
    if (indexGrid) {
      fetchDocsList().then(function (docs) {
        if (docs.length === 0) {
          indexGrid.innerHTML = '<div class="docs-index-empty">暂无文档，敬请期待。</div>';
          return;
        }

        var grouped = groupByCategory(docs);
        var html = '';

        grouped.order.forEach(function (cat) {
          html += '<div class="docs-index-category">';
          html += '<h3 class="docs-index-cat-title">' + escapeHtml(cat) + '</h3>';
          html += '<div class="docs-index-cat-list">';
          grouped.groups[cat].forEach(function (doc) {
            html += '<a href="/docs/' + encodeURIComponent(doc.slug) + '" class="docs-index-card">';
            html += '<span class="docs-index-card-title">' + escapeHtml(doc.title) + '</span>';
            html += '</a>';
          });
          html += '</div></div>';
        });

        indexGrid.innerHTML = html;
      }).catch(function () {
        indexGrid.innerHTML = '<p style="color:var(--c-text-muted);">加载文档列表失败，请刷新重试。</p>';
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
