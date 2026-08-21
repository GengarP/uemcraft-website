/* ============================================================
   wall-admin.js — 留言墙管理页
   依赖 api/wall.php 的管理接口（X-Admin-Token 鉴权）
   使用 admin-auth.js 统一认证
   ============================================================ */

(function() {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  var API_URL = '../api/wall.php';
  var LIMIT = 20;

  // 元素
  var adminList = document.getElementById('adminList');
  var totalCount = document.getElementById('adminTotalCount');
  var pagination = document.getElementById('adminPagination');
  var prevBtn = document.getElementById('adminPrevPage');
  var nextBtn = document.getElementById('adminNextPage');
  var pageInfo = document.getElementById('adminPageInfo');
  var logoutBtn = document.getElementById('adminLogoutBtn');

  var tabs = document.querySelectorAll('.admin-tab');

  var currentStatus = 'all';
  var currentPage = 1;
  var totalPages = 1;

  /* ---- Helpers ---- */
  function pad(n) { return n < 10 ? '0' + n : n; }

  function formatDate(ts) {
    var d = new Date(ts * 1000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /* ---- API ---- */
  function apiRequest(action, options) {
    var url = API_URL + '?action=' + action;
    var fetchOptions = {
      method: 'GET',
      headers: {}
    };
    if (options && options.method) {
      fetchOptions.method = options.method;
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(options.body || {});
    }
    if (options && options.query) {
      url += '&' + options.query;
    }

    return Auth.api(url, fetchOptions);
  }

  function handleApiError(err, container) {
    if (container) {
      container.innerHTML = '<div class="wall-empty">' + escapeHtml(err.message || '加载失败') + '</div>';
    }
  }

  /* ---- 认证 ---- */
  Auth.requireAuth(API_URL + '?action=admin_list&page=1&limit=1&status=all')
    .then(function() {
      currentPage = 1;
      loadMessages(1);
    });

  logoutBtn.addEventListener('click', function() { Auth.logout(); });

  /* ---- 列表加载 ---- */
  function loadMessages(page) {
    page = page || 1;
    adminList.innerHTML = '<div class="wall-loading">正在加载留言…</div>';
    pagination.style.display = 'none';

    apiRequest('admin_list', {
      query: 'page=' + page + '&limit=' + LIMIT + '&status=' + currentStatus
    }).then(function(res) {
      renderMessages(res.data);
      currentPage = res.page;
      totalPages = res.pages;
      totalCount.textContent = res.total;
      renderPagination();
    }).catch(function(err) {
      handleApiError(err, adminList);
    });
  }

  function renderMessages(data) {
    if (!data || data.length === 0) {
      adminList.innerHTML = '<div class="wall-empty">当前筛选条件下没有留言。</div>';
      return;
    }

    var frag = document.createDocumentFragment();
    data.forEach(function(item) {
      frag.appendChild(renderCard(item));
    });
    adminList.innerHTML = '';
    adminList.appendChild(frag);
  }

  function renderCard(item) {
    var hidden = item.status === 'hidden';

    var card = document.createElement('article');
    card.className = 'admin-card' + (hidden ? ' is-hidden' : '');
    card.dataset.id = item.id;

    var header = document.createElement('div');
    header.className = 'admin-card-header';
    header.innerHTML =
      '<div class="admin-card-meta">' +
        '<span class="admin-card-name">' + escapeHtml(item.name) + '</span>' +
        '<span class="admin-badge ' + (hidden ? 'is-hidden' : 'is-approved') + '">' + (hidden ? '已屏蔽' : '已通过') + '</span>' +
        '<time class="wall-card-time">' + formatDate(item.created_at) + '</time>' +
      '</div>' +
      '<div class="admin-card-actions"></div>';

    var body = document.createElement('div');
    body.className = 'admin-card-body';
    body.innerHTML = escapeHtml(item.content).replace(/\n/g, '<br>');

    card.appendChild(header);
    card.appendChild(body);

    buildActions(header.querySelector('.admin-card-actions'), item, card);
    return card;
  }

  function buildActions(container, item, card) {
    var hidden = item.status === 'hidden';

    var auditBtn = document.createElement('button');
    auditBtn.type = 'button';
    auditBtn.className = 'btn btn-ghost btn-sm';
    auditBtn.textContent = hidden ? '恢复' : '屏蔽';
    auditBtn.addEventListener('click', function() {
      var target = hidden ? 'approved' : 'hidden';
      apiRequest('audit', { method: 'POST', body: { id: item.id, status: target } })
        .then(function() { loadMessages(currentPage); })
        .catch(function(err) { handleApiError(err, adminList); });
    });

    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost btn-sm';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', function() {
      enterEditMode(card, item);
    });

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-ghost btn-sm admin-btn-danger';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', function() {
      if (!window.confirm('确定删除「' + item.name + '」的这条留言？此操作不可撤销。')) return;
      apiRequest('delete', { method: 'POST', body: { id: item.id } })
        .then(function() { loadMessages(currentPage); })
        .catch(function(err) { handleApiError(err, adminList); });
    });

    container.appendChild(auditBtn);
    container.appendChild(editBtn);
    container.appendChild(delBtn);
  }

  /* ---- 行内编辑 ---- */
  function enterEditMode(card, item) {
    var body = card.querySelector('.admin-card-body');
    var actions = card.querySelector('.admin-card-actions');

    body.innerHTML =
      '<div class="admin-edit-form">' +
        '<label class="admin-edit-label">昵称<input type="text" id="editName" class="form-input" maxlength="20"></label>' +
        '<label class="admin-edit-label">内容<textarea id="editContent" class="form-textarea" rows="3" maxlength="500"></textarea></label>' +
        '<span id="editError" class="wall-form-message is-error"></span>' +
      '</div>';
    body.querySelector('#editName').value = item.name;
    body.querySelector('#editContent').value = item.content;

    actions.innerHTML = '';
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary btn-sm';
    saveBtn.textContent = '保存';
    saveBtn.addEventListener('click', function() {
      var name = body.querySelector('#editName').value.trim();
      var content = body.querySelector('#editContent').value.trim();
      var errEl = body.querySelector('#editError');
      if (name.length < 2 || name.length > 20) {
        errEl.textContent = '昵称长度需在 2–20 个字符之间';
        return;
      }
      if (!content || content.length > 500) {
        errEl.textContent = '内容不能为空且不超过 500 字符';
        return;
      }
      errEl.textContent = '';
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中…';
      apiRequest('edit', { method: 'POST', body: { id: item.id, name: name, content: content } })
        .then(function() { loadMessages(currentPage); })
        .catch(function(err) {
          saveBtn.disabled = false;
          saveBtn.textContent = '保存';
          errEl.textContent = err.message || '保存失败';
        });
    });

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-ghost btn-sm';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', function() { loadMessages(currentPage); });

    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
  }

  /* ---- 分页 ---- */
  function renderPagination() {
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    pageInfo.textContent = currentPage + ' / ' + totalPages;
    pagination.style.display = totalPages > 1 ? 'flex' : 'none';
  }

  prevBtn.addEventListener('click', function() {
    if (currentPage > 1) loadMessages(currentPage - 1);
  });
  nextBtn.addEventListener('click', function() {
    if (currentPage < totalPages) loadMessages(currentPage + 1);
  });

  /* ---- 状态筛选 ---- */
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      tabs.forEach(function(t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      currentStatus = tab.dataset.status;
      currentPage = 1;
      loadMessages(1);
    });
  });
})();
