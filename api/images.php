<?php
/**
 * images.php — UEMCraft 图片管理 API
 * ------------------------------------
 * 管理接口（需 X-Admin-Token 请求头）：
 *   GET  ?action=list                      （列出 assets/img/events/ 下所有图片）
 *   POST ?action=upload                    （上传图片，自动重命名为 yy-mm-dd-title 格式）
 */

require_once __DIR__ . '/common.php';

$ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'];
$MAX_SIZE    = 10 * 1024 * 1024; // 10MB
$IMG_DIR     = realpath(__DIR__ . '/../assets/img/events');

if (!$IMG_DIR || !is_dir($IMG_DIR)) {
    // 目录不存在则尝试创建
    $target = __DIR__ . '/../assets/img/events';
    if (!is_dir($target)) {
        mkdir($target, 0755, true);
    }
    $IMG_DIR = realpath($target);
    if (!$IMG_DIR) {
        json_response(['success' => false, 'error' => '图片目录创建失败'], 500);
    }
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
                'url'   => '../assets/img/events/' . $relativePath,
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
                'name' => $targetName,
                'url'  => '../assets/img/events/' . $targetName,
                'size' => $file['size'],
            ],
        ]);
    }

    json_response(['success' => false, 'error' => '未知操作'], 400);

} catch (Throwable $e) {
    error_log('[images.php] ' . $e->getMessage());
    json_response(['success' => false, 'error' => '服务器内部错误'], 500);
}
