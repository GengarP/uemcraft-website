<?php
/**
 * news/index.php — 新闻路由
 *
 * /news/           → 列表页
 * /news/{slug}     → 详情页
 *
 * 需要 Apache .htaccess 配置 URL 重写
 */

require_once __DIR__ . '/../api/common.php';

// 从 URL 路径中提取 slug
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$slug = '';

// 匹配 /news/{slug} 模式
if (preg_match('#^/news/([a-zA-Z0-9_-]+)/?$#', $path, $m)) {
    $slug = trim($m[1]);
}

$isDetail = $slug !== '';

// 详情页 SEO 数据
$page_title   = '资讯动态 — UEMCraft';
$page_desc    = 'UEMCraft 资讯动态——应急管理大学 Minecraft 同好会的最新消息与公告。';
$page_image   = '';
$page_url     = 'https://uemcraft.cn/news/' . ($slug ? urlencode($slug) : '');
$article_date = '';
$article_author = '';
$article_tags = [];

if ($isDetail) {
    try {
        $db   = getSiteDb();
        $stmt = $db->prepare("SELECT title, slug, excerpt, cover, author, tags, date FROM news WHERE slug = :slug AND status = 'published'");
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch();

        if ($row) {
            $page_title     = ($row['title'] ?: '文章') . ' — 资讯动态 — UEMCraft';
            $page_desc      = $row['excerpt'] ?: $page_desc;
            $page_image     = $row['cover'] ?? '';
            $article_date   = $row['date'] ?? '';
            $article_author = $row['author'] ?? '';
            $article_tags   = json_decode($row['tags'] ?? '[]', true) ?: [];
        }
    } catch (Throwable $e) {
        error_log('[news/index.php] ' . $e->getMessage());
    }
}

// 绝对图片 URL
$abs_image = '';
if ($page_image !== '') {
    $abs_image = strpos($page_image, 'http') === 0 ? $page_image : 'https://uemcraft.cn' . $page_image;
}

// ISO 日期
$iso_date = $article_date ? $article_date . 'T00:00:00+08:00' : '';
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="description" content="<?php echo htmlspecialchars($page_desc, ENT_QUOTES, 'UTF-8'); ?>">
  <meta name="theme-color" content="#213d87">
  <meta name="robots" content="index, follow">
  <title><?php echo htmlspecialchars($page_title, ENT_QUOTES, 'UTF-8'); ?></title>
  <link rel="canonical" href="https://uemcraft.cn/news/<?php echo $slug ? urlencode($slug) : ''; ?>">

<?php if ($isDetail): ?>
  <!-- JSON-LD 结构化数据 -->
  <script type="application/ld+json">
  <?php
  $ld = [
      '@context' => 'https://schema.org',
      '@type'    => 'NewsArticle',
      'headline' => $page_title,
      'description' => $page_desc,
      'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $page_url],
      'publisher' => [
          '@type' => 'Organization',
          'name'  => 'UEMCraft',
          'logo'  => ['@type' => 'ImageObject', 'url' => 'https://uemcraft.cn/assets/img/logo-256.webp'],
      ],
  ];
  if ($iso_date) $ld['datePublished'] = $iso_date;
  if ($article_author) $ld['author'] = ['@type' => 'Person', 'name' => $article_author];
  if ($abs_image) $ld['image'] = $abs_image;
  if ($article_tags) $ld['keywords'] = implode(', ', $article_tags);
  echo json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  ?>
  </script>
<?php endif; ?>

  <link rel="icon" href="../favicon.ico" type="images/x-icon">
  <script>
    (function(){
      var t = localStorage.getItem('uemcraft-theme');
      if(!t) t = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.style.colorScheme = t;
      var tex = localStorage.getItem('uemcraft-texture');
      if(tex && tex !== 'none'){
        document.documentElement.setAttribute('data-texture', tex);
        var s = document.createElement('style');
        s.id = 'texture-style';
        s.textContent = 'body::after{background-image:url(/assets/img/background_textures/'+tex+'.png);}';
        document.head.appendChild(s);
      }
    })();
  </script>
  <link rel="stylesheet" href="/css/tokens.css?v=509b48d">
  <link rel="stylesheet" href="/css/base.css?v=509b48d">
  <link rel="stylesheet" href="/css/layout.css?v=509b48d">
  <link rel="stylesheet" href="/css/components.css?v=509b48d">
  <link rel="stylesheet" href="/css/pages.css?v=509b48d">
</head>
<body>

<a href="#main" class="skip-link">跳转到主内容</a>

