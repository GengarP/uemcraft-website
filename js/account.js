/* ============================================================
   account.js — 我的档案（私有编辑页）
   未登录展示登录/注册引导；已登录加载档案表单并保存。
   昵称/头像/邮箱由皮肤站同步，本页只编辑用户自填字段。
   ============================================================ */
(function () {
  'use strict';

  var API_AUTH = '../api/auth.php';
  var API_USER = '../api/user.php';
  var MAX_SOCIAL = 6;

  var LOGIN_ERRORS = {
    state: '登录状态已过期或无效，请重新登录',
    denied: '你在皮肤站取消了授权，未能完成登录',
    exchange: '与皮肤站通信失败，请稍后重试',
    userinfo: '获取皮肤站用户信息失败，请稍后重试'
  };

  function escapeHtml(text) {
    var u = window.UEMUtils;
    return u ? u.escapeHtml(text) : (function () {
      var d = document.createElement('div');
      d.textContent = text || '';
      return d.innerHTML;
    })();
  }

  /* 属性值需额外转义双引号（escapeHtml 只处理 & < >） */
  function escapeAttr(text) {
    return escapeHtml(text).replace(/"/g, '&quot;');
  }

  function formatTs(ts) {
    if (!ts) return '-';
    var d = new Date(ts * 1000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function setMessage(el, text, kind) {
    el.textContent = text;
    el.className = 'wall-form-message' + (kind ? ' is-' + kind : '');
  }

  /* ---- 页面状态 ---- */
  var state = {
    userId: 0,
    players: [],
    currentUuid: '',
    socialLinks: []
  };

  function renderSocialRows() {
    var list = document.getElementById('socialList');
    if (!state.socialLinks.length) {
      list.innerHTML = '<div class="form-hint">暂无社交链接</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < state.socialLinks.length; i++) {
      var link = state.socialLinks[i];
      html += '<div class="account-social-row" data-index="' + i + '">';
      html += '<input type="text" class="form-input" data-field="label" maxlength="20" placeholder="名称（如 B站）" value="' + escapeAttr(link.label) + '">';
      html += '<input type="text" class="form-input" data-field="url" maxlength="200" placeholder="https://…" value="' + escapeAttr(link.url) + '">';
      html += '<button type="button" class="btn btn-ghost account-social-remove">删除</button>';
      html += '</div>';
    }
    list.innerHTML = html;
  }

  function renderPlayers() {
    var wrap = document.getElementById('playerList');
    if (!state.players.length) {
      wrap.innerHTML = '<div class="form-hint">皮肤站账号暂无角色，或未授予角色读取权限</div>';
      return;
    }
    var html = '<label class="account-player-option pixel-check">';
    html += '<input type="radio" name="displayPlayer" value=""' + (state.currentUuid ? '' : ' checked') + '>';
    html += '<span class="account-player-name">不展示角色</span></label>';
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i] || {};
      var name = p.name || '';
      var uuid = p.id || '';
      var avatar = 'https://skin.uemcraft.cn/avatar/player/' + encodeURIComponent(name) + '?size=64&png=true';
      var checked = state.currentUuid && uuid === state.currentUuid ? ' checked' : '';
      html += '<label class="account-player-option pixel-check">';
      html += '<input type="radio" name="displayPlayer" value="' + escapeAttr(uuid) + '"' + checked + '>';
      html += '<img src="' + escapeAttr(avatar) + '" alt="">';
      html += '<span class="account-player-name" title="' + escapeAttr(name) + '">' + escapeHtml(name) + '</span>';
      html += '<span class="account-player-uuid" title="' + escapeAttr(uuid) + '">' + escapeHtml(uuid) + '</span>';
      html += '</label>';
    }
    wrap.innerHTML = html;
  }

  function fillForm(user) {
    state.userId = user.id;
    state.players = user.players || [];
    state.currentUuid = user.player_uuid || '';
    state.socialLinks = [];
    for (var i = 0; i < (user.social_links || []).length; i++) {
      var link = user.social_links[i] || {};
      state.socialLinks.push({ label: String(link.label || ''), url: String(link.url || '') });
    }

    var avatar = document.getElementById('accountAvatar');
    if (user.avatar) {
      avatar.src = user.avatar;
      avatar.alt = user.nickname || '';
      avatar.style.display = '';
    } else {
      avatar.style.display = 'none';
    }
    var nickEl = document.getElementById('accountNickname');
    nickEl.textContent = user.nickname || '未命名用户';
    nickEl.title = user.nickname || '';
    // 角色徽章（普通用户 / 管理员 / 超级管理员）
    var roleEl = document.getElementById('accountRole');
    if (roleEl) {
      var role = user.role || 'user';
      roleEl.className = 'account-role is-' + role;
      roleEl.textContent = role === 'super_admin' ? '超级管理员' : (role === 'admin' ? '管理员' : '普通用户');
    }
    document.getElementById('accountEmail').textContent = user.email || '（未提供）';
    document.getElementById('accountCreated').textContent = formatTs(user.created_at);

    var bio = document.getElementById('bio');
    bio.value = user.bio || '';
    document.getElementById('bioCount').textContent = String(bio.value.length);
    document.getElementById('contact').value = user.contact || '';
    document.getElementById('showContact').checked = !!user.show_contact;
    document.getElementById('isPublic').checked = !!user.is_public;
    document.getElementById('publicLink').href = '/profile/?id=' + user.id;

    renderSocialRows();
    renderPlayers();
  }

  /* 收集并校验表单；校验失败返回 null 并提示 */
  function collectPayload() {
    var message = document.getElementById('formMessage');
    var links = [];
    for (var i = 0; i < state.socialLinks.length; i++) {
      var label = state.socialLinks[i].label.trim();
      var url = state.socialLinks[i].url.trim();
      if (label === '' && url === '') continue; // 空行视为未使用
      if (label === '' || url === '') {
        setMessage(message, '社交链接的名称与地址需填写完整', 'error');
        return null;
      }
      if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) {
        setMessage(message, '社交链接地址应以 http:// 或 https:// 开头', 'error');
        return null;
      }
      links.push({ label: label, url: url });
    }

    var selected = document.querySelector('input[name="displayPlayer"]:checked');
    return {
      bio: document.getElementById('bio').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      show_contact: document.getElementById('showContact').checked ? 1 : 0,
      social_links: links,
      player_uuid: selected ? selected.value : '',
      is_public: document.getElementById('isPublic').checked ? 1 : 0
    };
  }

  function bindForm() {
    var bio = document.getElementById('bio');
    bio.addEventListener('input', function () {
      document.getElementById('bioCount').textContent = String(bio.value.length);
    });

    // 社交链接行内编辑 / 删除（事件委托，行随状态重建）
    var socialList = document.getElementById('socialList');
    socialList.addEventListener('input', function (e) {
      var row = e.target.closest ? e.target.closest('.account-social-row') : null;
      if (!row || !e.target.dataset.field) return;
      state.socialLinks[parseInt(row.dataset.index, 10)][e.target.dataset.field] = e.target.value;
    });
    socialList.addEventListener('click', function (e) {
      if (!e.target.classList || !e.target.classList.contains('account-social-remove')) return;
      var row = e.target.closest('.account-social-row');
      state.socialLinks.splice(parseInt(row.dataset.index, 10), 1);
      renderSocialRows();
    });
    document.getElementById('addSocialBtn').addEventListener('click', function () {
      var message = document.getElementById('formMessage');
      if (state.socialLinks.length >= MAX_SOCIAL) {
        setMessage(message, '社交链接最多 ' + MAX_SOCIAL + ' 条', 'error');
        return;
      }
      state.socialLinks.push({ label: '', url: '' });
      renderSocialRows();
      var rows = socialList.querySelectorAll('.account-social-row');
      if (rows.length) rows[rows.length - 1].querySelector('input').focus();
    });

    document.getElementById('profileForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var payload = collectPayload();
      if (!payload) return;

      var message = document.getElementById('formMessage');
      var saveBtn = document.getElementById('saveBtn');
      saveBtn.disabled = true;
      setMessage(message, '保存中…', 'info');

      fetch(API_USER + '?action=update_profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().then(function (json) {
          if (res.ok && json.success) {
            fillForm(json.data);
            setMessage(message, '已保存', 'success');
          } else if (res.status === 401) {
            setMessage(message, '登录已过期，正在刷新…', 'error');
            setTimeout(function () { location.reload(); }, 1200);
          } else {
            setMessage(message, json.error || '保存失败，请稍后重试', 'error');
          }
        });
      }).catch(function () {
        setMessage(message, '网络异常，请稍后重试', 'error');
      }).finally(function () {
        saveBtn.disabled = false;
      });
    });

    document.getElementById('logoutBtn').addEventListener('click', function () {
      fetch(API_AUTH + '?action=logout', { method: 'POST' }).catch(function () {}).then(function () {
        location.reload();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var status = document.getElementById('accountStatus');
    var prompt = document.getElementById('loginPrompt');
    var card = document.getElementById('accountCard');

    // 登录失败回跳：?login_error=state|denied|exchange|userinfo
    var errCode = new URLSearchParams(location.search).get('login_error') || '';

    fetch(API_AUTH + '?action=me').then(function (res) {
      if (res.status === 401) {
        status.style.display = 'none';
        prompt.style.display = '';
        if (errCode) {
          setMessage(document.getElementById('loginError'), LOGIN_ERRORS[errCode] || LOGIN_ERRORS.state, 'error');
        }
        return null;
      }
      return res.json().then(function (json) {
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'load failed');
        }
        status.style.display = 'none';
        card.style.display = '';
        fillForm(json.data);
        bindForm();
      });
    }).catch(function () {
      status.textContent = '加载失败，请刷新重试';
    });
  });
})();
