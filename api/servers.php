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

/**
 * 对外展示时掩码地址（隐藏真实 IP / 域名）
 * play.uemcraft.cn → play.***.cn
 * 192.168.1.100   → 192.***.***.100
 */
function mask_address($addr) {
    if (strpos($addr, '.') === false) return '***';
    $parts = explode('.', $addr);
    if (count($parts) <= 2) return $parts[0] . '.***';
    // 保留首尾段，中间用 *** 替代
    return $parts[0] . '.***.' . end($parts);
}

try {
    $db = getSiteDb();

    // ---- 公开：全部服务器 ----
    if ($action === 'list') {
        $stmt = $db->query("SELECT id, name, address, port, edition, note, is_featured, hide_address, sort_order FROM servers ORDER BY sort_order ASC, id ASC");
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['port'] = (int) ($row['port'] ?? 0);
            $row['edition'] = $row['edition'] ?? 'java';
            $row['is_featured'] = (int) $row['is_featured'];
            $row['hide_address'] = (int) ($row['hide_address'] ?? 0);
            $row['sort_order'] = (int) $row['sort_order'];
            // 隐藏地址时对外掩码
            if ($row['hide_address']) {
                $row['address'] = mask_address($row['address']);
            }
        }
        unset($row);

        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 公开：置顶服务器 ----
    if ($action === 'featured') {
        $stmt = $db->query("SELECT id, name, address, port, edition, note, is_featured, hide_address, sort_order FROM servers WHERE is_featured = 1 ORDER BY sort_order ASC, id ASC LIMIT 1");
        $row = $stmt->fetch();

        if (!$row) {
            // 回退到第一条
            $stmt = $db->query("SELECT id, name, address, port, edition, note, is_featured, hide_address, sort_order FROM servers ORDER BY sort_order ASC, id ASC LIMIT 1");
            $row = $stmt->fetch();
        }

        if ($row) {
            $row['id'] = (int) $row['id'];
            $row['port'] = (int) ($row['port'] ?? 0);
            $row['edition'] = $row['edition'] ?? 'java';
            $row['is_featured'] = (int) $row['is_featured'];
            $row['hide_address'] = (int) ($row['hide_address'] ?? 0);
            $row['sort_order'] = (int) $row['sort_order'];
            if ($row['hide_address']) {
                $row['address'] = mask_address($row['address']);
            }
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
        $row['port'] = (int) ($row['port'] ?? 0);
        $row['edition'] = $row['edition'] ?? 'java';
        $row['is_featured'] = (int) $row['is_featured'];
        $row['hide_address'] = (int) ($row['hide_address'] ?? 0);
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
            $row['port'] = (int) ($row['port'] ?? 0);
            $row['edition'] = $row['edition'] ?? 'java';
            $row['is_featured'] = (int) $row['is_featured'];
            $row['hide_address'] = (int) ($row['hide_address'] ?? 0);
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
        $port       = max(0, intval($input['port'] ?? 0));
        $edition    = in_array($input['edition'] ?? '', ['java', 'bedrock']) ? $input['edition'] : 'java';
        $note       = trim($input['note'] ?? '');
        $is_featured = intval($input['is_featured'] ?? 0) ? 1 : 0;
        $hide_address = intval($input['hide_address'] ?? 0) ? 1 : 0;
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

        $stmt = $db->prepare("INSERT INTO servers (name, address, port, edition, note, is_featured, hide_address, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $address, $port, $edition, $note, $is_featured, $hide_address, $sort_order, $ts, $ts]);

        json_response([
            'success' => true,
            'data' => [
                'id'    => (int) $db->lastInsertId(),
                'name'  => $name,
                'address' => $address,
                'port'  => $port,
                'edition' => $edition,
                'hide_address' => $hide_address,
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
        $port       = array_key_exists('port', $input)       ? max(0, intval($input['port'])) : (int) ($existing['port'] ?? 0);
        $edition    = array_key_exists('edition', $input) && in_array($input['edition'], ['java', 'bedrock']) ? $input['edition'] : ($existing['edition'] ?? 'java');
        $note       = array_key_exists('note', $input)       ? trim($input['note'])       : $existing['note'];
        $is_featured = array_key_exists('is_featured', $input) ? (intval($input['is_featured']) ? 1 : 0) : (int) $existing['is_featured'];
        $hide_address = array_key_exists('hide_address', $input) ? (intval($input['hide_address']) ? 1 : 0) : (int) ($existing['hide_address'] ?? 0);
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

        $stmt = $db->prepare("UPDATE servers SET name=?, address=?, port=?, edition=?, note=?, is_featured=?, hide_address=?, sort_order=?, updated_at=? WHERE id=?");
        $stmt->execute([$name, $address, $port, $edition, $note, $is_featured, $hide_address, $sort_order, now(), $id]);

        json_response([
            'success' => true,
            'data' => [
                'id'    => $id,
                'name'  => $name,
                'address' => $address,
                'port'  => $port,
                'edition' => $edition,
                'hide_address' => $hide_address,
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

    // ---- 公开：后端代理批量查询（前端发服务器 ID，后端用真实 IP 查询外部 API） ----
    if ($action === 'batch_query') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $ids = $input['ids'] ?? [];
        if (!is_array($ids) || empty($ids)) {
            json_response(['success' => false, 'error' => '缺少 ids 参数'], 400);
        }

        // 从数据库获取真实地址
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $db->prepare("SELECT id, address, port, edition FROM servers WHERE id IN ($placeholders) ORDER BY sort_order ASC, id ASC");
        $stmt->execute(array_values($ids));
        $rows = $stmt->fetchAll();

        if (empty($rows)) {
            json_response(['success' => false, 'error' => '未找到服务器'], 404);
        }

        // 构建外部 API 请求体
        $servers_payload = [];
        foreach ($rows as $row) {
            $servers_payload[] = [
                'ip'      => $row['address'],
                'port'    => (int) ($row['port'] ?: 0) ?: null,
                'edition' => $row['edition'] ?? 'java',
            ];
        }

        $external_url = 'https://api.uemcraft.cn/mc-query/api/batch/stream';
        $post_body = json_encode(['servers' => $servers_payload]);

        // 流式转发：关闭所有输出缓冲
        while (ob_get_level()) { ob_end_flush(); }
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no');
        @ini_set('zlib.output_compression', 'Off');

        $ch = curl_init($external_url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $post_body,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_HEADER         => false,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_FOLLOWLOCATION => true,
        ]);

        // 流式回调：逐块输出
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $chunk) use ($ids, $rows) {
            // 将外部 API 返回的 index 映射回前端传入的 ID 顺序
            echo $chunk;
            if (ob_get_level()) ob_flush();
            flush();
            return strlen($chunk);
        });

        curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($err) {
            // 查询失败时发送 SSE 错误事件
            $ids_arr = array_values($ids);
            foreach ($rows as $i => $row) {
                echo "event: server_error\n";
                echo "data: " . json_encode(['index' => $i, 'error' => $err, 'online' => false]) . "\n\n";
            }
            if (ob_get_level()) ob_flush();
            flush();
        }

        exit;
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[servers.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
