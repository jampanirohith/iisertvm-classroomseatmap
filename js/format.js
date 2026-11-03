// Small date, time and text helpers shared by every page.
(function () {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => isoOf(new Date());
  const parseDate = iso => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(+d) ? null : d;
  };
  const part = (d, opts) => new Intl.DateTimeFormat('en-GB', opts).format(d);
  // "Thu, 5 November, 2026"
  const dateLong = iso => { const d = parseDate(iso); return d ? `${part(d, { weekday: 'short' })}, ${d.getDate()} ${part(d, { month: 'long' })}, ${d.getFullYear()}` : String(iso || ''); };
  // "Thu 5 Nov"
  const dateShort = iso => { const d = parseDate(iso); return d ? `${part(d, { weekday: 'short' })} ${d.getDate()} ${part(d, { month: 'short' })}` : String(iso || ''); };
  // "10:30 AM"
  const timeLabel = v => {
    const [h, m] = String(v || '').slice(0, 5).split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? `${pad(h % 12 || 12)}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}` : String(v || '');
  };
  // "9:00 – 10:30 AM" (or "11:30 AM – 12:30 PM" when the meridiem changes): short enough for a calendar block
  const timeRange = (a, b) => {
    const [x, y] = [a, b].map(timeLabel);
    const clean = t => t.replace(/^0/, '');
    return x.slice(-2) === y.slice(-2) ? `${clean(x.slice(0, -3))} – ${clean(y)}` : `${clean(x)} – ${clean(y)}`;
  };
  const minutes = v => { const [h, m] = String(v || '').slice(0, 5).split(':').map(Number); return h * 60 + m; };
  const TYPE = { class: 'Class', exam: 'Exam', other: 'Other' };
  const typeOf = t => (TYPE[t] ? t : 'other');
  window.LHC_FMT = Object.freeze({ pad, esc, isoOf, todayISO, parseDate, part, dateLong, dateShort, timeLabel, timeRange, minutes, TYPE, typeOf });
})();
