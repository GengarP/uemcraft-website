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
        // 简单统计：显示总数，分别查 published 和 draft
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

      return '<article class="admin-card' + (item.status === 'draft' ? ' is-hidden' : '') + '" data-id="' + item.id + '">'
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

      return '<article class="admin-card" data-id="' + item.id + '">'
        + '<div class="admin-card-header">'
        + '  <div class="admin-card-meta">'
        + '    <span class="admin-card-name">' + escapeHtml(item.title) + '</span>'
        + '    <span class="admin-badge ' + statusClass + '">' + statusLabel + '</span>'
        + '    <time class="wall-card-time">' + escapeHtml(item.date_label || item.date_start || '') + '</time>'
        + (item.is_featured ? '<span class="admin-badge is-approved">置顶</span>' : '')
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

    load();
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
