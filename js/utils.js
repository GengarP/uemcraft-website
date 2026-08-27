/* ============================================================
   utils.js — 共享工具函数
   供所有页面复用，通过 window.UEMUtils 暴露。
   ============================================================ */
(function () {
  'use strict';

  /**
   * HTML 转义（防 XSS）
   */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 复制文本到剪贴板（含 textarea 降级）
   */
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

  /**
   * 零填充（0-9 → "00"-"09"）
   */
  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  /**
   * 设置 DOM 元素文本
   */
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /**
   * 显示表单消息
   */
  function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = 'wall-form-message';
    if (type) el.classList.add('is-' + type);
  }

  // 暴露到全局
  window.UEMUtils = {
    escapeHtml: escapeHtml,
    copyText: copyText,
    pad: pad,
    setText: setText,
    showMessage: showMessage
  };
})();
