<?php
/**
 * docs/index.php — 指南与文档阅读页
 *
 * /docs/           → 阅读页，未选择文档时正文区提示「请在左侧选择要阅读的文章」
 * /docs/{slug}     → 阅读页，加载指定文档
 *
 * 没有独立的文档列表页；文档列表与本页目录都在左侧边栏，无右侧目录栏。
 * 需要 Apache .htaccess 配置 URL 重写
 */

require_once __DIR__ . '/../api/common.php';

// 从 URL 路径中提取 slug
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$slug = '';

// 匹配 /docs/{slug} 模式
if (preg_match('#^/docs/([a-zA-Z0-9_-]+)/?$#', $path, $m)) {
    $slug = trim($m[1]);
}

$isDetail = $slug !== '';

// 详情页 SEO 数据
$page_title = '指南与文档 — UEMCraft';
$page_desc  = 'UEMCraft 指南与文档——服务器规则、新手教程、建筑指南等。';

if ($isDetail) {
    try {
        $db   = getSiteDb();
        $stmt = $db->prepare("SELECT title, category FROM docs WHERE slug = :slug AND status = 'published'");
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch();

        if ($row) {
            $page_title = ($row['title'] ?: '文档') . ' — 指南与文档 — UEMCraft';
        }
    } catch (Throwable $e) {
        error_log('[docs/index.php] ' . $e->getMessage());
    }
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="description" content="<?php echo htmlspecialchars($page_desc, ENT_QUOTES, 'UTF-8'); ?>">
  <meta name="theme-color" content="#213d87">
  <title><?php echo htmlspecialchars($page_title, ENT_QUOTES, 'UTF-8'); ?></title>
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
  <link rel="stylesheet" href="/css/tokens.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/layout.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/pages.css">
</head>
<body class="docs-detail">

<script src="/js/components-header.js"></script>
<a href="#main" class="skip-link">跳转到主内容</a>

<!-- ====== Main ====== -->
<main id="main">

<!-- 阅读页：左侧边栏（文档列表 + 本页目录） + 正文 -->
<div class="docs-layout" data-current-slug="<?php echo htmlspecialchars($slug, ENT_QUOTES, 'UTF-8'); ?>">

  <!-- 左侧边栏 -->
  <aside class="docs-sidebar" id="docsSidebar">
    <div class="docs-sidebar-header">
      <a href="/docs/" class="docs-sidebar-title">指南与文档</a>
    </div>
    <button class="docs-sidebar-toggle" id="docsSidebarToggle" aria-label="展开目录" aria-expanded="false">
      <span>文档目录</span>
      <span class="docs-sidebar-toggle-icon">▼</span>
    </button>
    <div class="docs-sidebar-scroll" id="docsSidebarScroll">
      <nav class="docs-sidebar-nav" id="docsSidebarNav" aria-label="文档列表">
        <div class="docs-sidebar-loading">加载中…</div>
      </nav>
    </div>
  </aside>

  <!-- 主内容区 -->
  <article class="docs-content">
    <div class="docs-breadcrumb">
      <a href="/docs/">指南与文档</a> <span>/</span>
      <span id="docsCrumb"><?php echo $isDetail ? '加载中…' : '未选择文档'; ?></span>
    </div>
    <div class="docs-body" id="docsBody"><?php if (!$isDetail): ?>
      <div class="docs-empty">
        <div class="docs-empty-mark" aria-hidden="true">文</div>
        <p class="docs-empty-title">请在左侧选择要阅读的文章</p>
        <p class="docs-empty-hint">左侧按分类列出了全部指南与文档。选定后这里显示正文，左侧下方会自动生成本页目录。</p>
      </div>
    <?php endif; ?></div>
    <div class="docs-footer-nav" id="docsFooterNav"></div>
  </article>

</div>

</main>

<script src="/js/components-footer.js"></script>

<!-- Markdown 引擎 -->
<script defer src="/js/marked.umd.js"></script>
<script defer src="/js/utils.js"></script>
<script defer src="/js/cjk-spacing.js"></script>
<script defer src="/js/code-highlight.js"></script>

<!-- 全局交互脚本 -->
<script defer src="/js/nav.js"></script>
<script defer src="/js/page-transition.js"></script>
<script defer src="/js/theme.js"></script>
<script defer src="/js/reveal.js"></script>

<!-- 文档页面逻辑 -->
<script defer src="/js/docs.js"></script>

<?php if ($isDetail): ?>
<script>
  window.__DOCS_SLUG__ = '<?php echo addslashes($slug); ?>';
</script>
<?php endif; ?>

</body>
</html>
