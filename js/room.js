(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { esc, pad, todayISO, parseDate, part, dateLong, timeLabel, TYPE, typeOf } = window.LHC_FMT;
  const when = e => `${e.date}T${e.start}`;
  const NAME_KEY = 'lhc-name';

  const Store = window.LHC_STORE;
  const params = new URLSearchParams(location.search);
  const room = (window.LHC_ROOMS || []).find(r => r.id === params.get('room'));
  const root = $('room-body');
  const toastEl = $('toast');
  let toastTimer;
  const notify = message => { toastEl.textContent = message; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3400); };

  if (!room) {
    document.title = 'Classroom not found - IISER TVM';
    $('room-title').textContent = 'Classroom not found';
    $('add-event').hidden = true;
    root.innerHTML = '<p class="pending">Choose a classroom from the <a href="index.html">Lecture Hall Complex</a> list.</p>';
    return;
  }
  document.title = `${room.name} - Lecture Hall Complex - IISER TVM`;
  $('room-title').textContent = room.name;
  $('room-sub').textContent = `${room.capacity} seats`;
  $('add-event').href = `admin.html?room=${encodeURIComponent(room.id)}`;

  const flag = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"/></svg>';
  const zoomIcon = d => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${d}"/></svg>`;
  root.innerHTML = `
    <div class="map-scroll" id="map-scroll"><div class="map-sizer" id="map-sizer"><div class="hall" id="hall"></div></div></div>
    <div class="zoom-tools" role="group" aria-label="Zoom" id="zoom-tools">
      <button type="button" data-zoom="in" aria-label="Zoom in">${zoomIcon('M12 5v14M5 12h14')}</button>
      <button type="button" data-zoom="out" aria-label="Zoom out">${zoomIcon('M5 12h14')}</button>
      <button type="button" data-zoom="fit" aria-label="Fit whole classroom" title="Fit whole classroom">${zoomIcon('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')}</button>
    </div>`;

  const state = { events: [], eventId: null, date: null, bookings: {}, scale: 1, manualZoom: false, showWhole: false, lastScale: 0, rules: { marking: 'on', names: 'everyone' } };
  const currentEvent = () => state.events.find(e => String(e.id) === String(state.eventId)) || null;
  const hasLoose = Boolean(room.layout && (room.layout.looseChairs || room.layout.rows.some(r => r.tail && r.tail.kind === 'platform')));

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
      const isExam = Boolean(ev && ev.type === 'exam');
      const canMark = isExam && state.rules.marking === 'on';
      const b = isExam ? state.bookings[id] : null;
      const who = b ? shownName(b) : '';
      const label = b
        ? `Seat ${id}, marked${b.mine ? ' by you' : ''}${who ? ' (' + who + ')' : ''}`
        : canMark ? `Seat ${id}, available to mark` : `Seat ${id}`;
      const cls = `seat${id.length > 2 ? ' long' : ''}${b ? (b.mine ? ' mine' : ' booked') : ''}${canMark || b ? '' : ' readonly'}`;
      return `<button type="button" class="${cls}" data-seat="${esc(id)}" aria-label="${esc(label)}" title="${esc(label)}" aria-disabled="${!canMark && !b}">${esc(id)}</button>`;
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
        const label = inStairs && i === Math.round((stairs.fromRow + stairs.toRow) / 2) ? '<i class="vlabel">STAIRS</i>' : '';
        cells += `<span class="span lead${inStairs ? ' stairs' : ''}" style="--n:${row.lead}">${label}</span>`;
      }
      segments(row).forEach((seg, s) => {
        if (s > 0) cells += `<span class="${aisleClass}">${L.aisleLabel && i === labelRow ? `<i class="vlabel">${esc(L.aisleLabel)}</i>` : ''}</span>`;
        cells += seg.map(seat).join('');
      });
      if (row.tail) {
        const run = tailRun(i);
        if (run.kind === 'stairs') {
          const label = i === Math.round((run.a + run.b) / 2) ? '<i class="vlabel">STAIRS</i>' : '';
          cells += `<span class="span tail stairs" style="--n:${row.tail.cols}">${label}</span>`;
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

  function renderHall() { if (room.layout) { $('hall').innerHTML = hallHtml(); applyScale(); } }

  // ---------- zoom: whole room on larger screens; a readable size on phones (the fit button shows the whole room) ----------
  const MIN_SCALE = 0.2, MAX_SCALE = 3, PHONE_READABLE = 0.85;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const isPhone = () => Boolean(window.matchMedia && window.matchMedia('(max-width: 759px)').matches);

  function applyScale() {
    const hall = $('hall'), sizer = $('map-sizer'), w = hall.offsetWidth, h = hall.offsetHeight;
    if (!w) return;
    hall.style.transform = `scale(${state.scale})`;
    sizer.style.width = `${Math.ceil(w * state.scale)}px`;
    sizer.style.height = `${Math.ceil(h * state.scale)}px`;
  }
  // The scale that shows every seat at once. Phones may shrink the map a long way; larger screens keep seats readable.
  function fitScale() {
    const hall = $('hall'), box = $('map-scroll'), style = getComputedStyle(box);
    const w = hall.offsetWidth, h = hall.offsetHeight;
    const availW = box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availH = box.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (!w || !h || availW <= 0 || availH <= 0) return 1;
    const whole = Math.min(availW / w, availH / h);
    if (!isPhone()) return clamp(whole, 0.75, 1.3);
    return state.showWhole ? clamp(whole, MIN_SCALE, 1.4) : clamp(Math.max(whole, PHONE_READABLE), MIN_SCALE, 1.4);
  }
  function refit() {
    if (!room.layout) return;
    const box = $('map-scroll');
    if (!state.manualZoom) {
      state.scale = fitScale();
      box.classList.toggle('whole', isPhone() && state.showWhole);
      applyScale();
      // Only move the view when the scale changed, so marking a seat does not jump the map back.
      if (Math.abs(state.scale - state.lastScale) > 0.001) {
        state.lastScale = state.scale;
        box.scrollTop = 0;
        box.scrollLeft = isPhone() ? Math.max(0, (box.scrollWidth - box.clientWidth) / 2) : 0;
      }
    } else applyScale();
  }
  // Zoom around a point (cx, cy are relative to the map area) so the content under the fingers stays put.
  function zoomAt(next, cx, cy) {
    const box = $('map-scroll'), sizer = $('map-sizer');
    next = clamp(next, MIN_SCALE, MAX_SCALE);
    const ax = (box.scrollLeft + cx - sizer.offsetLeft) / state.scale, ay = (box.scrollTop + cy - sizer.offsetTop) / state.scale;
    state.manualZoom = true;
    state.scale = next;
    applyScale();
    box.scrollLeft = ax * next + sizer.offsetLeft - cx;
    box.scrollTop = ay * next + sizer.offsetTop - cy;
  }
  function wireZoom() {
    const box = $('map-scroll');
    $('zoom-tools').addEventListener('click', e => {
      const btn = e.target.closest('[data-zoom]');
      if (!btn) return;
      if (btn.dataset.zoom === 'fit') {
        // On phones this switches between a readable size and the whole classroom.
        state.showWhole = state.manualZoom ? false : !state.showWhole;
        state.manualZoom = false; state.lastScale = 0; refit();
        const label = state.showWhole ? 'Readable size' : 'Fit whole classroom';
        btn.title = label; btn.setAttribute('aria-label', label);
        return;
      }
      zoomAt(state.scale * (btn.dataset.zoom === 'in' ? 1.25 : 1 / 1.25), box.clientWidth / 2, box.clientHeight / 2);
    });
    // Pinch with two fingers on a touch screen, or Ctrl + scroll wheel on a computer.
    let pinch = null;
    const centre = t => { const r = box.getBoundingClientRect(); return { x: (t[0].clientX + t[1].clientX) / 2 - r.left, y: (t[0].clientY + t[1].clientY) / 2 - r.top, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) }; };
    box.addEventListener('touchstart', e => { if (e.touches.length === 2) { const c = centre(e.touches); pinch = { d: c.d, scale: state.scale }; } }, { passive: true });
    box.addEventListener('touchmove', e => {
      if (e.touches.length !== 2 || !pinch) return;
      e.preventDefault();
      const c = centre(e.touches);
      if (pinch.d > 0) zoomAt(pinch.scale * (c.d / pinch.d), c.x, c.y);
    }, { passive: false });
    const endPinch = e => { if (e.touches.length < 2) pinch = null; };
    box.addEventListener('touchend', endPinch, { passive: true });
    box.addEventListener('touchcancel', endPinch, { passive: true });
    box.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = box.getBoundingClientRect();
      zoomAt(state.scale * Math.exp(-e.deltaY / 300), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    window.addEventListener('resize', () => { refit(); });
    window.addEventListener('orientationchange', () => setTimeout(refit, 250));
    // The map area changes height when the event bar or footer changes; keep the whole classroom in view.
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (!state.manualZoom) refit(); }).observe(box);
  }

  // ---------- event strip and footer ----------
  // The event column shows one date at a time: pick a date, then choose among that day's events.
  const addDays = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return LHC_FMT.isoOf(d); };
  const dayLabel = iso => { const d = parseDate(iso); return d ? `${d.getDate()} ${part(d, { month: 'short' })}` : iso; };
  const calIcon = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>';
  let calMonth = null;
  // Phones: a row of day tiles (a dot marks days with events) instead of the three-date control.
  const DAY_SPAN = 30;
  function renderDays() {
    const strip = $('day-strip'), today = todayISO(), withEvents = new Set(state.events.map(e => e.date)), base = parseDate(state.date);
    $('top-cal').setAttribute('aria-expanded', String(!$('pk-pop').hidden));
    let html = '';
    for (let n = -DAY_SPAN; n <= DAY_SPAN; n++) {
      const date = addDays(state.date, n), d = parseDate(date), on = n === 0;
      html += `<button type="button" class="day-tile${on ? ' selected' : ''}${date === today ? ' today' : ''}${withEvents.has(date) ? ' has' : ''}" data-day="${date}" aria-pressed="${on}" aria-label="${esc(dateLong(date))}"><span>${esc(part(d, { weekday: 'short' }))}</span><b>${d.getDate()}</b></button>`;
    }
    strip.innerHTML = html;
    const sel = strip.querySelector('.selected');
    if (sel && strip.clientWidth) strip.scrollLeft = sel.offsetLeft - (strip.clientWidth - sel.offsetWidth) / 2;
  }
  function renderStrip() {
    const dates = $('date-strip'), strip = $('event-strip');
    $('event-bar').hidden = false;
    if (!state.date) state.date = (currentEvent() || { date: todayISO() }).date;
    // Yesterday, the chosen day and tomorrow, shown as real dates. Click the middle one for the calendar.
    dates.innerHTML = [-1, 0, 1].map(n => {
      const date = addDays(state.date, n), d = parseDate(date), mid = n === 0;
      return `<button type="button" class="date-pill${mid ? ' selected' : ''}" data-date="${esc(date)}" data-mid="${mid}" aria-label="${esc(dateLong(date))}${mid ? ', open calendar' : ''}" ${mid ? 'aria-haspopup="dialog" aria-expanded="' + !$('pk-pop').hidden + '"' : ''}><span>${esc(d ? part(d, { weekday: 'short' }) : '')}</span><b>${esc(dayLabel(date))}${mid ? calIcon : ''}</b></button>`;
    }).join('');
    $('date-today').hidden = $('top-today').hidden = state.date === todayISO();
    updateSummary();
    renderDays();
    if (!$('pk-pop').hidden) renderCal();
    strip.innerHTML = state.events.filter(e => e.date === state.date).map(e => {
      const selected = String(e.id) === String(state.eventId);
      const type = typeOf(e.type);
      const marked = Store.bookmarks.has(e.id);
      return `<div class="chip-wrap"><button type="button" class="chip${selected ? ' selected' : ''}" data-event="${esc(e.id)}" data-type="${type}" title="${esc(e.title)} · ${esc(TYPE[type])}" aria-label="${esc(e.title)}, ${esc(TYPE[type])}, ${esc(dateLong(e.date))}, ${esc(timeLabel(e.start))}" aria-pressed="${selected}"><span class="chip-time">${esc(timeLabel(e.start))}${type === 'class' ? '' : `<span class="chip-tag">${esc(TYPE[type])}</span>`}</span><span class="chip-sub">${esc(e.title)}</span></button><button type="button" class="chip-mark" data-bookmark="${esc(e.id)}" aria-pressed="${marked}" aria-label="${marked ? 'Remove bookmark from' : 'Bookmark'} ${esc(e.title)}" title="${marked ? 'Remove from My events' : 'Add to My events'}">${flag}</button></div>`;
    }).join('') || '<div class="no-events">No classes or events on this day</div>';
  }

  // ---------- phones: pull the dates and events up to see the whole classroom ----------
  const BAR_KEY = 'lhc-bar-collapsed';
  function updateSummary() {
    const ev = currentEvent();
    $('bar-sum').textContent = `${LHC_FMT.dateShort(state.date)} · ${ev ? `${ev.title}, ${timeLabel(ev.start)}` : state.events.some(e => e.date === state.date) ? 'Select an event' : 'No events'}`;
  }
  function setCollapsed(on, remember) {
    const bar = $('event-bar');
    bar.classList.toggle('collapsed', on);
    const handle = $('bar-handle');
    handle.setAttribute('aria-expanded', String(!on));
    handle.setAttribute('aria-label', on ? 'Show dates and events' : 'Hide dates and events to see the whole classroom');
    if (on) $('pk-pop').hidden = true;
    updateSummary();
    if (remember) { try { localStorage.setItem(BAR_KEY, on ? '1' : '0'); } catch { /* ignore */ } }
    // Collapsed: show the whole classroom. Expanded: back to the readable size.
    state.showWhole = on; state.manualZoom = false; state.lastScale = 0;
    const fit = document.querySelector('[data-zoom="fit"]');
    if (fit) { const label = on ? 'Readable size' : 'Fit whole classroom'; fit.title = label; fit.setAttribute('aria-label', label); }
    requestAnimationFrame(() => requestAnimationFrame(refit));
  }
  $('bar-handle').addEventListener('click', () => setCollapsed(!$('event-bar').classList.contains('collapsed'), true));
  (() => {
    let t = null;
    const bar = $('event-bar');
    bar.addEventListener('touchstart', e => { t = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
    bar.addEventListener('touchend', e => {
      if (!t || !isPhone()) return;
      const c = e.changedTouches[0], dx = c.clientX - t.x, dy = c.clientY - t.y;
      t = null;
      if (Math.abs(dy) < 36 || Math.abs(dy) < Math.abs(dx) * 1.5) return;
      const collapsed = bar.classList.contains('collapsed');
      if (dy < 0 && !collapsed) setCollapsed(true, true);
      else if (dy > 0 && collapsed) setCollapsed(false, true);
    }, { passive: true });
  })();

  function renderCal() {
    const pop = $('pk-pop'), base = parseDate(calMonth || state.date) || new Date();
    const y = base.getFullYear(), m = base.getMonth(), first = new Date(y, m, 1, 12), lead = (first.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate(), withEvents = new Set(state.events.map(e => e.date)), today = todayISO();
    const cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(w => `<i class="pk-dow">${w}</i>`);
    for (let i = 0; i < lead; i++) cells.push('<i></i>');
    for (let day = 1; day <= days; day++) {
      const iso = `${y}-${pad(m + 1)}-${pad(day)}`;
      cells.push(`<button type="button" class="pk-day${iso === state.date ? ' on' : ''}${iso === today ? ' today' : ''}${withEvents.has(iso) ? ' has' : ''}" data-pick="${iso}" aria-label="${esc(dateLong(iso))}">${day}</button>`);
    }
    pop.innerHTML = `<div class="pk-head"><button type="button" data-month="-1" aria-label="Previous month">‹</button><b>${esc(part(first, { month: 'long' }))} ${y}</b><button type="button" data-month="1" aria-label="Next month">›</button></div><div class="pk-grid">${cells.join('')}</div><button type="button" class="pk-today" data-pick="${today}">Today</button>`;
  }
  function toggleCal(open) {
    const pop = $('pk-pop');
    pop.hidden = open === undefined ? !pop.hidden : !open;
    if (!pop.hidden) { calMonth = state.date; renderCal(); }
    renderStrip();
  }
  async function goDate(iso) {
    if (!parseDate(iso)) return;
    // Changing the day never picks an event: the person taps one.
    state.date = iso; state.eventId = null; state.bookings = {};
    syncUrl(); renderAll();
  }
  // The name shown on a marked seat: the admin can limit names to the person who marked the seat.
  const shownName = b => (state.rules.names === 'self' && !b.mine ? '' : b.name || '');
  // Seats this device marked for the selected exam.
  const mySeats = () => Object.entries(state.bookings).filter(([, b]) => b.mine).map(([seat]) => seat).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  function renderFoot() {
    const foot = $('room-foot'), ev = currentEvent();
    const legend = [];
    if (ev && ev.type === 'exam') {
      if (state.rules.marking === 'on') legend.push('<span><i class="sw"></i>Available</span>');
      legend.push('<span><i class="sw marked"></i>Marked</span>', '<span><i class="sw mine"></i>Yours</span>');
    }
    if (hasLoose) legend.push('<span><i class="sw loose"></i>Loose chair, no number</span>');
    let html = '';
    if (ev) {
      const marked = Store.bookmarks.has(ev.id);
      const bits = [dateLong(ev.date), `${timeLabel(ev.start)} – ${timeLabel(ev.end)}`];
      if (ev.professor) bits.push(`Prof. ${ev.professor}`);
      if (ev.type === 'exam') bits.push(state.rules.marking === 'on' ? `${Object.keys(state.bookings).length} of ${room.capacity} seats marked` : 'Seat marking is turned off');
      const seats = ev.type === 'exam' ? mySeats() : [];
      html += `<div class="foot-event"><strong>${esc(ev.title)}</strong>${seats.length ? `<em class="my-seat">Your seat: ${esc(seats.join(', '))}</em>` : ''}<span>${bits.map(esc).join(' · ')}${ev.note ? `<br>${esc(ev.note)}` : ''}</span></div>`;
      html += `<button type="button" class="bookmark-btn" data-bookmark="${esc(ev.id)}" aria-pressed="${marked}">${flag}<span>${marked ? 'In My events' : 'Add to My events'}</span></button>`;
    }
    if (!ev && state.events.some(e => e.date === state.date)) html += '<div class="foot-hint">Tap an event above to see its details and seats.</div>';
    if (legend.length) html += `<div class="legend" aria-label="Seat key">${legend.join('')}</div>`;
    foot.innerHTML = html;
    foot.hidden = !html;
  }
  function renderAll() { renderStrip(); renderFoot(); renderHall(); refit(); }

  function toggleBookmark(id) {
    const ev = state.events.find(e => String(e.id) === String(id));
    if (!ev) return;
    try {
      const now = Store.bookmarks.toggle(ev);
      notify(now ? 'Added to My events on this device.' : 'Removed from My events.');
    } catch (error) { console.error(error); notify(error.message || 'Could not save the bookmark.'); }
    renderStrip(); renderFoot();
  }

  function defaultEvent(events) {
    const wanted = params.get('event');
    // Only a link to a specific event (search results, My events) selects one; opening a classroom selects nothing.
    return wanted && events.some(e => String(e.id) === wanted) ? wanted : null;
  }
  function syncUrl() {
    const p = new URLSearchParams();
    p.set('room', room.id);
    if (state.eventId) p.set('event', state.eventId);
    try { history.replaceState(null, '', `${location.pathname}?${p}`); } catch { /* ignore */ }
  }
  async function loadEvents() {
    state.events = (await Store.listEvents(room.id)).sort((a, b) => when(a).localeCompare(when(b)));
    try { Store.bookmarks.sync(room.id, state.events); } catch (error) { console.error(error); }
  }
  // Other exams in this hall at the same time (different courses sharing the room).
  const alongside = ev => state.events.filter(o => o.type === 'exam' && o.id !== ev.id && o.date === ev.date && o.start < ev.end && o.end > ev.start).map(o => ({ id: o.id, title: o.title }));
  async function loadBookings() {
    const ev = currentEvent();
    if (ev && ev.type === 'exam') state.rules = await Store.seatSettings();
    state.bookings = ev && ev.type === 'exam' ? await Store.listBookings(ev.id, alongside(ev)) : {};
  }
  async function refreshBookings() { await loadBookings(); renderFoot(); renderHall(); refit(); }
  async function selectEvent(id) {
    state.eventId = id ? String(id) : null;
    const picked = currentEvent();
    if (picked) state.date = picked.date;
    try { await loadBookings(); } catch (error) { console.error(error); state.bookings = {}; notify('Could not load seat marks for this exam.'); }
    syncUrl();
    renderAll();
  }
  // Bookmarked exam that is about to start (or has started): wish them luck.
  function cheer(ev) { try { if (ev && window.LHC_CHEER) LHC_CHEER.maybeShow(ev, Store.bookmarks.has(ev.id), undefined, mySeats()); } catch (error) { console.error(error); } }

  $('date-strip').addEventListener('click', e => {
    const pill = e.target.closest('[data-date]');
    if (!pill) return;
    if (pill.dataset.mid === 'true') toggleCal(); else { $('pk-pop').hidden = true; goDate(pill.dataset.date); }
  });
  $('pk-pop').addEventListener('click', e => {
    const month = e.target.closest('[data-month]'), pick = e.target.closest('[data-pick]');
    if (month) { const d = parseDate(calMonth); d.setDate(1); d.setMonth(d.getMonth() + Number(month.dataset.month)); calMonth = LHC_FMT.isoOf(d); renderCal(); }
    if (pick) { $('pk-pop').hidden = true; goDate(pick.dataset.pick); }
  });
  document.addEventListener('click', e => { if (!$('pk-pop').hidden && e.target.isConnected && !e.target.closest('.date-nav, .day-bar, .pk-pop, .top-tools')) toggleCal(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('pk-pop').hidden) toggleCal(false); });
  $('event-strip').addEventListener('click', e => {
    const mark = e.target.closest('[data-bookmark]');
    if (mark) { toggleBookmark(mark.dataset.bookmark); return; }
    const chip = e.target.closest('[data-event]');
    if (!chip) return;
    if (chip.dataset.event !== String(state.eventId)) selectEvent(chip.dataset.event).then(() => cheer(currentEvent()));
    else cheer(currentEvent());
  });
  $('room-foot').addEventListener('click', e => { const mark = e.target.closest('[data-bookmark]'); if (mark) toggleBookmark(mark.dataset.bookmark); });
  $('day-strip').addEventListener('click', e => {
    const tile = e.target.closest('[data-day]');
    if (tile) { $('pk-pop').hidden = true; goDate(tile.dataset.day); }
  });
  $('top-cal').addEventListener('click', () => {
    if ($('event-bar').classList.contains('collapsed')) setCollapsed(false, true);
    toggleCal();
  });
  $('top-today').addEventListener('click', () => { $('pk-pop').hidden = true; goDate(todayISO()); });
  $('day-prev').addEventListener('click', () => goDate(addDays(state.date, -1)));
  $('day-next').addEventListener('click', () => goDate(addDays(state.date, 1)));
  $('date-today').addEventListener('click', () => { $('pk-pop').hidden = true; goDate(todayISO()); });
  $('strip-left').addEventListener('click', () => goDate(addDays(state.date, -1)));
  $('strip-right').addEventListener('click', () => goDate(addDays(state.date, 1)));

  // ---------- exam seat marking ----------
  const seatDialog = $('seat-dialog');
  let seatToMark = null;
  seatDialog.querySelector('[data-close]').addEventListener('click', () => seatDialog.close());
  $('seat-info').querySelector('[data-close]').addEventListener('click', () => $('seat-info').close());
  $('hall').addEventListener('click', e => {
    const btn = e.target.closest('.seat');
    if (!btn) return;
    const ev = currentEvent();
    if (!ev || ev.type !== 'exam') return;   // seats are only markable for exams; for other events the map is view-only
    const taken = state.bookings[btn.dataset.seat];
    if (taken) {   // a marked seat: show who marked it (names can be limited to the person who marked it)
      $('info-no').textContent = btn.dataset.seat;
      const name = shownName(taken);
      const course = taken.other ? ` <span class="muted">for ${esc(taken.other)}</span>` : '';
      $('info-line').innerHTML = (taken.mine ? `Marked by <b>${esc(name || 'you')}</b> (you)` : name ? `Marked by <b>${esc(name)}</b>` : 'Marked by another student') + course;
      $('info-event').textContent = `${ev.title} · ${dateLong(ev.date)} · ${timeLabel(ev.start)} – ${timeLabel(ev.end)}`;
      $('seat-info').showModal();
      return;
    }
    if (state.rules.marking !== 'on') { notify('Seat marking is turned off for now.'); return; }
    seatToMark = btn.dataset.seat;
    $('seat-no').textContent = seatToMark;
    $('seat-event').textContent = `${ev.title} · ${dateLong(ev.date)} · ${timeLabel(ev.start)} – ${timeLabel(ev.end)}`;
    let saved = ''; try { saved = localStorage.getItem(NAME_KEY) || ''; } catch { /* ignore */ }
    $('seat-name').value = saved;
    seatDialog.showModal();
    $('seat-name').focus();
  });
  $('seat-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('seat-name').value.trim();
    if (!name) { notify('Enter your name or initials.'); return; }
    const ev = currentEvent();
    if (!ev || ev.type !== 'exam') { seatDialog.close(); return; }
    try {
      const result = await Store.book(state.eventId, seatToMark, name);
      seatDialog.close();
      if (!result.ok) { notify('That seat was just marked by someone else.'); await refreshBookings(); return; }
      try { localStorage.setItem(NAME_KEY, name); } catch { /* ignore */ }
      await refreshBookings();
      notify(`Seat ${seatToMark} marked.`);
    } catch (error) {
      console.error(error);
      state.rules = await Store.seatSettings();
      if (state.rules.marking !== 'on') { seatDialog.close(); notify('Seat marking has been turned off.'); renderHall(); renderFoot(); }
      else notify('Could not mark your seat. Please try again.');
    }
  });

  Store.subscribe(async change => {
    if (change.type === 'bookmarks') { renderStrip(); renderFoot(); return; }
    if (change.type === 'events' && (!change.roomId || change.roomId === room.id)) {
      await loadEvents();
      if (state.eventId && !state.events.some(x => String(x.id) === String(state.eventId))) state.eventId = null;
      renderStrip();
      await refreshBookings();
    } else if (change.type === 'bookings' && currentEvent()?.type === 'exam' && (!change.eventId || String(change.eventId) === String(state.eventId) || alongside(currentEvent()).some(o => String(o.id) === String(change.eventId)))) {
      await refreshBookings();
    }
  });

  // ---------- "+ Event" button: shown only to people who may add events right now ----------
  // The admin chooses who that is (only admin, co-admins, or anyone). Visitors who cannot add never see the button.
  async function showAddButton() {
    try {
      const response = await fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) return;
      const session = await response.json();
      $('add-event').hidden = !session.canAdd;
    } catch { /* no admin API here (for example a plain local server): keep the button hidden */ }
  }

  // ---------- start ----------
  (async function start() {
    showAddButton();
    if (room.layout) wireZoom(); else $('zoom-tools').hidden = true;
    if (!room.layout) $('map-scroll').outerHTML = `<div class="pending"><h2>${esc(room.name)}</h2><p>The seating map for this classroom isn't available yet.</p></div>`;
    try { if (isPhone() && localStorage.getItem(BAR_KEY) === '1') setCollapsed(true, false); } catch { /* ignore */ }
    const status = await Store.init();
    if (status.error) notify(status.error);
    try { await loadEvents(); } catch (error) { console.error(error); state.events = []; notify('Could not load events.'); }
    state.eventId = defaultEvent(state.events);
    try { await loadBookings(); } catch (error) { console.error(error); state.bookings = {}; }
    syncUrl();
    renderAll();
    cheer(currentEvent());
  })();
})();
