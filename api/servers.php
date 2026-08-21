<?php
/**
 * servers.php — UEMCraft 服务器管理 API
 * --------------------------------------
 * 公开接口：
 *   GET  ?action=list                    （全部，按 sort_order）
 *   GET  ?action=featured                （置顶服务器）
 *
 * 管理接口（需 X-Admin-Token 请求头）：
 *   GET  ?action=admin_list&page=1&limit=20
 *   GET  ?action=admin_detail&id=xxx
 *   POST ?action=create
 *   POST ?action=update
 *   POST ?action=delete
 */

require_once __DIR__ . '/common.php';

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 公开：全部服务器 ----
    if ($action === 'list') {
        $stmt = $db->query("SELECT id, name, address, note, is_featured, sort_order FROM servers ORDER BY sort_order ASC, id ASC");
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['is_featured'] = (int) $row['is_featured'];
            $row['sort_order'] = (int) $row['sort_order'];
        }
        unset($row);

        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 公开：置顶服务器 ----
    if ($action === 'featured') {
        $stmt = $db->query("SELECT id, name, address, note, is_featured, sort_order FROM servers WHERE is_featured = 1 ORDER BY sort_order ASC, id ASC LIMIT 1");
        $row = $stmt->fetch();

        if (!$row) {
            // 回退到第一条
            $stmt = $db->query("SELECT id, name, address, note, is_featured, sort_order FROM servers ORDER BY sort_order ASC, id ASC LIMIT 1");
            $row = $stmt->fetch();
        }

        if ($row) {
            $row['id'] = (int) $row['id'];
            $row['is_featured'] = (int) $row['is_featured'];
            $row['sort_order'] = (int) $row['sort_order'];
        }

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：服务器详情（编辑用） ----
    if ($action === 'admin_detail') {
        requireAdmin();

        $id = intval($_GET['id'] ?? 0);
        if ($id <= 0) {
            json_response(['success' => false, 'error' => '缺少 id 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM servers WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '服务器不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['is_featured'] = (int) $row['is_featured'];
        $row['sort_order'] = (int) $row['sort_order'];
        $row['created_at'] = (int) $row['created_at'];
        $row['updated_at'] = (int) $row['updated_at'];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：服务器列表 ----
    if ($action === 'admin_list') {
        requireAdmin();

        $page  = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(1, intval($_GET['limit'] ?? 20)));

        $result = paginate(
            $db,
            "SELECT COUNT(*) FROM servers",
            "SELECT * FROM servers ORDER BY sort_order ASC, id ASC",
            [],
            $page,
            $limit
        );

        foreach ($result['data'] as &$row) {
            $row['id'] = (int) $row['id'];
            $row['is_featured'] = (int) $row['is_featured'];
            $row['sort_order'] = (int) $row['sort_order'];
            $row['created_at'] = (int) $row['created_at'];
            $row['updated_at'] = (int) $row['updated_at'];
        }
        unset($row);

        json_response(array_merge(['success' => true], $result));
    }

    // ---- 管理：创建服务器 ----
    if ($action === 'create') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();

        $name       = trim($input['name'] ?? '');
        $address    = trim($input['address'] ?? '');
        $note       = trim($input['note'] ?? '');
        $is_featured = intval($input['is_featured'] ?? 0) ? 1 : 0;
        $sort_order  = intval($input['sort_order'] ?? 0);

        if ($name === '') {
            json_response(['success' => false, 'error' => '服务器名称不能为空'], 400);
        }
        if ($address === '') {
            json_response(['success' => false, 'error' => '服务器地址不能为空'], 400);
        }

        // 如果设为置顶，先取消其他置顶
        if ($is_featured) {
            $db->exec("UPDATE servers SET is_featured = 0 WHERE is_featured = 1");
        }

        $ts = now();

        $stmt = $db->prepare("INSERT INTO servers (name, address, note, is_featured, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $address, $note, $is_featured, $sort_order, $ts, $ts]);

        json_response([
            'success' => true,
            'data' => [
                'id'    => (int) $db->lastInsertId(),
                'name'  => $name,
                'address' => $address,
            ],
        ]);
    }

    // ---- 管理：更新服务器 ----
    if ($action === 'update') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("SELECT * FROM servers WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '服务器不存在'], 404);
        }

        // 部分更新
        $name       = array_key_exists('name', $input)       ? trim($input['name'])       : $existing['name'];
        $address    = array_key_exists('address', $input)    ? trim($input['address'])    : $existing['address'];
        $note       = array_key_exists('note', $input)       ? trim($input['note'])       : $existing['note'];
        $is_featured = array_key_exists('is_featured', $input) ? (intval($input['is_featured']) ? 1 : 0) : (int) $existing['is_featured'];
        $sort_order  = array_key_exists('sort_order', $input)  ? intval($input['sort_order'])  : (int) $existing['sort_order'];

        if ($name === '') {
            json_response(['success' => false, 'error' => '服务器名称不能为空'], 400);
        }
        if ($address === '') {
            json_response(['success' => false, 'error' => '服务器地址不能为空'], 400);
        }

        // 如果设为置顶，先取消其他置顶
        if ($is_featured && !(int) $existing['is_featured']) {
            $db->exec("UPDATE servers SET is_featured = 0 WHERE is_featured = 1");
        }

        $stmt = $db->prepare("UPDATE servers SET name=?, address=?, note=?, is_featured=?, sort_order=?, updated_at=? WHERE id=?");
        $stmt->execute([$name, $address, $note, $is_featured, $sort_order, now(), $id]);

        json_response([
            'success' => true,
            'data' => [
                'id'    => $id,
                'name'  => $name,
                'address' => $address,
            ],
        ]);
    }

    // ---- 管理：删除服务器 ----
    if ($action === 'delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("DELETE FROM servers WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json_response(['success' => false, 'error' => '服务器不存在'], 404);
        }

        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[servers.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
