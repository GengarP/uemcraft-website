/**
 * admin-edit.js — UEMCraft 新闻/活动编辑表单逻辑
 * ---------------------------------------------------
 * 处理 news-edit.html 和 events-edit.html 的表单加载、保存。
 * 依赖：admin-auth.js（UEMAdminAuth 全局对象）
 */
(function () {
  'use strict';

  var Auth = window.UEMAdminAuth;
  if (!Auth) return;

  Auth.requireAuth().then(function () {
    // DOM 检测，兼容 URL 重写
    if (document.getElementById('newsForm')) {
      initNewsEdit();
    } else if (document.getElementById('eventForm')) {
      initEventsEdit();
    } else if (document.getElementById('workForm')) {
      initWorksEdit();
    } else if (document.getElementById('serverForm')) {
      initServersEdit();
    }
  }).catch(function () {});

  // ============================================================
  //  新闻编辑
  // ============================================================
  function initNewsEdit() {
    var params = new URLSearchParams(window.location.search);
    var editId = params.get('id');
    var isEdit = !!editId;
    var apiBase = '../api/news.php';

    // 更新标题
    if (isEdit) {
      setText('heroTitle', '编辑新闻');
      setText('heroSub', '修改新闻信息');
      setText('crumbAction', '编辑');
      document.title = '编辑新闻 — UEMCraft';
    }

    var form = document.getElementById('newsForm');
    var msg = document.getElementById('formMessage');
    var btn = document.getElementById('saveBtn');

    // 编辑模式：加载现有数据
    if (isEdit) {
      Auth.api(apiBase + '?action=admin_detail&id=' + editId).then(function (json) {
        if (!json.success || !json.data) {
          showMessage(msg, '文章不存在', 'error');
          return;
        }
        fillNewsForm(json.data);
      }).catch(function () {
        showMessage(msg, '加载失败', 'error');
      });
    }

    // 提交
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = getNewsFormData();

      if (!data.title) {
        showMessage(msg, '标题不能为空', 'error');
        return;
      }
      if (!data.slug) {
        showMessage(msg, 'slug 不能为空', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '保存中…';
      showMessage(msg, '', '');

      var action = isEdit ? 'update' : 'create';
      var body = isEdit ? Object.assign({ id: parseInt(editId) }, data) : data;

      Auth.api(apiBase + '?action=' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (json) {
        if (json.success) {
          showMessage(msg, '保存成功！', 'success');
          setTimeout(function () { window.location.href = 'news.html'; }, 800);
        } else {
          showMessage(msg, '保存失败：' + (json.error || '未知错误'), 'error');
          btn.disabled = false;
          btn.textContent = '保存';
        }
      }).catch(function () {
        showMessage(msg, '请求失败', 'error');
        btn.disabled = false;
        btn.textContent = '保存';
      });
    });

    function fillNewsForm(item) {
      setInput('inputTitle', item.title);
      setInput('inputSlug', item.slug);
      setInput('inputDate', item.date);
      setInput('inputAuthor', item.author);
      setInput('inputCover', item.cover);
      setInput('inputCoverCaption', item.cover_caption);
      setInput('inputExcerpt', item.excerpt);
      setInput('inputContent', item.content);
      setInput('inputStatus', item.status);

      var tags = item.tags || [];
      if (typeof tags === 'string') {
        try { tags = JSON.parse(tags); } catch (e) { tags = []; }
      }
      setInput('inputTags', tags.join(', '));
    }

    function getNewsFormData() {
      var tagsStr = getVal('inputTags');
      var tags = tagsStr ? tagsStr.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];

      return {
        title: getVal('inputTitle'),
        slug: getVal('inputSlug'),
        date: getVal('inputDate'),
        author: getVal('inputAuthor'),
        cover: getVal('inputCover'),
        cover_caption: getVal('inputCoverCaption'),
        excerpt: getVal('inputExcerpt'),
        content: getVal('inputContent'),
        status: getVal('inputStatus'),
        tags: tags
      };
    }
  }

  // ============================================================
  //  活动编辑
  // ============================================================
  function initEventsEdit() {
    var params = new URLSearchParams(window.location.search);
    var editId = params.get('id');
    var isEdit = !!editId;
    var apiBase = '../api/events.php';

    if (isEdit) {
      setText('heroTitle', '编辑活动');
      setText('heroSub', '修改活动信息');
      setText('crumbAction', '编辑');
      document.title = '编辑活动 — UEMCraft';
    }

    var form = document.getElementById('eventForm');
    var msg = document.getElementById('formMessage');
    var btn = document.getElementById('saveBtn');

    // 编辑模式：加载现有数据
    if (isEdit) {
      Auth.api(apiBase + '?action=admin_detail&id=' + editId).then(function (json) {
        if (!json.success || !json.data) {
          showMessage(msg, '活动不存在', 'error');
          return;
        }
        fillEventForm(json.data);
      }).catch(function () {
        showMessage(msg, '加载失败', 'error');
      });
    }

    // 提交
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = getEventFormData();

      if (!data.title) {
        showMessage(msg, '标题不能为空', 'error');
        return;
      }
      if (!data.slug) {
        showMessage(msg, 'slug 不能为空', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '保存中…';
      showMessage(msg, '', '');

      var action = isEdit ? 'update' : 'create';
      var body = isEdit ? Object.assign({ id: parseInt(editId) }, data) : data;

      Auth.api(apiBase + '?action=' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (json) {
        if (json.success) {
          showMessage(msg, '保存成功！', 'success');
          setTimeout(function () { window.location.href = 'events.html'; }, 800);
        } else {
          showMessage(msg, '保存失败：' + (json.error || '未知错误'), 'error');
          btn.disabled = false;
          btn.textContent = '保存';
        }
      }).catch(function () {
        showMessage(msg, '请求失败', 'error');
        btn.disabled = false;
        btn.textContent = '保存';
      });
    });

    function fillEventForm(item) {
      setInput('inputTitle', item.title);
      setInput('inputSlug', item.slug);
      setInput('inputStatus', item.status);
      setInput('inputDateLabel', item.date_label);
      setInput('inputDateStart', item.date_start);
      setInput('inputDateEnd', item.date_end);
      setInput('inputCover', item.cover);
      setInput('inputLink', item.link);
      setInput('inputFeatured', String(item.is_featured ? 1 : 0));
      setInput('inputSortOrder', String(item.sort_order || 0));
      setInput('inputExcerpt', item.excerpt);
      setInput('inputContent', item.content || '');
    }

    function getEventFormData() {
      return {
        title: getVal('inputTitle'),
        slug: getVal('inputSlug'),
        status: getVal('inputStatus'),
        date_label: getVal('inputDateLabel'),
        date_start: getVal('inputDateStart'),
        date_end: getVal('inputDateEnd'),
        cover: getVal('inputCover'),
        link: getVal('inputLink'),
        is_featured: parseInt(getVal('inputFeatured')) || 0,
        sort_order: parseInt(getVal('inputSortOrder')) || 0,
        excerpt: getVal('inputExcerpt'),
        content: getVal('inputContent')
      };
    }
  }

  // ============================================================
  //  作品编辑
  // ============================================================
  function initWorksEdit() {
    var params = new URLSearchParams(window.location.search);
    var editId = params.get('id');
    var isEdit = !!editId;
    var apiBase = '../api/works.php';

    if (isEdit) {
      setText('heroTitle', '编辑作品');
      setText('heroSub', '修改作品信息');
      setText('crumbAction', '编辑');
      document.title = '编辑作品 — UEMCraft';
    }

    var form = document.getElementById('workForm');
    var msg = document.getElementById('formMessage');
    var btn = document.getElementById('saveBtn');

    // 编辑模式：加载现有数据
    if (isEdit) {
      Auth.api(apiBase + '?action=admin_detail&id=' + editId).then(function (json) {
        if (!json.success || !json.data) {
          showMessage(msg, '作品不存在', 'error');
          return;
        }
        fillWorkForm(json.data);
      }).catch(function () {
        showMessage(msg, '加载失败', 'error');
      });
    }

    // 提交
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = getWorkFormData();

      if (!data.title) {
        showMessage(msg, '标题不能为空', 'error');
        return;
      }
      if (!data.slug) {
        showMessage(msg, 'slug 不能为空', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '保存中…';
      showMessage(msg, '', '');

      var action = isEdit ? 'update' : 'create';
      var body = isEdit ? Object.assign({ id: parseInt(editId) }, data) : data;

      Auth.api(apiBase + '?action=' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (json) {
        if (json.success) {
          showMessage(msg, '保存成功！', 'success');
          setTimeout(function () { window.location.href = 'gallery.html'; }, 800);
        } else {
          showMessage(msg, '保存失败：' + (json.error || '未知错误'), 'error');
          btn.disabled = false;
          btn.textContent = '保存';
        }
      }).catch(function () {
        showMessage(msg, '请求失败', 'error');
        btn.disabled = false;
        btn.textContent = '保存';
      });
    });

    // 加载已有分类填充 datalist
    Auth.api(apiBase + '?action=admin_list&limit=100').then(function (json) {
      if (!json.success || !json.data) return;
      var cats = {};
      json.data.forEach(function (w) { if (w.category) cats[w.category] = true; });
      var list = document.getElementById('categoryList');
      if (list) {
        list.innerHTML = Object.keys(cats).sort().map(function (c) {
          return '<option value="' + escapeHtmlAttr(c) + '">';
        }).join('');
      }
    }).catch(function () {});

    function fillWorkForm(item) {
      setInput('inputTitle', item.title);
      setInput('inputSlug', item.slug);
      setInput('inputStatus', item.status);
      setInput('inputCover', item.cover);
      setInput('inputImage', item.image);
      setInput('inputCategory', item.category || '');
      setInput('inputSortOrder', String(item.sort_order || 0));
      setInput('inputDescription', item.description || '');
    }

    function getWorkFormData() {
      return {
        title: getVal('inputTitle'),
        slug: getVal('inputSlug'),
        status: getVal('inputStatus'),
        cover: getVal('inputCover'),
        image: getVal('inputImage'),
        category: getVal('inputCategory'),
        sort_order: parseInt(getVal('inputSortOrder')) || 0,
        description: getVal('inputDescription')
      };
    }
  }

  // ============================================================
  //  服务器编辑
  // ============================================================
  function initServersEdit() {
    var params = new URLSearchParams(window.location.search);
    var editId = params.get('id');
    var isEdit = !!editId;
    var apiBase = '../api/servers.php';

    if (isEdit) {
      setText('heroTitle', '编辑服务器');
      setText('heroSub', '修改服务器信息');
      setText('crumbAction', '编辑');
      document.title = '编辑服务器 — UEMCraft';
    }

    var form = document.getElementById('serverForm');
    var msg = document.getElementById('formMessage');
    var btn = document.getElementById('saveBtn');

    // 编辑模式：加载现有数据
    if (isEdit) {
      Auth.api(apiBase + '?action=admin_detail&id=' + editId).then(function (json) {
        if (!json.success || !json.data) {
          showMessage(msg, '服务器不存在', 'error');
          return;
        }
        fillServerForm(json.data);
      }).catch(function () {
        showMessage(msg, '加载失败', 'error');
      });
    }

    // 提交
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = getServerFormData();

      if (!data.name) {
        showMessage(msg, '服务器名称不能为空', 'error');
        return;
      }
      if (!data.address) {
        showMessage(msg, '服务器地址不能为空', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '保存中…';
      showMessage(msg, '', '');

      var action = isEdit ? 'update' : 'create';
      var body = isEdit ? Object.assign({ id: parseInt(editId) }, data) : data;

      Auth.api(apiBase + '?action=' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (json) {
        if (json.success) {
          showMessage(msg, '保存成功！', 'success');
          setTimeout(function () { window.location.href = 'servers.html'; }, 800);
        } else {
          showMessage(msg, '保存失败：' + (json.error || '未知错误'), 'error');
          btn.disabled = false;
          btn.textContent = '保存';
        }
      }).catch(function () {
        showMessage(msg, '请求失败', 'error');
        btn.disabled = false;
        btn.textContent = '保存';
      });
    });

    function fillServerForm(item) {
      setInput('inputName', item.name);
      setInput('inputAddress', item.address);
      setInput('inputPort', item.port ? String(item.port) : '');
      setInput('inputNote', item.note);
      setInput('inputFeatured', String(item.is_featured ? 1 : 0));
      setInput('inputSortOrder', String(item.sort_order || 0));
    }

    function getServerFormData() {
      var portVal = getVal('inputPort');
      return {
        name: getVal('inputName'),
        address: getVal('inputAddress'),
        port: portVal ? parseInt(portVal) || 0 : 0,
        note: getVal('inputNote'),
        is_featured: parseInt(getVal('inputFeatured')) || 0,
        sort_order: parseInt(getVal('inputSortOrder')) || 0
      };
    }
  }

  // ============================================================
  //  工具函数
  // ============================================================
  function escapeHtmlAttr(text) {
    return String(text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function getVal(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function setInput(id, val) {
    var el = document.getElementById(id);
    if (el) el.value = val || '';
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'wall-form-message';
    if (type) el.classList.add('is-' + type);
  }
})();
