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

  function loadMaps() {
    fetch(API + '?action=maps')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success) throw new Error(json.error || '加载失败');
        maps = json.data || [];
        var select = document.getElementById('mapSelect');
        select.innerHTML = '';
        if (maps.length === 0) {
          document.getElementById('rankingStatus').textContent = '暂无已发布的排行榜';
          return;
        }
        maps.forEach(function (m) {
          var opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.display_name + (m.close_at ? '（已封榜）' : '');
          select.appendChild(opt);
        });
        currentMapId = maps[0].id;
        select.value = currentMapId;
        loadRanking(1);
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

        var map = json.map;
        var meta = document.getElementById('mapMeta');
        meta.textContent = map.display_name + '，共 ' + json.total + ' 名玩家' + (map.close_at ? '，已封榜' : '');

        var tbody = document.getElementById('rankingBody');
        if (!json.data || json.data.length === 0) {
          status.textContent = '暂无成绩';
          return;
        }
        status.textContent = '';

        var html = '';
        json.data.forEach(function (r) {
          html += '<tr>';
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
    var select = document.getElementById('mapSelect');
    if (select) {
      select.addEventListener('change', function () {
        currentMapId = parseInt(select.value, 10);
        loadRanking(1);
      });
    }

    var prev = document.getElementById('prevPage');
    var next = document.getElementById('nextPage');
    if (prev) prev.addEventListener('click', function () { if (currentPage > 1) loadRanking(currentPage - 1); });
    if (next) next.addEventListener('click', function () { loadRanking(currentPage + 1); });

    loadMaps();
  });
})();
PY