/* ============================================================
   admin-login.js — 管理后台登录页
   依赖：admin-auth.js（UEMAdminAuth）
   仅 admin/login.html 加载。
   ============================================================ */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  // DOM 检测：仅在登录页运行
  var form = document.getElementById('loginForm');
  if (!form) return;

  var input = document.getElementById('tokenInput');
  var btn   = document.getElementById('loginBtn');
  var msg   = document.getElementById('loginMessage');

  // 已有有效 token 则跳转
  if (Auth.getToken()) {
    Auth.verify(Auth.getToken()).then(function (valid) {
      if (valid) window.location.href = 'index.html';
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var token = input.value.trim();
    if (!token) {
      Auth.showMessage(msg, '请输入令牌', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = '验证中…';
    Auth.showMessage(msg, '', '');

    Auth.verify(token).then(function (valid) {
      if (valid) {
        Auth.saveToken(token);
        Auth.showMessage(msg, '验证成功，正在跳转…', 'success');
        setTimeout(function () { window.location.href = 'index.html'; }, 500);
      } else {
        Auth.showMessage(msg, '令牌无效，请重试', 'error');
        btn.disabled = false;
        btn.textContent = '进入管理';
      }
    }).catch(function () {
      Auth.showMessage(msg, '验证请求失败', 'error');
      btn.disabled = false;
      btn.textContent = '进入管理';
    });
  });
})();
