/* Applied before painting; appearance is a browser preference, separate from research data. */
(() => {
  'use strict';
  const key = 'kyohoon-appearance';
  const root = document.documentElement;
  const valid = value => value === 'dark' || value === 'light';
  let theme = 'dark';
  try { const saved = localStorage.getItem(key); if (valid(saved)) theme = saved; } catch {}
  function refresh() {
    for (const button of document.querySelectorAll('[data-theme-toggle]')) {
      button.textContent = theme === 'dark' ? '☀ 라이트 모드' : '☾ 다크 모드';
      button.setAttribute('aria-label', theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = theme === 'dark' ? '현재 다크 모드' : '현재 라이트 모드';
    }
    for (const button of document.querySelectorAll('[data-theme-value]')) {
      button.setAttribute('aria-pressed', String(button.dataset.themeValue === theme));
    }
  }
  function apply(value, persist = false) {
    if (!valid(value)) return;
    theme = value;
    root.dataset.theme = value;
    root.style.colorScheme = value;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = value === 'dark' ? '#0d1422' : '#f4f7fc';
    if (persist) { try { localStorage.setItem(key, value); } catch {} }
    refresh();
  }
  apply(theme);
  document.addEventListener('DOMContentLoaded', refresh);
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-theme-toggle],[data-theme-value]');
    if (!button || button.disabled) return;
    apply(button.dataset.themeValue || (theme === 'dark' ? 'light' : 'dark'), true);
  });
  window.addEventListener('storage', event => {
    if (event.key === key) apply(valid(event.newValue) ? event.newValue : 'dark');
  });
  window.AtlasTheme = {refresh, set: value => apply(value, true), get: () => theme};
})();
