<?php
/**
 * wall.php — UEMCraft 留言墙 API
 * --------------------------------
 * 公开接口：
 *   GET  ?action=list&page=1&limit=20      （仅返回 status=approved 的留言）
 *   POST ?action=post                      （JSON {name, content}）
 *
 * 管理接口（需环境变量 ADMIN_TOKEN，请求头 X-Admin-Token）：
 *   GET  ?action=admin_list&page=1&limit=20&status=all|approved|hidden
 *   POST ?action=audit                     （JSON {id, status: approved|hidden}）
 *   POST ?action=edit                      （JSON {id, name?, content?}）
 *   POST ?action=delete                    （JSON {id}）
 *
 * 审核模式：先审后发——新留言调用硅基流动 Qwen3.5-4B 审核，
 * 仅判定合规才 status=approved 公开；不合规或服务不可用均入库为
 * status=hidden 待人工复核。管理员可在后台恢复 approved 或删除。
 *
 * 审核理由：AI 返回的 reason 存入 messages.review_reason，随 admin_list
 * 一起返回给后台展示，便于人工复核时知道被判违规的原因。该字段不对外公开：
 * 公开接口只 SELECT id/name/content/created_at，POST 的响应里也不含它。
 * AI 未给出理由时按情况写入 REASON_AI_UNAVAILABLE / REASON_AI_NO_REASON。
 * 管理员手动审核不会覆盖它——它记录的是 AI 当时的判断。
 *
 * 数据库：默认 SQLite（零配置，库文件 api/wall.db，自动建表）；
 * 切换 MySQL 只需设置环境变量 WALL_DB_DRIVER=mysql，
 * 以及 WALL_DB_HOST / WALL_DB_PORT / WALL_DB_NAME / WALL_DB_USER / WALL_DB_PASS。
 */

require_once __DIR__ . '/common.php';

// ---- wall.php 专属常量 ----
define('RATE_LIMIT_SECONDS', 60);
define('MAX_CONTENT_LENGTH', 500);
define('MAX_NAME_LENGTH', 20);
define('MIN_NAME_LENGTH', 2);
define('STATUS_ALLOWED', ['approved', 'hidden']);
define('MODERATION_API_URL', 'https://api.siliconflow.cn/v1/chat/completions');
define('MODERATION_MODEL', getenv('MODERATION_MODEL') ?: 'Qwen/Qwen3.5-4B');
define('MODERATION_TIMEOUT', 8);
// AI 审核理由的字符上限（与建表的 review_reason 列宽对应）
define('MODERATION_REASON_MAX', 200);
// AI 未给出理由时写入的占位说明，便于人工复核时区分「AI 判违规但没给理由」与「AI 压根没跑」
define('REASON_AI_UNAVAILABLE', 'AI 审核不可用，待人工复核');
define('REASON_AI_NO_REASON', 'AI 未给出理由');

// ---- wall.php 专属函数 ----

function checkRateLimit($db, $ip) {
    $stmt = $db->prepare("SELECT created_at FROM messages WHERE ip = ? ORDER BY created_at DESC LIMIT 1");
    $stmt->execute([$ip]);
    $row = $stmt->fetch();
    if ($row) {
        $elapsed = time() - (int)$row['created_at'];
        if ($elapsed < RATE_LIMIT_SECONDS) {
            return RATE_LIMIT_SECONDS - $elapsed;
        }
    }
    return 0;
}

/**
 * 规整 AI 给出的审核理由：压缩空白、按字符数截断（中文按字算，不能用 substr）。
 */
function cleanReviewReason($reason) {
    $reason = trim(preg_replace('/\s+/u', ' ', (string) $reason));
    if ($reason === '') {
        return '';
    }
    // 按「字」截断：中文用 substr 会切出半个字
    if (function_exists('mb_substr')) {
        return mb_substr($reason, 0, MODERATION_REASON_MAX, 'UTF-8');
    }
    $chars = preg_split('//u', $reason, -1, PREG_SPLIT_NO_EMPTY);
    if ($chars === false) {
        // 连 UTF-8 都不是，只能按字节截
        return substr($reason, 0, MODERATION_REASON_MAX);
    }
    return count($chars) > MODERATION_REASON_MAX
        ? implode('', array_slice($chars, 0, MODERATION_REASON_MAX))
        : $reason;
}

