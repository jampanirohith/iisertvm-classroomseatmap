(function () {
  'use strict';

  const K = {
    events: 'lhc-events-v4',
    marks: 'lhc-bookings-v4',
    mine: 'lhc-my-seats-v4',
    eventKeys: 'lhc-event-owner-keys-v1',
    deviceToken: 'lhc-device-seat-token-v1'
  };
  const EVENT_COLUMNS = 'id,room_id,title,event_type,event_date,start_time,end_time,status,professor,description,created_at';
  const read = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { throw new Error('Browser storage is unavailable or full. Enable site storage and try again.'); }
  };
  const bookingKey = (eventId, seatId) => `${eventId}::${seatId}`;
  const byWhen = (a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`);
  const fromRow = row => ({
    id: row.id,
    roomId: row.room_id,
    title: row.title,
    type: row.event_type || 'other',
    date: row.event_date,
    start: String(row.start_time).slice(0, 5),
    end: String(row.end_time).slice(0, 5),
    professor: row.professor || '',
    note: row.description || ''
  });

  let client = null;
  let mode = 'uninitialized'; // shared | local | failed
  const listeners = new Set();
  const emit = change => listeners.forEach(fn => { try { fn(change); } catch (error) { console.error(error); } });
  const firstValue = data => Array.isArray(data) ? data[0] : data;

  function secureRandomToken() {
    const cryptoApi = window.crypto;
    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
      const bytes = new Uint8Array(32);
      cryptoApi.getRandomValues(bytes);
      return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }
    if (mode === 'shared') throw new Error('Secure random generation is unavailable. Open the site over HTTPS or localhost.');
    return `local-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  async function sha256Hex(value) {
    if (!window.crypto || !window.crypto.subtle || typeof TextEncoder === 'undefined') {
      if (mode === 'shared') throw new Error('Secure hashing is unavailable. Open the site over HTTPS or localhost.');
      return String(value);
    }
    const bytes = new TextEncoder().encode(String(value));
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }

  function getEventKeys() { return read(K.eventKeys, {}); }
  function saveEventKey(eventId, token) {
    const keys = getEventKeys();
    keys[String(eventId)] = token;
    write(K.eventKeys, keys);
  }
  function getDeviceToken() {
    let token = '';
    try { token = localStorage.getItem(K.deviceToken) || ''; } catch { /* handled below */ }
    if (!token) {
      token = secureRandomToken();
      try { localStorage.setItem(K.deviceToken, token); }
      catch { throw new Error('This browser cannot save the private seat token. Enable site storage before marking a seat.'); }
    }
    return token;
  }
  async function getDeviceTokenHash() { return sha256Hex(getDeviceToken()); }
  function assertReady() {
    if (mode === 'failed') throw new Error('Supabase is configured but could not be reached. Nothing was saved; check your project URL, publishable key, and connection, then reload.');
    if (mode === 'uninitialized') throw new Error('Storage has not initialized yet. Reload the page and try again.');
  }
  function normalizeEvent(roomId, e) {
    const event = {
      roomId: String(roomId || ''),
      title: String(e.title || '').trim(),
      type: String(e.type || 'other').trim().toLowerCase(),
      date: String(e.date || ''),
      start: String(e.start || '').slice(0, 5),
      end: String(e.end || '').slice(0, 5),
      professor: String(e.professor || '').trim(),
      note: String(e.note || '').trim()
    };
    if (!event.roomId) throw new Error('Choose a classroom.');
    if (!event.title || event.title.length > 80) throw new Error('Event name must be between 1 and 80 characters.');
    if (!['class', 'exam', 'other'].includes(event.type)) throw new Error('Choose a valid event type.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) throw new Error('Choose a valid event date.');
    if (!/^\d{2}:\d{2}$/.test(event.start) || !/^\d{2}:\d{2}$/.test(event.end) || event.end <= event.start) {
      throw new Error('Choose a valid start and end time. Events must end after they start on the same day.');
    }
    if (event.professor.length > 80) throw new Error('Professor name must be 80 characters or fewer.');
    if (event.note.length > 200) throw new Error('Event note must be 200 characters or fewer.');
    return event;
  }
  function assertNoLocalOverlap(existing, event) {
    const conflict = existing.find(prev => prev.date === event.date && event.start < prev.end && event.end > prev.start);
    if (conflict) throw new Error('This classroom already has an event that overlaps that time.');
  }

  function loadLibrary() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = () => reject(new Error('The shared-storage JavaScript library did not load.'));
      document.head.appendChild(script);
    });
  }

  const Store = {
    async init() {
      const cfg = window.SUPABASE_CONFIG || {};
      const url = String(cfg.url || '').trim();
      const key = String(cfg.publishableKey || cfg.anonKey || '').trim();

      if (!url && !key) {
        mode = 'local';
        window.addEventListener('storage', event => {
          if ([K.marks, K.events, K.mine].includes(event.key)) emit({ type: event.key === K.events ? 'events' : 'bookings' });
        });
        return { shared: false, local: true, error: 'Supabase is not configured yet. Events and seat marks are saved only in this browser.' };
      }
      if (!url || !key || !/^https:\/\//i.test(url)) {
        mode = 'failed';
        return { shared: false, error: 'Supabase configuration is incomplete. Add the HTTPS project URL and publishable key in supabase/config.js.' };
      }

      try {
        await loadLibrary();
        client = window.supabase.createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
        client.channel('lhc-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'seat_marks' }, payload => {
            emit({ type: 'bookings', eventId: (payload.new && payload.new.event_id) || (payload.old && payload.old.event_id) });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
            emit({ type: 'events', roomId: (payload.new && payload.new.room_id) || (payload.old && payload.old.room_id) });
          })
          .subscribe((status, error) => {
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.error('Supabase Realtime:', error || status);
          });
        mode = 'shared';
        return { shared: true, local: false };
      } catch (error) {
        console.error(error);
        client = null;
        mode = 'failed';
        return { shared: false, error: 'Supabase could not connect. The app will not silently save changes locally; check the configuration and reload.' };
      }
    },

    isShared() { return mode === 'shared'; },

    async listEvents(roomId) {
      assertReady();
      if (mode === 'shared') {
        const { data, error } = await client.from('events').select(EVENT_COLUMNS).eq('room_id', roomId).order('event_date').order('start_time');
        if (error) throw error;
        return (data || []).map(fromRow);
      }
      return (read(K.events, {})[roomId] || []).slice().sort(byWhen);
    },

    async addEvent(roomId, rawEvent) {
      assertReady();
      const event = normalizeEvent(roomId, rawEvent);
      const token = secureRandomToken();
      const tokenHash = await sha256Hex(token);
      const existing = await Store.listEvents(roomId);
      assertNoLocalOverlap(existing, event);

      if (mode === 'shared') {
        // Preflight storage before creating a remote event, so the creator key can be retained.
        write(K.eventKeys, getEventKeys());
        const { data, error } = await client.rpc('create_event', {
          p_room_id: event.roomId,
          p_title: event.title,
          p_event_type: event.type,
          p_event_date: event.date,
          p_start_time: event.start,
          p_end_time: event.end,
          p_professor: event.professor || null,
          p_description: event.note || null,
          p_owner_token_hash: tokenHash
        });
        if (error) {
          if (error.code === '23P01') throw new Error('This classroom already has an event that overlaps that time.');
          throw new Error(error.message || 'Could not create the event.');
        }
        const row = firstValue(data);
        if (!row || !row.id) throw new Error('The server did not return the created event. Check the Supabase SQL setup.');
        try { saveEventKey(row.id, token); }
        catch (errorSavingKey) {
          // Do not leave an event that its creator cannot manage from this device.
          try { await client.rpc('delete_event', { p_event_id: row.id, p_owner_token_hash: tokenHash }); } catch { /* best effort rollback */ }
          throw errorSavingKey;
        }
        return fromRow(row);
      }

      const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const localEvent = { id, ...event };
      saveEventKey(id, token);
      try {
        const all = read(K.events, {});
        all[event.roomId] = [...(all[event.roomId] || []), localEvent].sort(byWhen);
        write(K.events, all);
      } catch (error) {
        const keys = getEventKeys(); delete keys[id];
        try { write(K.eventKeys, keys); } catch { /* ignore */ }
        throw error;
      }
      emit({ type: 'events', roomId: event.roomId });
      return localEvent;
    },

    canDelete(event) {
      if (!event) return false;
      return Boolean(getEventKeys()[String(event.id)]) || (mode === 'local' && String(event.id).startsWith('local-'));
    },

    async deleteEvent(event) {
      assertReady();
      if (!event || !Store.canDelete(event)) throw new Error('Only the browser that holds this event’s private owner key can delete it.');
      const keys = getEventKeys();
      const token = keys[String(event.id)];
      if (mode === 'shared') {
        const tokenHash = await sha256Hex(token);
        const { data, error } = await client.rpc('delete_event', { p_event_id: event.id, p_owner_token_hash: tokenHash });
        if (error) throw new Error(error.message || 'Could not delete the event.');
        if (firstValue(data) !== true) throw new Error('The server could not verify this event’s owner key.');
      } else {
        const all = read(K.events, {});
        all[event.roomId] = (all[event.roomId] || []).filter(item => String(item.id) !== String(event.id));
        write(K.events, all);
        const prefix = `${event.id}::`;
        const marks = read(K.marks, {});
        Object.keys(marks).filter(key => key.startsWith(prefix)).forEach(key => delete marks[key]);
        write(K.marks, marks);
      }
      delete keys[String(event.id)];
      write(K.eventKeys, keys);
      const prefix = `${event.id}::`;
      write(K.mine, read(K.mine, []).filter(key => !key.startsWith(prefix)));
      emit({ type: 'events', roomId: event.roomId });
      emit({ type: 'bookings', eventId: event.id });
    },

    async listBookings(eventId) {
      assertReady();
      let rows;
      if (mode === 'shared') {
        const { data, error } = await client.from('seat_marks').select('event_id,seat_id,display_name').eq('event_id', eventId);
        if (error) throw error;
        rows = (data || []).map(row => ({ seat: row.seat_id, name: row.display_name || '', rollNumber: '' }));
      } else {
        const prefix = `${eventId}::`;
        rows = Object.entries(read(K.marks, {})).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({
          seat: key.slice(prefix.length), name: value.name || '', rollNumber: ''
        }));
      }
      const mine = new Set(read(K.mine, []));
      return Object.fromEntries(rows.map(row => [row.seat, {
        name: row.name, rollNumber: row.rollNumber, mine: mine.has(bookingKey(eventId, row.seat))
      }]));
    },

    async book(eventId, seatId, displayName, rollNumber) {
      assertReady();
      if (mode === 'local') {
        const localEvents = Object.values(read(K.events, {})).flat();
        const targetEvent = localEvents.find(event => String(event.id) === String(eventId));
        if (!targetEvent || targetEvent.type !== 'exam') throw new Error('Seat marking is available for exam events only.');
      }
      const name = String(displayName || '').trim();
      const roll = String(rollNumber || '').trim();
      if (!name && !roll) throw new Error('Enter your name, roll number, or both.');
      if (name.length > 30) throw new Error('Name must be 30 characters or fewer.');
      if (roll.length > 30) throw new Error('Roll number must be 30 characters or fewer.');

      const deviceToken = getDeviceToken();
      const markerHash = await sha256Hex(deviceToken);
      if (mode === 'shared') {
        const { data, error } = await client.rpc('mark_exam_seat', {
          p_event_id: eventId,
          p_seat_id: String(seatId),
          p_display_name: name || null,
          p_roll_number: roll || null,
          p_marker_token_hash: markerHash
        });
        if (error) {
          if (error.code === '23505') return { ok: false, reason: 'duplicate' };
          throw new Error(error.message || 'Could not mark the seat.');
        }
        const result = String(firstValue(data) || '');
        if (result !== 'ok') return { ok: false, reason: result || 'duplicate' };
      } else {
        const marks = read(K.marks, {});
        const key = bookingKey(eventId, seatId);
        if (marks[key]) return { ok: false, reason: 'seat_taken' };
        const prefix = `${eventId}::`;
        if (Object.entries(marks).some(([markKey, value]) => markKey.startsWith(prefix) && value.markerHash === markerHash)) {
          return { ok: false, reason: 'already_marked' };
        }
        if (roll && Object.entries(marks).some(([markKey, value]) => markKey.startsWith(prefix) && String(value.rollNumber || '').trim().toLowerCase() === roll.toLowerCase())) {
          return { ok: false, reason: 'roll_taken' };
        }
        marks[key] = { name, rollNumber: roll, markerHash };
        write(K.marks, marks);
      }
      const mine = new Set(read(K.mine, []));
      mine.add(bookingKey(eventId, seatId));
      write(K.mine, [...mine]);
      emit({ type: 'bookings', eventId });
      return { ok: true };
    },

    async releaseSeat(eventId, seatId) {
      assertReady();
      const key = bookingKey(eventId, seatId);
      const mine = new Set(read(K.mine, []));
      if (!mine.has(key)) throw new Error('This browser does not hold the private token for that seat mark.');
      if (mode === 'shared') {
        const tokenHash = await getDeviceTokenHash();
        const { data, error } = await client.rpc('release_exam_seat', {
          p_event_id: eventId,
          p_marker_token_hash: tokenHash
        });
        if (error) throw new Error(error.message || 'Could not release your seat.');
        if (firstValue(data) !== true) throw new Error('The server could not verify this seat mark.');
      } else {
        const marks = read(K.marks, {});
        const mark = marks[key];
        if (!mark || mark.markerHash !== await sha256Hex(getDeviceToken())) throw new Error('The server could not verify this seat mark.');
        delete marks[key];
        write(K.marks, marks);
      }
      mine.delete(key);
      write(K.mine, [...mine]);
      emit({ type: 'bookings', eventId });
      return true;
    },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };

  window.LHC_STORE = Store;
})();
