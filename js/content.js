/* ============================================================
   content.js — 内容渲染
   新闻：通过 fetch 从 /api/news.php 加载
   活动：通过 fetch 从 /api/events.php 加载
   在 DOM ready 时按容器 ID 自动渲染列表 / 详情 / 首页预览。
   ============================================================ */

var EVENT_STATUS = {
  upcoming: { cls: 'status-upcoming', label: '即将到来' },
  ongoing:  { cls: 'status-ongoing',  label: '进行中' },
  past:     { cls: 'status-past',     label: '已结束' }
};

/* ---- 工具函数 ---- */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ISO 日期 "2026-08-06" → "2026 年 8 月 6 日"
function formatDate(iso) {
  if (!iso) return '';
  var parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  return parts[0] + ' 年 ' + parseInt(parts[1], 10) + ' 月 ' + parseInt(parts[2], 10) + ' 日';
}

function newsUrl(slug) {
  return '/news/article.html?slug=' + encodeURIComponent(slug);
}

/* ---- 异步数据加载（API） ---- */
function fetchArticleIndex() {
  return fetch('/api/news.php?action=list&limit=100')
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load news');
      return res.json();
    })
    .then(function (json) {
      if (!json.success) throw new Error(json.error || 'Failed');
      return json.data || [];
    });
}

function fetchArticleBySlug(slug) {
  return fetch('/api/news.php?action=detail&slug=' + encodeURIComponent(slug))
    .then(function (res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function (json) {
      if (!json || !json.success) return null;
      return json.data;
    })
    .catch(function () { return null; });
}

function fetchEvents(type) {
  return fetch('/api/events.php?action=' + (type || 'upcoming'))
    .then(function (res) {
      if (!res.ok) throw new Error('Failed to load events');
      return res.json();
    })
    .then(function (json) {
      if (!json.success) throw new Error(json.error || 'Failed');
      return json.data || [];
    });
}

// 按日期降序排序（与旧行为一致）
function sortArticles(articles) {
  return articles.slice().sort(function (a, b) {
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
}

/* ---- 卡片渲染 ---- */
function renderNewsCard(item) {
  var a = document.createElement('a');
  a.className = 'news-card';
  a.href = newsUrl(item.slug);
  a.innerHTML =
    '<div class="news-date">' + escapeHtml(formatDate(item.date)) + '</div>' +
    '<div class="news-title">' + escapeHtml(item.title) + '</div>' +
    '<div class="news-excerpt">' + escapeHtml(item.excerpt) + '</div>';
  return a;
}

function renderNewsEmptyCard() {
  var div = document.createElement('div');
  div.className = 'news-card news-card-empty';
  div.setAttribute('aria-hidden', 'true');
  div.innerHTML = '<div class="news-date">·····</div><div class="news-title">敬请期待</div><div class="news-excerpt">更多动态即将发布</div>';
  return div;
}

function renderEventCard(item) {
  var a = document.createElement('a');
  a.href = item.link || '#';
  var st = EVENT_STATUS[item.status] || EVENT_STATUS.upcoming;
  a.innerHTML =
    '<div class="event-card">' +
      '<div class="event-card-img">' +
        '<img src="' + escapeHtml(item.cover || '') + '" alt="">' +
        '<div class="event-img-meta">' +
          '<div class="event-date-badge">' + escapeHtml(item.date_label || item.dateLabel || '') + '</div>' +
          '<div class="event-status ' + st.cls + '">' + st.label + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="event-card-body">' +
        '<div class="news-title">' + escapeHtml(item.title) + '</div>' +
        '<div class="news-excerpt">' + escapeHtml(item.excerpt || '') + '</div>' +
      '</div>' +
    '</div>';
  return a;
}

/* ---- 代码高亮（轻量、零依赖） ---- */
var GENERIC_KEYWORDS = {
  'function':1,'return':1,'if':1,'else':1,'for':1,'while':1,'do':1,
  'const':1,'let':1,'var':1,'new':1,'class':1,'extends':1,'import':1,'export':1,'from':1,'default':1,
  'async':1,'await':1,'try':1,'catch':1,'throw':1,'finally':1,'switch':1,'case':1,'break':1,'continue':1,
  'true':1,'false':1,'null':1,'undefined':1,'this':1,'typeof':1,'instanceof':1,'in':1,'of':1,'void':1,'delete':1
};

function highlightJson(src) {
  return src.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}\[\],:])|([\s\S])/g,
    function (m, str, colon, num, kw, punct, other) {
      if (str !== undefined) {
        return colon !== undefined
          ? '<span class="tok-key">' + escapeHtml(str) + '</span>' + colon
          : '<span class="tok-string">' + escapeHtml(str) + '</span>';
      }
      if (num !== undefined) return '<span class="tok-number">' + num + '</span>';
      if (kw !== undefined) return '<span class="tok-keyword">' + kw + '</span>';
      if (punct !== undefined) return '<span class="tok-punct">' + escapeHtml(punct) + '</span>';
      return escapeHtml(other);
    }
  );
}

