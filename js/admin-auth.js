/**
 * admin-auth.js — UEMCraft 统一管理后台认证模块
 * ------------------------------------------------
 * 后台已改为皮肤站 OAuth 会话鉴权（cookie），不再使用静态令牌。
 * 提供：会话读取（角色 + 权限节点）、带会话的 API 请求、页面守卫、登出。
 * 供 admin/*.html 与 js/admin-*.js 复用。
 */
window.UEMAdminAuth = (function () {
  'use strict';

  var sessionCache = null;

  /**
   * 读取当前会话（含 role 与 perms），未登录返回 null。
   * 结果缓存在内存，登出后清空。
   */
  function session() {
    if (sessionCache) {
      return Promise.resolve(sessionCache);
    }
    return fetch('../api/auth.php?action=me', { credentials: 'same-origin' }).then(function (res) {
      if (res.status === 401) return null;
      return res.json().then(function (json) {
        if (!res.ok || !json.success || !json.data) return null;
        sessionCache = json.data;
        return sessionCache;
      });
    }).catch(function () {
      return null;
    });
  }

  /** 是否为管理员角色（admin / super_admin） */
  function isAdminRole(user) {
    return !!user && (user.role === 'admin' || user.role === 'super_admin');
  }

  /** 在给定会话下是否拥有节点（超管恒为 true；node 为空表示只要求管理员身份） */
  function can(user, node) {
    if (!isAdminRole(user)) return false;
    if (user.role === 'super_admin') return true;
    return !node || (user.perms || []).indexOf(node) !== -1;
  }

  /**
   * 带会话的 API 请求。
   * 401 → 跳登录页并 reject；403 → reject 带 forbidden 标记的错误（页面自行提示）；
   * 其余状态返回解析后的 JSON（调用方检查 json.success）。
   */
  function api(url, options) {
    options = options || {};
    options.credentials = 'same-origin';
    return fetch(url, options).then(function (res) {
      if (res.status === 401) {
        redirectToLogin();
        return Promise.reject(new Error('401'));
      }
      return res.json().then(function (json) {
        if (res.status === 403) {
          var err = new Error((json && json.error) || '没有操作权限');
          err.forbidden = true;
          throw err;
        }
        return json;
      });
    });
  }

  /** 跳转登录页（根据当前路径自动判断） */
  function redirectToLogin(extraQuery) {
    var current = window.location.pathname;
    var base = current.indexOf('/admin/') !== -1 ? 'login.html' : '../admin/login.html';
    window.location.href = base + (extraQuery || '');
  }

  /** 权限不足：保留后台外壳，只替换主内容区 */
  function renderForbidden() {
    var main = document.getElementById('main') || document.querySelector('main') || document.body;
    main.innerHTML = '<div class="admin-forbidden">'
      + '<h1>无权限</h1>'
      + '<p>当前账号没有访问此页面的权限。</p>'
      + '<p><a class="btn btn-primary" href="index.html">返回仪表盘</a>'
      + '<a class="btn btn-ghost" href="/index.html">返回网站</a></p>'
      + '</div>';
  }

  /**
   * 页面守卫：校验登录、管理员角色与模块节点。
   * node 为空时只要求管理员身份（仪表盘）。
   */
  function requireAuth(node) {
    return session().then(function (user) {
      if (!user) {
        redirectToLogin();
        return Promise.reject(new Error('401'));
      }
      if (!isAdminRole(user)) {
        redirectToLogin('?denied=1');
        return Promise.reject(new Error('forbidden'));
      }
      if (!can(user, node)) {
        renderForbidden();
        return Promise.reject(new Error('forbidden'));
      }
      return user;
    });
  }

  /** 登出：销毁本站会话并回登录页 */
  function logout() {
    sessionCache = null;
    fetch('../api/auth.php?action=logout', { method: 'POST', credentials: 'same-origin' })
      .catch(function () {})
      .then(function () {
        redirectToLogin();
      });
  }

  /* ---- 工具函数（供 admin 子模块复用） ---- */
  function escapeHtml(text) {
    var u = window.UEMUtils;
    return u ? u.escapeHtml(text) : (function () {
      var d = document.createElement('div');
      d.textContent = text || '';
      return d.innerHTML;
    })();
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

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  return {
    session: session,
    isAdminRole: isAdminRole,
    can: can,
    api: api,
    requireAuth: requireAuth,
    logout: logout,
    redirectToLogin: redirectToLogin,
    escapeHtml: escapeHtml,
    setText: setText,
    showMessage: showMessage,
    pad: pad
  };
})();
