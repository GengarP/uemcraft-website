<?php
/**
 * works.php — UEMCraft 作品 API
 * ------------------------------
 * 公开接口：
 *   GET  ?action=list&category=xxx                    （已发布，按 sort_order + created_at）
 *   GET  ?action=detail&slug=xxx
 *   GET  ?action=categories                            （去重分类列表）
 *
 * 管理接口（需 X-Admin-Token 请求头，环境变量 ADMIN_TOKEN）：
 *   GET  ?action=admin_list&page=1&limit=20&status=all|published|draft
 *   GET  ?action=admin_detail&id=xxx
 *   POST ?action=create
 *   POST ?action=update
 *   POST ?action=delete
 */

require_once __DIR__ . '/common.php';

define('WORKS_STATUS_ALLOWED', ['published', 'draft']);

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 公开：已发布作品列表 ----
    if ($action === 'list') {
        $category = trim($_GET['category'] ?? '');
        $where = "WHERE status = 'published'";
        $params = [];
        if ($category !== '') {
            $where .= " AND category = :category";
            $params[':category'] = $category;
        }

        $stmt = $db->prepare("SELECT id, title, slug, description, cover, image, category, sort_order FROM works $where ORDER BY sort_order ASC, created_at DESC");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['sort_order'] = (int) $row['sort_order'];
        }
        unset($row);

        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 公开：分类列表 ----
    if ($action === 'categories') {
        $stmt = $db->query("SELECT DISTINCT category FROM works WHERE status = 'published' AND category != '' ORDER BY category ASC");
        $rows = $stmt->fetchAll();
        $categories = array_map(function ($r) { return $r['category']; }, $rows);
        json_response(['success' => true, 'data' => $categories]);
    }

    // ---- 公开：作品详情 ----
    if ($action === 'detail') {
        $slug = trim($_GET['slug'] ?? '');
        if ($slug === '') {
            json_response(['success' => false, 'error' => '缺少 slug 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM works WHERE slug = ? AND status = 'published'");
        $stmt->execute([$slug]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '作品不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['sort_order'] = (int) $row['sort_order'];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：作品详情（用于编辑） ----
    if ($action === 'admin_detail') {
        requireAdmin();

        $id = intval($_GET['id'] ?? 0);
        if ($id <= 0) {
            json_response(['success' => false, 'error' => '缺少 id 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM works WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '作品不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['sort_order'] = (int) $row['sort_order'];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：作品列表（全部状态） ----
    if ($action === 'admin_list') {
        requireAdmin();

        $page   = max(1, intval($_GET['page'] ?? 1));
        $limit  = min(100, max(1, intval($_GET['limit'] ?? 20)));
        $status = $_GET['status'] ?? 'all';

        $where  = '';
        $params = [];
        if (in_array($status, WORKS_STATUS_ALLOWED, true)) {
            $where = 'WHERE status = :status';
            $params[':status'] = $status;
        }

        $totalStmt = $db->prepare("SELECT COUNT(*) FROM works $where");
        $totalStmt->execute($params);
        $total = (int) $totalStmt->fetchColumn();

        $stmt = $db->prepare("SELECT * FROM works $where ORDER BY sort_order ASC, created_at DESC LIMIT :limit OFFSET :offset");
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', ($page - 1) * $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['sort_order'] = (int) $row['sort_order'];
            $row['created_at'] = (int) $row['created_at'];
            $row['updated_at'] = (int) $row['updated_at'];
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

    // ---- 管理：创建作品 ----
    if ($action === 'create') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();

        $title       = trim($input['title'] ?? '');
        $slug        = trim($input['slug'] ?? '');
        $description = trim($input['description'] ?? '');
        $cover       = trim($input['cover'] ?? '');
        $image       = trim($input['image'] ?? '');
        $category    = trim($input['category'] ?? '');
        $sort_order  = intval($input['sort_order'] ?? 0);
        $status      = trim($input['status'] ?? 'published');

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
        if (!in_array($status, WORKS_STATUS_ALLOWED, true)) {
            $status = 'published';
        }

        // slug 唯一性
        $stmt = $db->prepare("SELECT COUNT(*) FROM works WHERE slug = ?");
        $stmt->execute([$slug]);
        if ((int) $stmt->fetchColumn() > 0) {
            json_response(['success' => false, 'error' => 'slug 已存在，请更换'], 400);
        }

        $ts = now();

        $stmt = $db->prepare("INSERT INTO works (title, slug, description, cover, image, category, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$title, $slug, $description, $cover, $image, $category, $sort_order, $status, $ts, $ts]);

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

    // ---- 管理：更新作品 ----
    if ($action === 'update') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("SELECT * FROM works WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '作品不存在'], 404);
        }

        // 部分更新
        $title       = array_key_exists('title', $input)       ? trim($input['title'])       : $existing['title'];
        $slug        = array_key_exists('slug', $input)        ? trim($input['slug'])        : $existing['slug'];
        $description = array_key_exists('description', $input) ? trim($input['description']) : $existing['description'];
        $cover       = array_key_exists('cover', $input)       ? trim($input['cover'])       : $existing['cover'];
        $image       = array_key_exists('image', $input)       ? trim($input['image'])       : $existing['image'];
        $category    = array_key_exists('category', $input)    ? trim($input['category'])    : $existing['category'];
        $sort_order  = array_key_exists('sort_order', $input)  ? intval($input['sort_order'])  : (int) $existing['sort_order'];
        $status      = array_key_exists('status', $input)      ? trim($input['status'])      : $existing['status'];

        // 校验
        if ($title === '') {
            json_response(['success' => false, 'error' => '标题不能为空'], 400);
        }
        if ($slug !== $existing['slug']) {
            if (!preg_match('/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/i', $slug)) {
                json_response(['success' => false, 'error' => 'slug 只能包含字母、数字和连字符'], 400);
            }
            $stmt = $db->prepare("SELECT COUNT(*) FROM works WHERE slug = ? AND id != ?");
            $stmt->execute([$slug, $id]);
            if ((int) $stmt->fetchColumn() > 0) {
                json_response(['success' => false, 'error' => 'slug 已存在'], 400);
            }
        }
        if (!in_array($status, WORKS_STATUS_ALLOWED, true)) {
            $status = $existing['status'];
        }

        $stmt = $db->prepare("UPDATE works SET title=?, slug=?, description=?, cover=?, image=?, category=?, sort_order=?, status=?, updated_at=? WHERE id=?");
        $stmt->execute([$title, $slug, $description, $cover, $image, $category, $sort_order, $status, now(), $id]);

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

    // ---- 管理：删除作品 ----
    if ($action === 'delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("DELETE FROM works WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json_response(['success' => false, 'error' => '作品不存在'], 404);
        }

        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[works.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
