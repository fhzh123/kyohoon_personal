import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {setImmediate} from 'node:timers';
import {JSDOM} from 'jsdom';

const source = await readFile(new URL('../public/mascot-play.js', import.meta.url), 'utf8');
const markup = `<div data-mascot-play>
  <p data-mascot-status role="status" aria-live="polite">Ready</p>
  <button type="button" data-mascot-button><img data-mascot-image src="/mascot/play/idle.webp" alt=""></button>
  <button type="button" data-mascot-snack>Feed</button>
  <button type="button" data-mascot-pet>Pet</button>
</div>`;

// The virtual clock tests DOM state and event ordering, not browser painting
// or operating-system pointer capture. Image decoding never uses the network.
async function fixture(t, {reduced = false, motion = 'system', html = markup, deferDecode = false} = {}) {
  const {window: w} = new JSDOM(html, {url: 'https://fixture.invalid/', runScripts: 'outside-only', pretendToBeVisual: true});
  t.after(() => w.close());
  const timers = new Map();
  let now = 0, nextId = 0;
  w.setTimeout = (callback, delay = 0) => {
    const id = ++nextId;
    timers.set(id, {at: now + Math.max(0, Number(delay) || 0), callback});
    return id;
  };
  w.clearTimeout = id => timers.delete(id);
  w.requestAnimationFrame = callback => w.setTimeout(() => callback(now), 16);
  w.cancelAnimationFrame = w.clearTimeout;
  w.Date.now = () => now;
  w.Math.random = () => 0.5;
  Object.defineProperty(w.performance, 'now', {value: () => now});
  w.matchMedia = () => ({matches: reduced, addEventListener() {}, removeEventListener() {}});
  w.document.documentElement.dataset.homeMotion = motion;
  const decodes = new Map();
  w.HTMLImageElement.prototype.decode = function () {
    if (!deferDecode) return Promise.resolve();
    const src = this.getAttribute('src');
    assert.equal(decodes.has(src), false, 'preload is cached for ' + src);
    return new Promise((resolve, reject) => decodes.set(src, {resolve, reject}));
  };
  const root = w.document.querySelector('[data-mascot-play]');
  const button = root?.querySelector('[data-mascot-button]');
  const snack = root?.querySelector('[data-mascot-snack]');
  const pet = root?.querySelector('[data-mascot-pet]');
  const image = root?.querySelector('[data-mascot-image]');
  const status = root?.querySelector('[data-mascot-status]');
  const captured = new Set();
  for (const element of [button, snack].filter(Boolean)) {
    element.setPointerCapture = id => captured.add(id);
    element.hasPointerCapture = id => captured.has(id);
    element.releasePointerCapture = id => captured.delete(id);
    element.getBoundingClientRect = () => ({
      x: 100, y: 100, left: 100, top: 100, right: 340, bottom: 340, width: 240, height: 240,
    });
  }
  const history = [];
  const record = () => history.push({state: root?.dataset.state, src: image?.getAttribute('src')});
  async function advance(ms) {
    const end = now + ms;
    let steps = 0;
    while (true) {
      // Drain the entire decode/Promise.all/hold chain before choosing the next timer.
      await new Promise(resolve => setImmediate(resolve));
      record();
      const next = [...timers].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      assert.ok(++steps < 10000, 'timer loop must make progress');
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      record();
    }
    now = end;
    record();
  }
  function pointer(target, type, {x = 220, y = 140, id = 1, ...extra} = {}) {
    const event = new w.Event(type, {bubbles: true, cancelable: true});
    Object.assign(event, {clientX: x, clientY: y, pointerId: id, pointerType: 'mouse', button: 0, isPrimary: true, ...extra});
    target.dispatchEvent(event);
  }
  w.eval(source);
  await advance(0);
  return {w, root, button, snack, pet, image, status, captured, timers, history, advance, pointer, decodes};
}

