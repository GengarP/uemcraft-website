/* ============================================================
   admin-dashboard.js — 管理后台仪表盘
   依赖：admin-auth.js（UEMAdminAuth）
   仅 admin/index.html 加载。
   ============================================================ */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  // DOM 检测：仅在仪表盘页运行
  if (!document.querySelector('.admin-dashboard-grid')) return;

  Auth.requireAuth().then(function () {
    // 新闻统计
    Auth.api('../api/news.php?action=admin_list&limit=1').then(function (json) {
      if (json.success) {
        var total = json.total || 0;
        Auth.api('../api/news.php?action=admin_list&limit=1&status=published').then(function (r) {
          Auth.setText('newsPublished', r.success ? (r.total || 0) : 0);
          Auth.setText('newsDraft', total - (r.success ? (r.total || 0) : 0));
        });
      }
    }).catch(function () {});

    // 活动统计
    Auth.api('../api/events.php?action=admin_list&limit=1').then(function (json) {
      if (json.success) {
        var total = json.total || 0;
        Auth.api('../api/events.php?action=admin_list&limit=1&status=upcoming').then(function (r1) {
          Auth.api('../api/events.php?action=admin_list&limit=1&status=ongoing').then(function (r2) {
            var up = (r1.success ? (r1.total || 0) : 0) + (r2.success ? (r2.total || 0) : 0);
            Auth.setText('eventsUpcoming', up);
            Auth.setText('eventsPast', total - up);
          });
        });
      }
    }).catch(function () {});

    // 作品统计
    Auth.api('../api/works.php?action=admin_list&limit=1').then(function (json) {
      if (json.success) {
        var total = json.total || 0;
        Auth.api('../api/works.php?action=admin_list&limit=1&status=published').then(function (r) {
          Auth.setText('worksPublished', r.success ? (r.total || 0) : 0);
          Auth.setText('worksDraft', total - (r.success ? (r.total || 0) : 0));
        });
      }
    }).catch(function () {});

    // 服务器统计
    Auth.api('../api/servers.php?action=admin_list&limit=1').then(function (json) {
      if (json.success) {
        Auth.setText('serverCount', json.total || 0);
      }
    }).catch(function () {});
  });

  // 退出按钮
  document.querySelectorAll('#logoutBtn, #logoutBtn2').forEach(function (btn) {
    btn.addEventListener('click', function () { Auth.logout(); });
  });
})();
