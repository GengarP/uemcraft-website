/* ============================================================
   wall-admin.js — 留言墙管理页
   依赖 api/wall.php 的管理接口（X-Admin-Token 鉴权）
   ============================================================ */

(function() {
  'use strict';

  var API_URL = '../api/wall.php';
  var LIMIT = 20;
  var TOKEN_KEY = 'uemcraft-wall-admin-token';

  var token = localStorage.getItem(TOKEN_KEY) || '';

  // 元素
  var tokenSection = document.getElementById('adminTokenSection');
  var tokenForm = document.getElementById('adminTokenForm');
  var tokenInput = document.getElementById('adminTokenInput');
  var connectBtn = document.getElementById('adminConnectBtn');
  var tokenMessage = document.getElementById('adminTokenMessage');

  var panelSection = document.getElementById('adminPanelSection');
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

  function showTokenMessage(msg, type) {
    tokenMessage.textContent = msg;
    tokenMessage.className = 'wall-form-message is-' + (type || 'info');
  }

  function setConnecting(isLoading) {
    connectBtn.disabled = isLoading;
    connectBtn.textContent = isLoading ? '验证中…' : '进入管理';
  }

  /* ---- API ---- */
  function apiRequest(action, options) {
    var url = API_URL + '?action=' + action;
    var opts = {
      method: 'GET',
      headers: { 'X-Admin-Token': token }
    };
    if (options && options.method) {
      opts.method = options.method;
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(options.body || {});
    }
    if (options && options.query) {
      url += '&' + options.query;
    }

    return fetch(url, opts).then(function(res) {
      return res.json().then(function(data) {
        if (!res.ok || !data.success) {
          var err = new Error(data.error || ('HTTP ' + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function handleApiError(err, container) {
    if (err.status === 403) {
      // 令牌失效，回到登录态
      logout();
      return;
    }
    if (container) {
      container.innerHTML = '<div class="wall-empty">' + escapeHtml(err.message || '加载失败') + '</div>';
    }
  }

  /* ---- 登录 / 退出 ---- */
  function login(tokenValue) {
    token = tokenValue;
    localStorage.setItem(TOKEN_KEY, token);
    tokenSection.hidden = true;
    panelSection.hidden = false;
    currentPage = 1;
    loadMessages(1);
  }

  function logout() {
    token = '';
    localStorage.removeItem(TOKEN_KEY);
    tokenSection.hidden = false;
    panelSection.hidden = true;
    tokenInput.value = '';
    showTokenMessage('');
  }

  tokenForm.addEventListener('submit', function(e) {
    e.preventDefault();
    var value = (tokenInput.value || '').trim();
    if (!value) {
      showTokenMessage('请输入管理员令牌', 'error');
      return;
    }
    setConnecting(true);
    showTokenMessage('');

    token = value;
    apiRequest('admin_list', { query: 'page=1&limit=1&status=all' })
      .then(function() {
        login(value);
      })
      .catch(function(err) {
        token = '';
        setConnecting(false);
        showTokenMessage(err.message || '令牌无效', 'error');
      });
  });

  logoutBtn.addEventListener('click', logout);

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

    // 审核（屏蔽/恢复）
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

    // 编辑
    var editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost btn-sm';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', function() {
      enterEditMode(card, item);
    });

    // 删除
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

  /* ---- 初始化 ---- */
  if (token) {
    // 已有令牌，直接尝试进入
    apiRequest('admin_list', { query: 'page=1&limit=1&status=all' })
      .then(function() { login(token); })
      .catch(function() { logout(); });
  }
})();