test('module is harmless on pages without a mascot or with incomplete markup', async t => {
  for (const html of ['<main>No mascot</main>', '<div data-mascot-play></div>']) {
    const h = await fixture(t, {html});
    await h.advance(10000);
    assert.equal(h.timers.size, 0);
  }
});

const wave = ['wave-up', 'wave1', 'wave-mid', 'wave2', 'wave-down'];
const poseUrl = name => '/mascot/play/' + name + '.webp';

function frameNames(h) {
  return h.history.map(frame => frame.src?.split('/').pop()?.replace(/\.webp$/, ''))
    .filter((name, i, names) => i === 0 || name !== names[i - 1]);
}

test('a slow arrival waits for all five wave frames, then raises, waves and lowers the hand', async t => {
  const h = await fixture(t, {deferDecode: true});
  assert.deepEqual([...h.decodes.keys()].sort(), ['idle', ...wave].map(poseUrl).sort());
  for (const name of ['idle', ...wave.slice(0, -1)]) h.decodes.get(poseUrl(name)).resolve();
  await h.advance(12000);
  assert.equal(h.root.dataset.state, 'idle');
  assert.deepEqual(frameNames(h), ['idle']);
  h.decodes.get(poseUrl('wave-down')).resolve();
  await h.advance(4000);
  assert.deepEqual(frameNames(h), ['idle', 'wave-up', 'wave1', 'wave-mid', 'wave2', 'wave-mid', 'wave1', 'wave-mid', 'wave2', 'wave-down', 'idle']);
  assert.equal(h.root.dataset.state, 'idle');
});

test('native mascot click interrupts greeting, shows local poke feedback, then removes it', async t => {
  const h = await fixture(t);
  h.button.click();
  assert.equal(h.root.dataset.state, 'poke');
  assert.match(h.status.textContent, /^아얏!/u);
  await h.advance(0);
  assert.match(h.image.src, /\/poke\.webp$/);
  assert.equal(h.button.querySelectorAll('.mascot-poke-effect').length, 1);
  await h.advance(4000);
  assert.equal(h.root.dataset.state, 'idle');
  assert.deepEqual(frameNames(h).slice(-3), ['poke', 'poke-recover', 'idle']);
  assert.equal(h.root.querySelectorAll('.mascot-poke-effect').length, 0);
});

test('native snack click feeds through chewing and happiness without stale greeting frames', async t => {
  const h = await fixture(t);
  h.history.length = 0;
  h.snack.click();
  assert.equal(h.root.dataset.state, 'gaze');
  await h.advance(4000);
  assert.deepEqual(frameNames(h).slice(-6), ['look', 'reach', 'eat1', 'eat2', 'happy', 'idle']);
  assert.ok(!frameNames(h).some(name => wave.includes(name)), 'interrupted greeting stays cancelled');
  assert.equal(h.root.dataset.state, 'idle');
});

test('pet button offers the gesture action through native keyboard-compatible click', async t => {
  const h = await fixture(t);
  const before = h.status.textContent;
  h.pet.click();
  assert.equal(h.root.dataset.state, 'pet');
  assert.notEqual(h.status.textContent, before);
  await h.advance(4000);
  assert.deepEqual(frameNames(h).slice(-5), ['pet', 'pet-nuzzle', 'pet', 'pet-nuzzle', 'idle']);
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.root.querySelector('.mascot-poke-effect'), null);
});

test('rapid alternating input cancels old sequences and leaves only the latest poke', async t => {
  const h = await fixture(t);
  h.snack.click();
  await h.advance(100);
  h.pet.click();
  h.snack.click();
  h.button.click();
  assert.equal(h.root.dataset.state, 'poke');
  await h.advance(0);
  h.history.length = 0;
  await h.advance(4000);
  assert.deepEqual(frameNames(h), ['poke', 'poke-recover', 'idle']);
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.root.querySelectorAll('.mascot-poke-effect').length, 0);
  assert.equal(h.captured.size, 0);
});

