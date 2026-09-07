/* ============================================================
   components-footer.js — 共享组件：页脚
   放在 </main> 后，同步注入 footer + 回到顶部按钮。
   ============================================================ */
(function () {
  'use strict';

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

    document.write(html);
  }

  renderFooter();
})();
