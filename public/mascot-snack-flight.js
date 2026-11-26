/* Classic script. Call animateMascotSnack(root) alongside the feeding sequence. */
(() => {
  'use strict';

  const flights = new WeakMap();
  const noop = () => {};

  // The raised hand in the feeding poses, relative to the shared PNG canvas.
  const HAND = { x: .285, y: .605 };

  /** Start one decorative flight per mascot. Returns an idempotent cancel function. */
  window.animateMascotSnack = function animateMascotSnack(root) {
    if (!root || typeof root.querySelector !== 'function') return noop;
    const previous = flights.get(root);
    if (previous) previous();

    const robot = root.querySelector('[data-mascot-button]');
    const image = root.querySelector('[data-mascot-image]');
    const snack = root.querySelector('[data-mascot-snack]');
    if (!root.isConnected || !robot || !image || !snack) return noop;

    const doc = root.ownerDocument;
    const view = doc.defaultView;
    const media = view.matchMedia ? view.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reduced = () => !!(media && media.matches) || !!root.closest('[data-home-motion="off"]');
    if (doc.hidden || reduced() || !doc.body) return noop;

    const icon = snack.querySelector('img');
    const source = (icon || snack).getBoundingClientRect();
    const bounds = image.getBoundingClientRect();
    if (!source.width || !source.height || !bounds.width || !bounds.height) return noop;

    // object-fit: contain letterboxes the square robot inside a taller button.
    const ratio = image.naturalWidth && image.naturalHeight
      ? image.naturalWidth / image.naturalHeight : 1;
    const width = Math.min(bounds.width, bounds.height * ratio);
    const height = width / ratio;
    const start = { x: source.left + source.width / 2, y: source.top + source.height / 2 };
    const end = {
      x: bounds.left + (bounds.width - width) / 2 + width * HAND.x,
      y: bounds.top + (bounds.height - height) / 2 + height * HAND.y
    };
    const size = Math.max(26, Math.min(42, source.width));
    const cookie = doc.createElement('img');
    if (typeof cookie.animate !== 'function') return noop;
    cookie.className = 'mascot-snack-flight';
    cookie.setAttribute('data-mascot-snack-flight', '');
    cookie.alt = '';
    cookie.setAttribute('aria-hidden', 'true');
    cookie.draggable = false;
    cookie.src = icon ? (icon.currentSrc || icon.src) : '/mascot/play/snack.webp';
    // A viewport layer avoids clipping by the stage and never captures input.
    cookie.style.cssText = 'all:initial;position:fixed;left:0;top:0;display:block;'
      + 'pointer-events:none;user-select:none;object-fit:contain;z-index:2147483646;'
      + 'transform-origin:center;will-change:transform,opacity;'
      + 'width:' + size + 'px;height:' + size + 'px;';

    let animation = null;
    let observer = null;
    let stopped = false;
    function cleanup() {
      if (stopped) return;
      stopped = true;
      if (animation) animation.cancel();
      cookie.remove();
      view.removeEventListener('resize', cleanup);
      view.removeEventListener('scroll', cleanup, true);
      view.removeEventListener('pagehide', cleanup);
      doc.removeEventListener('visibilitychange', visibilityChanged);
      if (media && media.removeEventListener) media.removeEventListener('change', motionChanged);
      else if (media && media.removeListener) media.removeListener(motionChanged);
      if (observer) observer.disconnect();
      if (flights.get(root) === cleanup) flights.delete(root);
    }
    function visibilityChanged() { if (doc.hidden) cleanup(); }
    function motionChanged() { if (reduced()) cleanup(); }

    flights.set(root, cleanup);
    view.addEventListener('resize', cleanup, { passive: true });
    view.addEventListener('scroll', cleanup, { capture: true, passive: true });
    view.addEventListener('pagehide', cleanup);
    doc.addEventListener('visibilitychange', visibilityChanged);
    if (media && media.addEventListener) media.addEventListener('change', motionChanged);
    else if (media && media.addListener) media.addListener(motionChanged);
    if (view.MutationObserver) {
      observer = new view.MutationObserver(motionChanged);
      for (let node = root; node; node = node.parentElement) {
        observer.observe(node, { attributes: true, attributeFilter: ['data-home-motion'] });
      }
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lift = Math.min(95, Math.max(38, Math.abs(dx) * .25 + Math.abs(dy) * .12));
    const frames = [];
    // Sample a quadratic arc; only compositor-friendly transform/opacity change.
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = start.x + dx * t;
      const y = start.y + dy * t - 4 * lift * t * (1 - t);
      frames.push({
        offset: t * .9,
        transform: 'translate3d(' + (x - size / 2) + 'px,' + (y - size / 2)
          + 'px,0) rotate(' + (-18 + 138 * t) + 'deg) scale(' + (1 - .24 * t) + ')',
        opacity: i === 0 ? 0 : 1
      });
    }
    frames.push({ ...frames[frames.length - 1], offset: 1, opacity: 0 });
    cookie.style.transform = frames[0].transform;
    cookie.style.opacity = '0';
    doc.body.append(cookie);
    cookie.addEventListener('error', cleanup, { once: true });
    try {
      animation = cookie.animate(frames, { duration: 600, easing: 'linear', fill: 'both' });
      // Cancellation rejects finished; both paths release the layer and listeners.
      animation.finished.then(cleanup, cleanup);
    } catch {
      cleanup();
    }
    return cleanup;
  };
})();