test('reduced motion and explicit motion off retain all native actions without wave animation', async t => {
  for (const options of [{reduced: true}, {motion: 'off'}]) {
    const h = await fixture(t, options);
    await h.advance(4000);
    assert.ok(!frameNames(h).some(name => wave.includes(name)));
    for (const action of [h.button, h.snack, h.pet]) {
      const before = h.status.textContent;
      action.click();
      assert.notEqual(h.status.textContent, before);
      await h.advance(4000);
      assert.equal(h.root.dataset.state, 'idle');
    }
  }
});


test('horizontal head rubbing triggers pet and suppresses the following synthetic click', async t => {
  const h = await fixture(t);
  await h.advance(4000);
  h.pointer(h.button, 'pointerdown', {x: 170, y: 140});
  for (const x of [270, 170, 270, 170]) h.pointer(h.button, 'pointermove', {x, y: 140});
  h.pointer(h.button, 'pointerup', {x: 170, y: 140});
  h.button.dispatchEvent(new h.w.MouseEvent('click', {bubbles: true, detail: 1, clientX: 170, clientY: 140}));
  assert.equal(h.root.dataset.state, 'pet');
  assert.equal(h.root.querySelector('.mascot-poke-effect'), null);
  assert.equal(h.captured.size, 0);
  await h.advance(4000);
  assert.equal(h.root.dataset.state, 'idle');
});

test('snack drag feeds only when released over the mascot', async t => {
  for (const inside of [true, false]) {
    const h = await fixture(t);
    await h.advance(4000);
    h.pointer(h.snack, 'pointerdown', {x: 420, y: 400});
    const position = inside ? {x: 220, y: 220} : {x: 500, y: 400};
    h.pointer(h.snack, 'pointermove', position);
    h.pointer(h.snack, 'pointerup', position);
    assert.equal(h.captured.size, 0);
    h.history.length = 0;
    await h.advance(4000);
    assert.equal(h.history.some(frame => frame.src?.endsWith('/eat1.webp')), inside);
    assert.equal(h.root.dataset.state, 'idle');
  }
});

test('cancel and lost capture release snack drag without feeding or leaving stale state', async t => {
  for (const type of ['pointercancel', 'lostpointercapture']) {
    const h = await fixture(t);
    await h.advance(4000);
    h.pointer(h.snack, 'pointerdown', {x: 420, y: 400});
    h.pointer(h.snack, 'pointermove', {x: 220, y: 220});
    // The browser has already released capture before lostpointercapture.
    if (type === 'lostpointercapture') h.captured.clear();
    h.pointer(h.snack, type, {x: 220, y: 220});
    assert.equal(h.captured.size, 0);
    h.history.length = 0;
    await h.advance(4000);
    assert.equal(h.history.some(frame => frame.src?.endsWith('/eat1.webp')), false);
    assert.equal(h.root.dataset.state, 'idle');
    h.snack.click();
    await h.advance(4000);
    assert.ok(h.history.some(frame => frame.src?.endsWith('/eat1.webp')), 'feeding still works after cancel');
  }
});

test('cancelled head contact never pets or pokes and permits the next native click', async t => {
  const h = await fixture(t);
  await h.advance(4000);
  h.pointer(h.button, 'pointerdown', {x: 180, y: 140});
  h.pointer(h.button, 'pointercancel', {x: 180, y: 140});
  assert.equal(h.captured.size, 0);
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.root.querySelector('.mascot-poke-effect'), null);
  h.button.click();
  assert.equal(h.root.dataset.state, 'poke');
});


