<?php
/**
 * wall.php — UEMCraft 留言墙 API
 * --------------------------------
 * GET  ?action=list&page=1&limit=20
 * POST ?action=post  (name, content)
 *
 * 数据库：默认 SQLite（零配置，库文件 api/wall.db，自动建表）；
 * 切换 MySQL 只需设置环境变量 WALL_DB_DRIVER=mysql，
 * 以及 WALL_DB_HOST / WALL_DB_PORT / WALL_DB_NAME / WALL_DB_USER / WALL_DB_PASS。
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

define('DB_PATH', __DIR__ . '/wall.db');
define('RATE_LIMIT_SECONDS', 60);
define('MAX_CONTENT_LENGTH', 500);
define('MAX_NAME_LENGTH', 20);
define('MIN_NAME_LENGTH', 2);

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
            created_at INT NOT NULL,
            PRIMARY KEY (id),
            KEY idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
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
            created_at INTEGER NOT NULL
        )");
        $db->exec("CREATE INDEX idx_created_at ON messages(created_at DESC)");
    }
    return $db;
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

$action = $_GET['action'] ?? '';

try {
    $db = getDb();

    if ($action === 'list') {
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(50, max(1, intval($_GET['limit'] ?? 20)));
        $offset = ($page - 1) * $limit;

        $totalStmt = $db->query("SELECT COUNT(*) FROM messages");
        $total = (int) $totalStmt->fetchColumn();

        $stmt = $db->prepare("SELECT id, name, content, created_at FROM messages ORDER BY created_at DESC LIMIT :limit OFFSET :offset");
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

    if ($action === 'post') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }

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

        $stmt = $db->prepare("INSERT INTO messages (name, content, ip, created_at) VALUES (?, ?, ?, ?)");
        $stmt->execute([$name, $content, $ip, time()]);

        json([
            'success' => true,
            'data' => [
                'id' => (int) $db->lastInsertId(),
                'name' => $name,
                'content' => $content,
                'created_at' => time()
            ]
        ]);
    }

    json(['success' => false, 'error' => '未知操作'], 400);
} catch (Throwable $e) {
    error_log('[wall.php] ' . $e->getMessage());
    json(['success' => false, 'error' => '服务器内部错误'], 500);
}
