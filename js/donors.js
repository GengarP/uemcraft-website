/* ============================================================
   donors.js — 捐赠者页（/donors/）
   从 /api/donations.php?action=list 加载公开名单（仅昵称），
   按月分组渲染。公开接口不含金额，页面也绝不渲染金额。
   ============================================================ */
(function () {
  'use strict';

  var API_URL = '../api/donations.php';

  var listEl = document.getElementById('donorList');
  if (!listEl) return;

  function escapeHtml(str) {
    if (window.UEMUtils && UEMUtils.escapeHtml) return UEMUtils.escapeHtml(str);
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* '2026-10' → '2026 年 10 月' */
  function formatMonth(month) {
    var parts = String(month).split('-');
    return parts[0] + ' 年 ' + parseInt(parts[1], 10) + ' 月';
  }

  /* 当前月份 'YYYY-MM' */
  function currentMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
  }

  function renderEmpty(html) {
    listEl.innerHTML = '<div class="wall-empty">' + html + '</div>';
  }

  function renderStats(data) {
    var months = {};
    var thisMonth = currentMonth();
    var thisMonthCount = 0;
    for (var i = 0; i < data.length; i++) {
      months[data[i].month] = true;
      if (data[i].month === thisMonth) thisMonthCount++;
    }
    var statTotal = document.getElementById('statTotal');
    var statMonths = document.getElementById('statMonths');
    var statThisMonth = document.getElementById('statThisMonth');
    if (statTotal) statTotal.textContent = String(data.length);
    if (statMonths) statMonths.textContent = String(Object.keys(months).length);
    if (statThisMonth) statThisMonth.textContent = String(thisMonthCount);
  }

  /* 按月分组渲染（服务端已按 month DESC 排序） */
  function renderMonths(data) {
    var groups = [];
    var index = {};
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      if (!index[item.month]) {
        index[item.month] = { month: item.month, names: [] };
        groups.push(index[item.month]);
      }
      // 同月同名去重，保证「N 人」是人数
      if (index[item.month].names.indexOf(item.donor_name) === -1) {
        index[item.month].names.push(item.donor_name);
      }
    }

    var html = '';
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      var chips = '';
      for (var n = 0; n < group.names.length; n++) {
        chips += '<span class="donor-chip">' + escapeHtml(group.names[n]) + '</span>';
      }
      html += '<section class="donor-month">'
            + '<div class="donor-month-head">'
            + '<h3 class="donor-month-title">' + formatMonth(group.month) + '</h3>'
            + '<span class="donor-month-count">' + group.names.length + ' 人</span>'
            + '</div>'
            + '<div class="donor-chips">' + chips + '</div>'
            + '</section>';
    }
    listEl.innerHTML = html;
  }

  function loadDonors() {
    fetch(API_URL + '?action=list')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json || !json.success || !Array.isArray(json.data)) {
          renderEmpty('加载失败，请刷新重试');
          return;
        }
        renderStats(json.data);
        if (json.data.length === 0) {
          renderEmpty('暂无捐赠记录，敬请期待');
          return;
        }
        renderMonths(json.data);
      })
      .catch(function () {
        renderEmpty('加载失败，请刷新重试');
      });
  }

  loadDonors();
})();
