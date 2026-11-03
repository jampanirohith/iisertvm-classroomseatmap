// A weekly schedule grid in the style of Google Calendar: seven day columns (Monday to Sunday),
// hour rows, event blocks, a "now" line, and click-an-empty-slot-to-add.
(function () {
  'use strict';
  const F = window.LHC_FMT;
  const HOUR_H = 52;            // pixels per hour
  const SNAP = 30;              // minutes; a click on an empty slot snaps to the half hour
  const DEFAULT_FROM = 7, DEFAULT_TO = 21;

  const shift = (iso, days) => { const d = F.parseDate(iso); d.setDate(d.getDate() + days); return F.isoOf(d); };
  const mondayOf = iso => { const d = F.parseDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return F.isoOf(d); };
  const hourLabel = h => `${h % 12 || 12} ${h >= 12 && h < 24 ? 'PM' : 'AM'}`;
  const hhmm = mins => `${F.pad(Math.floor(mins / 60))}:${F.pad(mins % 60)}`;
  const arrow = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  function weekTitle(first) {
    const a = F.parseDate(first), b = F.parseDate(shift(first, 6));
    const month = d => F.part(d, { month: 'short' });
    const left = a.getMonth() === b.getMonth() ? `${a.getDate()}` : `${a.getDate()} ${month(a)}`;
    return `${left} – ${b.getDate()} ${month(b)} ${b.getFullYear()}`;
  }

  // options: { onSlot(dateISO, 'HH:MM'), onEvent(event), canMove(event) -> boolean, onMove(event, dateISO, start, end) }
// With canMove/onMove, a mouse user can drag an event to another time or day to reschedule it.
  function create(container, options) {
    const opts = options || {};
    let weekStart = mondayOf(F.todayISO());
    let events = [];
    let range = { from: DEFAULT_FROM, to: DEFAULT_TO };

    container.innerHTML = `
      <div class="cal-toolbar">
        <button type="button" class="btn" data-cal="today">Today</button>
        <button type="button" class="icon-btn" data-cal="prev" aria-label="Previous week">${arrow('M15 5l-7 7 7 7')}</button>
        <button type="button" class="icon-btn" data-cal="next" aria-label="Next week">${arrow('M9 5l7 7-7 7')}</button>
        <h2 class="cal-title" data-cal-title aria-live="polite"></h2>
      </div>
      <div class="cal-scroll" data-cal-scroll><div class="cal-grid" data-cal-grid></div></div>`;
    const grid = container.querySelector('[data-cal-grid]');
    const scroller = container.querySelector('[data-cal-scroll]');
    const title = container.querySelector('[data-cal-title]');

    function render() {
      const days = Array.from({ length: 7 }, (_, i) => shift(weekStart, i));
      const inWeek = events.filter(e => days.includes(e.date));
      let from = DEFAULT_FROM, to = DEFAULT_TO;
      inWeek.forEach(e => { from = Math.min(from, Math.floor(F.minutes(e.start) / 60)); to = Math.max(to, Math.ceil(F.minutes(e.end) / 60)); });
      range = { from, to };
      const hours = to - from, today = F.todayISO(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
      title.textContent = weekTitle(weekStart);
      grid.style.setProperty('--hours', hours);
      grid.style.setProperty('--hour-h', `${HOUR_H}px`);

      let html = '<div class="cal-corner"></div>';
      days.forEach(iso => {
        const d = F.parseDate(iso);
        html += `<div class="cal-day-head${iso === today ? ' today' : ''}">${F.part(d, { weekday: 'short' })}<b>${d.getDate()}</b></div>`;
      });
      html += `<div class="cal-times" aria-hidden="true">${Array.from({ length: hours }, (_, i) => `<span style="top:${i === 0 ? '2px;transform:none' : `${i * HOUR_H}px`}">${hourLabel(from + i)}</span>`).join('')}</div>`;
      days.forEach(iso => {
        let col = '';
        inWeek.filter(e => e.date === iso).forEach(e => {
          const top = (F.minutes(e.start) - from * 60) * HOUR_H / 60;
          const height = Math.max(24, (F.minutes(e.end) - F.minutes(e.start)) * HOUR_H / 60 - 2);
          const type = F.typeOf(e.type);
          col += `<button type="button" class="cal-ev" data-event="${F.esc(e.id)}" data-type="${type}" style="top:${top}px;height:${height}px" aria-label="${F.esc(e.title)}, ${F.esc(F.TYPE[type])}, ${F.esc(F.dateLong(e.date))}, ${F.esc(F.timeLabel(e.start))} to ${F.esc(F.timeLabel(e.end))}"><strong>${F.esc(e.title)}</strong><span>${F.esc(F.timeRange(e.start, e.end))}</span>${e.professor && height > 62 ? `<span>${F.esc(e.professor)}</span>` : ''}</button>`;
        });
        if (iso === today && nowMin >= from * 60 && nowMin <= to * 60) col += `<div class="cal-now" style="top:${(nowMin - from * 60) * HOUR_H / 60}px"></div>`;
        html += `<div class="cal-col" data-date="${iso}">${col}</div>`;
      });
      grid.innerHTML = html;
    }

    // Scroll to the first event of the week, or to the working day when the week is empty.
    function scrollToRelevant() {
      const days = Array.from({ length: 7 }, (_, i) => shift(weekStart, i));
      const starts = events.filter(e => days.includes(e.date)).map(e => F.minutes(e.start));
      const now = new Date();
      let target = 8 * 60;
      if (starts.length) target = Math.min(...starts);
      else if (days.includes(F.todayISO())) target = Math.max(0, now.getHours() * 60 - 60);
      scroller.scrollTop = Math.max(0, (target - range.from * 60) * HOUR_H / 60 - 12);
    }

    function setWeek(iso) { weekStart = mondayOf(iso); render(); scrollToRelevant(); }

    // ---------- drag an event to reschedule it (mouse and pen; touch users edit from the event details) ----------
    let drag = null, suppressClick = false;
    container.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' || e.button !== 0 || !opts.canMove || !opts.onMove) return;
      const block = e.target.closest('.cal-ev');
      const ev = block && events.find(x => String(x.id) === block.dataset.event);
      if (ev && opts.canMove(ev)) drag = { block, ev, x: e.clientX, y: e.clientY, moved: false };
    });
    document.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      drag.block.classList.add('dragging');
      drag.block.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    document.addEventListener('pointerup', e => {
      if (!drag) return;
      const { block, ev, y, moved } = drag;
      drag = null;
      if (!moved) return;
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      block.classList.remove('dragging'); block.style.transform = '';
      const col = [...grid.querySelectorAll('.cal-col')].find(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; });
      const length = F.minutes(ev.end) - F.minutes(ev.start);
      const start = Math.max(0, Math.min(24 * 60 - 1 - length, F.minutes(ev.start) + Math.round((e.clientY - y) / HOUR_H * 60 / 15) * 15));
      const date = col ? col.dataset.date : ev.date;
      if (date === ev.date && start === F.minutes(ev.start)) return;
      opts.onMove(ev, date, hhmm(start), hhmm(start + length));
    });
    document.addEventListener('pointercancel', () => { if (drag) { drag.block.classList.remove('dragging'); drag.block.style.transform = ''; drag = null; } });

    // ---------- highlight only the half-hour cell under the pointer (the one a click would add to) ----------
    const hover = document.createElement('div');
    hover.className = 'cal-hover';
    const slotH = SNAP * HOUR_H / 60;
    const slotAt = (col, clientY) => {
      const y = Math.max(0, clientY - col.getBoundingClientRect().top);
      const index = Math.min((range.to - range.from) * 60 / SNAP - 1, Math.floor(y / slotH));
      return { top: index * slotH, mins: range.from * 60 + index * SNAP };
    };
    grid.addEventListener('pointermove', e => {
      const col = e.target.closest('.cal-col');
      if (!col || e.target.closest('.cal-ev') || drag || e.pointerType === 'touch') { hover.remove(); return; }
      const slot = slotAt(col, e.clientY);
      hover.style.top = `${slot.top}px`;
      hover.style.height = `${slotH}px`;
      hover.textContent = F.timeLabel(hhmm(slot.mins)).replace(/^0/, '');
      if (hover.parentNode !== col) col.appendChild(hover);
    });
    grid.addEventListener('pointerleave', () => hover.remove());

    container.addEventListener('click', e => {
      if (suppressClick) return;
      const nav = e.target.closest('[data-cal]');
      if (nav) {
        if (nav.dataset.cal === 'today') setWeek(F.todayISO());
        else setWeek(shift(weekStart, nav.dataset.cal === 'next' ? 7 : -7));
        return;
      }
      const block = e.target.closest('.cal-ev');
      if (block) { const ev = events.find(x => String(x.id) === block.dataset.event); if (ev && opts.onEvent) opts.onEvent(ev); return; }
      const col = e.target.closest('.cal-col');
      if (col && opts.onSlot) {
        const y = e.clientY - col.getBoundingClientRect().top;
        const mins = Math.min(23 * 60 + 30, range.from * 60 + Math.floor(y / HOUR_H * 60 / SNAP) * SNAP);
        opts.onSlot(col.dataset.date, hhmm(mins));
      }
    });
    setInterval(() => { if (!drag) render(); }, 60000);   // keeps the "now" line current

    render();
    return {
      setEvents(list) { events = list.slice(); render(); },
      setWeek,
      showDate(iso) { setWeek(iso); },
      weekOf() { return weekStart; },
      refresh: render
    };
  }
  window.LHC_CALENDAR = Object.freeze({ create, mondayOf, shift });
})();
