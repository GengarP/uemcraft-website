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
    // 卡片设计器：卡片与自定义变量均来自后台（api/pcl.php 管理）
    $cards = $db->query('SELECT * FROM pcl_cards ORDER BY sort_order ASC, id ASC')->fetchAll(PDO::FETCH_ASSOC);
    $varRows = $db->query('SELECT * FROM pcl_vars ORDER BY sort_order ASC, id ASC')->fetchAll(PDO::FETCH_ASSOC);
    $xml = generateXaml($servers, $serverStatuses, $cards, $varRows);
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

/* ============================================================
   卡片设计器渲染
   - pcl_cards.kind='server'：模板卡，按 servers 表每台展开一张
   - pcl_cards.kind='standalone'：独立卡，渲染一次
   - 模板中 {%key%} 从键值映射替换；值是数据不是 XAML，
     替换完成后统一过 $esc（ENT_XML1|ENT_QUOTES|ENT_SUBSTITUTE）
   ============================================================ */

/** XAML 属性转义（ENT_XML1 不转义 ASCII 双引号，必须带 ENT_QUOTES） */
function xesc($s) {
    return htmlspecialchars((string)$s, ENT_XML1 | ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** 文本属性转义：额外把换行变成 &#10;（XML 属性里的裸换行会被归一化成空格） */
function xesc_nl($s) {
    return str_replace(["\r\n", "\r", "\n"], '&#10;', xesc($s));
}

/**
 * 分隔线/页脚文字逐字插空格（「历史版本」→「历 史 版 本」），
 * 仿 PCL2-NewsHomepage 的 Separator 字距效果；已有空格处不重复加。
 */
function spaceOut($text) {
    return preg_replace('/(?<=\S)(?=\S)/u', ' ', (string)$text);
}

/**
 * 带字分隔线：三列 Grid（线 / 拉开字距的文字 / 线），
 * 参考 PCL2-NewsHomepage 的 Separator 模板。$strokeAttr 可以是
 * `{DynamicResource ColorBrush4}` 字面量，也可以是已转义的自定义色。
 */
function labeledLine($text, $fontSize, $strokeAttr, $thicknessStr, $opacityAttr) {
    $lineAt = function ($col) use ($strokeAttr, $thicknessStr, $opacityAttr) {
        return '<Line X1="0" X2="100" Stroke="' . $strokeAttr . '" StrokeThickness="' . $thicknessStr . '" HorizontalAlignment="Center" Stretch="Fill" Grid.Column="' . $col . '"' . $opacityAttr . ' />';
    };
    $out  = '            <Grid Margin="0,10">' . "\n";
    $out .= '                <Grid.ColumnDefinitions><ColumnDefinition Width="1*" /><ColumnDefinition Width="Auto" /><ColumnDefinition Width="1*" /></Grid.ColumnDefinitions>' . "\n";
    $out .= '                ' . $lineAt(0) . "\n";
    $out .= '                <TextBlock Text="' . xesc($text) . '" FontSize="' . $fontSize . '" Foreground="' . $strokeAttr . '" Grid.Column="1" VerticalAlignment="Center" Margin="12,0" />' . "\n";
    $out .= '                ' . $lineAt(2) . "\n";
    $out .= '            </Grid>' . "\n";
    return $out;
}

/**
 * 解析 Minecraft § 颜色码（§0-§f 色、§l§o§m§n 样式、§r 重置、§x§R§R§G§G§B§B 十六进制色）
 * 为 WPF <Run> 片段串。返回 null 表示文本不含 § 码，走普通 TextBlock。
 * Run 之间不换行不加空白——XAML 会把 Run 之间的缩进空白变成多余空格。
 */
function parseMcRuns($text) {
    static $MC_COLORS = [
        '0' => '#000000', '1' => '#0000AA', '2' => '#00AA00', '3' => '#00AAAA',
        '4' => '#AA0000', '5' => '#AA00AA', '6' => '#FFAA00', '7' => '#AAAAAA',
        '8' => '#555555', '9' => '#5555FF', 'a' => '#55FF55', 'b' => '#55FFFF',
        'c' => '#FF5555', 'd' => '#FF55FF', 'e' => '#FFFF55', 'f' => '#FFFFFF',
    ];
    $text = (string)$text;
    if (strpos($text, '§') === false) {
        return null;
    }
    $parts = preg_split('/§(.)/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE);
    $runs = '';
    $buf = '';
    $color = null;
    $bold = $italic = $strike = $under = false;
    $hexPending = 0;
    $hexBuf = '';
    $flush = function () use (&$runs, &$buf, &$color, &$bold, &$italic, &$strike, &$under) {
        if ($buf === '') {
            return;
        }
        $attrs = '';
        if ($color !== null) {
            $attrs .= ' Foreground="' . xesc($color) . '"';
        }
        if ($bold) {
            $attrs .= ' FontWeight="Bold"';
        }
        if ($italic) {
            $attrs .= ' FontStyle="Italic"';
        }
        $decs = [];
        if ($under) {
            $decs[] = 'Underline';
        }
        if ($strike) {
            $decs[] = 'Strikethrough';
        }
        if ($decs) {
            $attrs .= ' TextDecorations="' . implode(',', $decs) . '"';
        }
        $runs .= '<Run Text="' . xesc_nl($buf) . '"' . $attrs . ' />';
        $buf = '';
    };
    foreach ($parts as $i => $piece) {
        if ($i % 2 === 0) {
            $buf .= $piece;
            continue;
        }
        $code = strtolower($piece);
        if ($hexPending > 0) {
            $hexBuf .= $code;
            if (--$hexPending === 0) {
                $flush();
                $color = '#' . $hexBuf;
                $bold = $italic = $strike = $under = false;
            }
            continue;
        }
        if ($code === 'x') {
            $flush();
            $hexPending = 6;
            $hexBuf = '';
            continue;
        }
        if (isset($MC_COLORS[$code])) {
            $flush();
            $color = $MC_COLORS[$code];
            $bold = $italic = $strike = $under = false; // 颜色码在 MC 里同时重置样式
            continue;
        }
        if ($code === 'l') {
            $flush();
            $bold = true;
        } elseif ($code === 'o') {
            $flush();
            $italic = true;
        } elseif ($code === 'm') {
            $flush();
            $strike = true;
        } elseif ($code === 'n') {
            $flush();
            $under = true;
        } elseif ($code === 'r') {
            $flush();
            $color = null;
            $bold = $italic = $strike = $under = false;
        }
        // §k（乱码）与其他未知码直接忽略
    }
    $flush();
    return $runs === '' ? null : $runs;
}

/**
 * {%key%} 替换：未定义键替换为空串。
 * 返回的仍是原始文本（未转义），渲染拼接时统一过 xesc()。
 */
function substitute($tpl, $map) {
    return preg_replace_callback('/\{%([a-zA-Z0-9_]+)%\}/', function ($m) use ($map) {
        return array_key_exists($m[1], $map) ? (string)$map[$m[1]] : '';
    }, (string)$tpl);
}

/** 全局键值映射：自定义变量 + 内置 {%year%} */
function globalMap($varRows) {
    $map = ['year' => date('Y')];
    foreach ($varRows as $v) {
        $map[(string)$v['var_key']] = (string)$v['var_value'];
    }
    return $map;
}

/** 服务器键值映射（叠加全局映射），address 已按 hide_address 掩码 */
function serverMap($server, $statuses, $varRows) {
    $map = globalMap($varRows);
    $address = !empty($server['hide_address']) ? mask_address($server['address']) : $server['address'];
    $displayPort = (int)$server['port'];
    if ($displayPort <= 0) {
        $displayPort = defaultPort($server['edition'] ?? ''); // 与匹配键同一回退
    }
    $status = $statuses[$server['id']] ?? null;
    $isOnline = $status && ($status['online'] ?? false);
    if ($isOnline) {
        $map['status'] = '在线';
        $map['status_color'] = '#4CAF50';
        $map['players_online'] = (string)(int)($status['players']['online'] ?? 0);
        $map['players_max'] = (string)(int)($status['players']['max'] ?? 0);
        $map['players'] = $map['players_online'] . ' / ' . $map['players_max'];
        $map['version'] = (string)($status['version'] ?? '未知');
        $map['latency'] = (int)($status['latency'] ?? 0) . 'ms';
        $map['motd'] = isset($status['motd']) ? strip_tags($status['motd']) : '';
    } else {
        $map['status'] = '离线';
        $map['status_color'] = '#F44336';
        $map['players_online'] = '';
        $map['players_max'] = '';
        $map['players'] = '- / -';
        $map['version'] = ($server['edition'] ?? '') ?: '未知';
        $map['latency'] = '超时';
        $map['motd'] = '';
    }
    $map['name'] = (string)$server['name'];
    $map['address'] = (string)$address;
    $map['port'] = (string)$displayPort;
    $map['address_port'] = $address . ':' . $displayPort;
    $map['edition'] = (string)($server['edition'] ?? '');
    $map['note'] = (string)($server['note'] ?? '');
    return $map;
}

/** 行里引用的 {%key%} 值全为空时整行不输出（hide_if_empty） */
function rowHidden($row, $map) {
    if (empty($row['hide_if_empty'])) {
        return false;
    }
    preg_match_all('/\{%([a-zA-Z0-9_]+)%\}/', json_encode($row, JSON_UNESCAPED_UNICODE), $m);
    if (empty($m[1])) {
        return false;
    }
    foreach (array_unique($m[1]) as $key) {
        if (($map[$key] ?? '') !== '') {
            return false;
        }
    }
    return true;
}

/** 渲染单行内容 */
function renderRow($row, $map) {
    $type = $row['type'] ?? '';
    if ($type === 'status_dot') {
        // 仅 server 卡的映射有 status/status_color；空值说明是 standalone 卡，跳过
        $status = $map['status'] ?? '';
        $color = $map['status_color'] ?? '#F44336';
        if ($status === '') {
            return '';
        }
        // MojangStatus 式状态行：圆角小方块 + 粗体 Run（Inline 之间零空白，缩进会变成空格）
        return '            <TextBlock Margin="0,0,0,8" FontSize="14" FontWeight="Bold"><InlineUIContainer><Border Background="' . xesc($color) . '" CornerRadius="2" Height="10" Width="10" Margin="0,0,0,1" /></InlineUIContainer><Run Text=" ' . xesc($status) . '" /></TextBlock>' . "\n";
    }

    if ($type === 'list_item') {
        // logo 可以是 12 内置图标名（CommandBlock.png 等），也可以是完整 URL
        $logo = substitute($row['logo'] ?? '', $map);
        if ($logo === '') {
            $logoAttr = '';
        } elseif (preg_match('#^[a-z]+://#i', $logo)) {
            $logoAttr = ' Logo="' . xesc($logo) . '"';
        } else {
            $logoAttr = ' Logo="pack://application:,,,/images/Blocks/' . xesc($logo) . '"';
        }
        $title = xesc(substitute($row['title'] ?? '', $map));
        $info = xesc(substitute($row['info'] ?? '', $map));
        $click = '';
        if (!empty($row['clickable']['event_type'])) {
            // Type="Clickable" + EventType/EventData：点击行触发自定义事件（如复制文本）
            $et = xesc($row['clickable']['event_type']);
            $ed = xesc(substitute($row['clickable']['event_data'] ?? '', $map));
            $click = ' Type="Clickable" EventType="' . $et . '" EventData="' . $ed . '"';
        }
        return '            <local:MyListItem Margin="-5,2,-5,2"' . $logoAttr . ' Title="' . $title . '" Info="' . $info . '"' . $click . ' />' . "\n";
    }

    if ($type === 'text') {
        $raw = substitute($row['text'] ?? '', $map);
        $size = intval($row['font_size'] ?? 12);
        if ($size <= 0) $size = 12;
        $color = substitute($row['color'] ?? '', $map);
        $colorAttr = $color !== '' ? ' Foreground="' . xesc($color) . '"' : '';
        // MOTD 等文本支持 Minecraft § 颜色码 → 多色 <Run>
        $runs = parseMcRuns($raw);
        if ($runs === null) {
            return '            <TextBlock TextWrapping="Wrap" Margin="0,6,0,0" FontSize="' . $size . '"' . $colorAttr . ' Text="' . xesc_nl($raw) . '" />' . "\n";
        }
        return '            <TextBlock TextWrapping="Wrap" Margin="0,6,0,0" FontSize="' . $size . '"' . $colorAttr . '>' . $runs . '</TextBlock>' . "\n";
    }

    if ($type === 'hint') {
        $theme = $row['theme'] ?? 'Blue';
        if (!in_array($theme, ['Blue', 'Red', 'Yellow', 'Green'], true)) {
            $theme = 'Blue';
        }
        $text = xesc(substitute($row['text'] ?? '', $map));
        return '            <local:MyHint Margin="0,4,0,8" Theme="' . $theme . '" Text="' . $text . '" />' . "\n";
    }

    if ($type === 'image') {
        // MyImage.Source 是字符串（http URL / pack URI / 本地路径），WebP 也支持，网络图自动缓存
        $src = substitute($row['src'] ?? '', $map);
        if ($src === '') {
            return '';
        }
        $attrs = ' Source="' . xesc($src) . '"';
        $w = intval($row['width'] ?? 0);
        $h = intval($row['height'] ?? 0);
        if ($w > 0) $attrs .= ' Width="' . min($w, 2000) . '"';
        if ($h > 0) $attrs .= ' Height="' . min($h, 2000) . '"';
        $stretch = $row['stretch'] ?? 'Uniform';
        if (!in_array($stretch, ['Uniform', 'UniformToFill', 'Fill', 'None'], true)) {
            $stretch = 'Uniform';
        }
        $attrs .= ' Stretch="' . $stretch . '"';
        return '            <local:MyImage Margin="0,6,0,0"' . $attrs . ' />' . "\n";
    }

    if ($type === 'divider') {
        // 分割线：放在卡片开头/结尾即可形成卡片之间的视觉分隔；
        // 填了 text 则升级为带字分隔线（「历 史 版 本」式三列 Grid）
        $thickness = (float)($row['thickness'] ?? 1.5);
        if ($thickness <= 0) $thickness = 1.5;
        $thickness = min($thickness, 10.0);
        $stroke = substitute($row['color'] ?? '', $map);
        $strokeAttr = $stroke !== '' ? xesc($stroke) : '{DynamicResource ColorBrush4}';
        $opacity = (float)($row['opacity'] ?? 1);
        if ($opacity <= 0 || $opacity > 1) $opacity = 1;
        $opacityAttr = $opacity < 1 ? ' Opacity="' . $opacity . '"' : '';
        $text = spaceOut(substitute($row['text'] ?? '', $map));
        if ($text !== '') {
            return labeledLine($text, 15, $strokeAttr, sprintf('%g', $thickness), $opacityAttr);
        }
        return '            <Line X1="0" X2="100" Stroke="' . $strokeAttr . '" StrokeThickness="' . sprintf('%g', $thickness) . '" HorizontalAlignment="Center" Stretch="Fill" Margin="4,4"' . $opacityAttr . ' />' . "\n";
    }

    if ($type === 'header_image') {
        // 三线夹图头图：上下 3px 粗线夹图 + 可叠圆角徽章 chip（PCL2-NewsHomepage 签名手法）
        $src = substitute($row['src'] ?? '', $map);
        if ($src === '') {
            return '';
        }
        $h = intval($row['height'] ?? 0);
        if ($h <= 0) $h = 170;
        $h = max(60, min($h, 500));
        $badge = substitute($row['badge'] ?? '', $map);
        $out  = '            <Grid Margin="0,6,0,0">' . "\n";
        $out .= '                <StackPanel>' . "\n";
        $out .= '                    <Line X1="0" X2="100" Stroke="{DynamicResource ColorBrush4}" StrokeThickness="3" HorizontalAlignment="Center" Stretch="Fill" />' . "\n";
        $out .= '                    <local:MyImage Source="' . xesc($src) . '" Stretch="UniformToFill" MaxHeight="' . $h . '" />' . "\n";
        $out .= '                    <Line X1="0" X2="100" Stroke="{DynamicResource ColorBrush4}" StrokeThickness="3" HorizontalAlignment="Center" Stretch="Fill" />' . "\n";
        $out .= '                </StackPanel>' . "\n";
        if ($badge !== '') {
            $out .= '                <Border Background="{DynamicResource ColorBrush3}" BorderBrush="{DynamicResource ColorBrush2}" BorderThickness="0,0,0,2" CornerRadius="5" Padding="12,3" HorizontalAlignment="Right" VerticalAlignment="Bottom" Margin="0,0,0,-2">' . "\n";
            $out .= '                    <TextBlock Text="' . xesc($badge) . '" FontSize="15" FontWeight="Bold" Foreground="{DynamicResource ColorBrush7}" />' . "\n";
            $out .= '                </Border>' . "\n";
        }
        $out .= '            </Grid>' . "\n";
        return $out;
    }

    if ($type === 'notice') {
        // 公告条横幅：圆角浅底 Border（PCL2-NewsHomepage noticebar 签名外观，Opacity 0.7 固定）
        $raw = substitute($row['text'] ?? '', $map);
        $runs = parseMcRuns($raw);
        if ($runs === null) {
            $tb = '<TextBlock TextWrapping="Wrap" Margin="10,0" FontSize="12" FontWeight="Bold" Text="' . xesc_nl($raw) . '" />';
        } else {
            $tb = '<TextBlock TextWrapping="Wrap" Margin="10,0" FontSize="12" FontWeight="Bold">' . $runs . '</TextBlock>';
        }
        $out  = '            <Border Margin="0,6,0,0" Padding="2,8" BorderThickness="1" Background="{DynamicResource ColorBrush5}" BorderBrush="{DynamicResource ColorBrush3}" CornerRadius="5" Opacity="0.7">' . "\n";
        $out .= '                ' . $tb . "\n";
        $out .= '            </Border>' . "\n";
        return $out;
    }

    if ($type === 'footer') {
        // 页脚封底：「到 底 啦」式带字分隔 + 可选底部 8px 厚色条
        $raw = substitute(array_key_exists('text', $row) ? (string)$row['text'] : '到底啦', $map);
        $thick = (bool)($row['thick_border'] ?? true);
        $out = '';
        if ($raw !== '') {
            $out .= labeledLine(spaceOut($raw), 14, '{DynamicResource ColorBrush4}', '1.5', '');
        }
        if ($thick) {
            $out .= '            <Border BorderThickness="0,0,0,8" BorderBrush="{DynamicResource ColorBrush2}" Margin="0,4,0,0" />' . "\n";
        }
        return $out;
    }

    return '';
}

/** 渲染按钮行（WrapPanel 可换行，事件属性为直接属性写法；style=icon_text 走 MyIconTextButton） */
function renderButtons($buttons, $map) {
    $items = '';
    foreach ($buttons as $btn) {
        if (!is_array($btn)) {
            continue;
        }
        $et = xesc($btn['event_type'] ?? 'None');
        $ed = xesc(substitute($btn['event_data'] ?? '', $map));
        $style = $btn['style'] ?? 'text';
        if (!in_array($style, ['text', 'icon_text'], true)) {
            $style = 'text';
        }
        // 自定义尺寸：Width/Height 是 FrameworkElement 属性，直接生效（字号不可改，LabText 写死 13）
        $sizeAttr = '';
        $w = intval($btn['width'] ?? 0);
        $h = intval($btn['height'] ?? 0);
        if ($w > 0) $sizeAttr .= ' Width="' . min($w, 2000) . '"';

        if ($style === 'icon_text') {
            // 图标文字按钮：矢量 Path 数据作 Logo（自由文本，非空即可）
            $logo = trim((string)($btn['logo_path'] ?? ''));
            if ($logo === '') {
                continue;
            }
            $text = xesc(substitute($btn['text'] ?? '', $map));
            $tooltip = substitute($btn['tooltip'] ?? '', $map);
            $tipAttr = $tooltip !== '' ? ' ToolTip="' . xesc($tooltip) . '"' : '';
            $scale = (float)($btn['logo_scale'] ?? 1);
            if ($scale < 0.1 || $scale > 5) $scale = 1;
            if ($h > 0) $sizeAttr .= ' Height="' . min($h, 2000) . '"';
            $items .= '                <local:MyIconTextButton Text="' . $text . '"' . $tipAttr . ' EventType="' . $et . '" EventData="' . $ed . '" Logo="' . xesc($logo) . '" LogoScale="' . sprintf('%g', $scale) . '"' . $sizeAttr . ' Margin="0,0,5,5" />' . "\n";
            continue;
        }

        $text = xesc(substitute($btn['text'] ?? '', $map));
        $ct = $btn['color_type'] ?? 'Normal';
        if (!in_array($ct, ['Normal', 'Highlight', 'Red'], true)) {
            $ct = 'Normal';
        }
        if ($h > 0) {
            $sizeAttr .= ' Height="' . min($h, 2000) . '"';
        } else {
            $sizeAttr .= ' Height="35"'; // 参考仓库按钮规范高度
        }
        $items .= '                <local:MyButton Text="' . $text . '" EventType="' . $et . '" EventData="' . $ed . '" ColorType="' . $ct . '" Padding="13,0"' . $sizeAttr . ' Margin="0,0,5,5" />' . "\n";
    }
    if ($items === '') {
        return '';
    }
    return '            <WrapPanel Orientation="Horizontal" Margin="0,10,0,0">' . "\n" . $items . '            </WrapPanel>' . "\n";
}

/** 渲染一张卡片（server 模板卡传入单台的映射，standalone 卡传入全局映射） */
function renderCard($card, $map) {
    $rows = json_decode((string)($card['rows_json'] ?? '[]'), true);
    if (!is_array($rows)) {
        $rows = [];
    }
    $buttons = json_decode((string)($card['buttons_json'] ?? '[]'), true);
    if (!is_array($buttons)) {
        $buttons = [];
    }

    $body = '';
    foreach ($rows as $row) {
        if (!is_array($row) || rowHidden($row, $map)) {
            continue;
        }
        $body .= renderRow($row, $map);
    }
    $body .= renderButtons($buttons, $map);
    if ($body === '') {
        return ''; // 空 rows/空按钮不输出空面板
    }

    $titleRaw = substitute($card['title'] ?? '', $map);
    // MyCard 的标题字号在其 Init() 里写死 13，Title 属性改不动；
    // 自定义字号时把大标题放进 MyCard.Inlines（卡片头，参考 PCL2-NewsHomepage 的 BetaNotice 写法）。
    // 标题必须在卡片头而不能画在正文里——正文收起（CanSwap 折叠）时会整块隐藏，
    // 画在正文里的标题会跟着消失。Inlines 属于卡片头，收起后仍然可见。
    $tfs = (int)($card['title_font_size'] ?? 0);
    if ($tfs > 0 && $titleRaw !== '') {
        $tfs = max(8, min($tfs, 200));
        // 正文顶距按标题字号放大，给更高的标题行让位（13 号时正好是惯例的 40）
        $top = max(40, (int)round($tfs * 1.4 + 22));
        $out  = '    <local:MyCard Margin="0,0,0,15" CanSwap="True">' . "\n";
        $out .= '        <local:MyCard.Inlines><InlineUIContainer><TextBlock Text="' . xesc($titleRaw) . '" FontSize="' . $tfs . '" FontWeight="Bold" Foreground="{DynamicResource ColorBrush3}" /></InlineUIContainer></local:MyCard.Inlines>' . "\n";
        $out .= '        <StackPanel Margin="25,' . $top . ',23,15">' . "\n";
        $out .= $body;
        $out .= '        </StackPanel>' . "\n";
        $out .= '    </local:MyCard>' . "\n";
        return $out;
    }
    $title = xesc($titleRaw);
    $out  = '    <local:MyCard Title="' . $title . '" Margin="0,0,0,15" CanSwap="True">' . "\n";
    $out .= '        <StackPanel Margin="25,40,23,15">' . "\n";
    $out .= $body;
    $out .= '        </StackPanel>' . "\n";
    $out .= '    </local:MyCard>' . "\n";
    return $out;
}

/**
 * 按 sort_order 遍历卡片：server 模板卡展开为每台服务器一张，standalone 卡渲染一次。
 */
function generateXaml($servers, $statuses, $cards, $varRows) {
    $xaml = '<StackPanel>' . "\n";
    foreach ($cards as $card) {
        if ((int)($card['enabled'] ?? 1) !== 1) {
            continue;
        }
        if (($card['kind'] ?? '') === 'server') {
            foreach ($servers as $server) {
                $xaml .= renderCard($card, serverMap($server, $statuses, $varRows));
            }
        } else {
            $xaml .= renderCard($card, globalMap($varRows));
        }
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