test('Escape and window blur cancel an active drag and clear transient styles', async t => {
  for (const kind of ['escape', 'blur']) {
    const h = await fixture(t);
    await h.advance(4000);
    h.pointer(h.snack, 'pointerdown', {x: 420, y: 400});
    h.pointer(h.snack, 'pointermove', {x: 220, y: 220});
    assert.equal(h.root.dataset.dragging, 'true');
    if (kind === 'escape') h.w.document.dispatchEvent(new h.w.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    else h.w.dispatchEvent(new h.w.Event('blur'));
    assert.equal(h.captured.size, 0);
    for (const key of ['dragging', 'dropTarget', 'gaze']) assert.equal(h.root.dataset[key], undefined);
    assert.ok(!h.snack.style.translate, 'snack returns to its original position');
    h.history.length = 0;
    await h.advance(4000);
    assert.equal(h.history.some(frame => /\/eat[12]\.webp$/.test(frame.src)), false);
  }
});

test('hidden tabs cancel active work and resume idle blinking without replaying the greeting', async t => {
  const h = await fixture(t);
  h.snack.click();
  Object.defineProperty(h.w.document, 'hidden', {configurable: true, value: true});
  h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.timers.size, 0);
  h.history.length = 0;
  await h.advance(30000);
  assert.equal(h.history.every(frame => frame.state === 'idle'), true);
  Object.defineProperty(h.w.document, 'hidden', {configurable: true, value: false});
  h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));
  h.history.length = 0;
  await h.advance(5500);
  assert.equal(h.root.dataset.state, 'blink');
  await h.advance(150);
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.history.some(frame => frame.state === 'wave' || frame.state === 'eat'), false);
});

test('turning motion off mid-action clears old frames and keeps static feedback interactive', async t => {
  const h = await fixture(t);
  h.snack.click();
  h.w.document.documentElement.dataset.homeMotion = 'off';
  await h.advance(0); // Deliver the motion-setting MutationObserver.
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.timers.size, 0);
  h.history.length = 0;
  h.pet.click();
  assert.equal(h.root.dataset.state, 'pet');
  await h.advance(899);
  assert.equal(h.root.dataset.state, 'pet');
  await h.advance(1);
  assert.equal(h.root.dataset.state, 'idle');
  await h.advance(10000);
  assert.deepEqual(frameNames(h).slice(-2), ['pet-nuzzle', 'idle']);
  assert.ok(h.history.every(frame => ['pet', 'idle'].includes(frame.state)));
});

test('failed pose falls back to the last loaded image and is not retried on the next action', async t => {
  const h = await fixture(t);
  await h.advance(4000);
  h.image.dispatchEvent(new h.w.Event('load'));
  const good = h.image.getAttribute('src');
  h.button.click();
  await h.advance(0);
  assert.match(h.image.src, /\/poke\.webp$/);
  h.image.dispatchEvent(new h.w.Event('error'));
  assert.equal(h.image.getAttribute('src'), good);
  assert.equal(h.root.dataset.imageError, 'true');
  h.button.click();
  assert.equal(h.image.getAttribute('src'), good);
  assert.ok(h.status.textContent.trim(), 'text feedback survives a failed pose');
  h.image.dispatchEvent(new h.w.Event('load'));
  assert.equal(h.root.dataset.imageError, undefined);
});

test('total image failure leaves a single fallback and working controls', async t => {
  const h = await fixture(t, {motion: 'off'});
  h.image.dispatchEvent(new h.w.Event('error'));
  assert.equal(h.image.hidden, true);
  assert.equal(h.button.querySelectorAll('span[aria-hidden="true"]').length, 1);
  h.pet.click();
  h.image.dispatchEvent(new h.w.Event('error'));
  h.image.dispatchEvent(new h.w.Event('error'));
  assert.equal(h.button.querySelectorAll('span[aria-hidden="true"]').length, 1);
  assert.ok(h.status.textContent.trim());
  await h.advance(900);
  assert.equal(h.root.dataset.state, 'idle');
});


