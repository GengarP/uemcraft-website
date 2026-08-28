/* ============================================================
   cjk-spacing.js — 为 CJK 和非 CJK 文本分别包裹 span
   ============================================================ */
(function () {
  'use strict';

  var CJK_RE = /([\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF\uFE30-\uFE4F]+)/g;
  var SKIP = { SCRIPT:1, STYLE:1, CODE:1, PRE:1, KBD:1, SAMP:1, TEXTAREA:1, INPUT:1, SELECT:1 };
  var SKIP_CLASS = /^(cjk-spacing|latin-spacing)$/;

  function shouldSkip(el) {
    if (SKIP[el.tagName]) return true;
    if (el.hasAttribute && el.hasAttribute('data-no-cjk')) return true;
    if (el.classList) {
      for (var i = 0; i < el.classList.length; i++) {
        if (SKIP_CLASS.test(el.classList[i])) return true;
      }
    }
    return false;
  }

  function wrapText(node) {
    var text = node.textContent;
    if (!text.trim()) return;
    if (!CJK_RE.test(text)) return;
    CJK_RE.lastIndex = 0;
    var frag = document.createDocumentFragment();
    var last = 0;
    var m;
    while ((m = CJK_RE.exec(text)) !== null) {
      if (m.index > last) {
        var latin = document.createElement('span');
        latin.className = 'latin-spacing';
        latin.textContent = text.slice(last, m.index);
        frag.appendChild(latin);
      }
      var span = document.createElement('span');
      span.className = 'cjk-spacing';
      span.textContent = m[0];
      frag.appendChild(span);
      last = CJK_RE.lastIndex;
    }
    if (last < text.length) {
      var latin = document.createElement('span');
      latin.className = 'latin-spacing';
      latin.textContent = text.slice(last);
      frag.appendChild(latin);
    }
    node.parentNode.replaceChild(frag, node);
  }

  function walk(el) {
    if (el.nodeType !== 1) return;
    if (shouldSkip(el)) return;
    var child = el.firstChild;
    while (child) {
      var next = child.nextSibling;
      if (child.nodeType === 3) wrapText(child);
      else if (child.nodeType === 1) walk(child);
      child = next;
    }
  }

  function run() { walk(document.body); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n.nodeType === 1) {
          if (shouldSkip(n)) continue;
          walk(n);
        } else if (n.nodeType === 3) {
          wrapText(n);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
