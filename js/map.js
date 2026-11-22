// Interactive map: switch between the floor plan and the Jupiter & Venus view, and fill in the seat counts.
(function () {
  'use strict';
  const rooms = window.LHC_ROOMS || [];
  document.querySelectorAll('[data-room-cap]').forEach(el => {
    const room = rooms.find(r => r.id === el.dataset.roomCap);
    if (room) el.textContent = `${room.capacity} seater`;
  });

  const bar = document.querySelector('.map-tabs');
  const views = { plan: document.getElementById('view-plan'), jv: document.getElementById('view-jv') };
  if (!bar || !views.plan || !views.jv) return;

  function show(name, remember) {
    if (!views[name]) name = 'plan';
    // SVG groups have no .hidden property, so the attribute is set directly.
    views.plan.toggleAttribute('hidden', name !== 'plan');
    views.jv.toggleAttribute('hidden', name !== 'jv');
    bar.querySelectorAll('.map-tab').forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.view === name)));
    if (remember) {
      // Keep the chosen view in the address so that Back and reload return to it.
      try { history.replaceState(null, '', name === 'jv' ? '?view=jv' : location.pathname); } catch { /* ignore */ }
    }
  }
  bar.addEventListener('click', e => {
    const tab = e.target.closest('.map-tab');
    if (tab) show(tab.dataset.view, true);
  });
  bar.hidden = false;      // the buttons need this script, so they only appear when it runs
  show(new URLSearchParams(location.search).get('view') === 'jv' ? 'jv' : 'plan', false);
})();
