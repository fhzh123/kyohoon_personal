// Keep one visible mascot while the next pose is loading.
(() => {
  const stage = document.querySelector('[data-home-stage]');
  const nav = document.querySelector('.home-spaces');
  const mascot = stage?.querySelector('[data-default-pose]');
  if (!mascot || !nav) return;

  const defaultSrc = mascot.getAttribute('src');
  const poses = new Map();
  let requestedSrc = defaultSrc;
  let displayedSrc = defaultSrc;

  function loadPose(src) {
    if (!poses.has(src)) {
      const image = new Image();
      image.fetchPriority = 'low';
      image.src = src;
      const ready = image.decode().then(() => image, () => {
        poses.delete(src);
        return null;
      });
      poses.set(src, ready);
    }
    return poses.get(src);
  }

  function display(src) {
    displayedSrc = src;
    mascot.classList.toggle('is-space-pose', src !== defaultSrc);
    mascot.src = src;
  }

  async function show(src) {
    requestedSrc = src;
    if (src === displayedSrc) return;
    if (src === defaultSrc) {
      display(src);
      return;
    }
    const ready = await loadPose(src);
    if (ready && requestedSrc === src && displayedSrc !== src) display(src);
  }

  const links = nav.querySelectorAll('[data-pose]');
  for (const link of links) {
    const pose = link.dataset.pose;
    link.addEventListener('pointerenter', () => show(pose));
    link.addEventListener('focus', () => show(pose));
  }
  nav.addEventListener('pointerleave', () => {
    show(document.activeElement?.dataset.pose || defaultSrc);
  });
  nav.addEventListener('focusout', event => {
    if (!nav.contains(event.relatedTarget)) show(defaultSrc);
  });

  // Load secondary poses after giving the initial mascot priority.
  const warm = () => { for (const link of links) void loadPose(link.dataset.pose); };
  if ('requestIdleCallback' in window) requestIdleCallback(warm, {timeout: 2500});
  else setTimeout(warm, 1200);
})();
