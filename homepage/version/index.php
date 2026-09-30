<?php
// PCL2 联网主页版本检查源。PCL 加载主页前先请求 /homepage/version（落在本目录索引），
// 内容不变就直接用本地缓存，内容改变才重新下载主页 XAML。
// 主页 XAML 含实时服务器状态，版本号按 10 分钟分桶变化：状态不会太旧，又限制重复下载。
// 若主机不支持目录索引/不跟随 301，可在主机面板把 /homepage/version 反代/重写到本文件。
ini_set('display_errors', '0');
while (ob_get_level() > 0) { if (!@ob_end_clean()) break; }
header('Content-Type: text/plain; charset=utf-8');
echo date('Y-m-d H:i', intdiv(time(), 600) * 600);
