(function () {
  'use strict';

  var API = '../api/parkour.php';
  var currentPage = 1;
  var currentMapId = null;
  var maps = [];

  function escapeHtml(text) {
    var u = window.UEMUtils;
    return u ? u.escapeHtml(text) : (function () {
      var d = document.createElement('div');
      d.textContent = text || '';
      return d.innerHTML;
    })();
  }

  function formatMs(ms) {
    ms = Math.max(0, parseInt(ms, 10) || 0);
    var minutes = Math.floor(ms / 60000);
    var seconds = Math.floor((ms % 60000) / 1000);
    var millis = ms % 1000;
    return String(minutes).padStart(2, '0') + ':' +
      String(seconds).padStart(2, '0') + '.' +
      String(millis).padStart(3, '0');
  }

  function formatTs(ts) {
    if (!ts) return '-';
    var d = new Date(ts * 1000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  /* ---- 选择地图：更新芯片高亮、信息条，并重新加载榜单 ---- */
  function selectMap(id) {
    currentMapId = id;

    var chips = document.querySelectorAll('.parkour-chip');
    for (var i = 0; i < chips.length; i++) {
      var on = parseInt(chips[i].getAttribute('data-id'), 10) === parseInt(id, 10);
      chips[i].classList.toggle('is-active', on);
      chips[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }

    var map = null;
    for (var j = 0; j < maps.length; j++) {
      if (parseInt(maps[j].id, 10) === parseInt(id, 10)) { map = maps[j]; break; }
    }
    var info = document.getElementById('mapInfo');
    if (info && map) {
      document.getElementById('mapInfoName').textContent = map.display_name;
      var stats = '记录 <strong>' + (map.record_count || 0) + '</strong> - 玩家 <strong>' + (map.player_count || 0) + '</strong>';
      if (map.best_time_ms) stats += ' - 最佳 <strong>' + formatMs(map.best_time_ms) + '</strong>';
      if (map.close_at) stats += ' - 已封榜';
      document.getElementById('mapInfoStats').innerHTML = stats;
      info.style.display = '';
    }

    loadRanking(1);
  }

  function loadMaps() {
    fetch(API + '?action=maps')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success) throw new Error(json.error || '加载失败');
        maps = json.data || [];
        var wrap = document.getElementById('mapChips');
        if (!wrap) return;
        if (maps.length === 0) {
          document.getElementById('rankingStatus').textContent = '暂无已发布的排行榜';
          return;
        }
        var html = '';
        maps.forEach(function (m) {
          html += '<button type="button" class="parkour-chip" role="tab" aria-selected="false" data-id="' + m.id + '">';
          html += '<span class="parkour-chip-name">' + escapeHtml(m.display_name) + '</span>';
          if (m.close_at) html += '<span class="parkour-chip-tag">已封榜</span>';
          html += '</button>';
        });
        wrap.innerHTML = html;
        selectMap(maps[0].id);
      })
      .catch(function (e) {
        document.getElementById('rankingStatus').textContent = e.message || '加载失败';
      });
  }

  function loadRanking(page) {
    currentPage = page;
    var status = document.getElementById('rankingStatus');
    status.textContent = '正在加载排行榜…';
    document.getElementById('rankingBody').innerHTML = '';

    fetch(API + '?action=ranking&map_id=' + encodeURIComponent(currentMapId) + '&page=' + page + '&limit=50')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success) throw new Error(json.error || '加载失败');

        var tbody = document.getElementById('rankingBody');
        if (!json.data || json.data.length === 0) {
          status.textContent = '暂无成绩';
          return;
        }
        status.textContent = '';

        var html = '';
        json.data.forEach(function (r) {
          // 排行榜统一进入跑酷玩家详情页；个人主页入口放在详情页的「访问主页」按钮
          var topClass = r.rank <= 3 ? ' class="is-top' + r.rank + '"' : '';
          html += '<tr' + topClass + '>';
          html += '<td class="rank-cell">' + r.rank + '</td>';
          html += '<td><a class="parkour-player-link" href="player.html?uuid=' + encodeURIComponent(r.player_uuid) + '">';
          html += '<img class="parkour-avatar" src="' + escapeHtml(r.avatar_url) + '" alt="">';
          html += '<span>' + escapeHtml(r.player_name) + '</span>';
          html += '</a></td>';
          html += '<td>' + formatMs(r.time_ms) + '</td>';
          html += '<td>' + r.deaths + '</td>';
          html += '<td>' + formatTs(r.achieved_at) + '</td>';
          html += '</tr>';
        });
        tbody.innerHTML = html;

        var pag = document.getElementById('pagination');
        if (json.pages > 1) {
          pag.style.display = '';
          document.getElementById('pageInfo').textContent = '第 ' + json.page + ' / ' + json.pages + ' 页';
          document.getElementById('prevPage').disabled = json.page <= 1;
          document.getElementById('nextPage').disabled = json.page >= json.pages;
        } else {
          pag.style.display = 'none';
        }
      })
      .catch(function (e) {
        status.textContent = e.message || '加载失败';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var chips = document.getElementById('mapChips');
    if (chips) {
      chips.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.parkour-chip') : null;
        if (!btn) return;
        selectMap(parseInt(btn.getAttribute('data-id'), 10));
      });
    }

    var prev = document.getElementById('prevPage');
    var next = document.getElementById('nextPage');
    if (prev) prev.addEventListener('click', function () { if (currentPage > 1) loadRanking(currentPage - 1); });
    if (next) next.addEventListener('click', function () { loadRanking(currentPage + 1); });

    loadMaps();
  });
})();
