<?php
/**
 * images.php — UEMCraft 图片管理 API
 * ------------------------------------
 * 管理接口（需 X-Admin-Token 请求头）：
 *   GET  ?action=list                      （列出 assets/img/ 下所有图片）
 *   POST ?action=upload                    （上传图片）
 *   POST ?action=delete                    （删除图片）
 */

require_once __DIR__ . '/common.php';

$ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'];
$MAX_SIZE    = 10 * 1024 * 1024; // 10MB
$IMG_DIR     = realpath(__DIR__ . '/../assets/img');

if (!$IMG_DIR || !is_dir($IMG_DIR)) {
    json_response(['success' => false, 'error' => '图片目录不存在'], 500);
}

$action = $_GET['action'] ?? '';

try {
    // ---- 列出图片 ----
    if ($action === 'list') {
        requireAdmin();

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
                'name'  => $relativePath,
                'url'   => '../assets/img/' . $relativePath,
                'size'  => $file->getSize(),
                'mtime' => $file->getMTime(),
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

        // 生成安全文件名
        $baseName = pathinfo($origName, PATHINFO_FILENAME);
        $baseName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $baseName);
        if ($baseName === '') $baseName = 'image';

        $targetName = $baseName . '.' . $ext;
        $targetPath = $IMG_DIR . '/' . $targetName;

        // 文件名冲突：加数字后缀
        $counter = 1;
        while (file_exists($targetPath)) {
            $targetName = $baseName . '_' . $counter . '.' . $ext;
            $targetPath = $IMG_DIR . '/' . $targetName;
            $counter++;
        }

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            json_response(['success' => false, 'error' => '保存文件失败'], 500);
        }

        json_response([
            'success' => true,
            'data' => [
                'name' => $targetName,
                'url'  => '../assets/img/' . $targetName,
                'size' => $file['size'],
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
        $name = trim($input['name'] ?? '');

        if ($name === '') {
            json_response(['success' => false, 'error' => '缺少文件名'], 400);
        }

        // 安全检查：防止路径穿越
        $name = str_replace('\\', '/', $name);
        if (strpos($name, '..') !== false || strpos($name, '/') === 0) {
            json_response(['success' => false, 'error' => '非法文件路径'], 400);
        }

        $targetPath = $IMG_DIR . '/' . $name;
        $realPath = realpath($targetPath);

        // 确保文件在 img 目录内
        if (!$realPath || strpos($realPath, $IMG_DIR) !== 0) {
            json_response(['success' => false, 'error' => '文件不在图片目录内'], 400);
        }

        if (!file_exists($realPath)) {
            json_response(['success' => false, 'error' => '文件不存在'], 404);
        }

        if (!unlink($realPath)) {
            json_response(['success' => false, 'error' => '删除失败'], 500);
        }

        // 清理空目录（仅一层）
        $parentDir = dirname($realPath);
        if ($parentDir !== $IMG_DIR && is_dir($parentDir)) {
            $contents = scandir($parentDir);
            if (count($contents) <= 2) { // only . and ..
                rmdir($parentDir);
            }
        }

        json_response(['success' => true, 'data' => ['name' => $name]]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[images.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
