// DOM simulation only: jsdom does not render layout, paint images, or test a real browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const project = fileURLToPath(new URL('../', import.meta.url));
const resumeDirectory = path.join(project, 'public', 'resume');
const html = await fs.readFile(path.join(resumeDirectory, 'index.html'), 'utf8');
const bundle = await fs.readFile(path.join(resumeDirectory, 'resume.js'), 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await pause(5);
  }
  assert.ok(predicate(), message);
}

async function mount(t, width = 1280) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', error => errors.push(String(error)));
  // No `resources: usable`: linked scripts/styles/images cannot fetch the network.
  const dom = new JSDOM(html, {
    url: 'http://localhost:3000/resume',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      window.matchMedia = query => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      window.addEventListener('error', event => { errors.push(event.message); event.preventDefault(); });
    },
  });
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, [], 'No synchronous/React/jsdom runtime errors');
  });
  try { dom.window.eval(bundle); } catch (error) { assert.fail(`Resume bundle failed to mount: ${error.message}`); }
  await waitFor(() => dom.window.document.body.textContent.includes('Kyohoon Jin | 진교훈'), 'Original Resume mounts');
  await pause(10); // Allow React mount effects to populate responsive background.
  return dom.window;
}

function exact(document, selector, text) {
  const element = [...document.querySelectorAll(selector)].find(node => node.textContent.trim() === text);
  assert.ok(element, `Rendered control exists: ${text}`);
  return element;
}

async function selectTab(window, text) {
  const tab = exact(window.document, 'span.cursor-pointer', text);
  tab.click();
  await waitFor(() => tab.classList.contains('text-blue-300'), `Tab becomes active: ${text}`);
  await pause(5);
}

test('Resume original source copies retain all 36 recorded SHA-256 values', async () => {
  const legacy = path.join(project, 'legacy', 'resume');
  const manifest = JSON.parse(await fs.readFile(path.join(legacy, 'source-manifest.json'), 'utf8'));
  assert.equal(Object.keys(manifest.files).length, 36);
  for (const [relative, expected] of Object.entries(manifest.files)) {
    const actual = createHash('sha256').update(await fs.readFile(path.join(legacy, relative))).digest('hex');
    assert.equal(actual, expected, relative);
  }
});

