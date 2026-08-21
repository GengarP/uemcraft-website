<?php
/**
 * news.php — UEMCraft 新闻 API
 * ------------------------------
 * 公开接口：
 *   GET  ?action=list&page=1&limit=10                （仅 status=published）
 *   GET  ?action=detail&slug=xxx                      （仅 status=published）
 *
 * 管理接口（需 X-Admin-Token 请求头，环境变量 ADMIN_TOKEN）：
 *   GET  ?action=admin_list&page=1&limit=20&status=all|published|draft
 *   POST ?action=create    （JSON {title, slug, excerpt, content, cover?, cover_caption?, author?, tags?, date, status?}）
 *   POST ?action=update    （JSON {id, ...任意字段}）
 *   POST ?action=delete    （JSON {id}）
 */

require_once __DIR__ . '/common.php';

define('NEWS_STATUS_ALLOWED', ['published', 'draft']);

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 公开：新闻列表（仅已发布） ----
    if ($action === 'list') {
        $page  = max(1, intval($_GET['page'] ?? 1));
        $limit = min(50, max(1, intval($_GET['limit'] ?? 10)));

        $where  = "WHERE status = 'published'";
        $params = [];

        $totalStmt = $db->query("SELECT COUNT(*) FROM news $where");
        $total = (int) $totalStmt->fetchColumn();

        $stmt = $db->prepare("SELECT id, title, slug, excerpt, cover, cover_caption, author, tags, date, status FROM news $where ORDER BY date DESC LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', ($page - 1) * $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['tags'] = json_decode($row['tags'], true) ?: [];
        }
        unset($row);

        json_response([
            'success' => true,
            'data'    => $rows,
            'page'    => $page,
            'limit'   => $limit,
            'total'   => $total,
            'pages'   => (int) ceil($total / $limit),
        ]);
    }

    // ---- 公开：新闻详情（仅已发布） ----
    if ($action === 'detail') {
        $slug = trim($_GET['slug'] ?? '');
        if ($slug === '') {
            json_response(['success' => false, 'error' => '缺少 slug 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM news WHERE slug = :slug AND status = 'published'");
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '文章不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['tags'] = json_decode($row['tags'], true) ?: [];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：新闻详情（含正文，用于编辑） ----
    if ($action === 'admin_detail') {
        requireAdmin();

        $id = intval($_GET['id'] ?? 0);
        if ($id <= 0) {
            json_response(['success' => false, 'error' => '缺少 id 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM news WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '文章不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['tags'] = json_decode($row['tags'], true) ?: [];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：新闻列表（全部状态） ----
    if ($action === 'admin_list') {
        requireAdmin();

        $page   = max(1, intval($_GET['page'] ?? 1));
        $limit  = min(100, max(1, intval($_GET['limit'] ?? 20)));
        $status = $_GET['status'] ?? 'all';

        $where  = '';
        $params = [];
        if (in_array($status, NEWS_STATUS_ALLOWED, true)) {
            $where = 'WHERE status = :status';
            $params[':status'] = $status;
        }

        $totalStmt = $db->prepare("SELECT COUNT(*) FROM news $where");
        $totalStmt->execute($params);
        $total = (int) $totalStmt->fetchColumn();

        $stmt = $db->prepare("SELECT id, title, slug, excerpt, content, cover, cover_caption, author, tags, date, status, created_at, updated_at FROM news $where ORDER BY date DESC LIMIT :limit OFFSET :offset");
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', ($page - 1) * $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['created_at'] = (int) $row['created_at'];
            $row['updated_at'] = (int) $row['updated_at'];
            $row['tags'] = json_decode($row['tags'], true) ?: [];
        }
        unset($row);

        json_response([
            'success' => true,
            'data'    => $rows,
            'page'    => $page,
            'limit'   => $limit,
            'total'   => $total,
            'pages'   => (int) ceil($total / $limit),
        ]);
    }

    // ---- 管理：创建新闻 ----
    if ($action === 'create') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();

        $title   = trim($input['title'] ?? '');
        $slug    = trim($input['slug'] ?? '');
        $excerpt = trim($input['excerpt'] ?? '');
        $content = $input['content'] ?? '';
        $cover   = trim($input['cover'] ?? '');
        $cover_caption = trim($input['cover_caption'] ?? '');
        $author  = trim($input['author'] ?? '');
        $tags    = $input['tags'] ?? [];
        $date    = trim($input['date'] ?? '');
        $status  = trim($input['status'] ?? 'draft');

        // 校验
        if ($title === '') {
            json_response(['success' => false, 'error' => '标题不能为空'], 400);
        }
        if ($slug === '') {
            json_response(['success' => false, 'error' => 'slug 不能为空'], 400);
        }
        if (!preg_match('/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/i', $slug)) {
            json_response(['success' => false, 'error' => 'slug 只能包含字母、数字和连字符'], 400);
        }
        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            json_response(['success' => false, 'error' => '日期格式不正确（YYYY-MM-DD）'], 400);
        }
        if (!in_array($status, NEWS_STATUS_ALLOWED, true)) {
            $status = 'draft';
        }

        // slug 唯一性
        $stmt = $db->prepare("SELECT COUNT(*) FROM news WHERE slug = ?");
        $stmt->execute([$slug]);
        if ((int) $stmt->fetchColumn() > 0) {
            json_response(['success' => false, 'error' => 'slug 已存在，请更换'], 400);
        }

        // tags 格式化
        if (is_array($tags)) {
            $tagsJson = json_encode($tags, JSON_UNESCAPED_UNICODE);
        } else {
            $tagsJson = '[]';
        }

        $ts = now();

        $stmt = $db->prepare("INSERT INTO news (title, slug, excerpt, content, cover, cover_caption, author, tags, date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$title, $slug, $excerpt, $content, $cover, $cover_caption, $author, $tagsJson, $date, $status, $ts, $ts]);

        json_response([
            'success' => true,
            'data' => [
                'id'     => (int) $db->lastInsertId(),
                'title'  => $title,
                'slug'   => $slug,
                'status' => $status,
            ],
        ]);
    }

    // ---- 管理：更新新闻 ----
    if ($action === 'update') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        // 查询现有记录
        $stmt = $db->prepare("SELECT * FROM news WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '文章不存在'], 404);
        }

        // 部分更新：只更新传入的字段
        $title   = array_key_exists('title', $input)   ? trim($input['title'])   : $existing['title'];
        $slug    = array_key_exists('slug', $input)    ? trim($input['slug'])    : $existing['slug'];
        $excerpt = array_key_exists('excerpt', $input) ? trim($input['excerpt']) : $existing['excerpt'];
        $content = array_key_exists('content', $input) ? $input['content']       : $existing['content'];
        $cover   = array_key_exists('cover', $input)   ? trim($input['cover'])   : $existing['cover'];
        $cover_caption = array_key_exists('cover_caption', $input) ? trim($input['cover_caption']) : $existing['cover_caption'];
        $author  = array_key_exists('author', $input)  ? trim($input['author'])  : $existing['author'];
        $date    = array_key_exists('date', $input)    ? trim($input['date'])    : $existing['date'];
        $status  = array_key_exists('status', $input)  ? trim($input['status'])  : $existing['status'];

        // tags 特殊处理
        if (array_key_exists('tags', $input)) {
            $tags = $input['tags'];
            $tagsJson = is_array($tags) ? json_encode($tags, JSON_UNESCAPED_UNICODE) : '[]';
        } else {
            $tagsJson = $existing['tags'];
        }

        // 校验
        if ($title === '') {
            json_response(['success' => false, 'error' => '标题不能为空'], 400);
        }
        if ($slug !== $existing['slug']) {
            if (!preg_match('/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/i', $slug)) {
                json_response(['success' => false, 'error' => 'slug 只能包含字母、数字和连字符'], 400);
            }
            $stmt = $db->prepare("SELECT COUNT(*) FROM news WHERE slug = ? AND id != ?");
            $stmt->execute([$slug, $id]);
            if ((int) $stmt->fetchColumn() > 0) {
                json_response(['success' => false, 'error' => 'slug 已存在'], 400);
            }
        }
        if ($date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            json_response(['success' => false, 'error' => '日期格式不正确（YYYY-MM-DD）'], 400);
        }
        if (!in_array($status, NEWS_STATUS_ALLOWED, true)) {
            $status = $existing['status'];
        }

        $stmt = $db->prepare("UPDATE news SET title=?, slug=?, excerpt=?, content=?, cover=?, cover_caption=?, author=?, tags=?, date=?, status=?, updated_at=? WHERE id=?");
        $stmt->execute([$title, $slug, $excerpt, $content, $cover, $cover_caption, $author, $tagsJson, $date, $status, now(), $id]);

        json_response([
            'success' => true,
            'data' => [
                'id'     => $id,
                'title'  => $title,
                'slug'   => $slug,
                'status' => $status,
            ],
        ]);
    }

    // ---- 管理：删除新闻 ----
    if ($action === 'delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("DELETE FROM news WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json_response(['success' => false, 'error' => '文章不存在'], 404);
        }

        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[news.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
