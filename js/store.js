(function () {
  'use strict';
  const K = { events: 'lhc-events-v4', bookings: 'lhc-bookings-v4', mine: 'lhc-my-seats-v4', bookmarks: 'lhc-bookmarks-v1', device: 'lhc-device-v1' };
  const read = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { throw new Error('Browser storage is unavailable or full. Free some space and try again.'); } };
  const bookingKey = (eventId, seatId) => `${eventId}::${seatId}`;
  const byWhen = (a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`);
  const fromRow = row => ({
    id: row.id, roomId: row.room_id, title: row.title, type: row.event_type || 'other',
    date: row.event_date, start: String(row.start_time).slice(0, 5), end: String(row.end_time).slice(0, 5),
    professor: row.professor || '', note: row.description || '', createdBy: row.created_by || ''
  });

  let client = null;
  let initPromise = null;
  const listeners = new Set();
  const emit = change => listeners.forEach(fn => { try { fn(change); } catch (error) { console.error(error); } });

  // ---------- this device ----------
  // A random code that stays on this device. The database keeps only a one-way fingerprint of it (different for every
  // exam), so it can tell that the same device already marked a seat for an exam without knowing who anyone is.
  let memoryCode = null;
  function deviceCode() {
    try {
      const saved = localStorage.getItem(K.device);
      if (saved && /^[0-9a-f]{32}$/.test(saved)) return saved;
    } catch { /* storage blocked: use a code that lasts until the page closes */ }
    if (!memoryCode) {
      const bytes = new Uint8Array(16);
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
      else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      memoryCode = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    try { localStorage.setItem(K.device, memoryCode); } catch { /* keep the in-memory copy */ }
    return memoryCode;
  }
  const missingColumn = error => Boolean(error) && (error.code === 'PGRST204' || /owner_token/.test(String(error.message || '')));

  function loadLibrary() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = () => reject(new Error('The shared storage library did not load.'));
      document.head.appendChild(script);
    });
  }


  // ---------- bookmarks: saved on this device only ----------
  // A bookmark keeps a small copy of the event so "My events" can show it right away; the copy is
  // refreshed (or dropped, if the event was deleted) whenever the classroom's events are loaded.
  const snapshot = e => ({ id: String(e.id), roomId: e.roomId, title: e.title, type: e.type, date: e.date, start: e.start, end: e.end, professor: e.professor || '', note: e.note || '' });
  const saved = () => { const list = read(K.bookmarks, []); return Array.isArray(list) ? list.filter(b => b && b.id && b.roomId) : []; };
  const Bookmarks = {
    list() { return saved().sort(byWhen); },
    has(eventId) { return saved().some(b => b.id === String(eventId)); },
    // Returns true when the event is now bookmarked, false when the bookmark was removed.
    toggle(event) {
      const list = saved(), id = String(event.id);
      const next = list.some(b => b.id === id) ? list.filter(b => b.id !== id) : [...list, snapshot(event)];
      write(K.bookmarks, next);
      return next.some(b => b.id === id);
    },
    remove(eventId) { write(K.bookmarks, saved().filter(b => b.id !== String(eventId))); },
    // Call with the full, freshly loaded event list of one classroom.
    sync(roomId, events) {
      const fresh = new Map(events.map(e => [String(e.id), e]));
      const list = saved(), next = [];
      list.forEach(b => {
        if (b.roomId !== roomId) { next.push(b); return; }
        const current = fresh.get(b.id);
        if (current) next.push(snapshot(current));
      });
      if (JSON.stringify(next) !== JSON.stringify(list)) write(K.bookmarks, next);
    }
  };
  window.addEventListener('storage', event => { if (event.key === K.bookmarks) emit({ type: 'bookmarks' }); });

  const Store = {
    bookmarks: Bookmarks,
    // Returns { shared, error }. Without a Supabase configuration everything is kept in this browser.
    // Several scripts on one page may call it: the connection is made once.
    init() { if (!initPromise) initPromise = Store._connect(); return initPromise; },
    async _connect() {
      try { if (window.SUPABASE_CONFIG_READY) await window.SUPABASE_CONFIG_READY; } catch { /* fallback to local mode */ }
      const cfg = window.SUPABASE_CONFIG;
      const publishableKey = cfg && (cfg.publishableKey || cfg.anonKey);
      if (!cfg || !cfg.url || !publishableKey) {
        window.addEventListener('storage', event => {
          if (event.key === K.bookings) emit({ type: 'bookings' });
          if (event.key === K.events) emit({ type: 'events' });
        });
        const misconfigured = window.SUPABASE_CONFIG_ENDPOINT_AVAILABLE === true;
        return {
          shared: false,
          ...(misconfigured ? { error: 'Shared storage is not configured. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Cloudflare Pages; data is currently kept on this device.' } : {})
        };
      }
      try {
        await loadLibrary();
        client = window.supabase.createClient(cfg.url, publishableKey);
        client.channel('lhc-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_marks' }, p => emit({ type: 'bookings', eventId: (p.new && p.new.event_id) || (p.old && p.old.event_id) }))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, p => emit({ type: 'events', roomId: (p.new && p.new.room_id) || (p.old && p.old.room_id) }))
          .subscribe();
        return { shared: true };
      } catch (error) {
        console.error(error);
        client = null;
        return { shared: false, error: 'Shared storage is unavailable, so seat marks are saved on this device only.' };
      }
    },

    async listEvents(roomId) {
      if (client) {
        const { data, error } = await client.from('events').select('*').eq('room_id', roomId).order('event_date').order('start_time');
        if (error) throw error;
        return data.map(fromRow);
      }
      return (read(K.events, {})[roomId] || []).slice().sort(byWhen);
    },

    async addEvent(roomId, e) {
      const saved = await Store.addEvents(roomId, [e]);
      return saved[0];
    },

    // A recurrence is expanded into separate dated sessions; bulk insert keeps the
    // local-storage operation atomic and avoids partial series if a shared insert fails.
    async addEvents(roomId, entries) {
      if (!Array.isArray(entries) || !entries.length) throw new Error('Add at least one event session.');
      const normalized = entries.map(e => ({
        title: String(e.title || '').trim(), type: e.type || 'other', date: e.date,
        start: e.start, end: e.end, professor: e.professor || '', note: e.note || ''
      }));
      if (client) {
        const rows = normalized.map(e => ({
          room_id: roomId, title: e.title, event_type: e.type, event_date: e.date, start_time: e.start, end_time: e.end,
          professor: e.professor || null, description: e.note || null
        }));
        const { data, error } = await client.from('events').insert(rows).select('*');
        if (error) throw error;
        return data.map(fromRow).sort(byWhen);
      }
      const all = read(K.events, {});
      const added = normalized.map((e, i) => ({
        id: `local-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`, roomId, ...e
      }));
      all[roomId] = [...(all[roomId] || []), ...added].sort(byWhen);
      write(K.events, all);
      return added.sort(byWhen);
    },

    // Seat-marking rules set by the admin: { marking: 'on' | 'off', names: 'everyone' | 'self' }.
    // Falls back to the defaults (on, everyone) when the server cannot be reached.
    async seatSettings() {
      const fallback = { marking: 'on', names: 'everyone' };
      try {
        const response = await fetch('/api/seat-settings', { cache: 'no-store' });
        if (!response.ok) return fallback;
        const data = await response.json();
        return { marking: data.marking === 'off' ? 'off' : 'on', names: data.names === 'self' ? 'self' : 'everyone' };
      } catch { return fallback; }
    },

    // Returns { [seatId]: { name, mine } } for one event.
    // Marks for one exam. `alongside` lists other exams in the same hall at the same time ({ id, title }): the seats
    // are the same physical seats, so their marks show up too, flagged with the course they belong to.
    async listBookings(eventId, alongside = []) {
      const ids = [String(eventId), ...alongside.map(x => String(x.id))];
      let rows;
      if (client) {
        const { data, error } = await client.from('seat_marks').select('event_id,seat_id,display_name').in('event_id', ids);
        if (error) throw error;
        rows = data.map(r => ({ event: String(r.event_id), seat: r.seat_id, name: r.display_name }));
      } else {
        const all = read(K.bookings, {});
        rows = ids.flatMap(id => Object.entries(all).filter(([k]) => k.startsWith(`${id}::`)).map(([k, v]) => ({ event: id, seat: k.slice(id.length + 2), name: v.name })));
      }
      const mine = new Set(read(K.mine, []));
      const title = Object.fromEntries(alongside.map(x => [String(x.id), x.title]));
      const out = {};
      for (const r of rows.filter(r => r.event !== String(eventId)).concat(rows.filter(r => r.event === String(eventId)))) {
        out[r.seat] = r.event === String(eventId)
          ? { name: r.name, mine: mine.has(bookingKey(eventId, r.seat)) }
          : { name: r.name, mine: false, other: title[r.event] || 'another exam' };
      }
      return out;
    },

    // Every seat mark of the given exams, for the admin's report: { [eventId]: [{ seat, name }] } with the seats in number order.
    async listMarks(eventIds) {
      const ids = [...new Set(eventIds.map(String))];
      const out = Object.fromEntries(ids.map(id => [id, []]));
      if (client) {
        for (let i = 0; i < ids.length; i += 40) {
          const chunk = ids.slice(i, i + 40);
          for (let from = 0; ; from += 1000) {      // the database hands back at most 1000 rows at a time
            const { data, error } = await client.from('seat_marks').select('event_id,seat_id,display_name').in('event_id', chunk).order('event_id').order('seat_id').range(from, from + 999);
            if (error) throw error;
            data.forEach(r => out[String(r.event_id)].push({ seat: r.seat_id, name: r.display_name }));
            if (data.length < 1000) break;
          }
        }
      } else {
        const all = read(K.bookings, {});
        ids.forEach(id => Object.entries(all).forEach(([key, v]) => { if (key.startsWith(`${id}::`)) out[id].push({ seat: key.slice(id.length + 2), name: v.name }); }));
      }
      ids.forEach(id => out[id].sort((a, b) => a.seat.localeCompare(b.seat, undefined, { numeric: true })));
      return out;
    },

    // One seat per student per exam. Returns { ok: true }, or { ok: false, reason: 'taken' | 'already', seat? }:
    // 'taken' when someone else has that seat, 'already' when this device already marked a seat for the exam.
    async book(eventId, seatId, name) {
      eventId = String(eventId);
      const key = bookingKey(eventId, seatId);
      if (client) {
        const row = { event_id: eventId, seat_id: seatId, display_name: name, owner_token: deviceCode() };
        let { error } = await client.from('seat_marks').insert(row);
        if (missingColumn(error)) {
          // The database has not been updated with the one-seat rule yet (run supabase/schema.sql): this browser enforces it meanwhile.
          const have = Store.mySeats(eventId);
          if (have.length) return { ok: false, reason: 'already', seat: have[0] };
          delete row.owner_token;
          ({ error } = await client.from('seat_marks').insert(row));
        }
        if (error) {
          if (error.code === '23514') return { ok: false, reason: 'already', seat: Store.mySeats(eventId)[0] };
          if (error.code === '23505') return { ok: false, reason: 'taken' };
          throw error;
        }
      } else {
        const have = Store.mySeats(eventId);
        if (have.length) return { ok: false, reason: 'already', seat: have[0] };
        const all = read(K.bookings, {});
        if (all[key]) return { ok: false, reason: 'taken' };
        all[key] = { name };
        write(K.bookings, all);
      }
      const mine = new Set(read(K.mine, []));
      mine.add(key);
      write(K.mine, [...mine]);
      return { ok: true };
    },

    // Unmarks a seat this device marked, so another can be chosen. Returns { ok: true } or { ok: false, reason: 'not-yours' }
    // (also for seats marked before the one-seat rule, which have no fingerprint to prove they are ours).
    async release(eventId, seatId) {
      eventId = String(eventId);
      const key = bookingKey(eventId, seatId);
      if (!read(K.mine, []).includes(key)) return { ok: false, reason: 'not-yours' };
      if (client) {
        const { data, error } = await client.rpc('release_seat', { p_event: eventId, p_seat: seatId, p_token: deviceCode() });
        if (error) throw error;
        if (!data) return { ok: false, reason: 'not-yours' };
      } else {
        const all = read(K.bookings, {});
        delete all[key];
        write(K.bookings, all);
      }
      write(K.mine, read(K.mine, []).filter(k => k !== key));
      return { ok: true };
    },

    // Seat numbers this device marked for an event (works without a connection).
    mySeats(eventId) {
      const prefix = `${eventId}::`;
      return read(K.mine, []).filter(k => typeof k === 'string' && k.startsWith(prefix)).map(k => k.slice(prefix.length))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
  window.LHC_STORE = Store;
})();
