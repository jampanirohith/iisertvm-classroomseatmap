// Exam reminders: a notification 15 minutes before an exam in which this student marked a seat.
// "Notify me" is on by default. The browser's own permission prompt is used, there is no popup of our own.
// Reminders are kept on this device and shown while the site is open in the browser (a tab, even in the
// background, or the installed app). Nothing is sent from a server.
(function () {
  'use strict';
  const LEAD_MIN = 15;
  const PREF_KEY = 'lhc-remind-pref-v1';   // '0' once the student switches "Notify me" off; on until then
  const LIST_KEY = 'lhc-reminders-v1';
  const TICK_MS = 15000;
  const F = window.LHC_FMT || null;
  const pad = n => String(n).padStart(2, '0');

  // ---------- browser support and permission ----------
  const supported = () => typeof window.Notification === 'function';
  const permission = () => (supported() ? window.Notification.permission : 'unsupported');

  // Asks the browser's own permission question. Call it straight from a tap or click, before any await: browsers only
  // show the question for a user action. Resolves with 'granted', 'denied', 'default' (the question was closed without
  // an answer) or 'unsupported'.
  function request() {
    if (!supported()) return Promise.resolve('unsupported');
    if (window.Notification.permission !== 'default') return Promise.resolve(window.Notification.permission);
    return new Promise(resolve => {
      const done = answer => resolve(answer === 'granted' || answer === 'denied' ? answer : window.Notification.permission);
      try {
        const pending = window.Notification.requestPermission(done);   // older browsers take a callback
        if (pending && typeof pending.then === 'function') pending.then(done, () => done('denied'));
      } catch { done('denied'); }
    });
  }

  // ---------- "Notify me": on by default, remembered once the student changes it ----------
  function preferred() { try { return localStorage.getItem(PREF_KEY) !== '0'; } catch { return true; } }
  function setPreferred(on) { try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch { /* ignore */ } }

  // ---------- reminders kept on this device ----------
  // { id, roomId, room, title, date, start, seat, sent? } for each exam where the student marked a seat and wants a reminder.
  const startOf = r => new Date(`${r.date}T${String(r.start || '').slice(0, 5)}:00`);
  const dueAt = r => +startOf(r) - LEAD_MIN * 60000;
  const valid = r => Boolean(r && r.id && r.date && r.start) && !Number.isNaN(+startOf(r));
  function readList() {
    try { const list = JSON.parse(localStorage.getItem(LIST_KEY) || '[]'); return Array.isArray(list) ? list.filter(valid) : []; } catch { return []; }
  }
  function writeList(list) { try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); return true; } catch { return false; } }
  const record = info => ({ id: String(info.id), roomId: info.roomId, room: info.room || '', title: info.title || '', date: info.date, start: String(info.start).slice(0, 5), seat: info.seat || '' });

  const has = id => readList().some(r => r.id === String(id));
  // True while the exam has not started, so a reminder still makes sense.
  const canRemind = ev => Boolean(ev) && ev.type === 'exam' && Date.now() < +startOf(ev);
  // "10:15 AM": when the reminder for an exam starting at `start` is due.
  function dueLabel(start) {
    const [h, m] = String(start).slice(0, 5).split(':').map(Number);
    const t = (((h * 60 + m - LEAD_MIN) % 1440) + 1440) % 1440;
    const time = `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
    return F ? F.timeLabel(time) : time;
  }

  // Saves (or updates) the reminder for one exam. Returns false when the browser cannot store it.
  function set(info) {
    const next = record(info), list = readList(), old = list.find(r => r.id === next.id);
    if (old && old.sent && old.date === next.date && old.start === next.start) next.sent = old.sent;   // already shown for this time
    if (!writeList(old ? list.map(r => (r.id === next.id ? next : r)) : [...list, next])) return false;
    arm();
    check();
    return true;
  }
  function cancel(id) {
    const list = readList(), next = list.filter(r => r.id !== String(id));
    if (next.length !== list.length) writeList(next);
  }
  // Call with the full, freshly loaded event list of one classroom: follows a changed time or title and drops a deleted exam.
  function sync(roomId, events) {
    const fresh = new Map(events.map(e => [String(e.id), e]));
    const list = readList(), next = [];
    list.forEach(r => {
      if (r.roomId !== roomId) { next.push(r); return; }
      const e = fresh.get(r.id);
      if (!e || e.type !== 'exam') return;
      const start = String(e.start).slice(0, 5), moved = e.date !== r.date || start !== r.start;
      const { sent, ...rest } = r;
      next.push({ ...rest, title: e.title || r.title, date: e.date, start, ...(moved || !sent ? {} : { sent }) });
    });
    if (JSON.stringify(next) !== JSON.stringify(list)) writeList(next);
  }
  // Call once the seat marks of an exam are loaded: a reminder only makes sense while this device still holds a seat.
  function follow(eventId, seats) {
    const id = String(eventId), list = readList(), r = list.find(x => x.id === id);
    if (!r) return;
    if (!seats.length) { cancel(id); return; }
    if (r.seat !== seats[0]) writeList(list.map(x => (x.id === id ? { ...x, seat: seats[0] } : x)));
  }

  // ---------- showing the notification ----------
  // Phones only allow notifications through the service worker; computers also allow the plain constructor.
  async function show(title, options) {
    try {
      const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (registration && registration.showNotification) { await registration.showNotification(title, options); return true; }
    } catch { /* fall back to the constructor */ }
    try {
      const note = new window.Notification(title, options);
      note.onclick = () => { try { window.focus(); if (options.data && options.data.url) location.href = options.data.url; note.close(); } catch { /* ignore */ } };
      return true;
    } catch { return false; }
  }
  function announce(r) {
    const left = Math.max(1, Math.min(LEAD_MIN, Math.ceil((+startOf(r) - Date.now()) / 60000)));
    const where = [r.room, r.seat ? `Seat ${r.seat}` : '', F ? F.timeLabel(r.start) : r.start].filter(Boolean).join(' · ');
    return show(`Exam starts in ${left} minute${left === 1 ? '' : 's'}`, {
      body: [r.title, where].filter(Boolean).join('\n'),
      icon: 'icons/icon-192.png',
      tag: `lhc-exam-${r.id}`,   // one notification per exam
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: `room.html?room=${encodeURIComponent(r.roomId)}&event=${encodeURIComponent(r.id)}` }
    });
  }

  // ---------- the timer ----------
  // From 15 minutes before the start, a due reminder is shown once. A reminder found after the exam has started is dropped.
  // When the site is opened late (after the 15 minutes began, before the exam), the reminder is shown straight away.
  let timer = null, busy = false;
  const lock = fn => (navigator.locks && navigator.locks.request ? navigator.locks.request('lhc-reminders', fn) : fn());
  async function check() {
    if (busy) return;
    busy = true;
    try {
      const due = [];
      await lock(() => {   // one tab at a time, so two open tabs do not show it twice
        const now = Date.now(), list = readList(), next = [];
        list.forEach(r => {
          if (now >= +startOf(r)) return;
          if (now >= dueAt(r) && !r.sent && permission() === 'granted') { due.push(r); next.push({ ...r, sent: now }); return; }
          next.push(r);
        });
        if (due.length || next.length !== list.length) writeList(next);
      });
      for (const r of due) {
        if (await announce(r)) continue;
        // Could not be shown (for example the service worker is not ready yet): try again on the next tick.
        await lock(() => writeList(readList().map(x => { if (x.id !== r.id) return x; const { sent, ...rest } = x; return rest; })));
      }
    } catch (error) {
      console.error(error);
    } finally {
      busy = false;
      if (!readList().length) disarm();
    }
  }
  function arm() { if (!timer && readList().length) timer = setInterval(check, TICK_MS); }
  function disarm() { if (timer) { clearInterval(timer); timer = null; } }

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('online', check);
  window.addEventListener('storage', event => { if (event.key === LIST_KEY) { arm(); check(); } });

  window.LHC_NOTIFY = Object.freeze({ LEAD_MIN, supported, permission, request, preferred, setPreferred, canRemind, has, set, cancel, sync, follow, dueLabel, check });
  arm();
  check();
})();
