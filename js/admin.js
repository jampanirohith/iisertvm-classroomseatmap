(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const F = window.LHC_FMT;
  const recurrence = window.LHC_RECURRENCE;
  const rooms = window.LHC_ROOMS || [];
  const params = new URLSearchParams(location.search);
  const weekdayInputs = () => [...document.querySelectorAll('input[name="repeat-day"]')];
  const roomOf = id => rooms.find(r => r.id === id);

  const state = { session: null, guest: false, loginRole: 'admin', events: [], selected: null, editing: null, resetEmail: '' };
  let calendar = null;

  function setMessage(el, text, kind) {
    el.textContent = text || '';
    if (kind) el.dataset.kind = kind; else delete el.dataset.kind;
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
  const normalize = row => ({
    id: row.id, roomId: row.room_id, title: row.title || 'Untitled event', type: F.typeOf(row.event_type),
    date: row.event_date, start: String(row.start_time).slice(0, 5), end: String(row.end_time).slice(0, 5),
    professor: row.professor || '', note: row.description || '', createdBy: row.created_by || ''
  });

  // ---------- who is signed in ----------
  const role = () => (state.session && state.session.role) || null;
  const canAdd = () => Boolean(state.session && state.session.canAdd);
  // Mirrors the server rule: the admin changes any event; a co-admin changes their own while co-admins may add events.
  const canModify = ev => role() === 'admin' || (role() === 'coadmin' && state.session.mode !== 'admin' && ev.createdBy === state.session.email);

  function showScreen() {
    const inConsole = Boolean(role() || state.guest);
    $('login-panel').classList.toggle('admin-hidden', inConsole);
    $('admin-console').classList.toggle('admin-hidden', !inConsole);
    $('admin-logout').classList.toggle('admin-hidden', !role());
    $('tab-settings').hidden = role() !== 'admin';
    if (role() !== 'admin') selectTab('schedule');
    const mode = state.session ? state.session.mode : 'admin';
    $('guest-continue').hidden = mode !== 'anyone';
    $('login-intro').textContent = mode === 'anyone' ? 'Anyone can add events. Sign in as admin or co-admin to also delete them.' : 'Sign in to add or remove classroom events.';
    $('who-line').textContent = role() === 'admin' ? 'Signed in as admin' : role() === 'coadmin' ? `Signed in as ${state.session.email}` : state.guest ? 'Adding events as a guest' : 'Lecture Hall Complex';
    $('add-btn').hidden = !canAdd();
    if (inConsole && !canAdd()) setMessage($('manager-message'), role() ? 'Adding events is limited to the admin right now. You can still view the schedule.' : 'Sign in to add events.');
    else if (inConsole) setMessage($('manager-message'), '');
  }

  async function loadSession() {
    try { state.session = await api('/api/admin/session'); }
    catch (error) {
      state.session = { role: null, email: null, mode: 'admin', canAdd: false, canManage: false };
      setMessage($('login-message'), 'Sign-in is not available on this server. Admin tools run on Cloudflare Pages.', 'error');
    }
    showScreen();
  }

  // ---------- sign in / out ----------
  function setLoginRole(next) {
    state.loginRole = next;
    document.querySelectorAll('[data-role]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.role === next)));
    $('email-field').hidden = next !== 'coadmin';
    $('admin-email').required = next === 'coadmin';
    setMessage($('login-message'), '');
  }
  document.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => setLoginRole(b.dataset.role)));

  $('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('login-form').querySelector('button[type="submit"]');
    submit.disabled = true;
    setMessage($('login-message'), 'Signing in…');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ role: state.loginRole, email: $('admin-email').value, password: $('admin-password').value }) });
      $('admin-password').value = '';
      setMessage($('login-message'), '');
      state.guest = false;
      await loadSession();
      await loadEvents(true);
    } catch (error) {
      setMessage($('login-message'), error.message, 'error');
      $('admin-password').focus();
    } finally { submit.disabled = false; }
  });

  $('guest-continue').addEventListener('click', async () => { state.guest = true; showScreen(); await loadEvents(true); });

  $('admin-logout').addEventListener('click', async () => {
    try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); }
    catch (error) { console.warn('Sign-out request failed', error); }
    state.guest = false;
    await loadSession();
    setMessage($('login-message'), 'You have been signed out.');
  });

  // ---------- tabs ----------
  function selectTab(name) {
    ['schedule', 'settings'].forEach(t => {
      $(`tab-${t}`).setAttribute('aria-selected', String(t === name));
      $(`panel-${t}`).hidden = t !== name;
    });
    if (name === 'settings') loadSettings();
  }
  $('tab-schedule').addEventListener('click', () => selectTab('schedule'));
  $('tab-settings').addEventListener('click', () => selectTab('settings'));

  // ---------- schedule ----------
  const roomSelect = $('admin-room');
  rooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = `${room.name} · ${room.capacity} seats`;
    roomSelect.appendChild(option);
  });
  const ROOM_KEY = 'lhc-admin-room';
  let lastRoom = ''; try { lastRoom = localStorage.getItem(ROOM_KEY) || ''; } catch { /* ignore */ }
  const startRoom = [params.get('room'), lastRoom].find(id => rooms.some(room => room.id === id));
  if (startRoom) roomSelect.value = startRoom;

  calendar = window.LHC_CALENDAR.create($('calendar'), {
    onSlot: (date, time) => { if (canAdd()) openEventDialog(date, time); else if (!role()) setMessage($('manager-message'), 'Sign in to add events.'); },
    onEvent: openDetail,
    canMove: canModify,
    onMove: (ev, date, start, end) => saveEvent(ev, { title: ev.title, type: ev.type, date, start, end, professor: ev.professor, note: ev.note }, `Moved “${ev.title}” to ${F.dateShort(date)}, ${F.timeLabel(start)}.`)
  });

  async function loadEvents(jump) {
    if (!role() && !state.guest) return;
    try {
      const result = await api(`/api/admin/events?roomId=${encodeURIComponent(roomSelect.value)}`);
      state.events = (result.events || []).map(normalize);
      calendar.setEvents(state.events);
      if (jump) calendar.setWeek(F.todayISO());
    } catch (error) {
      setMessage($('manager-message'), error.message, 'error');
    }
  }
  roomSelect.addEventListener('change', () => { try { localStorage.setItem(ROOM_KEY, roomSelect.value); } catch { /* ignore */ } loadEvents(false); });
  $('add-btn').addEventListener('click', () => {
    const week = calendar.weekOf(), today = F.todayISO();
    const inWeek = today >= week && today <= window.LHC_CALENDAR.shift(week, 6);
    const now = new Date();
    openEventDialog(inWeek ? today : week, inWeek ? `${F.pad(Math.min(now.getHours() + 1, 22))}:00` : '10:00');
  });

  // ---------- event dialog ----------
  const eventDialog = $('event-dialog');
  document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  function syncRepeatBounds() {
    const date = $('event-date').value;
    if (!date) return;
    $('event-repeat-until').min = date;
    $('event-repeat-until').max = recurrence.addDays(date, recurrence.MAX_RANGE_DAYS);
    const until = $('event-repeat-until');
    if (!until.value || until.value < date || until.value > until.max) until.value = recurrence.addDays(date, 28);
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
    if (!$('event-repeat').checked || $('event-type').value !== 'class') { summary.textContent = ''; summary.classList.remove('is-error'); return; }
    try {
      const dates = chosenDates();
      const pattern = $('event-repeat-mode').value === 'weekly' ? 'Every week' : weekdayInputs().filter(i => i.checked).map(i => i.nextElementSibling.textContent).join(', ');
      summary.textContent = `${dates.length} separate class ${dates.length === 1 ? 'session' : 'sessions'} · ${pattern || 'Select weekdays'} · through ${F.dateLong($('event-repeat-until').value)}.`;
      summary.classList.remove('is-error');
    } catch (error) { summary.textContent = error.message; summary.classList.add('is-error'); }
  }
  function addHour(time) {
    const [h, m] = time.split(':').map(Number);
    return h >= 23 ? '23:59' : `${F.pad(h + 1)}:${F.pad(m)}`;
  }
  function openEventDialog(date, time, editing) {
    state.editing = editing || null;
    $('admin-event-form').reset();
    $('event-dialog-title').textContent = editing ? 'Edit event' : 'Add event';
    $('event-save').textContent = editing ? 'Save changes' : 'Save event';
    if (editing) {
      $('event-title').value = editing.title;
      $('event-type').value = editing.type;
      $('event-professor').value = editing.professor;
      $('event-note').value = editing.note;
    }
    const room = roomOf(roomSelect.value);
    $('event-room-line').textContent = room ? `${room.name} · ${room.capacity} seats` : '';
    $('event-date').value = date;
    $('event-start').value = time;
    $('event-end').value = editing ? editing.end : addHour(time);
    $('event-repeat-mode').value = 'weekly';
    const weekday = recurrence.weekday(date);
    weekdayInputs().forEach(input => { input.checked = Number(input.value) === weekday; });
    setMessage($('form-message'), '');
    syncRepeatBounds();
    updateRepeatControls();
    if (editing) { $('class-repeat-panel').hidden = true; $('repeat-settings').hidden = true; }   // one session at a time when editing
    eventDialog.showModal();
    $('event-title').focus();
  }
  $('event-type').addEventListener('change', () => {
    if ($('event-type').value !== 'class') $('event-repeat').checked = false;
    updateRepeatControls();
    if (state.editing) $('class-repeat-panel').hidden = true;
  });
  $('event-repeat').addEventListener('change', updateRepeatControls);
  $('event-repeat-mode').addEventListener('change', updateRepeatControls);
  $('event-date').addEventListener('change', () => { syncRepeatBounds(); updateRepeatSummary(); });
  $('event-repeat-until').addEventListener('change', updateRepeatSummary);
  weekdayInputs().forEach(input => input.addEventListener('change', updateRepeatSummary));

  $('admin-event-form').addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('form-message');
    const base = {
      title: $('event-title').value.trim(), type: $('event-type').value, start: $('event-start').value, end: $('event-end').value,
      professor: $('event-type').value === 'class' ? $('event-professor').value.trim() : '', note: $('event-note').value.trim()
    };
    if (!base.title || !$('event-date').value || !base.start || !base.end || base.end <= base.start) {
      setMessage(message, 'Enter an event name, a date and a start time earlier than the end time.', 'error');
      return;
    }
    if (state.editing) {
      const ev = state.editing;
      $('event-save').disabled = true;
      setMessage(message, 'Saving…');
      const ok = await saveEvent(ev, { ...base, date: $('event-date').value }, `Updated “${base.title}”.`, message);
      $('event-save').disabled = false;
      if (ok) eventDialog.close();
      return;
    }
    let dates;
    try { dates = chosenDates(); }
    catch (error) { setMessage(message, error.message, 'error'); return; }
    const sessions = dates.map(date => ({ ...base, date }));
    const submit = $('event-save');
    submit.disabled = true;
    setMessage(message, `Saving ${sessions.length} event ${sessions.length === 1 ? 'session' : 'sessions'}…`);
    try {
      const result = await api('/api/admin/events', { method: 'POST', body: JSON.stringify({ roomId: roomSelect.value, events: sessions }) });
      const count = (result.events || []).length || sessions.length;
      eventDialog.close();
      setMessage($('manager-message'), `Saved ${count} event ${count === 1 ? 'session' : 'sessions'}.`, 'success');
      await loadEvents(false);
      calendar.showDate(sessions[0].date);
    } catch (error) {
      setMessage(message, error.message, 'error');
      if (error.status === 401) { eventDialog.close(); await loadSession(); }
    } finally { submit.disabled = false; }
  });

  // Saves changes to one event (edit dialog or drag-and-drop). Returns true on success.
  async function saveEvent(ev, values, doneText, errorEl) {
    const target = errorEl || $('manager-message');
    try {
      await api(`/api/admin/events?${new URLSearchParams({ roomId: ev.roomId, eventId: ev.id })}`, { method: 'PATCH', body: JSON.stringify(values) });
      setMessage($('manager-message'), doneText, 'success');
      await loadEvents(false);
      calendar.showDate(values.date);
      return true;
    } catch (error) {
      setMessage(target, error.message, 'error');
      if (error.status === 401) { eventDialog.close(); await loadSession(); }
      else await loadEvents(false);   // put the block back where it was
      return false;
    }
  }

  // ---------- event details ----------
  const detailDialog = $('detail-dialog');
  function openDetail(ev) {
    state.selected = ev;
    const room = roomOf(ev.roomId || roomSelect.value);
    $('detail-title').textContent = ev.title;
    const rows = [
      ['Type', F.TYPE[ev.type]],
      ['Date', F.dateLong(ev.date)],
      ['Time', `${F.timeLabel(ev.start)} – ${F.timeLabel(ev.end)}`],
      ['Classroom', room ? room.name : ''],
      ev.professor && ['Professor', ev.professor],
      ev.note && ['Note', ev.note],
      ev.createdBy && ['Added by', ev.createdBy === 'admin' ? 'Admin' : ev.createdBy === 'public' ? 'A visitor' : ev.createdBy]
    ].filter(Boolean);
    $('detail-body').innerHTML = rows.map(([k, v]) => `<dt>${F.esc(k)}</dt><dd>${F.esc(v)}</dd>`).join('');
    $('detail-delete').hidden = !canModify(ev);
    $('detail-edit').hidden = !canModify(ev);
    $('detail-open').href = `room.html?room=${encodeURIComponent(ev.roomId)}&event=${encodeURIComponent(ev.id)}`;
    setMessage($('detail-message'), '');
    detailDialog.showModal();
  }
  $('detail-edit').addEventListener('click', () => {
    const ev = state.selected;
    if (!ev) return;
    detailDialog.close();
    openEventDialog(ev.date, ev.start, ev);
  });
  $('detail-delete').addEventListener('click', async () => {
    const ev = state.selected;
    if (!ev || !confirm(`Delete “${ev.title}”? Any exam seat marks for this event will also be removed.`)) return;
    try {
      const qs = new URLSearchParams({ roomId: ev.roomId, eventId: ev.id });
      await api(`/api/admin/events?${qs}`, { method: 'DELETE' });
      detailDialog.close();
      setMessage($('manager-message'), `Deleted “${ev.title}”.`, 'success');
      await loadEvents(false);
    } catch (error) {
      setMessage($('detail-message'), error.message, 'error');
      if (error.status === 401) { detailDialog.close(); await loadSession(); }
    }
  });

  // ---------- settings (admin only) ----------
  async function loadSettings() {
    if (role() !== 'admin') return;
    try {
      const { whoCanAdd } = await api('/api/admin/settings');
      const input = document.querySelector(`input[name="mode"][value="${whoCanAdd}"]`);
      if (input) input.checked = true;
      setMessage($('mode-message'), '');
    } catch (error) { setMessage($('mode-message'), error.message, 'error'); }
    loadCoadmins();
  }
  $('mode-options').addEventListener('change', async event => {
    const input = event.target.closest('input[name="mode"]');
    if (!input) return;
    setMessage($('mode-message'), 'Saving…');
    try {
      await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ whoCanAdd: input.value }) });
      state.session.mode = input.value;
      state.session.canAdd = true;   // the admin can always add
      setMessage($('mode-message'), 'Saved.', 'success');
    } catch (error) {
      setMessage($('mode-message'), error.message, 'error');
      loadSettings();
    }
  });

  async function loadCoadmins() {
    const list = $('coadmin-list');
    try {
      const { coadmins } = await api('/api/admin/coadmins');
      list.innerHTML = coadmins.length
        ? coadmins.map(c => `<li class="coadmin-item"><span title="${F.esc(c.email)}">${F.esc(c.email)}</span><div class="coadmin-actions"><button type="button" class="btn" data-reset="${F.esc(c.email)}">Reset password</button><button type="button" class="btn danger" data-remove="${F.esc(c.email)}">Remove</button></div></li>`).join('')
        : '<li class="muted small">No co-admins yet.</li>';
    } catch (error) { list.innerHTML = ''; setMessage($('coadmin-message'), error.message, 'error'); }
  }
  $('coadmin-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('coadmin-form').querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/api/admin/coadmins', { method: 'POST', body: JSON.stringify({ email: $('coadmin-email').value, password: $('coadmin-password').value }) });
      setMessage($('coadmin-message'), `Added ${$('coadmin-email').value.trim().toLowerCase()}. Share the password with them directly.`, 'success');
      $('coadmin-form').reset();
      await loadCoadmins();
    } catch (error) { setMessage($('coadmin-message'), error.message, 'error'); }
    finally { submit.disabled = false; }
  });
  $('coadmin-list').addEventListener('click', async event => {
    const reset = event.target.closest('[data-reset]'), remove = event.target.closest('[data-remove]');
    if (reset) {
      state.resetEmail = reset.dataset.reset;
      $('password-who').textContent = state.resetEmail;
      $('password-new').value = '';
      $('password-dialog').showModal();
      $('password-new').focus();
    } else if (remove) {
      if (!confirm(`Remove ${remove.dataset.remove}? They will be signed out and can no longer add events.`)) return;
      try {
        await api(`/api/admin/coadmins?${new URLSearchParams({ email: remove.dataset.remove })}`, { method: 'DELETE' });
        setMessage($('coadmin-message'), 'Co-admin removed.', 'success');
        await loadCoadmins();
      } catch (error) { setMessage($('coadmin-message'), error.message, 'error'); }
    }
  });
  $('password-form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await api('/api/admin/coadmins', { method: 'PATCH', body: JSON.stringify({ email: state.resetEmail, password: $('password-new').value }) });
      $('password-dialog').close();
      setMessage($('coadmin-message'), `Password updated for ${state.resetEmail}.`, 'success');
    } catch (error) { setMessage($('coadmin-message'), error.message, 'error'); $('password-dialog').close(); }
  });

  // ---------- start ----------
  setLoginRole('admin');
  loadSession().then(() => loadEvents(true));
})();
