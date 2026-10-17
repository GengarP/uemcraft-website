<?php
/**
 * pcl.php — UEMCraft PCL2 主页卡片设计器 API
 * --------------------------------------------
 * 全部为管理接口（需 X-Admin-Token 请求头）：
 *   GET  ?action=card_list                 卡片列表
 *   GET  ?action=card_detail&id=xxx        卡片详情
 *   POST ?action=card_create               新建卡片
 *   POST ?action=card_update               更新卡片
 *   POST ?action=card_delete               删除卡片
 *   GET  ?action=var_list                  变量列表
 *   POST ?action=var_create                新建变量
 *   POST ?action=var_update                更新变量
 *   POST ?action=var_delete                删除变量
 *
 * homepage/index.php 服务端直读 DB，不需要公开接口。
 */

require_once __DIR__ . '/common.php';

$action = $_GET['action'] ?? '';

/** 行类型白名单 */
const PCL_ROW_TYPES = ['list_item', 'text', 'hint', 'status_dot'];

/** 按钮 EventType 白名单（PCL2 CustomEvent.EventType 全集） */
const PCL_EVENT_TYPES = [
    'None', '打开网页', '打开文件', '打开帮助', '执行命令', '启动游戏', '复制文本',
    '刷新主页', '刷新页面', '刷新帮助', '今日人品', '内存优化', '清理垃圾',
    '弹出窗口', '弹出提示', '切换页面', '导入整合包', '安装整合包', '下载文件',
    '修改设置', '写入设置', '修改变量', '写入变量', '加入房间', '检查更新',
];

/** 按钮 ColorType 白名单 */
const PCL_COLOR_TYPES = ['Normal', 'Highlight', 'Red'];

/**
 * 校验并规范化 rows_json：必须是 JSON 数组，每行 type 合法。
 * 返回规范化后的 JSON 字符串；非法时 json_response 报错退出。
 */
function validateRowsJson($raw) {
    $rows = json_decode((string)$raw, true);
    if (!is_array($rows)) {
        json_response(['success' => false, 'error' => '内容行不是合法的 JSON 数组'], 400);
    }
    foreach ($rows as $row) {
        if (!is_array($row) || !isset($row['type']) || !in_array($row['type'], PCL_ROW_TYPES, true)) {
            json_response(['success' => false, 'error' => '存在非法的内容行类型'], 400);
        }
        if ($row['type'] === 'hint' && isset($row['theme']) && !in_array($row['theme'], ['Blue', 'Red', 'Yellow', 'Green'], true)) {
            json_response(['success' => false, 'error' => '提示行主题必须是 Blue/Red/Yellow/Green'], 400);
        }
    }
    return json_encode(array_values($rows), JSON_UNESCAPED_UNICODE);
}

/**
 * 校验并规范化 buttons_json：必须是 JSON 数组，每项 event_type / color_type 合法。
 */
function validateButtonsJson($raw) {
    $buttons = json_decode((string)$raw, true);
    if (!is_array($buttons)) {
        json_response(['success' => false, 'error' => '按钮不是合法的 JSON 数组'], 400);
    }
    foreach ($buttons as $btn) {
        if (!is_array($btn)) {
            json_response(['success' => false, 'error' => '存在非法的按钮项'], 400);
        }
        $et = $btn['event_type'] ?? 'None';
        if (!in_array($et, PCL_EVENT_TYPES, true)) {
            json_response(['success' => false, 'error' => '存在非法的事件类型：' . $et], 400);
        }
        $ct = $btn['color_type'] ?? 'Normal';
        if (!in_array($ct, PCL_COLOR_TYPES, true)) {
            json_response(['success' => false, 'error' => '存在非法的按钮颜色：' . $ct], 400);
        }
    }
    return json_encode(array_values($buttons), JSON_UNESCAPED_UNICODE);
}