var RE_SLASH_COMMENT = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\b|\b([A-Za-z_$][\w$]*)\b|([\s\S])/g;
var RE_HASH_COMMENT  = /(#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\b|\b([A-Za-z_$][\w$]*)\b|([\s\S])/g;
var HASH_COMMENT_LANGS = /^(bash|sh|shell|zsh|python|py|yaml|yml|ruby|rb|perl|pl|nginx|toml|ini|http|text|plaintext)$/;

function highlightGeneric(src, lang) {
  var re = HASH_COMMENT_LANGS.test(lang || '') ? RE_HASH_COMMENT : RE_SLASH_COMMENT;
  return src.replace(re,
    function (m, comment, str, num, word, other) {
      if (comment !== undefined) return '<span class="tok-comment">' + escapeHtml(comment) + '</span>';
      if (str !== undefined) return '<span class="tok-string">' + escapeHtml(str) + '</span>';
      if (num !== undefined) return '<span class="tok-number">' + num + '</span>';
      if (word !== undefined) {
        return GENERIC_KEYWORDS[word] ? '<span class="tok-keyword">' + word + '</span>' : word;
      }
      return escapeHtml(other);
    }
  );
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); return Promise.resolve(); }
  catch (e) { return Promise.reject(e); }
  finally { document.body.removeChild(ta); }
}

function buildCodeHeader(lang) {
  var header = document.createElement('div');
  header.className = 'code-header';
  header.innerHTML =
    '<span class="code-lang">' + escapeHtml(lang || 'code') + '</span>' +
    '<button type="button" class="code-copy" aria-label="复制代码">复制</button>';
  return header;
}

function enhanceCodeBlocks(root) {
  if (!root || !root.querySelectorAll) return;
  var blocks = root.querySelectorAll('pre code');
  for (var i = 0; i < blocks.length; i++) {
    (function (code) {
      var pre = code.parentNode;
      var cls = code.className || '';
      var m = cls.match(/language-([\w+-]+)/);
      var lang = m ? m[1].toLowerCase() : '';
      var raw = code.textContent;

      code.innerHTML = (lang === 'json' || lang === 'jsonc')
        ? highlightJson(raw)
        : highlightGeneric(raw, lang);

      var wrapper = document.createElement('div');
      wrapper.className = 'code-block';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      var header = buildCodeHeader(lang);
      wrapper.insertBefore(header, pre);

      var copyBtn = header.querySelector('.code-copy');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          copyText(raw).then(function () {
            copyBtn.textContent = '已复制';
            setTimeout(function () { copyBtn.textContent = '复制'; }, 2000);
          }).catch(function () {
            copyBtn.textContent = '失败';
            setTimeout(function () { copyBtn.textContent = '复制'; }, 2000);
          });
        });
      }
    })(blocks[i]);
  }
}

/* ---- 文章详情渲染（异步） ---- */
function buildMetaHtml(item) {
  var html = '';
  html += '<div class="article-meta-item">' +
            '<span class="article-meta-label">发布日期</span>' +
            '<span class="article-meta-value">' + escapeHtml(formatDate(item.date)) + '</span>' +
          '</div>';
  if (item.author) {
    html += '<span class="article-meta-sep" aria-hidden="true">·</span>';
    html += '<div class="article-meta-item">' +
              '<span class="article-meta-label">作者</span>' +
              '<span class="article-meta-value">' + escapeHtml(item.author) + '</span>' +
            '</div>';
  }
  if (item.tags && item.tags.length) {
    var badges = item.tags.map(function (tag) {
      return '<span class="badge">' + escapeHtml(tag) + '</span>';
    }).join('');
    html += '<div class="article-meta-tags">' + badges + '</div>';
  }
  return html;
}

function renderArticleError(titleEl, subEl, crumbEl, coverEl, metaEl, contentEl, msg) {
  document.title = '文章不存在 — 资讯动态 — UEMCraft';
  if (titleEl) titleEl.textContent = '文章不存在';
  if (subEl) subEl.textContent = msg || '你访问的文章可能已被移动或删除。';
  if (crumbEl) crumbEl.textContent = '文章不存在';
  if (coverEl) coverEl.style.display = 'none';
  if (metaEl) metaEl.style.display = 'none';
  if (contentEl) contentEl.innerHTML = '<p>' + escapeHtml(msg || '没有找到对应的文章。') + '，<a href="/news/">返回资讯列表</a>。</p>';
}

