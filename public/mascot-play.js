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
    robot.style.touchAction = 'pan-y pinch-zoom';
    if (getComputedStyle(robot).position === 'static') robot.style.position = 'relative';
    const media = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reduced = () => !!(media && media.matches) || !!root.closest('[data-home-motion="off"]');
    const timers = new Set();
    const failed = new Set();
    let idleTimer = null;
    let gesture = null;
    let effect = null;
    let cancelFlight;
    let fallback = null;
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
      cancelFlight?.();
      cancelFlight = null;
      generation++;
      requestedSrc = null;
      timers.forEach(clearTimeout);
      timers.clear();
      clearTimeout(idleTimer);
      idleTimer = null;
      if (effect) effect.remove();
      effect = null;
    }
    let hoveredPose = null, focusedPose = null;
    function show(next, state = next) {
      // Menu poses share the renderer but never replace an action frame.
      const menuPose = (next === 'idle' || next === 'blink') && (hoveredPose || focusedPose);
      root.dataset.state = menuPose ? 'menu' : state;
      const src = menuPose || '/mascot/play/' + next + '.webp';
      requestedSrc = src;
      if (failed.has(src)) return;
      const entry = warm(src);
      if (entry.ready) image.setAttribute('src', src);
      else return entry.promise.then(ok => {
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
      const replacement = [lastGood, original, '/mascot/play/idle.webp']
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
      const token = generation;
      if (reduced()) {
        const last = frames[0][0] === 'poke' ? frames[0] : frames[frames.length - 1];
        const pending = show(last[0], last[2] || last[0]);
        const hold = () => { if (token === generation) later(idle, 900); };
        if (pending) pending.then(hold);
        else hold();
        return;
      }
      let index = 0;
      function step() {
        if (token !== generation) return;
        if (index === frames.length) { idle(); return; }
        const [frame, duration, state] = frames[index++];
        const pending = show(frame, state || frame);
        const hold = () => { if (token === generation) later(step, duration); };
        if (pending) pending.then(hold);
        else hold();
      }
      step();
    }
    function pet() {
      sequence([['pet', 250], ['pet-nuzzle', 440, 'pet'], ['pet', 220], ['pet-nuzzle', 400, 'pet']], '쓰담쓰담, 기분이 좋아요!');
    }
    function feed(throwSnack = false) {
      sequence([['look', 260, 'gaze'], ['reach', 340, 'reach'], ['eat1', 390, 'eat'],
        ['eat2', 210, 'eat'], ['eat2', 240, 'chew'], ['happy', 920]], '냠냠, 간식 고마워요!');
      if (throwSnack) cancelFlight = window.animateMascotSnack?.(root);
    }
    function poke(event) {
      sequence([['poke', 280], ['poke-recover', 380, 'recover']], '아얏! 살살 눌러 주세요.');
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
      // Pose PNGs are square and centered inside a contain-fitted image.
      const side = Math.min(b.width, b.height);
      if (!side) return false;
      const u = (x - b.left - (b.width - side) / 2) / side;
      const v = (y - b.top - (b.height - side) / 2) / side;
      if (head) return u >= .22 && u <= .77 && v >= .09 && v <= .59;
      return u >= .12 && u <= .86 && v >= .08 && v <= .92;
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
          lastX: event.clientX, lastOnHead: true, distance: 0, moved: false, petted: false,
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
        feed(true);
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
        const onHead = inside(event.clientX, event.clientY, true);
        if (g.moved && Math.abs(dy) > Math.abs(dx) * 1.2) g.scrolling = true;
        if (!g.scrolling && onHead && g.lastOnHead) {
          g.distance += Math.abs(event.clientX - g.lastX);
          if (!g.petted && g.distance >= Math.min(56, Math.max(36, robot.clientWidth * .17))) { g.petted = true; pet(); }
        }
        g.lastOnHead = onHead;
        g.lastX = event.clientX;
      } else if (g.moved) {
        root.dataset.dragging = 'true';
        root.dataset.dropTarget = String(inside(event.clientX, event.clientY));
        const bounds = robot.getBoundingClientRect();
        root.dataset.gaze = event.clientX < bounds.left + bounds.width / 2 ? 'left' : 'right';
        if (root.dataset.state !== 'gaze') show('look', 'gaze');
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
    const wave = ['wave-up', 'wave1', 'wave-mid', 'wave2', 'wave-down'];
    async function greet() {
      if (greeted || document.hidden) { idle(); return; }
      greeted = true;
      if (reduced()) { idle(); return; }
      const token = generation;
      await Promise.all(wave.map(name => warm('/mascot/play/' + name + '.webp').promise));
      if (generation !== token || document.hidden || reduced()) return;
      sequence([['wave-up', 220, 'wave'], ['wave1', 190, 'wave'], ['wave-mid', 95, 'wave'], ['wave2', 190, 'wave'],
        ['wave-mid', 95, 'wave'], ['wave1', 190, 'wave'], ['wave-mid', 95, 'wave'], ['wave2', 220, 'wave'], ['wave-down', 260, 'wave']], '안녕하세요! 만나서 반가워요.');
    }
    document.addEventListener('visibilitychange', () => {
      cancelGesture();
      clear();
      if (document.hidden) show('idle');
      else if (!greeted) greet();
      else idle();
    });
    let lastReduced = reduced();
    function motionChanged() {
      if (lastReduced === reduced()) return;
      lastReduced = reduced();
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
    const nav = root.closest('.home-main')?.querySelector('.home-spaces');
    function refreshMenu() {
      if (!gesture && ['idle', 'blink', 'menu'].includes(root.dataset.state)) show('idle');
    }
    for (const link of nav?.querySelectorAll('[data-pose]') || []) {
      link.addEventListener('pointerenter', () => { hoveredPose = link.dataset.pose; refreshMenu(); });
      link.addEventListener('focus', () => { focusedPose = link.dataset.pose; refreshMenu(); });
      link.addEventListener('blur', () => { focusedPose = null; refreshMenu(); });
    }
    nav?.addEventListener('pointerleave', () => { hoveredPose = null; refreshMenu(); });
    show('idle');
    greet();
  }
  function start() { document.querySelectorAll('[data-mascot-play]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
