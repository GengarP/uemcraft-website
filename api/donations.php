<?php
/**
 * donations.php — UEMCraft 捐赠记录 API
 * ------------------------------
 * 公开接口：
 *   GET  ?action=list                             （按月分组的捐赠名单，仅昵称，不含金额）
 *
 * 管理接口（需 X-Admin-Token 请求头，环境变量 ADMIN_TOKEN）：
 *   GET  ?action=admin_list&page=1&limit=20&month=YYYY-MM
 *   GET  ?action=admin_detail&id=xxx
 *   POST ?action=create
 *   POST ?action=update
 *   POST ?action=delete
 *
 * 隐私约定：金额仅在管理接口返回，公开接口列白名单不含金额字段。
 * 存储：amount_fen 整数分；API 输入输出为元（amount）。
 */

require_once __DIR__ . '/common.php';

const DONATIONS_MONTH_RE = '/^\d{4}-(0[1-9]|1[0-2])$/';

/** 元 → 分（整数） */
function amountToFen($yuan) {
    return (int) round(((float) $yuan) * 100);
}

/** 分 → 元（两位小数数字） */
function fenToAmount($fen) {
    return round(((int) $fen) / 100, 2);
}

/** 校验昵称，非法直接 400 */
function validateDonorName($name) {
    $n = charCount($name);
    if ($n < 2 || $n > 50) {
        json_response(['success' => false, 'error' => '昵称长度应为 2–50 个字符'], 400);
    }
}

/** 校验月份，非法直接 400 */
function validateDonationMonth($month) {
    if (!preg_match(DONATIONS_MONTH_RE, $month)) {
        json_response(['success' => false, 'error' => '月份格式应为 YYYY-MM'], 400);
    }
}

/** 校验金额（元），非法直接 400 */
function validateDonationAmount($amount) {
    if (!is_numeric($amount) || $amount < 0 || $amount > 999999.99) {
        json_response(['success' => false, 'error' => '金额应为 0–999999.99 之间的数字'], 400);
    }
}

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 公开：捐赠名单（仅昵称，不含金额） ----
    if ($action === 'list') {
        $stmt = $db->query("SELECT id, donor_name, month FROM donations ORDER BY month DESC, created_at ASC");
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
        }
        unset($row);

        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 管理：捐赠记录详情（用于编辑） ----
    if ($action === 'admin_detail') {
        requireAdmin();

        $id = intval($_GET['id'] ?? 0);
        if ($id <= 0) {
            json_response(['success' => false, 'error' => '缺少 id 参数'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM donations WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();

        if (!$row) {
            json_response(['success' => false, 'error' => '捐赠记录不存在'], 404);
        }

        $row['id'] = (int) $row['id'];
        $row['amount'] = fenToAmount($row['amount_fen']);
        $row['created_at'] = (int) $row['created_at'];
        $row['updated_at'] = (int) $row['updated_at'];

        json_response(['success' => true, 'data' => $row]);
    }

    // ---- 管理：捐赠记录列表（含金额，支持月份过滤） ----
    if ($action === 'admin_list') {
        requireAdmin();

        $page  = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(1, intval($_GET['limit'] ?? 20)));
        $month = trim($_GET['month'] ?? '');

        $where  = '';
        $params = [];
        if ($month !== '' && preg_match(DONATIONS_MONTH_RE, $month)) {
            $where = 'WHERE month = :month';
            $params[':month'] = $month;
        }

        $totalStmt = $db->prepare("SELECT COUNT(*) FROM donations $where");
        $totalStmt->execute($params);
        $total = (int) $totalStmt->fetchColumn();

        $stmt = $db->prepare("SELECT * FROM donations $where ORDER BY month DESC, created_at DESC LIMIT :limit OFFSET :offset");
        foreach ($params as $k => $v) {
            $stmt->bindValue($k, $v);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', ($page - 1) * $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['amount'] = fenToAmount($row['amount_fen']);
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

    // ---- 管理：创建捐赠记录 ----
    if ($action === 'create') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();

        $donor_name = trim($input['donor_name'] ?? '');
        $amount     = $input['amount'] ?? 0;
        $month      = trim($input['month'] ?? '');

        // 校验
        if ($donor_name === '') {
            json_response(['success' => false, 'error' => '昵称不能为空'], 400);
        }
        validateDonorName($donor_name);
        validateDonationMonth($month);
        validateDonationAmount($amount);

        $ts = now();

        $stmt = $db->prepare("INSERT INTO donations (donor_name, amount_fen, month, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$donor_name, amountToFen($amount), $month, $ts, $ts]);

        json_response([
            'success' => true,
            'data' => [
                'id'         => (int) $db->lastInsertId(),
                'donor_name' => $donor_name,
                'amount'     => fenToAmount(amountToFen($amount)),
                'month'      => $month,
            ],
        ]);
    }

    // ---- 管理：更新捐赠记录 ----
    if ($action === 'update') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("SELECT * FROM donations WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '捐赠记录不存在'], 404);
        }

        // 部分更新
        $donor_name = array_key_exists('donor_name', $input) ? trim($input['donor_name']) : $existing['donor_name'];
        $amount     = array_key_exists('amount', $input) ? $input['amount'] : fenToAmount($existing['amount_fen']);
        $month      = array_key_exists('month', $input) ? trim($input['month']) : $existing['month'];

        // 校验
        if ($donor_name === '') {
            json_response(['success' => false, 'error' => '昵称不能为空'], 400);
        }
        validateDonorName($donor_name);
        validateDonationMonth($month);
        validateDonationAmount($amount);

        $stmt = $db->prepare("UPDATE donations SET donor_name=?, amount_fen=?, month=?, updated_at=? WHERE id=?");
        $stmt->execute([$donor_name, amountToFen($amount), $month, now(), $id]);

        json_response([
            'success' => true,
            'data' => [
                'id'         => $id,
                'donor_name' => $donor_name,
                'amount'     => fenToAmount(amountToFen($amount)),
                'month'      => $month,
            ],
        ]);
    }

    // ---- 管理：删除捐赠记录 ----
    if ($action === 'delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("DELETE FROM donations WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json_response(['success' => false, 'error' => '捐赠记录不存在'], 404);
        }

        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[donations.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
