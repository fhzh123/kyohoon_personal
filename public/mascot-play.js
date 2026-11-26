/* Standalone classic-defer enhancement; no dependency on home.js. */
(() => {
  'use strict';
  const initialized = new WeakSet();
  function init(root) {
    if (initialized.has(root) || root.dataset.mascotReady === 'true') return;
    const robot = root.querySelector('[data-mascot-button]');
    const image = root.querySelector('[data-mascot-image]');
    const status = root.querySelector('[data-mascot-status]');
    const snack = root.querySelector('[data-mascot-snack]');
    const petButton = root.querySelector('[data-mascot-pet]');
    if (!robot || !image || !status) return;
    initialized.add(root);
    root.dataset.mascotReady = 'true';
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    [robot, snack, petButton].filter(Boolean).forEach(button => { button.type = 'button'; });
    if (!robot.getAttribute('aria-label') && !robot.getAttribute('aria-labelledby')) {
      robot.setAttribute('aria-label', '로봇 콕 누르기');
    }
    if (!image.hasAttribute('alt')) image.alt = '교훈 로봇';
    image.draggable = false;
    robot.style.touchAction = 'pan-y';
    if (getComputedStyle(robot).position === 'static') robot.style.position = 'relative';
    const media = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reduced = () => !!(media && media.matches) || !!root.closest('[data-home-motion="off"]');
    const timers = new Set();
    const failed = new Set();
    let idleTimer = null;
    let gesture = null;
    let effect = null;
    let fallback = null;
    let pose = 'idle';
    let generation = 0;
    let greeted = false;
    let suppressRobot = 0;
    let suppressSnack = 0;
    const cache = new Map();
    let requestedSrc = null;
    function warm(src) {
      if (!cache.has(src)) {
        const preview = new Image();
        preview.fetchPriority = 'low';
        preview.src = src;
        const entry = {ready: false, promise: null};
        entry.promise = (typeof preview.decode === 'function' ? preview.decode() :
          new Promise((resolve, reject) => { preview.onload = resolve; preview.onerror = reject; }))
          .then(() => { entry.ready = true; return true; }, () => false);
        cache.set(src, entry);
      }
      return cache.get(src);
    }
    const original = image.getAttribute('src');
    let lastGood = image.complete && image.naturalWidth > 0 ? original : null;
    function later(fn, delay) {
      const id = setTimeout(() => { timers.delete(id); fn(); }, delay);
      timers.add(id);
      return id;
    }
    function clear() {
      generation++;
      requestedSrc = null;
      timers.forEach(clearTimeout);
      timers.clear();
      clearTimeout(idleTimer);
      idleTimer = null;
      if (effect) effect.remove();
      effect = null;
    }
    function show(next, state = next) {
      pose = next;
      root.dataset.state = state;
      const src = '/mascot/play/' + next + '.png';
      requestedSrc = src;
      if (failed.has(src)) return;
      const entry = warm(src);
      if (entry.ready) image.setAttribute('src', src);
      else entry.promise.then(ok => {
        if (ok && requestedSrc === src && !failed.has(src)) image.setAttribute('src', src);
      });
    }
    image.addEventListener('load', () => {
      lastGood = image.getAttribute('src');
      image.hidden = false;
      if (fallback) fallback.remove();
      fallback = null;
      delete root.dataset.imageError;
    });
    image.addEventListener('error', () => {
      const bad = image.getAttribute('src');
      failed.add(bad);
      root.dataset.imageError = 'true';
      const replacement = [lastGood, original, '/mascot/play/idle.png']
        .find(src => src && !failed.has(src) && src !== bad);
      if (replacement) image.setAttribute('src', replacement);
      else {
        image.hidden = true;
        if (!fallback) {
          fallback = document.createElement('span');
          fallback.textContent = '🤖';
          fallback.setAttribute('aria-hidden', 'true');
          robot.append(fallback);
        }
      }
    });
    function scheduleBlink() {
      clearTimeout(idleTimer);
      if (document.hidden || reduced() || gesture) return;
      idleTimer = setTimeout(() => {
        if (!root.isConnected || document.hidden || reduced() || gesture) return;
        show('blink');
        later(() => { show('idle'); scheduleBlink(); }, 150);
      }, 3500 + Math.random() * 4000);
    }
    function idle() {
      show('idle');
      scheduleBlink();
    }
    // Every action owns its timers; interrupted actions cannot restore stale poses.
    function sequence(frames, message) {
      clear();
      status.textContent = message;
      if (document.hidden) { idle(); return; }
      if (reduced()) {
        const last = frames[frames.length - 1];
        show(last[0], last[2] || last[0]);
        later(idle, 900);
        return;
      }
      const token = generation;
      let index = 0;
      function step() {
        if (token !== generation) return;
        if (index === frames.length) { idle(); return; }
        const [frame, duration, state] = frames[index++];
        show(frame, state || frame);
        later(step, duration);
      }
      step();
    }
    function pet() {
      sequence([['pet', 500], ['happy', 1000]], '쓰담쓰담, 기분이 좋아요!');
    }
    function feed() {
      sequence([['idle', 350, 'gaze'], ['eat1', 230, 'eat'], ['eat2', 230, 'eat'],
        ['eat1', 230, 'eat'], ['eat2', 230, 'eat'], ['happy', 1100]], '냠냠, 간식 고마워요!');
    }
    function poke(event) {
      sequence([['poke', 650], ['happy', 600]], '아얏! 살살 눌러 주세요.');
      const rect = robot.getBoundingClientRect();
      const pointer = event && event.detail !== 0;
      const x = pointer ? event.clientX - rect.left : rect.width * .5;
      const y = pointer ? event.clientY - rect.top : rect.height * .45;
      effect = document.createElement('span');
      effect.className = 'mascot-poke-effect';
      effect.textContent = '콕';
      effect.setAttribute('aria-hidden', 'true');
      // Convert viewport coordinates to the button's unscaled padding box.
      effect.style.position = 'absolute';
      effect.style.pointerEvents = 'none';
      effect.style.left = Math.max(0, Math.min(robot.clientWidth,
        x * (robot.offsetWidth / (rect.width || 1)) - robot.clientLeft)) + 'px';
      effect.style.top = Math.max(0, Math.min(robot.clientHeight,
        y * (robot.offsetHeight / (rect.height || 1)) - robot.clientTop)) + 'px';
      if (reduced()) effect.style.animation = 'none';
      robot.append(effect);
      later(() => { if (effect) effect.remove(); effect = null; }, 650);
    }
    function inside(x, y, head = false) {
      const r = image.getBoundingClientRect();
      const b = r.width && r.height ? r : robot.getBoundingClientRect();
      return x >= b.left && x <= b.right && y >= b.top &&
        y <= b.top + b.height * (head ? .48 : 1);
    }
    function release() {
      const current = gesture;
      gesture = null; // lostpointercapture may fire synchronously.
      if (!current) return;
      current.control.style.translate = current.translate;
      delete root.dataset.dragging;
      delete root.dataset.dropTarget;
      delete root.dataset.gaze;
      try {
        if (current.control.hasPointerCapture(current.id)) current.control.releasePointerCapture(current.id);
      } catch { /* Capture may already have been released by the browser. */ }
    }
    function cancelGesture() {
      if (!gesture) return;
      if (gesture.kind === 'robot') suppressRobot = Date.now() + 700;
      else suppressSnack = Date.now() + 700;
      release();
      clear();
      idle();
    }
    function bindPointer(control, kind) {
      control.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.isPrimary === false || gesture) return;
        if (kind === 'robot' && !inside(event.clientX, event.clientY, true)) return;
        if (kind === 'robot') suppressRobot = 0;
        else suppressSnack = 0;
        clear();
        gesture = { kind, control, id: event.pointerId, x: event.clientX, y: event.clientY,
          lastX: event.clientX, distance: 0, moved: false, petted: false,
          translate: control.style.translate };
        try { control.setPointerCapture(event.pointerId); } catch { /* Document listeners remain active. */ }
      });
    }
    bindPointer(robot, 'robot');
    if (snack) {
      snack.draggable = false;
      snack.style.touchAction = 'none';
      bindPointer(snack, 'snack');
      snack.addEventListener('dragstart', event => event.preventDefault());
      snack.addEventListener('click', event => {
        if (event.detail !== 0 && Date.now() < suppressSnack) { event.preventDefault(); return; }
        cancelGesture();
        feed();
      });
    }
    robot.addEventListener('dragstart', event => event.preventDefault());
    robot.addEventListener('click', event => {
      if (event.detail !== 0 && Date.now() < suppressRobot) { event.preventDefault(); return; }
      cancelGesture();
      poke(event);
    });
    if (petButton) petButton.addEventListener('click', () => { cancelGesture(); pet(); });
    document.addEventListener('pointermove', event => {
      const g = gesture;
      if (!g || event.pointerId !== g.id) return;
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;
      if (Math.hypot(dx, dy) > 6) g.moved = true;
      if (g.kind === 'robot') {
        if (inside(event.clientX, event.clientY, true) && Math.abs(dy) < 55) {
          g.distance += Math.abs(event.clientX - g.lastX);
          if (!g.petted && g.distance >= 65) { g.petted = true; pet(); }
        }
        g.lastX = event.clientX;
      } else if (g.moved) {
        root.dataset.dragging = 'true';
        root.dataset.dropTarget = String(inside(event.clientX, event.clientY));
        root.dataset.gaze = event.clientX < robot.getBoundingClientRect().left ? 'left' : 'right';
        root.dataset.state = 'gaze';
        g.control.style.translate = dx + 'px ' + dy + 'px';
      }
    });
    document.addEventListener('pointerup', event => {
      const g = gesture;
      if (!g || event.pointerId !== g.id) return;
      const drop = g.kind === 'snack' && g.moved && inside(event.clientX, event.clientY);
      if (g.kind === 'robot' && (g.moved || g.petted)) suppressRobot = Date.now() + 700;
      if (g.kind === 'snack' && g.moved) suppressSnack = Date.now() + 700;
      release();
      if (drop) feed();
      else if (!g.petted) idle();
    });
    document.addEventListener('pointercancel', event => {
      if (gesture && event.pointerId === gesture.id) cancelGesture();
    });
    [robot, snack].filter(Boolean).forEach(control => {
      control.addEventListener('lostpointercapture', event => {
        if (gesture && event.pointerId === gesture.id) cancelGesture();
      });
    });
    window.addEventListener('blur', cancelGesture);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') cancelGesture(); });
    function greet() {
      if (greeted || document.hidden) { idle(); return; }
      greeted = true;
      if (reduced()) { idle(); return; }
      sequence([['wave1', 300, 'wave'], ['wave2', 300, 'wave'],
        ['wave1', 300, 'wave'], ['wave2', 300, 'wave']], '안녕하세요! 만나서 반가워요.');
    }
    document.addEventListener('visibilitychange', () => {
      cancelGesture();
      clear();
      if (document.hidden) show('idle');
      else if (!greeted) greet();
      else idle();
    });
    function motionChanged() {
      cancelGesture();
      clear();
      idle();
    }
    if (media && media.addEventListener) media.addEventListener('change', motionChanged);
    else if (media && media.addListener) media.addListener(motionChanged);
    const observer = new MutationObserver(motionChanged);
    for (let node = root; node; node = node.parentElement) {
      observer.observe(node, { attributes: true, attributeFilter: ['data-home-motion'] });
    }
    for (const name of ['idle','wave1','wave2','poke','pet','eat1','eat2','happy','blink']) {
      warm('/mascot/play/' + name + '.png');
    }
    show('idle');
    greet();
  }
  function start() { document.querySelectorAll('[data-mascot-play]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
