// "All the best" popup: shown when someone opens a bookmarked exam from 15 minutes before it starts until it ends.
(function () {
  'use strict';
  const F = window.LHC_FMT;
  const LEAD_MIN = 15;
  const shownKey = id => `lhc-cheered-${id}`;
  const seen = new Set();

  const at = (date, time) => new Date(`${date}T${String(time || '').slice(0, 5)}:00`);
  // True from 15 minutes before the exam starts until it ends.
  function isTime(ev, now) {
    if (!ev || ev.type !== 'exam') return false;
    const start = at(ev.date, ev.start), end = at(ev.date, ev.end);
    if (Number.isNaN(+start) || Number.isNaN(+end)) return false;
    const t = +(now || new Date());
    return t >= +start - LEAD_MIN * 60000 && t < +end;
  }

  // The picture shown in the popup (transparent background). To use an animated GIF instead, put it in icons/ and change this path.
  const CAT_SRC = 'icons/cheer-cat.png';

  function dialog() {
    let d = document.getElementById('cheer-dialog');
    if (d) return d;
    d = document.createElement('dialog');
    d.id = 'cheer-dialog';
    d.setAttribute('aria-labelledby', 'cheer-title');
    d.innerHTML = `<div class="cheer-art"><img src="${CAT_SRC}" alt="A kitten dancing" width="176" height="247"></div><h2 id="cheer-title">All the best!</h2><p class="cheer-exam" id="cheer-exam"></p><div class="dialog-actions"><button type="button" class="btn primary" id="cheer-close">Thanks!</button></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => { if (e.target === d || e.target.id === 'cheer-close') d.close(); });
    return d;
  }

  // Shows the popup once per exam (per browser tab session). Returns true when it was shown.
  function maybeShow(ev, bookmarked, now) {
    if (!ev || !bookmarked || !isTime(ev, now)) return false;
    const key = shownKey(ev.id);
    if (seen.has(key)) return false;
    try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, '1'); } catch { /* storage unavailable: once per page load */ }
    seen.add(key);
    const d = dialog();
    d.querySelector('#cheer-exam').textContent = `${ev.title} · ${F.timeLabel(ev.start)}`;
    if (!d.open) d.showModal();
    return true;
  }

  window.LHC_CHEER = Object.freeze({ isTime, maybeShow, LEAD_MIN });
})();