function renderArticleData(item) {
  var titleEl = document.getElementById('articleTitle');
  var subEl = document.getElementById('articleSub');
  var crumbEl = document.getElementById('articleCrumb');
  var coverEl = document.getElementById('articleCover');
  var metaEl = document.getElementById('articleMeta');
  var contentEl = document.getElementById('articleContent');

  document.title = item.title + ' — 资讯动态 — UEMCraft';
  var desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', item.excerpt || '');

  if (titleEl) titleEl.textContent = item.title;
  if (subEl) subEl.textContent = item.excerpt || '';
  if (crumbEl) crumbEl.textContent = item.title;

  if (coverEl) {
    if (item.cover) {
      var cap = item.cover_caption ? '<figcaption>' + escapeHtml(item.cover_caption) + '</figcaption>' : '';
      coverEl.innerHTML = '<img src="' + escapeHtml(item.cover) + '" alt="' + escapeHtml(item.title) + '" loading="eager">' + cap;
      coverEl.style.display = '';
    } else {
      coverEl.style.display = 'none';
    }
  }

  if (metaEl) {
    metaEl.innerHTML = buildMetaHtml(item);
    metaEl.style.display = '';
  }

  if (contentEl) {
    if (typeof marked !== 'undefined') {
      marked.setOptions({ gfm: true, breaks: false, headerIds: true, mangle: false, sanitize: false });
      // API 返回的字段是 content（不是 markdown）
      contentEl.innerHTML = marked.parse(item.content || item.markdown || '');
      enhanceCodeBlocks(contentEl);
    } else {
      contentEl.innerHTML = '<p>Markdown 引擎加载失败，请刷新重试。</p>';
    }
  }
}

/* ---- 初始化：按容器 ID 自动渲染 ---- */
function initContent() {
  // 文章详情页（异步）
  if (document.getElementById('articleContent')) {
    var slug = new URLSearchParams(window.location.search).get('slug');
    var titleEl = document.getElementById('articleTitle');
    var subEl = document.getElementById('articleSub');
    var crumbEl = document.getElementById('articleCrumb');
    var coverEl = document.getElementById('articleCover');
    var metaEl = document.getElementById('articleMeta');
    var contentEl = document.getElementById('articleContent');

    if (!slug) {
      renderArticleError(titleEl, subEl, crumbEl, coverEl, metaEl, contentEl, '未指定文章');
      return;
    }

    fetchArticleBySlug(slug).then(function (item) {
      if (!item) {
        renderArticleError(titleEl, subEl, crumbEl, coverEl, metaEl, contentEl);
        return;
      }
      renderArticleData(item);
    }).catch(function () {
      renderArticleError(titleEl, subEl, crumbEl, coverEl, metaEl, contentEl, '加载文章时发生错误');
    });
    return;
  }

  // 新闻列表页（异步）
  var newsList = document.getElementById('newsList');
  if (newsList) {
    fetchArticleIndex().then(function (articles) {
      sortArticles(articles).forEach(function (item) {
        newsList.appendChild(renderNewsCard(item));
      });
    }).catch(function () {
      newsList.innerHTML = '<p style="color:var(--c-text-muted);">加载资讯列表失败，请刷新重试。</p>';
    });
  }

  // 首页最新动态：前 3 条（异步）
  var newsGrid = document.getElementById('newsGrid');
  if (newsGrid) {
    fetchArticleIndex().then(function (articles) {
      newsGrid.innerHTML = '';
      sortArticles(articles).slice(0, 3).forEach(function (item) {
        newsGrid.appendChild(renderNewsCard(item));
      });
      while (newsGrid.children.length < 3) {
        newsGrid.appendChild(renderNewsEmptyCard());
      }
    }).catch(function () {
      // 加载失败时保留占位卡片
    });
  }

  // 首页精选作品：随机 3 件（异步，从 API）
  var galleryGrid = document.querySelector('.gallery-grid');
  if (galleryGrid) {
    fetch('/api/works.php?action=list')
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json.success || !json.data || json.data.length === 0) return;
        var works = json.data;
        // Fisher-Yates 洗牌取前 3
        for (var i = works.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = works[i]; works[i] = works[j]; works[j] = tmp;
        }
        var pick = works.slice(0, 3);
        galleryGrid.innerHTML = '';
        pick.forEach(function (item) {
          var tile = document.createElement('div');
          tile.className = 'gallery-tile';
          var cover = item.cover || item.image || '';
          tile.innerHTML =
            (cover ? '<img src="' + escapeHtml(cover) + '" alt="' + escapeHtml(item.title) + '" loading="lazy">' : '') +
            '<div class="tile-overlay">' +
              '<span class="tile-title">' + escapeHtml(item.title) + '</span>' +
              '<span class="tile-meta">' + escapeHtml(item.description || '') + '</span>' +
            '</div>';
          galleryGrid.appendChild(tile);
        });
      })
      .catch(function () {});
  }

  // 首页近期活动预览（异步，从 API）
  var eventsGrid = document.getElementById('eventsGrid');
  if (eventsGrid) {
    fetchEvents('upcoming').then(function (items) {
      items.forEach(function (item) { eventsGrid.appendChild(renderEventCard(item)); });
    }).catch(function () {});
  }

  // 活动页：近期活动 / 往期回顾（异步，从 API）
  var eventUpcoming = document.getElementById('eventUpcoming');
  if (eventUpcoming) {
    fetchEvents('upcoming').then(function (items) {
      items.forEach(function (item) { eventUpcoming.appendChild(renderEventCard(item)); });
    }).catch(function () {});
  }
  var eventPast = document.getElementById('eventPast');
  if (eventPast) {
    fetchEvents('past').then(function (items) {
      items.forEach(function (item) { eventPast.appendChild(renderEventCard(item)); });
    }).catch(function () {});
  }
}

document.addEventListener('DOMContentLoaded', initContent);
