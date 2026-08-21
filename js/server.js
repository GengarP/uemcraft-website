/* ============================================================
   server.js — 服务器状态（动态多服务器）
   API: https://api.uemcraft.cn/api/java/{address}
   数据源: /api/servers.php?action=list
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const serverSection = document.getElementById('serverSection');
  const heroIndicator = document.getElementById('heroIndicator');
  const heroStatus    = document.getElementById('heroStatus');

  if (!serverSection && !heroStatus) return;

  const EXTERNAL_API = 'https://api.uemcraft.cn/api/java/';
  let servers = [];
  let statusCache = {}; // address -> status data

  // ---- 获取服务器列表 ----
  async function loadServers() {
    try {
      const res = await fetch('/api/servers.php?action=list');
      const json = await res.json();
      if (json.success && json.data && json.data.length) {
        servers = json.data;
      }
    } catch (e) {
      console.warn('Failed to load servers:', e.message);
    }
  }

  // ---- 查询单台服务器状态 ----
  async function fetchStatus(address) {
    try {
      const res = await fetch(EXTERNAL_API + encodeURIComponent(address));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (json.status === 'success') {
        return json;
      }
      return { online: false };
    } catch (e) {
      return { online: false };
    }
  }

  // ---- 查询所有服务器状态 ----
  async function refreshAll() {
    const promises = servers.map(async (srv) => {
      const status = await fetchStatus(srv.address);
      statusCache[srv.address] = status;
      return { server: srv, status };
    });
    return Promise.all(promises);
  }

  // ---- 渲染首页服务器面板 ----
  function renderServerPanels(results) {
    if (!serverSection) return;
    const container = serverSection.querySelector('.container');
    if (!container) return;

    // 保留 section-head
    const sectionHead = container.querySelector('.section-head');

    // 清空旧面板
    const oldPanels = container.querySelectorAll('.server-panel');
    oldPanels.forEach(p => p.remove());

    results.forEach(({ server, status }) => {
      const online = !!(status && status.online);
      const version = status && status.version ? status.version : '';
      const players = online ? ((status.players && status.players.online) || 0) : 0;
      const maxPlayers = online ? ((status.players && status.players.max) || 0) : 0;
      const motd = status && status.motd ? status.motd : '';
      const playerList = online && status.players && status.players.list ? status.players.list : [];

      const panel = document.createElement('div');
      panel.className = 'server-panel reveal';
      panel.innerHTML =
        '<div class="server-indicator' + (online ? '' : ' is-offline') + '"></div>' +
        '<div class="server-info">' +
        '  <div class="server-header">' +
        '    <span class="server-title">' + escapeHtml(server.name) + (server.note ? ' <small class="text-muted">(' + escapeHtml(server.note) + ')</small>' : '') + '</span>' +
        '  </div>' +
        '  <div class="server-addr-row">' +
        '    <code class="server-address">' + escapeHtml(server.address) + '</code>' +
        '    <button class="btn btn-ghost btn-sm btn-copy" data-addr="' + escapeHtml(server.address) + '" title="复制地址">复制</button>' +
        '    <div class="server-stats">' +
        '      <div class="server-stat player-stat-wrap">' +
        '        <span class="sval">' + (online ? players + ' / ' + maxPlayers : '离线') + '</span>' +
        '        <span class="slbl">在线 / 最大</span>' +
        (playerList.length ?
          '        <div class="player-tooltip"><ul class="player-list">' +
          playerList.map(function(n) { return '<li>' + escapeHtml(typeof n === 'object' ? n.name : n) + '</li>'; }).join('') +
          '</ul></div>' : '') +
        '      </div>' +
        '      <div class="server-stat">' +
        '        <span class="sval">' + (online ? escapeHtml(version) : '--') + '</span>' +
        '        <span class="slbl">版本</span>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        (motd ? '  <div class="server-motd">' + motd.replace(/\n/g, '<br>') + '</div>' : '') +
        '</div>';

      container.appendChild(panel);
    });

    // 绑定复制按钮
    container.querySelectorAll('.btn-copy[data-addr]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var addr = btn.getAttribute('data-addr');
        copyText(addr).then(function() {
          btn.textContent = '已复制';
          setTimeout(function() { btn.textContent = '复制'; }, 2000);
        }).catch(function() {
          btn.textContent = '失败';
          setTimeout(function() { btn.textContent = '复制'; }, 2000);
        });
      });
    });
  }

  // ---- 更新 Hero 徽章（置顶服务器） ----
  function updateHeroBadge(results) {
    if (!heroStatus) return;

    // 找置顶服务器，否则取第一个
    var featured = null;
    for (var i = 0; i < results.length; i++) {
      if (results[i].server.is_featured) { featured = results[i]; break; }
    }
    if (!featured && results.length) featured = results[0];
    if (!featured) {
      heroStatus.textContent = '暂无服务器';
      return;
    }

    var online = !!(featured.status && featured.status.online);
    var players = online ? ((featured.status.players && featured.status.players.online) || 0) : 0;
    var version = featured.status && featured.status.version ? featured.status.version : '';

    if (heroIndicator) heroIndicator.classList.toggle('is-offline', !online);
    heroStatus.textContent = online
      ? players + ' 人在线 · ' + version
      : featured.server.name + ' 离线';
  }

  // ---- 主流程 ----
  async function init() {
    await loadServers();

    if (servers.length === 0) {
      // 没有配置服务器，显示占位
      if (serverSection) {
        var container = serverSection.querySelector('.container');
        if (container) {
          var oldPanels = container.querySelectorAll('.server-panel');
          oldPanels.forEach(function(p) { p.remove(); });
          var placeholder = document.createElement('div');
          placeholder.className = 'server-panel reveal';
          placeholder.innerHTML = '<div class="server-info"><p class="text-muted" style="text-align:center;">暂未配置服务器，请在管理后台添加</p></div>';
          container.appendChild(placeholder);
        }
      }
      if (heroStatus) heroStatus.textContent = '暂未配置服务器';
      return;
    }

    await doRefresh();

    // 自动刷新 60s
    setInterval(doRefresh, 60000);
  }

  async function doRefresh() {
    var results = await refreshAll();
    renderServerPanels(results);
    updateHeroBadge(results);
  }

  // ---- 工具 ----
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
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
