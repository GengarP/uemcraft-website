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
        { label: '皮肤站',   path: 'https://skin.uemcraft.cn/', external: true }
      ]
    },
    { label: '活动中心',   path: '/events.html',   match: ['/events.html'] },
    { label: '风采',       path: '',               match: [], isDropdown: true, noLink: true,
      children: [
        { label: '作品展示', path: '/gallery/' },
        { label: '跑酷排行', path: '/parkour/' }
      ]
    },
    { label: '资料',       path: '',               match: [], isDropdown: true, noLink: true,
      children: [
        { label: '资讯动态',   path: '/news/', match: ['/news'] },
        { label: '指南与文档', path: '/docs/', match: ['/docs'] }
      ]
    },
    { label: '留言墙',     path: '/wall/',         match: ['/wall/'] },
    { label: '捐赠者',     path: '/donors/',       match: ['/donors/'] }
  ];

  /* ---- 工具函数 ---- */
  /* 路径归一化：线上 Apache 会把 /about.html 301 到 /about（去掉 .html 后缀），
     本地开发访问的仍是 /about.html。两侧统一归一后再比对：去尾斜杠、去 .html、
     末尾 /index 段视作目录本身（根上的 /index 即 /），否则线上无后缀路径永远
     命中不了带 .html 的 match，高亮会丢（/about、/join、/events、/index 全中招）。 */
  function normPath(p) {
    if (p.length > 1 && p.slice(-1) === '/') p = p.slice(0, -1);
    if (p.length > 5 && p.slice(-5) === '.html') p = p.slice(0, -5);
    if (p.slice(-6) === '/index') p = p.slice(0, -6);
    return p || '/';
  }

  function currentPath() {
    return normPath(location.pathname);
  }

  function isActive(item) {
    var cur = currentPath();
    for (var i = 0; i < item.match.length; i++) {
      if (cur === normPath(item.match[i])) return true;
    }
    return false;
  }

  /* 前缀命中：/news/slug、/gallery/detail 这类子路径也算（子项高亮用） */
  function isUnder(prefixes) {
    var cur = currentPath();
    for (var i = 0; i < prefixes.length; i++) {
      var m = normPath(prefixes[i]);
      if (cur === m || (m !== '/' && cur.indexOf(m + '/') === 0)) return true;
    }
    return false;
  }

  /* 子项是否命中（外部链接不算） */
  function childActive(ch) {
    if (ch.external) return false;
    return isUnder(ch.match || [ch.path]);
  }

  /* ---- 渲染导航栏 ---- */
  function renderNav() {
    // 注：docs 页的 .docs-detail（导航栏内容左右贴边）由 docs/index.php 直接写在
    // <body> 上。文档页现在只有阅读页一种形态，不再需要按有无 slug 动态添加。
    // 桌面导航链接
    var navLinks = '';
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      var item = NAV_ITEMS[i];
      var active = isActive(item);
      if (item.isDropdown) {
        // 下拉触发器高亮：自身命中或任一子项命中（「资料」「关于我们」同一套逻辑）
        var anyChild = false;
        for (var j = 0; j < item.children.length; j++) {
          if (childActive(item.children[j])) anyChild = true;
        }
        var triggerActive = active || anyChild;
        navLinks += '<div class="nav-dropdown">';
        if (item.noLink) {
          navLinks += '<button type="button" class="nav-drop-trigger' + (triggerActive ? ' is-active' : '') + '">' + item.label + '</button>';
        } else {
          navLinks += '<a href="' + item.path + '" class="nav-drop-trigger' + (triggerActive ? ' is-active' : '') + '">' + item.label + '</a>';
        }
        navLinks += '<div class="nav-drop-menu">';
        for (var j = 0; j < item.children.length; j++) {
          var ch = item.children[j];
          var chAct = childActive(ch) ? ' is-active' : '';
          if (ch.external) {
            navLinks += '<a href="' + ch.path + '" target="_blank" rel="noopener">' + ch.label + '</a>';
          } else {
            navLinks += '<a href="' + ch.path + '" class="' + (chAct ? 'is-active' : '') + '">' + ch.label + '</a>';
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
      // 下拉父项：自身命中或任一子项命中时高亮（与桌面触发器同逻辑）
      if (item.isDropdown) {
        for (var j = 0; j < item.children.length; j++) {
          if (childActive(item.children[j])) active = true;
        }
      }
      if (item.noLink) {
        // 不可点击的分组标签（如「资料」），子项缩进排在下面
        mobileLinks += '<div class="mobile-group-label">' + item.label + '</div>';
      } else {
        mobileLinks += '<a href="' + item.path + '"' + (active ? ' class="is-active"' : '') + '>' + item.label + '</a>';
      }
      if (item.children) {
        for (var j = 0; j < item.children.length; j++) {
          var ch = item.children[j];
          var chAct = childActive(ch) ? ' is-active' : '';
          if (ch.external) {
            mobileLinks += '<a href="' + ch.path + '" class="mobile-sub" target="_blank" rel="noopener">' + ch.label + '</a>';
          } else {
            mobileLinks += '<a href="' + ch.path + '" class="mobile-sub' + chAct + '">' + ch.label + '</a>';
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

    // Mobile nav + backdrop
    html += '<div class="mobile-nav-backdrop" aria-hidden="true"></div>';
    html += '<nav class="mobile-nav" aria-label="移动端导航">' + mobileLinks + '</nav>';

    document.write(html);
  }

  renderNav();
})();