<!-- ====== Header ====== -->
<header class="site-header" role="banner">
  <div class="header-inner">
    <a href="/index.html" class="header-logo" aria-label="UEMCraft 首页">
      <img src="/assets/img/minecraft_title.png" alt="UEMCraft" class="header-logo-img">
    </a>
    <nav class="header-nav" aria-label="主导航">
      <a href="/index.html">首页</a>
      <div class="nav-dropdown"><a href="/about.html" class="nav-drop-trigger">关于我们</a><div class="nav-drop-menu"><a href="/join.html">加入我们</a><a href="/gallery/">作品展示</a><a href="https://skin.uemcraft.cn/" target="_blank" rel="noopener">皮肤站</a></div></div>
      <a href="/news/" class="is-active">资讯动态</a>
      <a href="/events.html">活动中心</a>
      <a href="/wall/">留言墙</a>
    </nav>
    <div class="header-actions">
      <div class="settings-wrapper">
        <button class="settings-toggle" aria-label="设置" title="设置">
          <img src="/assets/svg/setting.svg" alt="" width="20" height="20" class="settings-icon">
        </button>
        <div class="settings-panel" aria-hidden="true">
          <div class="settings-group">
            <span class="settings-label">外观</span>
            <div class="theme-options">
              <button class="theme-option" data-theme="light" title="亮色模式">
                <span class="iconfont-theme icon-sun" aria-hidden="true"></span>
              </button>
              <button class="theme-option" data-theme="dark" title="深色模式">
                <span class="iconfont-theme icon-moon" aria-hidden="true"></span>
              </button>
            </div>
          </div>
          <div class="settings-group">
            <span class="settings-label">背景纹理</span>
            <div class="texture-grid">
              <button class="texture-option" data-texture="none" title="无纹理">无</button>
              <button class="texture-option" data-texture="bricks" title="砖块">
                <img src="/assets/img/background_textures/bricks.png" alt="砖块">
              </button>
              <button class="texture-option" data-texture="cobblestone" title="圆石">
                <img src="/assets/img/background_textures/cobblestone.png" alt="圆石">
              </button>
              <button class="texture-option" data-texture="dirt" title="泥土">
                <img src="/assets/img/background_textures/dirt.png" alt="泥土">
              </button>
              <button class="texture-option" data-texture="end_stone" title="末地石">
                <img src="/assets/img/background_textures/end_stone.png" alt="末地石">
              </button>
              <button class="texture-option" data-texture="stone" title="石头">
                <img src="/assets/img/background_textures/stone.png" alt="石头">
              </button>
              <button class="texture-option" data-texture="stone_bricks" title="石砖">
                <img src="/assets/img/background_textures/stone_bricks.png" alt="石砖">
              </button>
            </div>
          </div>
        </div>
      </div>
      <button class="hamburger" aria-label="菜单" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<nav class="mobile-nav" aria-label="移动端导航">
  <a href="/index.html">首页</a>
  <a href="/about.html">关于我们</a>
  <a href="/join.html" class="mobile-sub">加入我们</a>
  <a href="/gallery/" class="mobile-sub">作品展示</a>
  <a href="https://skin.uemcraft.cn/" class="mobile-sub" target="_blank" rel="noopener">皮肤站</a>
  <a href="/events.html">活动中心</a>
  <a href="/news/" class="is-active">资讯动态</a>
  <a href="/wall/">留言墙</a>
</nav>

<!-- ====== Main ====== -->
<main id="main">

<?php if ($isDetail): ?>
<!-- 文章详情页 -->
<section class="page-hero">
  <div class="container">
    <h1 id="articleTitle">文章标题</h1>
    <p class="hero-sub" id="articleSub">加载中…</p>
    <nav class="breadcrumb" aria-label="面包屑">
      <a href="/index.html">首页</a> <span>/</span> <a href="/news/">资讯动态</a> <span>/</span> <span id="articleCrumb">文章标题</span>
    </nav>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:800px;">
    <figure class="article-hero reveal" id="articleCover" style="display:none;"></figure>
    <div class="article-meta reveal" id="articleMeta" style="display:none;"></div>
    <article class="article-body reveal" id="articleContent"></article>
    <div class="reveal" style="margin-top:var(--space-3xl); padding-top:var(--space-xl); border-top:2px solid var(--c-border); display:flex; justify-content:space-between; flex-wrap:wrap; gap:var(--space-md);">
      <a href="/news/" class="btn btn-outline">← 返回资讯列表</a>
    </div>
  </div>
</section>

<?php else: ?>
<!-- 新闻列表页 -->
<section class="page-hero">
  <div class="container">
    <h1>资讯动态</h1>
    <p class="hero-sub">关注 UEMCraft 的最新消息与公告</p>
    <nav class="breadcrumb" aria-label="面包屑">
      <a href="/index.html">首页</a> <span>/</span> <span>资讯动态</span>
    </nav>
  </div>
