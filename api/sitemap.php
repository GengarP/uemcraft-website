<?php
/**
 * sitemap.php — 动态生成 XML Sitemap
 * ------------------------------------
 * 从数据库查询已发布的新闻和作品，结合静态页面，输出标准 XML Sitemap。
 * Content-Type: application/xml
 */

require_once __DIR__ . '/common.php';

// 覆盖 common.php 设置的 JSON Content-Type
header('Content-Type: application/xml; charset=utf-8');

$base = 'https://uemcraft.cn';
$now  = date('Y-m-d');

$xml  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
$xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";

// ---- 静态页面 ----
$staticPages = [
    ['loc' => $base . '/',                   'priority' => '1.0',  'changefreq' => 'weekly'],
    ['loc' => $base . '/about.html',         'priority' => '0.8',  'changefreq' => 'monthly'],
    ['loc' => $base . '/news/',              'priority' => '0.9',  'changefreq' => 'weekly'],
    ['loc' => $base . '/events.html',        'priority' => '0.8',  'changefreq' => 'monthly'],
    ['loc' => $base . '/gallery/',           'priority' => '0.8',  'changefreq' => 'weekly'],
    ['loc' => $base . '/wall/',              'priority' => '0.5',  'changefreq' => 'monthly'],
    ['loc' => $base . '/join.html',          'priority' => '0.7',  'changefreq' => 'monthly'],
];

foreach ($staticPages as $p) {
    $xml .= '  <url>' . "\n";
    $xml .= '    <loc>' . htmlspecialchars($p['loc']) . '</loc>' . "\n";
    $xml .= '    <lastmod>' . $now . '</lastmod>' . "\n";
    $xml .= '    <changefreq>' . $p['changefreq'] . '</changefreq>' . "\n";
    $xml .= '    <priority>' . $p['priority'] . '</priority>' . "\n";
    $xml .= '  </url>' . "\n";
}

// ---- 新闻文章 ----
try {
    $db = getSiteDb();
    $stmt = $db->query("SELECT slug, date, updated_at FROM news WHERE status = 'published' ORDER BY date DESC");
    $articles = $stmt->fetchAll();
    foreach ($articles as $a) {
        $lastmod = date('Y-m-d', $a['updated_at'] ?: strtotime($a['date']));
        $xml .= '  <url>' . "\n";
        $xml .= '    <loc>' . $base . '/news/article.html?slug=' . rawurlencode($a['slug']) . '</loc>' . "\n";
        $xml .= '    <lastmod>' . $lastmod . '</lastmod>' . "\n";
        $xml .= '    <changefreq>monthly</changefreq>' . "\n";
        $xml .= '    <priority>0.7</priority>' . "\n";
        $xml .= '  </url>' . "\n";
    }
} catch (Exception $e) {
    // 数据库查询失败时不输出新闻条目，但静态页面仍正常返回
}

// ---- 作品 ----
try {
    $db = getSiteDb();
    $stmt = $db->query("SELECT id, slug, updated_at FROM works WHERE status = 'published' ORDER BY sort_order ASC, created_at DESC");
    $works = $stmt->fetchAll();
    foreach ($works as $w) {
        $lastmod = date('Y-m-d', $w['updated_at'] ?: time());
        $xml .= '  <url>' . "\n";
        $xml .= '    <loc>' . $base . '/gallery/detail.html?id=' . intval($w['id']) . '</loc>' . "\n";
        $xml .= '    <lastmod>' . $lastmod . '</lastmod>' . "\n";
        $xml .= '    <changefreq>monthly</changefreq>' . "\n";
        $xml .= '    <priority>0.6</priority>' . "\n";
        $xml .= '  </url>' . "\n";
    }
} catch (Exception $e) {
    // 同上
}

$xml .= '</urlset>' . "\n";

echo $xml;
