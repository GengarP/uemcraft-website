/* ============================================================
   server.js — 服务器状态（动态多服务器，批量 SSE 流式查询）
   API: POST /api/servers.php?action=batch_query（后端代理，隐藏真实 IP）
   数据源: /api/servers.php?action=list
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const serverSection = document.getElementById('serverSection');
  const heroIndicator = document.getElementById('heroIndicator');
  const heroStatus    = document.getElementById('heroStatus');
  const heroServerName = document.getElementById('heroServerName');
  const heroPlayers   = document.getElementById('heroPlayers');
  const heroVersion   = document.getElementById('heroVersion');
  const heroLatency   = document.getElementById('heroLatency');

  if (!serverSection && !heroStatus) return;

  const BATCH_API = '/api/servers.php?action=batch_query';
  const QUERY_TIMEOUT = 30000; // 30 秒超时（批量查询整体）

  let servers = [];
  let statusCache = {};       // address -> status data
  let activeController = null; // 当前活跃的 AbortController
  let isRefreshing = false;    // 刷新锁

  // ---- 阶段进度映射 ----
  var PHASE_MAP = {
    dns:        { label: '正在解析 DNS…',    pct: 15 },
    srv:        { label: '正在查找 SRV…',    pct: 25 },
    connect:    { label: '正在连接…',        pct: 40 },
    handshake:  { label: '正在握手…',        pct: 55 },
    status:     { label: '正在获取状态…',    pct: 70 },
    ping:       { label: '正在测延迟…',      pct: 85 },
    done:       { label: '查询完成',         pct: 100 }
  };

  // ---- 获取服务器列表 ----
  async function loadServers() {
    try {
      const res = await fetch('/api/servers.php?action=list');
      const json = await res.json();
      console.log('[server.js] API response:', json);
      if (json.success && json.data && json.data.length) {
        servers = json.data;
      }
    } catch (e) {
      console.warn('[server.js] Failed to load servers:', e.message);
    }
  }

  // ---- 解析 SSE 文本流 ----
  function parseSSELine(line) {
    if (line.startsWith('event: ')) {
      return { type: 'event', value: line.slice(7).trim() };
    }
    if (line.startsWith('data: ')) {
      return { type: 'data', value: line.slice(6) };
    }
    return null;
  }

  // ---- 批量 SSE 流式查询 ----
  async function fetchBatchStreaming(servers, onServerEvent, onServerResult, onServerError) {
    var controller = new AbortController();
    activeController = controller;

    var body = {
      ids: servers.map(function(srv) { return srv.id; })
    };

    try {
      var res = await fetch(BATCH_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      var currentEvent = null;

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop(); // 保留不完整的行

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();

          if (line === '') {
            // 空行 = 事件结束，重置
            currentEvent = null;
            continue;
          }

          var parsed = parseSSELine(line);
          if (!parsed) continue;

          if (parsed.type === 'event') {
            currentEvent = parsed.value;
          } else if (parsed.type === 'data' && currentEvent) {
            try {
              var data = JSON.parse(parsed.value);
              switch (currentEvent) {
                case 'server_event':
                  onServerEvent(data);
                  break;
                case 'server_result':
                  onServerResult(data);
                  break;
                case 'server_error':
                  onServerError(data);
                  break;
              }
            } catch (_) { /* ignore parse errors */ }
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('[server.js] Batch query aborted');
      } else {
        console.warn('[server.js] Batch query failed:', e.message);
        // 标记所有服务器为离线
        servers.forEach(function(srv) {
          onServerError({ index: servers.indexOf(srv), ip: srv.address, error: e.message, online: false });
        });
      }
    } finally {
      activeController = null;
    }
  }

  // ---- 取消当前查询 ----
  function cancelActiveQuery() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  // ---- 更新卡片进度条 ----
  function updateCardProgress(address, pct, label) {
    var container = serverSection ? serverSection.querySelector('.container') : null;
    if (!container) return;
    var card = container.querySelector('.server-card[data-address="' + CSS.escape(address) + '"]');
    if (!card) return;
    var fill = card.querySelector('.server-card-progress-fill');
    var text = card.querySelector('.server-card-progress-text');
    if (fill && pct != null) fill.style.width = pct + '%';
    if (text && label) text.textContent = label;
  }

  // ---- 渲染加载态骨架卡片 ----
  function renderServerCardSkeleton(server) {
    var card = document.createElement('div');
    card.className = 'server-card is-loading';
    card.setAttribute('data-address', server.address);

    var addrDisplay = escapeHtml(server.address) + (server.port ? ':' + server.port : '');
    var noteHtml = server.note ? ' <span class="server-card-note">' + escapeHtml(server.note) + '</span>' : '';
    var editionLabel = server.edition === 'bedrock' ? '基岩版' : 'Java 版';

    card.innerHTML =
      '<div class="server-card-header">' +
      '  <div class="server-card-favicon server-card-favicon-empty" aria-hidden="true"></div>' +
      '  <div class="server-card-title-area">' +
      '    <div class="server-card-name-row">' +
      '      <h3 class="server-card-name">' + escapeHtml(server.name) + noteHtml + '</h3>' +
      '      <span class="server-card-badge is-loading">查询中</span>' +
      '    </div>' +
      '    <div class="server-card-addr">' +
      '      <code class="server-card-address">' + addrDisplay + '</code>' +
      '      <span class="server-card-edition">' + editionLabel + '</span>' +
      '      <button class="server-card-copy" data-addr="' + escapeHtml(server.address) + (server.port ? ' -p ' + server.port : '') + '" title="复制地址">复制</button>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '<div class="server-card-progress">' +
      '  <div class="server-card-progress-bar"><div class="server-card-progress-fill" style="width:5%"></div></div>' +
      '  <div class="server-card-progress-text">正在开始…</div>' +
      '</div>' +
      '<div class="server-card-stats">' +
      '  <div class="server-card-stat">' +
      '    <span class="stat-val">--</span>' +
      '    <span class="stat-label">在线 / 最大</span>' +
      '  </div>' +
      '  <div class="server-card-stat">' +
      '    <span class="stat-val">--</span>' +
      '    <span class="stat-label">延迟</span>' +
      '  </div>' +
      '  <div class="server-card-stat">' +
      '    <span class="stat-val">--</span>' +
      '    <span class="stat-label">版本</span>' +
      '  </div>' +
      '</div>';

    return card;
  }

  // ---- 渲染单张完整卡片 ----
  function renderSingleCard(server, status) {
    var online = !!(status && status.online);
    var version = status && status.version ? status.version : '';
    var players = online ? ((status.players && status.players.online) || 0) : 0;
    var maxPlayers = online ? ((status.players && status.players.max) || 0) : 0;
    var motd = status && status.motd ? status.motd : '';
    var playerList = online && status.players && status.players.list ? status.players.list : [];
    var latency = online && status.latency != null ? status.latency : null;
    var favicon = online && status.favicon ? status.favicon : '';
    var addrDisplay = escapeHtml(server.address) + (server.port ? ':' + server.port : '');
    var noteHtml = server.note ? ' <span class="server-card-note">' + escapeHtml(server.note) + '</span>' : '';
    var editionLabel = server.edition === 'bedrock' ? '基岩版' : 'Java 版';

    var card = document.createElement('div');
    card.className = 'server-card' + (online ? '' : ' is-offline');
    card.setAttribute('data-address', server.address);
    card.innerHTML =
      '<div class="server-card-header">' +
      (favicon
        ? '<img class="server-card-favicon" src="' + favicon + '" alt="" width="48" height="48">'
        : '<div class="server-card-favicon server-card-favicon-empty" aria-hidden="true"></div>') +
      '  <div class="server-card-title-area">' +
      '    <div class="server-card-name-row">' +
      '      <h3 class="server-card-name">' + escapeHtml(server.name) + noteHtml + '</h3>' +
      '      <span class="server-card-badge ' + (online ? 'is-online' : 'is-offline') + '">' +
               (online ? '在线' : '离线') +
      '      </span>' +
      '    </div>' +
      '    <div class="server-card-addr">' +
      '      <code class="server-card-address">' + addrDisplay + '</code>' +
      '      <span class="server-card-edition">' + editionLabel + '</span>' +
      '      <button class="server-card-copy" data-addr="' + escapeHtml(server.address) + (server.port ? ' -p ' + server.port : '') + '" title="复制地址">复制</button>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      (motd ? '<div class="server-card-motd">' + parseMotd(motd) + '</div>' : '<div class="server-card-motd server-card-motd-empty">暂无 MOTD</div>') +
      '<div class="server-card-stats">' +
      '  <div class="server-card-stat player-stat-wrap">' +
      '    <span class="stat-val">' + (online ? players + ' / ' + maxPlayers : '--') + '</span>' +
      '    <span class="stat-label">在线 / 最大</span>' +
      '    <div class="player-tooltip"><ul class="player-list">' +
         (playerList.length ? playerList.map(function(n) { return '<li>' + escapeHtml(typeof n === 'object' ? n.name : n) + '</li>'; }).join('') : '') +
         '</ul></div>' +
      '  </div>' +
      '  <div class="server-card-stat">' +
      '    <span class="stat-val ' + (latency != null ? 'server-latency ' + latencyClass(latency) : '') + '">' + (latency != null ? latency + ' ms' : '--') + '</span>' +
      '    <span class="stat-label">延迟</span>' +
      '  </div>' +
      '  <div class="server-card-stat">' +
      '    <span class="stat-val">' + (online ? escapeHtml(version) : '--') + '</span>' +
      '    <span class="stat-label">版本</span>' +
      '  </div>' +
      '</div>';

    return card;
  }

  // ---- 替换骨架卡片为完整卡片 ----
  function replaceSkeletonWithCard(container, server, status) {
    var skeleton = container.querySelector('.server-card[data-address="' + CSS.escape(server.address) + '"]');
    var newCard = renderSingleCard(server, status);
    if (skeleton) {
      container.replaceChild(newCard, skeleton);
    } else {
      container.appendChild(newCard);
    }
    // 绑定复制按钮
    var copyBtn = newCard.querySelector('.server-card-copy[data-addr]');
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        var addr = copyBtn.getAttribute('data-addr');
        copyText(addr).then(function() {
          copyBtn.textContent = '已复制';
          copyBtn.classList.add('is-copied');
          setTimeout(function() { copyBtn.textContent = '复制'; copyBtn.classList.remove('is-copied'); }, 2000);
        }).catch(function() {
          copyBtn.textContent = '失败';
          setTimeout(function() { copyBtn.textContent = '复制'; }, 2000);
        });
      });
    }
  }

  // ---- 更新 Hero 信息条 ----
  function updateHeroBadge(server, status) {
    if (!heroStatus) return;

    var online = !!(status && status.online);
    var players = online ? ((status.players && status.players.online) || 0) : 0;
    var maxPlayers = online ? ((status.players && status.players.max) || 0) : 0;
    var version = status && status.version ? status.version : '';
    var latency = online && status.latency != null ? status.latency : null;

    if (heroIndicator) heroIndicator.classList.toggle('is-offline', !online);
    if (heroServerName) heroServerName.textContent = server.name || '服务器';
    heroStatus.textContent = online ? '在线' : '离线';
    if (heroPlayers) heroPlayers.textContent = online ? players + ' / ' + maxPlayers : '--';
    if (heroVersion) heroVersion.textContent = online && version ? version : '--';
    if (heroLatency) heroLatency.textContent = latency != null ? latency + ' ms' : '--';
  }

  // ---- 渲染首页服务器卡片骨架 ----
  function renderSkeletons() {
    if (!serverSection) return;
    var container = serverSection.querySelector('.container');
    if (!container) return;

    // 清空旧卡片
    var oldCards = container.querySelectorAll('.server-card');
    oldCards.forEach(function(c) { c.remove(); });

    // 为每台服务器渲染骨架
    servers.forEach(function(srv) {
      var skeleton = renderServerCardSkeleton(srv);
      container.appendChild(skeleton);
    });

    // 绑定复制按钮
    container.querySelectorAll('.server-card-copy[data-addr]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var addr = btn.getAttribute('data-addr');
        copyText(addr).then(function() {
          btn.textContent = '已复制';
          btn.classList.add('is-copied');
          setTimeout(function() { btn.textContent = '复制'; btn.classList.remove('is-copied'); }, 2000);
        }).catch(function() {
          btn.textContent = '失败';
          setTimeout(function() { btn.textContent = '复制'; }, 2000);
        });
      });
    });
  }

  // ---- 流式查询所有服务器 ----
  async function refreshAll() {
    if (isRefreshing) return;
    isRefreshing = true;

    // 取消上一轮查询
    cancelActiveQuery();

    var container = serverSection ? serverSection.querySelector('.container') : null;
    var featuredServer = servers.find(function(s) { return s.is_featured; }) || servers[0];
    var featuredAddr = featuredServer ? featuredServer.address : null;

    if (container) {
      // 渲染骨架卡片
      renderSkeletons();
    }

    // Hero 状态设为查询中
    if (heroStatus) heroStatus.textContent = '查询中…';
    if (heroPlayers) heroPlayers.textContent = '--';
    if (heroVersion) heroVersion.textContent = '--';
    if (heroLatency) heroLatency.textContent = '--';

    // 构建 index -> server 映射
    var serverByIndex = {};

    await fetchBatchStreaming(
      servers,
      // onServerEvent — 更新进度
      function(data) {
        var idx = data.index;
        var srv = serverByIndex[idx] || servers[idx];
        if (!srv) return;
        var phase = data.event || (data.data && data.data.phase);
        var info = PHASE_MAP[phase];
        if (info) {
          updateCardProgress(srv.address, info.pct, info.label);
        }
      },
      // onServerResult — 查询成功
      function(data) {
        var idx = data.index;
        var srv = serverByIndex[idx] || servers[idx];
        if (!srv) return;
        statusCache[srv.address] = data;

        // 替换骨架卡片
        if (container) {
          replaceSkeletonWithCard(container, srv, data);
        }

        // 置顶服务器查询完成后立即更新 Hero
        if (srv.address === featuredAddr) {
          updateHeroBadge(srv, data);
        }
      },
      // onServerError — 查询失败
      function(data) {
        var idx = data.index;
        var srv = serverByIndex[idx] || servers[idx];
        if (!srv) return;
        var failStatus = { online: false };
        statusCache[srv.address] = failStatus;

        // 替换骨架卡片（离线态）
        if (container) {
          replaceSkeletonWithCard(container, srv, failStatus);
        }

        // 置顶服务器也更新 Hero
        if (srv.address === featuredAddr) {
          updateHeroBadge(srv, failStatus);
        }
      }
    );

    isRefreshing = false;
  }

  // ---- 主流程 ----
  async function init() {
    await loadServers();

    if (servers.length === 0) {
      // 没有配置服务器，显示占位
      if (serverSection) {
        var container = serverSection.querySelector('.container');
        if (container) {
          var oldCards = container.querySelectorAll('.server-card');
          oldCards.forEach(function(c) { c.remove(); });
          var placeholder = document.createElement('div');
          placeholder.className = 'server-card';
          placeholder.innerHTML = '<div class="server-card-header"><div class="server-card-favicon server-card-favicon-empty" aria-hidden="true"></div><div class="server-card-title-area"><div class="server-card-name-row"><h3 class="server-card-name">暂未配置服务器</h3></div><p class="text-muted" style="margin:var(--space-xs) 0 0;font-size:var(--fs-sm);">请在管理后台添加服务器</p></div></div>';
          container.appendChild(placeholder);
        }
      }
      if (heroServerName) heroServerName.textContent = '暂未配置';
      if (heroStatus) heroStatus.textContent = '';
      if (heroPlayers) heroPlayers.textContent = '--';
      if (heroVersion) heroVersion.textContent = '--';
      if (heroLatency) heroLatency.textContent = '--';
      return;
    }

    await refreshAll();

    // 自动刷新 60s
    setInterval(refreshAll, 60000);
  }

  // ---- 工具 ----
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // ---- 延迟等级样式 ----
  function latencyClass(ms) {
    if (ms <= 100) return 'latency-good';
    if (ms <= 300) return 'latency-ok';
    return 'latency-bad';
  }

  // ---- MOTD § 颜色代码解析 ----
  var MC_COLOR_MAP = {
    '0': 'mc-color-0', '1': 'mc-color-1', '2': 'mc-color-2', '3': 'mc-color-3',
    '4': 'mc-color-4', '5': 'mc-color-5', '6': 'mc-color-6', '7': 'mc-color-7',
    '8': 'mc-color-8', '9': 'mc-color-9', 'a': 'mc-color-a', 'b': 'mc-color-b',
    'c': 'mc-color-c', 'd': 'mc-color-d', 'e': 'mc-color-e', 'f': 'mc-color-f'
  };

  function parseMotd(raw) {
    if (!raw) return '';
    var text = escapeHtml(raw);
    text = text.replace(/\n/g, '<br>');
    var result = '';
    var openSpans = 0;
    var i = 0;
    while (i < text.length) {
      if (text[i] === '§' || (text[i] === '&' && i + 1 < text.length && /[0-9a-fk-or]/i.test(text[i + 1]))) {
        var code = text[i + 1].toLowerCase();
        if (MC_COLOR_MAP[code]) {
          if (openSpans > 0) { result += '</span>'; openSpans--; }
          result += '<span class="' + MC_COLOR_MAP[code] + '">';
          openSpans++;
        } else if (code === 'l') {
          result += '<span class="mc-bold">';
          openSpans++;
        } else if (code === 'o') {
          result += '<span class="mc-italic">';
          openSpans++;
        } else if (code === 'n') {
          result += '<span class="mc-underline">';
          openSpans++;
        } else if (code === 'm') {
          result += '<span class="mc-strikethrough">';
          openSpans++;
        } else if (code === 'r') {
          while (openSpans > 0) { result += '</span>'; openSpans--; }
        }
        i += 2;
      } else {
        result += text[i];
        i++;
      }
    }
    while (openSpans > 0) { result += '</span>'; openSpans--; }
    return result;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); return Promise.resolve(); }
    catch (e) { return Promise.reject(e); }
    finally { document.body.removeChild(ta); }
  }

  init();
});
