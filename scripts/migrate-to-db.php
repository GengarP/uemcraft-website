<?php
/**
 * migrate-to-db.php — 一次性数据迁移脚本
 * ------------------------------------------
 * 将 articles/*.md 和 js/data.js 中的数据导入到 site.db。
 *
 * 用法：php scripts/migrate-to-db.php
 *
 * 注意：
 * - 运行前确保 api/site.db 不存在（或已备份），脚本会自动建库
 * - 本脚本会解析 articles/*.md 的 YAML front matter + markdown body
 * - 活动数据需要手动导出为 scripts/events-data.json（从 data.js 中提取）
 */

$root = dirname(__DIR__);
require_once $root . '/api/common.php';

// ---- 辅助函数 ----

function parseFrontMatter($content) {
    if (substr($content, 0, 3) !== "---\n" && substr($content, 0, 4) !== "---\r\n") {
        return [[''], $content];
    }

    $end = strpos($content, "\n---", 4);
    if ($end === false) {
        return [[''], $content];
    }

    $fm = substr($content, 4, $end - 4);
    $body = substr($content, $end + 4);
    $body = ltrim($body, "\r\n");

    $meta = [];
    $lines = explode("\n", $fm);
    $currentKey = null;

    foreach ($lines as $line) {
        $line = rtrim($line);
        if (preg_match('/^(\w[\w\-]*):\s*(.*)$/', $line, $m)) {
            $currentKey = $m[1];
            $val = trim($m[2]);
            if ($val === '|') {
                $meta[$currentKey] = '';
            } elseif ($val !== '') {
                // 处理 YAML 列表
                if (preg_match('/^\[(.+)\]$/', $val, $listMatch)) {
                    $items = array_map('trim', explode(',', $listMatch[1]));
                    $items = array_map(function($s) { return trim($s, '" \''); }, $items);
                    $meta[$currentKey] = $items;
                } else {
                    $meta[$currentKey] = trim($val, '"\'');
                }
            }
        } elseif (preg_match('/^\s+-\s+(.*)$/', $line, $m) && $currentKey) {
            if (!is_array($meta[$currentKey])) {
                $meta[$currentKey] = [];
            }
            $meta[$currentKey][] = trim($m[1], '"\'');
        } elseif ($currentKey && isset($meta[$currentKey]) && $meta[$currentKey] === '') {
            // 多行值（| 模式）
            $meta[$currentKey] .= ($meta[$currentKey] ? "\n" : '') . $line;
        }
    }

    return [$meta, $body];
}

function slugify($text) {
    // 简单的 slug 生成（中文保留原样，仅清理特殊字符）
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9\x{4e00}-\x{9fff}\-]/u', '-', $text);
    $text = preg_replace('/-+/', '-', $text);
    $text = trim($text, '-');
    return $text;
}

echo "=== UEMCraft 数据迁移脚本 ===\n\n";

// ---- 连接数据库 ----
$dbPath = $root . '/api/site.db';
if (file_exists($dbPath)) {
    echo "警告：api/site.db 已存在！\n";
    echo "继续将尝试插入数据（如 slug 冲突会跳过）。\n\n";
}

$db = getSiteDb();
echo "数据库连接成功：{$dbPath}\n\n";

// ---- 迁移新闻 ----
echo "--- 迁移新闻 ---\n";

$articlesDir = $root . '/articles';
$mdFiles = glob($articlesDir . '/*.md');
$newsCount = 0;
$newsSkipped = 0;

// 从 index.json 获取元数据（如果有）
$indexJson = [];
$indexPath = $articlesDir . '/index.json';
if (file_exists($indexPath)) {
    $indexJson = json_decode(file_get_contents($indexPath), true) ?: [];
}