</section>

<section class="section section-alt">
  <div class="container">
    <div class="section-head reveal">
      <span class="section-label">INFOMATION</span>
      <h2>所有资讯</h2>
    </div>
    <div class="reveal" id="newsList" style="max-width:760px;margin-inline:auto;display:flex;flex-direction:column;gap:var(--space-md);"></div>
  </div>
</section>
<?php endif; ?>

</main>

<!-- ====== Footer ====== -->
<footer class="site-footer" role="contentinfo">
  <div class="footer-grid">
    <div class="footer-col">
      <div class="footer-logo">
        <img src="/assets/img/logo-256.webp" alt="UEMCraft" width="32" height="32">
        <span>应急管理大学 Minecraft 同好会</span>
      </div>
      <p>以 Minecraft 为平台，建设校园数字复原与创作社区。<br>MUA 成员组织。</p>
      <div class="footer-badges">
        <a href="/index.html" class="footer-badge">UEMCraft</a>
        <a href="https://www.mualliance.cn/" target="_blank" rel="noopener" class="footer-badge">MUA</a>
      </div>
    </div>
    <div class="footer-col">
      <h4>快速链接</h4>
      <ul>
        <li><a href="/index.html">首页</a></li>
        <li><a href="/about.html">关于我们</a></li>
        <li><a href="/news/">资讯动态</a></li>
        <li><a href="/events.html">活动中心</a></li>
        <li><a href="/gallery/">作品展示</a></li>
        <li><a href="/wall/">留言墙</a></li>
        <li><a href="/join.html">加入我们</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>联系方式</h4>
      <ul>
        <li><a href="https://qm.qq.com/q/VYDnv3ZJwC" target="_blank" class="footer-contact-link"><span class="iconfont icon-QQ" aria-hidden="true"></span> QQ</a></li>
        <li><a href="https://pd.qq.com/s/94uyddngr" target="_blank" class="footer-contact-link"><span class="iconfont icon-qqchannel" aria-hidden="true"></span> QQ 频道</a></li>
        <li><a href="https://space.bilibili.com/3546888496221012" target="_blank" class="footer-contact-link"><span class="iconfont icon-bilibili-fill" aria-hidden="true"></span> Bilibili</a></li>
        <li><a href="https://v.douyin.com/Q44xZngm3ls/" target="_blank" class="footer-contact-link"><span class="iconfont icon-douyin" aria-hidden="true"></span> 抖音</a></li>
      </ul>
    </div>
    <div class="footer-col">
      <h4>相关链接</h4>
      <ul>
        <li><a href="https://www.yitmc.cn" target="_blank" rel="noopener">燕理MC玩家创作协会</a></li>
        <li><a href="https://www.mualliance.cn/" target="_blank" rel="noopener">MUA 高校联盟</a></li>
        <li><a href="https://www.ncist.edu.cn/" target="_blank" rel="noopener">应急管理大学</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-bottom">
    <p class="fb-left"><span class="copy-sym">&copy;</span> <span id="year"></span> 应急管理大学 Minecraft 同好会 - UEMCraft</p>
    <p class="fb-right"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">赣ICP备2026018930号</a></p>
    <p class="fb-left"><a href="https://www.minecraft.net/zh-hans" target="_blank" rel="noopener">Minecraft</a> 是微软公司的商标 - 本站为社群非商业用途</p>
    <p class="fb-right"><a href="https://beian.mps.gov.cn/" target="_blank" rel="noopener" class="beian-icon"><img src="/assets/img/备案图标.png" alt="公安备案" style="height:14px;width:auto;">赣公网安备 36072102000273号</a></p>
  </div>
</footer>

<button class="back-to-top" aria-label="回到顶部" title="回到顶部">↑</button>

<!-- Markdown 引擎：marked.js（自托管，零依赖，避免 CDN 阻塞） -->
<script defer src="/js/marked.umd.js"></script>

<!-- 内容数据与渲染 -->
<script defer src="/js/utils.js"></script>
<script defer src="/js/cjk-spacing.js"></script>
<script defer src="/js/code-highlight.js"></script>
<script defer src="/js/content.js"></script>

<!-- 全局交互脚本 -->
<script defer src="/js/nav.js"></script>
<script defer src="/js/page-transition.js"></script>
<script defer src="/js/theme.js"></script>
<script defer src="/js/reveal.js"></script>

<?php if ($isDetail): ?>
<!-- 传递 slug 给前端 -->
<script>
  window.__NEWS_SLUG__ = '<?php echo addslashes($slug); ?>';
</script>
<?php endif; ?>

</body>
</html>
