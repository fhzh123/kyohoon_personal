// Home: pointing at or focusing a space shows the mascot in that space's pose.
(() => {
  const stage = document.querySelector('[data-home-stage]');
  const nav = document.querySelector('.home-spaces');
  if (!stage || !nav) return;
  const base = stage.querySelector('[data-default-pose]');
  const next = stage.querySelector('[data-next-pose]');
  const defaultSrc = base.getAttribute('src');
  let current = defaultSrc;

  function show(src) {
    if (src === current) return;
    current = src;
    if (src === defaultSrc) { next.classList.remove('is-shown'); base.classList.add('is-shown'); return; }
    const swap = () => { if (current !== src) return; base.classList.remove('is-shown'); next.classList.add('is-shown'); };
    if (next.getAttribute('src') === src && next.complete) { swap(); return; }
    next.classList.remove('is-shown');
    next.src = src;
    next.decode().then(swap, swap);
  }

  for (const link of nav.querySelectorAll('[data-pose]')) {
    const pose = link.dataset.pose;
    link.addEventListener('pointerenter', () => show(pose));
    link.addEventListener('focus', () => show(pose));
  }
  nav.addEventListener('pointerleave', () => { if (!nav.contains(document.activeElement)) show(defaultSrc); });
  nav.addEventListener('focusout', event => { if (!nav.contains(event.relatedTarget)) show(defaultSrc); });

  // Warm the poses once the page is idle so the first swap is instant.
  const warm = () => { for (const link of nav.querySelectorAll('[data-pose]')) { const img = new Image(); img.decoding = 'async'; img.src = link.dataset.pose; } };
  if ('requestIdleCallback' in window) requestIdleCallback(warm, {timeout: 2500}); else setTimeout(warm, 1200);
})();
