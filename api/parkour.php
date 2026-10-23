<?php
/**
 * parkour.php — UEMCraft 跑酷排行榜 API
 */

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/parkour-source.php';

date_default_timezone_set('Asia/Shanghai');

const PARKOUR_SKIN_BASE = 'https://skin.uemcraft.cn/';
const PARKOUR_MAX_UPLOAD = 50 * 1024 * 1024;

function parkourNow() {
    return time();
}

function parkourUuidValid($uuid) {
    return is_string($uuid) && preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $uuid);
}

function parkourFormatCloseDate($ts) {
    if ($ts === null) {
        return null;
    }
    return (int) $ts;
}

function parkourResolvePlayer($db, $uuid) {
    if (!parkourUuidValid($uuid)) {
        return ['name' => '未知玩家', 'avatar' => ''];
    }

    $now = parkourNow();
    $stmt = $db->prepare("SELECT player_name, avatar_url, expires_at FROM parkour_player_cache WHERE uuid = ?");
    $stmt->execute([$uuid]);
    $cached = $stmt->fetch();

    if ($cached && (int) $cached['expires_at'] > $now) {
        return [
            'name' => $cached['player_name'],
            'avatar' => $cached['avatar_url'],
        ];
    }

    $name = '';
    $url = PARKOUR_SKIN_BASE . 'api/yggdrasil/sessionserver/session/minecraft/profile/' . rawurlencode($uuid);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
        $raw = curl_exec($ch);
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['timeout' => 3]]);
        $raw = @file_get_contents($url, false, $ctx);
    }

    if (is_string($raw) && $raw !== '') {
        $json = json_decode($raw, true);
        if (is_array($json) && !empty($json['name'])) {
            $name = (string) $json['name'];
        }
    }

    if ($name === '') {
        if ($cached) {
            return [
                'name' => $cached['player_name'],
                'avatar' => $cached['avatar_url'],
            ];
        }
        $name = '玩家 ' . substr($uuid, 0, 8);
    }

    $avatar = PARKOUR_SKIN_BASE . 'avatar/player/' . rawurlencode($name) . '?size=128&png=true';

    $check = $db->prepare("SELECT uuid FROM parkour_player_cache WHERE uuid = ?");
    $check->execute([$uuid]);
    if ($check->fetch()) {
        $upd = $db->prepare("UPDATE parkour_player_cache SET player_name = ?, avatar_url = ?, fetched_at = ?, expires_at = ? WHERE uuid = ?");
        $upd->execute([$name, $avatar, $now, $now + 86400, $uuid]);
    } else {
        $ins = $db->prepare("INSERT INTO parkour_player_cache (uuid, player_name, avatar_url, fetched_at, expires_at) VALUES (?, ?, ?, ?, ?)");
        $ins->execute([$uuid, $name, $avatar, $now, $now + 86400]);
    }

    return ['name' => $name, 'avatar' => $avatar];
}

