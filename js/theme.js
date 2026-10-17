(function () {
  'use strict';
  const KEY = 'lhc-theme';
  const root = document.documentElement;
  const moon = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.9 13A8.8 8.8 0 0 1 11 3.1 8.9 8.9 0 1 0 20.9 13Z"/></svg>';
  const sun = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>';
  try {
    const saved = localStorage.getItem(KEY);
    const theme = saved === 'dark' || saved === 'light' ? saved : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    root.dataset.theme = theme;
  } catch (_) { root.dataset.theme = 'light'; }

  function setup() {
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const refresh = () => {
        const dark = root.dataset.theme === 'dark';
        button.innerHTML = dark ? sun : moon;
        button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
        button.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
        button.setAttribute('aria-pressed', String(dark));
      };
      button.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        root.dataset.theme = next;
        try { localStorage.setItem(KEY, next); } catch (_) { /* theme still applies for this page */ }
        refresh();
      });
      refresh();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
