/* Pause is independent from appearance and never touches workspace data. */
(() => {
  const root = document.documentElement;
  const key = 'kyohoon-background-paused';
  let paused = false;
  try { paused = localStorage.getItem(key) === 'true'; } catch {}
  function refresh() {
    root.dataset.ambientPaused = String(paused);
    for (const button of document.querySelectorAll('[data-ambient-toggle]')) {
      const label = paused ? '배경 움직임 재생' : '배경 움직임 일시정지';
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-pressed', String(paused));
      button.title = label;
      const icon = button.querySelector('img');
      if (icon) icon.src = `/icons/ui-${paused ? 'play' : 'pause'}.svg`;
    }
  }
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-ambient-toggle]')) return;
    paused = !paused;
    try { localStorage.setItem(key, String(paused)); } catch {}
    refresh();
  });
  window.addEventListener('storage', event => { if (event.key === key) { paused = event.newValue === 'true'; refresh(); } });
  document.addEventListener('DOMContentLoaded', refresh);
  // Resume mounts its controls after this shared script has loaded.
  new MutationObserver(refresh).observe(document.body, {childList:true,subtree:true});
  refresh();
})();
