<?php
/**
 * images.php — UEMCraft 图片管理 API
 * ------------------------------------
 * 管理接口（需 X-Admin-Token 请求头）：
 *   GET  ?action=list&folder=news|gallery           （列出指定目录下所有图片）
 *   POST ?action=upload&folder=news|gallery          （上传图片，自动重命名为 yy-mm-dd-title 格式）
 *   POST ?action=delete                              （删除图片，需通过引用检查）
 *   POST ?action=rename                              （重命名图片，需通过引用检查）
 */

require_once __DIR__ . '/common.php';

$ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'];
$MAX_SIZE    = 10 * 1024 * 1024; // 10MB

// 允许的图片子目录
$ALLOWED_FOLDERS = ['news', 'gallery'];
$BASE_IMG_DIR = realpath(__DIR__ . '/../assets/img');

$action = $_GET['action'] ?? '';

/**
 * 获取并验证目标目录
 */
function resolveFolder($folder) {
    global $ALLOWED_FOLDERS, $BASE_IMG_DIR;

    if (!in_array($folder, $ALLOWED_FOLDERS, true)) {
        json_response(['success' => false, 'error' => '无效的目录：' . $folder], 400);
    }

    $dir = $BASE_IMG_DIR . '/' . $folder;
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $real = realpath($dir);
    if (!$real) {
        json_response(['success' => false, 'error' => '图片目录创建失败'], 500);
    }
    return $real;
}

/**
 * 检查图片是否被新闻、活动、作品引用
 * 返回引用列表，空数组表示未被引用
 */