/** 卡片行规范化为 int 字段 */
function normalizeCardRow($row) {
    $row['id'] = (int)$row['id'];
    $row['enabled'] = (int)$row['enabled'];
    $row['sort_order'] = (int)$row['sort_order'];
    $row['created_at'] = (int)$row['created_at'];
    $row['updated_at'] = (int)$row['updated_at'];
    return $row;
}

try {
    $db = getSiteDb();

    // ---- 卡片列表 ----
    if ($action === 'card_list') {
        requireAdmin();
        $rows = $db->query("SELECT * FROM pcl_cards ORDER BY sort_order ASC, id ASC")->fetchAll();
        foreach ($rows as &$row) {
            $row = normalizeCardRow($row);
        }
        unset($row);
        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 卡片详情 ----
    if ($action === 'card_detail') {
        requireAdmin();
        $id = requireId($_GET);
        $stmt = $db->prepare("SELECT * FROM pcl_cards WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            json_response(['success' => false, 'error' => '卡片不存在'], 404);
        }
        json_response(['success' => true, 'data' => normalizeCardRow($row)]);
    }

    // ---- 新建卡片 ----
    if ($action === 'card_create') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请用 POST 提交'], 405);
        }
        $input = readInput();
        $name = trim((string)($input['name'] ?? ''));
        if ($name === '' || charCount($name) > 100) {
            json_response(['success' => false, 'error' => '内部名称必填且不超过 100 字符'], 400);
        }
        $kind = $input['kind'] ?? 'server';
        if (!in_array($kind, ['server', 'standalone'], true)) {
            json_response(['success' => false, 'error' => '卡片类型必须是 server 或 standalone'], 400);
        }
        $title = (string)($input['title'] ?? '');
        if (charCount($title) > 255) {
            json_response(['success' => false, 'error' => '标题模板不超过 255 字符'], 400);
        }
        $rowsJson = validateRowsJson($input['rows_json'] ?? '[]');
        $buttonsJson = validateButtonsJson($input['buttons_json'] ?? '[]');
        $enabled = intval($input['enabled'] ?? 1) ? 1 : 0;
        $sortOrder = intval($input['sort_order'] ?? 0);
        $ts = now();

        $stmt = $db->prepare("INSERT INTO pcl_cards (name, kind, title, rows_json, buttons_json, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$name, $kind, $title, $rowsJson, $buttonsJson, $enabled, $sortOrder, $ts, $ts]);

        json_response(['success' => true, 'data' => ['id' => (int)$db->lastInsertId()]]);
    }

    // ---- 更新卡片 ----
    if ($action === 'card_update') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请用 POST 提交'], 405);
        }
        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("SELECT * FROM pcl_cards WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            json_response(['success' => false, 'error' => '卡片不存在'], 404);
        }

        $name = trim((string)($input['name'] ?? ''));
        if ($name === '' || charCount($name) > 100) {
            json_response(['success' => false, 'error' => '内部名称必填且不超过 100 字符'], 400);
        }
        $kind = $input['kind'] ?? 'server';
        if (!in_array($kind, ['server', 'standalone'], true)) {
            json_response(['success' => false, 'error' => '卡片类型必须是 server 或 standalone'], 400);
        }
        $title = (string)($input['title'] ?? '');
        if (charCount($title) > 255) {
            json_response(['success' => false, 'error' => '标题模板不超过 255 字符'], 400);
        }
        $rowsJson = validateRowsJson($input['rows_json'] ?? '[]');
        $buttonsJson = validateButtonsJson($input['buttons_json'] ?? '[]');
        $enabled = intval($input['enabled'] ?? 1) ? 1 : 0;
        $sortOrder = intval($input['sort_order'] ?? 0);

        $stmt = $db->prepare("UPDATE pcl_cards SET name = ?, kind = ?, title = ?, rows_json = ?, buttons_json = ?, enabled = ?, sort_order = ?, updated_at = ? WHERE id = ?");
        $stmt->execute([$name, $kind, $title, $rowsJson, $buttonsJson, $enabled, $sortOrder, now(), $id]);

        json_response(['success' => true]);
    }

    // ---- 删除卡片 ----
    if ($action === 'card_delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请用 POST 提交'], 405);
        }
        $id = requireId(readInput());
        $stmt = $db->prepare("DELETE FROM pcl_cards WHERE id = ?");
        $stmt->execute([$id]);
        json_response(['success' => true]);
    }

    // ---- 变量列表 ----
    if ($action === 'var_list') {
        requireAdmin();
        $rows = $db->query("SELECT * FROM pcl_vars ORDER BY sort_order ASC, id ASC")->fetchAll();
        foreach ($rows as &$row) {
            $row['id'] = (int)$row['id'];
            $row['sort_order'] = (int)$row['sort_order'];
            $row['created_at'] = (int)$row['created_at'];
            $row['updated_at'] = (int)$row['updated_at'];
        }
        unset($row);
        json_response(['success' => true, 'data' => $rows]);
    }

    // ---- 新建变量 ----
    if ($action === 'var_create') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请用 POST 提交'], 405);
        }
        $input = readInput();
        [$varKey, $varLabel, $varValue, $sortOrder] = validateVarInput($input);

        $stmt = $db->prepare("SELECT COUNT(*) FROM pcl_vars WHERE var_key = ?");
        $stmt->execute([$varKey]);
        if ((int)$stmt->fetchColumn() > 0) {
            json_response(['success' => false, 'error' => '键名已存在：' . $varKey], 400);
        }

        $ts = now();
        $stmt = $db->prepare("INSERT INTO pcl_vars (var_key, var_label, var_value, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$varKey, $varLabel, $varValue, $sortOrder, $ts, $ts]);

        json_response(['success' => true, 'data' => ['id' => (int)$db->lastInsertId()]]);
    }

    // ---- 更新变量 ----
    if ($action === 'var_update') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请用 POST 提交'], 405);
        }
        $input = readInput();
        $id = requireId($input);
        [$varKey, $varLabel, $varValue, $sortOrder] = validateVarInput($input);

        $stmt = $db->prepare("SELECT COUNT(*) FROM pcl_vars WHERE var_key = ? AND id != ?");
        $stmt->execute([$varKey, $id]);
        if ((int)$stmt->fetchColumn() > 0) {
            json_response(['success' => false, 'error' => '键名已存在：' . $varKey], 400);
        }

        $stmt = $db->prepare("UPDATE pcl_vars SET var_key = ?, var_label = ?, var_value = ?, sort_order = ?, updated_at = ? WHERE id = ?");
        $stmt->execute([$varKey, $varLabel, $varValue, $sortOrder, now(), $id]);

        json_response(['success' => true]);
    }

    // ---- 删除变量 ----
    if ($action === 'var_delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请用 POST 提交'], 405);
        }
        $id = requireId(readInput());
        $stmt = $db->prepare("DELETE FROM pcl_vars WHERE id = ?");
        $stmt->execute([$id]);
        json_response(['success' => true]);
    }

    json_response(['success' => false, 'error' => '未知 action'], 400);
} catch (Throwable $e) {
    error_log('pcl.php 错误: ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}

/** 变量输入校验，返回 [var_key, var_label, var_value, sort_order] */
function validateVarInput($input) {
    $varKey = trim((string)($input['var_key'] ?? ''));
    if (!preg_match('/^[a-zA-Z0-9_]{1,64}$/', $varKey)) {
        json_response(['success' => false, 'error' => '键名只能是字母/数字/下划线，1-64 字符'], 400);
    }
    $varLabel = (string)($input['var_label'] ?? '');
    if (charCount($varLabel) > 100) {
        json_response(['success' => false, 'error' => '说明不超过 100 字符'], 400);
    }
    $varValue = (string)($input['var_value'] ?? '');
    if (charCount($varValue) > 500) {
        json_response(['success' => false, 'error' => '值不超过 500 字符'], 400);
    }
    return [$varKey, $varLabel, $varValue, intval($input['sort_order'] ?? 0)];
}
