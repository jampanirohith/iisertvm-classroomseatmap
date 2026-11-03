(function () {
  'use strict';
  const K = { events: 'lhc-events-v4', bookings: 'lhc-bookings-v4', mine: 'lhc-my-seats-v4', bookmarks: 'lhc-bookmarks-v1' };
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
  const listeners = new Set();
  const emit = change => listeners.forEach(fn => { try { fn(change); } catch (error) { console.error(error); } });

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
    async init() {
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

    // Returns { [seatId]: { name, mine } } for one event.
    async listBookings(eventId) {
      let rows;
      if (client) {
        const { data, error } = await client.from('seat_marks').select('seat_id,display_name').eq('event_id', eventId);
        if (error) throw error;
        rows = data.map(r => ({ seat: r.seat_id, name: r.display_name }));
      } else {
        const prefix = `${eventId}::`;
        rows = Object.entries(read(K.bookings, {})).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ seat: k.slice(prefix.length), name: v.name }));
      }
      const mine = new Set(read(K.mine, []));
      return Object.fromEntries(rows.map(r => [r.seat, { name: r.name, mine: mine.has(bookingKey(eventId, r.seat)) }]));
    },

    async book(eventId, seatId, name) {
      if (client) {
        const { error } = await client.from('seat_marks').insert({ event_id: eventId, seat_id: seatId, display_name: name });
        if (error) { if (error.code === '23505') return { ok: false, reason: 'taken' }; throw error; }
      } else {
        const all = read(K.bookings, {});
        const key = bookingKey(eventId, seatId);
        if (all[key]) return { ok: false, reason: 'taken' };
        all[key] = { name };
        write(K.bookings, all);
      }
      const mine = new Set(read(K.mine, []));
      mine.add(bookingKey(eventId, seatId));
      write(K.mine, [...mine]);
      return { ok: true };
    },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
  window.LHC_STORE = Store;
})();
