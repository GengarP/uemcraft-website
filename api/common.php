<?php
/**
 * common.php — UEMCraft 公共 API 函数库
 * --------------------------------------
 * 供 wall.php / news.php / events.php / works.php 复用。
 * 包含：PDO 连接、管理员鉴权、JSON 响应、输入读取、通用工具函数。
 */

// ---- CORS 头 ----
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- 通用工具 ----

function json_response($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function readInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }
    return $input ?: [];
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

function requireId($input) {
    $id = intval($input['id'] ?? 0);
    if ($id <= 0) {
        json_response(['success' => false, 'error' => '缺少合法的 id'], 400);
    }
    return $id;
}

function now() {
    return time();
}

// ---- 管理员鉴权 ----

/**
 * 校验管理员令牌。
 * 优先读取 $envName 指定的环境变量；若未设置，回退到 ADMIN_TOKEN。
 * 未配置任何 token 时返回 403（管理功能禁用）。
 */
function requireAdmin($envName = 'ADMIN_TOKEN') {
    $token = getenv($envName) ?: getenv('ADMIN_TOKEN');
    if (!$token) {
        json_response(['success' => false, 'error' => '管理员功能未启用：请设置 ADMIN_TOKEN 环境变量'], 403);
    }
    $provided = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if ($provided === '' || !hash_equals($token, $provided)) {
        json_response(['success' => false, 'error' => '管理员令牌无效'], 403);
    }
}

// ---- 数据库连接 ----

/**
 * 通用 PDO 连接。
 * $driver: 'sqlite' | 'mysql'
 * $dbPath: SQLite 文件路径（如 __DIR__ . '/site.db'）
 * $createTableFn: 建表回调，签名为 function($db)，仅 SQLite 新库时调用
 * $migrateFn: 迁移回调，签名为 function($db)
 * $envPrefix: 环境变量前缀（如 'SITE' → SITE_DB_HOST 等）
 */
function connectDb($driver, $dbPath, $createTableFn, $migrateFn, $envPrefix = 'SITE') {
    if ($driver === 'mysql') {
        $host = getenv("{$envPrefix}_DB_HOST") ?: '127.0.0.1';
        $port = getenv("{$envPrefix}_DB_PORT") ?: '3306';
        $name = getenv("{$envPrefix}_DB_NAME");
        $user = getenv("{$envPrefix}_DB_USER");
        $pass = getenv("{$envPrefix}_DB_PASS") ?: '';

        if (!$name || !$user) {
            throw new Exception("MySQL 配置缺失：请设置 {$envPrefix}_DB_NAME 与 {$envPrefix}_DB_USER 环境变量");
        }

        $db = new PDO("mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4", $user, $pass);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $createTableFn($db, 'mysql');
        $migrateFn($db, 'mysql');
        return $db;
    }

    // 默认 SQLite
    $isNew = !file_exists($dbPath);
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    if ($isNew) {
        $createTableFn($db, 'sqlite');
    }
    $migrateFn($db, 'sqlite');
    return $db;
}

/**
 * 获取 site.db 连接（news + events 共用）
 */
function getSiteDb() {
    $driver = getenv('SITE_DB_DRIVER') ?: 'sqlite';
    $dbPath = __DIR__ . '/site.db';

    return connectDb($driver, $dbPath, 'createSiteTables', 'migrateSiteTables', 'SITE');
}

/**
 * 获取 wall.db 连接（保持兼容）
 */
function getWallDb() {
    $driver = getenv('WALL_DB_DRIVER') ?: 'sqlite';
    $dbPath = __DIR__ . '/wall.db';

    return connectDb($driver, $dbPath, 'createWallTables', 'migrateWallTables', 'WALL');
}

// ---- site.db 建表 ----

