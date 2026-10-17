(function () {
  'use strict';
  const rooms = window.LHC_ROOMS || [];
  document.querySelectorAll('[data-room-cap]').forEach(el => {
    const room = rooms.find(r => r.id === el.dataset.roomCap);
    if (room) el.textContent = `${room.capacity} seater`;
  });
})();
