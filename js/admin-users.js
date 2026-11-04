/* ============================================================
   admin-users.js — 用户与权限管理页（仅超级管理员）
   依赖：admin-auth.js（UEMAdminAuth）、api/admin.php
   功能：查看用户、设为管理员/普通用户、分配模块权限、转交超管。
   ============================================================ */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  var API = '../api/admin.php';
  var statusEl = document.getElementById('usersStatus');
  var listEl = document.getElementById('usersList');
  var msgEl = document.getElementById('usersMessage');
  if (!listEl) return;

  var nodes = [];        // [{key,label}]
  var users = [];
  var currentUser = null;

  function escapeHtml(text) {
    return Auth.escapeHtml(text);
  }

  function setMessage(text, type) {
    Auth.showMessage(msgEl, text, type);
  }

  function formatTs(ts) {
    if (!ts) return '从未登录';
    var d = new Date(ts * 1000);
    return d.getFullYear() + '-' + Auth.pad(d.getMonth() + 1) + '-' + Auth.pad(d.getDate());
  }

  function roleLabel(role) {
    return role === 'super_admin' ? '超级管理员' : role === 'admin' ? '管理员' : '普通用户';
  }

  function roleBadge(role) {
    return '<span class="admin-role-badge is-' + role + '">' + roleLabel(role) + '</span>';
  }

  function permsChips(user) {
    if (user.role === 'super_admin') {
      return '<span class="admin-user-chip">全部模块</span>';
    }
    if (!user.perms || !user.perms.length) {
      return '<span class="text-muted">未分配权限</span>';
    }
    var out = '';
    user.perms.forEach(function (key) {
      var node = null;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].key === key) { node = nodes[i]; break; }
      }
      if (node) out += '<span class="admin-user-chip">' + escapeHtml(node.label) + '</span>';
    });
    return out;
  }

  function renderForbidden() {
    var main = document.getElementById('main') || document.body;
    main.innerHTML = '<div class="admin-forbidden">'
      + '<h1>无权限</h1>'
      + '<p>只有超级管理员可以访问用户与权限管理。</p>'
      + '<p><a class="btn btn-primary" href="index.html">返回仪表盘</a>'
      + '<a class="btn btn-ghost" href="/index.html">返回网站</a></p>'
      + '</div>';
  }

  function render() {
    var html = '';
    users.forEach(function (u) {
      var isSelf = currentUser && u.id === currentUser.id;
      var isSuper = u.role === 'super_admin';

      html += '<div class="admin-user-row" data-id="' + u.id + '" data-role="' + u.role + '">';
      html += '<div class="admin-user-main">';
      var nameText = u.nickname || ('用户 ' + u.id);
      html += '<div class="admin-user-name"><span class="admin-user-name-text" title="' + escapeHtml(nameText).replace(/"/g, '&quot;') + '">' + escapeHtml(nameText) + '</span>' + roleBadge(u.role) + '</div>';
      html += '<div class="admin-user-meta">' + escapeHtml(u.email || '未提供邮箱')
        + (u.player_name ? ' - 角色 ' + escapeHtml(u.player_name) : '')
        + ' - 最近登录 ' + formatTs(u.last_login_at) + '</div>';
      html += '<div class="admin-user-chips">' + permsChips(u) + '</div>';
      html += '</div>';

      html += '<div class="admin-user-actions">';
      if (isSuper) {
        html += '<span class="text-muted">' + (isSelf ? '当前账号' : '超级管理员') + '</span>';
      } else {
        if (u.role === 'admin') {
          html += '<button type="button" class="btn btn-ghost btn-sm" data-act="perms">分配权限</button>';
          html += '<button type="button" class="btn btn-ghost btn-sm" data-act="demote">设为普通用户</button>';
        } else {
          html += '<button type="button" class="btn btn-ghost btn-sm" data-act="promote">设为管理员</button>';
        }
        html += '<button type="button" class="btn btn-ghost btn-sm" data-act="transfer">转交超管</button>';
      }
      html += '</div>';

      if (u.role === 'admin') {
        html += '<div class="admin-user-perms" style="display:none;">';
        nodes.forEach(function (n) {
          var checked = (u.perms || []).indexOf(n.key) !== -1 ? ' checked' : '';
          html += '<label class="admin-perm-option"><input type="checkbox" value="' + n.key + '"' + checked + '> '
            + escapeHtml(n.label) + '</label>';
        });
        html += '<div class="admin-user-perms-actions">'
          + '<button type="button" class="btn btn-primary btn-sm" data-act="save-perms">保存权限</button>'
          + '</div></div>';
      }

      html += '</div>';
    });
    listEl.innerHTML = html;
  }

  function post(action, body) {
    return Auth.api(API + '?action=' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  function handleError(err) {
    setMessage(err && err.message ? err.message : '操作失败，请稍后重试', 'error');
  }

  function loadAll() {
    Promise.all([
      Auth.api(API + '?action=nodes'),
      Auth.api(API + '?action=users_list')
    ]).then(function (results) {
      if (!results[0].success) throw new Error(results[0].error || '加载权限节点失败');
      if (!results[1].success) throw new Error(results[1].error || '加载用户列表失败');
      nodes = results[0].data || [];
      users = results[1].data || [];
      statusEl.style.display = 'none';
      render();
    }).catch(function (err) {
      statusEl.textContent = (err && err.message) || '加载失败，请刷新重试';
    });
  }

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('button[data-act]') : null;
    if (!btn) return;
    var row = btn.closest('.admin-user-row');
    if (!row) return;
    var userId = parseInt(row.getAttribute('data-id'), 10);
    var act = btn.getAttribute('data-act');

    if (act === 'perms') {
      var panel = row.querySelector('.admin-user-perms');
      if (panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
      return;
    }

    if (act === 'promote') {
      if (!window.confirm('将用户设为管理员？之后可为 TA 勾选可操作的模块。')) return;
      post('set_role', { user_id: userId, role: 'admin' }).then(function (json) {
        if (!json.success) throw new Error(json.error || '操作失败');
        setMessage('已设为管理员', 'success');
        loadAll();
      }).catch(handleError);
      return;
    }

    if (act === 'demote') {
      if (!window.confirm('将该管理员设为普通用户？TA 的权限将被清空。')) return;
      post('set_role', { user_id: userId, role: 'user' }).then(function (json) {
        if (!json.success) throw new Error(json.error || '操作失败');
        setMessage('已设为普通用户', 'success');
        loadAll();
      }).catch(handleError);
      return;
    }

    if (act === 'save-perms') {
      var checked = row.querySelectorAll('.admin-user-perms input:checked');
      var perms = [];
      for (var i = 0; i < checked.length; i++) perms.push(checked[i].value);
      post('set_perms', { user_id: userId, nodes: perms }).then(function (json) {
        if (!json.success) throw new Error(json.error || '保存失败');
        setMessage('权限已保存', 'success');
        for (var j = 0; j < users.length; j++) {
          if (users[j].id === userId) users[j] = json.data;
        }
        render();
      }).catch(handleError);
      return;
    }

    if (act === 'transfer') {
      if (!window.confirm('确认把超级管理员身份转交给该用户？转交后你将变回普通用户，且无法撤销。')) return;
      post('transfer_super', { user_id: userId }).then(function (json) {
        if (!json.success) throw new Error(json.error || '操作失败');
        setMessage('已转交超级管理员，正在刷新…', 'success');
        setTimeout(function () { window.location.reload(); }, 1200);
      }).catch(handleError);
    }
  });

  Auth.requireAuth().then(function (user) {
    currentUser = user;
    if (user.role !== 'super_admin') {
      renderForbidden();
      return;
    }
    loadAll();
  }).catch(function () {});
})();
