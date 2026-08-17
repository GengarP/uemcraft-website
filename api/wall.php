<?php
/**
 * wall.php — UEMCraft 留言墙 API
 * --------------------------------
 * 公开接口：
 *   GET  ?action=list&page=1&limit=20      （仅返回 status=approved 的留言）
 *   POST ?action=post                      （JSON {name, content}）
 *
 * 管理接口（需环境变量 WALL_ADMIN_TOKEN，请求头 X-Admin-Token）：
 *   GET  ?action=admin_list&page=1&limit=20&status=all|approved|hidden
 *   POST ?action=audit                     （JSON {id, status: approved|hidden}）
 *   POST ?action=edit                      （JSON {id, name?, content?}）
 *   POST ?action=delete                    （JSON {id}）
 *
 * 审核模式：先审后发——新留言调用智谱 GLM-4.7-Flash 审核，
 * 仅判定合规才 status=approved 公开；不合规或服务不可用（未配置
 * ZHIPU_API_KEY / 无 cURL / 超时 / 报错 / 解析失败）均入库为
 * status=hidden 待人工复核。管理员可在后台恢复 approved 或删除。
 *
 * 数据库：默认 SQLite（零配置，库文件 api/wall.db，自动建表）；
 * 切换 MySQL 只需设置环境变量 WALL_DB_DRIVER=mysql，
 * 以及 WALL_DB_HOST / WALL_DB_PORT / WALL_DB_NAME / WALL_DB_USER / WALL_DB_PASS。
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

define('DB_PATH', __DIR__ . '/wall.db');
define('RATE_LIMIT_SECONDS', 60);
define('MAX_CONTENT_LENGTH', 500);
define('MAX_NAME_LENGTH', 20);
define('MIN_NAME_LENGTH', 2);
define('STATUS_ALLOWED', ['approved', 'hidden']);
define('ZHIPU_API_URL', 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
define('ZHIPU_MODEL', getenv('ZHIPU_MODEL') ?: 'glm-4.7-flash');
define('ZHIPU_TIMEOUT', 8);

function json($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getDb() {
    $driver = getenv('WALL_DB_DRIVER') ?: 'sqlite';

    if ($driver === 'mysql') {
        $host = getenv('WALL_DB_HOST') ?: '127.0.0.1';
        $port = getenv('WALL_DB_PORT') ?: '3306';
        $name = getenv('WALL_DB_NAME');
        $user = getenv('WALL_DB_USER');
        $pass = getenv('WALL_DB_PASS') ?: '';

        if (!$name || !$user) {
            throw new Exception('MySQL 配置缺失：请设置 WALL_DB_NAME 与 WALL_DB_USER 环境变量');
        }

        $db = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $db->exec("CREATE TABLE IF NOT EXISTS messages (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(20) NOT NULL,
            content VARCHAR(500) NOT NULL,
            ip VARCHAR(45) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'approved',
            created_at INT NOT NULL,
            PRIMARY KEY (id),
            KEY idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        migrateMysql($db);
        return $db;
    }

    // 默认 SQLite（零配置，无需环境变量）
    $isNew = !file_exists(DB_PATH);
    $db = new PDO('sqlite:' . DB_PATH);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    if ($isNew) {
        $db->exec("CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            ip TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'approved',
            created_at INTEGER NOT NULL
        )");
        $db->exec("CREATE INDEX idx_created_at ON messages(created_at DESC)");
    }
    migrateSqlite($db);
    return $db;
}

/** 旧库补 status 字段（SQLite） */
function migrateSqlite($db) {
    $cols = $db->query('PRAGMA table_info(messages)')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cols as $col) {
        if ($col['name'] === 'status') return;
    }
    $db->exec("ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'");
}

/** 旧库补 status 字段（MySQL） */
function migrateMysql($db) {
    $stmt = $db->prepare(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'status'"
    );
    $stmt->execute();
    if ((int)$stmt->fetchColumn() === 0) {
        $db->exec("ALTER TABLE messages ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'approved'");
    }
}

function charCount($str) {
    if (function_exists('mb_strlen')) {
        return mb_strlen($str, 'UTF-8');
    }
    return preg_match_all('/./us', $str);
}

function getClientIp() {
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return substr(trim($ips[0]), 0, 45);
    }
    return substr($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', 0, 45);
}

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
 * 调用智谱 GLM-4.7-Flash 审核留言是否合规。
 * 返回 'approved'（合规）| 'hidden'（不合规）| null（服务不可用/未配置/解析失败）。
 */
