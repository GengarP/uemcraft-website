(function () {
  'use strict';

  var API = '../api/parkour.php';
  var uploadToken = '';

  function getToken() {
    return window.UEMAdminAuth ? window.UEMAdminAuth.getToken() : localStorage.getItem('uemcraft-admin-token');
  }

  function authFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers || {}, {
      'X-Admin-Token': getToken()
    });
    return fetch(url, options).then(function (res) { return res.json(); });
  }

  function escapeHtml(text) {
    var u = window.UEMUtils;
    return u ? u.escapeHtml(text) : (function () {
      var d = document.createElement('div');
      d.textContent = text || '';
      return d.innerHTML;
    })();
  }

  function showMessage(id, text, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'wall-form-message';
    if (type) el.classList.add('is-' + type);
  }

  function formatTime(ts) {
    if (!ts) return '未封榜';
    var d = new Date(ts * 1000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function loadMaps() {
    authFetch(API + '?action=admin_maps')
      .then(function (json) {
        if (!json.success) throw new Error(json.error || '加载失败');
        var list = document.getElementById('mapsList');
        if (!json.data || json.data.length === 0) {
          list.innerHTML = '<div class="wall-empty">暂无已导入排行榜</div>';
          return;
        }
        var html = '';
        json.data.forEach(function (m) {
          html += '<div class="admin-list-row">';
          html += '<div class="admin-list-main">';
          html += '<strong>' + escapeHtml(m.display_name) + '</strong>';
          html += '<div class="text-muted">来源：' + escapeHtml(m.source_file) + ' / Course ' + m.source_course_id + '（' + escapeHtml(m.source_name) + '）</div>';
          html += '<div class="text-muted">记录数：' + m.record_count + '，封榜：' + formatTime(m.close_at) + '，状态：' + escapeHtml(m.status) + '</div>';
          html += '</div>';
          html += '<div class="admin-list-actions">';
          html += '<button class="btn btn-ghost btn-sm" data-action="edit" data-id="' + m.id + '" data-name="' + escapeHtml(m.display_name) + '" data-close="' + (m.close_at ? new Date(m.close_at * 1000).toISOString().slice(0, 10) : '') + '" data-status="' + escapeHtml(m.status) + '">编辑</button>';
          html += '<button class="btn btn-ghost btn-sm" data-action="delete" data-id="' + m.id + '">删除</button>';
          html += '</div>';
          html += '</div>';
        });
        list.innerHTML = html;
      })
      .catch(function (e) {
        document.getElementById('mapsList').innerHTML = '<div class="wall-empty">' + escapeHtml(e.message || '加载失败') + '</div>';
      });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (window.UEMAdminAuth) {
      window.UEMAdminAuth.requireAuth(API + '?action=admin_maps').then(function () {
        loadMaps();
      }).catch(function () {});
    }

    var uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
      uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var fileInput = document.getElementById('dbFile');
        if (!fileInput.files || !fileInput.files[0]) {
          showMessage('uploadMessage', '请选择 .db 文件', 'error');
          return;
        }
        var fd = new FormData();
        fd.append('db', fileInput.files[0]);

        fetch(API + '?action=upload_db', {
          method: 'POST',
          headers: { 'X-Admin-Token': getToken() },
          body: fd
        }).then(function (res) { return res.json(); }).then(function (json) {
          if (!json.success) throw new Error(json.error || '上传失败');
          uploadToken = json.data.upload_token;
          var select = document.getElementById('courseSelect');
          select.innerHTML = '';
          json.data.courses.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.courseId;
            opt.textContent = c.courseId + ' - ' + c.name + '（' + c.recordCount + ' 条）';
            select.appendChild(opt);
          });
          document.getElementById('importCard').style.display = '';
          showMessage('uploadMessage', '解析成功：' + json.data.courses.length + ' 张地图', 'success');
        }).catch(function (err) {
          showMessage('uploadMessage', err.message || '上传失败', 'error');
        });
      });
    }

    var importBtn = document.getElementById('importBtn');
    if (importBtn) {
      importBtn.addEventListener('click', function () {
        var courseId = parseInt(document.getElementById('courseSelect').value, 10);
        var displayName = document.getElementById('displayName').value.trim();
        var closeDate = document.getElementById('closeDate').value;

        authFetch(API + '?action=import_course', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            upload_token: uploadToken,
            course_id: courseId,
            display_name: displayName,
            close_date: closeDate
          })
        }).then(function (json) {
          if (!json.success) throw new Error(json.error || '导入失败');
          showMessage('importMessage', '导入成功：' + json.data.imported + ' 条记录', 'success');
          loadMaps();
        }).catch(function (err) {
          showMessage('importMessage', err.message || '导入失败', 'error');
        });
      });
    }

    var mapsList = document.getElementById('mapsList');
    if (mapsList) {
      mapsList.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var action = btn.getAttribute('data-action');
        var id = parseInt(btn.getAttribute('data-id'), 10);

        if (action === 'delete') {
          if (!confirm('确定删除该排行榜及其所有记录？')) return;
          authFetch(API + '?action=delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
          }).then(function (json) {
            if (!json.success) throw new Error(json.error || '删除失败');
            loadMaps();
          }).catch(function (err) {
            alert(err.message || '删除失败');
          });
        }

        if (action === 'edit') {
          var name = prompt('展示名称', btn.getAttribute('data-name') || '');
          if (name === null) return;
          var close = prompt('封榜日期（YYYY-MM-DD，留空取消封榜）', btn.getAttribute('data-close') || '');
          if (close === null) return;
          var status = prompt('状态（published/draft）', btn.getAttribute('data-status') || 'published');
          if (status === null) return;

          authFetch(API + '?action=admin_update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: id,
              display_name: name,
              close_date: close,
              status: status
            })
          }).then(function (json) {
            if (!json.success) throw new Error(json.error || '更新失败');
            loadMaps();
          }).catch(function (err) {
            alert(err.message || '更新失败');
          });
        }
      });
    }
  });
})();