function parkourVisibleRecords($db, $map) {
    $sql = "SELECT player_uuid, time_ms, deaths, achieved_at, source_time_id
            FROM parkour_records
            WHERE map_id = ?";
    $params = [(int) $map['id']];
    if (!empty($map['close_at'])) {
        $sql .= " AND achieved_at <= ?";
        $params[] = (int) $map['close_at'];
    }
    $sql .= " ORDER BY time_ms ASC, deaths ASC, achieved_at ASC";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function parkourBestPerPlayer($records) {
    $best = [];
    foreach ($records as $r) {
        $uuid = $r['player_uuid'];
        if (!isset($best[$uuid])) {
            $best[$uuid] = $r;
            continue;
        }
        $old = $best[$uuid];
        if ((int) $r['time_ms'] < (int) $old['time_ms'] ||
            ((int) $r['time_ms'] === (int) $old['time_ms'] && (int) $r['deaths'] < (int) $old['deaths']) ||
            ((int) $r['time_ms'] === (int) $old['time_ms'] && (int) $r['deaths'] === (int) $old['deaths'] && (int) $r['achieved_at'] < (int) $old['achieved_at'])) {
            $best[$uuid] = $r;
        }
    }
    $rows = array_values($best);
    usort($rows, function ($a, $b) {
        if ((int) $a['time_ms'] !== (int) $b['time_ms']) {
            return (int) $a['time_ms'] <=> (int) $b['time_ms'];
        }
        if ((int) $a['deaths'] !== (int) $b['deaths']) {
            return (int) $a['deaths'] <=> (int) $b['deaths'];
        }
        return (int) $a['achieved_at'] <=> (int) $b['achieved_at'];
    });
    return $rows;
}

$action = $_GET['action'] ?? '';

try {
    $db = getSiteDb();

    // ---- 公开：地图列表 ----
    if ($action === 'maps') {
        $stmt = $db->query("SELECT * FROM parkour_maps WHERE status = 'published' ORDER BY created_at DESC, id DESC");
        $maps = $stmt->fetchAll();
        $data = [];

        foreach ($maps as $map) {
            $records = parkourVisibleRecords($db, $map);
            $bestRows = parkourBestPerPlayer($records);
            $data[] = [
                'id' => (int) $map['id'],
                'display_name' => $map['display_name'],
                'source_name' => $map['source_name'],
                'close_at' => $map['close_at'] === null ? null : (int) $map['close_at'],
                'record_count' => count($records),
                'player_count' => count($bestRows),
                'best_time_ms' => count($bestRows) ? (int) $bestRows[0]['time_ms'] : null,
            ];
        }

        json_response(['success' => true, 'data' => $data]);
    }

    // ---- 公开：单地图排行榜 ----
    if ($action === 'ranking') {
        $mapId = intval($_GET['map_id'] ?? 0);
        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = min(100, max(1, intval($_GET['limit'] ?? 50)));

        $stmt = $db->prepare("SELECT * FROM parkour_maps WHERE id = ? AND status = 'published'");
        $stmt->execute([$mapId]);
        $map = $stmt->fetch();
        if (!$map) {
            json_response(['success' => false, 'error' => '地图不存在'], 404);
        }

        $rows = parkourBestPerPlayer(parkourVisibleRecords($db, $map));
        $total = count($rows);
        $offset = ($page - 1) * $limit;
        $pageRows = array_slice($rows, $offset, $limit);

        $data = [];
        $rank = $offset + 1;
        foreach ($pageRows as $r) {
            $profile = parkourResolvePlayer($db, $r['player_uuid']);
            $data[] = [
                'rank' => $rank++,
                'player_name' => $profile['name'],
                'avatar_url' => $profile['avatar'],
                'time_ms' => (int) $r['time_ms'],
                'deaths' => (int) $r['deaths'],
                'achieved_at' => (int) $r['achieved_at'],
            ];
            // 内部跳转需要 UUID，但不展示给前端表格；这里放在 data 末尾供链接使用
            $data[count($data) - 1]['player_uuid'] = $r['player_uuid'];
        }

        json_response([
            'success' => true,
            'map' => [
                'id' => (int) $map['id'],
                'display_name' => $map['display_name'],
                'close_at' => $map['close_at'] === null ? null : (int) $map['close_at'],
            ],
            'data' => $data,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'pages' => (int) ceil($total / $limit),
        ]);
    }

    // ---- 公开：玩家详情 ----
    if ($action === 'player') {
        $uuid = trim($_GET['uuid'] ?? '');
        if (!parkourUuidValid($uuid)) {
            json_response(['success' => false, 'error' => '玩家标识无效'], 400);
        }

        $profile = parkourResolvePlayer($db, $uuid);

        $mapsStmt = $db->query("SELECT * FROM parkour_maps WHERE status = 'published' ORDER BY created_at DESC, id DESC");
        $allMaps = $mapsStmt->fetchAll();
        $mapById = [];
        foreach ($allMaps as $m) {
            $mapById[(int) $m['id']] = $m;
        }

        // 玩家在各地图的最好成绩
        $bestByMap = [];
        $recordsByMap = [];
        foreach ($allMaps as $m) {
            $records = parkourVisibleRecords($db, $m);
            $recordsByMap[(int) $m['id']] = $records;
            foreach ($records as $r) {
                if ($r['player_uuid'] !== $uuid) {
                    continue;
                }
                if (!isset($bestByMap[(int) $m['id']]) || parkourBetterRecord($r, $bestByMap[(int) $m['id']])) {
                    $bestByMap[(int) $m['id']] = $r;
                }
            }
        }

        // 计算每张地图的排名
        $mapStats = [];
        $top1 = 0;
        $top3 = 0;
        $top10 = 0;
        $bestRank = null;
        $bestMap = null;

        foreach ($bestByMap as $mid => $r) {
            $allBest = parkourBestPerPlayer($recordsByMap[$mid]);
            $rank = null;
            foreach ($allBest as $i => $br) {
                if ($br['player_uuid'] === $uuid) {
                    $rank = $i + 1;
                    break;
                }
            }
            if ($rank === null) {
                continue;
            }

            if ($bestRank === null || $rank < $bestRank || ($rank === $bestRank && (int) $r['time_ms'] < (int) $bestMap['time_ms'])) {
                $bestRank = $rank;
                $bestMap = [
                    'map_id' => (int) $mid,
                    'display_name' => $mapById[$mid]['display_name'],
                    'time_ms' => (int) $r['time_ms'],
                    'deaths' => (int) $r['deaths'],
                    'achieved_at' => (int) $r['achieved_at'],
                    'rank' => $rank,
                ];
            }

            if ($rank === 1) $top1++;
            if ($rank <= 3) $top3++;
            if ($rank <= 10) $top10++;

            $mapStats[] = [
                'map_id' => (int) $mid,
                'display_name' => $mapById[$mid]['display_name'],
                'best_time_ms' => (int) $r['time_ms'],
                'best_deaths' => (int) $r['deaths'],
                'best_achieved_at' => (int) $r['achieved_at'],
                'rank' => $rank,
                'player_record_count' => count(array_filter($recordsByMap[$mid], function ($x) use ($uuid) {
                    return $x['player_uuid'] === $uuid;
                })),
            ];
        }

        usort($mapStats, function ($a, $b) {
            if ($a['rank'] !== $b['rank']) {
                return $a['rank'] <=> $b['rank'];
            }
            return $a['best_time_ms'] <=> $b['best_time_ms'];
        });

        // 排名趋势：玩家每次提交成绩时，该成绩在当时排行榜中的排名
        $trend = [];
        foreach ($bestByMap as $mid => $ignored) {
            $mapRecords = $recordsByMap[$mid];
            // 只取该玩家的记录
            $playerRecords = array_values(array_filter($mapRecords, function ($r) use ($uuid) {
                return $r['player_uuid'] === $uuid;
            }));
            usort($playerRecords, function ($a, $b) {
                return (int) $a['achieved_at'] <=> (int) $b['achieved_at'];
            });

            foreach ($playerRecords as $rec) {
                $rankAtTime = 1;
                foreach ($mapRecords as $other) {
                    if ((int) $other['achieved_at'] > (int) $rec['achieved_at']) {
                        continue;
                    }
                    if ($other['player_uuid'] === $rec['player_uuid'] && (int) $other['achieved_at'] === (int) $rec['achieved_at'] && (int) $other['time_ms'] === (int) $rec['time_ms'] && (int) $other['deaths'] === (int) $rec['deaths']) {
                        continue;
                    }
                    if ((int) $other['time_ms'] < (int) $rec['time_ms'] ||
                        ((int) $other['time_ms'] === (int) $rec['time_ms'] && (int) $other['deaths'] < (int) $rec['deaths']) ||
                        ((int) $other['time_ms'] === (int) $rec['time_ms'] && (int) $other['deaths'] === (int) $rec['deaths'] && (int) $other['achieved_at'] < (int) $rec['achieved_at'])) {
                        $rankAtTime++;
                    }
                }

                $trend[] = [
                    'map_id' => (int) $mid,
                    'map_name' => $mapById[$mid]['display_name'],
                    'achieved_at' => (int) $rec['achieved_at'],
                    'time_ms' => (int) $rec['time_ms'],
                    'deaths' => (int) $rec['deaths'],
                    'rank_at_time' => $rankAtTime,
                ];
            }
        }

        usort($trend, function ($a, $b) {
            return $a['achieved_at'] <=> $b['achieved_at'];
        });

        json_response([
            'success' => true,
            'player' => [
                'player_name' => $profile['name'],
                'avatar_url' => $profile['avatar'],
            ],
            'summary' => [
                'maps_played' => count($mapStats),
                'best_rank' => $bestRank,
                'top1_count' => $top1,
                'top3_count' => $top3,
                'top10_count' => $top10,
                'best_map' => $bestMap,
            ],
            'maps' => $mapStats,
            'trend' => $trend,
        ]);
    }

    // ---- 管理：上传 db 并解析 course ----
    if ($action === 'upload_db') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        if (empty($_FILES['db']) || $_FILES['db']['error'] !== UPLOAD_ERR_OK) {
            json_response(['success' => false, 'error' => '请上传 .db 文件'], 400);
        }

        if ($_FILES['db']['size'] > PARKOUR_MAX_UPLOAD) {
            json_response(['success' => false, 'error' => '文件过大，最大 50MB'], 400);
        }

        $tmpDir = sys_get_temp_dir();
        $token = bin2hex(random_bytes(16));
        $tmpPath = $tmpDir . '/uemcraft-parkour-' . $token . '.db';

        if (!move_uploaded_file($_FILES['db']['tmp_name'], $tmpPath)) {
            json_response(['success' => false, 'error' => '文件保存失败'], 500);
        }

        parkourValidateSource($tmpPath);
        $courses = parkourReadCourses($tmpPath);

        $stmt = $db->prepare("INSERT INTO parkour_import_uploads (token, original_name, file_path, created_at) VALUES (?, ?, ?, ?)");
        $stmt->execute([$token, $_FILES['db']['name'], $tmpPath, parkourNow()]);

        json_response([
            'success' => true,
            'data' => [
                'upload_token' => $token,
                'original_name' => $_FILES['db']['name'],
                'courses' => $courses,
            ],
        ]);
    }

    // ---- 管理：导入指定 course ----
    if ($action === 'import_course') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $token = trim($input['upload_token'] ?? '');
        $courseId = intval($input['course_id'] ?? 0);
        $displayName = trim($input['display_name'] ?? '');
        $closeDate = trim($input['close_date'] ?? '');

        if ($token === '' || $courseId <= 0) {
            json_response(['success' => false, 'error' => '缺少上传令牌或 courseId'], 400);
        }
        if ($displayName === '' || mb_strlen($displayName, 'UTF-8') > 100) {
            json_response(['success' => false, 'error' => '展示名称长度应为 1–100'], 400);
        }

        $stmt = $db->prepare("SELECT * FROM parkour_import_uploads WHERE token = ?");
        $stmt->execute([$token]);
        $upload = $stmt->fetch();
        if (!$upload) {
            json_response(['success' => false, 'error' => '上传记录不存在或已过期'], 404);
        }

        parkourValidateSource($upload['file_path']);

        $course = parkourReadCourse($upload['file_path'], $courseId);
        if (!$course) {
            json_response(['success' => false, 'error' => '指定 courseId 不存在'], 404);
        }

        $closeAt = null;
        if ($closeDate !== '') {
            $ts = strtotime($closeDate . ' 23:59:59');
            if ($ts === false) {
                json_response(['success' => false, 'error' => '封榜日期格式应为 YYYY-MM-DD'], 400);
            }
            $closeAt = $ts;
        }

        $timeRows = parkourReadTimeRows($upload['file_path'], $courseId);

        $now = parkourNow();
        $sourceFile = (string) $upload['original_name'];

        $db->beginTransaction();
        try {
            $mapStmt = $db->prepare("SELECT id FROM parkour_maps WHERE source_file = ? AND source_course_id = ?");
            $mapStmt->execute([$sourceFile, $courseId]);
            $existingMapId = $mapStmt->fetchColumn();

            if ($existingMapId) {
                $mapId = (int) $existingMapId;
                $upd = $db->prepare("UPDATE parkour_maps SET source_name = ?, display_name = ?, close_at = ?, status = 'published', updated_at = ? WHERE id = ?");
                $upd->execute([(string) $course['name'], $displayName, $closeAt, $now, $mapId]);
                $del = $db->prepare("DELETE FROM parkour_records WHERE map_id = ?");
                $del->execute([$mapId]);
            } else {
                $ins = $db->prepare("INSERT INTO parkour_maps (source_file, source_course_id, source_name, display_name, close_at, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'published', ?, ?)");
                $ins->execute([$sourceFile, $courseId, (string) $course['name'], $displayName, $closeAt, $now, $now]);
                $mapId = (int) $db->lastInsertId();
            }

            $insRec = $db->prepare("INSERT INTO parkour_records (map_id, player_uuid, time_ms, deaths, achieved_at, source_time_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $imported = 0;
            foreach ($timeRows as $tr) {
                $achieved = parkourToTimestamp($tr['achieved'] ?? null);
                $insRec->execute([
                    $mapId,
                    (string) $tr['playerId'],
                    (int) $tr['time'],
                    (int) $tr['deaths'],
                    $achieved,
                    isset($tr['timeId']) ? (int) $tr['timeId'] : null,
                    $now,
                ]);
                $imported++;
            }

            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }

        // 导入成功后删除临时文件
        @unlink($upload['file_path']);
        $delUpload = $db->prepare("DELETE FROM parkour_import_uploads WHERE token = ?");
        $delUpload->execute([$token]);

        json_response([
            'success' => true,
            'data' => [
                'map_id' => $mapId,
                'imported' => $imported,
                'display_name' => $displayName,
            ],
        ]);
    }

    // ---- 管理：地图列表 ----
    if ($action === 'admin_maps') {
        requireAdmin();
        $stmt = $db->query("SELECT * FROM parkour_maps ORDER BY created_at DESC, id DESC");
        $maps = $stmt->fetchAll();
        $data = [];

        foreach ($maps as $map) {
            $cntStmt = $db->prepare("SELECT COUNT(*) AS c FROM parkour_records WHERE map_id = ?");
            $cntStmt->execute([(int) $map['id']]);
            $cnt = (int) $cntStmt->fetchColumn();

            $data[] = [
                'id' => (int) $map['id'],
                'source_file' => $map['source_file'],
                'source_course_id' => (int) $map['source_course_id'],
                'source_name' => $map['source_name'],
                'display_name' => $map['display_name'],
                'close_at' => $map['close_at'] === null ? null : (int) $map['close_at'],
                'status' => $map['status'],
                'record_count' => $cnt,
                'created_at' => (int) $map['created_at'],
                'updated_at' => (int) $map['updated_at'],
            ];
        }

        json_response(['success' => true, 'data' => $data]);
    }

    // ---- 管理：更新地图 ----
    if ($action === 'admin_update') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $stmt = $db->prepare("SELECT * FROM parkour_maps WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['success' => false, 'error' => '地图不存在'], 404);
        }

        $displayName = array_key_exists('display_name', $input) ? trim($input['display_name']) : $existing['display_name'];
        $status = array_key_exists('status', $input) ? trim($input['status']) : $existing['status'];
        $closeAt = $existing['close_at'];

        if (array_key_exists('close_date', $input)) {
            $closeDate = trim($input['close_date']);
            if ($closeDate === '') {
                $closeAt = null;
            } else {
                $ts = strtotime($closeDate . ' 23:59:59');
                if ($ts === false) {
                    json_response(['success' => false, 'error' => '封榜日期格式应为 YYYY-MM-DD'], 400);
                }
                $closeAt = $ts;
            }
        }

        if ($displayName === '' || mb_strlen($displayName, 'UTF-8') > 100) {
            json_response(['success' => false, 'error' => '展示名称长度应为 1–100'], 400);
        }
        if (!in_array($status, ['published', 'draft'], true)) {
            $status = $existing['status'];
        }

        $upd = $db->prepare("UPDATE parkour_maps SET display_name = ?, close_at = ?, status = ?, updated_at = ? WHERE id = ?");
        $upd->execute([$displayName, $closeAt, $status, parkourNow(), $id]);

        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    // ---- 管理：删除地图 ----
    if ($action === 'delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $id = requireId($input);

        $delRec = $db->prepare("DELETE FROM parkour_records WHERE map_id = ?");
        $delRec->execute([$id]);

        $stmt = $db->prepare("DELETE FROM parkour_maps WHERE id = ?");
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            json_response(['success' => false, 'error' => '地图不存在'], 404);
        }

        json_response(['success' => true, 'data' => ['id' => $id]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[parkour.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}

function parkourBetterRecord($a, $b) {
    if ((int) $a['time_ms'] !== (int) $b['time_ms']) {
        return (int) $a['time_ms'] < (int) $b['time_ms'];
    }
    if ((int) $a['deaths'] !== (int) $b['deaths']) {
        return (int) $a['deaths'] < (int) $b['deaths'];
    }
    return (int) $a['achieved_at'] < (int) $b['achieved_at'];
}