function createSiteTables($db, $driver) {
    if ($driver === 'mysql') {
        $db->exec("CREATE TABLE IF NOT EXISTS news (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            excerpt TEXT NOT NULL,
            content MEDIUMTEXT NOT NULL,
            cover VARCHAR(500) NOT NULL DEFAULT '',
            cover_caption VARCHAR(500) NOT NULL DEFAULT '',
            author VARCHAR(100) NOT NULL DEFAULT '',
            tags TEXT NOT NULL,
            date VARCHAR(10) NOT NULL,
            status VARCHAR(16) NOT NULL DEFAULT 'draft',
            created_at INT NOT NULL,
            updated_at INT NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY idx_news_slug (slug),
            KEY idx_news_date (date),
            KEY idx_news_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->exec("CREATE TABLE IF NOT EXISTS events (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            excerpt TEXT NOT NULL,
            content MEDIUMTEXT NOT NULL,
            cover VARCHAR(500) NOT NULL DEFAULT '',
            date_label VARCHAR(100) NOT NULL DEFAULT '',
            date_start VARCHAR(10) NOT NULL DEFAULT '',
            date_end VARCHAR(10) NOT NULL DEFAULT '',
            status VARCHAR(16) NOT NULL DEFAULT 'upcoming',
            link VARCHAR(500) NOT NULL DEFAULT '',
            is_featured TINYINT NOT NULL DEFAULT 0,
            sort_order INT NOT NULL DEFAULT 0,
            created_at INT NOT NULL,
            updated_at INT NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY idx_events_slug (slug),
            KEY idx_events_date (date_start),
            KEY idx_events_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $db->exec("CREATE TABLE IF NOT EXISTS works (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            markdown TEXT NOT NULL,
            cover VARCHAR(500) NOT NULL DEFAULT '',
            image VARCHAR(500) NOT NULL DEFAULT '',
            category VARCHAR(100) NOT NULL DEFAULT '',
            author VARCHAR(100) NOT NULL DEFAULT '',
            gallery_images TEXT NOT NULL,
            download_links TEXT NOT NULL,
            is_featured TINYINT NOT NULL DEFAULT 0,
            sort_order INT NOT NULL DEFAULT 0,
            status VARCHAR(16) NOT NULL DEFAULT 'published',
            created_at INT NOT NULL,
            updated_at INT NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY idx_works_slug (slug),
            KEY idx_works_status (status),
            KEY idx_works_sort (sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        return;

    }

    // SQLite
    $db->exec("CREATE TABLE news (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        title         TEXT NOT NULL,
        slug          TEXT NOT NULL UNIQUE,
        excerpt       TEXT NOT NULL DEFAULT '',
        content       TEXT NOT NULL DEFAULT '',
        cover         TEXT NOT NULL DEFAULT '',
        cover_caption TEXT NOT NULL DEFAULT '',
        author        TEXT NOT NULL DEFAULT '',
        tags          TEXT NOT NULL DEFAULT '[]',
        date          TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'draft',
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
    )");
    $db->exec("CREATE INDEX idx_news_date   ON news(date DESC)");
    $db->exec("CREATE INDEX idx_news_slug   ON news(slug)");
    $db->exec("CREATE INDEX idx_news_status ON news(status)");

    $db->exec("CREATE TABLE events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        title       TEXT NOT NULL,
        slug        TEXT NOT NULL UNIQUE,
        excerpt     TEXT NOT NULL DEFAULT '',
        content     TEXT NOT NULL DEFAULT '',
        cover       TEXT NOT NULL DEFAULT '',
        date_label  TEXT NOT NULL DEFAULT '',
        date_start  TEXT NOT NULL DEFAULT '',
        date_end    TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'upcoming',
        link        TEXT NOT NULL DEFAULT '',
        is_featured INTEGER NOT NULL DEFAULT 0,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
    )");
    $db->exec("CREATE INDEX idx_events_date   ON events(date_start DESC)");
    $db->exec("CREATE INDEX idx_events_slug   ON events(slug)");
    $db->exec("CREATE INDEX idx_events_status ON events(status)");

    $db->exec("CREATE TABLE works (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        title           TEXT NOT NULL,
        slug            TEXT NOT NULL UNIQUE,
        description     TEXT NOT NULL DEFAULT '',
        markdown        TEXT NOT NULL DEFAULT '',
        cover           TEXT NOT NULL DEFAULT '',
        image           TEXT NOT NULL DEFAULT '',
        category        TEXT NOT NULL DEFAULT '',
        author          TEXT NOT NULL DEFAULT '',
        gallery_images  TEXT NOT NULL DEFAULT '[]',
        download_links  TEXT NOT NULL DEFAULT '[]',
        is_featured     INTEGER NOT NULL DEFAULT 0,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        status          TEXT NOT NULL DEFAULT 'published',
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL
    )");
    $db->exec("CREATE INDEX idx_works_slug   ON works(slug)");
    $db->exec("CREATE INDEX idx_works_status ON works(status)");
    $db->exec("CREATE INDEX idx_works_sort   ON works(sort_order)");
}

function migrateSiteTables($db, $driver) {
    // 迁移：新增 works 表
    if ($driver === 'mysql') {
        $db->exec("CREATE TABLE IF NOT EXISTS works (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            markdown TEXT NOT NULL,
            cover VARCHAR(500) NOT NULL DEFAULT '',
            image VARCHAR(500) NOT NULL DEFAULT '',
            category VARCHAR(100) NOT NULL DEFAULT '',
            author VARCHAR(100) NOT NULL DEFAULT '',
            gallery_images TEXT NOT NULL,
            download_links TEXT NOT NULL,
            is_featured TINYINT NOT NULL DEFAULT 0,
            sort_order INT NOT NULL DEFAULT 0,
            status VARCHAR(16) NOT NULL DEFAULT 'published',
            created_at INT NOT NULL,
            updated_at INT NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY idx_works_slug (slug),
            KEY idx_works_status (status),
            KEY idx_works_sort (sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } else {
        try {
            $db->exec("CREATE TABLE works (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                title           TEXT NOT NULL,
                slug            TEXT NOT NULL UNIQUE,
                description     TEXT NOT NULL DEFAULT '',
                markdown        TEXT NOT NULL DEFAULT '',
                cover           TEXT NOT NULL DEFAULT '',
                image           TEXT NOT NULL DEFAULT '',
                category        TEXT NOT NULL DEFAULT '',
                author          TEXT NOT NULL DEFAULT '',
                gallery_images  TEXT NOT NULL DEFAULT '[]',
                download_links  TEXT NOT NULL DEFAULT '[]',
                is_featured     INTEGER NOT NULL DEFAULT 0,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                status          TEXT NOT NULL DEFAULT 'published',
                created_at      INTEGER NOT NULL,
                updated_at      INTEGER NOT NULL
            )");
            $db->exec("CREATE INDEX IF NOT EXISTS idx_works_slug   ON works(slug)");
            $db->exec("CREATE INDEX IF NOT EXISTS idx_works_status ON works(status)");
            $db->exec("CREATE INDEX IF NOT EXISTS idx_works_sort   ON works(sort_order)");
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'already exists') === false) {
                throw $e;
            }
        }
    }

    // 迁移：works 表新增 category 列
    try {
        $test = $db->query("SELECT category FROM works LIMIT 0");
    } catch (PDOException $e) {
        if ($driver === 'mysql') {
            $db->exec("ALTER TABLE works ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT ''");
        } else {
            $db->exec("ALTER TABLE works ADD COLUMN category TEXT NOT NULL DEFAULT ''");
        }
    }

    // 迁移：works 表新增 author 列
    try {
        $test = $db->query("SELECT author FROM works LIMIT 0");
    } catch (PDOException $e) {
        if ($driver === 'mysql') {
            $db->exec("ALTER TABLE works ADD COLUMN author VARCHAR(100) NOT NULL DEFAULT ''");
        } else {
            $db->exec("ALTER TABLE works ADD COLUMN author TEXT NOT NULL DEFAULT ''");
        }
    }

    // 迁移：works 表新增 gallery_images 列（JSON 数组）
    try {
        $test = $db->query("SELECT gallery_images FROM works LIMIT 0");
    } catch (PDOException $e) {
        if ($driver === 'mysql') {
            // MySQL: TEXT 列不能有 DEFAULT，应用层保证写入 '[]'
            $db->exec("ALTER TABLE works ADD COLUMN gallery_images TEXT NOT NULL");
        } else {
            $db->exec("ALTER TABLE works ADD COLUMN gallery_images TEXT NOT NULL DEFAULT '[]'");
        }
    }

    // 迁移：works 表新增 download_links 列（JSON 数组）
    try {
        $test = $db->query("SELECT download_links FROM works LIMIT 0");
    } catch (PDOException $e) {
        if ($driver === 'mysql') {
            $db->exec("ALTER TABLE works ADD COLUMN download_links TEXT NOT NULL");
        } else {
            $db->exec("ALTER TABLE works ADD COLUMN download_links TEXT NOT NULL DEFAULT '[]'");
        }
    }

    // 迁移：works 表新增 markdown 列（详细描述 Markdown）
    try {
        $test = $db->query("SELECT markdown FROM works LIMIT 0");
    } catch (PDOException $e) {
        if ($driver === 'mysql') {
            $db->exec("ALTER TABLE works ADD COLUMN markdown TEXT NOT NULL");
        } else {
            $db->exec("ALTER TABLE works ADD COLUMN markdown TEXT NOT NULL DEFAULT ''");
        }
    }

    // 迁移：新增 servers 表
    if ($driver === 'mysql') {
        $db->exec("CREATE TABLE IF NOT EXISTS servers (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            address VARCHAR(255) NOT NULL,
            port INT NOT NULL DEFAULT 0,
            note VARCHAR(255) NOT NULL DEFAULT '',
            is_featured TINYINT NOT NULL DEFAULT 0,
            sort_order INT NOT NULL DEFAULT 0,
            created_at INT NOT NULL,
            updated_at INT NOT NULL,
            PRIMARY KEY (id),
            KEY idx_servers_sort (sort_order)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } else {
        // SQLite — 使用 try/catch 兼容 "table already exists" 错误
        try {
            $db->exec("CREATE TABLE servers (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                address     TEXT NOT NULL,
                port        INTEGER NOT NULL DEFAULT 0,
                note        TEXT NOT NULL DEFAULT '',
                is_featured INTEGER NOT NULL DEFAULT 0,
                sort_order  INTEGER NOT NULL DEFAULT 0,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
            )");
            $db->exec("CREATE INDEX IF NOT EXISTS idx_servers_sort ON servers(sort_order)");
        } catch (PDOException $e) {
            // 表已存在则忽略
            if (strpos($e->getMessage(), 'already exists') === false) {
                throw $e;
            }
        }
    }

    // 迁移：servers 表新增 port 列（已有表兼容）
    try {
        $test = $db->query("SELECT port FROM servers LIMIT 0");
    } catch (PDOException $e) {
        if ($driver === 'mysql') {
            $db->exec("ALTER TABLE servers ADD COLUMN port INT NOT NULL DEFAULT 0");
        } else {
            $db->exec("ALTER TABLE servers ADD COLUMN port INTEGER NOT NULL DEFAULT 0");
        }
    }

    // 迁移：servers 表新增 edition 列（已有表兼容）
    try {
        $test = $db->query("SELECT edition FROM servers LIMIT 0");
    } catch (PDOException $e) {
        if ($driver === 'mysql') {
            $db->exec("ALTER TABLE servers ADD COLUMN edition VARCHAR(10) NOT NULL DEFAULT 'java'");
        } else {
            $db->exec("ALTER TABLE servers ADD COLUMN edition TEXT NOT NULL DEFAULT 'java'");
        }
    }
    return;
}

// ---- wall.db 建表（保持兼容） ----

function createWallTables($db, $driver) {
    if ($driver === 'mysql') {
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
        return;
    }

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

function migrateWallTables($db, $driver) {
    if ($driver === 'mysql') {
        $stmt = $db->prepare(
            "SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'status'"
        );
        $stmt->execute();
        if ((int)$stmt->fetchColumn() === 0) {
            $db->exec("ALTER TABLE messages ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'approved'");
        }
        return;
    }

    // SQLite
    $cols = $db->query('PRAGMA table_info(messages)')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cols as $col) {
        if ($col['name'] === 'status') return;
    }
    $db->exec("ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'");
}

// ---- 分页辅助 ----

function paginate($db, $countSql, $dataSql, $params = [], $page = 1, $limit = 20) {
    $page  = max(1, intval($page));
    $limit = min(100, max(1, intval($limit)));
    $offset = ($page - 1) * $limit;

    $totalStmt = $db->prepare($countSql);
    $totalStmt->execute($params);
    $total = (int) $totalStmt->fetchColumn();

    $stmt = $db->prepare($dataSql . " LIMIT :limit OFFSET :offset");
    foreach ($params as $k => $v) {
        $stmt->bindValue($k, $v);
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    return [
        'data'  => $rows,
        'page'  => $page,
        'limit' => $limit,
        'total' => $total,
        'pages' => (int) ceil(($total ?: 1) / $limit),
    ];
}
