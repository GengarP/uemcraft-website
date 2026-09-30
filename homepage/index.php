<?php
// PCL2 首页 XML（XAML）生成器
// 输出纪律：XML 声明必须永远是响应的第一字节，否则 PCL2 报「意外的 XML 声明」。
// 先关显示错误、清掉继承的输出缓冲，再起一个新缓冲把 require / 业务逻辑期间
// 可能漏出的杂音（警告、空白）全部关在里面，最后统一丢弃后才发 header + XML。
ini_set('display_errors', '0');
error_reporting(E_ALL);
while (ob_get_level() > 0) { if (!@ob_end_clean()) break; }
ob_start();

require_once __DIR__ . '/../api/common.php';

$queryApi = 'https://api.uemcraft.cn/mc-query/api/batch/stream';
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
    $xml  = '<?xml version="1.0" encoding="utf-8"?>' . "\n";
    $xml .= '<StackPanel>' . "\n";
    $xml .= '    <local:MyCard Title="服务器状态" Margin="0,0,0,15">' . "\n";
    $xml .= '        <StackPanel Margin="25,40,23,15">' . "\n";
    $xml .= '            <local:MyHint Theme="Red" Text="无法获取服务器信息，请稍后重试。" />' . "\n";
    $xml .= '        </StackPanel>' . "\n";
    $xml .= '    </local:MyCard>' . "\n";
    $xml .= '</StackPanel>' . "\n";
}

// 丢弃缓冲区中的一切杂音，然后才发 header 和 XML —— 声明永远在最前
while (ob_get_level() > 0) { if (!@ob_end_clean()) break; }
header('Content-Type: text/xml; charset=utf-8');
echo $xml;

/**
 * 默认端口：port 为 0/空时按 edition 回退（java → 25565，bedrock → 19132）。
 * 请求、匹配键、显示端口三处共用这一个回退，保证两侧一致。
 */
function defaultPort($edition) {
    return strtolower(trim((string)$edition)) === 'bedrock' ? 19132 : 25565;
}

/**
 * 批量查询服务器状态。
 * 外部接口（SSE 流）只在 server_result 结果事件里带 online/ip/port，
 * 全程没有任何事件包含 id 字段，所以按 ip:port 建映射，再匹配回本地记录；
 * 另存一份按请求下标回映的精确映射（index → 本地 id）。
 * 返回值以本地服务器 id 为键（generateXaml 按 $statuses[$id] 取用）。
 */
function queryServerStatus($serverIds, $db, $apiUrl, $timeout) {
    $placeholders = implode(',', array_fill(0, count($serverIds), '?'));
    $stmt = $db->prepare("SELECT id, address, port, edition FROM servers WHERE id IN ($placeholders)");
    $stmt->execute($serverIds);
    $serverInfo = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $queryData = [];
    $indexToId = [];
    foreach ($serverInfo as $info) {
        $port = (int)$info['port'];
        if ($port <= 0) {
            $port = defaultPort($info['edition'] ?? ''); // 与匹配键、显示端口同一回退
        }
        $indexToId[count($queryData)] = $info['id'];
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
    // 解析 SSE：只记录最终结果事件（同时带 online + ip + port 的逐服结果），
    // 忽略 meta / progress / server_event(phase) / done 等过程事件。
    // 注意 done 事件的 data 里也有 online（是统计计数而非布尔值），
    // 所以必须同时要求 ip/port 存在才能认定为结果事件。
    $statuses = []; // key: "ip:port"
    $byIndex = [];  // key: 本地记录 id（按请求下标回映，兜底 ip 回显不一致的情况）
    foreach (explode("\n", $response) as $line) {
        $line = trim($line);
        if (strpos($line, 'data:') !== 0) {
            continue;
        }
        $data = json_decode(trim(substr($line, 5)), true);
        if (!is_array($data)) {
            continue;
        }
        if (!isset($data['online']) || !isset($data['ip']) || !isset($data['port'])) {
            continue;
        }
        $statuses[$data['ip'] . ':' . $data['port']] = $data;
        if (isset($data['index'], $indexToId[$data['index']])) {
            $byIndex[$indexToId[$data['index']]] = $data;
        }
    }
    // 匹配回本地服务器记录：优先用 index→id 精确映射（同地址同端口的双协议记录也不会串），
    // 兜底按 $info['address'] . ':' . $port 作为键查询（port 用与请求侧相同的回退值）
    $result = [];
    foreach ($serverInfo as $info) {
        $port = (int)$info['port'];
        if ($port <= 0) {
            $port = defaultPort($info['edition'] ?? '');
        }
        $key = $info['address'] . ':' . $port;
        $result[$info['id']] = $byIndex[$info['id']] ?? $statuses[$key] ?? null;
    }
    return $result;
}

function generateXaml($servers, $statuses) {
    $xaml = '<?xml version="1.0" encoding="utf-8"?>' . "\n";
    $xaml .= '<StackPanel>' . "\n";
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
