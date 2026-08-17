/* ============================================================
   wall.js — 留言墙前端交互
   ============================================================ */

(function() {
  'use strict';

  var API_URL = '../api/wall.php';
  var LIMIT = 20;

  var form = document.getElementById('wallForm');
  var nameInput = document.getElementById('wallName');
  var contentInput = document.getElementById('wallContent');
  var charCount = document.getElementById('charCount');
  var submitBtn = document.getElementById('submitBtn');
  var formMessage = document.getElementById('formMessage');
  var wallList = document.getElementById('wallList');
  var totalCount = document.getElementById('totalCount');
  var pagination = document.getElementById('wallPagination');
  var prevBtn = document.getElementById('prevPage');
  var nextBtn = document.getElementById('nextPage');
  var pageInfo = document.getElementById('pageInfo');

  var currentPage = 1;
  var totalPages = 1;

  /* ---- Helpers ---- */
  function pad(n) { return n < 10 ? '0' + n : n; }

  function formatDate(ts) {
    var d = new Date(ts * 1000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showFormMessage(msg, type) {
    formMessage.textContent = msg;
    formMessage.className = 'wall-form-message is-' + (type || 'info');
    if (msg) {
      setTimeout(function() {
        formMessage.textContent = '';
        formMessage.className = 'wall-form-message';
      }, 5000);
    }
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? '发送中…' : '发表留言';
  }

  /* ---- Character count ---- */
  if (contentInput && charCount) {
    contentInput.addEventListener('input', function() {
      var len = contentInput.value.length;
      charCount.textContent = len;
      charCount.classList.toggle('is-max', len >= 500);
    });
  }

  /* ---- Fetch messages ---- */
  function loadMessages(page) {
    page = page || 1;
    wallList.innerHTML = '<div class="wall-loading">正在加载留言…</div>';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_URL + '?action=list&page=' + page + '&limit=' + LIMIT, true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState !== 4) return;
      if (xhr.status !== 200) {
        wallList.innerHTML = '<div class="wall-empty">加载失败，请刷新页面重试。</div>';
        return;
      }
      try {
        var res = JSON.parse(xhr.responseText);
        if (!res.success) {
          wallList.innerHTML = '<div class="wall-empty">' + escapeHtml(res.error || '加载失败') + '</div>';
          return;
        }
        renderMessages(res.data);
        currentPage = res.page;
        totalPages = res.pages;
        totalCount.textContent = res.total;
        renderPagination();
      } catch (e) {
        wallList.innerHTML = '<div class="wall-empty">加载失败，请刷新页面重试。</div>';
      }
    };
    xhr.send();
  }

  function renderMessages(data) {
    if (!data || data.length === 0) {
      wallList.innerHTML = '<div class="wall-empty">还没有留言，来做第一个留言的人吧！</div>';
      pagination.style.display = 'none';
      return;
    }

    var frag = document.createDocumentFragment();
    data.forEach(function(item) {
      var card = document.createElement('div');
      card.className = 'wall-card';
      card.innerHTML =
        '<div class="wall-card-header">' +
          '<span class="wall-card-name">' + escapeHtml(item.name) + '</span>' +
          '<time class="wall-card-time" datetime="' + formatDate(item.created_at) + '" title="' + formatDate(item.created_at) + '">' + formatDate(item.created_at) + '</time>' +
        '</div>' +
        '<div class="wall-card-body">' + escapeHtml(item.content).replace(/\n/g, '<br>') + '</div>';
      frag.appendChild(card);
    });
    wallList.innerHTML = '';
    wallList.appendChild(frag);
    pagination.style.display = totalPages > 1 ? 'flex' : 'none';
  }

  function renderPagination() {
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    pageInfo.textContent = currentPage + ' / ' + totalPages;
  }

  /* ---- Pagination events ---- */
  if (prevBtn) {
    prevBtn.addEventListener('click', function() {
      if (currentPage > 1) {
        loadMessages(currentPage - 1);
        document.getElementById('main').scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function() {
      if (currentPage < totalPages) {
        loadMessages(currentPage + 1);
        document.getElementById('main').scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  /* ---- Submit form ---- */
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();

      var name = (nameInput.value || '').trim();
      var content = (contentInput.value || '').trim();
      var hasError = false;

      // Validate
      if (!name || name.length < 2 || name.length > 20) {
        nameInput.classList.add('is-error');
        hasError = true;
      } else {
        nameInput.classList.remove('is-error');
      }

      if (!content || content.length > 500) {
        contentInput.classList.add('is-error');
        hasError = true;
      } else {
        contentInput.classList.remove('is-error');
      }

      if (hasError) return;

      setLoading(true);
      showFormMessage('');

      var xhr = new XMLHttpRequest();
      xhr.open('POST', API_URL + '?action=post', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        setLoading(false);

        try {
          var res = JSON.parse(xhr.responseText);
          if (res.success) {
            var status = res.data && res.data.status;
            if (status === 'hidden') {
              showFormMessage('留言已提交，审核通过后将展示', 'info');
            } else {
              showFormMessage('留言发表成功！', 'success');
            }
            form.reset();
            charCount.textContent = '0';
            loadMessages(1);
          } else {
            showFormMessage(res.error || '发表失败，请稍后重试', 'error');
          }
        } catch (e) {
          showFormMessage('网络错误，请稍后重试', 'error');
        }
      };
      xhr.send(JSON.stringify({ name: name, content: content }));
    });

    // Clear error on input
    nameInput.addEventListener('input', function() { nameInput.classList.remove('is-error'); });
    contentInput.addEventListener('input', function() { contentInput.classList.remove('is-error'); });
  }

  /* ---- Init ---- */
  loadMessages(1);
})();
