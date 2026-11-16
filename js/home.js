(function () {
  'use strict';
  const { esc, parseDate, part, dateLong, timeLabel, typeOf } = window.LHC_FMT;
  const Store = window.LHC_STORE;
  const rooms = window.LHC_ROOMS || [];
  const roomName = id => (rooms.find(r => r.id === id) || {}).name || 'Classroom';

  const list = document.getElementById('room-list');
  list.innerHTML = rooms.map(room => `<li><a class="room-link" href="room.html?room=${encodeURIComponent(room.id)}"><span class="room-text"><span class="room-name">${esc(room.name)}</span><span class="room-cap">${room.capacity} seats<span class="room-today" data-today-room="${esc(room.id)}"></span></span></span></a></li>`).join('');

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

  // ---------- Events from every hall: search, Coming up, Upcoming exams, today counts ----------
  const $ = id => document.getElementById(id);
  const { isoOf, TYPE } = window.LHC_FMT;
  const enc = encodeURIComponent;
  const addDays = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const PAGE = 30;
  let all = [], loaded = false, failed = false, filter = 'all', query = '', shown = PAGE, timer = 0;

  // One lowercase string per event with the words people search by: course, hall, teacher, type, weekday, date, time.
  function hay(e) {
    if (e._h) return e._h;
    const d = parseDate(e.date);
    const when = d ? `${part(d, { weekday: 'long' })} ${part(d, { weekday: 'short' })} ${d.getDate()} ${part(d, { month: 'long' })} ${part(d, { month: 'short' })} ${e.date}` : e.date;
    return (e._h = norm(`${e.title} ${e.professor} ${roomName(e.roomId)} ${TYPE[typeOf(e.type)]} ${when} ${timeLabel(e.start)}`));
  }
  function matches(e, tokens) {
    const t = today();
    return tokens.every(raw => {
      if (raw === 'today') return e.date === t;
      if (raw === 'tomorrow') return e.date === addDays(t, 1);
      if (raw === 'yesterday') return e.date === addDays(t, -1);
      const token = norm(raw);
      return !token || hay(e).includes(token);
    });
  }
  const isUpcoming = e => `${e.date}T${e.end}` >= nowStamp();
  const upcomingFirst = list => {
    const up = list.filter(isUpcoming).sort(byWhen), past = list.filter(e => !isUpcoming(e)).sort((a, b) => byWhen(b, a));
    return up.concat(past);
  };
  function byWhen(a, b) { return `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`); }

  function resultRow(e) {
    const d = parseDate(e.date);
    const meta = [d ? part(d, { weekday: 'short' }) : '', roomName(e.roomId), `${timeLabel(e.start)} – ${timeLabel(e.end)}`, e.professor ? `Prof. ${e.professor}` : ''].filter(Boolean);
    return `<li class="my-item${isUpcoming(e) ? '' : ' past'}" data-type="${typeOf(e.type)}">
      <a class="my-open" href="room.html?room=${enc(e.roomId)}&event=${enc(e.id)}" aria-label="${esc(e.title)}, ${esc(meta.join(', '))}, ${esc(dateLong(e.date))}">
        <span class="my-date"><b>${esc(d ? d.getDate() : '')}</b><span>${esc(d ? part(d, { month: 'short' }) : '')}</span></span>
        <span class="my-text"><span class="my-title">${esc(e.title)}</span><span class="my-meta">${esc(meta.join(' · '))}</span></span>
      </a>
    </li>`;
  }

  function renderSearch() {
    const active = Boolean(query.trim());
    $('home-sections').hidden = active;
    $('search-hint').hidden = active;
    $('search-filters').hidden = !active;
    $('search-clear').hidden = !active;
    const box = $('search-results');
    if (!active) { box.innerHTML = ''; return; }
    if (failed) { box.innerHTML = '<p class="my-empty">Could not load events. Check your connection and try again.</p>'; return; }
    if (!loaded) { box.innerHTML = '<p class="my-empty">Loading events…</p>'; return; }
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    const found = upcomingFirst(all.filter(e => (filter === 'all' || typeOf(e.type) === filter) && matches(e, tokens)));
    if (!found.length) { box.innerHTML = '<p class="my-empty">No matches. Try a course code like PHY 212, a hall name, or a date like 25 Nov.</p>'; return; }
    const page = found.slice(0, shown);
    box.innerHTML = `<p class="result-count">${found.length} ${found.length === 1 ? 'result' : 'results'}</p><ul class="my-list result-list">${page.map(resultRow).join('')}</ul>${found.length > shown ? `<button type="button" class="btn more-btn" id="search-more">Show more (${found.length - shown})</button>` : ''}`;
  }

  function renderHomeSections() {
    const t = today();
    document.querySelectorAll('[data-today-room]').forEach(el => {
      const n = loaded ? all.filter(e => e.roomId === el.dataset.todayRoom && e.date === t).length : -1;
      el.textContent = n < 0 ? '' : n ? ` · ${n} today` : ' · nothing today';
    });
  }
  function renderEvents() { renderHomeSections(); renderSearch(); }

  function setFilter(next) {
    filter = next; shown = PAGE;
    document.querySelectorAll('#search-filters [data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === next)));
    renderSearch();
  }
  $('search-input').addEventListener('input', event => {
    clearTimeout(timer);
    timer = setTimeout(() => { query = event.target.value; shown = PAGE; renderSearch(); }, 120);
  });
  $('search-input').addEventListener('keydown', event => { if (event.key === 'Escape') $('search-clear').click(); });
  $('search-clear').addEventListener('click', () => { query = ''; $('search-input').value = ''; setFilter('all'); $('search-input').focus(); });
  $('search-filters').addEventListener('click', event => { const b = event.target.closest('[data-filter]'); if (b) setFilter(b.dataset.filter); });
  $('search-results').addEventListener('click', event => { if (event.target.closest('#search-more')) { shown += PAGE; renderSearch(); } });

  let loading = false, started = false;
  async function loadAll() {
    if (loading) return;
    loading = true;
    try {
      if (!started) { await Store.init(); started = true; }
      const lists = await Promise.all(rooms.map(room => Store.listEvents(room.id)));
      all = lists.flat(); loaded = true; failed = false;
      // Refresh the saved copies from the latest events (times may have changed, or an event may have been deleted).
      const saved = new Set(Store.bookmarks.list().map(b => b.roomId));
      rooms.forEach((room, i) => { if (saved.has(room.id)) { try { Store.bookmarks.sync(room.id, lists[i]); } catch (error) { console.error(error); } } });
      renderMyEvents();
    } catch (error) { console.error(error); if (!loaded) failed = true; }
    loading = false;
    renderEvents();
  }
  renderEvents();
  loadAll();

  Store.subscribe(change => { if (change.type === 'bookmarks') renderMyEvents(); if (change.type === 'events') loadAll(); });
})();
