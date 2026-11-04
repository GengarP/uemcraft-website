/* ============================================================
   admin-dashboard.js — 管理后台仪表盘
   依赖：admin-auth.js（UEMAdminAuth）
   仅 admin/index.html 加载。
   统计按权限节点按需加载；无权限的模块行直接隐藏（“隐藏并拦截”）。
   ============================================================ */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  // DOM 检测：仅在仪表盘页运行（页头改为 .admin-page-header 后，仪表盘容器是 .admin-dashboard-list）
  if (!document.querySelector('.admin-dashboard-list')) return;

  // 仪表盘行 → 权限节点（与 components-admin.js 的 ADMIN_NAV 对应）
  var ROW_NODES = {
    'news.html': 'news',
    'events.html': 'events',
    'gallery.html': 'works',
    'docs.html': 'docs',
    'servers.html': 'servers',
    'pcl-cards.html': 'pcl',
    'images.html': 'images',
    'donations.html': 'donations',
    'parkour.html': 'parkour',
    'wall.html': 'wall'
  };

  function hideForbiddenRows(user) {
    var rows = document.querySelectorAll('.admin-dashboard-row');
    for (var i = 0; i < rows.length; i++) {
      var href = (rows[i].getAttribute('href') || '').replace(/^.*\//, '');
      var node = ROW_NODES[href];
      if (node && !Auth.can(user, node)) {
        rows[i].style.display = 'none';
      }
    }
  }

  Auth.requireAuth().then(function (user) {
    hideForbiddenRows(user);

    // 新闻统计
    if (Auth.can(user, 'news')) {
      Auth.api('../api/news.php?action=admin_list&limit=1').then(function (json) {
        if (json.success) {
          var total = json.total || 0;
          Auth.api('../api/news.php?action=admin_list&limit=1&status=published').then(function (r) {
            Auth.setText('newsPublished', r.success ? (r.total || 0) : 0);
            Auth.setText('newsDraft', total - (r.success ? (r.total || 0) : 0));
          });
        }
      }).catch(function () {});
    }

    // 活动统计
    if (Auth.can(user, 'events')) {
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
    }

    // 作品统计
    if (Auth.can(user, 'works')) {
      Auth.api('../api/works.php?action=admin_list&limit=1').then(function (json) {
        if (json.success) {
          var total = json.total || 0;
          Auth.api('../api/works.php?action=admin_list&limit=1&status=published').then(function (r) {
            Auth.setText('worksPublished', r.success ? (r.total || 0) : 0);
            Auth.setText('worksDraft', total - (r.success ? (r.total || 0) : 0));
          });
        }
      }).catch(function () {});
    }

    // 文档统计
    if (Auth.can(user, 'docs')) {
      Auth.api('../api/docs.php?action=admin_list&limit=1&status=all').then(function (json) {
        if (json.success) {
          var total = json.total || 0;
          Auth.api('../api/docs.php?action=admin_list&limit=1&status=published').then(function (r) {
            Auth.setText('docsPublished', r.success ? (r.total || 0) : 0);
            Auth.setText('docsDraft', total - (r.success ? (r.total || 0) : 0));
          });
        }
      }).catch(function () {});
    }

    // 服务器统计
    if (Auth.can(user, 'servers')) {
      Auth.api('../api/servers.php?action=admin_list&limit=1').then(function (json) {
        if (json.success) {
          Auth.setText('serverCount', json.total || 0);
        }
      }).catch(function () {});
    }

    // 捐赠统计（总量 + 本月）
    if (Auth.can(user, 'donations')) {
      Auth.api('../api/donations.php?action=admin_list&limit=1').then(function (json) {
        if (json.success) {
          Auth.setText('donationCount', json.total || 0);
          var d = new Date();
          var month = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
          Auth.api('../api/donations.php?action=admin_list&limit=1&month=' + month).then(function (r) {
            Auth.setText('donationMonthCount', r.success ? (r.total || 0) : 0);
          });
        }
      }).catch(function () {});
    }

    // PCL 主页统计
    if (Auth.can(user, 'pcl')) {
      Auth.api('../api/pcl.php?action=card_list').then(function (json) {
        if (json.success) {
          Auth.setText('pclCardCount', (json.data || []).length);
        }
      }).catch(function () {});
    }
  }).catch(function () {});

  // 退出按钮由 components-admin.js（外壳）统一绑定
})();
