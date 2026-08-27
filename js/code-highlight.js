/* ============================================================
   code-highlight.js — 轻量代码高亮（零依赖）
   依赖：utils.js（escapeHtml）
   通过 window.CodeHighlight 暴露 enhanceCodeBlocks。
   ============================================================ */
(function () {
  'use strict';

  var escapeHtml = (window.UEMUtils && window.UEMUtils.escapeHtml) || function (s) { return s; };

  /* ---- 关键字表 ---- */
  var GENERIC_KEYWORDS = {
    'function':1,'return':1,'if':1,'else':1,'for':1,'while':1,'do':1,
    'const':1,'let':1,'var':1,'new':1,'class':1,'extends':1,'import':1,'export':1,'from':1,'default':1,
    'async':1,'await':1,'try':1,'catch':1,'throw':1,'finally':1,'switch':1,'case':1,'break':1,'continue':1,
    'true':1,'false':1,'null':1,'undefined':1,'this':1,'typeof':1,'instanceof':1,'in':1,'of':1,'void':1,'delete':1
  };

  /* ---- JSON 高亮 ---- */
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

  /* ---- 通用语言高亮 ---- */
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

  /* ---- 复制按钮 ---- */
  function copyText(text) {
    if (window.UEMUtils && window.UEMUtils.copyText) {
      return window.UEMUtils.copyText(text);
    }
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

  /**
   * 增强 <pre><code> 块：语法高亮 + 复制按钮
   */
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

  // 暴露到全局
  window.CodeHighlight = {
    enhanceCodeBlocks: enhanceCodeBlocks,
    highlightJson: highlightJson,
    highlightGeneric: highlightGeneric
  };
})();