foreach ($mdFiles as $mdFile) {
    $content = file_get_contents($mdFile);
    [$meta, $body] = parseFrontMatter($content);

    $slug = $meta['slug'] ?? pathinfo($mdFile, PATHINFO_FILENAME);
    $title = $meta['title'] ?? $slug;

    // 检查是否已存在
    $stmt = $db->prepare("SELECT COUNT(*) FROM news WHERE slug = ?");
    $stmt->execute([$slug]);
    if ((int) $stmt->fetchColumn() > 0) {
        echo "  跳过（已存在）：{$slug}\n";
        $newsSkipped++;
        continue;
    }

    $excerpt = $meta['excerpt'] ?? '';
    $author = $meta['author'] ?? '';
    $date = $meta['date'] ?? date('Y-m-d');
    // 标准化日期格式
    if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $date, $dm)) {
        $date = sprintf('%s-%02d-%02d', $dm[1], $dm[2], $dm[3]);
    }
    $cover = $meta['cover'] ?? '';
    $coverCaption = $meta['coverCaption'] ?? '';
    $tags = $meta['tags'] ?? [];
    if (!is_array($tags)) $tags = [$tags];
    $tagsJson = json_encode($tags, JSON_UNESCAPED_UNICODE);

    $ts = time();

    $stmt = $db->prepare("INSERT INTO news (title, slug, excerpt, content, cover, cover_caption, author, tags, date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)");
    $stmt->execute([$title, $slug, $excerpt, $body, $cover, $coverCaption, $author, $tagsJson, $date, $ts, $ts]);

    echo "  已导入：{$title} ({$slug})\n";
    $newsCount++;
}

echo "\n新闻导入完成：新增 {$newsCount} 篇，跳过 {$newsSkipped} 篇\n\n";

// ---- 迁移活动 ----
echo "--- 迁移活动 ---\n";

$eventsDataPath = $root . '/scripts/events-data.json';
if (!file_exists($eventsDataPath)) {
    echo "提示：未找到 scripts/events-data.json，跳过活动迁移。\n";
    echo "如需迁移活动数据，请先从 js/data.js 中提取 events 数据并保存为 scripts/events-data.json\n";
    echo "格式：{\"upcoming\": [...], \"past\": [...], ...}\n\n";
} else {
    $eventsData = json_decode(file_get_contents($eventsDataPath), true);
    $eventCount = 0;
    $eventSkipped = 0;

    $allEvents = array_merge(
        $eventsData['upcoming'] ?? [],
        $eventsData['past'] ?? []
    );

    foreach ($allEvents as $evt) {
        $title = $evt['title'] ?? '';
        if ($title === '') continue;

        $slug = slugify($title);
        if ($slug === '') $slug = 'event-' . ($eventCount + 1);

        // 检查是否已存在
        $stmt = $db->prepare("SELECT COUNT(*) FROM events WHERE slug = ?");
        $stmt->execute([$slug]);
        if ((int) $stmt->fetchColumn() > 0) {
            echo "  跳过（已存在）：{$slug}\n";
            $eventSkipped++;
            continue;
        }

        $excerpt = $evt['excerpt'] ?? '';
        $cover = $evt['cover'] ?? '';
        $dateLabel = $evt['dateLabel'] ?? '';
        $status = $evt['status'] ?? 'upcoming';
        $link = $evt['link'] ?? '';
        $ts = time();

        $stmt = $db->prepare("INSERT INTO events (title, slug, excerpt, content, cover, date_label, date_start, date_end, status, link, is_featured, sort_order, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?, '', '', ?, ?, 0, 0, ?, ?)");
        $stmt->execute([$title, $slug, $excerpt, $cover, $dateLabel, $status, $link, $ts, $ts]);

        echo "  已导入：{$title} ({$slug})\n";
        $eventCount++;
    }

    echo "\n活动导入完成：新增 {$eventCount} 个，跳过 {$eventSkipped} 个\n\n";
}

echo "=== 迁移完成 ===\n";
echo "数据库文件：{$dbPath}\n";
