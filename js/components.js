/* ============================================================
   components.js — 共享组件（导航栏 + 页脚）
   通过 document.write() 同步注入，确保后续脚本能立即查询到元素。
   所有路径使用绝对路径（/...），自动匹配当前页面高亮。
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
    // 规范化：去除末尾斜杠（但保留 "/" 本身）
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

  function cls(isActive) {
    return isActive ? ' class="is-active"' : '';
  }

  /* ---- 渲染导航栏 ---- */
  function renderNav() {
    var cur = currentPath();

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
        navLinks += '<a href="' + item.path + '"' + cls(active) + '>' + item.label + '</a>';
      }
    }

    // 移动端导航链接
    var mobileLinks = '';
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      var item = NAV_ITEMS[i];
      var active = isActive(item);
      mobileLinks += '<a href="' + item.path + '"' + cls(active) + '>' + item.label + '</a>';
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
    // Header
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

    return html;
  }

  /* ---- 渲染页脚 ---- */
  function renderFooter() {
    var html = '';
    html += '<footer class="site-footer" role="contentinfo">';
    html += '<div class="footer-grid">';

    // 品牌信息
    html += '<div class="footer-col">';
    html += '<div class="footer-logo"><img src="/assets/img/logo-256.webp" alt="UEMCraft" width="32" height="32"><span>应急管理大学 Minecraft 同好会</span></div>';
    html += '<p>以 Minecraft 为平台，建设校园数字复原与创作社区。<br>MUA 成员组织。</p>';
    html += '<div class="footer-badges">';
    html += '<a href="/index.html" class="footer-badge">UEMCraft</a>';
    html += '<a href="https://www.mualliance.cn/" target="_blank" rel="noopener" class="footer-badge">MUA</a>';
    html += '</div></div>';

    // 快速链接
    html += '<div class="footer-col"><h4>快速链接</h4><ul>';
    var footerLinks = [
      ['/index.html', '首页'],
      ['/about.html', '关于我们'],
      ['/join.html', '加入我们'],
      ['/news/', '资讯动态'],
      ['/events.html', '活动中心'],
      ['/gallery/', '作品展示'],
      ['/wall/', '留言墙']
    ];
    for (var i = 0; i < footerLinks.length; i++) {
      html += '<li><a href="' + footerLinks[i][0] + '">' + footerLinks[i][1] + '</a></li>';
    }
    html += '</ul></div>';

    // 联系方式
    html += '<div class="footer-col"><h4>联系方式</h4><ul>';
    html += '<li><a href="https://qm.qq.com/q/VYDnv3ZJwC" target="_blank" class="footer-contact-link"><span class="iconfont icon-QQ" aria-hidden="true"></span> QQ</a></li>';
    html += '<li><a href="https://pd.qq.com/s/94uyddngr" target="_blank" class="footer-contact-link"><span class="iconfont icon-qqchannel" aria-hidden="true"></span> QQ 频道</a></li>';
    html += '<li><a href="https://space.bilibili.com/3546888496221012" target="_blank" class="footer-contact-link"><span class="iconfont icon-bilibili-fill" aria-hidden="true"></span> Bilibili</a></li>';
    html += '<li><a href="https://v.douyin.com/Q44xZngm3ls/" target="_blank" class="footer-contact-link"><span class="iconfont icon-douyin" aria-hidden="true"></span> 抖音</a></li>';
    html += '</ul></div>';

    // 相关链接
    html += '<div class="footer-col"><h4>相关链接</h4><ul>';
    html += '<li><a href="https://www.yitmc.cn" target="_blank" rel="noopener">燕理MC玩家创作协会</a></li>';
    html += '<li><a href="https://www.mualliance.cn/" target="_blank" rel="noopener">MUA 高校联盟</a></li>';
    html += '<li><a href="https://www.ncist.edu.cn/" target="_blank" rel="noopener">应急管理大学</a></li>';
    html += '</ul></div>';

    html += '</div>';

    // 底部
    html += '<div class="footer-bottom">';
    html += '<p class="fb-left"><span class="copy-sym">&copy;</span> <span id="year"></span> 应急管理大学 Minecraft 同好会 - UEMCraft</p>';
    html += '<p class="fb-right"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">赣ICP备2026018930号</a></p>';
    html += '<p class="fb-left"><a href="https://www.minecraft.net/zh-hans" target="_blank" rel="noopener">Minecraft</a> 是微软公司的商标 - 本站为社群非商业用途</p>';
    html += '<p class="fb-right"><a href="https://beian.mps.gov.cn/" target="_blank" rel="noopener" class="beian-icon"><img src="/assets/img/备案图标.png" alt="公安备案" style="height:14px;width:auto;">赣公网安备 36072102000273号</a></p>';
    html += '</div></footer>';

    // 回到顶部
    html += '<button class="back-to-top" aria-label="回到顶部" title="回到顶部">↑</button>';

    return html;
  }

  /* ---- 输出 ---- */
  document.write(renderNav() + renderFooter());
})();
