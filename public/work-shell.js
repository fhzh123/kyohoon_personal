/* Work shell: sub-menu folding, the small-screen drawer and the current sub-item. */
(() => {
  'use strict';
  const sidebar = document.getElementById('ws-sidebar');
  if (!sidebar) return;
  const KEY = 'kyohoon-work-nav-open';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const write = value => { try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {} };
  const aliases = {calendar: 'roadmap', gantt: 'roadmap', references: 'roadmap'};

  function setOpen(item, open, remember = true) {
    const toggle = item.querySelector('.ws-nav-toggle'), sub = item.querySelector('.ws-sub');
    if (!toggle || !sub) return;
    sub.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    const label = item.querySelector('.ws-nav-label')?.textContent || '';
    toggle.setAttribute('aria-label', `${label} 하위 메뉴 ${open ? '접기' : '펼치기'}`);
    if (remember) { const saved = read(); saved[item.dataset.wsSection] = open; write(saved); }
  }
  const saved = read();
  for (const item of sidebar.querySelectorAll('.ws-nav-item')) {
    if (!item.classList.contains('is-current') && saved[item.dataset.wsSection] === true) setOpen(item, true, false);
  }
  sidebar.addEventListener('click', event => {
    const toggle = event.target.closest('.ws-nav-toggle');
    if (toggle) { const item = toggle.closest('.ws-nav-item'); setOpen(item, toggle.getAttribute('aria-expanded') !== 'true'); return; }
    if (event.target.closest('a') && document.body.classList.contains('ws-drawer-open')) closeDrawer();
  });

  // Current sub-item follows the hash, which every Work page keeps in sync.
  const current = sidebar.querySelector('.ws-nav-item.is-current');
  function setActive(key) {
    if (!current) return;
    const links = [...current.querySelectorAll('.ws-sub-link:not([target])')];
    if (!links.length) return;
    const match = links.find(link => link.dataset.wsItem === key) || links[0];
    for (const link of links) {
      const on = link === match;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
  }
  const fromHash = () => { const key = decodeURIComponent(location.hash.slice(1)); return aliases[key] || key; };
  setActive(fromHash());
  window.addEventListener('hashchange', () => setActive(fromHash()));
  window.WorkShell = {setActive};

  // Drawer for narrow screens.
  const scrim = document.querySelector('.ws-scrim'), opener = document.querySelector('[data-ws-open]');
  function openDrawer() {
    document.body.classList.add('ws-drawer-open'); if (scrim) scrim.hidden = false;
    opener?.setAttribute('aria-expanded', 'true');
    sidebar.querySelector('.ws-drawer-close')?.focus();
  }
  function closeDrawer() {
    if (!document.body.classList.contains('ws-drawer-open')) return;
    document.body.classList.remove('ws-drawer-open'); if (scrim) scrim.hidden = true;
    opener?.setAttribute('aria-expanded', 'false'); opener?.focus();
  }
  opener?.addEventListener('click', openDrawer);
  document.addEventListener('click', event => { if (event.target.closest('[data-ws-close]')) closeDrawer(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDrawer(); });
})();
