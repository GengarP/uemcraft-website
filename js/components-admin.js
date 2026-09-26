/* ============================================================
   components-admin.js — 共享组件：管理后台控制台外壳
   放在 <body> 后第一个 script，同步注入：
     - 左侧竖向导航（.admin-sidenav）
     - 顶部工具条（.admin-topbar）
   并给 <body> 加 .admin-app 类，由 admin.css 负责布局。

   导航项在此定义（单一数据源），当前页高亮由 location.pathname 推断。
   注意：本组件不引入前台 .site-header，后台为独立控制台外壳。
   ============================================================ */
(function () {
  'use strict';

  /* ---- 导航项定义（单一数据源） ---- */
  // match: 与 admin/ 下 *.html 的文件名（不含扩展名）匹配
  var ADMIN_NAV = [
    { label: '仪表盘',     path: 'index.html',   match: ['index', ''],              icon: '盘' },
    { label: '新闻管理',   path: 'news.html',    match: ['news', 'news-edit'],      icon: '新' },
    { label: '活动管理',   path: 'events.html',  match: ['events', 'events-edit'],  icon: '活' },
    { label: '作品管理',   path: 'gallery.html', match: ['gallery', 'gallery-edit'], icon: '作' },
    { label: '文档管理',   path: 'docs.html',    match: ['docs', 'docs-edit'],      icon: '文' },
    { label: '服务器管理', path: 'servers.html', match: ['servers', 'servers-edit'], icon: '服' },
    { label: '图片管理',   path: 'images.html',  match: ['images'],                 icon: '图' },
    { label: '留言墙管理', path: 'wall.html',    match: ['wall'],                   icon: '墙' }
  ];

  /* ---- 当前页文件名（不含扩展名），如 /admin/news-edit.html → news-edit ---- */
  function currentKey() {
    var p = location.pathname;
    var base = p.slice(p.lastIndexOf('/') + 1);
    return base.replace(/\.html?$/i, '').toLowerCase();
  }

  function isActive(item) {
    var key = currentKey();
    for (var i = 0; i < item.match.length; i++) {
      if (item.match[i] === key) return true;
    }
    return false;
  }

  /* ---- 渲染 ---- */
  function render() {
    var key = currentKey();
    document.body.classList.add('admin-app');

    var navLinks = '';
    for (var i = 0; i < ADMIN_NAV.length; i++) {
      var item = ADMIN_NAV[i];
      var active = isActive(item);
      navLinks += '<a href="' + item.path + '" class="admin-sidenav-link' + (active ? ' is-active' : '') + '"'
        + (active ? ' aria-current="page"' : '') + '>';
      navLinks += '<span class="admin-sidenav-icon" aria-hidden="true">' + item.icon + '</span>';
      navLinks += '<span class="admin-sidenav-label">' + item.label + '</span>';
      navLinks += '</a>';
    }

    var html = '';

    /* ---- 左侧竖向导航 ---- */
    html += '<aside class="admin-sidenav" id="adminSidenav" aria-label="后台导航">';
    html += '<a href="index.html" class="admin-sidenav-brand">';
    html += '<img src="/assets/img/logo-256.webp" alt="" width="24" height="24">';
    html += '<span>UEMCraft<br>管理后台</span>';
    html += '</a>';
    html += '<nav class="admin-sidenav-nav">' + navLinks + '</nav>';
    html += '<div class="admin-sidenav-foot">';
    html += '<button type="button" class="admin-sidenav-logout" id="logoutBtn">退出登录</button>';
    html += '</div>';
    html += '</aside>';

    /* ---- 顶部工具条 ---- */
    html += '<header class="admin-topbar">';
    html += '<button type="button" class="admin-sidenav-toggle" id="adminSidenavToggle"'
      + ' aria-label="展开导航" aria-expanded="false" aria-controls="adminSidenav">'
      + '<span></span><span></span><span></span></button>';
    html += '<a href="/index.html" class="admin-topbar-back">← 返回网站</a>';
    html += '<span class="admin-topbar-title" id="adminTopbarTitle"></span>';
    html += '<div class="admin-topbar-right">';
    html += '<div class="theme-options admin-topbar-theme">';
    html += '<button class="theme-option" data-theme="light" title="亮色模式" aria-label="亮色模式"><span class="iconfont-theme icon-sun" aria-hidden="true"></span></button>';
    html += '<button class="theme-option" data-theme="dark" title="深色模式" aria-label="深色模式"><span class="iconfont-theme icon-moon" aria-hidden="true"></span></button>';
    html += '</div>';
    html += '</div></header>';

    document.write(html);

    /* ---- 顶栏标题 = 当前导航项名称 ---- */
    for (var j = 0; j < ADMIN_NAV.length; j++) {
      if (ADMIN_NAV[j].match.indexOf(key) !== -1) {
        window.__adminPageLabel = ADMIN_NAV[j].label;
        break;
      }
    }

    /* ---- 移动端抽屉开关 ---- */
    document.addEventListener('DOMContentLoaded', function () {
      var title = document.getElementById('adminTopbarTitle');
      if (title && window.__adminPageLabel) title.textContent = window.__adminPageLabel;

      var toggle = document.getElementById('adminSidenavToggle');
      var sidenav = document.getElementById('adminSidenav');
      if (!toggle || !sidenav) return;

      // 抽屉遮罩
      var backdrop = document.createElement('div');
      backdrop.className = 'admin-sidenav-backdrop';
      document.body.appendChild(backdrop);

      function setOpen(open) {
        sidenav.classList.toggle('is-open', open);
        backdrop.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      }

      toggle.addEventListener('click', function () {
        setOpen(!sidenav.classList.contains('is-open'));
      });
      backdrop.addEventListener('click', function () { setOpen(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
      });
      sidenav.addEventListener('click', function (e) {
        if (e.target.closest('a')) setOpen(false);
      });
    });
  }

  render();
})();
