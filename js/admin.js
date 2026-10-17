(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const rooms = window.LHC_ROOMS || [];
  const recurrence = window.LHC_RECURRENCE;
  const params = new URLSearchParams(location.search);
  const roomSelect = $('admin-room');
  const loginPanel = $('login-panel');
  const adminConsole = $('admin-console');
  const loginMessage = $('login-message');
  const managerMessage = $('manager-message');
  const listMessage = $('list-message');
  const eventList = $('admin-event-list');
  const weekdayInputs = () => [...document.querySelectorAll('input[name="repeat-day"]')];
  let loggedIn = false;
  let events = [];

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dateObject = iso => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(+d) ? null : d;
  };
  const dateLabel = iso => {
    const d = dateObject(iso);
    return d ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d) : String(iso || '');
  };
  const timeLabel = time => {
    const parts = String(time || '').slice(0, 5).split(':').map(Number);
    if (parts.length !== 2 || !parts.every(Number.isFinite)) return String(time || '');
    const [h, m] = parts;
    return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  const eventTitle = event => String(event.title || 'Untitled event');
  const typeLabel = type => ({ class: 'Class', exam: 'Exam', other: 'Other' })[type] || 'Other';
  function setMessage(el, text, kind) {
    el.textContent = text || '';
    if (kind) el.dataset.kind = kind; else delete el.dataset.kind;
  }
  function toggleLoggedIn(value) {
    loggedIn = value;
    loginPanel.classList.toggle('admin-hidden', value);
    adminConsole.classList.toggle('admin-hidden', !value);
    if (!value) { eventList.replaceChildren(); events = []; }
  }
  async function api(url, options) {
    const opts = options || {};
    const headers = { Accept: 'application/json', ...(opts.headers || {}) };
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opts, headers });
    let body = {};
    try { body = await response.json(); } catch { /* keep a useful generic error */ }
    if (!response.ok) {
      const error = new Error(body.error || (response.status === 401 ? 'Please sign in again.' : `Request failed (${response.status}).`));
      error.status = response.status;
      throw error;
    }
    return body;
  }

  rooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = `${room.name} (${room.capacity} seats)`;
    roomSelect.appendChild(option);
  });
  const initialRoom = params.get('room');
  if (initialRoom && rooms.some(room => room.id === initialRoom)) roomSelect.value = initialRoom;

  function syncRepeatBounds() {
    const date = $('event-date').value;
    if (!date) return;
    $('event-repeat-until').min = date;
    $('event-repeat-until').max = recurrence.addDays(date, recurrence.MAX_RANGE_DAYS);
    if (!$('event-repeat-until').value || $('event-repeat-until').value < date || $('event-repeat-until').value > $('event-repeat-until').max) {
      $('event-repeat-until').value = recurrence.addDays(date, 28);
    }
  }
  function updateRepeatControls() {
    const isClass = $('event-type').value === 'class';
    $('professor-field').hidden = !isClass;
    $('class-repeat-panel').hidden = !isClass;
    $('repeat-settings').hidden = !isClass || !$('event-repeat').checked;
    $('repeat-days-wrap').hidden = $('event-repeat-mode').value !== 'days' || !$('event-repeat').checked || !isClass;
    updateRepeatSummary();
  }
  function chosenDates() {
    const start = $('event-date').value;
    if ($('event-type').value !== 'class' || !$('event-repeat').checked) return [start];
    const days = $('event-repeat-mode').value === 'weekly'
      ? [recurrence.weekday(start)]
      : weekdayInputs().filter(input => input.checked).map(input => Number(input.value));
    return recurrence.dates(start, $('event-repeat-until').value, days);
  }
  function updateRepeatSummary() {
    const summary = $('repeat-summary');
    if (!$('event-repeat').checked || $('event-type').value !== 'class') {
      summary.textContent = 'One event session will be created.';
      summary.classList.remove('is-error');
      return;
    }
    try {
      const dates = chosenDates();
      const pattern = $('event-repeat-mode').value === 'weekly'
        ? 'Every week'
        : weekdayInputs().filter(input => input.checked).map(input => input.nextElementSibling.textContent).join(', ');
      summary.textContent = `${dates.length} separate class ${dates.length === 1 ? 'session' : 'sessions'} · ${pattern || 'Select weekdays'} · through ${dateLabel($('event-repeat-until').value)}.`;
      summary.classList.remove('is-error');
    } catch (error) {
      summary.textContent = error.message;
      summary.classList.add('is-error');
    }
  }
  function resetEventForm() {
    $('admin-event-form').reset();
    $('event-date').value = todayISO();
    $('event-start').value = '10:00';
    $('event-end').value = '11:00';
    $('event-repeat-mode').value = 'weekly';
    const weekday = recurrence.weekday($('event-date').value);
    weekdayInputs().forEach(input => { input.checked = Number(input.value) === weekday; });
    syncRepeatBounds();
    updateRepeatControls();
  }

  function appendEvent(event) {
    const item = document.createElement('li');
    item.className = 'admin-event-item';
    const main = document.createElement('div');
    main.className = 'admin-event-main';
    const title = document.createElement('strong');
    title.className = 'admin-event-title';
    title.textContent = eventTitle(event);
    const meta = document.createElement('p');
    meta.className = 'admin-event-meta';
    meta.textContent = `${typeLabel(event.type || event.event_type)} · ${dateLabel(event.date || event.event_date)} · ${timeLabel(event.start || event.start_time)} – ${timeLabel(event.end || event.end_time)}`;
    main.append(title, meta);
    const professor = event.professor;
    if (professor) {
      const prof = document.createElement('p');
      prof.className = 'admin-event-meta';
      prof.textContent = `Professor: ${professor}`;
      main.appendChild(prof);
    }
    const note = event.note || event.description;
    if (note) {
      const noteEl = document.createElement('p');
      noteEl.className = 'admin-event-note';
      noteEl.textContent = note;
      main.appendChild(noteEl);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-delete';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete ${eventTitle(event)}`);
    remove.addEventListener('click', () => deleteEvent(event));
    item.append(main, remove);
    eventList.appendChild(item);
  }

  async function loadEvents() {
    if (!loggedIn) return;
    setMessage(listMessage, 'Loading events…');
    try {
      const result = await api(`/api/admin/events?roomId=${encodeURIComponent(roomSelect.value)}`);
      events = result.events || [];
      eventList.replaceChildren();
      if (!events.length) {
        const empty = document.createElement('li');
        empty.className = 'admin-empty';
        empty.textContent = 'No events in this classroom yet.';
        eventList.appendChild(empty);
      } else {
        events.forEach(appendEvent);
      }
      setMessage(listMessage, `${events.length} event ${events.length === 1 ? 'session' : 'sessions'}.`);
    } catch (error) {
      if (error.status === 401) toggleLoggedIn(false);
      setMessage(listMessage, error.message, 'error');
    }
  }

  async function deleteEvent(event) {
    const title = eventTitle(event);
    if (!confirm(`Delete “${title}”? Any exam seat marks for this event will also be removed.`)) return;
    try {
      const qs = new URLSearchParams({ roomId: roomSelect.value, eventId: event.id });
      await api(`/api/admin/events?${qs}`, { method: 'DELETE' });
      setMessage(managerMessage, `Deleted “${title}”.`, 'success');
      await loadEvents();
    } catch (error) {
      if (error.status === 401) toggleLoggedIn(false);
      setMessage(managerMessage, error.message, 'error');
    }
  }

  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('login-form').querySelector('button[type="submit"]');
    submit.disabled = true;
    setMessage(loginMessage, 'Signing in…');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('admin-password').value }) });
      $('admin-password').value = '';
      toggleLoggedIn(true);
      setMessage(loginMessage, '');
      await loadEvents();
    } catch (error) {
      setMessage(loginMessage, error.message, 'error');
      $('admin-password').focus();
    } finally { submit.disabled = false; }
  });

  $('admin-logout').addEventListener('click', async () => {
    try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); }
    catch (error) { console.warn('Sign-out request failed', error); }
    toggleLoggedIn(false);
    setMessage(loginMessage, 'You have been signed out.');
    $('admin-password').value = '';
  });

  roomSelect.addEventListener('change', loadEvents);
  $('event-type').addEventListener('change', () => {
    if ($('event-type').value !== 'class') $('event-repeat').checked = false;
    updateRepeatControls();
  });
  $('event-repeat').addEventListener('change', updateRepeatControls);
  $('event-repeat-mode').addEventListener('change', updateRepeatControls);
  $('event-date').addEventListener('change', () => { syncRepeatBounds(); updateRepeatSummary(); });
  $('event-repeat-until').addEventListener('change', updateRepeatSummary);
  weekdayInputs().forEach(input => input.addEventListener('change', updateRepeatSummary));

  $('admin-event-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!loggedIn) { setMessage(managerMessage, 'Please sign in before saving events.', 'error'); return; }
    const base = {
      title: $('event-title').value.trim(),
      type: $('event-type').value,
      start: $('event-start').value,
      end: $('event-end').value,
      professor: $('event-professor').value.trim(),
      note: $('event-note').value.trim()
    };
    if (!base.title || !$('event-date').value || !base.start || !base.end || base.end <= base.start) {
      setMessage(managerMessage, 'Enter an event name, a date and a valid start and end time.', 'error');
      return;
    }
    let dates;
    try { dates = chosenDates(); }
    catch (error) { setMessage(managerMessage, error.message, 'error'); return; }
    if (dates.length > 130) { setMessage(managerMessage, 'This series is too long. Shorten the repeat range.', 'error'); return; }
    const sessions = dates.map(date => ({ ...base, date }));
    const submit = $('admin-event-form').querySelector('button[type="submit"]');
    submit.disabled = true;
    setMessage(managerMessage, `Saving ${sessions.length} event ${sessions.length === 1 ? 'session' : 'sessions'}…`);
    try {
      const result = await api('/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({ roomId: roomSelect.value, events: sessions })
      });
      const count = (result.events || []).length || sessions.length;
      setMessage(managerMessage, `Saved ${count} event ${count === 1 ? 'session' : 'sessions'}.`, 'success');
      resetEventForm();
      await loadEvents();
    } catch (error) {
      if (error.status === 401) toggleLoggedIn(false);
      setMessage(managerMessage, error.message, 'error');
      await loadEvents();
    } finally { submit.disabled = false; }
  });

  resetEventForm();
  toggleLoggedIn(false);
  // If a valid admin session cookie already exists, the protected endpoint lets the page reopen directly.
  api(`/api/admin/events?roomId=${encodeURIComponent(roomSelect.value)}`)
    .then(result => {
      loggedIn = true;
      toggleLoggedIn(true);
      events = result.events || [];
      return loadEvents();
    })
    .catch(() => { /* expected when signed out */ });
})();
