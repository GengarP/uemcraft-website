<?php
/**
 * user.php — UEMCraft 用户档案 API
 * --------------------------------
 * 档案字段中昵称/头像/邮箱由皮肤站 OAuth 同步、本站不可改；
 * 本接口只管理用户自填部分：简介、联系方式、社交链接、展示角色、公开开关。
 *
 * 接口：
 * - GET  ?action=profile         本人完整档案（需登录）
 * - POST ?action=update_profile  更新档案（需登录，仅 JSON 请求）
 * - GET  ?action=public&id=N     公开主页数据（访客可读，字段白名单）
 */

require_once __DIR__ . '/common.php';

define('USER_BIO_MAX', 200);
define('USER_CONTACT_MAX', 100);
define('USER_SOCIAL_MAX', 6);
define('USER_SOCIAL_LABEL_MAX', 20);
define('USER_SOCIAL_URL_MAX', 200);

/** 个人简介：≤ 200 字 */
function validateBio($raw) {
    $bio = trim((string) $raw);
    if (charCount($bio) > USER_BIO_MAX) {
        json_response(['success' => false, 'error' => '个人简介长度应为 0–' . USER_BIO_MAX . ' 字'], 400);
    }
    return $bio;
}

/** 联系方式：≤ 100 字 */
function validateContact($raw) {
    $contact = trim((string) $raw);
    if (charCount($contact) > USER_CONTACT_MAX) {
        json_response(['success' => false, 'error' => '联系方式长度应为 0–' . USER_CONTACT_MAX . ' 字'], 400);
    }
    return $contact;
}

/**
 * 社交链接：JSON 数组 ≤ 6 条，每条 {label, url}；
 * label ≤ 20 字且非空，url ≤ 200 且必须 http(s) 开头。
 */
function validateSocialLinks($raw) {
    if (!is_array($raw) || count($raw) > USER_SOCIAL_MAX) {
        json_response(['success' => false, 'error' => '社交链接应为不超过 ' . USER_SOCIAL_MAX . ' 条的列表'], 400);
    }
    $links = [];
    foreach ($raw as $item) {
        if (!is_array($item)) {
            json_response(['success' => false, 'error' => '社交链接格式不正确'], 400);
        }
        $label = trim((string) ($item['label'] ?? ''));
        $url = trim((string) ($item['url'] ?? ''));
        if ($label === '' || charCount($label) > USER_SOCIAL_LABEL_MAX) {
            json_response(['success' => false, 'error' => '社交链接名称长度应为 1–' . USER_SOCIAL_LABEL_MAX . ' 字'], 400);
        }
        if ($url === '' || charCount($url) > USER_SOCIAL_URL_MAX ||
            (strpos($url, 'http://') !== 0 && strpos($url, 'https://') !== 0)) {
            json_response(['success' => false, 'error' => '社交链接地址应以 http:// 或 https:// 开头，长度不超过 ' . USER_SOCIAL_URL_MAX . ' 字'], 400);
        }
        $links[] = ['label' => $label, 'url' => $url];
    }
    return $links;
}

/** 开关字段：0/1 */
function validateFlag($raw, $label) {
    $v = intval($raw);
    if ($v !== 0 && $v !== 1) {
        json_response(['success' => false, 'error' => $label . '取值应为 0 或 1'], 400);
    }
    return $v;
}

/** UUID 归一化便于比对（带不带横线、大小写均视为同一角色） */
function normUuid($uuid) {
    return strtolower(str_replace('-', '', (string) $uuid));
}

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 本人完整档案 ----
    if ($action === 'profile') {
        $user = requireUser($db);
        json_response(['success' => true, 'data' => userView($user)]);
    }

    // ---- 更新档案 ----
    if ($action === 'update_profile') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST'], 405);
        }
        // 只接受 JSON 请求体：配合会话 cookie 的 SameSite=Lax，挡住跨站表单 CSRF
        if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
            json_response(['success' => false, 'error' => '请以 application/json 格式提交'], 400);
        }
        $user = requireUser($db);
        // 显式解析 JSON：非法请求体直接 400，不能按"未提交任何字段"静默通过
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            json_response(['success' => false, 'error' => '请求体不是合法的 JSON'], 400);
        }

        // 部分更新：未提交的字段保留原值（与 news.php 的 update 风格一致）
        $bio = array_key_exists('bio', $input) ? validateBio($input['bio']) : (string) $user['bio'];
        $contact = array_key_exists('contact', $input) ? validateContact($input['contact']) : (string) $user['contact'];
        $socialJson = array_key_exists('social_links', $input)
            ? json_encode(validateSocialLinks($input['social_links']), JSON_UNESCAPED_UNICODE)
            : (string) $user['social_links'];
        $isPublic = array_key_exists('is_public', $input) ? validateFlag($input['is_public'], '是否公开主页') : (int) $user['is_public'];
        $showContact = array_key_exists('show_contact', $input) ? validateFlag($input['show_contact'], '是否公开联系方式') : (int) $user['show_contact'];

        $playerUuid = (string) $user['player_uuid'];
        $playerName = (string) $user['player_name'];
        if (array_key_exists('player_uuid', $input)) {
            $want = trim((string) $input['player_uuid']);
            if ($want === '') {
                // 清空展示角色
                $playerUuid = '';
                $playerName = '';
            } else {
                // 只允许从本人角色列表（皮肤站 availableProfiles）中选
                $players = json_decode($user['players_json'] ?: '[]', true);
                $matched = null;
                foreach ((array) $players as $p) {
                    if (is_array($p) && normUuid($p['id'] ?? '') === normUuid($want)) {
                        $matched = $p;
                        break;
                    }
                }
                if (!$matched) {
                    json_response(['success' => false, 'error' => '展示角色必须从你的角色列表中选择'], 400);
                }
                $playerUuid = (string) $matched['id'];
                $playerName = (string) $matched['name'];
            }
        }

        $now = now();
        $upd = $db->prepare("UPDATE users SET bio = ?, contact = ?, social_links = ?, player_uuid = ?, player_name = ?,
                             is_public = ?, show_contact = ?, updated_at = ? WHERE id = ?");
        $upd->execute([$bio, $contact, $socialJson, $playerUuid, $playerName,
                       $isPublic, $showContact, $now, (int) $user['id']]);

        $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([(int) $user['id']]);
        json_response(['success' => true, 'data' => userView($stmt->fetch())]);
    }

    // ---- 公开主页数据（字段白名单，访客可读） ----
    if ($action === 'public') {
        $id = intval($_GET['id'] ?? 0);
        if ($id <= 0) {
            json_response(['success' => false, 'error' => '缺少合法的 id'], 400);
        }
        $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        // 不存在与未公开返回同一提示，不泄露账号是否存在
        if (!$user || (int) $user['is_public'] !== 1) {
            json_response(['success' => false, 'error' => '该用户不存在或未公开档案'], 404);
        }

        $social = json_decode($user['social_links'] ?: '[]', true);
        $data = [
            'id'          => (int) $user['id'],
            'nickname'    => (string) $user['nickname'],
            'avatar'      => userDisplayAvatar($user),
            'player_uuid' => (string) $user['player_uuid'],
            'player_name' => (string) $user['player_name'],
            'bio'         => (string) $user['bio'],
            'social_links' => is_array($social) ? $social : [],
            'created_at'  => (int) $user['created_at'],
        ];
        if ((int) $user['show_contact'] === 1) {
            $data['contact'] = (string) $user['contact'];
        }
        json_response(['success' => true, 'data' => $data]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);
} catch (Throwable $e) {
    error_log('[user.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
