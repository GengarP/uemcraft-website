<?php
/**
 * docs.php — UEMCraft 指南与文档 API
 * ------------------------------------
 * 公开接口：
 *   GET  ?action=list                                     （仅 status=published，按 category, sort_order）
 *   GET  ?action=detail&slug=xxx                           （仅 status=published）
 *   GET  ?action=categories                                （返回所有分类列表）
 *
 * 管理接口（需 X-Admin-Token 请求头，环境变量 ADMIN_TOKEN）：
 *   GET  ?action=admin_list&page=1&limit=20&status=all|published|draft
 *   GET  ?action=admin_detail&id=xxx
 *   POST ?action=create    （JSON {category, title, slug, content, sort_order?, status?}）
 *   POST ?action=update    （JSON {id, ...任意字段}）
 *   POST ?action=delete    （JSON {id}）
 */

require_once __DIR__ . '/common.php';

define('DOCS_STATUS_ALLOWED', ['published', 'draft']);

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 公开：文档列表（仅已发布） ----
    if ($action === 'list') {
        $stmt = $db->query("SELECT id, category, title, slug, sort_order FROM docs WHERE status = 'published' ORDER BY category ASC, sort_order ASC, id ASC");
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['sort_order'] = (int) $row['sort_order'];
        }
        unset($row);

        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 公开：文档详情（仅已发布） ----
    if ($action === 'detail') {
        $slug = trim($_GET['slug'] ?? '');
        if ($slug === '') {
            json_response(['success' => false, 'error' => '缺少 slug 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM docs WHERE slug = :slug AND status = 'published'");
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '文档不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['sort_order'] = (int) $row['sort_order'];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 公开：分类列表 ----
    if ($action === 'categories') {
        $stmt = $db->query("SELECT DISTINCT category FROM docs WHERE status = 'published' AND category != '' ORDER BY category ASC");
        $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);
        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 管理：文档详情（含正文，用于编辑） ----
    if ($action === 'admin_detail') {
        requireAdmin();

        $id = intval($_GET['id'] ?? 0);
        if ($id <= 0) {
            json_response(['success' => false, 'error' => '缺少 id 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM docs WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '文档不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['sort_order'] = (int) $row['sort_order'];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：文档列表（全部状态） ----
    if ($action === 'admin_list') {
        requireAdmin();

        $page   = max(1, intval($_GET['page'] ?? 1));
        $limit  = min(100, max(1, intval($_GET['limit'] ?? 50)));
        $status = $_GET['status'] ?? 'all';

        $where  = '';
        $params = [];
        if (in_array($status, DOCS_STATUS_ALLOWED, true)) {
            $where = 'WHERE status = :status';
            $params[':status'] = $status;
        }

        $totalStmt = $db->prepare("SELECT COUNT(*) FROM docs $where");
        $totalStmt->execute($params);
        $total = (int) $totalStmt->fetchColumn();

        $stmt = $db->prepare("SELECT id, category, title, slug, sort_order, status, created_at, updated_at FROM docs $where ORDER BY category ASC, sort_order ASC, id ASC LIMIT :limit OFFSET :offset");
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
            'pages'   => (int) ceil(($total ?: 1) / $limit),
        ]);
    }

    // ---- 管理：创建文档 ----
    if ($action === 'create') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();

        $category  = trim($input['category'] ?? '');
        $title     = trim($input['title'] ?? '');
        $slug      = trim($input['slug'] ?? '');
        $content   = $input['content'] ?? '';
        $sort_order = intval($input['sort_order'] ?? 0);
        $status    = trim($input['status'] ?? 'draft');

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
        if (!in_array($status, DOCS_STATUS_ALLOWED, true)) {
            $status = 'draft';
        }

        // slug 唯一性
        $stmt = $db->prepare("SELECT COUNT(*) FROM docs WHERE slug = ?");
        $stmt->execute([$slug]);
        if ((int) $stmt->fetchColumn() > 0) {
            json_response(['success' => false, 'error' => 'slug 已存在，请更换'], 400);
        }

        $ts = now();

        $stmt = $db->prepare("INSERT INTO docs (category, title, slug, content, sort_order, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$category, $title, $slug, $content, $sort_order, $status, $ts, $ts]);

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

    // ---- 管理：更新文档 ----
    if ($action === 'update') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        // 查询现有记录
        $stmt = $db->prepare("SELECT * FROM docs WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '文档不存在'], 404);
        }

        // 部分更新
        $category  = array_key_exists('category', $input)  ? trim($input['category'])  : $existing['category'];
        $title     = array_key_exists('title', $input)     ? trim($input['title'])     : $existing['title'];
        $slug      = array_key_exists('slug', $input)      ? trim($input['slug'])      : $existing['slug'];
        $content   = array_key_exists('content', $input)   ? $input['content']         : $existing['content'];
        $sort_order = array_key_exists('sort_order', $input) ? intval($input['sort_order']) : (int) $existing['sort_order'];
        $status    = array_key_exists('status', $input)    ? trim($input['status'])    : $existing['status'];

        // 校验
        if ($title === '') {
            json_response(['success' => false, 'error' => '标题不能为空'], 400);
        }
        if ($slug !== $existing['slug']) {
            if (!preg_match('/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/i', $slug)) {
                json_response(['success' => false, 'error' => 'slug 只能包含字母、数字和连字符'], 400);
            }
            $stmt = $db->prepare("SELECT COUNT(*) FROM docs WHERE slug = ? AND id != ?");
            $stmt->execute([$slug, $id]);
            if ((int) $stmt->fetchColumn() > 0) {
                json_response(['success' => false, 'error' => 'slug 已存在'], 400);
            }
        }
        if (!in_array($status, DOCS_STATUS_ALLOWED, true)) {
            $status = $existing['status'];
        }

        $stmt = $db->prepare("UPDATE docs SET category=?, title=?, slug=?, content=?, sort_order=?, status=?, updated_at=? WHERE id=?");
        $stmt->execute([$category, $title, $slug, $content, $sort_order, $status, now(), $id]);

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

    // ---- 管理：删除文档 ----
    if ($action === 'delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("DELETE FROM docs WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json_response(['success' => false, 'error' => '文档不存在'], 404);
        }

        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[docs.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