function checkImageReferences($db, $imageUrl) {
    $refs = [];
    $likePattern = '%' . $imageUrl . '%';

    // 检查 news.cover
    $stmt = $db->prepare("SELECT id, title FROM news WHERE cover = ?");
    $stmt->execute([$imageUrl]);
    while ($row = $stmt->fetch()) {
        $refs[] = ['type' => 'news', 'id' => (int)$row['id'], 'title' => $row['title'], 'field' => 'cover'];
    }

    // 检查 news.content（Markdown 可能内嵌图片）
    $stmt = $db->prepare("SELECT id, title FROM news WHERE content LIKE ?");
    $stmt->execute([$likePattern]);
    while ($row = $stmt->fetch()) {
        // 避免重复（cover 已查过）
        $exists = false;
        foreach ($refs as $r) {
            if ($r['type'] === 'news' && $r['id'] == $row['id'] && $r['field'] === 'content') {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            $refs[] = ['type' => 'news', 'id' => (int)$row['id'], 'title' => $row['title'], 'field' => 'content'];
        }
    }

    // 检查 events.cover
    $stmt = $db->prepare("SELECT id, title FROM events WHERE cover = ?");
    $stmt->execute([$imageUrl]);
    while ($row = $stmt->fetch()) {
        $refs[] = ['type' => 'events', 'id' => (int)$row['id'], 'title' => $row['title'], 'field' => 'cover'];
    }

    // 检查 works.cover
    $stmt = $db->prepare("SELECT id, title FROM works WHERE cover = ?");
    $stmt->execute([$imageUrl]);
    while ($row = $stmt->fetch()) {
        $refs[] = ['type' => 'works', 'id' => (int)$row['id'], 'title' => $row['title'], 'field' => 'cover'];
    }

    // 检查 works.image
    $stmt = $db->prepare("SELECT id, title FROM works WHERE image = ?");
    $stmt->execute([$imageUrl]);
    while ($row = $stmt->fetch()) {
        $exists = false;
        foreach ($refs as $r) {
            if ($r['type'] === 'works' && $r['id'] == $row['id']) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            $refs[] = ['type' => 'works', 'id' => (int)$row['id'], 'title' => $row['title'], 'field' => 'image'];
        }
    }

    return $refs;
}

try {
    // ---- 列出图片 ----
    if ($action === 'list') {
        requireAdmin();

        $folder = $_GET['folder'] ?? 'news';
        $IMG_DIR = resolveFolder($folder);

        $files = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($IMG_DIR, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $file) {
            if (!$file->isFile()) continue;
            $ext = strtolower($file->getExtension());
            if (!in_array($ext, $ALLOWED_EXT, true)) continue;

            $relativePath = str_replace('\\', '/', substr($file->getRealPath(), strlen($IMG_DIR) + 1));
            $files[] = [
                'name'   => $relativePath,
                'url'    => '/assets/img/' . $folder . '/' . $relativePath,
                'folder' => $folder,
                'size'   => $file->getSize(),
                'mtime'  => $file->getMTime(),
            ];
        }

        // 按修改时间倒序
        usort($files, function ($a, $b) {
            return $b['mtime'] - $a['mtime'];
        });

        json_response(['success' => true, 'data' => $files]);
    }

    // ---- 上传图片 ----
    if ($action === 'upload') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $folder = $_GET['folder'] ?? 'news';
        $IMG_DIR = resolveFolder($folder);

        if (empty($_FILES['file'])) {
            json_response(['success' => false, 'error' => '未选择文件'], 400);
        }

        $file = $_FILES['file'];

        if ($file['error'] !== UPLOAD_ERR_OK) {
            $errMap = [
                UPLOAD_ERR_INI_SIZE   => '文件超过服务器大小限制',
                UPLOAD_ERR_FORM_SIZE  => '文件超过表单大小限制',
                UPLOAD_ERR_PARTIAL    => '文件仅部分上传',
                UPLOAD_ERR_NO_FILE    => '未选择文件',
                UPLOAD_ERR_NO_TMP_DIR => '服务器临时目录缺失',
                UPLOAD_ERR_CANT_WRITE => '写入磁盘失败',
            ];
            $msg = $errMap[$file['error']] ?? '上传错误 #' . $file['error'];
            json_response(['success' => false, 'error' => $msg], 400);
        }

        if ($file['size'] > $MAX_SIZE) {
            json_response(['success' => false, 'error' => '文件大小超过 10MB 限制'], 400);
        }

        // 验证扩展名
        $origName = $file['name'];
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        if (!in_array($ext, $ALLOWED_EXT, true)) {
            json_response(['success' => false, 'error' => '不支持的文件类型，允许：' . implode(', ', $ALLOWED_EXT)], 400);
        }

        // 验证 MIME
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        $allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif',
            'image/webp', 'image/svg+xml', 'image/x-icon',
        ];
        if (!in_array($mime, $allowedMimes, true)) {
            json_response(['success' => false, 'error' => '文件 MIME 类型不合法：' . $mime], 400);
        }

        // 生成文件名：yy-mm-dd-title
        $title = trim($_POST['title'] ?? '');
        if ($title === '') {
            $title = pathinfo($origName, PATHINFO_FILENAME);
        }
        // 清理标题部分：只保留字母数字中文和连字符
        $baseName = preg_replace('/[^\w\-]/u', '_', $title);
        $baseName = preg_replace('/_+/', '_', $baseName);
        $baseName = trim($baseName, '_');
        if ($baseName === '') $baseName = 'image';

        $datePrefix = date('y-m-d');
        $targetName = $datePrefix . '-' . $baseName . '.' . $ext;
        $targetPath = $IMG_DIR . '/' . $targetName;

        // 文件名冲突：加数字后缀
        $counter = 1;
        while (file_exists($targetPath)) {
            $targetName = $datePrefix . '-' . $baseName . '-' . $counter . '.' . $ext;
            $targetPath = $IMG_DIR . '/' . $targetName;
            $counter++;
        }

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            json_response(['success' => false, 'error' => '保存文件失败'], 500);
        }

        json_response([
            'success' => true,
            'data' => [
                'name'   => $targetName,
                'url'    => '/assets/img/' . $folder . '/' . $targetName,
                'folder' => $folder,
                'size'   => $file['size'],
            ],
        ]);
    }

    // ---- 删除图片 ----
    if ($action === 'delete') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input = readInput();
        $name   = trim($input['name'] ?? '');
        $folder = trim($input['folder'] ?? 'news');

        if ($name === '') {
            json_response(['success' => false, 'error' => '缺少文件名'], 400);
        }

        $IMG_DIR = resolveFolder($folder);
        $filePath = $IMG_DIR . '/' . $name;

        // 安全检查：确保文件在目标目录内
        $realPath = realpath($filePath);
        if (!$realPath || strpos($realPath, $IMG_DIR) !== 0) {
            json_response(['success' => false, 'error' => '文件不存在或路径非法'], 404);
        }

        if (!file_exists($realPath)) {
            json_response(['success' => false, 'error' => '文件不存在'], 404);
        }

        // 引用检查
        $imageUrl = '/assets/img/' . $folder . '/' . $name;
        $db = getSiteDb();
        $refs = checkImageReferences($db, $imageUrl);

        if (!empty($refs)) {
            $typeLabels = ['news' => '新闻', 'events' => '活动', 'works' => '作品'];
            $refDescriptions = [];
            foreach ($refs as $ref) {
                $label = $typeLabels[$ref['type']] ?? $ref['type'];
                $refDescriptions[] = $label . '「' . $ref['title'] . '」的' . $ref['field'] . '字段';
            }
            json_response([
                'success' => false,
                'error'   => '该图片正在被引用，无法删除',
                'refs'    => $refs,
                'message' => '引用来源：' . implode('；', $refDescriptions),
            ], 409);
        }

        // 执行删除
        if (!unlink($realPath)) {
            json_response(['success' => false, 'error' => '删除文件失败'], 500);
        }

        json_response(['success' => true, 'data' => ['name' => $name, 'folder' => $folder]]);
    }

    // ---- 重命名图片 ----
    if ($action === 'rename') {
        requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            json_response(['success' => false, 'error' => '请使用 POST 请求'], 405);
        }

        $input    = readInput();
        $name     = trim($input['name'] ?? '');
        $newName  = trim($input['newName'] ?? '');
        $folder   = trim($input['folder'] ?? 'news');

        if ($name === '' || $newName === '') {
            json_response(['success' => false, 'error' => '缺少文件名或新文件名'], 400);
        }

        // 验证新文件名合法性
        if (preg_match('/[\/\\\\:*?"<>|]/', $newName) || $newName !== basename($newName)) {
            json_response(['success' => false, 'error' => '新文件名包含非法字符'], 400);
        }

        $IMG_DIR = resolveFolder($folder);
        $oldPath = $IMG_DIR . '/' . $name;
        $newPath = $IMG_DIR . '/' . $newName;

        // 安全检查
        $realOldPath = realpath($oldPath);
        if (!$realOldPath || strpos($realOldPath, $IMG_DIR) !== 0) {
            json_response(['success' => false, 'error' => '源文件不存在或路径非法'], 404);
        }

        if (!file_exists($realOldPath)) {
            json_response(['success' => false, 'error' => '源文件不存在'], 404);
        }

        if (file_exists($newPath)) {
            json_response(['success' => false, 'error' => '目标文件名已存在'], 409);
        }

        // 引用检查
        $oldUrl = '/assets/img/' . $folder . '/' . $name;
        $db = getSiteDb();
        $refs = checkImageReferences($db, $oldUrl);

        if (!empty($refs)) {
            $typeLabels = ['news' => '新闻', 'events' => '活动', 'works' => '作品'];
            $refDescriptions = [];
            foreach ($refs as $ref) {
                $label = $typeLabels[$ref['type']] ?? $ref['type'];
                $refDescriptions[] = $label . '「' . $ref['title'] . '」的' . $ref['field'] . '字段';
            }
            json_response([
                'success' => false,
                'error'   => '该图片正在被引用，无法重命名',
                'refs'    => $refs,
                'message' => '引用来源：' . implode('；', $refDescriptions),
            ], 409);
        }

        // 执行重命名
        if (!rename($realOldPath, $newPath)) {
            json_response(['success' => false, 'error' => '重命名失败'], 500);
        }

        json_response([
            'success' => true,
            'data' => [
                'name'    => $newName,
                'oldName' => $name,
                'folder'  => $folder,
                'url'     => '/assets/img/' . $folder . '/' . $newName,
            ],
        ]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[images.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