function moderateContent($name, $content) {
    $apiKey = getenv('ZHIPU_API_KEY');
    if (!$apiKey || !function_exists('curl_init')) {
        return null; // 未配置 API Key 或不支持 cURL → 视为不可用
    }

    $system = "你是留言墙内容审核员，判断用户留言是否合规、是否适合公开发布。"
        . "违规类型包括但不限于：辱骂、人身攻击、色情低俗、政治敏感、违法违规、"
        . "广告垃圾信息、恶意引流、泄露他人隐私等。"
        . "只输出一个 JSON 对象，不要输出任何解释或多余文字，格式：{\"allowed\":true,\"reason\":\"简短理由\"}";

    $user = "昵称：{$name}\n内容：{$content}";

    $payload = json_encode([
        'model' => ZHIPU_MODEL,
        // glm-4.7-flash 默认开启推理，会把 max_tokens 耗在思考上导致正文为空；
        // 审核任务无需推理，显式关闭以获得快速、确定的 JSON 判定
        'thinking' => ['type' => 'disabled'],
        'messages' => [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ],
        'temperature' => 0.1,
        'max_tokens' => 128,
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init(ZHIPU_API_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => ZHIPU_TIMEOUT,
    ]);
    $resp = curl_exec($ch);
    $err = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($resp === false || $err !== '' || $httpCode !== 200) {
        error_log('[wall.php] 审核请求失败: ' . $err . ' http=' . $httpCode);
        return null;
    }

    $json = json_decode($resp, true);
    $text = $json['choices'][0]['message']['content'] ?? '';
    if ($text === '') {
        return null;
    }

    // 期望模型输出 JSON {"allowed": bool}
    $result = json_decode(trim($text), true);
    if (is_array($result) && array_key_exists('allowed', $result)) {
        return $result['allowed'] ? 'approved' : 'hidden';
    }

    // 容错：正则匹配 allowed 的布尔值
    if (preg_match('/"allowed"\s*:\s*(true|false)/i', $text, $m)) {
        return strtolower($m[1]) === 'true' ? 'approved' : 'hidden';
    }

    error_log('[wall.php] 审核结果解析失败: ' . $text);
    return null;
}

/** 读取 JSON 请求体，回退到表单 POST */
function readInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    return $input ?: [];
}

/** 管理员鉴权：未配置 token 或令牌无效时直接 403 */
function requireAdmin() {
    $token = getenv('WALL_ADMIN_TOKEN');
    if (!$token) {
        json(['success' => false, 'error' => '管理员功能未启用：请设置 WALL_ADMIN_TOKEN 环境变量'], 403);
    }
    $provided = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if ($provided === '' || !hash_equals($token, $provided)) {
        json(['success' => false, 'error' => '管理员令牌无效'], 403);
    }
}

/** 从请求中取合法 id，非法则 400 */
function requireId($input) {
    $id = intval($input['id'] ?? 0);
    if ($id <= 0) {
        json(['success' => false, 'error' => '缺少合法的留言 id'], 400);
    }
    return $id;
}

$action = $_GET['action'] ?? '';

try {
    $db = getDb();

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

        json([
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
            json(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $name = trim($input['name'] ?? '');
        $content = trim($input['content'] ?? '');

        if (charCount($name) < MIN_NAME_LENGTH || charCount($name) > MAX_NAME_LENGTH) {
            json(['success' => false, 'error' => '昵称长度需在 2–20 个字符之间'], 400);
        }
        if ($content === '' || charCount($content) > MAX_CONTENT_LENGTH) {
            json(['success' => false, 'error' => '留言内容不能为空，且不能超过 500 个字符'], 400);
        }

        $ip = getClientIp();
        $wait = checkRateLimit($db, $ip);
        if ($wait > 0) {
            json(['success' => false, 'error' => '操作太频繁，请 ' . $wait . ' 秒后再试'], 429);
        }

        // AI 审核：仅明确判定合规才公开；不合规或服务不可用均待人工复核
        $status = moderateContent($name, $content) === 'approved' ? 'approved' : 'hidden';

        $stmt = $db->prepare("INSERT INTO messages (name, content, ip, status, created_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$name, $content, $ip, $status, time()]);

        json([
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
        requireAdmin();
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

        $stmt = $db->prepare("SELECT id, name, content, status, created_at FROM messages $where ORDER BY created_at DESC LIMIT :limit OFFSET :offset");
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

        json([
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
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }
        $input = readInput();
        $id = requireId($input);
        $status = $input['status'] ?? '';
        if (!in_array($status, STATUS_ALLOWED, true)) {
            json(['success' => false, 'error' => 'status 仅支持 approved 或 hidden'], 400);
        }

        $stmt = $db->prepare('UPDATE messages SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
        if ($stmt->rowCount() === 0) {
            json(['success' => false, 'error' => '留言不存在'], 404);
        }
        json(['success' => true, 'data' => ['id' => $id, 'status' => $status]]);
    }

    // ---- 管理：编辑 ----
    if ($action === 'edit') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }
        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare('SELECT name, content FROM messages WHERE id = ?');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json(['success' => false, 'error' => '留言不存在'], 404);
        }

        $name = array_key_exists('name', $input) ? trim($input['name']) : $existing['name'];
        $content = array_key_exists('content', $input) ? trim($input['content']) : $existing['content'];

        if (charCount($name) < MIN_NAME_LENGTH || charCount($name) > MAX_NAME_LENGTH) {
            json(['success' => false, 'error' => '昵称长度需在 2–20 个字符之间'], 400);
        }
        if ($content === '' || charCount($content) > MAX_CONTENT_LENGTH) {
            json(['success' => false, 'error' => '留言内容不能为空，且不能超过 500 个字符'], 400);
        }

        $stmt = $db->prepare('UPDATE messages SET name = ?, content = ? WHERE id = ?');
        $stmt->execute([$name, $content, $id]);
        json(['success' => true, 'data' => ['id' => $id, 'name' => $name, 'content' => $content]]);
    }

    // ---- 管理：删除 ----
    if ($action === 'delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }
        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare('DELETE FROM messages WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json(['success' => false, 'error' => '留言不存在'], 404);
        }
        json(['success' => true, 'data' => ['id' => $id]]);
    }

    json(['success' => false, 'error' => '未知操作'], 400);
} catch (Throwable $e) {
    error_log('[wall.php] ' . $e->getMessage());
    json(['success' => false, 'error' => '服务器内部错误'], 500);
}
