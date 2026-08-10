/* ============================================================
   join.js — FAQ accordion
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq-q').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const wasOpen = item.classList.contains('is-open');

      // Close all
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('is-open'));

      // Open if was closed
      if (!wasOpen) item.classList.add('is-open');
    });
  });

});
