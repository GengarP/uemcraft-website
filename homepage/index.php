<?php
// PCL2 首页 XML（XAML）生成器
// 输出纪律：直接从 <StackPanel> 开始，不输出 <?xml> 声明（PCL2 自己处理声明与命名空间）。
// <StackPanel> 前有任何杂音（声明、警告、空白）都会让文档非良构、PCL2 全部卡片消失，
// 所以先关显示错误、清掉继承的输出缓冲，再起一个新缓冲把 require / 业务逻辑期间
// 可能漏出的杂音全部关在里面，最后统一丢弃后才发 header + 内容。
ini_set('display_errors', '0');
error_reporting(E_ALL);
while (ob_get_level() > 0) { if (!@ob_end_clean()) break; }
ob_start();

require_once __DIR__ . '/../api/common.php';

$queryApi = 'https://api.uemcraft.cn/mc-query/api/batch'; // 非流式接口，返回 JSON
$queryTimeout = 30; // 与 api/servers.php、js/server.js 的 30 秒对齐，避免慢查询被截断成「离线」

$xml = '';
try {
    $db = getSiteDb();
    $stmt = $db->query('SELECT * FROM servers ORDER BY sort_order');
    $servers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $serverStatuses = [];
    if (!empty($servers)) {
        $serverIds = array_column($servers, 'id');
        $serverStatuses = queryServerStatus($serverIds, $db, $queryApi, $queryTimeout);
    }
    $xml = generateXaml($servers, $serverStatuses);
} catch (Throwable $e) {
    error_log('homepage 生成失败: ' . $e->getMessage());
    $xml  = '<StackPanel>' . "\n";
    $xml .= '    <local:MyCard Title="服务器状态" Margin="0,0,0,15">' . "\n";
    $xml .= '        <StackPanel Margin="25,40,23,15">' . "\n";
    $xml .= '            <local:MyHint Theme="Red" Text="无法获取服务器信息，请稍后重试。" />' . "\n";
    $xml .= '        </StackPanel>' . "\n";
    $xml .= '    </local:MyCard>' . "\n";
    $xml .= '</StackPanel>' . "\n";
}

// 丢弃缓冲区中的一切杂音，然后才发 header 和内容 —— <StackPanel> 永远在最前
while (ob_get_level() > 0) { if (!@ob_end_clean()) break; }
header('Content-Type: text/xml; charset=utf-8');
echo $xml;

/**
 * 默认端口：port 为 0/空时按 edition 回退（java → 25565，bedrock → 19132）。
 * 请求、匹配键、显示端口三处共用这一个回退，保证两侧一致。
 */
function defaultPort($edition) {
    return editionKey($edition) === 'bedrock' ? 19132 : 25565;
}

/**
 * 归一化 edition 为映射键（bedrock → 'bedrock'，其余 → 'java'）。
 * 请求侧、响应侧都过这一层，大小写/空白差异不会让键错位。
 */
function editionKey($edition) {
    return strtolower(trim((string)$edition)) === 'bedrock' ? 'bedrock' : 'java';
}

/**
 * 批量查询服务器状态（非流式）。
 * 外部接口一次性返回 JSON：{"results": [{online, ip, port, edition, ...}, ...]}。
 * 结果里没有任何 id/index 字段，ip/port 精确回显请求原值，所以按 ip:port:edition
 * 建映射再匹配回本地记录——edition 必须参与键：同地址同端口的双协议（java/bedrock）
 * 记录没有别的办法区分，只按 ip:port 会让两条记录串到同一个结果上。
 * 返回值以本地服务器 id 为键（generateXaml 按 $statuses[$id] 取用）。
 */
function queryServerStatus($serverIds, $db, $apiUrl, $timeout) {
    $placeholders = implode(',', array_fill(0, count($serverIds), '?'));
    $stmt = $db->prepare("SELECT id, address, port, edition FROM servers WHERE id IN ($placeholders)");
    $stmt->execute($serverIds);
    $serverInfo = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $queryData = [];
    foreach ($serverInfo as $info) {
        $port = (int)$info['port'];
        if ($port <= 0) {
            $port = defaultPort($info['edition'] ?? ''); // 与匹配键、显示端口同一回退
        }
        $queryData[] = [
            'ip'      => $info['address'],
            'port'    => $port,
            'edition' => ($info['edition'] ?? '') ?: 'java',
        ];
    }
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/json',
            'content' => json_encode(['servers' => $queryData]),
            'timeout' => $timeout,
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ]);
    $response = @file_get_contents($apiUrl, false, $context);
    if ($response === false) {
        $err = error_get_last();
        error_log('API 请求失败: ' . ($err['message'] ?? '未知错误'));
        return [];
    }
    // 只取 results 数组；顶层的 online/offline 是统计计数，不是逐服布尔值
    $data = json_decode($response, true);
    $results = (is_array($data) && isset($data['results']) && is_array($data['results'])) ? $data['results'] : [];
    $statuses = []; // key: "ip:port:edition"
    foreach ($results as $r) {
        if (!is_array($r) || !isset($r['ip'], $r['port'])) {
            continue;
        }
        $statuses[$r['ip'] . ':' . (int)$r['port'] . ':' . editionKey($r['edition'] ?? '')] = $r;
    }
    // 匹配回本地服务器记录（port 回退与请求侧一致）
    $result = [];
    foreach ($serverInfo as $info) {
        $port = (int)$info['port'];
        if ($port <= 0) {
            $port = defaultPort($info['edition'] ?? '');
        }
        $key = $info['address'] . ':' . $port . ':' . editionKey($info['edition'] ?? '');
        $result[$info['id']] = $statuses[$key] ?? null;
    }
    return $result;
}

