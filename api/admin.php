<?php
/**
 * admin.php — UEMCraft 后台用户与权限管理 API
 * -------------------------------------------
 * 本文件全部接口仅超级管理员可用（requireSuperAdmin）。
 * 角色：user 普通用户 / admin 管理员 / super_admin 超级管理员（同一时间仅一位）。
 * 管理员的操作权由 users.perms_json 中的模块级权限节点决定。
 *
 * 接口：
 * - GET  ?action=nodes           权限节点列表（key + 中文名）
 * - GET  ?action=users_list      用户列表（角色/权限/最近登录）
 * - POST ?action=set_role        {user_id, role: admin|user}
 * - POST ?action=set_perms       {user_id, nodes: [节点 key...]}
 * - POST ?action=transfer_super  {user_id} 转交超管（原超管降为普通用户）
 */

require_once __DIR__ . '/common.php';

/** 写操作统一要求 POST + JSON 请求体（配合会话 cookie 的 SameSite=Lax 防 CSRF） */
function adminRequirePostJson() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(['success' => false, 'error' => '请使用 POST'], 405);
    }
    if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        json_response(['success' => false, 'error' => '请以 application/json 格式提交'], 400);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        json_response(['success' => false, 'error' => '请求体不是合法的 JSON'], 400);
    }
    return $input;
}

/** 读取目标用户，不存在直接 404 */
function adminFetchTarget($db, $input) {
    $id = intval($input['user_id'] ?? 0);
    if ($id <= 0) {
        json_response(['success' => false, 'error' => '缺少合法的 user_id'], 400);
    }
    $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) {
        json_response(['success' => false, 'error' => '用户不存在'], 404);
    }
    return $user;
}

/** 用户行的管理视图（不返回 sub 等内部标识） */
function adminUserView($user) {
    return [
        'id'            => (int) $user['id'],
        'nickname'      => (string) $user['nickname'],
        'email'         => (string) $user['email'],
        'role'          => (string) ($user['role'] ?? 'user'),
        'perms'         => userPermissions($user),
        'player_name'   => (string) $user['player_name'],
        'created_at'    => (int) $user['created_at'],
        'last_login_at' => (int) $user['last_login_at'],
    ];
}

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 权限节点列表 ----
    if ($action === 'nodes') {
        requireSuperAdmin($db);
        $nodes = [];
        foreach (ADMIN_PERMISSION_NODES as $key => $label) {
            $nodes[] = ['key' => $key, 'label' => $label];
        }
        json_response(['success' => true, 'data' => $nodes]);
    }

    // ---- 用户列表 ----
    if ($action === 'users_list') {
        requireSuperAdmin($db);
        $stmt = $db->query("SELECT * FROM users ORDER BY id ASC");
        $users = [];
        foreach ($stmt->fetchAll() as $row) {
            $users[] = adminUserView($row);
        }
        json_response(['success' => true, 'data' => $users]);
    }

    // ---- 设置角色（仅 admin / user，超管不可通过此接口变更） ----
    if ($action === 'set_role') {
        $admin = requireSuperAdmin($db);
        $input = adminRequirePostJson();
        $target = adminFetchTarget($db, $input);

        $role = (string) ($input['role'] ?? '');
        if ($role !== 'admin' && $role !== 'user') {
            json_response(['success' => false, 'error' => '角色只能是 admin 或 user'], 400);
        }
        if (($target['role'] ?? 'user') === 'super_admin') {
            json_response(['success' => false, 'error' => '不能修改超级管理员的角色，请使用超管转交'], 400);
        }
        if ((int) $target['id'] === (int) $admin['id'] && $role !== 'user') {
            json_response(['success' => false, 'error' => '不能修改自己的角色'], 400);
        }

        $now = now();
        // 降为普通用户时清空权限节点，避免残留授权在重新提升时意外生效
        if ($role === 'user') {
            $upd = $db->prepare("UPDATE users SET role = 'user', perms_json = '[]', updated_at = ? WHERE id = ?");
            $upd->execute([$now, (int) $target['id']]);
        } else {
            $upd = $db->prepare("UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?");
            $upd->execute([$now, (int) $target['id']]);
        }

        $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([(int) $target['id']]);
        json_response(['success' => true, 'data' => adminUserView($stmt->fetch())]);
    }

    // ---- 设置管理员权限节点 ----
    if ($action === 'set_perms') {
        requireSuperAdmin($db);
        $input = adminRequirePostJson();
        $target = adminFetchTarget($db, $input);

        if (($target['role'] ?? 'user') === 'super_admin') {
            json_response(['success' => false, 'error' => '超级管理员默认拥有全部权限，无需分配'], 400);
        }
        if (($target['role'] ?? 'user') !== 'admin') {
            json_response(['success' => false, 'error' => '请先将该用户设为管理员'], 400);
        }
        if (!is_array($input['nodes'] ?? null)) {
            json_response(['success' => false, 'error' => 'nodes 应为节点 key 数组'], 400);
        }
        $nodes = [];
        foreach ($input['nodes'] as $node) {
            if (!is_string($node) || !isset(ADMIN_PERMISSION_NODES[$node])) {
                json_response(['success' => false, 'error' => '存在非法的权限节点'], 400);
            }
            $nodes[] = $node;
        }
        $nodes = array_values(array_unique($nodes));

        $upd = $db->prepare("UPDATE users SET perms_json = ?, updated_at = ? WHERE id = ?");
        $upd->execute([json_encode($nodes, JSON_UNESCAPED_UNICODE), now(), (int) $target['id']]);

        $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([(int) $target['id']]);
        json_response(['success' => true, 'data' => adminUserView($stmt->fetch())]);
    }

    // ---- 超管转交：目标升为超管，自己降为普通用户 ----
    if ($action === 'transfer_super') {
        $admin = requireSuperAdmin($db);
        $input = adminRequirePostJson();
        $target = adminFetchTarget($db, $input);

        if ((int) $target['id'] === (int) $admin['id']) {
            json_response(['success' => false, 'error' => '不能把超级管理员转交给自己'], 400);
        }

        $now = now();
        $db->beginTransaction();
        try {
            // 目标升为超管（超管权限由角色决定，清空 perms 避免残留）
            $upd = $db->prepare("UPDATE users SET role = 'super_admin', perms_json = '[]', updated_at = ? WHERE id = ?");
            $upd->execute([$now, (int) $target['id']]);
            // 原超管降为普通用户
            $upd = $db->prepare("UPDATE users SET role = 'user', perms_json = '[]', updated_at = ? WHERE id = ?");
            $upd->execute([$now, (int) $admin['id']]);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }

        json_response(['success' => true, 'data' => ['transferred_to' => (int) $target['id']]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);
} catch (Throwable $e) {
    error_log('[admin.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
