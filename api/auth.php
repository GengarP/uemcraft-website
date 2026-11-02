<?php
/**
 * auth.php — UEMCraft 用户登录 API（皮肤站 OAuth / OIDC）
 * ------------------------------------------------------
 * 登录仅通过 skin.uemcraft.cn 的 OIDC（Yggdrasil Connect）授权码 + PKCE 进行，
 * 本站不保存任何密码；注册引导跳皮肤站，首次 OAuth 登录自动建档（users 表）。
 *
 * 接口：
 * - GET  ?action=login&return=/x   跳转皮肤站授权（浏览器重定向）
 * - GET  ?action=callback          OAuth 回调（浏览器重定向）
 * - POST ?action=logout            退出登录（销毁本站会话）
 * - GET  ?action=me                当前登录用户（未登录 401）
 */

require_once __DIR__ . '/common.php';

// ---- 皮肤站 OIDC 配置 ----
// 客户端凭证必须先在皮肤站管理端登记 OAuth 应用，再配到环境变量；
// 回调地址需登记为 OAUTH_REDIRECT_URI 的值（默认 https://uemcraft.cn/api/auth.php?action=callback）。
define('OAUTH_CLIENT_ID', getenv('OAUTH_CLIENT_ID') ?: '');
define('OAUTH_CLIENT_SECRET', getenv('OAUTH_CLIENT_SECRET') ?: '');
define('OAUTH_AUTHORIZE_URL', getenv('OAUTH_AUTHORIZE_URL') ?: 'https://skin.uemcraft.cn/oidc/auth');
define('OAUTH_TOKEN_URL', getenv('OAUTH_TOKEN_URL') ?: 'https://skin.uemcraft.cn/oidc/token');
define('OAUTH_USERINFO_URL', getenv('OAUTH_USERINFO_URL') ?: 'https://skin.uemcraft.cn/oidc/userinfo');
define('OAUTH_REDIRECT_URI', getenv('OAUTH_REDIRECT_URI') ?: 'https://uemcraft.cn/api/auth.php?action=callback');
// Yggdrasil.PlayerProfiles.Read 用于获取角色列表（selectedProfile / availableProfiles）；
// 皮肤站未授予该 scope 时优雅降级：不返回角色，档案其余功能不受影响
define('OAUTH_SCOPE', getenv('OAUTH_SCOPE') ?: 'openid profile email Yggdrasil.PlayerProfiles.Read');
// 授权 state 有效期：10 分钟
define('OAUTH_STATE_TTL', 600);

/**
 * 外呼皮肤站（token / userinfo）。
 * 返回 ['status' => int, 'body' => string]；与 parkour.php 同为 curl + stream 双通道，
 * 但 OAuth 涉及凭证交换，必须保持 SSL 证书校验开启。
 * status 仅供日志定位（stream 通道取不到状态码时为 0），成败一律以响应体字段判定。
 */
function oauthHttp($url, $postFields = null, $bearer = '') {
    $headers = ['Accept: application/json'];
    if ($postFields !== null) {
        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
    }
    if ($bearer !== '') {
        $headers[] = 'Authorization: Bearer ' . $bearer;
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 8);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
        if ($postFields !== null) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
        }
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        // 不调用 curl_close()：PHP 8 起句柄随请求自动释放，而它在 PHP 8.5 已弃用，
        // 弃用告警一旦输出就会毁掉后面的 Location 重定向头
        return ['status' => $status, 'body' => is_string($raw) ? $raw : ''];
    }

    $headerLines = '';
    foreach ($headers as $h) {
        $headerLines .= $h . "\r\n";
    }
    $opts = ['http' => [
        'method'        => $postFields === null ? 'GET' : 'POST',
        'header'        => $headerLines,
        'timeout'       => 8,
        // 非 2xx 也取回 body，便于把皮肤站的错误信息记进日志
        'ignore_errors' => true,
    ]];
    if ($postFields !== null) {
        $opts['http']['content'] = $postFields;
    }
    $ctx = stream_context_create($opts);
    $raw = @file_get_contents($url, false, $ctx);
    return ['status' => 0, 'body' => is_string($raw) ? $raw : ''];
}

/**
 * 校验登录后的回跳路径：只允许站内相对路径（防开放重定向）。
 * 非法值一律回退到 /account/。
 */
function safeReturnTo($raw) {
    $raw = trim((string) $raw);
    if ($raw === '' || strlen($raw) > 500) {
        return '/account/';
    }
    if ($raw[0] !== '/' || strpos($raw, '//') === 0 || strpos($raw, '/\\') === 0) {
        return '/account/';
    }
    if (preg_match('/[\r\n\\\\]/', $raw)) {
        return '/account/';
    }
    return $raw;
}

