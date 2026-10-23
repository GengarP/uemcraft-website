(function () {
  'use strict';

  var API = '../api/parkour.php';

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

  function getUuid() {
    var params = new URLSearchParams(window.location.search);
    return params.get('uuid') || '';
  }

  function renderTrend(trend) {
    var wrap = document.getElementById('trendWrap');
    if (!trend || trend.length === 0) {
      wrap.innerHTML = '<div class="wall-empty">暂无趋势数据</div>';
      return;
    }

    var width = 720;
    var height = 220;
    var padding = 32;
    var ranks = trend.map(function (t) { return t.rank_at_time; });
    var maxRank = Math.max.apply(null, ranks);
    maxRank = Math.max(maxRank, 2);

    var points = trend.map(function (t, i) {
      var x = padding + (i / Math.max(1, trend.length - 1)) * (width - padding * 2);
      var y = padding + ((t.rank_at_time - 1) / (maxRank - 1)) * (height - padding * 2);
      return { x: x, y: y, t: t };
    });

    var path = points.map(function (p, i) {
      return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
    }).join(' ');

    var svg = '<svg class="parkour-trend-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="排名趋势">';
    svg += '<line x1="' + padding + '" y1="' + padding + '" x2="' + padding + '" y2="' + (height - padding) + '" stroke="currentColor" opacity=".3"/>';
    svg += '<line x1="' + padding + '" y1="' + (height - padding) + '" x2="' + (width - padding) + '" y2="' + (height - padding) + '" stroke="currentColor" opacity=".3"/>';
    svg += '<path d="' + path + '" fill="none" stroke="var(--c-primary)" stroke-width="2"/>';
    points.forEach(function (p) {
      svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="var(--c-primary)">';
      svg += '<title>' + escapeHtml(p.t.map_name) + ' · 第 ' + p.t.rank_at_time + ' 名 · ' + formatMs(p.t.time_ms) + '</title>';
      svg += '</circle>';
    });
    svg += '</svg>';
    svg += '<p class="text-muted">纵轴为排名（越靠上越好），横轴为达成时间顺序。</p>';
    wrap.innerHTML = svg;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var uuid = getUuid();
    if (!uuid) {
      document.getElementById('playerStatus').textContent = '缺少玩家参数';
      return;
    }

    fetch(API + '?action=player&uuid=' + encodeURIComponent(uuid))
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success) throw new Error(json.error || '加载失败');

        var p = json.player;
        var s = json.summary;

        document.getElementById('playerTitle').textContent = p.player_name;
        document.getElementById('playerCrumb').textContent = p.player_name;
        document.getElementById('playerSub').textContent = '跑酷玩家数据';
        document.getElementById('playerStatus').style.display = 'none';

        var card = document.getElementById('playerCard');
        card.style.display = '';
        document.getElementById('playerAvatar').src = p.avatar_url;
        document.getElementById('playerAvatar').alt = p.player_name;
        document.getElementById('playerName').textContent = p.player_name;
        document.getElementById('playerSummary').textContent =
          '参与地图：' + s.maps_played + ' · 最好名次：' + (s.best_rank ? '第 ' + s.best_rank + ' 名' : '-') +
          ' · 冠军：' + s.top1_count + ' 次 · 前三：' + s.top3_count + ' 次 · 前十：' + s.top10_count + ' 次' +
          (s.best_map ? ' · 表现最好的地图：' + s.best_map.display_name : '');

        var mapBody = document.getElementById('mapBody');
        var mapHtml = '';
        (json.maps || []).forEach(function (m) {
          mapHtml += '<tr>';
          mapHtml += '<td>' + escapeHtml(m.display_name) + '</td>';
          mapHtml += '<td>' + formatMs(m.best_time_ms) + '</td>';
          mapHtml += '<td>' + m.best_deaths + '</td>';
          mapHtml += '<td>第 ' + m.rank + ' 名</td>';
          mapHtml += '<td>' + m.player_record_count + '</td>';
          mapHtml += '</tr>';
        });
        mapBody.innerHTML = mapHtml || '<tr><td colspan="5">暂无数据</td></tr>';

        renderTrend(json.trend || []);

        var trendBody = document.getElementById('trendBody');
        var trendHtml = '';
        (json.trend || []).forEach(function (t) {
          trendHtml += '<tr>';
          trendHtml += '<td>' + escapeHtml(t.map_name) + '</td>';
          trendHtml += '<td>' + formatMs(t.time_ms) + '</td>';
          trendHtml += '<td>' + t.deaths + '</td>';
          trendHtml += '<td>第 ' + t.rank_at_time + ' 名</td>';
          trendHtml += '<td>' + formatTs(t.achieved_at) + '</td>';
          trendHtml += '</tr>';
        });
        trendBody.innerHTML = trendHtml || '<tr><td colspan="5">暂无数据</td></tr>';
      })
      .catch(function (e) {
        document.getElementById('playerStatus').textContent = e.message || '加载失败';
      });
  });
})();
PY