test('Resume document uses only its own stylesheet, script, icons and local font', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost:3000/resume' });
  const document = dom.window.document;
  assert.deepEqual([...document.querySelectorAll('link[rel=stylesheet]')].map(node => node.getAttribute('href')), ['/resume/resume.css']);
  assert.deepEqual([...document.querySelectorAll('script[src]')].map(node => node.getAttribute('src')), ['/resume/resume.js']);
  assert.equal(document.querySelector('link[rel=icon]').getAttribute('href'), '/resume/smile_emoji2.ico');
  assert.equal(document.querySelectorAll('iframe').length, 0);
  assert.ok(!html.includes('/main.css') && !html.includes('/work.css') && !html.includes('_next'));
  for (const node of document.querySelectorAll('script[src],link[href]')) {
    const relative = (node.getAttribute('src') || node.getAttribute('href')).replace('/resume/', '');
    await fs.access(path.join(resumeDirectory, relative));
  }
  const css = await fs.readFile(path.join(resumeDirectory, 'resume.css'), 'utf8');
  assert.match(css, /WantedSans-Medium/);
  assert.match(css, /url\(["']?\.\/fonts\/WantedSans-Medium\.ttf["']?\)/);
  await fs.access(path.join(resumeDirectory, 'fonts', 'WantedSans-Medium.ttf'));
  dom.window.close();
});

test('Resume mounts original identity, intro, six navigation tabs and profile assets', async t => {
  const window = await mount(t);
  const { document } = window;
  assert.match(document.body.textContent, /저는 셀렉트스타에서 AI Research Engineer로 근무/);
  for (const label of ['Experience', 'Education', 'Projects', 'Publications', 'Lecture & Honors', 'Patent']) exact(document, 'span.cursor-pointer', label);
  assert.ok(exact(document, 'span.cursor-pointer', 'Experience').classList.contains('text-blue-300'));
  assert.match(document.querySelector('img[alt="Profile Front"]').getAttribute('src'), /^https:\/\/raw\.githubusercontent\.com\//);
  assert.match(document.querySelector('img[alt="Profile Back"]').getAttribute('src'), /^https:\/\/github\.com\//);
  for (const image of document.querySelectorAll('img')) assert.match(image.getAttribute('src'), /^https:\/\//);
});

test('Resume tab navigation and publication/lecture sub-tabs update actual content', async t => {
  const window = await mount(t);
  const { document } = window;
  await selectTab(window, 'Education');
  assert.match(document.body.textContent, /Ph\.D - 중앙대학교/);
  assert.equal([...document.querySelectorAll('a')].filter(node => node.href.includes('Transcript/')).length, 3);
  await selectTab(window, 'Projects');
  assert.match(document.body.textContent, /DATUMO 플랫폼 내 모니터링 대시보드 개발/);
  assert.ok([...document.querySelectorAll('button')].filter(node => node.textContent.trim() === '자세히 보기').length > 5);
  await selectTab(window, 'Publications');
  const international = [...document.querySelectorAll('button')].find(node => node.textContent.includes('International Paper'));
  assert.ok(international);
  assert.ok(international.classList.contains('bg-blue-600'));
  const internationalText = document.body.textContent;
  const domestic = [...document.querySelectorAll('button')].find(node => node.textContent.includes('Domestic Paper'));
  assert.ok(domestic);
  domestic.click();
  await waitFor(() => document.body.textContent !== internationalText, 'Domestic publication content appears');
  assert.ok(domestic.classList.contains('bg-blue-600'));
  assert.ok([...document.querySelectorAll('a[target=_blank]')].some(node => node.textContent.trim() === '자세히 보기'));
  await selectTab(window, 'Lecture & Honors');
  assert.match(document.body.textContent, /장소:/);
  const honors = [...document.querySelectorAll('button')].find(node => node.textContent.includes('Honors'));
  assert.ok(honors);
  honors.click();
  await waitFor(() => document.body.textContent.includes('우수 논문상'), 'Honors content appears');
  await selectTab(window, 'Patent');
  assert.match(document.body.textContent, /출원번호:/);
  assert.match(document.body.textContent, /등록번호:/);
  await selectTab(window, 'Experience');
  assert.ok(!document.body.textContent.includes('출원번호:'));
});

test('Resume desktop and mobile language controls preserve Korean/English behavior', async t => {
  const window = await mount(t);
  const { document } = window;
  document.getElementById('en-lang-desktop').click();
  await waitFor(() => document.body.textContent.includes('I am Kyohoon Jin, an AI Research Engineer at Selectstar.'), 'English intro appears');
  assert.ok(document.getElementById('en-lang-desktop').checked);
  document.querySelector('button[title="Toggle Language"]').click();
  await waitFor(() => document.body.textContent.includes('저는 셀렉트스타에서 AI Research Engineer로 근무'), 'Mobile toggle restores Korean');
  assert.ok(document.getElementById('ko-lang-desktop').checked);
});

test('Resume selects original desktop/mobile backgrounds on resize (no layout rendering)', async t => {
  const window = await mount(t);
  const outer = window.document.getElementById('root').firstElementChild;
  assert.match(outer.style.backgroundImage, /background_test\.png/);
  window.innerWidth = 390;
  window.dispatchEvent(new window.Event('resize'));
  await waitFor(() => outer.style.backgroundImage.includes('background_test_mobile.png'), 'Mobile background is selected');
  window.innerWidth = 1280;
  window.dispatchEvent(new window.Event('resize'));
  await waitFor(() => outer.style.backgroundImage.includes('background_test.png'), 'Desktop background is restored');
});

test('Resume project detail modal opens, handles image error, and closes by button/backdrop', async t => {
  const window = await mount(t);
  const { document } = window;
  await selectTab(window, 'Projects');
  const open = () => exact(document, 'button', '자세히 보기').click();
  open();
  await waitFor(() => document.querySelector('h2')?.textContent.includes('DATUMO'), 'Project detail heading appears');
  assert.match(document.body.textContent, /정형데이터 연결 및 내제지식화 기술 개발/);
  assert.ok(document.querySelector('h2').closest('div').querySelector('a[href="https://wowtale.net/2025/10/30/249506/"]'));
  const image = [...document.querySelectorAll('img')].find(node => node.alt === 'DATUMO 플랫폼 내 모니터링 대시보드 개발');
  assert.ok(image);
  image.dispatchEvent(new window.Event('error'));
  await waitFor(() => image.classList.contains('block'), 'Original image-error handler removes loading state');
  exact(document, 'button', '×').click();
  await waitFor(() => !document.querySelector('h2'), 'Close button closes project detail');
  open();
  await waitFor(() => document.querySelector('h2'), 'Project detail can be reopened');
  document.querySelector('h2').parentElement.parentElement.click();
  await waitFor(() => !document.querySelector('h2'), 'Backdrop closes project detail');
});

test('Resume profile flip and KakaoTalk QR modal retain original interactions', async t => {
  const window = await mount(t);
  const { document } = window;
  const profile = document.querySelector('.perspective-1000');
  assert.ok(profile);
  assert.equal(profile.firstElementChild.style.transform, 'rotateY(0deg)');
  profile.click();
  await waitFor(() => profile.firstElementChild.style.transform === 'rotateY(180deg)', 'Profile flips');
  profile.click();
  await waitFor(() => profile.firstElementChild.style.transform === 'rotateY(0deg)', 'Profile flips back');
  const kakao = document.querySelector('a[title=KakaoTalk]');
  assert.ok(kakao);
  kakao.click();
  await waitFor(() => document.querySelector('h2')?.textContent === '카카오톡 QR 코드', 'Kakao QR modal opens');
  assert.match(document.querySelector('img[alt="카카오톡 QR 코드"]').getAttribute('src'), /^https:\/\//);
  exact(document, 'button', '×').click();
  await waitFor(() => !document.querySelector('h2'), 'Kakao QR modal closes');
});
