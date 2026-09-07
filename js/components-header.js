/* ============================================================
   components-header.js — 共享组件：导航栏
   放在 <body> 后第一个 script，同步注入 header。
   ============================================================ */
(function () {
  'use strict';

  /* ---- 导航链接定义（单一数据源） ---- */
  var NAV_ITEMS = [
    { label: '首页',       path: '/index.html',    match: ['/index.html', '/'] },
    { label: '关于我们',   path: '/about.html',    match: ['/about.html'], isDropdown: true,
      children: [
        { label: '加入我们', path: '/join.html' },
        { label: '作品展示', path: '/gallery/' },
        { label: '皮肤站',   path: 'https://skin.uemcraft.cn/', external: true }
      ]
    },
    { label: '资讯动态',   path: '/news/',         match: ['/news/'] },
    { label: '活动中心',   path: '/events.html',   match: ['/events.html'] },
    { label: '留言墙',     path: '/wall/',         match: ['/wall/'] }
  ];

  /* ---- 工具函数 ---- */
  function currentPath() {
    var p = location.pathname;
    if (p.length > 1 && p.slice(-1) === '/') p = p.slice(0, -1);
    return p || '/';
  }

  function isActive(item) {
    var cur = currentPath();
    for (var i = 0; i < item.match.length; i++) {
      var m = item.match[i];
      if (m.length > 1 && m.slice(-1) === '/') m = m.slice(0, -1);
      if (cur === m || cur === m + '/') return true;
    }
    return false;
  }

  /* ---- 渲染导航栏 ---- */
  function renderNav() {
    // 桌面导航链接
    var navLinks = '';
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      var item = NAV_ITEMS[i];
      var active = isActive(item);
      if (item.isDropdown) {
        navLinks += '<div class="nav-dropdown">';
        navLinks += '<a href="' + item.path + '" class="nav-drop-trigger' + (active ? ' is-active' : '') + '">' + item.label + '</a>';
        navLinks += '<div class="nav-drop-menu">';
        for (var j = 0; j < item.children.length; j++) {
          var ch = item.children[j];
          if (ch.external) {
            navLinks += '<a href="' + ch.path + '" target="_blank" rel="noopener">' + ch.label + '</a>';
          } else {
            navLinks += '<a href="' + ch.path + '">' + ch.label + '</a>';
          }
        }
        navLinks += '</div></div>';
      } else {
        navLinks += '<a href="' + item.path + '"' + (active ? ' class="is-active"' : '') + '>' + item.label + '</a>';
      }
    }

    // 移动端导航链接
    var mobileLinks = '';
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      var item = NAV_ITEMS[i];
      var active = isActive(item);
      mobileLinks += '<a href="' + item.path + '"' + (active ? ' class="is-active"' : '') + '>' + item.label + '</a>';
      if (item.children) {
        for (var j = 0; j < item.children.length; j++) {
          var ch = item.children[j];
          if (ch.external) {
            mobileLinks += '<a href="' + ch.path + '" class="mobile-sub" target="_blank" rel="noopener">' + ch.label + '</a>';
          } else {
            mobileLinks += '<a href="' + ch.path + '" class="mobile-sub">' + ch.label + '</a>';
          }
        }
      }
    }

    // 纹理选项
    var textures = ['bricks','cobblestone','dirt','end_stone','stone','stone_bricks'];
    var textureLabels = {bricks:'砖块',cobblestone:'圆石',dirt:'泥土',end_stone:'末地石',stone:'石头',stone_bricks:'石砖'};
    var textureBtns = '<button class="texture-option" data-texture="none" title="无纹理">无</button>';
    for (var t = 0; t < textures.length; t++) {
      var tn = textures[t];
      textureBtns += '<button class="texture-option" data-texture="' + tn + '" title="' + textureLabels[tn] + '">';
      textureBtns += '<img src="/assets/img/background_textures/' + tn + '.png" alt="' + textureLabels[tn] + '">';
      textureBtns += '</button>';
    }

    var html = '';
    html += '<header class="site-header" role="banner">';
    html += '<div class="header-inner">';
    html += '<a href="/index.html" class="header-logo" aria-label="UEMCraft 首页">';
    html += '<img src="/assets/img/minecraft_title.png" alt="UEMCraft" class="header-logo-img">';
    html += '</a>';
    html += '<nav class="header-nav" aria-label="主导航">' + navLinks + '</nav>';
    html += '<div class="header-actions">';
    html += '<div class="settings-wrapper">';
    html += '<button class="settings-toggle" aria-label="设置" title="设置">';
    html += '<img src="/assets/svg/setting.svg" alt="" width="20" height="20" class="settings-icon">';
    html += '</button>';
    html += '<div class="settings-panel" aria-hidden="true">';
    html += '<div class="settings-group"><span class="settings-label">外观</span>';
    html += '<div class="theme-options">';
    html += '<button class="theme-option" data-theme="light" title="亮色模式"><span class="iconfont-theme icon-sun" aria-hidden="true"></span></button>';
    html += '<button class="theme-option" data-theme="dark" title="深色模式"><span class="iconfont-theme icon-moon" aria-hidden="true"></span></button>';
    html += '</div></div>';
    html += '<div class="settings-group"><span class="settings-label">背景纹理</span>';
    html += '<div class="texture-grid">' + textureBtns + '</div>';
    html += '</div></div></div>';
    html += '<button class="hamburger" aria-label="菜单" aria-expanded="false"><span></span><span></span><span></span></button>';
    html += '</div></header>';

    // Mobile nav
    html += '<nav class="mobile-nav" aria-label="移动端导航">' + mobileLinks + '</nav>';

    document.write(html);
  }

  renderNav();
})();
