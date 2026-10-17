(function () {
  'use strict';
  const list = document.getElementById('room-list');
  (window.LHC_ROOMS || []).forEach(room => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'room-link';
    a.href = `room.html?room=${encodeURIComponent(room.id)}`;
    const name = document.createElement('span'); name.className = 'room-name'; name.textContent = room.name;
    const cap = document.createElement('span'); cap.className = 'room-cap'; cap.textContent = `${room.capacity} seats`;
    a.append(name, cap); li.appendChild(a); list.appendChild(li);
  });
})();
