// Run explicitly with node --test tests/mascot-play.browser.mjs and an installed Chrome.
// Set MASCOT_QA_DIR to retain the screenshots used for visual inspection.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {before, after, test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import puppeteer from 'puppeteer-core';
import {createHandler} from '../server/app.mjs';
import {localChromePath} from '../server/markdown-pdf.mjs';

let browser, server, origin;
const output = process.env.MASCOT_QA_DIR;
const image = '[data-mascot-image]';
const robot = '[data-mascot-button]';
const snack = '[data-mascot-snack]';

before(async () => {
  if (output) await mkdir(output, {recursive: true});
  browser = await puppeteer.launch({headless: true, executablePath: await localChromePath()});
  server = createServer(createHandler({environment: {}}));
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  try { await browser?.close(); }
  finally { if (server) await new Promise(resolve => server.close(resolve)); }
});

async function pageFor(t, {mobile = false, reduced = false, gateWave = false} = {}) {
  const context = await browser.createBrowserContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.setViewport(mobile ? {width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true}
    : {width: 1280, height: 900, deviceScaleFactor: 1});
  await page.emulateMediaFeatures([{name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference'}]);
  await page.setCacheEnabled(false);
  const gate = Promise.withResolvers();
  const requested = Promise.withResolvers();
  // Hold a real WebP response. The browser still does the image decode and paints
  // the actual homepage, using its ordinary stylesheet, script and image loader.
  await page.setRequestInterception(true);
  page.on('request', async request => {
    if (gateWave && new URL(request.url()).pathname.endsWith('/wave-down.webp')) {
      requested.resolve();
      await gate.promise;
    }
    if (page.isClosed() || request.isInterceptResolutionHandled()) return;
    const local = new URL(request.url()).origin === origin;
    await (local ? request.continue() : request.abort()).catch(() => {});
  });
  t.after(() => gate.resolve());
  await page.goto(origin, {waitUntil: 'domcontentloaded'});
  await page.waitForSelector('[data-mascot-ready="true"]');
  if (gateWave) {
    await Promise.race([requested.promise, delay(5000, null, {ref: false}).then(() => { throw Error('Wave was never requested'); })]);
  }
  return {page, releaseWave: gate.resolve};
}

async function visiblePose(page, name) {
  const sample = await page.waitForFunction((selector, pose) => {
    const img = document.querySelector(selector);
    const box = img.getBoundingClientRect();
    const ready = new URL(img.currentSrc || location.href).pathname.endsWith('/' + pose + '.webp') &&
      img.complete && img.naturalWidth > 0 && img.checkVisibility({opacityProperty: true, visibilityProperty: true}) &&
      box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight;
    if (!ready) return false;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 64, 64);
    return Array.from(ctx.getImageData(0, 0, 64, 64).data);
  }, {polling: 'raf', timeout: 8000}, image, name);
  try { return await sample.jsonValue(); }
  finally { await sample.dispose(); }
}

function distinctFrames(t, poses, first, second) {
  const a = poses.get(first), b = poses.get(second);
  let occupied = 0, changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.max(a[i + 3], b[i + 3]) < 128) continue;
    occupied++;
    const maxDelta = Math.max(...[0, 1, 2, 3].map(n => Math.abs(a[i + n] - b[i + n])));
    if (maxDelta > 35) changed++;
  }
  t.diagnostic(first + ' / ' + second + ': ' + (100 * changed / occupied).toFixed(1) + '% changed figure pixels');
  assert.ok(changed / occupied > .03, first + ' and ' + second + ' must visibly differ');
}

async function capture(page, name) {
  if (!output) return;
  // Capture directly from the compositor. Element screenshots can wait for
  // scroll/layout and miss the 95ms midpoint during screenshot-enabled QA.
  const clip = await page.$eval(robot, el => {
    const box = el.getBoundingClientRect();
    return {x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height, scale: 1};
  });
  const cdp = await page.createCDPSession();
  try {
    const {data} = await cdp.send('Page.captureScreenshot', {format: 'png', clip});
    await writeFile(path.join(output, name + '.png'), Buffer.from(data, 'base64'));
  } finally { await cdp.detach(); }
}

