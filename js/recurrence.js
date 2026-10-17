(function () {
  'use strict';
  const MAX_RANGE_DAYS = 180;
  function parseISO(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
    const date = new Date(`${iso}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? null : date;
  }
  function isoDate(date) { return date.toISOString().slice(0, 10); }
  function addDays(iso, amount) {
    const date = parseISO(iso);
    if (!date || !Number.isInteger(amount)) throw new Error('Enter a valid calendar date.');
    date.setUTCDate(date.getUTCDate() + amount);
    return isoDate(date);
  }
  function weekday(iso) {
    const date = parseISO(iso);
    if (!date) throw new Error('Enter a valid start date.');
    return date.getUTCDay() || 7; // ISO: Monday=1 ... Sunday=7
  }
  function dates(startISO, untilISO, weekdays) {
    const start = parseISO(startISO), until = parseISO(untilISO);
    if (!start || !until) throw new Error('Choose valid start and repeat-until dates.');
    if (until < start) throw new Error('Repeat-until date must be on or after the start date.');
    const span = Math.round((until - start) / 86400000);
    if (span > MAX_RANGE_DAYS) throw new Error('Recurring classes can be scheduled up to 180 days ahead.');
    const days = [...new Set((weekdays || []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 7))];
    if (!days.length) throw new Error('Choose at least one weekday for this class.');
    const out = [];
    for (let offset = 0; offset <= span; offset++) {
      const d = new Date(start.getTime());
      d.setUTCDate(d.getUTCDate() + offset);
      const day = d.getUTCDay() || 7;
      if (days.includes(day)) out.push(isoDate(d));
    }
    if (!out.length) throw new Error('No class dates fall within that range. Check the selected weekdays.');
    if (out.length > 130) throw new Error('That creates too many class sessions. Choose a shorter repeat period.');
    return out;
  }
  window.LHC_RECURRENCE = Object.freeze({ MAX_RANGE_DAYS, addDays, weekday, dates });
})();