/** 浏览器跳转类失败统一回档案页展示错误（login_error 码由 account.js 转中文提示） */
function oauthFail($code) {
    header('Location: /account/?login_error=' . rawurlencode($code));
    exit;
}

/**
 * 以 OIDC 身份 upsert 用户（按 sub 判定老用户）。
 * 昵称/头像/邮箱/角色每次登录从皮肤站同步（本站不可改）；
 * bio/contact/social_links/is_public/show_contact 属用户档案，不覆盖。
 */
function authUpsertUser($db, $profile) {
    $now = time();
    $stmt = $db->prepare("SELECT * FROM users WHERE sub = ?");
    $stmt->execute([$profile['sub']]);
    $existing = $stmt->fetch();

    $players = $profile['players'];
    $playersJson = json_encode($players, JSON_UNESCAPED_UNICODE);

    // 展示角色：优先本次授权选中的角色 → 原选择仍在列表则保留 → 取第一个
    $playerUuid = $existing ? (string) $existing['player_uuid'] : '';
    $playerName = $existing ? (string) $existing['player_name'] : '';
    $norm = function ($uuid) {
        return strtolower(str_replace('-', '', (string) $uuid));
    };
    $playerIds = [];
    foreach ($players as $p) {
        $playerIds[] = $norm($p['id']);
    }
    if ($profile['selected'] && (empty($players) || in_array($norm($profile['selected']['id']), $playerIds, true))) {
        $playerUuid = $profile['selected']['id'];
        $playerName = $profile['selected']['name'];
    } elseif ($players && !in_array($norm($playerUuid), $playerIds, true)) {
        $playerUuid = $players[0]['id'];
        $playerName = $players[0]['name'];
    }

    if ($existing) {
        // claims 里没给的字段保留原值（scope 未全授予时不误伤）
        $nickname = $profile['nickname'] !== '' ? $profile['nickname'] : (string) $existing['nickname'];
        $avatarUrl = $profile['avatar'] !== '' ? $profile['avatar'] : (string) $existing['avatar_url'];
        $email = $profile['email'] !== '' ? $profile['email'] : (string) $existing['email'];
        // 角色列表为空（未授予 PlayerProfiles.Read）时也不清掉已有数据
        $newPlayersJson = $players ? $playersJson : (string) $existing['players_json'];
        $upd = $db->prepare("UPDATE users SET nickname = ?, avatar_url = ?, email = ?, players_json = ?,
                             player_uuid = ?, player_name = ?, updated_at = ?, last_login_at = ? WHERE id = ?");
        $upd->execute([$nickname, $avatarUrl, $email, $newPlayersJson,
                       $playerUuid, $playerName, $now, $now, (int) $existing['id']]);
        $stmt->execute([$profile['sub']]);
        return $stmt->fetch();
    }

    $ins = $db->prepare("INSERT INTO users (sub, nickname, avatar_url, email, players_json, player_uuid, player_name,
                         bio, contact, social_links, is_public, show_contact, created_at, updated_at, last_login_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '[]', 1, 0, ?, ?, ?)");
    $ins->execute([$profile['sub'], $profile['nickname'], $profile['avatar'], $profile['email'],
                   $playersJson, $playerUuid, $playerName, $now, $now, $now]);
    $stmt->execute([$profile['sub']]);
    return $stmt->fetch();
}

$action = $_GET['action'] ?? '';

try {
    // ---- 登录：跳转皮肤站授权 ----
    if ($action === 'login') {
        if (OAUTH_CLIENT_ID === '' || OAUTH_CLIENT_SECRET === '') {
            json_response(['success' => false, 'error' => '登录功能未启用：请先在皮肤站登记 OAuth 应用并配置 OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET 环境变量'], 503);
        }

        $db = getSiteDb();
        $returnTo = safeReturnTo($_GET['return'] ?? '');

        // state 与 PKCE verifier 一次一密，落库待回调消费；顺手清理过期记录
        $state = bin2hex(random_bytes(32));
        $verifier = bin2hex(random_bytes(32));
        $now = time();
        $db->exec("DELETE FROM oauth_states WHERE expires_at < " . intval($now));
        $ins = $db->prepare("INSERT INTO oauth_states (state, code_verifier, return_to, created_at, expires_at) VALUES (?, ?, ?, ?, ?)");
        $ins->execute([$state, $verifier, $returnTo, $now, $now + OAUTH_STATE_TTL]);

        $authorizeUrl = OAUTH_AUTHORIZE_URL . '?' . http_build_query([
            'response_type'         => 'code',
            'client_id'             => OAUTH_CLIENT_ID,
            'redirect_uri'          => OAUTH_REDIRECT_URI,
            'scope'                 => OAUTH_SCOPE,
            'state'                 => $state,
            'code_challenge'        => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
            'code_challenge_method' => 'S256',
        ], '', '&', PHP_QUERY_RFC3986);

        header('Location: ' . $authorizeUrl);
        exit;
    }

    // ---- 回调：换令牌、取身份、建档、开会话 ----
    if ($action === 'callback') {
        $db = getSiteDb();

        if (!empty($_GET['error'])) {
            // 用户在皮肤站取消授权或其他授权错误
            error_log('[auth.php] OAuth 授权错误: ' . $_GET['error']);
            oauthFail('denied');
        }

        $state = trim($_GET['state'] ?? '');
        $code = trim($_GET['code'] ?? '');
        if ($state === '' || $code === '') {
            oauthFail('state');
        }

        // state 一次性消费：查到即删，过期或重复使用一律拒绝
        $now = time();
        $stmt = $db->prepare("SELECT * FROM oauth_states WHERE state = ?");
        $stmt->execute([$state]);
        $pending = $stmt->fetch();
        $del = $db->prepare("DELETE FROM oauth_states WHERE id = ?");
        if (!$pending || (int) $pending['expires_at'] <= $now) {
            if ($pending) {
                $del->execute([(int) $pending['id']]);
            }
            oauthFail('state');
        }
        $del->execute([(int) $pending['id']]);
        $returnTo = safeReturnTo($pending['return_to']);

        // code 换 token（client_secret_post + PKCE verifier）
        $resp = oauthHttp(OAUTH_TOKEN_URL, http_build_query([
            'grant_type'    => 'authorization_code',
            'code'          => $code,
            'redirect_uri'  => OAUTH_REDIRECT_URI,
            'client_id'     => OAUTH_CLIENT_ID,
            'client_secret' => OAUTH_CLIENT_SECRET,
            'code_verifier' => $pending['code_verifier'],
        ], '', '&', PHP_QUERY_RFC3986));
        $token = json_decode($resp['body'], true);
        if (!is_array($token) || empty($token['access_token'])) {
            error_log('[auth.php] 令牌交换失败 HTTP ' . $resp['status'] . ': ' . substr($resp['body'], 0, 500));
            oauthFail('exchange');
        }

        // 取用户身份
        $resp = oauthHttp(OAUTH_USERINFO_URL, null, (string) $token['access_token']);
        $info = json_decode($resp['body'], true);
        if (!is_array($info) || empty($info['sub'])) {
            error_log('[auth.php] 获取用户信息失败 HTTP ' . $resp['status'] . ': ' . substr($resp['body'], 0, 500));
            oauthFail('userinfo');
        }

        // 归一化角色列表（claims 形如 {id, name}；缺失或不合规的条目直接丢弃）
        $players = [];
        foreach ((array) ($info['availableProfiles'] ?? []) as $p) {
            if (is_array($p) && !empty($p['id']) && !empty($p['name'])) {
                $players[] = ['id' => strtolower(str_replace('-', '', (string) $p['id'])), 'name' => (string) $p['name']];
            }
        }
        $selected = null;
        if (!empty($info['selectedProfile']['id']) && !empty($info['selectedProfile']['name'])) {
            $selected = [
                'id'   => strtolower(str_replace('-', '', (string) $info['selectedProfile']['id'])),
                'name' => (string) $info['selectedProfile']['name'],
            ];
        }

        $user = authUpsertUser($db, [
            'sub'      => (string) $info['sub'],
            'nickname' => (string) ($info['nickname'] ?? ''),
            'avatar'   => (string) ($info['picture'] ?? ''),
            'email'    => (string) ($info['email'] ?? ''),
            'players'  => $players,
            'selected' => $selected,
        ]);

        $sessionToken = createUserSession($db, (int) $user['id']);
        setSessionCookie($sessionToken, time() + authSessionTtl());

        header('Location: ' . $returnTo);
        exit;
    }

    // ---- 登出：销毁本站会话（皮肤站无 end_session 端点，仅本地登出） ----
    if ($action === 'logout') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST'], 405);
        }
        $db = getSiteDb();
        destroyUserSession($db);
        json_response(['success' => true, 'data' => ['logged_out' => true]]);
    }

    // ---- 当前登录用户 ----
    if ($action === 'me') {
        $db = getSiteDb();
        $user = requireUser($db);
        json_response(['success' => true, 'data' => userView($user)]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);
} catch (Throwable $e) {
    error_log('[auth.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