async function breathing(page) {
  return page.$eval(image, img => new Promise(resolve => {
    const started = performance.now(), tops = [], bottoms = [], inhale = [];
    const button = img.closest('[data-mascot-button]');
    function sample() {
      const rect = img.getBoundingClientRect();
      tops.push(rect.top);
      bottoms.push(rect.bottom);
      const layer = getComputedStyle(button, '::after');
      const visible = layer.content !== 'none' && layer.visibility === 'visible' && layer.display !== 'none';
      inhale.push(visible && layer.backgroundImage.includes('idle-inhale.webp') ? Number(layer.opacity) : 0);
      if (performance.now() - started < 2400) return requestAnimationFrame(sample);
      const range = values => Math.max(...values) - Math.min(...values);
      const loaded = performance.getEntriesByType('resource').some(entry =>
        new URL(entry.name).pathname.endsWith('/idle-inhale.webp') && entry.decodedBodySize > 0);
      resolve({top: range(tops), bottom: range(bottoms), inhale: range(inhale), inhaleLoaded: loaded});
    }
    requestAnimationFrame(sample);
  }));
}

test('cold arrival displays the decoded wave, then breathes with grounded feet', async t => {
  const {page, releaseWave} = await pageFor(t, {gateWave: true});
  await visiblePose(page, 'idle');
  await delay(2200);
  assert.equal(await page.$eval('[data-mascot-play]', root => root.dataset.state), 'idle');
  releaseWave();
  const poses = new Map();
  for (const pose of ['wave-up', 'wave1', 'wave-mid', 'wave2', 'wave-down', 'idle']) {
    poses.set(pose, await visiblePose(page, pose));
    await capture(page, pose);
  }
  distinctFrames(t, poses, 'wave1', 'wave2');
  const movement = await breathing(page);
  t.diagnostic('Idle sample (bounds in CSS px): ' + JSON.stringify(movement));
  assert.ok(movement.inhaleLoaded && movement.inhale > .45, 'the rendered inhale loads and blends into idle');
  assert.ok(movement.top > 1, 'breathing moves the top of the figure');
  assert.ok(movement.bottom < movement.top / 3, 'the bottom stays anchored');
});

test('tap, horizontal head rub and biscuit drag show independent reaction sequences on touch', async t => {
  const {page, releaseWave} = await pageFor(t, {mobile: true, gateWave: true});
  await page.$eval(robot, button => button.scrollIntoView({block: 'center', behavior: 'instant'}));
  const box = await (await page.$(robot)).boundingBox();
  const x = Math.round(box.x + box.width * .5), y = Math.round(box.y + box.height * .33);
  await page.touchscreen.tap(x, y);
  releaseWave();
  const poses = new Map();
  for (const pose of ['poke', 'poke-recover', 'idle']) {
    poses.set(pose, await visiblePose(page, pose));
    if (pose !== 'idle') await capture(page, pose);
  }
  await page.touchscreen.touchStart(x - 35, y);
  for (const dx of [0, 35, 0, -35]) await page.touchscreen.touchMove(x + dx, y);
  await page.touchscreen.touchEnd();
  for (const pose of ['pet', 'pet-nuzzle', 'idle']) {
    poses.set(pose, await visiblePose(page, pose));
    if (pose !== 'idle') await capture(page, pose);
  }
  const biscuit = await (await page.$(snack)).boundingBox();
  const sx = Math.round(biscuit.x + biscuit.width / 2), sy = Math.round(biscuit.y + biscuit.height / 2);
  await page.touchscreen.touchStart(sx, sy);
  await page.touchscreen.touchMove(Math.round((sx + x) / 2), Math.round((sy + y) / 2));
  await page.touchscreen.touchMove(x, y);
  assert.equal(await page.$eval('[data-mascot-play]', root => root.dataset.dropTarget), 'true');
  await page.touchscreen.touchEnd();
  for (const pose of ['look', 'reach', 'eat1', 'eat2', 'happy', 'idle']) {
    poses.set(pose, await visiblePose(page, pose));
    if (pose !== 'idle') await capture(page, pose);
  }
  for (const [first, second] of [['poke', 'poke-recover'], ['pet', 'pet-nuzzle'], ['look', 'reach'], ['eat1', 'eat2']]) {
    distinctFrames(t, poses, first, second);
  }
  assert.equal(await page.$eval('[data-mascot-play]', root => root.hasAttribute('data-dragging')), false);
});

test('reduced motion keeps the idle mascot still and the poke control usable', async t => {
  const {page} = await pageFor(t, {reduced: true});
  await visiblePose(page, 'idle');
  const movement = await breathing(page);
  t.diagnostic('Reduced idle sample (bounds in CSS px): ' + JSON.stringify(movement));
  assert.equal(movement.top, 0);
  assert.equal(movement.bottom, 0);
  assert.equal(movement.inhale, 0);
  await page.click(robot);
  await visiblePose(page, 'poke');
  assert.equal(await page.$eval(image, img => img.getAnimations().length), 0);
  await visiblePose(page, 'idle');
});
