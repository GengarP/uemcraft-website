/**
 * admin.js — UEMCraft 管理后台逻辑
 * ------------------------------------
 * 处理：登录页、仪表盘、新闻列表、活动列表
 * 依赖：admin-auth.js（UEMAdminAuth 全局对象）
 */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  // ---- 登录页（通过 DOM 检测，兼容 URL 重写） ----
  if (document.getElementById('loginForm')) {
    initLogin();
    return;
  }

  // ---- 其他后台页：检查认证 ----
  Auth.requireAuth().then(function () {
    if (document.getElementById('newsList')) {
      initNewsList();
    } else if (document.getElementById('eventsList')) {
      initEventsList();
    } else if (document.getElementById('worksList')) {
      initWorksList();
    } else if (document.getElementById('serversList')) {
      initServersList();
    } else if (document.getElementById('imagesGrid')) {
      initImagesPage();
    } else if (document.querySelector('.admin-dashboard-grid')) {
      initDashboard();
    }
  }).catch(function () {
    // 已跳转登录页
  });

  // ---- 退出按钮 ----
  var logoutBtns = document.querySelectorAll('#logoutBtn, #logoutBtn2');
  logoutBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { Auth.logout(); });
  });

  // ============================================================
  //  登录页
  // ============================================================
  function initLogin() {
    var form = document.getElementById('loginForm');
    var input = document.getElementById('tokenInput');
    var btn = document.getElementById('loginBtn');
    var msg = document.getElementById('loginMessage');

    if (!form) return;

    // 已有有效 token 则跳转（表单事件仍正常绑定）
    if (Auth.getToken()) {
      Auth.verify(Auth.getToken()).then(function (valid) {
        if (valid) window.location.href = 'index.html';
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var token = input.value.trim();
      if (!token) {
        showMessage(msg, '请输入令牌', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '验证中…';
      showMessage(msg, '', '');

      Auth.verify(token).then(function (valid) {
        if (valid) {
          Auth.saveToken(token);
          showMessage(msg, '验证成功，正在跳转…', 'success');
          setTimeout(function () { window.location.href = 'index.html'; }, 500);
        } else {
          showMessage(msg, '令牌无效，请重试', 'error');
          btn.disabled = false;
          btn.textContent = '进入管理';
        }
      }).catch(function () {
        showMessage(msg, '验证请求失败', 'error');
        btn.disabled = false;
        btn.textContent = '进入管理';
      });
    });
  }

  // ============================================================
  //  仪表盘
  // ============================================================
  function initDashboard() {
    // 加载新闻统计
    Auth.api('../api/news.php?action=admin_list&limit=1').then(function (json) {
      if (json.success) {
        var total = json.total || 0;
        Auth.api('../api/news.php?action=admin_list&limit=1&status=published').then(function (r) {
          var pub = r.success ? (r.total || 0) : 0;
          setText('newsPublished', pub);
          setText('newsDraft', total - pub);
        });
      }
    }).catch(function () {});

    // 加载活动统计
    Auth.api('../api/events.php?action=admin_list&limit=1').then(function (json) {
      if (json.success) {
        var total = json.total || 0;
        Auth.api('../api/events.php?action=admin_list&limit=1&status=upcoming').then(function (r1) {
          Auth.api('../api/events.php?action=admin_list&limit=1&status=ongoing').then(function (r2) {
            var up = (r1.success ? (r1.total || 0) : 0) + (r2.success ? (r2.total || 0) : 0);
            setText('eventsUpcoming', up);
            setText('eventsPast', total - up);
          });
        });
      }
    }).catch(function () {});

    // 加载作品统计
    Auth.api('../api/works.php?action=admin_list&limit=1').then(function (json) {
      if (json.success) {
        var total = json.total || 0;
        Auth.api('../api/works.php?action=admin_list&limit=1&status=published').then(function (r) {
          var pub = r.success ? (r.total || 0) : 0;
          setText('worksPublished', pub);
          setText('worksDraft', total - pub);
        });
      }
    }).catch(function () {});

    // 加载服务器统计
    Auth.api('../api/servers.php?action=admin_list&limit=1').then(function (json) {
      if (json.success) {
        setText('serverCount', json.total || 0);
      }
    }).catch(function () {});
  }

  // ============================================================
  //  新闻列表
  // ============================================================
  function initNewsList() {
    var currentStatus = 'all';
    var currentPage = 1;
    var limit = 20;
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
        if (!json.success) {
          listEl.innerHTML = '<div class="wall-empty">加载失败</div>';
          return;
        }

        totalEl.textContent = json.total;
        var items = json.data || [];

        if (items.length === 0) {
          listEl.innerHTML = '<div class="wall-empty">暂无新闻</div>';
          pagEl.style.display = 'none';
          return;
        }

        listEl.innerHTML = items.map(renderNewsCard).join('');
        bindNewsActions(listEl);
        updatePagination(json.page, json.pages, json.total);
      }).catch(function () {
        listEl.innerHTML = '<div class="wall-empty">加载失败</div>';
      });
    }

    function renderNewsCard(item) {
      var tags = (item.tags || []).map(function (t) {
        return '<span class="admin-badge">' + escapeHtml(t) + '</span>';
      }).join(' ');

      var statusClass = item.status === 'published' ? 'is-approved' : 'is-hidden';
      var statusLabel = item.status === 'published' ? '已发布' : '草稿';
      var thumb = item.cover || '';

      return '<article class="admin-card' + (item.status === 'draft' ? ' is-hidden' : '') + '" data-id="' + item.id + '">'
        + (thumb ? '<div class="admin-card-thumb"><img src="' + escapeHtml(thumb) + '" alt="" loading="lazy"></div>' : '')
        + '<div class="admin-card-info">'
        + '  <span class="admin-card-name">' + escapeHtml(item.title) + '</span>'
        + '  <div class="admin-card-title-row">'
        + '    <span class="admin-badge ' + statusClass + '">' + statusLabel + '</span>'
        + '    <span class="admin-card-date">' + escapeHtml(item.date) + '</span>'
        + '  </div>'
        + '</div>'
        + '<div class="admin-card-header">'
        + '  <div class="admin-card-meta">'
        + '    <span class="admin-card-name">' + escapeHtml(item.title) + '</span>'
        + '    <span class="admin-badge ' + statusClass + '">' + statusLabel + '</span>'
        + '    <time class="wall-card-time">' + escapeHtml(item.date) + '</time>'
        + '    ' + tags
        + '  </div>'
        + '  <div class="admin-card-actions">'
        + '    <button class="btn btn-ghost btn-sm" data-action="toggle" data-id="' + item.id + '" data-status="' + item.status + '">'
        + (item.status === 'published' ? '设为草稿' : '发布')
        + '    </button>'
        + '    <a href="news-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '    <button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button>'
        + '  </div>'
        + '</div>'
        + '<div class="admin-card-body">'
        + '  <p class="text-muted">' + escapeHtml(item.excerpt || '无摘要') + '</p>'
        + '  <small class="text-muted">slug: ' + escapeHtml(item.slug) + ' · 作者: ' + escapeHtml(item.author || '未知') + '</small>'
        + '</div>'
        + '<div class="admin-card-actions admin-card-actions--grid">'
        + '  <button class="btn btn-ghost btn-sm" data-action="toggle" data-id="' + item.id + '" data-status="' + item.status + '">'
        + (item.status === 'published' ? '草稿' : '发布')
        + '  </button>'
        + '  <a href="news-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '  <button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button>'
        + '</div>'
        + '</article>';
    }

    function bindNewsActions(container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');

        if (action === 'toggle') {
          var current = btn.getAttribute('data-status');
          var newStatus = current === 'published' ? 'draft' : 'published';
          Auth.api('../api/news.php?action=update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(id), status: newStatus })
          }).then(function (json) {
            if (json.success) load();
            else alert('操作失败：' + (json.error || '未知错误'));
          });
        }

        if (action === 'delete') {
          if (!confirm('确定要删除这篇新闻吗？此操作不可撤销。')) return;
          Auth.api('../api/news.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(id) })
          }).then(function (json) {
            if (json.success) load();
            else alert('删除失败：' + (json.error || '未知错误'));
          });
        }
      });
    }

    // Tab 切换
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

    // 分页
    function updatePagination(page, pages, total) {
      if (pages <= 1) {
        pagEl.style.display = 'none';
        return;
      }
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
    var currentStatus = 'all';
    var currentPage = 1;
    var limit = 20;
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
        if (!json.success) {
          listEl.innerHTML = '<div class="wall-empty">加载失败</div>';
          return;
        }

        totalEl.textContent = json.total;
        var items = json.data || [];

        if (items.length === 0) {
          listEl.innerHTML = '<div class="wall-empty">暂无活动</div>';
          pagEl.style.display = 'none';
          return;
        }

        listEl.innerHTML = items.map(renderEventCard).join('');
        bindEventActions(listEl);
        updatePagination(json.page, json.pages, json.total);
      }).catch(function () {
        listEl.innerHTML = '<div class="wall-empty">加载失败</div>';
      });
    }

    function renderEventCard(item) {
      var statusMap = { upcoming: '即将开始', ongoing: '进行中', past: '已结束' };
      var statusClassMap = { upcoming: 'status-upcoming', ongoing: 'status-ongoing', past: 'status-past' };
      var statusLabel = statusMap[item.status] || item.status;
      var statusClass = statusClassMap[item.status] || '';
      var thumb = item.cover || '';

      return '<article class="admin-card" data-id="' + item.id + '">'
        + (thumb ? '<div class="admin-card-thumb"><img src="' + escapeHtml(thumb) + '" alt="" loading="lazy"></div>' : '')
        + '<div class="admin-card-info">'
        + '  <span class="admin-card-name">' + escapeHtml(item.title) + '</span>'
        + '  <div class="admin-card-title-row">'
        + '    <span class="admin-badge ' + statusClass + '">' + statusLabel + '</span>'
        + '    <span class="admin-card-date">' + escapeHtml(item.date_label || item.date_start || '') + '</span>'
        + '  </div>'
        + '</div>'
        + '<div class="admin-card-header">'
        + '  <div class="admin-card-meta">'
        + '    <span class="admin-card-name">' + escapeHtml(item.title) + '</span>'
        + '    <span class="admin-badge ' + statusClass + '">' + statusLabel + '</span>'
        + '    <time class="wall-card-time">' + escapeHtml(item.date_label || item.date_start || '') + '</time>'
        + '  </div>'
        + '  <div class="admin-card-actions">'
        + '    <a href="events-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '    <button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button>'
        + '  </div>'
        + '</div>'
        + '<div class="admin-card-body">'
        + '  <p class="text-muted">' + escapeHtml(item.excerpt || '无摘要') + '</p>'
        + '  <small class="text-muted">slug: ' + escapeHtml(item.slug) + ' · 排序: ' + item.sort_order + '</small>'
        + '</div>'
        + '<div class="admin-card-actions admin-card-actions--grid">'
        + '  <a href="events-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '  <button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button>'
        + '</div>'
        + '</article>';
    }

    function bindEventActions(container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');

        if (action === 'delete') {
          if (!confirm('确定要删除这个活动吗？此操作不可撤销。')) return;
          Auth.api('../api/events.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(id) })
          }).then(function (json) {
            if (json.success) load();
            else alert('删除失败：' + (json.error || '未知错误'));
          });
        }
      });
    }

    // Tab 切换
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

    // 分页
    function updatePagination(page, pages, total) {
      if (pages <= 1) {
        pagEl.style.display = 'none';
        return;
      }
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
  //  作品列表
  // ============================================================
  function initWorksList() {
    var currentStatus = 'all';
    var currentPage = 1;
    var limit = 20;
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
        if (!json.success) {
          listEl.innerHTML = '<div class="wall-empty">加载失败</div>';
          return;
        }

        totalEl.textContent = json.total;
        var items = json.data || [];

        if (items.length === 0) {
          listEl.innerHTML = '<div class="wall-empty">暂无作品</div>';
          pagEl.style.display = 'none';
          return;
        }

        listEl.innerHTML = items.map(renderWorkCard).join('');
        bindWorkActions(listEl);
        updatePagination(json.page, json.pages, json.total);
      }).catch(function () {
        listEl.innerHTML = '<div class="wall-empty">加载失败</div>';
      });
    }

    function renderWorkCard(item) {
      var statusMap = { published: '已发布', draft: '草稿' };
      var statusClassMap = { published: 'is-approved', draft: 'is-hidden' };
      var statusLabel = statusMap[item.status] || item.status;
      var statusClass = statusClassMap[item.status] || '';
      var thumb = item.cover || item.image || '';

      return '<article class="admin-card" data-id="' + item.id + '">'
        + (thumb ? '<div class="admin-card-thumb"><img src="' + escapeHtml(thumb) + '" alt="" loading="lazy"></div>' : '')
        + '<div class="admin-card-info">'
        + '  <span class="admin-card-name">' + escapeHtml(item.title) + '</span>'
        + '  <div class="admin-card-title-row">'
        + '    <span class="admin-badge ' + statusClass + '">' + statusLabel + '</span>'
        + (item.category ? '<span class="admin-badge">' + escapeHtml(item.category) + '</span>' : '')
        + '  </div>'
        + '</div>'
        + '<div class="admin-card-header">'
        + '  <div class="admin-card-meta">'
        + '    <span class="admin-card-name">' + escapeHtml(item.title) + '</span>'
        + '    <span class="admin-badge ' + statusClass + '">' + statusLabel + '</span>'
        + (item.category ? '<span class="admin-badge">' + escapeHtml(item.category) + '</span>' : '')
        + '  </div>'
        + '  <div class="admin-card-actions">'
        + '    <a href="gallery-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '    <button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button>'
        + '  </div>'
        + '</div>'
        + '<div class="admin-card-body">'
        + '  <p class="text-muted">' + escapeHtml(item.description || '无描述') + '</p>'
        + '  <small class="text-muted">slug: ' + escapeHtml(item.slug) + ' · 排序: ' + item.sort_order + '</small>'
        + '</div>'
        + '<div class="admin-card-actions admin-card-actions--grid">'
        + '  <a href="gallery-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '  <button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button>'
        + '</div>'
        + '</article>';
    }

    function bindWorkActions(container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');

        if (action === 'delete') {
          if (!confirm('确定要删除这个作品吗？此操作不可撤销。')) return;
          Auth.api('../api/works.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(id) })
          }).then(function (json) {
            if (json.success) load();
            else alert('删除失败：' + (json.error || '未知错误'));
          });
        }
      });
    }

    // Tab 切换
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

    // 分页
    function updatePagination(page, pages, total) {
      if (pages <= 1) {
        pagEl.style.display = 'none';
        return;
      }
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
  //  服务器列表
  // ============================================================
  function initServersList() {
    var currentPage = 1;
    var limit = 20;
    var listEl = document.getElementById('serversList');
    var totalEl = document.getElementById('totalCount');
    var pagEl = document.getElementById('pagination');
    var prevBtn = document.getElementById('prevPage');
    var nextBtn = document.getElementById('nextPage');
    var infoEl = document.getElementById('pageInfo');

    function load() {
      var url = '../api/servers.php?action=admin_list&page=' + currentPage + '&limit=' + limit;
      listEl.innerHTML = '<div class="wall-loading">正在加载…</div>';

      Auth.api(url).then(function (json) {
        if (!json.success) {
          listEl.innerHTML = '<div class="wall-empty">加载失败</div>';
          return;
        }

        totalEl.textContent = json.total;
        var items = json.data || [];

        if (items.length === 0) {
          listEl.innerHTML = '<div class="wall-empty">暂无服务器，点击上方按钮添加</div>';
          if (pagEl) pagEl.style.display = 'none';
          return;
        }

        listEl.innerHTML = items.map(renderServerCard).join('');
        bindServerActions(listEl);
        updatePagination(json.page, json.pages, json.total);
      }).catch(function () {
        listEl.innerHTML = '<div class="wall-empty">加载失败</div>';
      });
    }

    function renderServerCard(item) {
      var addrDisplay = escapeHtml(item.address) + (item.port ? ':' + item.port : '');
      return '<article class="admin-card" data-id="' + item.id + '">'
        + '<div class="admin-card-info">'
        + '  <span class="admin-card-name">' + escapeHtml(item.name) + '</span>'
        + '  <div class="admin-card-title-row">'
        + (item.is_featured ? '<span class="admin-badge is-approved">置顶</span>' : '')
        + '    <span class="admin-card-date">' + addrDisplay + '</span>'
        + '  </div>'
        + '</div>'
        + '<div class="admin-card-header">'
        + '  <div class="admin-card-meta">'
        + '    <span class="admin-card-name">' + escapeHtml(item.name) + '</span>'
        + (item.is_featured ? '<span class="admin-badge is-approved">置顶</span>' : '')
        + '  </div>'
        + '  <div class="admin-card-actions">'
        + '    <button class="btn btn-ghost btn-sm" data-action="toggle-featured" data-id="' + item.id + '" data-featured="' + item.is_featured + '">'
        + (item.is_featured ? '取消置顶' : '置顶')
        + '    </button>'
        + '    <a href="servers-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '    <button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button>'
        + '  </div>'
        + '</div>'
        + '<div class="admin-card-body">'
        + '  <p class="text-muted"><code>' + addrDisplay + '</code></p>'
        + (item.note ? '  <small class="text-muted">' + escapeHtml(item.note) + '</small>' : '')
        + '  <small class="text-muted">排序: ' + item.sort_order + '</small>'
        + '</div>'
        + '<div class="admin-card-actions admin-card-actions--grid">'
        + '  <button class="btn btn-ghost btn-sm" data-action="toggle-featured" data-id="' + item.id + '" data-featured="' + item.is_featured + '">'
        + (item.is_featured ? '取消置顶' : '置顶')
        + '  </button>'
        + '  <a href="servers-edit.html?id=' + item.id + '" class="btn btn-ghost btn-sm">编辑</a>'
        + '  <button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-id="' + item.id + '">删除</button>'
        + '</div>'
        + '</article>';
    }

    function bindServerActions(container) {
      container.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;

        var action = btn.getAttribute('data-action');
        var id = btn.getAttribute('data-id');

        if (action === 'toggle-featured') {
          var newFeatured = btn.getAttribute('data-featured') === '1' ? 0 : 1;
          Auth.api('../api/servers.php?action=update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(id), is_featured: newFeatured })
          }).then(function (json) {
            if (json.success) load();
            else alert('操作失败：' + (json.error || '未知错误'));
          });
        }

        if (action === 'delete') {
          if (!confirm('确定要删除这台服务器吗？此操作不可撤销。')) return;
          Auth.api('../api/servers.php?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(id) })
          }).then(function (json) {
            if (json.success) load();
            else alert('删除失败：' + (json.error || '未知错误'));
          });
        }
      });
    }

    // 分页
    function updatePagination(page, pages, total) {
      if (!pagEl) return;
      if (pages <= 1) {
        pagEl.style.display = 'none';
        return;
      }
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

    // ---- 目录 Tab 切换 ----
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
        if (!json.success) {
          gridEl.innerHTML = '<div class="wall-empty">加载失败</div>';
          return;
        }

        var items = json.data || [];
        totalEl.textContent = items.length;

        if (items.length === 0) {
          gridEl.innerHTML = '<div class="wall-empty">暂无图片，拖拽或点击上方区域上传</div>';
          return;
        }

        gridEl.innerHTML = items.map(renderImageCard).join('');
      }).catch(function () {
        gridEl.innerHTML = '<div class="wall-empty">加载失败</div>';
      });
    }

    function renderImageCard(item) {
      var sizeKB = Math.round(item.size / 1024);
      var sizeStr = sizeKB >= 1024 ? (sizeKB / 1024).toFixed(1) + ' MB' : sizeKB + ' KB';
      var date = new Date(item.mtime * 1000);
      var dateStr = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());

      return '<div class="admin-image-card" data-name="' + escapeHtml(item.name) + '" data-folder="' + escapeHtml(item.folder) + '">'
        + '  <div class="admin-image-thumb">'
        + '    <img src="' + escapeHtml(item.url) + '" alt="' + escapeHtml(item.name) + '" loading="lazy">'
        + '  </div>'
        + '  <div class="admin-image-info">'
        + '    <span class="admin-image-name" title="' + escapeHtml(item.name) + '">' + escapeHtml(item.name) + '</span>'
        + '    <span class="text-muted">' + sizeStr + ' · ' + dateStr + '</span>'
        + '  </div>'
        + '  <div class="admin-image-actions">'
        + '    <button class="btn btn-ghost btn-sm" data-action="copy-path" data-path="' + escapeHtml(item.url) + '">复制路径</button>'
        + '    <button class="btn btn-ghost btn-sm" data-action="rename" data-name="' + escapeHtml(item.name) + '">重命名</button>'
        + '    <button class="btn btn-ghost btn-sm admin-btn-danger" data-action="delete" data-name="' + escapeHtml(item.name) + '">删除</button>'
        + '  </div>'
        + '</div>';
    }

    // ---- 事件委托 ----
    gridEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.getAttribute('data-action');

      // 复制路径
      if (action === 'copy-path') {
        var path = btn.getAttribute('data-path');
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(path).then(function () {
            btn.textContent = '已复制';
            setTimeout(function () { btn.textContent = '复制路径'; }, 2000);
          });
        } else {
          var ta = document.createElement('textarea');
          ta.value = path;
          ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); btn.textContent = '已复制'; }
          catch (err) { btn.textContent = '失败'; }
          document.body.removeChild(ta);
          setTimeout(function () { btn.textContent = '复制路径'; }, 2000);
        }
        return;
      }

      // 删除
      if (action === 'delete') {
        var delName = btn.getAttribute('data-name');
        if (!confirm('确定要删除图片「' + delName + '」吗？')) return;

        Auth.api('../api/images.php?action=delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: delName, folder: currentFolder })
        }).then(function (json) {
          if (json.success) {
            load();
          } else if (json.refs) {
            alert('无法删除：' + json.message);
          } else {
            alert('删除失败：' + (json.error || '未知错误'));
          }
        }).catch(function () {
          alert('请求失败');
        });
        return;
      }

      // 重命名（inline edit）
      if (action === 'rename') {
        var card = btn.closest('.admin-image-card');
        var nameSpan = card.querySelector('.admin-image-name');
        var oldName = btn.getAttribute('data-name');

        // 防止重复点击
        if (card.querySelector('.admin-image-rename-input')) return;

        // 替换文件名为输入框
        var input = document.createElement('input');
        input.type = 'text';
        input.className = 'admin-image-rename-input';
        input.value = oldName;
        nameSpan.style.display = 'none';
        nameSpan.parentNode.insertBefore(input, nameSpan.nextSibling);
        input.focus();
        input.select();

        // 隐藏其他操作按钮
        var actions = card.querySelectorAll('[data-action]');
        actions.forEach(function (a) {
          if (a.getAttribute('data-action') !== 'rename-confirm') {
            a.style.display = 'none';
          }
        });

        // 添加确认/取消按钮
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
          input.remove();
          nameSpan.style.display = '';
          confirmBtn.remove();
          cancelBtn.remove();
          actions.forEach(function (a) { a.style.display = ''; });
        }

        // 确认重命名
        function doRename() {
          var newName = input.value.trim();
          if (newName === '' || newName === oldName) {
            finishRename();
            return;
          }

          Auth.api('../api/images.php?action=rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: oldName, newName: newName, folder: currentFolder })
          }).then(function (json) {
            if (json.success) {
              load();
            } else if (json.refs) {
              alert('无法重命名：' + json.message);
              finishRename();
            } else {
              alert('重命名失败：' + (json.error || '未知错误'));
              finishRename();
            }
          }).catch(function () {
            alert('请求失败');
            finishRename();
          });
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
      var total = queue.length;
      var done = 0;

      function uploadNext() {
        if (done >= total) {
          statusEl.textContent = '上传完成';
          setTimeout(function () {
            progressEl.style.display = 'none';
            barEl.style.width = '0%';
            load();
          }, 1000);
          return;
        }

        var item = queue[done];
        statusEl.textContent = '上传 ' + (done + 1) + '/' + total + ': ' + item.file.name;
        barEl.style.width = Math.round((done / total) * 100) + '%';

        var formData = new FormData();
        formData.append('file', item.file);
        formData.append('title', item.title);

        var token = Auth.getToken();
        fetch('../api/images.php?action=upload&folder=' + currentFolder, {
          method: 'POST',
          headers: { 'X-Admin-Token': token },
          body: formData
        }).then(function (res) { return res.json(); })
        .then(function (json) {
          done++;
          if (!json.success) {
            console.warn('Upload failed:', item.file.name, json.error);
          }
          uploadNext();
        }).catch(function () {
          done++;
          uploadNext();
        });
      }

      uploadNext();
    }

    // 拖拽
    if (uploadZone) {
      uploadZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadZone.classList.add('is-dragover');
      });
      uploadZone.addEventListener('dragleave', function () {
        uploadZone.classList.remove('is-dragover');
      });
      uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadZone.classList.remove('is-dragover');
        uploadFiles(e.dataTransfer.files);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        uploadFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', load);
    }

    load();
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

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
      if (mode === 'grid') {
        listEl.classList.add('admin-list-grid');
      } else {
        listEl.classList.remove('admin-list-grid');
      }
      localStorage.setItem('uemcraft-admin-view', mode);
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-view'));
      });
    });

    apply(saved);
  }

  // ============================================================
  //  工具函数
  // ============================================================
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'wall-form-message';
    if (type) el.classList.add('is-' + type);
  }
})();
