/**
 * admin-auth.js — UEMCraft 统一管理后台认证模块
 * ------------------------------------------------
 * 提供 token 存储、验证、API 请求等公共功能。
 * 供 admin/*.html 复用。
 */
window.UEMAdminAuth = (function () {
  'use strict';

  var TOKEN_KEY = 'uemcraft-admin-token';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function saveToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  /**
   * 验证 token 是否有效。
   * @param {string} token - 要验证的令牌
   * @param {string} [probeUrl] - 探测请求 URL（默认用 news API）
   * @returns {Promise<boolean>}
   */
  function verify(token, probeUrl) {
    probeUrl = probeUrl || '../api/news.php?action=admin_list&page=1&limit=1';
    return fetch(probeUrl, {
      headers: { 'X-Admin-Token': token }
    }).then(function (res) {
      if (!res.ok) return false;
      return res.json().then(function (json) {
        return json.success === true;
      });
    }).catch(function () {
      return false;
    });
  }

  /**
   * 发起需要认证的 API 请求。
   * 403 时自动清除 token 并跳转登录页。
   * @param {string} url - API URL
   * @param {object} [options] - fetch 选项
   * @returns {Promise<object>} 解析后的 JSON
   */
  function api(url, options) {
    options = options || {};
    var token = getToken();
    if (!token) {
      redirectToLogin();
      return Promise.reject(new Error('no-token'));
    }
    options.headers = Object.assign({}, options.headers || {}, {
      'X-Admin-Token': token
    });
    return fetch(url, options).then(function (res) {
      if (res.status === 403) {
        clearToken();
        redirectToLogin();
        return Promise.reject(new Error('403'));
      }
      return res.json();
    });
  }

  /**
   * 跳转到登录页（根据当前路径自动判断）
   */
  function redirectToLogin() {
    var current = window.location.pathname;
    if (current.indexOf('/admin/') !== -1) {
      window.location.href = 'login.html';
    } else {
      window.location.href = '../admin/login.html';
    }
  }

  /**
   * 检查认证状态，未登录则跳转。
   * @param {string} [probeUrl] - 探测 URL
   * @returns {Promise<void>}
   */
  function requireAuth(probeUrl) {
    var token = getToken();
    if (!token) {
      redirectToLogin();
      return Promise.reject(new Error('no-token'));
    }
    return verify(token, probeUrl).then(function (valid) {
      if (!valid) {
        clearToken();
        redirectToLogin();
        return Promise.reject(new Error('invalid-token'));
      }
    });
  }

  /**
   * 登出
   */
  function logout() {
    clearToken();
    redirectToLogin();
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
    TOKEN_KEY: TOKEN_KEY,
    getToken: getToken,
    saveToken: saveToken,
    clearToken: clearToken,
    verify: verify,
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
