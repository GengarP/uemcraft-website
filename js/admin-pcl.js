/* ============================================================
   admin-pcl.js — PCL 主页卡片设计器（列表 + 变量 + 设计器）
   页面：
     admin/pcl-cards.html       卡片列表 + 变量管理 tab
     admin/pcl-cards-edit.html  卡片设计器（行/按钮编辑 + XAML 预览）
   依赖：admin-auth.js（window.UEMAdminAuth）
   ============================================================ */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  var API = '/api/pcl.php';

  /* ---- 常量（与 api/pcl.php 白名单一致） ---- */
  var EVENT_TYPES = [
    'None', '打开网页', '打开文件', '打开帮助', '执行命令', '启动游戏', '复制文本',
    '刷新主页', '刷新页面', '刷新帮助', '今日人品', '内存优化', '清理垃圾',
    '弹出窗口', '弹出提示', '切换页面', '导入整合包', '安装整合包', '下载文件',
    '修改设置', '写入设置', '修改变量', '写入变量', '加入房间', '检查更新'
  ];
  var COLOR_TYPES = ['Normal', 'Highlight', 'Red'];
  var HINT_THEMES = ['Blue', 'Red', 'Yellow', 'Green'];
  var BLOCK_ICONS = [
    'CommandBlock.png', 'Cobblestone.png', 'GoldBlock.png', 'Grass.png', 'GrassPath.png',
    'Anvil.png', 'RedstoneBlock.png', 'RedstoneLampOn.png', 'RedstoneLampOff.png',
    'Egg.png', 'Fabric.png', 'NeoForge.png'
  ];
  // {%key%} 键空间：server 卡可用全部，standalone 卡只可用变量部分
  var SERVER_KEYS = [
    ['name', '服务器名'], ['address', '地址（已掩码）'], ['port', '端口'], ['address_port', '地址:端口'],
    ['edition', '版本类型 java/bedrock'], ['note', '备注'], ['status', '在线/离线'], ['status_color', '状态色值'],
    ['players_online', '在线人数'], ['players_max', '最大人数'], ['players', '人数 x / y'],
    ['version', '游戏版本'], ['latency', '延迟'], ['motd', 'MOTD']
  ];
  // 全局键：时间 + 新闻 5 条 + 活动 3 条（键名与 homepage/index.php 的 buildDynamicMap 严格一致）
  var GLOBAL_KEYS = [
    ['year', '当前年份'], ['month', '当前月（01-12）'], ['day', '当前日（01-31）'], ['hour', '当前时（00-23）'],
    ['minute', '当前分（00-59）'], ['date', '当前日期（Y-m-d）'], ['time', '当前时间（H:i）'], ['weekday', '星期几'],
    ['news_1_title', '新闻1标题'], ['news_1_date', '新闻1日期'], ['news_1_excerpt', '新闻1摘要'], ['news_1_url', '新闻1链接'],
    ['news_2_title', '新闻2标题'], ['news_2_date', '新闻2日期'], ['news_2_excerpt', '新闻2摘要'], ['news_2_url', '新闻2链接'],
    ['news_3_title', '新闻3标题'], ['news_3_date', '新闻3日期'], ['news_3_excerpt', '新闻3摘要'], ['news_3_url', '新闻3链接'],
    ['news_4_title', '新闻4标题'], ['news_4_date', '新闻4日期'], ['news_4_excerpt', '新闻4摘要'], ['news_4_url', '新闻4链接'],
    ['news_5_title', '新闻5标题'], ['news_5_date', '新闻5日期'], ['news_5_excerpt', '新闻5摘要'], ['news_5_url', '新闻5链接'],
    ['event_1_title', '活动1标题'], ['event_1_date', '活动1日期'], ['event_1_status', '活动1状态'], ['event_1_link', '活动1链接'],
    ['event_2_title', '活动2标题'], ['event_2_date', '活动2日期'], ['event_2_status', '活动2状态'], ['event_2_link', '活动2链接'],
    ['event_3_title', '活动3标题'], ['event_3_date', '活动3日期'], ['event_3_status', '活动3状态'], ['event_3_link', '活动3链接']
  ];
  var BUTTON_ALIGN_OPTS = [['', '默认（左组）'], ['left', '左组'], ['right', '右组（贴右）']];

  /* ============================================================
     通用工具
     ============================================================ */

  function esc(s) {
    return Auth && Auth.escapeHtml ? Auth.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
  }

  function showMessage(text, ok) {
    var el = document.getElementById('formMessage') || document.getElementById('pageMessage');
    if (!el) return;
    el.textContent = text;
    el.className = 'wall-form-message ' + (ok ? 'is-success' : 'is-error');
    el.style.display = 'block';
    if (ok) setTimeout(function () { el.style.display = 'none'; }, 2500);
  }

  function confirmDelete(what) {
    return window.confirm('确定删除' + what + '吗？此操作不可恢复。');
  }


  /** Auth.api + success 检查：业务失败（如校验 400）时 reject，走 catch 提示 */
  function apiOk(url, options) {
    return Auth.api(url, options).then(function (res) {
      if (!res || !res.success) {
        throw new Error((res && res.error) || '未知错误');
      }
      return res;
    });
  }

  /* ============================================================
     变量（供列表页 tab 与设计器插入器共用）
     ============================================================ */

  var varsCache = [];

  function loadVars(cb) {
    apiOk(API + '?action=var_list').then(function (res) {
      varsCache = (res && res.data) || [];
      if (cb) cb(varsCache);
    }).catch(function (e) {
      console.error('变量加载失败', e);
      if (cb) cb([]);
    });
  }

  /* ============================================================
     列表页：admin/pcl-cards.html
     ============================================================ */

  function initListPage() {
    var cardsWrap = document.getElementById('cardsList');
    if (!cardsWrap) return;

    // tab 切换
    var tabs = document.querySelectorAll('.admin-tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (t) {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        document.getElementById('tab-cards').classList.toggle('is-active', tab.dataset.tab === 'cards');
        document.getElementById('tab-vars').classList.toggle('is-active', tab.dataset.tab === 'vars');
      });
    });

    loadCards();
    loadVars(renderVars);
    document.getElementById('varAddBtn').addEventListener('click', function () {
      renderVarRow(null); // 追加一张空白编辑卡
    });
  }

  function loadCards() {
    var wrap = document.getElementById('cardsList');
    apiOk(API + '?action=card_list').then(function (res) {
      var rows = (res && res.data) || [];
      var cnt = document.getElementById('cardCount');
      if (cnt) cnt.textContent = rows.length;
      if (!rows.length) {
        wrap.innerHTML = '<div class="wall-loading">还没有卡片，点右上角「新建卡片」开始设计。</div>';
        return;
      }
      wrap.innerHTML = rows.map(function (c) {
        return '<div class="admin-card" data-id="' + c.id + '">'
          + '<div class="admin-card-body">'
          + '<div class="admin-card-title">' + esc(c.name) + '</div>'
          + '<div class="admin-card-meta">'
          + '<span class="admin-badge ' + (c.kind === 'server' ? 'admin-badge-edition is-java' : 'admin-badge-edition is-bedrock') + '">'
          + (c.kind === 'server' ? '模板卡' : '独立卡') + '</span>'
          + '<span class="admin-badge ' + (c.enabled ? 'is-approved' : 'is-hidden') + '">'
          + (c.enabled ? '已启用' : '已停用') + '</span>'
          + (+c.bare ? '<span class="admin-badge">无外壳</span>' : '')
          + (c.kind === 'server' && +c.merge_servers ? '<span class="admin-badge">合并</span>' : '')
          + '<span class="text-muted">排序 ' + c.sort_order + '</span>'
          + '<span class="text-muted">标题 ' + esc(c.title || '（空）') + '</span>'
          + '</div></div>'
          + '<div class="admin-card-actions">'
          + '<a class="btn btn-ghost btn-sm" href="pcl-cards-edit.html?id=' + c.id + '">编辑</a>'
          + '<button type="button" class="btn btn-ghost btn-sm admin-btn-danger btn-del-card">删除</button>'
          + '</div></div>';
      }).join('');

      Array.prototype.forEach.call(wrap.querySelectorAll('.btn-del-card'), function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.closest('.admin-card').dataset.id;
          if (!confirmDelete('这张卡片')) return;
          apiOk(API + '?action=card_delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: +id }) })
            .then(loadCards).catch(function (e) { showMessage('删除失败：' + e.message, false); });
        });
      });
    }).catch(function (e) {
      wrap.innerHTML = '<div class="wall-loading">加载失败：' + esc(e.message) + '</div>';
    });
  }

  function renderVars(list) {
    var wrap = document.getElementById('varsList');
    if (!wrap) return;
    var cnt = document.getElementById('varCount');
    if (cnt) cnt.textContent = list.length;
    if (!list.length) {
      wrap.innerHTML = '<div class="wall-loading">还没有自定义变量。</div>';
      return;
    }
    wrap.innerHTML = '';
    list.forEach(function (v) { renderVarRow(v); });
  }

  /** 变量行内编辑卡；传 null 时为新建空白行 */
  function renderVarRow(v) {
    var wrap = document.getElementById('varsList');
    if (!wrap) return;
    if (wrap.querySelector('.wall-loading')) wrap.innerHTML = '';
    var isNew = !v;
    var el = document.createElement('div');
    el.className = 'admin-card';
    el.innerHTML = '<div class="admin-card-body">'
      + '<div class="form-row">'
      + '<div class="form-group"><label class="form-label">键名 {%key%}</label>'
      + '<input type="text" class="form-input v-key" value="' + esc(v ? v.var_key : '') + '" placeholder="字母/数字/下划线"></div>'
      + '<div class="form-group"><label class="form-label">说明</label>'
      + '<input type="text" class="form-input v-label" value="' + esc(v ? v.var_label : '') + '"></div>'
      + '<div class="form-group form-group-grow"><label class="form-label">值</label>'
      + '<input type="text" class="form-input v-value" value="' + esc(v ? v.var_value : '') + '" maxlength="500"></div>'
      + '<div class="form-group"><label class="form-label">排序</label>'
      + '<input type="number" class="form-input v-sort" value="' + (v ? v.sort_order : 0) + '"></div>'
      + '</div></div>'
      + '<div class="admin-card-actions">'
      + '<button type="button" class="btn btn-primary btn-sm v-save">' + (isNew ? '添加' : '保存') + '</button>'
      + (isNew
          ? '<button type="button" class="btn btn-ghost btn-sm v-cancel">取消</button>'
          : '<button type="button" class="btn btn-ghost btn-sm admin-btn-danger v-del">删除</button>')
      + '</div>';
    wrap.appendChild(el);

    function collect() {
      return {
        id: v ? v.id : undefined,
        var_key: el.querySelector('.v-key').value.trim(),
        var_label: el.querySelector('.v-label').value.trim(),
        var_value: el.querySelector('.v-value').value,
        sort_order: +el.querySelector('.v-sort').value || 0
      };
    }

    el.querySelector('.v-save').addEventListener('click', function () {
      var data = collect();
      if (!data.var_key) { showMessage('键名不能为空', false); return; }
      var action = v ? 'var_update' : 'var_create';
      apiOk(API + '?action=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function () {
          showMessage('已保存', true);
          loadVars(renderVars);
        }).catch(function (e) { showMessage('保存失败：' + e.message, false); });
    });
    var del = el.querySelector('.v-del');
    if (del) {
      del.addEventListener('click', function () {
        if (!confirmDelete('这个变量')) return;
        apiOk(API + '?action=var_delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: v.id }) })
          .then(function () { loadVars(renderVars); })
          .catch(function (e) { showMessage('删除失败：' + e.message, false); });
      });
    }
    var cancel = el.querySelector('.v-cancel');
    if (cancel) {
      cancel.addEventListener('click', function () {
        el.remove();
        if (!wrap.children.length) renderVars(varsCache);
      });
    }
  }

  /* ============================================================
     设计器页：admin/pcl-cards-edit.html
     ============================================================ */

  var editId = null;
  var state = { name: '', kind: 'server', title: '', title_font_size: 0, bare: 0, merge_servers: 0, buttons_align: 'left', enabled: 1, sort_order: 0, rows: [], buttons: [] };

  /* ---- 预览示例值：全局键一份 + 每台服务器一份 ----
     news_3..5 / event_2..3 故意缺省，演示 hide_if_empty 藏行 */
  var SAMPLE_GLOBAL = (function () {
    var d = new Date();
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return {
      year: String(d.getFullYear()),
      month: pad(d.getMonth() + 1), day: pad(d.getDate()),
      hour: pad(d.getHours()), minute: pad(d.getMinutes()),
      date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      time: pad(d.getHours()) + ':' + pad(d.getMinutes()),
      weekday: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()],
      news_1_title: '迎新建筑大赛开启', news_1_date: '2026-01-02',
      news_1_excerpt: '快来参加一年一度的建筑大赛！', news_1_url: 'https://uemcraft.cn/news/build-contest',
      news_2_title: '服务器 1.21 升级公告', news_2_date: '2025-12-20',
      news_2_excerpt: '本周六维护升级到 1.21。', news_2_url: 'https://uemcraft.cn/news/upgrade-121',
      event_1_title: '建筑大赛', event_1_date: '2026-01-10 ~ 01-20', event_1_status: 'upcoming',
      event_1_link: 'https://uemcraft.cn/events/'
    };
  })();
  var SAMPLE_SERVER_LIST = [
    {
      name: '生存服', address: 'play.***.cn', port: '25565', address_port: 'play.***.cn:25565',
      edition: 'java', note: '欢迎加入', status: '在线', status_color: '#4CAF50',
      players_online: '3', players_max: '20', players: '3 / 20', version: '1.21.1', latency: '42ms',
      motd: '§bUEMCraft §6生存服务器'
    },
    {
      name: '空岛服', address: 'sky.***.cn', port: '25565', address_port: 'sky.***.cn:25565',
      edition: 'java', note: '挑战极限', status: '离线', status_color: '#F44336',
      players_online: '', players_max: '', players: '- / -', version: 'java', latency: '超时', motd: ''
    }
  ];
  var sampleVarMap = {};

  function globalSampleMap() {
    var m = {};
    Object.keys(SAMPLE_GLOBAL).forEach(function (k) { m[k] = SAMPLE_GLOBAL[k]; });
    Object.keys(sampleVarMap).forEach(function (k) { m[k] = sampleVarMap[k]; });
    return m;
  }
  function serverSampleMap(idx) {
    var m = globalSampleMap();
    var s = SAMPLE_SERVER_LIST[idx % SAMPLE_SERVER_LIST.length] || {};
    Object.keys(s).forEach(function (k) { m[k] = s[k]; });
    return m;
  }

  function initEditPage() {
    var form = document.getElementById('cardForm');
    if (!form) return;

    loadVars(function (vars) {
      vars.forEach(function (v) { sampleVarMap[v.var_key] = v.var_value || v.var_key; });
      fillInserters();
      renderRows();
      renderButtons();
      updatePreview();
    });

    syncMergeVisibility();

    editId = new URLSearchParams(location.search).get('id');
    if (editId) {
      apiOk(API + '?action=card_detail&id=' + editId).then(function (res) {
        var c = res.data;
        state.name = c.name; state.kind = c.kind; state.title = c.title;
        state.title_font_size = +c.title_font_size || 0;
        state.bare = +c.bare || 0;
        state.merge_servers = +c.merge_servers || 0;
        state.buttons_align = c.buttons_align || 'left';
        state.enabled = c.enabled; state.sort_order = c.sort_order;
        state.rows = safeJson(c.rows_json, []);
        state.buttons = safeJson(c.buttons_json, []);
        document.getElementById('fName').value = state.name;
        document.getElementById('fKind').value = state.kind;
        document.getElementById('fTitle').value = state.title;
        document.getElementById('fTitleSize').value = state.title_font_size || '';
        document.getElementById('fBare').value = String(state.bare);
        document.getElementById('fMerge').value = String(state.merge_servers);
        document.getElementById('fButtonsAlign').value = state.buttons_align;
        document.getElementById('fEnabled').value = String(state.enabled);
        document.getElementById('fSort').value = state.sort_order;
        document.getElementById('pageTitle').textContent = '编辑卡片';
        document.getElementById('crumbLeaf').textContent = '编辑卡片';
        syncMergeVisibility();
        renderRows(); renderButtons(); updatePreview();
      }).catch(function (e) { showMessage('加载卡片失败：' + e.message, false); });
    }

    ['fName', 'fKind', 'fTitle', 'fTitleSize', 'fBare', 'fMerge', 'fButtonsAlign', 'fEnabled', 'fSort'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () {
        state.name = document.getElementById('fName').value;
        state.kind = document.getElementById('fKind').value;
        state.title = document.getElementById('fTitle').value;
        state.title_font_size = +document.getElementById('fTitleSize').value || 0;
        state.bare = +document.getElementById('fBare').value ? 1 : 0;
        state.buttons_align = document.getElementById('fButtonsAlign').value || 'left';
        state.enabled = +document.getElementById('fEnabled').value;
        state.sort_order = +document.getElementById('fSort').value || 0;
        if (id === 'fKind') {
          syncMergeVisibility();
          if (state.kind !== 'server') document.getElementById('fMerge').value = '0';
          fillInserters(); renderRows(); renderButtons();
        }
        state.merge_servers = state.kind === 'server' ? (+document.getElementById('fMerge').value ? 1 : 0) : 0;
        if (id === 'fMerge') { fillInserters(); renderButtons(); }
        updatePreview();
      });
    });

    document.getElementById('addRowBtn').addEventListener('click', function () {
      state.rows.push({ type: 'list_item', logo: 'CommandBlock.png', title: '', info: '' });
      renderRows(); updatePreview();
    });
    document.getElementById('addBtnBtn').addEventListener('click', function () {
      state.buttons.push({ text: '', event_type: '打开网页', event_data: '', color_type: 'Normal' });
      renderButtons(); updatePreview();
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      collect();
      if (!state.name.trim()) { showMessage('内部名称必填', false); return; }
      var payload = {
        id: editId ? +editId : undefined,
        name: state.name.trim(), kind: state.kind, title: state.title,
        title_font_size: state.title_font_size,
        bare: state.bare, merge_servers: state.merge_servers, buttons_align: state.buttons_align,
        rows_json: JSON.stringify(state.rows), buttons_json: JSON.stringify(state.buttons),
        enabled: state.enabled, sort_order: state.sort_order
      };
      var action = editId ? 'card_update' : 'card_create';
      apiOk(API + '?action=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function () {
          showMessage('已保存', true);
          setTimeout(function () { location.href = 'pcl-cards.html'; }, 800);
        }).catch(function (e) { showMessage('保存失败：' + e.message, false); });
    });
  }

  function safeJson(s, dflt) {
    try {
      var v = JSON.parse(s);
      return Array.isArray(v) ? v : dflt;
    } catch (e) { return dflt; }
  }

  /** 合并模式仅 kind=server 有效：独立卡隐藏合并开关 */
  function syncMergeVisibility() {
    var g = document.getElementById('fMergeGroup');
    if (g) g.style.display = state.kind === 'server' ? '' : 'none';
  }

  /* ---- {%key%} 插入器 ---- */

  /**
   * 可用键列表。scope: 'row' | 'title' | 'button'。
   * 合并模式下标题/按钮只用全局映射（按钮只渲染一次、标题不随台变化），过滤服务器键；
   * 内容行逐台渲染，保留服务器键。
   */
  function availableKeys(scope) {
    var keys = [];
    var includeServer = state.kind === 'server' && !(state.merge_servers && scope !== 'row');
    if (includeServer) keys = keys.concat(SERVER_KEYS);
    keys = keys.concat(GLOBAL_KEYS);
    varsCache.forEach(function (v) { keys.push([v.var_key, v.var_label || v.var_key]); });
    return keys;
  }

  function fillInserters() {
    var keys = availableKeys('title');
    Array.prototype.forEach.call(document.querySelectorAll('.insert-select'), function (sel) {
      sel.innerHTML = '<option value="">插入 {%key%}…</option>'
        + keys.map(function (k) {
            return '<option value="{%' + k[0] + '%}">{' + '%' + k[0] + '%} — ' + esc(k[1]) + '</option>';
          }).join('');
    });
  }

  // 事件委托：插入器选择后写入目标输入框
  document.addEventListener('change', function (e) {
    var sel = e.target.closest && e.target.closest('.insert-select');
    if (!sel || !sel.value) return;
    var target = document.getElementById(sel.dataset.target);
    if (target) {
      var pos = target.selectionStart != null ? target.selectionStart : target.value.length;
      target.value = target.value.slice(0, pos) + sel.value + target.value.slice(pos);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.focus();
    } else {
      // 行/按钮字段：插入到同一 .insert-bar 里的输入框，再走 input 事件同步 state
      var bar = sel.closest('.insert-bar');
      var input = bar && bar.querySelector('input.form-input');
      if (input) {
        var pos2 = input.selectionStart != null ? input.selectionStart : input.value.length;
        input.value = input.value.slice(0, pos2) + sel.value + input.value.slice(pos2);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }
    }
    sel.value = '';
  });

  /* ---- 内容行编辑器 ---- */

  function renderRows() {
    var wrap = document.getElementById('rowsWrap');
    wrap.innerHTML = state.rows.map(function (row, i) {
      var keys = availableKeys('row');
      function ins(target, field) {
        return '<select class="form-input insert-select" data-row-index="' + i + '" data-field="' + field + '" title="插入 {%key%}">'
          + '<option value="">插入 {%key%}…</option>'
          + keys.map(function (k) { return '<option value="{%' + k[0] + '%}">{' + '%' + k[0] + '%}</option>'; }).join('')
          + '</select>';
      }
      var fields = '';
      if (row.type === 'list_item') {
        fields = '<div class="form-row">'
          + '<div class="form-group"><label class="form-label">图标</label>'
          + '<select class="form-input r-logo-kind" data-index="' + i + '">'
          + '<option value="builtin"' + (row.logo && row.logo.indexOf('://') === -1 ? ' selected' : '') + '>内置方块</option>'
          + '<option value="url"' + (row.logo && row.logo.indexOf('://') !== -1 ? ' selected' : '') + '>图片 URL</option>'
          + '</select></div>'
          + '<div class="form-group"><label class="form-label">&nbsp;</label>'
          + (row.logo && row.logo.indexOf('://') !== -1
              ? '<input type="text" class="form-input r-logo" data-index="' + i + '" value="' + esc(row.logo) + '" placeholder="https://…">'
              : '<select class="form-input r-logo" data-index="' + i + '">'
                + BLOCK_ICONS.map(function (ic) {
                    return '<option value="' + ic + '"' + (row.logo === ic ? ' selected' : '') + '>' + ic + '</option>';
                  }).join('')
                + '<option value=""' + (!row.logo ? ' selected' : '') + '>（无图标）</option></select>')
          + '</div>'
          + '<div class="form-group"><label class="form-label">标题</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-title" data-index="' + i + '" value="' + esc(row.title || '') + '">' + ins(i, 'title') + '</div></div>'
          + '<div class="form-group form-group-grow"><label class="form-label">Info 内容</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-info" data-index="' + i + '" value="' + esc(row.info || '') + '">' + ins(i, 'info') + '</div></div>'
          + '</div>'
          + '<div class="form-row"><div class="form-group"><label class="form-label">点击事件</label>'
          + '<select class="form-input r-click-type" data-index="' + i + '">'
          + '<option value=""' + (!row.clickable ? ' selected' : '') + '>无（不可点击）</option>'
          + EVENT_TYPES.map(function (et) {
              return '<option value="' + esc(et) + '"' + (row.clickable && row.clickable.event_type === et ? ' selected' : '') + '>' + esc(et) + '</option>';
            }).join('')
          + '</select></div>'
          + (row.clickable
              ? '<div class="form-group form-group-grow"><label class="form-label">事件数据</label>'
                + '<div class="insert-bar"><input type="text" class="form-input r-click-data" data-index="' + i + '" value="' + esc(row.clickable.event_data || '') + '">' + ins(i, 'clickable.event_data') + '</div></div>'
              : '')
          + '</div>'
          + '<div class="form-row"><div class="form-group"><label class="form-label"><input type="checkbox" class="r-hide" data-index="' + i + '"' + (row.hide_if_empty ? ' checked' : '') + '> 所引用的 {%key%} 全为空时隐藏此行</label></div></div>';
      } else if (row.type === 'text') {
        fields = '<div class="form-row">'
          + '<div class="form-group form-group-grow"><label class="form-label">文本（支持 § 颜色码，如 §b蓝色 §l粗体 §r重置）</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-text" data-index="' + i + '" value="' + esc(row.text || '') + '" placeholder="如：{%motd%}">' + ins(i, 'text') + '</div></div>'
          + '<div class="form-group"><label class="form-label">字号（12 辅助 / 15 正文 / 18 标题 / 28 大标题）</label>'
          + '<input type="number" class="form-input r-size" data-index="' + i + '" list="pclFontSizes" value="' + (row.font_size || 12) + '" min="8" max="32"></div>'
          + '<div class="form-group"><label class="form-label">默认颜色（#RRGGBB 或留空默认）</label>'
          + '<input type="text" class="form-input r-color" data-index="' + i + '" value="' + esc(row.color || '') + '" placeholder="#FFCC00"></div>'
          + '</div>'
          + '<div class="form-row"><div class="form-group"><label class="form-label"><input type="checkbox" class="r-hide" data-index="' + i + '"' + (row.hide_if_empty ? ' checked' : '') + '> 所引用的 {%key%} 全为空时隐藏此行</label></div></div>';
      } else if (row.type === 'hint') {
        fields = '<div class="form-row">'
          + '<div class="form-group"><label class="form-label">主题</label>'
          + '<select class="form-input r-theme" data-index="' + i + '">'
          + HINT_THEMES.map(function (t) {
              return '<option value="' + t + '"' + (row.theme === t ? ' selected' : '') + '>' + t + '</option>';
            }).join('')
          + '</select></div>'
          + '<div class="form-group form-group-grow"><label class="form-label">文本</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-text" data-index="' + i + '" value="' + esc(row.text || '') + '">' + ins(i, 'text') + '</div></div>'
          + '</div>'
          + '<div class="form-row"><div class="form-group"><label class="form-label"><input type="checkbox" class="r-hide" data-index="' + i + '"' + (row.hide_if_empty ? ' checked' : '') + '> 所引用的 {%key%} 全为空时隐藏此行</label></div></div>';
      } else if (row.type === 'status_dot') {
        fields = '<div class="form-row"><div class="form-group text-muted">输出「圆角方块 + 在线/离线」状态行（仅服务器模板卡有效）。</div></div>';
      } else if (row.type === 'header_image') {
        fields = '<div class="form-row">'
          + '<div class="form-group form-group-grow"><label class="form-label">图片地址（URL 或 pack:// URI）</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-src" data-index="' + i + '" value="' + esc(row.src || '') + '" placeholder="https://…">' + ins(i, 'src') + '</div></div>'
          + '<div class="form-group"><label class="form-label">最大高度（px，默认 170）</label>'
          + '<input type="number" class="form-input r-img-h" data-index="' + i + '" value="' + (row.height || '') + '" min="60" max="500"></div>'
          + '<div class="form-group"><label class="form-label">徽章文字（可选，如 {%version%}）</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-badge" data-index="' + i + '" value="' + esc(row.badge || '') + '">' + ins(i, 'badge') + '</div></div>'
          + '</div>'
          + '<div class="form-row"><div class="form-group text-muted">上下 3px 粗线夹图（等比填满裁剪），徽章以圆角 chip 叠在图片右下角。</div></div>'
          + '<div class="form-row"><div class="form-group"><label class="form-label"><input type="checkbox" class="r-hide" data-index="' + i + '"' + (row.hide_if_empty ? ' checked' : '') + '> 所引用的 {%key%} 全为空时隐藏此行</label></div></div>';
      } else if (row.type === 'notice') {
        fields = '<div class="form-row">'
          + '<div class="form-group form-group-grow"><label class="form-label">文本（支持 § 颜色码）</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-text" data-index="' + i + '" value="' + esc(row.text || '') + '" placeholder="如：服务器维护公告">' + ins(i, 'text') + '</div></div>'
          + '</div>'
          + '<div class="form-row"><div class="form-group text-muted">圆角浅底公告横幅（主题色底 + 描边，70% 不透明度）。</div></div>'
          + '<div class="form-row"><div class="form-group"><label class="form-label"><input type="checkbox" class="r-hide" data-index="' + i + '"' + (row.hide_if_empty ? ' checked' : '') + '> 所引用的 {%key%} 全为空时隐藏此行</label></div></div>';
      } else if (row.type === 'footer') {
        fields = '<div class="form-row">'
          + '<div class="form-group form-group-grow"><label class="form-label">文字（自动逐字加空格，如「到底啦」→「到 底 啦」）</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-text" data-index="' + i + '" value="' + esc(row.text != null ? row.text : '到底啦') + '">' + ins(i, 'text') + '</div></div>'
          + '<div class="form-group"><label class="form-label"><input type="checkbox" class="r-thick" data-index="' + i + '"' + (row.thick_border !== false ? ' checked' : '') + '> 底部 8px 厚色条</label></div>'
          + '</div>'
          + '<div class="form-row"><div class="form-group"><label class="form-label"><input type="checkbox" class="r-hide" data-index="' + i + '"' + (row.hide_if_empty ? ' checked' : '') + '> 所引用的 {%key%} 全为空时隐藏此行</label></div></div>';
      } else if (row.type === 'image') {
        fields = '<div class="form-row">'
          + '<div class="form-group form-group-grow"><label class="form-label">图片地址（URL 或 pack:// URI）</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-src" data-index="' + i + '" value="' + esc(row.src || '') + '" placeholder="https://…">' + ins(i, 'src') + '</div></div>'
          + '<div class="form-group"><label class="form-label">宽（px，留空自动）</label>'
          + '<input type="number" class="form-input r-img-w" data-index="' + i + '" value="' + (row.width || '') + '" min="0" max="2000"></div>'
          + '<div class="form-group"><label class="form-label">高（px，留空自动）</label>'
          + '<input type="number" class="form-input r-img-h" data-index="' + i + '" value="' + (row.height || '') + '" min="0" max="2000"></div>'
          + '<div class="form-group"><label class="form-label">缩放</label>'
          + '<select class="form-input r-stretch" data-index="' + i + '">'
          + [['Uniform', '等比（默认）'], ['UniformToFill', '等比填满裁剪'], ['Fill', '拉伸填满'], ['None', '原始尺寸']].map(function (s) {
              return '<option value="' + s[0] + '"' + ((row.stretch || 'Uniform') === s[0] ? ' selected' : '') + '>' + s[1] + '</option>';
            }).join('')
          + '</select></div>'
          + '</div>'
          + '<div class="form-row"><div class="form-group"><label class="form-label"><input type="checkbox" class="r-hide" data-index="' + i + '"' + (row.hide_if_empty ? ' checked' : '') + '> 所引用的 {%key%} 全为空时隐藏此行</label></div></div>';
      } else if (row.type === 'divider') {
        fields = '<div class="form-row">'
          + '<div class="form-group form-group-grow"><label class="form-label">中间文字（可选，填写后变为带字分隔线）</label>'
          + '<div class="insert-bar"><input type="text" class="form-input r-text" data-index="' + i + '" value="' + esc(row.text || '') + '" placeholder="如：历史版本">' + ins(i, 'text') + '</div></div>'
          + '<div class="form-group"><label class="form-label">线宽</label>'
          + '<input type="number" class="form-input r-thickness" data-index="' + i + '" value="' + (row.thickness || 1.5) + '" min="0.5" max="10" step="0.5"></div>'
          + '<div class="form-group"><label class="form-label">不透明度（0-1，留空 1）</label>'
          + '<input type="number" class="form-input r-opacity" data-index="' + i + '" value="' + (row.opacity != null ? row.opacity : '') + '" min="0" max="1" step="0.1"></div>'
          + '<div class="form-group form-group-grow"><label class="form-label">颜色（留空用主题色）</label>'
          + '<input type="text" class="form-input r-div-color" data-index="' + i + '" value="' + esc(row.color || '') + '" placeholder="{DynamicResource ColorBrush4}"></div>'
          + '</div>'
          + '<div class="form-row"><div class="form-group text-muted">放在卡片开头/结尾即可形成卡片之间的分割线。</div></div>';
      }

      return '<div class="row-editor" data-index="' + i + '">'
        + '<div class="row-editor-head">'
        + '<select class="form-input r-type" data-index="' + i + '">'
        + [['list_item', '列表项'], ['text', '文本'], ['hint', '提示'], ['status_dot', '状态点'], ['image', '图片'], ['divider', '分割线'], ['header_image', '头图（三线夹图）'], ['notice', '公告条'], ['footer', '页脚封底']].map(function (t) {
            return '<option value="' + t[0] + '"' + (row.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
          }).join('')
        + '</select>'
        + '<div class="row-editor-ops">'
        + '<button type="button" class="btn btn-ghost btn-sm r-up"' + (i === 0 ? ' disabled' : '') + '>↑</button>'
        + '<button type="button" class="btn btn-ghost btn-sm r-down"' + (i === state.rows.length - 1 ? ' disabled' : '') + '>↓</button>'
        + '<button type="button" class="btn btn-ghost btn-sm admin-btn-danger r-del">删除</button>'
        + '</div></div>'
        + fields
        + '</div>';
    }).join('');
    bindRowEvents();
  }

  function bindRowEvents() {
    var wrap = document.getElementById('rowsWrap');
    wrap.oninput = wrap.onchange = function (e) {
      var t = e.target;
      if (!t.dataset || t.dataset.index == null) return;
      var i = +t.dataset.index;
      var row = state.rows[i];
      if (!row) return;
      if (t.classList.contains('r-type')) { row.type = t.value; renderRows(); }
      else if (t.classList.contains('r-logo-kind')) {
        row.logo = t.value === 'url' ? 'https://' : 'CommandBlock.png';
        renderRows();
      }
      else if (t.classList.contains('r-logo')) row.logo = t.value;
      else if (t.classList.contains('r-title')) row.title = t.value;
      else if (t.classList.contains('r-info')) row.info = t.value;
      else if (t.classList.contains('r-text')) row.text = t.value;
      else if (t.classList.contains('r-size')) row.font_size = +t.value || 12;
      else if (t.classList.contains('r-color')) row.color = t.value;
      else if (t.classList.contains('r-theme')) row.theme = t.value;
      else if (t.classList.contains('r-src')) row.src = t.value;
      else if (t.classList.contains('r-badge')) row.badge = t.value;
      else if (t.classList.contains('r-thick')) row.thick_border = t.checked;
      else if (t.classList.contains('r-img-w')) row.width = +t.value || 0;
      else if (t.classList.contains('r-img-h')) row.height = +t.value || 0;
      else if (t.classList.contains('r-stretch')) row.stretch = t.value;
      else if (t.classList.contains('r-thickness')) row.thickness = +t.value || 1.5;
      else if (t.classList.contains('r-opacity')) row.opacity = t.value === '' ? undefined : +t.value;
      else if (t.classList.contains('r-div-color')) row.color = t.value;
      else if (t.classList.contains('r-hide')) row.hide_if_empty = t.checked;
      else if (t.classList.contains('r-click-type')) {
        if (t.value) row.clickable = { event_type: t.value, event_data: (row.clickable && row.clickable.event_data) || '' };
        else delete row.clickable;
        renderRows();
      }
      else if (t.classList.contains('r-click-data')) {
        if (!row.clickable) row.clickable = { event_type: '复制文本', event_data: '' };
        row.clickable.event_data = t.value;
      }
      updatePreview();
    };
    wrap.onclick = function (e) {
      var btn = e.target.closest('button');
      if (!btn || btn.dataset.index != null && !btn.className.match(/r-(up|down|del)/)) return;
      var editor = btn.closest('.row-editor');
      if (!editor) return;
      var i = +editor.dataset.index;
      if (btn.classList.contains('r-up') && i > 0) {
        var a = state.rows[i - 1]; state.rows[i - 1] = state.rows[i]; state.rows[i] = a;
      } else if (btn.classList.contains('r-down') && i < state.rows.length - 1) {
        var b = state.rows[i + 1]; state.rows[i + 1] = state.rows[i]; state.rows[i] = b;
      } else if (btn.classList.contains('r-del')) {
        state.rows.splice(i, 1);
      } else return;
      renderRows(); updatePreview();
    };
  }

  /* ---- 按钮编辑器 ---- */

  function renderButtons() {
    var wrap = document.getElementById('buttonsWrap');
    wrap.innerHTML = state.buttons.map(function (btn, i) {
      var keys = availableKeys('button');
      function ins(field) {
        return '<select class="form-input insert-select" data-btn-index="' + i + '" data-field="' + field + '" title="插入 {%key%}">'
          + '<option value="">插入 {%key%}…</option>'
          + keys.map(function (k) { return '<option value="{%' + k[0] + '%}">{' + '%' + k[0] + '%}</option>'; }).join('')
          + '</select>';
      }
      var isIcon = btn.style === 'icon_text';
      return '<div class="row-editor" data-index="' + i + '">'
        + '<div class="row-editor-head"><span class="text-muted">按钮 ' + (i + 1) + '</span>'
        + '<div class="row-editor-ops">'
        + '<button type="button" class="btn btn-ghost btn-sm r-up"' + (i === 0 ? ' disabled' : '') + '>↑</button>'
        + '<button type="button" class="btn btn-ghost btn-sm r-down"' + (i === state.buttons.length - 1 ? ' disabled' : '') + '>↓</button>'
        + '<button type="button" class="btn btn-ghost btn-sm admin-btn-danger r-del">删除</button>'
        + '</div></div>'
        + '<div class="form-row">'
        + '<div class="form-group"><label class="form-label">按钮样式</label>'
        + '<select class="form-input b-style" data-index="' + i + '">'
        + '<option value="text"' + (!isIcon ? ' selected' : '') + '>文字按钮</option>'
        + '<option value="icon_text"' + (isIcon ? ' selected' : '') + '>图标文字按钮</option>'
        + '</select></div>'
        + '<div class="form-group"><label class="form-label">按钮文字</label>'
        + '<div class="insert-bar"><input type="text" class="form-input b-text" data-index="' + i + '" value="' + esc(btn.text || '') + '">' + ins('text') + '</div></div>'
        + '<div class="form-group"><label class="form-label">事件类型</label>'
        + '<select class="form-input b-type" data-index="' + i + '">'
        + EVENT_TYPES.map(function (et) {
            return '<option value="' + esc(et) + '"' + (btn.event_type === et ? ' selected' : '') + '>' + esc(et) + '</option>';
          }).join('')
        + '</select></div>'
        + (isIcon ? '' : '<div class="form-group"><label class="form-label">颜色</label>'
        + '<select class="form-input b-color" data-index="' + i + '">'
        + COLOR_TYPES.map(function (ct) {
            return '<option value="' + ct + '"' + (btn.color_type === ct ? ' selected' : '') + '>' + ct + '</option>';
          }).join('')
        + '</select></div>')
        + '</div>'
        + (isIcon
            ? '<div class="form-row">'
              + '<div class="form-group form-group-grow"><label class="form-label">矢量 Path 数据（Logo，如 M8 9.5a1.5 1.5 0 1 0 0-3 …）</label>'
              + '<textarea class="form-input b-logo" data-index="' + i + '" rows="2">' + esc(btn.logo_path || '') + '</textarea></div>'
              + '<div class="form-group"><label class="form-label">图标缩放（0.1-5，默认 1）</label>'
              + '<input type="number" class="form-input b-scale" data-index="' + i + '" value="' + (btn.logo_scale != null && btn.logo_scale !== '' ? btn.logo_scale : '') + '" min="0.1" max="5" step="0.1"></div>'
              + '<div class="form-group"><label class="form-label">ToolTip（可选）</label>'
              + '<input type="text" class="form-input b-tip" data-index="' + i + '" value="' + esc(btn.tooltip || '') + '"></div>'
              + '</div>'
            : '')
        + '<div class="form-row"><div class="form-group form-group-grow"><label class="form-label">事件数据</label>'
        + '<div class="insert-bar"><input type="text" class="form-input b-data" data-index="' + i + '" value="' + esc(btn.event_data || '') + '" placeholder="如 URL / 要复制的文本 / 标题|内容">' + ins('event_data') + '</div></div>'
        + '<div class="form-group"><label class="form-label">宽（px，留空自动）</label>'
        + '<input type="number" class="form-input b-width" data-index="' + i + '" value="' + (btn.width || '') + '" min="0" max="2000"></div>'
        + '<div class="form-group"><label class="form-label">高（px，留空自动）</label>'
        + '<input type="number" class="form-input b-height" data-index="' + i + '" value="' + (btn.height || '') + '" min="0" max="2000"></div>'
        + '<div class="form-group"><label class="form-label">对齐</label>'
        + '<select class="form-input b-align" data-index="' + i + '">'
        + BUTTON_ALIGN_OPTS.map(function (a) {
            return '<option value="' + a[0] + '"' + ((btn.align || '') === a[0] ? ' selected' : '') + '>' + a[1] + '</option>';
          }).join('')
        + '</select></div>'
        + '</div>'
        + '</div>';
    }).join('');
    bindBtnEvents();
  }

  function bindBtnEvents() {
    var wrap = document.getElementById('buttonsWrap');
    wrap.oninput = wrap.onchange = function (e) {
      var t = e.target;
      if (!t.dataset || t.dataset.index == null) return;
      var i = +t.dataset.index;
      var btn = state.buttons[i];
      if (!btn) return;
      if (t.classList.contains('b-text')) btn.text = t.value;
      else if (t.classList.contains('b-type')) btn.event_type = t.value;
      else if (t.classList.contains('b-data')) btn.event_data = t.value;
      else if (t.classList.contains('b-color')) btn.color_type = t.value;
      else if (t.classList.contains('b-width')) btn.width = +t.value || 0;
      else if (t.classList.contains('b-height')) btn.height = +t.value || 0;
      else if (t.classList.contains('b-align')) btn.align = t.value;
      else if (t.classList.contains('b-style')) { btn.style = t.value === 'icon_text' ? 'icon_text' : 'text'; renderButtons(); }
      else if (t.classList.contains('b-logo')) btn.logo_path = t.value;
      else if (t.classList.contains('b-scale')) btn.logo_scale = t.value === '' ? undefined : +t.value;
      else if (t.classList.contains('b-tip')) btn.tooltip = t.value;
      updatePreview();
    };
    wrap.onclick = function (e) {
      var btnEl = e.target.closest('button');
      if (!btnEl) return;
      var editor = btnEl.closest('.row-editor');
      if (!editor) return;
      var i = +editor.dataset.index;
      if (btnEl.classList.contains('r-up') && i > 0) {
        var a = state.buttons[i - 1]; state.buttons[i - 1] = state.buttons[i]; state.buttons[i] = a;
      } else if (btnEl.classList.contains('r-down') && i < state.buttons.length - 1) {
        var b = state.buttons[i + 1]; state.buttons[i + 1] = state.buttons[i]; state.buttons[i] = b;
      } else if (btnEl.classList.contains('r-del')) {
        state.buttons.splice(i, 1);
      } else return;
      renderButtons(); updatePreview();
    };
  }

  /* ---- 保存前收集表单 state（输入事件已实时同步，这里兜底） ---- */

  function collect() {
    state.name = document.getElementById('fName').value;
    state.kind = document.getElementById('fKind').value;
    state.title = document.getElementById('fTitle').value;
    state.title_font_size = +document.getElementById('fTitleSize').value || 0;
    state.bare = +document.getElementById('fBare').value ? 1 : 0;
    state.merge_servers = state.kind === 'server' ? (+document.getElementById('fMerge').value ? 1 : 0) : 0;
    state.buttons_align = document.getElementById('fButtonsAlign').value || 'left';
    state.enabled = +document.getElementById('fEnabled').value;
    state.sort_order = +document.getElementById('fSort').value || 0;
  }

  /* ============================================================
     XAML 预览（JS 侧生成与 homepage/index.php 同构的字符串，示例值替换）
     ============================================================ */

  function xesc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c];
    });
  }

  function xescNl(s) {
    return xesc(s).replace(/\r\n|\r|\n/g, '&#10;');
  }

  var MC_COLORS = {
    '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
    '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
    '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
    'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
  };

  /** Minecraft § 颜色码 → <Run> 串（与 homepage/index.php 的 parseMcRuns 同构）；无码返回 null */
  function parseMcRuns(text) {
    text = String(text == null ? '' : text);
    if (text.indexOf('§') === -1) return null;
    var parts = text.split(/§(.)/);
    var runs = '', buf = '', color = null, bold = false, italic = false, strike = false, under = false;
    var hexPending = 0, hexBuf = '';
    function flush() {
      if (buf === '') return;
      var attrs = '';
      if (color) attrs += ' Foreground="' + xesc(color) + '"';
      if (bold) attrs += ' FontWeight="Bold"';
      if (italic) attrs += ' FontStyle="Italic"';
      var decs = [];
      if (under) decs.push('Underline');
      if (strike) decs.push('Strikethrough');
      if (decs.length) attrs += ' TextDecorations="' + decs.join(',') + '"';
      runs += '<Run Text="' + xescNl(buf) + '"' + attrs + ' />';
      buf = '';
    }
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { buf += parts[i]; continue; }
      var code = parts[i].toLowerCase();
      if (hexPending > 0) {
        hexBuf += code;
        if (--hexPending === 0) { flush(); color = '#' + hexBuf; bold = italic = strike = under = false; }
        continue;
      }
      if (code === 'x') { flush(); hexPending = 6; hexBuf = ''; continue; }
      if (MC_COLORS[code]) { flush(); color = MC_COLORS[code]; bold = italic = strike = under = false; continue; }
      if (code === 'l') { flush(); bold = true; }
      else if (code === 'o') { flush(); italic = true; }
      else if (code === 'm') { flush(); strike = true; }
      else if (code === 'n') { flush(); under = true; }
      else if (code === 'r') { flush(); color = null; bold = italic = strike = under = false; }
    }
    flush();
    return runs === '' ? null : runs;
  }

  function sub(tpl, map) {
    return String(tpl == null ? '' : tpl).replace(/\{%([a-zA-Z0-9_]+)%\}/g, function (_, k) {
      return map && map[k] != null ? map[k] : '';
    });
  }

  /** 逐字插空格（与 homepage/index.php 的 spaceOut 同构） */
  function spaceOut(text) {
    return String(text == null ? '' : text).replace(/(\S)(?=\S)/g, '$1 ');
  }

  /** 带字分隔线（与 homepage/index.php 的 labeledLine 同构），返回行数组 */
  function labeledLine(text, fontSize, stroke, thicknessStr, opacityAttr) {
    function lineAt(col) {
      return '<Line X1="0" X2="100" Stroke="' + stroke + '" StrokeThickness="' + thicknessStr + '" HorizontalAlignment="Center" Stretch="Fill" Grid.Column="' + col + '"' + opacityAttr + ' />';
    }
    return [
      '      <Grid Margin="0,10">',
      '        <Grid.ColumnDefinitions><ColumnDefinition Width="1*" /><ColumnDefinition Width="Auto" /><ColumnDefinition Width="1*" /></Grid.ColumnDefinitions>',
      '        ' + lineAt(0),
      '        <TextBlock Text="' + xesc(text) + '" FontSize="' + fontSize + '" Foreground="' + stroke + '" Grid.Column="1" VerticalAlignment="Center" Margin="12,0" />',
      '        ' + lineAt(2),
      '      </Grid>'
    ];
  }

  function rowEmpty(row, map) {
    if (!row.hide_if_empty) return false;
    var json = JSON.stringify(row);
    var keys = json.match(/\{%([a-zA-Z0-9_]+)%\}/g) || [];
    if (!keys.length) return false;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i].slice(2, -2);
      if (map && map[k] != null && map[k] !== '') return false;
    }
    return true;
  }

  /** 行渲染（不含按钮），与 homepage/index.php 的 renderRowsBody 同构；map 参数化供合并模式逐台替换 */
  function renderRowsInto(arr, map) {
    state.rows.forEach(function (row) {
      if (rowEmpty(row, map)) return;
      if (row.type === 'status_dot') {
        if (state.kind !== 'server') return;
        var color = map.status_color || '#F44336';
        arr.push('      <TextBlock Margin="0,0,0,8" FontSize="14" FontWeight="Bold"><InlineUIContainer><Border Background="' + xesc(color) + '" CornerRadius="2" Height="10" Width="10" Margin="0,0,0,1" /></InlineUIContainer><Run Text=" ' + xesc(map.status) + '" /></TextBlock>');
      } else if (row.type === 'list_item') {
        var logo = row.logo || '';
        var logoAttr = !logo ? '' : (logo.indexOf('://') !== -1
          ? ' Logo="' + xesc(logo) + '"'
          : ' Logo="pack://application:,,,/images/Blocks/' + xesc(logo) + '"');
        var click = '';
        if (row.clickable && row.clickable.event_type) {
          click = ' Type="Clickable" EventType="' + xesc(row.clickable.event_type) + '" EventData="' + xesc(sub(row.clickable.event_data, map)) + '"';
        }
        arr.push('      <local:MyListItem' + logoAttr + ' Title="' + xesc(sub(row.title, map)) + '" Info="' + xesc(sub(row.info, map)) + '"' + click + ' />');
      } else if (row.type === 'text') {
        var colorAttr = row.color ? ' Foreground="' + xesc(row.color) + '"' : '';
        var runs = parseMcRuns(sub(row.text, map));
        if (runs == null) {
          arr.push('      <TextBlock TextWrapping="Wrap" FontSize="' + (row.font_size || 12) + '"' + colorAttr + ' Text="' + xescNl(sub(row.text, map)) + '" />');
        } else {
          arr.push('      <TextBlock TextWrapping="Wrap" FontSize="' + (row.font_size || 12) + '"' + colorAttr + '>' + runs + '</TextBlock>');
        }
      } else if (row.type === 'hint') {
        arr.push('      <local:MyHint Theme="' + xesc(row.theme || 'Blue') + '" Text="' + xesc(sub(row.text, map)) + '" />');
      } else if (row.type === 'image') {
        var src = sub(row.src || '', map);
        if (!src) return;
        var imgAttr = ' Source="' + xesc(src) + '"';
        if (+row.width > 0) imgAttr += ' Width="' + Math.min(+row.width, 2000) + '"';
        if (+row.height > 0) imgAttr += ' Height="' + Math.min(+row.height, 2000) + '"';
        imgAttr += ' Stretch="' + xesc(row.stretch || 'Uniform') + '"';
        arr.push('      <local:MyImage Margin="0,6,0,0"' + imgAttr + ' />');
      } else if (row.type === 'divider') {
        var th = +row.thickness || 1.5;
        if (th > 10) th = 10;
        var stroke = row.color ? xesc(sub(row.color, map)) : '{DynamicResource ColorBrush4}';
        var op = row.opacity == null || row.opacity === '' ? 1 : +row.opacity;
        if (!(op > 0 && op < 1)) op = 1;
        var opAttr = op < 1 ? ' Opacity="' + op + '"' : '';
        var divText = spaceOut(sub(row.text, map));
        if (divText !== '') {
          arr.push.apply(arr, labeledLine(divText, 15, stroke, String(th), opAttr));
        } else {
          arr.push('      <Line X1="0" X2="100" Stroke="' + stroke + '" StrokeThickness="' + th + '" HorizontalAlignment="Center" Stretch="Fill" Margin="4,4"' + opAttr + ' />');
        }
      } else if (row.type === 'header_image') {
        var hdSrc = sub(row.src || '', map);
        if (!hdSrc) return;
        var hh = +row.height || 0;
        if (hh <= 0) hh = 170;
        hh = Math.max(60, Math.min(hh, 500));
        arr.push('      <Grid Margin="0,6,0,0">');
        arr.push('        <StackPanel>');
        arr.push('          <Line X1="0" X2="100" Stroke="{DynamicResource ColorBrush4}" StrokeThickness="3" HorizontalAlignment="Center" Stretch="Fill" />');
        arr.push('          <local:MyImage Source="' + xesc(hdSrc) + '" Stretch="UniformToFill" MaxHeight="' + hh + '" />');
        arr.push('          <Line X1="0" X2="100" Stroke="{DynamicResource ColorBrush4}" StrokeThickness="3" HorizontalAlignment="Center" Stretch="Fill" />');
        arr.push('        </StackPanel>');
        var badge = sub(row.badge || '', map);
        if (badge !== '') {
          arr.push('        <Border Background="{DynamicResource ColorBrush3}" BorderBrush="{DynamicResource ColorBrush2}" BorderThickness="0,0,0,2" CornerRadius="5" Padding="12,3" HorizontalAlignment="Right" VerticalAlignment="Bottom" Margin="0,0,0,-2">');
          arr.push('          <TextBlock Text="' + xesc(badge) + '" FontSize="15" FontWeight="Bold" Foreground="{DynamicResource ColorBrush7}" />');
          arr.push('        </Border>');
        }
        arr.push('      </Grid>');
      } else if (row.type === 'notice') {
        var nRuns = parseMcRuns(sub(row.text, map));
        var tb = nRuns == null
          ? '<TextBlock TextWrapping="Wrap" Margin="10,0" FontSize="12" FontWeight="Bold" Text="' + xescNl(sub(row.text, map)) + '" />'
          : '<TextBlock TextWrapping="Wrap" Margin="10,0" FontSize="12" FontWeight="Bold">' + nRuns + '</TextBlock>';
        arr.push('      <Border Margin="0,6,0,0" Padding="2,8" BorderThickness="1" Background="{DynamicResource ColorBrush5}" BorderBrush="{DynamicResource ColorBrush3}" CornerRadius="5" Opacity="0.7">');
        arr.push('        ' + tb);
        arr.push('      </Border>');
      } else if (row.type === 'footer') {
        var fRaw = row.text != null ? sub(row.text, map) : '到底啦';
        var thick = row.thick_border !== false;
        if (fRaw !== '') {
          arr.push.apply(arr, labeledLine(spaceOut(fRaw), 14, '{DynamicResource ColorBrush4}', '1.5', ''));
        }
        if (thick) {
          arr.push('      <Border BorderThickness="0,0,0,8" BorderBrush="{DynamicResource ColorBrush2}" Margin="0,4,0,0" />');
        }
      }
    });
  }

  /** 单个按钮元素行（与 homepage/index.php 的 renderButtons 条目同构） */
  function buildButtonItem(btn, map, indent) {
    indent = indent || '        ';
    var sizeAttr = '';
    if (+btn.width > 0) sizeAttr += ' Width="' + Math.min(+btn.width, 2000) + '"';
    if (btn.style === 'icon_text') {
      var logo = String(btn.logo_path || '').replace(/^\s+|\s+$/g, '');
      if (!logo) return '';
      if (+btn.height > 0) sizeAttr += ' Height="' + Math.min(+btn.height, 2000) + '"';
      var tip = sub(btn.tooltip || '', map);
      var tipAttr = tip !== '' ? ' ToolTip="' + xesc(tip) + '"' : '';
      var scale = +btn.logo_scale;
      if (!(scale >= 0.1 && scale <= 5)) scale = 1;
      return indent + '<local:MyIconTextButton Text="' + xesc(sub(btn.text, map)) + '"' + tipAttr + ' EventType="' + xesc(btn.event_type || 'None') + '" EventData="' + xesc(sub(btn.event_data, map)) + '" Logo="' + xesc(logo) + '" LogoScale="' + scale + '"' + sizeAttr + ' Margin="0,0,5,5" />';
    }
    if (+btn.height > 0) sizeAttr += ' Height="' + Math.min(+btn.height, 2000) + '"';
    else sizeAttr += ' Height="35"';
    return indent + '<local:MyButton Text="' + xesc(sub(btn.text, map)) + '" EventType="' + xesc(btn.event_type || 'None') + '" EventData="' + xesc(sub(btn.event_data, map)) + '" ColorType="' + xesc(btn.color_type || 'Normal') + '" Padding="13,0"' + sizeAttr + ' Margin="0,0,5,5" />';
  }

  /** 按钮区（与 homepage/index.php 的 renderButtons 同构三分支：仅左组 / 仅右组 / Grid 左右分置） */
  function renderButtonsInto(arr, map) {
    if (!state.buttons.length) return;
    var leftItems = [];
    var rightItems = [];
    state.buttons.forEach(function (btn) {
      var item = buildButtonItem(btn, map);
      if (!item) return;
      if (btn.align === 'right') rightItems.push(item); else leftItems.push(item);
    });
    if (!leftItems.length && !rightItems.length) return;
    if (leftItems.length && rightItems.length) {
      // 左右分组：忽略卡级对齐；右组适合少量按钮（Auto 列单行贴右）
      arr.push('      <Grid Margin="0,10,0,0">');
      arr.push('        <Grid.ColumnDefinitions><ColumnDefinition Width="*" /><ColumnDefinition Width="Auto" /></Grid.ColumnDefinitions>');
      arr.push('        <WrapPanel Orientation="Horizontal" Grid.Column="0">');
      leftItems.forEach(function (item) { arr.push('  ' + item); });
      arr.push('        </WrapPanel>');
      arr.push('        <WrapPanel Orientation="Horizontal" Grid.Column="1">');
      rightItems.forEach(function (item) { arr.push('  ' + item); });
      arr.push('        </WrapPanel>');
      arr.push('      </Grid>');
      return;
    }
    var items = leftItems.length ? leftItems : rightItems;
    var ha = '';
    if (leftItems.length) {
      if (state.buttons_align === 'center') ha = ' HorizontalAlignment="Center"';
      else if (state.buttons_align === 'right') ha = ' HorizontalAlignment="Right"';
    } else {
      ha = ' HorizontalAlignment="Right"'; // 仅右组：贴右
    }
    arr.push('      <WrapPanel Orientation="Horizontal" Margin="0,10,0,0"' + ha + '>');
    items.forEach(function (item) { arr.push(item); });
    arr.push('      </WrapPanel>');
  }

  function updatePreview() {
    var pre = document.getElementById('xamlPreview');
    if (!pre) return;
    var isServer = state.kind === 'server';
    var isMerge = isServer && !!state.merge_servers;
    var body = [];

    if (isMerge) {
      // 合并模式：模板行集对每台示例服务器各渲染一遍（hide_if_empty 按台生效）
      SAMPLE_SERVER_LIST.forEach(function (_, idx) {
        renderRowsInto(body, serverSampleMap(idx));
      });
    } else {
      renderRowsInto(body, isServer ? serverSampleMap(0) : globalSampleMap());
    }
    // 按钮/标题：合并模式只用全局键（按钮只渲染一次），否则与行同映射
    var headMap = isMerge ? globalSampleMap() : (isServer ? serverSampleMap(0) : globalSampleMap());
    renderButtonsInto(body, headMap);

    var out = ['<StackPanel>'];
    if (!body.length) {
      // 空 rows/空按钮不输出空面板（与 PHP 一致）
      out.push('</StackPanel>');
      pre.textContent = out.join('\n');
      return;
    }
    if (state.bare) {
      // 无外壳：行+按钮直接作页面顶层元素，title/title_font_size 被忽略
      out.push('  <StackPanel Margin="0,0,0,15">');
      body.forEach(function (line) { out.push(line); });
      out.push('  </StackPanel>');
    } else {
      var titleRaw = sub(state.title, headMap);
      var tfs = +state.title_font_size || 0;
      if (tfs > 0 && titleRaw !== '') {
        if (tfs > 200) tfs = 200;
        if (tfs < 8) tfs = 8;
        var top = Math.max(40, Math.round(tfs * 1.4 + 22));
        out.push('  <local:MyCard Margin="0,0,0,15" CanSwap="True">');
        out.push('    <local:MyCard.Inlines><InlineUIContainer><TextBlock Text="' + xesc(titleRaw) + '" FontSize="' + tfs + '" FontWeight="Bold" Foreground="{DynamicResource ColorBrush3}" /></InlineUIContainer></local:MyCard.Inlines>');
        out.push('    <StackPanel Margin="25,' + top + ',23,15">');
      } else {
        out.push('  <local:MyCard Title="' + xesc(titleRaw) + '" Margin="0,0,0,15" CanSwap="True">');
        out.push('    <StackPanel Margin="25,40,23,15">');
      }
      body.forEach(function (line) { out.push(line); });
      out.push('    </StackPanel>');
      out.push('  </local:MyCard>');
    }
    out.push('</StackPanel>');
    pre.textContent = out.join('\n');
  }

  /* ============================================================
     入口
     ============================================================ */

  document.addEventListener('DOMContentLoaded', function () {
    if (!Auth) { location.href = 'login.html'; return; }
    Auth.requireAuth().then(function () {
      if (document.getElementById('cardsList')) initListPage();
      else if (document.getElementById('cardForm')) initEditPage();
    }).catch(function () { location.href = 'login.html'; });
  });
})();
