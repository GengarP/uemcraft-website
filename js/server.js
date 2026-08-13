/* ============================================================
   server.js — 服务器状态
   API: https://api.uemcraft.cn/api/java
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const playersEl   = document.getElementById('serverPlayers');
  const verEl       = document.getElementById('serverVer');
  const motdEl      = document.getElementById('serverMotd');
  const indicatorEl = document.getElementById('serverIndicator');
  const refreshBtn  = document.getElementById('refreshServer');

  // Hero badge elements (index page)
  const heroIndicator = document.getElementById('heroIndicator');
  const heroStatus    = document.getElementById('heroStatus');

  if (!playersEl && !heroStatus) return; // No server elements on this page

  const API = 'https://api.uemcraft.cn/api/java/play.uemcraft.cn';

  function updateUI(data) {
    const online = !!(data.online);
    const version = data.version || '';
    const players = online ? (data.players?.online ?? 0) : 0;
    const maxPlayers = online ? (data.players?.max ?? 0) : 0;
    const motd = data.motd || '';

    // Online indicator
    if (indicatorEl) {
      indicatorEl.classList.toggle('is-offline', !online);
    }

    // Players
    if (playersEl) {
      playersEl.textContent = online
        ? `${players} / ${maxPlayers}`
        : '离线';
    }

    // Player list tooltip
    const listEl = document.getElementById('playerList');
    if (listEl) {
      const list = data.players?.list || [];
      if (online && list.length) {
        listEl.innerHTML = list.map(n => `<li>${typeof n === 'object' ? n.name : n}</li>`).join('');
      } else {
        listEl.innerHTML = '';
      }
    }

    // Version
    if (verEl) {
      verEl.textContent = online ? version : '--';
    }

    // MOTD
    if (motdEl) {
      motdEl.innerHTML = online ? motd.replace(/\n/g, '<br>') : '';
    }

    // Hero badge
    if (heroIndicator) {
      heroIndicator.classList.toggle('is-offline', !online);
    }
    if (heroStatus) {
      heroStatus.textContent = online
        ? `${players} 人在线 · ${version}`
        : '服务器离线';
    }

  }

  async function refresh() {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.error || 'Server offline');
      updateUI(json);
    } catch (err) {
      console.warn('Server status fetch failed:', err.message);
      updateUI({ online: false });
    }

    // Brief pulse animation on refresh button
    if (refreshBtn) {
      refreshBtn.style.transform = 'rotate(180deg)';
      refreshBtn.style.transition = 'transform .4s ease';
      setTimeout(() => { refreshBtn.style.transform = ''; }, 400);
    }
  }

  // Initial load
  refresh();

  // Refresh button
  refreshBtn?.addEventListener('click', refresh);

  // Auto-refresh every 60s
  setInterval(refresh, 60000);

  // Copy address
  const copyBtn = document.getElementById('copyAddr');
  copyBtn?.addEventListener('click', () => {
    const addr = 'play.uemcraft.cn';
    const copy = (text) => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
      }
      // fallback for http / file://
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); return Promise.resolve(); }
      catch(e) { return Promise.reject(e); }
      finally { document.body.removeChild(ta); }
    };
    copy(addr).then(() => {
      copyBtn.textContent = '已复制';
      setTimeout(() => { copyBtn.textContent = '复制'; }, 2000);
    }).catch(() => {
      copyBtn.textContent = '失败';
      setTimeout(() => { copyBtn.textContent = '复制'; }, 2000);
    });
  });

});
