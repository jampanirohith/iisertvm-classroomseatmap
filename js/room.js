(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const parseDate = iso => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(+d) ? null : d; };
  const fmt = (d, opts) => new Intl.DateTimeFormat('en-GB', opts).format(d);
  const dateLong = iso => { const d = parseDate(iso); return d ? `${fmt(d, { weekday: 'short' })}, ${d.getDate()} ${fmt(d, { month: 'long' })}, ${d.getFullYear()}` : String(iso || ''); };
  const dateShort = iso => { const d = parseDate(iso); return d ? `${fmt(d, { weekday: 'short' })}, ${d.getDate()} ${fmt(d, { month: 'short' })}`.toUpperCase() : String(iso || ''); };
  const timeLabel = v => { const [h, m] = String(v || '').slice(0, 5).split(':').map(Number); if (!Number.isFinite(h) || !Number.isFinite(m)) return String(v || ''); return `${pad(h % 12 || 12)}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`; };
  const when = e => `${e.date}T${e.start}`;
  const TYPE = { class: 'Class', exam: 'Exam', other: 'Other' };
  const NAME_KEY = 'lhc-name';
  const ROLL_KEY = 'lhc-roll-number';

  const Store = window.LHC_STORE;
  const params = new URLSearchParams(location.search);
  const room = (window.LHC_ROOMS || []).find(r => r.id === params.get('room'));
  const root = $('room-body');
  const toastEl = $('toast');
  let toastTimer;
  const notify = message => { toastEl.textContent = message; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3400); };
  const hideEventTools = () => { $('event-bar').hidden = true; $('add-event').hidden = true; };

  if (!room) {
    document.title = 'Classroom not found - IISER TVM';
    $('room-title').textContent = 'Classroom not found';
    hideEventTools();
    root.innerHTML = '<p class="pending">Choose a classroom from the <a href="index.html">Lecture Hall Complex</a> list.</p>';
    return;
  }
  document.title = `${room.name} - Lecture Hall Complex - IISER TVM`;
  $('room-title').textContent = room.name;
  $('room-sub').textContent = `Lecture Hall Complex | ${room.capacity} seats`;

  if (!room.layout) {
    hideEventTools();
    root.innerHTML = `<div class="pending"><h2>Seating arrangement</h2><p>The seating arrangement for ${esc(room.name)} will be added soon.</p></div>`;
    return;
  }

  const magnifier = plus => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7"/><path d="M16 16l5 5M7.5 10.5h6${plus ? 'M10.5 7.5v6' : ''}"/></svg>`;
  root.innerHTML = `
    <div class="map-scroll" id="map-scroll"><div class="map-sizer" id="map-sizer"><div class="hall" id="hall"></div></div></div>
    <div class="legend-bar">
      <div class="legend" aria-label="Seat status legend" id="seat-legend"></div>
      <div class="event-info" id="event-info"></div>
    </div>
    <div class="zoom-tools" role="group" aria-label="Zoom">
      <button type="button" data-zoom="in" aria-label="Zoom in">${magnifier(true)}</button>
      <button type="button" data-zoom="out" aria-label="Zoom out">${magnifier(false)}</button>
    </div>`;

  const state = { events: [], eventId: null, bookings: {}, scale: 1, manualZoom: false };
  const currentEvent = () => state.events.find(e => String(e.id) === String(state.eventId)) || null;

  // ---------- seating map ----------
  function segments(row) {
    const breaks = row.aislesAfter || [];
    const out = [];
    let cur = [];
    row.seats.forEach((id, i) => { if (i > 0 && breaks.includes(i)) { out.push(cur); cur = []; } cur.push(id); });
    out.push(cur);
    return out;
  }

  function hallHtml() {
    const L = room.layout, rows = L.rows, ex = L.exits || {}, stairs = L.sideStairs || null;
    const door = () => '<span class="door">EXIT</span>';
    const line = (left, mid, right, cls) => `<div class="line${cls ? ' ' + cls : ''}"><div class="gutter gutter-left">${left}</div><div class="cells">${mid}</div><div class="gutter gutter-right">${right}</div></div>`;
    const blank = n => `<span class="span" style="--n:${n}"></span>`;
    const middle = segs => (segs.length >= 3 ? 1 : 0);
    const aisleClass = L.aisleLabel ? 'aisle stairs' : 'aisle';
    const labelRow = Math.floor(rows.length / 2);
    const tailSize = r => (r.tail ? r.tail.cols + 1 : 0);
    const ref = rows.reduce((best, r) => { const size = r.seats.length + (r.lead || 0) + tailSize(r); return size >= best.size ? { size, row: r } : best; }, { size: 0, row: rows[0] }).row;
    const chairs = n => `<span class="span chairs" style="--n:${n}">${'<i class="chair"></i>'.repeat(n)}</span>`;

    // Builds a full-width line that follows the column structure of the widest row.
    const skeleton = (row, parts) => {
      const segs = segments(row);
      let html = row.lead ? blank(row.lead) : '';
      segs.forEach((seg, i) => { if (i > 0) html += parts.aisle(i - 1); html += parts.seg(i, seg, segs); });
      if (row.tail) html += `<span class="span tail" style="--n:${row.tail.cols}"></span>`;
      return html;
    };
    // Runs of consecutive rows whose right-hand tail is stairs, so each run reads as one flight.
    const tailRun = i => {
      if (!rows[i].tail) return null;
      const kind = rows[i].tail.kind;
      let a = i, b = i;
      while (a > 0 && rows[a - 1].tail && rows[a - 1].tail.kind === kind) a--;
      while (b < rows.length - 1 && rows[b + 1].tail && rows[b + 1].tail.kind === kind) b++;
      return { kind, a, b };
    };
    const seat = id => {
      const ev = currentEvent();
      const canMark = Boolean(ev && ev.type === 'exam');
      const b = canMark ? state.bookings[id] : null;
      const identity = b ? [b.name, b.rollNumber].filter(Boolean).join(' · ') : '';
      const label = b
        ? `Seat ${id}, marked${b.mine ? ' by you' : ''}${identity ? ' (' + identity + ')' : ''}`
        : canMark ? `Seat ${id}, available to mark` : `Seat ${id}; seat marking is available for exams only`;
      const cls = `seat${id.length > 2 ? ' long' : ''}${b ? (b.mine ? ' mine' : ' booked') : ''}${canMark ? '' : ' readonly'}`;
      return `<button type="button" class="${cls}" data-seat="${esc(id)}" aria-label="${esc(label)}" title="${esc(label)}" aria-disabled="${!canMark || Boolean(b)}"${b ? ' disabled' : ''}>${esc(id)}</button>`;
    };

    const front = ex.front || [];
    const refSegs = segments(ref), mid = middle(refSegs);
    const bFrom = L.board ? L.board.from : mid, bTo = L.board ? L.board.to : mid;
    const frontHtml = line(front.includes('left') ? door() : '', skeleton(ref, {
      aisle: k => (k >= bFrom && k < bTo ? '' : '<span class="aisle"></span>'),   // aisles under the board are part of it
      seg: (i, seg) => {
        if (i < bFrom || i > bTo) return blank(seg.length);
        if (i > bFrom) return '';
        const n = refSegs.slice(bFrom, bTo + 1).reduce((sum, s) => sum + s.length, 0);
        return `<span class="span board" style="--n:${n};--k:${bTo - bFrom}">BOARD</span>`;
      }
    }), front.includes('right') ? door() : '', 'front');

    // Unnumbered chairs standing on the floor in front of the first row.
    const looseHtml = L.looseChairs ? line('', skeleton(ref, {
      aisle: () => '<span class="aisle"></span>',
      seg: (i, seg) => (i < L.looseChairs.segments ? chairs(seg.length) : blank(seg.length))
    }), '', 'loose') : '';

    const seatRows = rows.map((row, i) => {
      let cells = '';
      if (row.lead) {
        const inStairs = stairs && stairs.side === 'left' && i >= stairs.fromRow && i <= stairs.toRow;
        const edge = inStairs ? `${i === stairs.fromRow ? ' first' : ''}${i === stairs.toRow ? ' last' : ''}` : '';
        const label = inStairs && i === Math.round((stairs.fromRow + stairs.toRow) / 2) ? '<i class="vlabel">STAIRS</i>' : '';
        cells += `<span class="span lead${inStairs ? ' stairs' + edge : ''}" style="--n:${row.lead}">${label}</span>`;
      }
      segments(row).forEach((seg, s) => {
        if (s > 0) cells += `<span class="${aisleClass}">${L.aisleLabel && i === labelRow ? `<i class="vlabel">${esc(L.aisleLabel)}</i>` : ''}</span>`;
        cells += seg.map(seat).join('');
      });
      if (row.tail) {
        const run = tailRun(i);
        if (run.kind === 'stairs') {
          const edge = `${i === run.a ? ' first' : ''}${i === run.b ? ' last' : ''}`;
          const label = i === Math.round((run.a + run.b) / 2) ? '<i class="vlabel">STAIRS</i>' : '';
          cells += `<span class="span tail stairs${edge}" style="--n:${row.tail.cols}">${label}</span>`;
        } else {
          cells += `<span class="span tail platform" style="--n:${row.tail.cols}">${chairs(row.tail.cols)}</span>`;
        }
      }
      const sides = ex.sides || [];
      return line(sides.some(d => d.row === i && d.side === 'left') ? door() : '', cells, sides.some(d => d.row === i && d.side === 'right') ? door() : '');
    }).join('');

    const rear = ex.rear || [];
    const rearHtml = rear.length ? line('', skeleton(ref, {
      aisle: k => `<span class="aisle rear">${rear.some(d => d.at === 'aisle' && d.index === k) ? door() : ''}</span>`,
      seg: (i, seg, segs) => (i === middle(segs) ? `<span class="span rear-mid" style="--n:${seg.length}">${rear.some(d => d.at === 'center') ? door() : ''}</span>` : blank(seg.length))
    }), '', 'rear') : '';
    return frontHtml + looseHtml + seatRows + rearHtml;
  }

  function renderHall() { $('hall').innerHTML = hallHtml(); applyScale(); }

  // ---------- zoom: the map fills the screen ----------
  function applyScale() {
    const hall = $('hall'), sizer = $('map-sizer'), w = hall.offsetWidth, h = hall.offsetHeight;
    if (!w) return;
    hall.style.transform = `scale(${state.scale})`;
    sizer.style.width = `${Math.ceil(w * state.scale)}px`;
    sizer.style.height = `${Math.ceil(h * state.scale)}px`;
  }
  function fitScale() {
    const hall = $('hall'), box = $('map-scroll');
    const w = hall.offsetWidth, h = hall.offsetHeight;
    if (!w || !h) return 1;
    // On phones, retain comfortable seat sizes and let the map pan in both directions.
    // Scaling the full hall to the screen made seat buttons too small to use accurately.
    if (window.matchMedia && window.matchMedia('(max-width: 759px)').matches) return 1;
    const availW = box.clientWidth - 28;
    if (availW <= 0) return 1;
    // The natural seat dimensions are the priority. Only scale down slightly if a
    // very wide auditorium cannot fit horizontally; never compress to fit height.
    const widthScale = availW / w;
    return Math.max(0.9, Math.min(1.08, widthScale));
  }
  function refit() { if (!state.manualZoom) state.scale = fitScale(); applyScale(); }
  document.querySelectorAll('[data-zoom]').forEach(btn => btn.addEventListener('click', () => {
    state.manualZoom = true;
    state.scale = Math.max(0.4, Math.min(3.2, state.scale * (btn.dataset.zoom === 'in' ? 1.2 : 1 / 1.2)));
    applyScale();
  }));
  window.addEventListener('resize', () => {
    if (window.matchMedia && window.matchMedia('(max-width: 759px)').matches && !state.manualZoom) state.scale = 1;
    refit(); updateArrows();
  });

  // ---------- header, event chips, summary ----------
  function renderHeader() {
    // Keep the room identity stable; selected event details live in the timeline and footer.
    $('room-title').textContent = room.name;
    const ev = currentEvent();
    $('room-sub').textContent = ev
      ? `${room.capacity} seats · ${dateLong(ev.date)} · ${timeLabel(ev.start)}${ev.professor ? ' · Prof. ' + ev.professor : ''}`
      : `Lecture Hall Complex | ${room.capacity} seats`;
  }
  function updateArrows() {
    const strip = $('event-strip');
    const overflow = strip.scrollWidth > strip.clientWidth + 2;
    $('strip-left').hidden = !overflow || strip.scrollLeft <= 2;
    $('strip-right').hidden = !overflow || strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;
  }
  function renderStrip() {
    const strip = $('event-strip');
    if (!state.events.length) { strip.innerHTML = '<span class="strip-empty">No events yet. Add an event to get started.</span>'; updateArrows(); return; }
    let html = '', lastDate = null;
    state.events.forEach(e => {
      if (e.date !== lastDate) {
        const d = parseDate(e.date);
        const day = d ? fmt(d, { weekday: 'short' }).toUpperCase() : '';
        const date = d ? `${d.getDate()} ${fmt(d, { month: 'short' }).toUpperCase()}` : dateShort(e.date);
        html += `<span class="chip-date"><span class="chip-date-day">${esc(day)}</span><span class="chip-date-date">${esc(date)}</span></span>`;
        lastDate = e.date;
      }
      const selected = String(e.id) === String(state.eventId);
      const type = TYPE[e.type] ? e.type : 'other';
      html += `<button type="button" class="chip${selected ? ' selected' : ''}" data-event="${esc(e.id)}" data-type="${type}" title="${esc(e.title)} · ${esc(TYPE[type])}" aria-label="${esc(e.title)}, ${esc(TYPE[type])}, ${esc(dateLong(e.date))}, ${esc(timeLabel(e.start))}" aria-pressed="${selected}"><span class="chip-time">${esc(timeLabel(e.start))}</span><span class="chip-sub">${esc(e.title)}</span></button>`;
    });
    strip.innerHTML = html;
    const sel = strip.querySelector('.chip.selected');
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
    updateArrows();
  }
  function renderLegend() {
    const legend = $('seat-legend');
    const ev = currentEvent();
    const loose = room.layout.looseChairs || room.layout.rows.some(r => r.tail && r.tail.kind === 'platform') ? '<span><i class="sw chair"></i>Loose chair (no number)</span>' : '';
    if (ev && ev.type === 'exam') {
      legend.innerHTML = `<span><i class="sw"></i>Available</span><span><i class="sw marked"></i>Marked</span><span><i class="sw mine"></i>Your seat</span><span><i class="sw exit"></i>Exit</span>${loose}`;
    } else {
      legend.innerHTML = `<span class="legend-note">${ev ? 'Seat marking is available for exams only.' : 'Choose an exam to mark your seat.'}</span><span><i class="sw exit"></i>Exit</span>${loose}`;
    }
  }
  function renderInfo() {
    const el = $('event-info'), ev = currentEvent();
    if (!ev) { el.textContent = ''; return; }
    const bits = ev.type === 'exam'
      ? [`${Object.keys(state.bookings).length} of ${room.capacity} seats marked`]
      : ['Seat marking is available for exams only'];
    if (ev.note) bits.push(ev.note);
    const ownMark = ev.type === 'exam' ? Object.entries(state.bookings).find(([, mark]) => mark.mine) : null;
    const changeSeat = ownMark ? ' <button type="button" class="link-btn" id="release-seat">Change my seat</button>' : '';
    const deleteButton = Store.canDelete(ev) ? ' <button type="button" class="link-btn" id="delete-event">Delete event</button>' : '';
    el.innerHTML = `${bits.map(esc).join(' &middot; ')}${changeSeat}${deleteButton}`;
  }
  function renderAll() { renderHeader(); renderStrip(); renderLegend(); renderInfo(); renderHall(); refit(); }

  function defaultEvent(events) {
    const wanted = params.get('event');
    if (wanted && events.some(e => String(e.id) === wanted)) return wanted;
    const now = new Date(), stamp = `${todayISO()}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const pick = events.find(e => when(e) >= stamp) || events[events.length - 1];
    return pick ? String(pick.id) : null;
  }
  function syncUrl() {
    const p = new URLSearchParams();
    p.set('room', room.id);
    if (state.eventId) p.set('event', state.eventId);
    try { history.replaceState(null, '', `${location.pathname}?${p}`); } catch { /* ignore */ }
  }
  async function loadEvents() { state.events = (await Store.listEvents(room.id)).sort((a, b) => when(a).localeCompare(when(b))); }
  async function loadBookings() { const ev = currentEvent(); state.bookings = ev && ev.type === 'exam' ? await Store.listBookings(ev.id) : {}; }
  async function refreshBookings() { await loadBookings(); renderInfo(); renderHall(); refit(); }
  async function selectEvent(id) {
    state.eventId = id ? String(id) : null;
    try { await loadBookings(); } catch (error) { console.error(error); state.bookings = {}; notify('Could not load seat marks for this exam.'); }
    syncUrl();
    renderAll();
  }

  $('event-strip').addEventListener('click', e => {
    const chip = e.target.closest('[data-event]');
    if (chip && chip.dataset.event !== String(state.eventId)) selectEvent(chip.dataset.event);
  });
  $('event-strip').addEventListener('scroll', updateArrows);
  $('strip-left').addEventListener('click', () => $('event-strip').scrollBy({ left: -260, behavior: 'smooth' }));
  $('strip-right').addEventListener('click', () => $('event-strip').scrollBy({ left: 260, behavior: 'smooth' }));
  $('event-info').addEventListener('click', async e => {
    const ev = currentEvent();
    if (!ev) return;
    if (e.target.closest('#delete-event')) {
      if (!confirm(`Delete "${ev.title}" and all of its seat marks? This cannot be undone.`)) return;
      try {
        await Store.deleteEvent(ev);
        await loadEvents();
        await selectEvent(defaultEvent(state.events));
        notify('Event deleted.');
      } catch (error) { console.error(error); notify(error.message || 'Could not delete this event.'); }
      return;
    }
    if (e.target.closest('#release-seat')) {
      const ownMark = Object.entries(state.bookings).find(([, mark]) => mark.mine);
      if (!ownMark || !confirm(`Release seat ${ownMark[0]} so you can select another seat?`)) return;
      try {
        await Store.releaseSeat(ev.id, ownMark[0]);
        await refreshBookings();
        notify('Your seat mark was released. Select another seat when ready.');
      } catch (error) { console.error(error); notify(error.message || 'Could not release your seat.'); }
    }
  });

  // ---------- add one non-recurring event ----------
  const eventDialog = $('event-dialog'), seatDialog = $('seat-dialog');
  function updateEventControls() {
    $('professor-field').hidden = $('event-type').value !== 'class';
    $('event-professor').required = false;
  }
  $('event-type').addEventListener('change', updateEventControls);
  $('add-event').addEventListener('click', () => {
    $('event-form').reset();
    $('event-date').value = todayISO();
    $('event-start').value = '10:00';
    $('event-end').value = '11:00';
    $('event-dialog-title').textContent = `Add event to ${room.name}`;
    updateEventControls();
    eventDialog.showModal();
    $('event-title').focus();
  });
  document.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog').close()));
  $('event-form').addEventListener('submit', async e => {
    e.preventDefault();
    const ev = {
      title: $('event-title').value.trim(),
      type: $('event-type').value,
      date: $('event-date').value,
      start: $('event-start').value,
      end: $('event-end').value,
      professor: $('event-professor').value.trim(),
      note: $('event-note').value.trim()
    };
    if (!ev.title || !ev.date || !ev.start || !ev.end || ev.end <= ev.start) {
      notify('Enter an event name, date, and valid start and end times.');
      return;
    }
    try {
      // Friendly client check; PostgreSQL exclusion constraint is authoritative for concurrent requests.
      const existing = await Store.listEvents(room.id);
      if (existing.some(prev => prev.date === ev.date && ev.start < prev.end && ev.end > prev.start)) {
        notify(`There is already an event in this room on ${dateLong(ev.date)} that overlaps this time.`);
        $('event-start').focus();
        return;
      }
      const saved = await Store.addEvent(room.id, ev);
      await loadEvents();
      eventDialog.close();
      await selectEvent(saved.id);
      notify('Event added. Keep this browser’s site data so you can delete the event later.');
    } catch (error) { console.error(error); notify(error.message || 'Could not save the event. Please try again.'); }
  });

  // ---------- exam seat marking ----------
  let seatToMark = null;
  $('hall').addEventListener('click', e => {
    const btn = e.target.closest('.seat');
    if (!btn || btn.disabled) return;
    const ev = currentEvent();
    if (!ev) { notify(state.events.length ? 'Choose an exam to mark your seat.' : 'Add an exam to mark your seat.'); return; }
    if (ev.type !== 'exam') { notify('Seat marking is available for exams only.'); return; }
    seatToMark = btn.dataset.seat;
    $('seat-no').textContent = seatToMark;
    $('seat-event').textContent = `${ev.title} · ${dateLong(ev.date)} · ${timeLabel(ev.start)} – ${timeLabel(ev.end)}`;
    let savedName = '', savedRoll = '';
    try {
      savedName = localStorage.getItem(NAME_KEY) || '';
      savedRoll = localStorage.getItem(ROLL_KEY) || '';
    } catch { /* optional convenience only */ }
    $('seat-name').value = savedName;
    $('seat-roll').value = savedRoll;
    seatDialog.showModal();
    $('seat-name').focus();
  });
  $('seat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('seat-name').value.trim();
    const roll = $('seat-roll').value.trim();
    if (!name && !roll) { notify('Enter your name, roll number, or both.'); return; }
    const ev = currentEvent();
    if (!ev || ev.type !== 'exam') { seatDialog.close(); notify('Seat marking is available for exams only.'); return; }
    try {
      const result = await Store.book(state.eventId, seatToMark, name, roll);
      if (!result.ok) {
        const messages = {
          seat_taken: 'That seat has just been marked by someone else.',
          taken: 'That seat has just been marked by someone else.',
          roll_taken: 'That roll number is already marked for this exam.',
          already_marked: 'This browser has already marked a seat for this exam. Use “Change my seat” to move it.',
          duplicate: 'A duplicate seat mark or roll number was detected.'
        };
        notify(messages[result.reason] || 'This seat could not be marked. Refresh and try again.');
        await refreshBookings();
        return;
      }
      try {
        if (name) localStorage.setItem(NAME_KEY, name);
        if (roll) localStorage.setItem(ROLL_KEY, roll);
      } catch { /* remembering fields is optional */ }
      seatDialog.close();
      await refreshBookings();
      notify(`Seat ${seatToMark} marked.`);
    } catch (error) { console.error(error); notify(error.message || 'Could not mark your seat. Please try again.'); }
  });

  Store.subscribe(async change => {
    if (change.type === 'events' && (!change.roomId || change.roomId === room.id)) {
      await loadEvents();
      if (state.eventId && !state.events.some(x => String(x.id) === String(state.eventId))) state.eventId = null;
      renderHeader(); renderStrip(); renderLegend();
      await refreshBookings();
    } else if (change.type === 'bookings' && currentEvent()?.type === 'exam' && (!change.eventId || String(change.eventId) === String(state.eventId))) {
      await refreshBookings();
    }
  });

  // ---------- start ----------
  (async function start() {
    const status = await Store.init();
    if (status.error) notify(status.error);
    try { await loadEvents(); } catch (error) { console.error(error); state.events = []; notify('Could not load events.'); }
    state.eventId = defaultEvent(state.events);
    try { await loadBookings(); } catch (error) { console.error(error); state.bookings = {}; }
    syncUrl();
    renderAll();
  })();
})();
