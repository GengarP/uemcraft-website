<?php
/**
 * events.php — UEMCraft 活动 API
 * --------------------------------
 * 公开接口：
 *   GET  ?action=list                                  （全部，按 sort_order + date_start）
 *   GET  ?action=upcoming                              （upcoming + ongoing）
 *   GET  ?action=past                                  （past）
 *   GET  ?action=detail&slug=xxx
 *
 * 管理接口（需 X-Admin-Token 请求头，环境变量 ADMIN_TOKEN）：
 *   GET  ?action=admin_list&page=1&limit=20&status=all|upcoming|ongoing|past
 *   POST ?action=create
 *   POST ?action=update
 *   POST ?action=delete
 */

require_once __DIR__ . '/common.php';

define('EVENTS_STATUS_ALLOWED', ['upcoming', 'ongoing', 'past']);

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 公开：全部活动 ----
    if ($action === 'list') {
        $stmt = $db->query("SELECT id, title, slug, excerpt, cover, date_label, date_start, date_end, status, link, is_featured, sort_order FROM events ORDER BY is_featured DESC, sort_order ASC, date_start DESC");
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['is_featured'] = (int) $row['is_featured'];
            $row['sort_order'] = (int) $row['sort_order'];
        }
        unset($row);

        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 公开：近期活动（upcoming + ongoing） ----
    if ($action === 'upcoming') {
        $stmt = $db->prepare("SELECT id, title, slug, excerpt, cover, date_label, date_start, date_end, status, link, is_featured, sort_order FROM events WHERE status IN ('upcoming', 'ongoing') ORDER BY is_featured DESC, sort_order ASC, date_start ASC");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['is_featured'] = (int) $row['is_featured'];
            $row['sort_order'] = (int) $row['sort_order'];
        }
        unset($row);

        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 公开：往期活动（past） ----
    if ($action === 'past') {
        $stmt = $db->prepare("SELECT id, title, slug, excerpt, cover, date_label, date_start, date_end, status, link, is_featured, sort_order FROM events WHERE status = 'past' ORDER BY is_featured DESC, date_start DESC");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['is_featured'] = (int) $row['is_featured'];
            $row['sort_order'] = (int) $row['sort_order'];
        }
        unset($row);

        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 公开：活动详情 ----
    if ($action === 'detail') {
        $slug = trim($_GET['slug'] ?? '');
        if ($slug === '') {
            json_response(['success' => false, 'error' => '缺少 slug 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM events WHERE slug = ?");
        $stmt->execute([$slug]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '活动不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['is_featured'] = (int) $row['is_featured'];
        $row['sort_order'] = (int) $row['sort_order'];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：活动详情（用于编辑） ----
    if ($action === 'admin_detail') {
        requireAdmin();

        $id = intval($_GET['id'] ?? 0);
        if ($id <= 0) {
            json_response(['success' => false, 'error' => '缺少 id 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM events WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '活动不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['is_featured'] = (int) $row['is_featured'];
        $row['sort_order'] = (int) $row['sort_order'];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：活动列表（全部状态） ----
    if ($action === 'admin_list') {
        requireAdmin();

        $page   = max(1, intval($_GET['page'] ?? 1));
        $limit  = min(100, max(1, intval($_GET['limit'] ?? 20)));
        $status = $_GET['status'] ?? 'all';

        $where  = '';
        $params = [];
        if (in_array($status, EVENTS_STATUS_ALLOWED, true)) {
            $where = 'WHERE status = :status';
            $params[':status'] = $status;
        }

        $totalStmt = $db->prepare("SELECT COUNT(*) FROM events $where");
        $totalStmt->execute($params);
        $total = (int) $totalStmt->fetchColumn();

        $stmt = $db->prepare("SELECT * FROM events $where ORDER BY is_featured DESC, sort_order ASC, date_start DESC LIMIT :limit OFFSET :offset");
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', ($page - 1) * $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['is_featured'] = (int) $row['is_featured'];
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

    // ---- 管理：创建活动 ----
    if ($action === 'create') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();

        $title      = trim($input['title'] ?? '');
        $slug       = trim($input['slug'] ?? '');
        $excerpt    = trim($input['excerpt'] ?? '');
        $content    = $input['content'] ?? '';
        $cover      = trim($input['cover'] ?? '');
        $date_label = trim($input['date_label'] ?? '');
        $date_start = trim($input['date_start'] ?? '');
        $date_end   = trim($input['date_end'] ?? '');
        $status     = trim($input['status'] ?? 'upcoming');
        $link       = trim($input['link'] ?? '');
        $is_featured = intval($input['is_featured'] ?? 0) ? 1 : 0;
        $sort_order  = intval($input['sort_order'] ?? 0);

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
        if (!in_array($status, EVENTS_STATUS_ALLOWED, true)) {
            $status = 'upcoming';
        }

        // slug 唯一性
        $stmt = $db->prepare("SELECT COUNT(*) FROM events WHERE slug = ?");
        $stmt->execute([$slug]);
        if ((int) $stmt->fetchColumn() > 0) {
            json_response(['success' => false, 'error' => 'slug 已存在，请更换'], 400);
        }

        $ts = now();

        $stmt = $db->prepare("INSERT INTO events (title, slug, excerpt, content, cover, date_label, date_start, date_end, status, link, is_featured, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$title, $slug, $excerpt, $content, $cover, $date_label, $date_start, $date_end, $status, $link, $is_featured, $sort_order, $ts, $ts]);

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

    // ---- 管理：更新活动 ----
    if ($action === 'update') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("SELECT * FROM events WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '活动不存在'], 404);
        }

        // 部分更新
        $title      = array_key_exists('title', $input)      ? trim($input['title'])      : $existing['title'];
        $slug       = array_key_exists('slug', $input)       ? trim($input['slug'])       : $existing['slug'];
        $excerpt    = array_key_exists('excerpt', $input)    ? trim($input['excerpt'])    : $existing['excerpt'];
        $content    = array_key_exists('content', $input)    ? $input['content']          : $existing['content'];
        $cover      = array_key_exists('cover', $input)      ? trim($input['cover'])      : $existing['cover'];
        $date_label = array_key_exists('date_label', $input) ? trim($input['date_label']) : $existing['date_label'];
        $date_start = array_key_exists('date_start', $input) ? trim($input['date_start']) : $existing['date_start'];
        $date_end   = array_key_exists('date_end', $input)   ? trim($input['date_end'])   : $existing['date_end'];
        $status     = array_key_exists('status', $input)     ? trim($input['status'])     : $existing['status'];
        $link       = array_key_exists('link', $input)       ? trim($input['link'])       : $existing['link'];
        $is_featured = array_key_exists('is_featured', $input) ? (intval($input['is_featured']) ? 1 : 0) : (int) $existing['is_featured'];
        $sort_order  = array_key_exists('sort_order', $input)  ? intval($input['sort_order'])  : (int) $existing['sort_order'];

        // 校验
        if ($title === '') {
            json_response(['success' => false, 'error' => '标题不能为空'], 400);
        }
        if ($slug !== $existing['slug']) {
            if (!preg_match('/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/i', $slug)) {
                json_response(['success' => false, 'error' => 'slug 只能包含字母、数字和连字符'], 400);
            }
            $stmt = $db->prepare("SELECT COUNT(*) FROM events WHERE slug = ? AND id != ?");
            $stmt->execute([$slug, $id]);
            if ((int) $stmt->fetchColumn() > 0) {
                json_response(['success' => false, 'error' => 'slug 已存在'], 400);
            }
        }
        if (!in_array($status, EVENTS_STATUS_ALLOWED, true)) {
            $status = $existing['status'];
        }

        $stmt = $db->prepare("UPDATE events SET title=?, slug=?, excerpt=?, content=?, cover=?, date_label=?, date_start=?, date_end=?, status=?, link=?, is_featured=?, sort_order=?, updated_at=? WHERE id=?");
        $stmt->execute([$title, $slug, $excerpt, $content, $cover, $date_label, $date_start, $date_end, $status, $link, $is_featured, $sort_order, now(), $id]);

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

    // ---- 管理：删除活动 ----
    if ($action === 'delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("DELETE FROM events WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json_response(['success' => false, 'error' => '活动不存在'], 404);
        }

        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[events.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