/**
 * 调用硅基流动 Qwen3.5-4B 审核留言是否合规。
 *
 * @return array{status:?string,reason:string}
 *         status 为 'approved'（合规）| 'hidden'（不合规）| null（服务不可用/未配置/解析失败）；
 *         reason 为 AI 给出的简短理由，取不到时为空字符串。
 */
function moderateContent($name, $content) {
    $apiKey = getenv('MODERATION_API_KEY');
    if (!$apiKey || !function_exists('curl_init')) {
        return ['status' => null, 'reason' => ''];
    }

    $system = "你是留言墙内容审核员，判断用户昵称及留言是否合规、是否适合公开发布。"
        . "违规类型包括但不限于：辱骂、人身攻击、色情低俗、政治敏感、违法违规、"
        . "广告垃圾信息、恶意引流、泄露他人隐私、负面引战等。"
        . "任何疑似或变体（谐音、缩写、表情）一律拒绝"
        . "只输出一个 JSON 对象，不要输出任何解释或多余文字，格式：{\"allowed\":true,\"reason\":\"简短理由\"}";

    $user = "昵称：{$name}\n内容：{$content}";

    $payload = json_encode([
        'model' => MODERATION_MODEL,
        'enable_thinking' => false,
        'messages' => [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ],
        'temperature' => 0.1,
        'max_tokens' => 128,
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init(MODERATION_API_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => MODERATION_TIMEOUT,
    ]);
    $resp = curl_exec($ch);
    $err = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($resp === false || $err !== '' || $httpCode !== 200) {
        error_log('[wall.php] 审核请求失败: ' . $err . ' http=' . $httpCode);
        return ['status' => null, 'reason' => ''];
    }

    $json = json_decode($resp, true);
    $text = $json['choices'][0]['message']['content'] ?? '';
    if ($text === '') {
        return ['status' => null, 'reason' => ''];
    }

    $result = json_decode(trim($text), true);
    if (is_array($result) && array_key_exists('allowed', $result)) {
        return [
            'status' => $result['allowed'] ? 'approved' : 'hidden',
            'reason' => cleanReviewReason($result['reason'] ?? ''),
        ];
    }

    // 兜底：整体 JSON 解析失败时（例如模型在 JSON 前后加了说明文字），
    // 仍尝试从文本里抠出 allowed 与 reason
    if (preg_match('/"allowed"\s*:\s*(true|false)/i', $text, $m)) {
        $reason = '';
        if (preg_match('/"reason"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/u', $text, $rm)) {
            // 抠出来的是 JSON 字符串的内容，用 json_decode 还原转义才正确
            // （stripslashes 只是去掉反斜杠，会把 \n 变成 n）
            $decoded = json_decode('"' . $rm[1] . '"', true);
            $reason = is_string($decoded) ? $decoded : stripslashes($rm[1]);
        }
        return [
            'status' => strtolower($m[1]) === 'true' ? 'approved' : 'hidden',
            'reason' => cleanReviewReason($reason),
        ];
    }

    error_log('[wall.php] 审核结果解析失败: ' . $text);
    return ['status' => null, 'reason' => ''];
}

// ---- 路由 ----

$action = $_GET['action'] ?? '';

try {
    $db = getWallDb();

    // ---- 公开：留言列表（仅已通过） ----
    if ($action === 'list') {
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(50, max(1, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $totalStmt = $db->query("SELECT COUNT(*) FROM messages WHERE status = 'approved'");
        $total = (int) $totalStmt->fetchColumn();

        $stmt = $db->prepare("SELECT id, name, content, created_at FROM messages WHERE status = 'approved' ORDER BY created_at DESC LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['created_at'] = (int) $row['created_at'];
        }
        unset($row);

        json_response([
            'success' => true,
            'data' => $rows,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int) ceil($total / $limit)
        ]);
    }

    // ---- 公开：发表留言 ----
    if ($action === 'post') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $name = trim($input['name'] ?? '');
        $content = trim($input['content'] ?? '');

        if (charCount($name) < MIN_NAME_LENGTH || charCount($name) > MAX_NAME_LENGTH) {
            json_response(['success' => false, 'error' => '昵称长度需在 2–20 个字符之间'], 400);
        }
        if ($content === '' || charCount($content) > MAX_CONTENT_LENGTH) {
            json_response(['success' => false, 'error' => '留言内容不能为空，且不能超过 500 个字符'], 400);
        }

        $ip = getClientIp();
        $wait = checkRateLimit($db, $ip);
        if ($wait > 0) {
            json_response(['success' => false, 'error' => '操作太频繁，请 ' . $wait . ' 秒后再试'], 429);
        }

        $review = moderateContent($name, $content);
        $status = $review['status'] === 'approved' ? 'approved' : 'hidden';

        // 留下审核理由供人工复核：AI 给了就用 AI 的，没给就写明是哪种情况
        $reason = $review['reason'];
        if ($reason === '') {
            $reason = $review['status'] === null ? REASON_AI_UNAVAILABLE : REASON_AI_NO_REASON;
        }

        $stmt = $db->prepare("INSERT INTO messages (name, content, ip, status, review_reason, created_at) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $content, $ip, $status, $reason, time()]);

        json_response([
            'success' => true,
            'data' => [
                'id' => (int) $db->lastInsertId(),
                'name' => $name,
                'content' => $content,
                'status' => $status,
                'created_at' => time()
            ]
        ]);
    }

    // ---- 管理：列表（含屏蔽项，可按状态筛选） ----
    if ($action === 'admin_list') {
        requireAdmin('WALL_ADMIN_TOKEN');
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(50, max(1, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;
        $status = $_GET['status'] ?? 'all';

        $where = '';
        $params = [];
        if ($status === 'approved' || $status === 'hidden') {
            $where = 'WHERE status = :status';
            $params[':status'] = $status;
        }

        $totalStmt = $db->prepare("SELECT COUNT(*) FROM messages $where");
        $totalStmt->execute($params);
        $total = (int) $totalStmt->fetchColumn();

        $stmt = $db->prepare("SELECT id, name, content, status, review_reason, created_at FROM messages $where ORDER BY created_at DESC LIMIT :limit OFFSET :offset");
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['created_at'] = (int) $row['created_at'];
        }
        unset($row);

        json_response([
            'success' => true,
            'data' => $rows,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int) ceil($total / $limit)
        ]);
    }

    // ---- 管理：审核（通过/屏蔽） ----
    if ($action === 'audit') {
        requireAdmin('WALL_ADMIN_TOKEN');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }
        $input = readInput();
        $id = requireId($input);
        $status = $input['status'] ?? '';
        if (!in_array($status, STATUS_ALLOWED, true)) {
            json_response(['success' => false, 'error' => 'status 仅支持 approved 或 hidden'], 400);
        }

        $stmt = $db->prepare('UPDATE messages SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
        if ($stmt->rowCount() === 0) {
            json_response(['success' => false, 'error' => '留言不存在'], 404);
        }
        json_response(['success' => true, 'data' => ['id' => $id, 'status' => $status]]);
    }

    // ---- 管理：编辑 ----
    if ($action === 'edit') {
        requireAdmin('WALL_ADMIN_TOKEN');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }
        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare('SELECT name, content FROM messages WHERE id = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '留言不存在'], 404);
        }

        $name = array_key_exists('name', $input) ? trim($input['name']) : $existing['name'];
        $content = array_key_exists('content', $input) ? trim($input['content']) : $existing['content'];

        if (charCount($name) < MIN_NAME_LENGTH || charCount($name) > MAX_NAME_LENGTH) {
            json_response(['success' => false, 'error' => '昵称长度需在 2–20 个字符之间'], 400);
        }
        if ($content === '' || charCount($content) > MAX_CONTENT_LENGTH) {
            json_response(['success' => false, 'error' => '留言内容不能为空，且不能超过 500 个字符'], 400);
        }

        $stmt = $db->prepare('UPDATE messages SET name = ?, content = ? WHERE id = ?');
        $stmt->execute([$name, $content, $id]);
        json_response(['success' => true, 'data' => ['id' => $id, 'name' => $name, 'content' => $content]]);
    }

    // ---- 管理：删除 ----
    if ($action === 'delete') {
        requireAdmin('WALL_ADMIN_TOKEN');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }
        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare('DELETE FROM messages WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json_response(['success' => false, 'error' => '留言不存在'], 404);
        }
        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);
} catch (Throwable $e) {
    error_log('[wall.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
