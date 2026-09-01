/* ============================================================
   admin-list.js — 管理后台列表页（新闻/活动/作品/服务器/图片）
   依赖：admin-auth.js（UEMAdminAuth）
   由 admin/*.html 中的列表页加载。
   ============================================================ */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  // 跳过登录页和仪表盘（由各自模块处理）
  if (document.getElementById('loginForm')) return;
  if (document.querySelector('.admin-dashboard-grid') && !document.getElementById('newsList')) return;

  // 需要认证
  Auth.requireAuth().then(function () {
    if (document.getElementById('newsList')) initNewsList();
    else if (document.getElementById('eventsList')) initEventsList();
    else if (document.getElementById('worksList')) initWorksList();
    else if (document.getElementById('serversList')) initServersList();
    else if (document.getElementById('imagesGrid')) initImagesPage();
  }).catch(function () {});

  // 退出按钮
  document.querySelectorAll('#logoutBtn, #logoutBtn2').forEach(function (btn) {
    btn.addEventListener('click', function () { Auth.logout(); });
  });

  // ============================================================
  //  视图切换（网格/列表）
  // ============================================================
  function setupViewToggle(listEl) {
    var toggleEl = document.querySelector('.view-toggle');
    if (!toggleEl || !listEl) return;

    var btns = toggleEl.querySelectorAll('.view-toggle-btn');
    var saved = localStorage.getItem('uemcraft-admin-view') || 'list';

    function apply(mode) {
      btns.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-view') === mode); });
      listEl.classList.toggle('admin-list-grid', mode === 'grid');
      localStorage.setItem('uemcraft-admin-view', mode);
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () { apply(btn.getAttribute('data-view')); });
    });

    apply(saved);
  }

  // ============================================================
  //  新闻列表
  // ============================================================
  function initNewsList() {
    var currentStatus = 'all', currentPage = 1, limit = 20;
    var listEl = document.getElementById('newsList');
    var totalEl = document.getElementById('totalCount');
    var pagEl = document.getElementById('pagination');
    var prevBtn = document.getElementById('prevPage');
    var nextBtn = document.getElementById('nextPage');
    var infoEl = document.getElementById('pageInfo');

    function load() {
      var url = '../api/news.php?action=admin_list&page=' + currentPage + '&limit=' + limit;
      if (currentStatus !== 'all') url += '&status=' + currentStatus;
      listEl.innerHTML = '<div class="wall-loading">正在加载…</div>';

      Auth.api(url).then(function (json) {
        if (!json.success) { listEl.innerHTML = '<div class="wall-empty">加载失败</div>'; return; }
        totalEl.textContent = json.total;
        var items = json.data || [];
        if (items.length === 0) {
          listEl.innerHTML = '<div class="wall-empty">暂无新闻</div>';
          pagEl.style.display = 'none';
          return;
        }
        listEl.innerHTML = items.map(renderCard).join('');
        bindActions(listEl);
        updatePagination(json.page, json.pages, json.total);
      }).catch(function () { listEl.innerHTML = '<div class="wall-empty">加载失败</div>'; });
    }

    function renderCard(item) {
      var tags = (item.tags || []).map(function (t) { return '<span class="admin-badge">' + Auth.escapeHtml(t) + '</span>'; }).join(' ');
      var sc = item.status === 'published' ? 'is-approved' : 'is-hidden';
      var sl = item.status === 'published' ? '已发布' : '草稿';
      var thumb = item.cover || '';
      var pinBadge = item.is_pinned ? '<span class="admin-badge is-approved">置顶</span>' : '';
      return '<article class="admin-card' + (item.status === 'draft' ? ' is-hidden' : '') + '" data-id="' + item.id + '">'
        + (thumb ? '<div class="admin-card-thumb"><img src="' + Auth.escapeHtml(thumb) + '" alt="" loading="lazy"></div>' : '')
        + '<div class="admin-card-info"><span class="admin-card-name">' + Auth.escapeHtml(item.title) + '</span>'
        + '<div class="admin-card-title-row">' + pinBadge + '<span class="admin-badge ' + sc + '">' + sl + '</span>'
        + '<span class="admin-card-date">' + Auth.escapeHtml(item.date) + '</span></div></div>'
        + '<div class="admin-card-header"><div class="admin-card-meta"><span class="admin-card-name">' + Auth.escapeHtml(item.title) + '</span>'
        + pinBadge + '<span class="admin-badge ' + sc + '">' + sl + '</span><time class="wall-card-time">' + Auth.escapeHtml(item.date) + '</time> ' + tags + '</div>'
        + '<div class="admin-card-actions">'
        + '<button class="btn btn-ghost btn-sm" data-action="toggle-pinned" data-id="' + item.id + '" data-pinned="' + item.is_pinned + '">' + (item.is_pinned ? '取消置顶' : '置顶') + '</button>'
        + '<button class="btn btn-ghost btn-sm" data-action="toggle" data-id="' + item.id + '" data-status="' + item.status + '">' + (item.status === 'published' ? '设为草稿' : '发布') + '</button>'
        + '<a href="news-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '<button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button></div></div>'
        + '<div class="admin-card-body"><p class="text-muted">' + Auth.escapeHtml(item.excerpt || '无摘要') + '</p>'
        + '<small class="text-muted">slug: ' + Auth.escapeHtml(item.slug) + ' · 作者: ' + Auth.escapeHtml(item.author || '未知') + '</small></div>'
        + '<div class="admin-card-actions admin-card-actions--grid">'
        + '<button class="btn btn-ghost btn-sm" data-action="toggle-pinned" data-id="' + item.id + '" data-pinned="' + item.is_pinned + '">' + (item.is_pinned ? '取消置顶' : '置顶') + '</button>'
        + '<button class="btn btn-ghost btn-sm" data-action="toggle" data-id="' + item.id + '" data-status="' + item.status + '">' + (item.status === 'published' ? '草稿' : '发布') + '</button>'
        + '<a href="news-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '<button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button></div></article>';
    }

    function bindActions(container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action'), id = btn.getAttribute('data-id');
        if (action === 'toggle-pinned') {
          var np = btn.getAttribute('data-pinned') === '1' ? 0 : 1;
          Auth.api('../api/news.php?action=update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parseInt(id), is_pinned: np }) })
            .then(function (json) { if (json.success) load(); else alert('操作失败：' + (json.error || '未知错误')); });
        }
        if (action === 'toggle') {
          var ns = btn.getAttribute('data-status') === 'published' ? 'draft' : 'published';
          Auth.api('../api/news.php?action=update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parseInt(id), status: ns }) })
            .then(function (json) { if (json.success) load(); else alert('操作失败：' + (json.error || '未知错误')); });
        }
        if (action === 'delete') {
          if (!confirm('确定要删除这篇新闻吗？此操作不可撤销。')) return;
          Auth.api('../api/news.php?action=delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parseInt(id) }) })
            .then(function (json) { if (json.success) load(); else alert('删除失败：' + (json.error || '未知错误')); });
        }
      });
    }

    var tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        currentStatus = tab.getAttribute('data-status');
        currentPage = 1;
        load();
      });
    });

    function updatePagination(page, pages, total) {
      if (pages <= 1) { pagEl.style.display = 'none'; return; }
      pagEl.style.display = 'flex';
      prevBtn.disabled = page <= 1;
      nextBtn.disabled = page >= pages;
      infoEl.textContent = page + ' / ' + pages + '（共 ' + total + ' 条）';
    }
    prevBtn.addEventListener('click', function () { currentPage--; load(); });
    nextBtn.addEventListener('click', function () { currentPage++; load(); });

    setupViewToggle(listEl);
    load();
  }

  // ============================================================
  //  活动列表
  // ============================================================
  function initEventsList() {
    var currentStatus = 'all', currentPage = 1, limit = 20;
    var listEl = document.getElementById('eventsList');
    var totalEl = document.getElementById('totalCount');
    var pagEl = document.getElementById('pagination');
    var prevBtn = document.getElementById('prevPage');
    var nextBtn = document.getElementById('nextPage');
    var infoEl = document.getElementById('pageInfo');

    function load() {
      var url = '../api/events.php?action=admin_list&page=' + currentPage + '&limit=' + limit;
      if (currentStatus !== 'all') url += '&status=' + currentStatus;
      listEl.innerHTML = '<div class="wall-loading">正在加载…</div>';

      Auth.api(url).then(function (json) {
        if (!json.success) { listEl.innerHTML = '<div class="wall-empty">加载失败</div>'; return; }
        totalEl.textContent = json.total;
        var items = json.data || [];
        if (items.length === 0) { listEl.innerHTML = '<div class="wall-empty">暂无活动</div>'; pagEl.style.display = 'none'; return; }
        listEl.innerHTML = items.map(renderCard).join('');
        bindActions(listEl);
        updatePagination(json.page, json.pages, json.total);
      }).catch(function () { listEl.innerHTML = '<div class="wall-empty">加载失败</div>'; });
    }

    function renderCard(item) {
      var sm = { upcoming: '即将开始', ongoing: '进行中', past: '已结束' };
      var scm = { upcoming: 'status-upcoming', ongoing: 'status-ongoing', past: 'status-past' };
      var sl = sm[item.status] || item.status, sc = scm[item.status] || '';
      var thumb = item.cover || '';
      var featBadge = item.is_featured ? '<span class="admin-badge is-approved">精选</span>' : '';
      return '<article class="admin-card" data-id="' + item.id + '">'
        + (thumb ? '<div class="admin-card-thumb"><img src="' + Auth.escapeHtml(thumb) + '" alt="" loading="lazy"></div>' : '')
        + '<div class="admin-card-info"><span class="admin-card-name">' + Auth.escapeHtml(item.title) + '</span>'
        + '<div class="admin-card-title-row">' + featBadge + '<span class="admin-badge ' + sc + '">' + sl + '</span>'
        + '<span class="admin-card-date">' + Auth.escapeHtml(item.date_label || item.date_start || '') + '</span></div></div>'
        + '<div class="admin-card-header"><div class="admin-card-meta"><span class="admin-card-name">' + Auth.escapeHtml(item.title) + '</span>'
        + featBadge + '<span class="admin-badge ' + sc + '">' + sl + '</span><time class="wall-card-time">' + Auth.escapeHtml(item.date_label || item.date_start || '') + '</time></div>'
        + '<div class="admin-card-actions">'
        + '<button class="btn btn-ghost btn-sm" data-action="toggle-featured" data-id="' + item.id + '" data-featured="' + item.is_featured + '">' + (item.is_featured ? '取消精选' : '精选') + '</button>'
        + '<a href="events-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '<button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button></div></div>'
        + '<div class="admin-card-body"><p class="text-muted">' + Auth.escapeHtml(item.excerpt || '无摘要') + '</p>'
        + '<small class="text-muted">slug: ' + Auth.escapeHtml(item.slug) + ' · 排序: ' + item.sort_order + '</small></div>'
        + '<div class="admin-card-actions admin-card-actions--grid">'
        + '<button class="btn btn-ghost btn-sm" data-action="toggle-featured" data-id="' + item.id + '" data-featured="' + item.is_featured + '">' + (item.is_featured ? '取消精选' : '精选') + '</button>'
        + '<a href="events-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '<button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button></div></article>';
    }

    function bindActions(container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action'), id = btn.getAttribute('data-id');
        if (action === 'toggle-featured') {
          var nf = btn.getAttribute('data-featured') === '1' ? 0 : 1;
          Auth.api('../api/events.php?action=update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parseInt(id), is_featured: nf }) })
            .then(function (json) { if (json.success) load(); else alert('操作失败：' + (json.error || '未知错误')); });
        }
        if (action === 'delete') {
          if (!confirm('确定要删除这个活动吗？此操作不可撤销。')) return;
          Auth.api('../api/events.php?action=delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parseInt(id) }) })
            .then(function (json) { if (json.success) load(); else alert('删除失败：' + (json.error || '未知错误')); });
        }
      });
    }

    var tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        currentStatus = tab.getAttribute('data-status');
        currentPage = 1;
        load();
      });
    });

    function updatePagination(page, pages, total) {
      if (pages <= 1) { pagEl.style.display = 'none'; return; }
      pagEl.style.display = 'flex';
      prevBtn.disabled = page <= 1; nextBtn.disabled = page >= pages;
      infoEl.textContent = page + ' / ' + pages + '（共 ' + total + ' 条）';
    }
    prevBtn.addEventListener('click', function () { currentPage--; load(); });
    nextBtn.addEventListener('click', function () { currentPage++; load(); });

    setupViewToggle(listEl);
    load();
  }

  // ============================================================
  //  作品列表
  // ============================================================
  function initWorksList() {
    var currentStatus = 'all', currentPage = 1, limit = 20;
    var listEl = document.getElementById('worksList');
    var totalEl = document.getElementById('totalCount');
    var pagEl = document.getElementById('pagination');
    var prevBtn = document.getElementById('prevPage');
    var nextBtn = document.getElementById('nextPage');
    var infoEl = document.getElementById('pageInfo');

    function load() {
      var url = '../api/works.php?action=admin_list&page=' + currentPage + '&limit=' + limit;
      if (currentStatus !== 'all') url += '&status=' + currentStatus;
      listEl.innerHTML = '<div class="wall-loading">正在加载…</div>';

      Auth.api(url).then(function (json) {
        if (!json.success) { listEl.innerHTML = '<div class="wall-empty">加载失败</div>'; return; }
        totalEl.textContent = json.total;
        var items = json.data || [];
        if (items.length === 0) { listEl.innerHTML = '<div class="wall-empty">暂无作品</div>'; pagEl.style.display = 'none'; return; }
        listEl.innerHTML = items.map(renderCard).join('');
        bindActions(listEl);
        updatePagination(json.page, json.pages, json.total);
      }).catch(function () { listEl.innerHTML = '<div class="wall-empty">加载失败</div>'; });
    }

    function renderCard(item) {
      var sm = { published: '已发布', draft: '草稿' }, scm = { published: 'is-approved', draft: 'is-hidden' };
      var sl = sm[item.status] || item.status, sc = scm[item.status] || '';
      var thumb = item.cover || item.image || '';
      return '<article class="admin-card" data-id="' + item.id + '">'
        + (thumb ? '<div class="admin-card-thumb"><img src="' + Auth.escapeHtml(thumb) + '" alt="" loading="lazy"></div>' : '')
        + '<div class="admin-card-info"><span class="admin-card-name">' + Auth.escapeHtml(item.title) + '</span>'
        + '<div class="admin-card-title-row"><span class="admin-badge ' + sc + '">' + sl + '</span>'
        + (item.category ? '<span class="admin-badge">' + Auth.escapeHtml(item.category) + '</span>' : '') + '</div></div>'
        + '<div class="admin-card-header"><div class="admin-card-meta"><span class="admin-card-name">' + Auth.escapeHtml(item.title) + '</span>'
        + '<span class="admin-badge ' + sc + '">' + sl + '</span>' + (item.category ? '<span class="admin-badge">' + Auth.escapeHtml(item.category) + '</span>' : '') + '</div>'
        + '<div class="admin-card-actions"><a href="gallery-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '<button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button></div></div>'
        + '<div class="admin-card-body"><p class="text-muted">' + Auth.escapeHtml(item.description || '无描述') + '</p>'
        + '<small class="text-muted">slug: ' + Auth.escapeHtml(item.slug) + ' · 排序: ' + item.sort_order + '</small></div>'
        + '<div class="admin-card-actions admin-card-actions--grid"><a href="gallery-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '<button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button></div></article>';
    }

    function bindActions(container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.getAttribute('data-action') === 'delete') {
          if (!confirm('确定要删除这个作品吗？此操作不可撤销。')) return;
          Auth.api('../api/works.php?action=delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parseInt(btn.getAttribute('data-id')) }) })
            .then(function (json) { if (json.success) load(); else alert('删除失败：' + (json.error || '未知错误')); });
        }
      });
    }

    var tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        currentStatus = tab.getAttribute('data-status');
        currentPage = 1;
        load();
      });
    });

    function updatePagination(page, pages, total) {
      if (pages <= 1) { pagEl.style.display = 'none'; return; }
      pagEl.style.display = 'flex';
      prevBtn.disabled = page <= 1; nextBtn.disabled = page >= pages;
      infoEl.textContent = page + ' / ' + pages + '（共 ' + total + ' 条）';
    }
    prevBtn.addEventListener('click', function () { currentPage--; load(); });
    nextBtn.addEventListener('click', function () { currentPage++; load(); });

    setupViewToggle(listEl);
    load();
  }

  // ============================================================
  //  服务器列表
  // ============================================================
  function initServersList() {
    var currentPage = 1, limit = 20;
    var listEl = document.getElementById('serversList');
    var totalEl = document.getElementById('totalCount');
    var pagEl = document.getElementById('pagination');
    var prevBtn = document.getElementById('prevPage');
    var nextBtn = document.getElementById('nextPage');
    var infoEl = document.getElementById('pageInfo');

    function load() {
      listEl.innerHTML = '<div class="wall-loading">正在加载…</div>';
      Auth.api('../api/servers.php?action=admin_list&page=' + currentPage + '&limit=' + limit).then(function (json) {
        if (!json.success) { listEl.innerHTML = '<div class="wall-empty">加载失败</div>'; return; }
        totalEl.textContent = json.total;
        var items = json.data || [];
        if (items.length === 0) { listEl.innerHTML = '<div class="wall-empty">暂无服务器，点击上方按钮添加</div>'; if (pagEl) pagEl.style.display = 'none'; return; }
        listEl.innerHTML = items.map(renderCard).join('');
        bindActions(listEl);
        updatePagination(json.page, json.pages, json.total);
      }).catch(function () { listEl.innerHTML = '<div class="wall-empty">加载失败</div>'; });
    }

    function renderCard(item) {
      var addr = Auth.escapeHtml(item.address) + (item.port ? ':' + item.port : '');
      var el = item.edition === 'bedrock' ? '基岩版' : 'Java 版';
      var ec = item.edition === 'bedrock' ? 'is-bedrock' : 'is-java';
      var hideBadge = item.hide_address ? '<span class="admin-badge" style="background:var(--c-accent-4);color:#fff;">地址已隐藏</span>' : '';
      return '<article class="admin-card" data-id="' + item.id + '">'
        + '<div class="admin-card-info"><span class="admin-card-name">' + Auth.escapeHtml(item.name) + '</span>'
        + '<div class="admin-card-title-row">' + (item.is_featured ? '<span class="admin-badge is-approved">置顶</span>' : '')
        + hideBadge
        + '<span class="admin-badge admin-badge-edition ' + ec + '">' + el + '</span><span class="admin-card-date">' + addr + '</span></div></div>'
        + '<div class="admin-card-header"><div class="admin-card-meta"><span class="admin-card-name">' + Auth.escapeHtml(item.name) + '</span>'
        + (item.is_featured ? '<span class="admin-badge is-approved">置顶</span>' : '')
        + hideBadge
        + '<span class="admin-badge admin-badge-edition ' + ec + '">' + el + '</span></div>'
        + '<div class="admin-card-actions">'
        + '<button class="btn btn-ghost btn-sm" data-action="toggle-featured" data-id="' + item.id + '" data-featured="' + item.is_featured + '">' + (item.is_featured ? '取消置顶' : '置顶') + '</button>'
        + '<a href="servers-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '<button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button></div></div>'
        + '<div class="admin-card-body"><p class="text-muted"><code>' + addr + '</code></p>'
        + (item.note ? '<small class="text-muted">' + Auth.escapeHtml(item.note) + '</small>' : '')
        + '<small class="text-muted">排序: ' + item.sort_order + '</small></div>'
        + '<div class="admin-card-actions admin-card-actions--grid">'
        + '<button class="btn btn-ghost btn-sm" data-action="toggle-featured" data-id="' + item.id + '" data-featured="' + item.is_featured + '">' + (item.is_featured ? '取消置顶' : '置顶') + '</button>'
        + '<a href="servers-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '<button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button></div></article>';
    }

    function bindActions(container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-action'), id = btn.getAttribute('data-id');
        if (action === 'toggle-featured') {
          var nf = btn.getAttribute('data-featured') === '1' ? 0 : 1;
          Auth.api('../api/servers.php?action=update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parseInt(id), is_featured: nf }) })
            .then(function (json) { if (json.success) load(); else alert('操作失败：' + (json.error || '未知错误')); });
        }
        if (action === 'delete') {
          if (!confirm('确定要删除这台服务器吗？此操作不可撤销。')) return;
          Auth.api('../api/servers.php?action=delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: parseInt(id) }) })
            .then(function (json) { if (json.success) load(); else alert('删除失败：' + (json.error || '未知错误')); });
        }
      });
    }

    function updatePagination(page, pages, total) {
      if (!pagEl) return;
      if (pages <= 1) { pagEl.style.display = 'none'; return; }
      pagEl.style.display = 'flex';
      prevBtn.disabled = page <= 1; nextBtn.disabled = page >= pages;
      infoEl.textContent = page + ' / ' + pages + '（共 ' + total + ' 条）';
    }
    prevBtn.addEventListener('click', function () { currentPage--; load(); });
    nextBtn.addEventListener('click', function () { currentPage++; load(); });

    setupViewToggle(listEl);
    load();
  }

  // ============================================================
  //  图片管理
  // ============================================================
  function initImagesPage() {
    var gridEl = document.getElementById('imagesGrid');
    var totalEl = document.getElementById('totalCount');
    var uploadZone = document.getElementById('uploadZone');
    var fileInput = document.getElementById('fileInput');
    var progressEl = document.getElementById('uploadProgress');
    var barEl = document.getElementById('uploadBar');
    var statusEl = document.getElementById('uploadStatus');
    var refreshBtn = document.getElementById('refreshBtn');
    var currentFolder = 'news';

    var folderTabs = document.querySelectorAll('#folderTabs .admin-tab');
    folderTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        folderTabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        currentFolder = tab.getAttribute('data-folder');
        load();
      });
    });

    function load() {
      gridEl.innerHTML = '<div class="wall-loading">正在加载图片…</div>';
      Auth.api('../api/images.php?action=list&folder=' + currentFolder).then(function (json) {
        if (!json.success) { gridEl.innerHTML = '<div class="wall-empty">加载失败</div>'; return; }
        var items = json.data || [];
        totalEl.textContent = items.length;
        if (items.length === 0) { gridEl.innerHTML = '<div class="wall-empty">暂无图片，拖拽或点击上方区域上传</div>'; return; }
        gridEl.innerHTML = items.map(renderCard).join('');
      }).catch(function () { gridEl.innerHTML = '<div class="wall-empty">加载失败</div>'; });
    }

    function renderCard(item) {
      var sizeKB = Math.round(item.size / 1024);
      var sizeStr = sizeKB >= 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';
      var date = new Date(item.mtime * 1000);
      var dateStr = date.getFullYear() + '-' + Auth.pad(date.getMonth() + 1) + '-' + Auth.pad(date.getDate());
      return '<div class="admin-image-card" data-name="' + Auth.escapeHtml(item.name) + '" data-folder="' + Auth.escapeHtml(item.folder) + '">'
        + '<div class="admin-image-thumb"><img src="' + Auth.escapeHtml(item.url) + '" alt="' + Auth.escapeHtml(item.name) + '" loading="lazy"></div>'
        + '<div class="admin-image-info"><span class="admin-image-name" title="' + Auth.escapeHtml(item.name) + '">' + Auth.escapeHtml(item.name) + '</span>'
        + '<span class="text-muted">' + sizeStr + ' · ' + dateStr + '</span></div>'
        + '<div class="admin-image-actions">'
        + '<button class="btn btn-ghost btn-sm" data-action="copy-path" data-path="' + Auth.escapeHtml(item.url) + '">复制路径</button>'
        + '<button class="btn btn-ghost btn-sm" data-action="rename" data-name="' + Auth.escapeHtml(item.name) + '">重命名</button>'
        + '<button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-name="' + Auth.escapeHtml(item.name) + '">删除</button></div></div>';
    }

    // 事件委托
    gridEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');

      if (action === 'copy-path') {
        var path = btn.getAttribute('data-path');
        (window.UEMUtils ? window.UEMUtils.copyText(path) : navigator.clipboard.writeText(path)).then(function () {
          btn.textContent = '已复制';
          setTimeout(function () { btn.textContent = '复制路径'; }, 2000);
        });
        return;
      }

      if (action === 'delete') {
        var delName = btn.getAttribute('data-name');
        if (!confirm('确定要删除图片「' + delName + '」吗？')) return;
        Auth.api('../api/images.php?action=delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: delName, folder: currentFolder }) })
          .then(function (json) { if (json.success) load(); else alert('删除失败：' + (json.error || json.message || '未知错误')); })
          .catch(function () { alert('请求失败'); });
        return;
      }

      if (action === 'rename') {
        var card = btn.closest('.admin-image-card');
        var nameSpan = card.querySelector('.admin-image-name');
        var oldName = btn.getAttribute('data-name');
        if (card.querySelector('.admin-image-rename-input')) return;

        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'admin-image-rename-input';
        input.value = oldName;
        nameSpan.style.display = 'none';
        nameSpan.parentNode.insertBefore(input, nameSpan.nextSibling);
        input.focus();
        input.select();

        var actions = card.querySelectorAll('[data-action]');
        actions.forEach(function (a) { if (a.getAttribute('data-action') !== 'rename-confirm') a.style.display = 'none'; });

        var confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-primary btn-sm';
        confirmBtn.textContent = '确认';
        confirmBtn.setAttribute('data-action', 'rename-confirm');
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-ghost btn-sm';
        cancelBtn.textContent = '取消';
        cancelBtn.setAttribute('data-action', 'rename-cancel');
        btn.parentNode.appendChild(confirmBtn);
        btn.parentNode.appendChild(cancelBtn);
        btn.style.display = 'none';

        function finishRename() {
          input.remove(); nameSpan.style.display = '';
          confirmBtn.remove(); cancelBtn.remove();
          actions.forEach(function (a) { a.style.display = ''; });
        }

        function doRename() {
          var newName = input.value.trim();
          if (newName === '' || newName === oldName) { finishRename(); return; }
          Auth.api('../api/images.php?action=rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: oldName, newName: newName, folder: currentFolder }) })
            .then(function (json) { if (json.success) load(); else { alert('重命名失败：' + (json.error || json.message || '未知错误')); finishRename(); } })
            .catch(function () { alert('请求失败'); finishRename(); });
        }

        confirmBtn.addEventListener('click', doRename);
        cancelBtn.addEventListener('click', finishRename);
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); doRename(); }
          if (ev.key === 'Escape') { finishRename(); }
        });
        return;
      }
    });

    // 上传
    function uploadFiles(files) {
      if (!files || !files.length) return;
      var fileArr = Array.prototype.slice.call(files);
      var queue = [];
      for (var i = 0; i < fileArr.length; i++) {
        var defaultTitle = fileArr[i].name.replace(/\.[^.]+$/, '');
        var title = prompt('为图片「' + fileArr[i].name + '」输入标题：', defaultTitle);
        if (title === null) continue;
        queue.push({ file: fileArr[i], title: title.trim() || defaultTitle });
      }
      if (queue.length === 0) return;

      progressEl.style.display = 'flex';
      var total = queue.length, done = 0;

      function uploadNext() {
        if (done >= total) {
          statusEl.textContent = '上传完成';
          setTimeout(function () { progressEl.style.display = 'none'; barEl.style.width = '0%'; load(); }, 1000);
          return;
        }
        var item = queue[done];
        statusEl.textContent = '上传 ' + (done + 1) + '/' + total + ': ' + item.file.name;
        barEl.style.width = Math.round((done / total) * 100) + '%';

        var formData = new FormData();
        formData.append('file', item.file);
        formData.append('title', item.title);

        fetch('../api/images.php?action=upload&folder=' + currentFolder, {
          method: 'POST',
          headers: { 'X-Admin-Token': Auth.getToken() },
          body: formData
        }).then(function (res) { return res.json(); })
        .then(function () { done++; uploadNext(); })
        .catch(function () { done++; uploadNext(); });
      }
      uploadNext();
    }

    if (uploadZone) {
      uploadZone.addEventListener('dragover', function (e) { e.preventDefault(); uploadZone.classList.add('is-dragover'); });
      uploadZone.addEventListener('dragleave', function () { uploadZone.classList.remove('is-dragover'); });
      uploadZone.addEventListener('drop', function (e) { e.preventDefault(); uploadZone.classList.remove('is-dragover'); uploadFiles(e.dataTransfer.files); });
    }
    if (fileInput) {
      fileInput.addEventListener('change', function () { uploadFiles(fileInput.files); fileInput.value = ''; });
    }
    if (refreshBtn) refreshBtn.addEventListener('click', load);

    load();
  }
})();
