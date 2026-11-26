import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';

const source = await readFile(new URL('../public/mascot-play.js', import.meta.url), 'utf8');
const markup = `<div data-mascot-play>
  <p data-mascot-status role="status" aria-live="polite">Ready</p>
  <button type="button" data-mascot-button><img data-mascot-image src="/mascot/play/idle.png" alt=""></button>
  <button type="button" data-mascot-snack>Feed</button>
  <button type="button" data-mascot-pet>Pet</button>
</div>`;

// The virtual clock tests DOM state and event ordering, not browser painting
// or operating-system pointer capture. Image decoding never uses the network.
async function fixture(t, {reduced = false, motion = 'system', html = markup} = {}) {
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
  w.HTMLImageElement.prototype.decode = () => Promise.resolve();
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
      await Promise.resolve();
      await Promise.resolve();
      const next = [...timers].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      assert.ok(++steps < 10000, 'timer loop must make progress');
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
      record();
    }
    now = end;
    await Promise.resolve();
    record();
  }
  function pointer(target, type, {x = 220, y = 140, id = 1, ...extra} = {}) {
    const event = new w.Event(type, {bubbles: true, cancelable: true});
    Object.assign(event, {clientX: x, clientY: y, pointerId: id, pointerType: 'mouse', button: 0, isPrimary: true, ...extra});
    target.dispatchEvent(event);
  }
  w.eval(source);
  await advance(0);
  return {w, root, button, snack, pet, image, status, captured, timers, history, advance, pointer};
}

test('module is harmless on pages without a mascot or with incomplete markup', async t => {
  for (const html of ['<main>No mascot</main>', '<div data-mascot-play></div>']) {
    const h = await fixture(t, {html});
    await h.advance(10000);
    assert.equal(h.timers.size, 0);
  }
});

test('arrival greets with both wave poses and settles back to idle', async t => {
  const h = await fixture(t);
  await h.advance(4000);
  const poses = h.history.map(frame => frame.src);
  assert.ok(poses.some(src => src?.endsWith('/wave1.png')), 'greeting includes first wave');
  assert.ok(poses.some(src => src?.endsWith('/wave2.png')), 'greeting includes second wave');
  assert.equal(h.root.dataset.state, 'idle');
  assert.match(h.image.src, /\/idle\.png$/);
  assert.ok(h.status.textContent.trim());
});

test('native mascot click interrupts greeting, shows local poke feedback, then removes it', async t => {
  const h = await fixture(t);
  h.button.click();
  assert.equal(h.root.dataset.state, 'poke');
  assert.match(h.image.src, /\/poke\.png$/);
  assert.equal(h.button.querySelectorAll('.mascot-poke-effect').length, 1);
  await h.advance(4000);
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.root.querySelectorAll('.mascot-poke-effect').length, 0);
});

test('native snack click feeds through chewing and happiness without stale greeting frames', async t => {
  const h = await fixture(t);
  h.history.length = 0;
  h.snack.click();
  assert.equal(h.root.dataset.state, 'gaze');
  await h.advance(4000);
  const poses = h.history.map(frame => frame.src);
  for (const pose of ['eat1', 'eat2', 'happy']) {
    assert.ok(poses.some(src => src?.endsWith('/' + pose + '.png')), 'feeding shows ' + pose);
  }
  assert.equal(poses.some(src => /\/wave[12]\.png$/.test(src)), false);
  assert.equal(h.root.dataset.state, 'idle');
});

test('pet button offers the gesture action through native keyboard-compatible click', async t => {
  const h = await fixture(t);
  const before = h.status.textContent;
  h.pet.click();
  assert.equal(h.root.dataset.state, 'pet');
  assert.notEqual(h.status.textContent, before);
  await h.advance(4000);
  assert.ok(h.history.some(frame => frame.src?.endsWith('/happy.png')));
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
  h.history.length = 0;
  await h.advance(4000);
  assert.equal(h.history.some(frame => /\/(?:eat[12]|pet|wave[12])\.png$/.test(frame.src)), false);
  assert.equal(h.root.dataset.state, 'idle');
  assert.equal(h.root.querySelectorAll('.mascot-poke-effect').length, 0);
  assert.equal(h.captured.size, 0);
});

test('reduced motion and explicit motion off retain all native actions without wave animation', async t => {
  for (const options of [{reduced: true}, {motion: 'off'}]) {
    const h = await fixture(t, options);
    await h.advance(4000);
    assert.equal(h.history.some(frame => /\/wave[12]\.png$/.test(frame.src)), false);
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
    assert.equal(h.history.some(frame => frame.src?.endsWith('/eat1.png')), inside);
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
    assert.equal(h.history.some(frame => frame.src?.endsWith('/eat1.png')), false);
    assert.equal(h.root.dataset.state, 'idle');
    h.snack.click();
    await h.advance(4000);
    assert.ok(h.history.some(frame => frame.src?.endsWith('/eat1.png')), 'feeding still works after cancel');
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
    assert.equal(h.history.some(frame => /\/eat[12]\.png$/.test(frame.src)), false);
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
  assert.equal(h.root.dataset.state, 'happy');
  await h.advance(899);
  assert.equal(h.root.dataset.state, 'happy');
  await h.advance(1);
  assert.equal(h.root.dataset.state, 'idle');
  await h.advance(10000);
  assert.equal(h.history.some(frame => ['wave', 'blink', 'eat', 'pet'].includes(frame.state)), false);
});

test('failed pose falls back to the last loaded image and is not retried on the next action', async t => {
  const h = await fixture(t);
  await h.advance(4000);
  h.image.dispatchEvent(new h.w.Event('load'));
  const good = h.image.getAttribute('src');
  h.button.click();
  assert.match(h.image.src, /\/poke\.png$/);
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