test('late decodes cannot overwrite a newer interaction or its final idle pose', async t => {
  const h = await fixture(t, {deferDecode: true});
  h.button.click();
  assert.equal(h.root.dataset.state, 'poke', 'feedback starts before decoding');
  assert.equal(h.button.querySelectorAll('.mascot-poke-effect').length, 1);
  h.pet.click();
  for (const name of ['idle', 'poke', ...wave]) h.decodes.get(poseUrl(name)).resolve();
  await h.advance(12000);
  assert.equal(h.root.dataset.state, 'pet');
  assert.deepEqual(frameNames(h), ['idle'], 'superseded greet and poke never display');
  h.decodes.get(poseUrl('pet')).resolve();
  await h.advance(0);
  assert.match(h.image.src, /\/pet\.webp$/);
  await h.advance(10000);
  assert.match(h.image.src, /\/pet\.webp$/, 'keep the first frame until the nuzzle decodes');
  h.decodes.get(poseUrl('pet-nuzzle')).resolve();
  await h.advance(0);
  assert.match(h.image.src, /\/pet-nuzzle\.webp$/);
  await h.advance(2000);
  assert.equal(h.root.dataset.state, 'idle');
  assert.deepEqual(frameNames(h), ['idle', 'pet', 'pet-nuzzle', 'pet', 'pet-nuzzle', 'idle']);
});

test('hiding the tab invalidates an outstanding decoded pose', async t => {
  const h = await fixture(t, {deferDecode: true});
  h.button.click();
  Object.defineProperty(h.w.document, 'hidden', {configurable: true, value: true});
  h.w.document.dispatchEvent(new h.w.Event('visibilitychange'));
  h.decodes.get('/mascot/play/poke.webp').resolve();
  for (const name of wave) h.decodes.get(poseUrl(name)).resolve();
  await h.advance(0);
  assert.equal(h.root.dataset.state, 'idle');
  assert.match(h.image.src, /\/idle\.webp$/);
  assert.equal(h.timers.size, 0);
});

test('decode rejection keeps the previous image and allows another action to succeed', async t => {
  const h = await fixture(t, {deferDecode: true});
  h.button.click();
  h.decodes.get('/mascot/play/poke.webp').reject(new Error('fixture decode failure'));
  await h.advance(0);
  assert.equal(h.root.dataset.state, 'poke');
  assert.match(h.image.src, /\/idle\.webp$/);
  h.pet.click();
  h.decodes.get('/mascot/play/pet.webp').resolve();
  await h.advance(0);
  assert.equal(h.root.dataset.state, 'pet');
  assert.match(h.image.src, /\/pet\.webp$/);
});

test('reduced motion holds a slow static reaction for its full duration after decode', async t => {
  const h = await fixture(t, {reduced: true, deferDecode: true});
  assert.deepEqual([...h.decodes.keys()], [poseUrl('idle')]);
  h.decodes.get(poseUrl('idle')).resolve();
  h.button.click();
  h.pet.click();
  h.decodes.get(poseUrl('poke')).resolve();
  await h.advance(5000);
  assert.equal(h.root.dataset.state, 'pet');
  assert.deepEqual(frameNames(h), ['idle'], 'interrupted poke and greeting stay cancelled');
  h.decodes.get(poseUrl('pet-nuzzle')).resolve();
  await h.advance(899);
  assert.match(h.image.src, /\/pet-nuzzle\.webp$/);
  assert.equal(h.root.dataset.state, 'pet');
  await h.advance(1);
  assert.equal(h.root.dataset.state, 'idle');
  assert.deepEqual(frameNames(h), ['idle', 'pet-nuzzle', 'idle']);
});

const menuMarkup = `<main class="home-main">${markup}
  <nav class="home-spaces">
    <a href="/resume" data-pose="/mascot/resume-hover.webp">Resume</a>
    <a href="/work" data-pose="/mascot/selectstar-hover.webp">Selectstar</a>
    <a href="/paper" data-pose="/mascot/paper-pose.webp">Paper</a>
    <a href="/personal" data-pose="/mascot/personal-pose.webp">Personal</a>
  </nav>
</main>`;

