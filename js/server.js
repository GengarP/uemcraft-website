/* ============================================================
   server.js — 服务器状态（动态多服务器，SSE 流式查询）
   API: https://api.uemcraft.cn/mc-query/api/stream/java/{address}
   数据源: /api/servers.php?action=list
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const serverSection = document.getElementById('serverSection');
  const heroIndicator = document.getElementById('heroIndicator');
  const heroStatus    = document.getElementById('heroStatus');

  if (!serverSection && !heroStatus) return;

  const EXTERNAL_API = 'https://api.uemcraft.cn/mc-query/api/stream/java/';
  const QUERY_TIMEOUT = 15000; // 15 秒超时

  let servers = [];
  let statusCache = {};       // address -> status data
  let activeStreams = [];      // 当前活跃的 EventSource 实例
  let isRefreshing = false;    // 刷新锁

  // ---- 阶段进度映射 ----
  var PHASE_MAP = {
    start:      { label: '正在开始…',       pct: 5  },
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

  // ---- SSE 流式查询单台服务器 ----
  function fetchStatusStreaming(address, port, cardEl) {
    return new Promise(function(resolve) {
      var url = EXTERNAL_API + encodeURIComponent(address);
      if (port) url += '?port=' + port;

      var es = new EventSource(url);
      activeStreams.push(es);
      var settled = false;

      // 超时保护
      var timer = setTimeout(function() {
        if (!settled) {
          settled = true;
          es.close();
          removeStream(es);
          updateCardProgress(cardEl, null, '查询超时');
          resolve({ online: false });
        }
      }, QUERY_TIMEOUT);

      // phase 事件 — 更新进度
      es.addEventListener('phase', function(e) {
        try {
          var data = JSON.parse(e.data);
          var info = PHASE_MAP[data.phase];
          if (info && cardEl) {
            updateCardProgress(cardEl, info.pct, info.label);
          }
        } catch (_) { /* ignore parse errors */ }
      });

      // result 事件 — 查询完成
      es.addEventListener('result', function(e) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        es.close();
        removeStream(es);
        try {
          var data = JSON.parse(e.data);
          if (data.status === 'success') {
            resolve(data);
          } else {
            resolve({ online: false });
          }
        } catch (_) {
          resolve({ online: false });
        }
      });

      // error 事件 — 连接错误（EventSource 会自动重试，但我们直接关闭）
      es.addEventListener('error', function() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        es.close();
        removeStream(es);
        resolve({ online: false });
      });
    });
  }

  function removeStream(es) {
    var idx = activeStreams.indexOf(es);
    if (idx !== -1) activeStreams.splice(idx, 1);
  }

  // ---- 关闭所有活跃的 SSE 连接 ----
  function closeAllStreams() {
    activeStreams.forEach(function(es) {
      try { es.close(); } catch (_) { /* ignore */ }
    });
    activeStreams = [];
  }

  // ---- 更新卡片进度条 ----
  function updateCardProgress(cardEl, pct, label) {
    if (!cardEl) return;
    var fill = cardEl.querySelector('.server-card-progress-fill');
    var text = cardEl.querySelector('.server-card-progress-text');
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

  // ---- 渲染单张完整卡片（原地替换骨架） ----
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

  // ---- 更新 Hero 徽章 ----
  function updateHeroBadge(server, status) {
    if (!heroStatus) return;

    var online = !!(status && status.online);
    var players = online ? ((status.players && status.players.online) || 0) : 0;
    var version = status && status.version ? status.version : '';

    if (heroIndicator) heroIndicator.classList.toggle('is-offline', !online);
    heroStatus.textContent = online
      ? players + ' 人在线 · ' + version
      : server.name + ' 离线';
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

    // 关闭上一轮的 SSE 连接
    closeAllStreams();

    if (!serverSection) {
      // 无服务器区域（仅 Hero），直接查询置顶服务器
      var featured = servers.find(function(s) { return s.is_featured; }) || servers[0];
      if (featured) {
        var status = await fetchStatusStreaming(featured.address, featured.port, null);
        statusCache[featured.address] = status;
        updateHeroBadge(featured, status);
      }
      isRefreshing = false;
      return;
    }

    // 渲染骨架卡片
    renderSkeletons();

    // Hero 状态设为查询中
    if (heroStatus) heroStatus.textContent = '查询中…';

    var container = serverSection.querySelector('.container');
    var featuredAddr = null;
    var featuredServer = servers.find(function(s) { return s.is_featured; }) || servers[0];
    if (featuredServer) featuredAddr = featuredServer.address;

    // 并行查询所有服务器（逐个更新卡片）
    var promises = servers.map(function(srv) {
      return fetchStatusStreaming(srv.address, srv.port, null).then(function(status) {
        statusCache[srv.address] = status;

        // 替换骨架卡片
        if (container) {
          replaceSkeletonWithCard(container, srv, status);
        }

        // 置顶服务器查询完成后立即更新 Hero
        if (srv.address === featuredAddr) {
          updateHeroBadge(srv, status);
        }

        return { server: srv, status: status };
      });
    });

    await Promise.all(promises);
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
      if (heroStatus) heroStatus.textContent = '暂未配置服务器';
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
