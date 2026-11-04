/* ============================================================
   admin-login.js — 管理后台登录页（皮肤站 OAuth）
   依赖：admin-auth.js（UEMAdminAuth）
   仅 admin/login.html 加载。
   ============================================================ */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  var prompt = document.getElementById('loginPrompt');
  if (!prompt) return;

  var msg = document.getElementById('loginMessage');
  var logoutBtn = document.getElementById('logoutBtn');
  var denied = new URLSearchParams(window.location.search).get('denied');

  // 已登录：管理员直接进后台；普通用户提示无权限并给退出入口
  Auth.session().then(function (user) {
    if (!user) {
      if (denied) Auth.showMessage(msg, '当前账号没有管理权限', 'error');
      return;
    }
    if (Auth.isAdminRole(user)) {
      window.location.href = 'index.html';
      return;
    }
    Auth.showMessage(msg, '当前账号（' + (user.nickname || '未命名用户') + '）是普通用户，没有管理权限。', 'error');
    if (logoutBtn) {
      logoutBtn.style.display = '';
      logoutBtn.addEventListener('click', function () {
        Auth.logout();
      });
    }
  });
})();