test('menu hover survives idle blinking and falls back to keyboard focus before idle', async t => {
  const h = await fixture(t, {html: menuMarkup});
  await h.advance(4000);
  const links = [...h.w.document.querySelectorAll('[data-pose]')];
  for (const link of links) {
    link.focus();
    await h.advance(0);
    assert.equal(h.image.getAttribute('src'), link.dataset.pose);
    assert.equal(h.root.dataset.state, 'menu');
  }
  h.pointer(links[0], 'pointerenter');
  await h.advance(0);
  h.history.length = 0;
  await h.advance(8000);
  assert.ok(h.history.every(frame => frame.src === links[0].dataset.pose));
  h.pointer(links[0].parentElement, 'pointerleave');
  await h.advance(0);
  assert.equal(h.image.getAttribute('src'), links[3].dataset.pose);
  links[3].blur();
  await h.advance(0);
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.image.getAttribute('src'), poseUrl('idle'));
});

test('greeting takes priority over a menu pose selected while wave images are loading', async t => {
  const h = await fixture(t, {html: menuMarkup, deferDecode: true});
  const [first, second] = h.w.document.querySelectorAll('[data-pose]');
  h.pointer(first, 'pointerenter');
  h.decodes.get(first.dataset.pose).resolve();
  await h.advance(0);
  assert.equal(h.image.getAttribute('src'), first.dataset.pose);
  for (const name of ['idle', ...wave]) h.decodes.get(poseUrl(name)).resolve();
  await h.advance(0);
  assert.equal(h.root.dataset.state, 'wave');
  assert.equal(h.image.getAttribute('src'), poseUrl('wave-up'));
  h.pointer(second, 'pointerenter');
  await h.advance(0);
  assert.equal(h.root.dataset.state, 'wave', 'menu input cannot interrupt greeting');
  await h.advance(4000);
  h.decodes.get(second.dataset.pose).resolve();
  await h.advance(0);
  assert.equal(h.root.dataset.state, 'menu');
  assert.equal(h.image.getAttribute('src'), second.dataset.pose);
});

test('mascot, snack and pet clicks take priority over menu hover and focus', async t => {
  for (const [control, state] of [['button', 'poke'], ['snack', 'gaze'], ['pet', 'pet']]) {
    const h = await fixture(t, {html: menuMarkup});
    await h.advance(4000);
    const [first, second] = h.w.document.querySelectorAll('[data-pose]');
    first.focus();
    await h.advance(0);
    assert.equal(h.root.dataset.state, 'menu');
    h[control].click();
    h.pointer(second, 'pointerenter');
    await h.advance(0);
    assert.equal(h.root.dataset.state, state, control + ' owns playback');
    assert.notEqual(h.image.getAttribute('src'), first.dataset.pose);
    assert.notEqual(h.image.getAttribute('src'), second.dataset.pose);
    await h.advance(4000);
    assert.equal(h.root.dataset.state, 'menu');
    assert.equal(h.image.getAttribute('src'), second.dataset.pose);
  }
});

test('late menu decodes cannot overwrite a click or the selected menu after it finishes', async t => {
  const h = await fixture(t, {html: menuMarkup, reduced: true, deferDecode: true});
  const [first, second] = h.w.document.querySelectorAll('[data-pose]');
  h.pointer(first, 'pointerenter');
  h.button.click();
  h.pointer(second, 'pointerenter');
  h.decodes.get(poseUrl('poke')).resolve();
  h.decodes.get(first.dataset.pose).resolve();
  await h.advance(0);
  assert.equal(h.root.dataset.state, 'poke');
  assert.equal(h.image.getAttribute('src'), poseUrl('poke'));
  await h.advance(900);
  h.decodes.get(second.dataset.pose).resolve();
  await h.advance(0);
  assert.equal(h.image.getAttribute('src'), second.dataset.pose);
});

test('leaving a menu before its image decodes keeps idle visible with motion off', async t => {
  const h = await fixture(t, {html: menuMarkup, motion: 'off', deferDecode: true});
  h.decodes.get(poseUrl('idle')).resolve();
  await h.advance(0);
  const link = h.w.document.querySelector('[data-pose]');
  h.pointer(link, 'pointerenter');
  h.pointer(link.parentElement, 'pointerleave');
  h.decodes.get(link.dataset.pose).resolve();
  await h.advance(0);
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.image.getAttribute('src'), poseUrl('idle'));
});