function generateXaml($servers, $statuses) {
    $xaml = '<StackPanel>' . "\n";
    foreach ($servers as $server) {
        $id = $server['id'];
        // ENT_XML1 只转义 <>& 不转义 ASCII 双引号（等价 ENT_NOQUOTES），
        // 属性值用双引号包裹必须加 ENT_QUOTES，否则引号会截断属性、整份 XML 非良构；
        // ENT_SUBSTITUTE 让非法 UTF-8 以 U+FFFD 替换，而不是整串变空。
        $esc = ENT_XML1 | ENT_QUOTES | ENT_SUBSTITUTE;
        $name = htmlspecialchars($server['name'], $esc, 'UTF-8');
        $edition = htmlspecialchars($server['edition'] ?? '', $esc, 'UTF-8');
        $note = htmlspecialchars($server['note'] ?? '', $esc, 'UTF-8');
        // hide_address=1 的服务器对外掩码地址，与 api/servers.php 公开接口一致（查询仍用真实地址）
        $address = !empty($server['hide_address']) ? mask_address($server['address']) : $server['address'];
        $displayPort = (int)$server['port'];
        if ($displayPort <= 0) {
            $displayPort = defaultPort($server['edition'] ?? ''); // 与匹配键同一回退
        }
        $status = $statuses[$id] ?? null;
        $isOnline = $status && ($status['online'] ?? false);
        if ($isOnline) {
            $statusText = '在线';
            $statusColor = '#4CAF50';
            $playersText = (int)($status['players']['online'] ?? 0) . ' / ' . (int)($status['players']['max'] ?? 0);
            $versionText = htmlspecialchars($status['version'] ?? '未知', $esc, 'UTF-8');
            $latencyText = (int)($status['latency'] ?? 0) . 'ms';
            $motdText = isset($status['motd']) ? strip_tags($status['motd']) : '';
        } else {
            $statusText = '离线';
            $statusColor = '#F44336';
            $playersText = '- / -';
            $versionText = $edition ?: '未知';
            $latencyText = '超时';
            $motdText = '';
        }
        $xaml .= '    <local:MyCard Title="' . $name . '" Margin="0,0,0,15" CanSwap="True">' . "\n";
        $xaml .= '        <StackPanel Margin="25,40,23,15">' . "\n";
        $xaml .= '            <StackPanel Orientation="Horizontal" Margin="0,0,0,8">' . "\n";
        $xaml .= '                <TextBlock Text="● " Foreground="' . $statusColor . '" FontSize="14" VerticalAlignment="Center" />' . "\n";
        $xaml .= '                <TextBlock Text="' . $statusText . '" Foreground="' . $statusColor . '" FontSize="14" FontWeight="Bold" VerticalAlignment="Center" />' . "\n";
        $xaml .= '            </StackPanel>' . "\n";
        $xaml .= '            <local:MyListItem Margin="-5,2,-5,2" Logo="pack://application:,,,/images/Blocks/CommandBlock.png" Title="地址" Info="' . htmlspecialchars($address . ':' . $displayPort, $esc, 'UTF-8') . '" />' . "\n";
        $xaml .= '            <local:MyListItem Margin="-5,2,-5,2" Logo="pack://application:,,,/images/Blocks/CraftingTable.png" Title="版本" Info="' . $versionText . '" />' . "\n";
        $xaml .= '            <local:MyListItem Margin="-5,2,-5,2" Logo="pack://application:,,,/images/Blocks/Grass.png" Title="玩家" Info="' . $playersText . '" />' . "\n";
        $xaml .= '            <local:MyListItem Margin="-5,2,-5,2" Logo="pack://application:,,,/images/Blocks/Redstone.png" Title="延迟" Info="' . $latencyText . '" />' . "\n";
        if (!empty($motdText)) {
            $motdSafe = htmlspecialchars($motdText, $esc, 'UTF-8');
            $xaml .= '            <TextBlock TextWrapping="Wrap" Margin="0,6,0,0" FontSize="12" Foreground="{DynamicResource ColorBrush4}" Text="' . $motdSafe . '" />' . "\n";
        }
        if (!empty($note)) {
            $xaml .= '            <local:MyHint Margin="0,8,0,0" Theme="Blue" Text="' . $note . '" />' . "\n";
        }
        $xaml .= '        </StackPanel>' . "\n";
        $xaml .= '    </local:MyCard>' . "\n";
    }
    if (empty($servers)) {
        $xaml .= '    <local:MyCard Title="服务器状态" Margin="0,0,0,15">' . "\n";
        $xaml .= '        <StackPanel Margin="25,40,23,15">' . "\n";
        $xaml .= '            <local:MyHint Theme="Yellow" Text="暂无服务器信息。" />' . "\n";
        $xaml .= '        </StackPanel>' . "\n";
        $xaml .= '    </local:MyCard>' . "\n";
    }
    $xaml .= '</StackPanel>' . "\n";
    return $xaml;
}
