/* ============================================================
   events.js — 活动手风琴交互
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  const eventCards = document.querySelectorAll('.event-card[data-event]');

  eventCards.forEach(card => {
    card.addEventListener('click', function(e) {
      // Don't toggle if clicking a link inside
      if (e.target.closest('a')) return;

      const details = this.querySelector('.event-details');
      if (!details) return;

      // Close others
      eventCards.forEach(c => {
        const other = c.querySelector('.event-details');
        if (other && other !== details) {
          other.classList.remove('is-open');
        }
      });

      // Toggle current
      details.classList.toggle('is-open');
    });
  });

});
