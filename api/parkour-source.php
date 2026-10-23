<?php
/**
 * parkour-source.php — 读取上传的 SQLite 跑酷数据库
 */

function parkourSourceRows($path, $sql) {
    if (!is_file($path) || !is_readable($path)) {
        return null;
    }

    if (extension_loaded('pdo_sqlite')) {
        try {
            $db = new PDO('sqlite:' . $path);
            $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            $stmt = $db->query($sql);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
        }
    }

    if (extension_loaded('sqlite3')) {
        try {
            $db = new SQLite3($path, SQLITE3_OPEN_READONLY);
            $res = $db->query($sql);
            if ($res === false) {
                $db->close();
                return null;
            }
            $rows = [];
            while (($row = $res->fetchArray(SQLITE3_ASSOC)) !== false) {
                $rows[] = $row;
            }
            $db->close();
            return $rows;
        } catch (Throwable $e) {
        }
    }

    $cmd = 'sqlite3 -json ' . escapeshellarg($path) . ' ' . escapeshellarg($sql) . ' 2>&1';
    $out = shell_exec($cmd);
    if (!is_string($out)) {
        return null;
    }
    $out = trim($out);
    if ($out === '') {
        return [];
    }
    $json = json_decode($out, true);
    if (!is_array($json)) {
        return null;
    }
    return $json;
}

function parkourSourceTables($path) {
    $rows = parkourSourceRows($path, "SELECT name FROM sqlite_master WHERE type='table'");
    if (!is_array($rows)) {
        return null;
    }
    return array_map(function ($r) {
        return (string) $r['name'];
    }, $rows);
}

function parkourSourceColumns($path, $table) {
    $rows = parkourSourceRows($path, "PRAGMA table_info($table)");
    if (!is_array($rows)) {
        return [];
    }
    $cols = [];
    foreach ($rows as $row) {
        $cols[] = (string) $row['name'];
    }
    return $cols;
}

function parkourToTimestamp($value) {
    if ($value === null) {
        return time();
    }
    if (is_numeric($value)) {
        $n = (int) $value;
        if ($n > 1000000000) {
            return $n;
        }
        if ($n > 0 && $n <= 3155760000) {
            // 兼容秒/毫秒时间戳
            return $n > 1000000000 ? $n : $n;
        }
    }
    $ts = strtotime((string) $value);
    return $ts !== false ? $ts : time();
}

function parkourValidateSource($path) {
    $tables = parkourSourceTables($path);
    if (!is_array($tables) || !in_array('course', $tables, true) || !in_array('time', $tables, true)) {
        json_response(['success' => false, 'error' => '数据库中缺少 course 或 time 表'], 400);
    }

    $courseCols = parkourSourceColumns($path, 'course');
    $timeCols = parkourSourceColumns($path, 'time');

    foreach (['courseId', 'name'] as $col) {
        if (!in_array($col, $courseCols, true)) {
            json_response(['success' => false, 'error' => "course 表缺少字段：$col"], 400);
        }
    }
    foreach (['courseId', 'playerId', 'time', 'deaths', 'achieved'] as $col) {
        if (!in_array($col, $timeCols, true)) {
            json_response(['success' => false, 'error' => "time 表缺少字段：$col"], 400);
        }
    }
}

function parkourReadCourses($path) {
    $rows = parkourSourceRows($path, "SELECT courseId, name, created FROM course ORDER BY courseId ASC");
    if (!is_array($rows)) {
        json_response(['success' => false, 'error' => '读取 course 表失败'], 400);
    }

    $result = [];
    foreach ($rows as $course) {
        $cid = (int) $course['courseId'];
        $aggRows = parkourSourceRows($path, "SELECT COUNT(*) AS c, MIN(achieved) AS mn, MAX(achieved) AS mx FROM time WHERE courseId = " . $cid);
        $agg = is_array($aggRows) && isset($aggRows[0]) ? $aggRows[0] : [];

        $result[] = [
            'courseId' => $cid,
            'name' => (string) $course['name'],
            'created' => (int) ($course['created'] ?? 0),
            'recordCount' => (int) ($agg['c'] ?? 0),
            'firstAchieved' => parkourToTimestamp($agg['mn'] ?? null),
            'lastAchieved' => parkourToTimestamp($agg['mx'] ?? null),
        ];
    }
    return $result;
}

function parkourReadCourse($path, $courseId) {
    $rows = parkourSourceRows($path, "SELECT courseId, name, created FROM course WHERE courseId = " . (int) $courseId);
    if (!is_array($rows) || count($rows) === 0) {
        return null;
    }
    return $rows[0];
}

function parkourReadTimeRows($path, $courseId) {
    $rows = parkourSourceRows($path, "SELECT timeId, playerId, time, deaths, achieved FROM time WHERE courseId = " . (int) $courseId . " ORDER BY timeId ASC");
    if (!is_array($rows)) {
        json_response(['success' => false, 'error' => '读取 time 表失败'], 400);
    }
    return $rows;
}
