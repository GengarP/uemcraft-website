<?php
header('Content-Type: text/xml; charset=utf-8');
$dbPath = __DIR__ . '/../api/site.db';
$queryApi = 'https://api.uemcraft.cn/mc-query/api/batch/stream';
$queryTimeout = 5;

try {
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $stmt = $db->query('SELECT * FROM servers ORDER BY sort_order');
    $servers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $serverStatuses = [];
    if (!empty($servers)) {
        $serverIds = array_column($servers, 'id');
        $serverStatuses = queryServerStatus($serverIds, $db, $queryApi, $queryTimeout);
    }
    echo generateXaml($servers, $serverStatuses);
} catch (Exception $e) {
    echo '<?xml version="1.0" encoding="utf-8"?>' . "\n";
    echo '<StackPanel>' . "\n";
    echo '    <local:MyCard Title="服务器状态" Margin="0,0,0,15">' . "\n";
    echo '        <StackPanel Margin="25,40,23,15">' . "\n";
    echo '            <local:MyHint Theme="Red" Text="无法获取服�
�器信息，请稍后重试。" />' . "\n";
    echo '        </StackPanel>' . "\n";
    echo '    </local:MyCard>' . "\n";
    echo '</StackPanel>' . "\n";
}

function queryServerStatus($serverIds, $db, $apiUrl, $timeout) {
    $statuses = [];
    $placeholders = implode(',', array_fill(0, count($serverIds), '?'));
    $stmt = $db->prepare("SELECT id, address, port FROM servers WHERE id IN ($placeholders)");
    $stmt->execute($serverIds);
    $serverInfo = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $queryData = [];
    foreach ($serverInfo as $info) {
        $queryData[] = ['host' => $info['address'], 'port' => (int)$info['port'], 'id' => $info['id']];
    }
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $apiUrl,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['servers' => $queryData]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode === 200 && $response) {
        $lines = explode("\n", $response);
        foreach ($lines as $line) {
            $line = trim($line);
            if (strpos($line, 'data: ') === 0) {
                $jsonStr = substr($line, 6);
                $data = json_decode($jsonStr, true);
                if ($data && isset($data['id'])) {
                    $statuses[$data['id']] = $data;
                }
            }
        }
    }
    return $statuses;
}

function generateXaml($servers, $statuses) {
    $xaml = '<?xml version="1.0" encoding="utf-8"?>' . "\n";
    $xaml .= '<StackPanel>' . "\n";
    foreach ($servers as $server) {
        $id = $server['id'];
        $name = htmlspecialchars($server['name'], ENT_XML1, 'UTF-8');
        $edition = htmlspecialchars($server['edition'] ?? '', ENT_XML1, 'UTF-8');
        $note = htmlspecialchars($server['note'] ?? '', ENT_XML1, 'UTF-8');
        $status = $statuses[$id] ?? null;
        $isOnline = $status && ($status['online'] ?? false);
        if ($isOnline) {
            $statusText = '在线';
            $statusColor = '#4CAF50';
            $playersText = ($status['players']['online'] ?? 0) . ' / ' . ($status['players']['max'] ?? 0);
            $versionText = $status['version'] ?? '未知';
            $latencyText = ($status['latency'] ?? 0) . 'ms';
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
        $xaml .= '            <local:MyListItem Margin="-5,2,-5,2" Logo="pack://application:,,,/images/Blocks/CommandBlock.png" Title="地址" Info="' . htmlspecialchars($server['address'] . ':' . $server['port'], ENT_XML1, 'UTF-8') . '" />' . "\n";
        $xaml .= '            <local:MyListItem Margin="-5,2,-5,2" Logo="pack://application:,,,/images/Blocks/CraftingTable.png" Title="版本" Info="' . $versionText . '" />' . "\n";
        $xaml .= '            <local:MyListItem Margin="-5,2,-5,2" Logo="pack://application:,,,/images/Blocks/Grass.png" Title="玩家" Info="' . $playersText . '" />' . "\n";
        $xaml .= '            <local:MyListItem Margin="-5,2,-5,2" Logo="pack://application:,,,/images/Blocks/Redstone.png" Title="延迟" Info="' . $latencyText . '" />' . "\n";
        if (!empty($motdText)) {
            $motdSafe = htmlspecialchars($motdText, ENT_XML1, 'UTF-8');
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
