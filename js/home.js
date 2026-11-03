(function () {
  'use strict';
  const { esc, parseDate, part, dateLong, timeLabel, typeOf } = window.LHC_FMT;
  const Store = window.LHC_STORE;
  const rooms = window.LHC_ROOMS || [];
  const roomName = id => (rooms.find(r => r.id === id) || {}).name || 'Classroom';

  const list = document.getElementById('room-list');
  list.innerHTML = rooms.map(room => `<li><a class="room-link" href="room.html?room=${encodeURIComponent(room.id)}"><span class="room-name">${esc(room.name)}</span><span class="room-cap">${room.capacity} seats</span></a></li>`).join('');

  // ---------- My events: bookmarks saved on this device ----------
  // Classes are shown one date at a time (pick a date); exams are listed all together.
  const box = document.getElementById('my-events');
  const flag = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"/></svg>';
  const today = () => window.LHC_FMT.todayISO();
  const nowStamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  let classDate = null;

  function row(e, lead) {
    const href = `room.html?room=${encodeURIComponent(e.roomId)}&event=${encodeURIComponent(e.id)}`;
    const meta = lead === 'time'
      ? [roomName(e.roomId), e.professor ? `Prof. ${e.professor}` : ''].filter(Boolean)
      : [roomName(e.roomId), `${timeLabel(e.start)} – ${timeLabel(e.end)}`];
    let block;
    if (lead === 'time') {
      const [t, ap] = timeLabel(e.start).split(' ');
      block = `<b>${esc(t)}</b><span>${esc(ap)}</span>`;
    } else {
      const d = parseDate(e.date);
      block = `<b>${esc(d ? d.getDate() : '')}</b><span>${esc(d ? part(d, { month: 'short' }) : '')}</span>`;
    }
    return `<li class="my-item${`${e.date}T${e.end}` < nowStamp() ? ' past' : ''}" data-type="${typeOf(e.type)}">
      <a class="my-open" href="${href}" aria-label="${esc(e.title)}, ${esc(meta.join(', '))}, ${esc(dateLong(e.date))}">
        <span class="my-date">${block}</span>
        <span class="my-text"><span class="my-title">${esc(e.title)}</span><span class="my-meta">${esc(meta.join(' · '))}</span></span>
      </a>
      <button type="button" class="my-remove" data-remove="${esc(e.id)}" aria-label="Remove ${esc(e.title)} from My events" title="Remove" aria-pressed="true">${flag}</button>
    </li>`;
  }

  function classesColumn(classes) {
    let html = '<section class="my-col" aria-labelledby="my-classes"><h3 id="my-classes">Classes</h3>';
    if (!classes.length) return `${html}<p class="my-empty">Bookmark a class to see it here by date.</p></section>`;
    const dates = [...new Set(classes.map(e => e.date))];
    if (!classDate || !dates.includes(classDate)) classDate = dates.includes(today()) ? today() : (dates.find(d => d > today()) || dates[dates.length - 1]);
    html += `<div class="date-strip my-dates" aria-label="Class dates">${dates.map(date => {
      const d = parseDate(date), selected = date === classDate;
      return `<button type="button" class="date-pill${selected ? ' selected' : ''}" data-class-date="${esc(date)}" aria-pressed="${selected}" aria-label="${esc(dateLong(date))}"><span>${esc(date === today() ? 'Today' : d ? part(d, { weekday: 'short' }) : '')}</span><b>${esc(d ? `${d.getDate()} ${part(d, { month: 'short' })}` : date)}</b></button>`;
    }).join('')}</div>`;
    return `${html}<ul class="my-list">${classes.filter(e => e.date === classDate).map(e => row(e, 'time')).join('')}</ul></section>`;
  }

  function listColumn(id, title, events, empty) {
    return `<section class="my-col" aria-labelledby="${id}"><h3 id="${id}">${title}</h3>${events.length ? `<ul class="my-list">${events.map(e => row(e, 'date')).join('')}</ul>` : `<p class="my-empty">${empty}</p>`}</section>`;
  }

  function renderMyEvents() {
    const all = Store.bookmarks.list();
    let html = `<h2 class="section-title" id="my-title">${flag}My events</h2>`;
    if (!all.length) html += '<p class="my-empty">Open a classroom and tap the bookmark on an event to keep it here.</p>';
    else {
      const other = all.filter(e => typeOf(e.type) === 'other');
      html += `<div class="my-cols">${classesColumn(all.filter(e => e.type === 'class'))}${listColumn('my-exams', 'Exams', all.filter(e => e.type === 'exam'), 'Bookmark an exam to see it here.')}</div>`;
      if (other.length) html += `<div class="my-cols"><section class="my-col" aria-labelledby="my-other"><h3 id="my-other">Other</h3><ul class="my-list">${other.map(e => row(e, 'date')).join('')}</ul></section></div>`;
    }
    box.innerHTML = html;
  }

  box.addEventListener('click', e => {
    const pill = e.target.closest('[data-class-date]');
    if (pill) { classDate = pill.dataset.classDate; renderMyEvents(); return; }
    const button = e.target.closest('[data-remove]');
    if (!button) return;
    try { Store.bookmarks.remove(button.dataset.remove); } catch (error) { console.error(error); }
    renderMyEvents();
  });

  renderMyEvents();

  // Refresh the saved copies from the latest events (times may have changed, or an event may have been deleted).
  (async function refresh() {
    const ids = [...new Set(Store.bookmarks.list().map(b => b.roomId))];
    if (!ids.length) return;
    try { await Store.init(); } catch (error) { console.error(error); return; }
    for (const id of ids) {
      try { Store.bookmarks.sync(id, await Store.listEvents(id)); } catch (error) { console.error(error); }
    }
    renderMyEvents();
  })();

  Store.subscribe(change => { if (change.type === 'bookmarks') renderMyEvents(); });
})();
