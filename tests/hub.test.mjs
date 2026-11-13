import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../server/app.mjs';
import { JSDOM } from 'jsdom';

const rootDir = fileURLToPath(new URL('../artifacts/hub-fixture/', import.meta.url));
const demos = [
  'https://selectstar-ai-vertical-research-feasibility.kyohoon-jin.chatgpt.site/',
  'https://selectstar-ai-vertical-research-feasibility-document-parsing.kyohoon-jin.chatgpt.site/',
];
const titles = ['연구일지', '데모', '품의 사용내역'];
const servers = [];
let development;
let production;

async function start(environment, localPreview) {
  const server = http.createServer(createHandler({ rootDir, environment, localPreview }));
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
before(async () => {
  await mkdir(rootDir + '/private/work', { recursive: true });
  await writeFile(rootDir + '/private/work/workspace-state.json', JSON.stringify({ revision: 'hub-fixture', state: { version: 4, goals: [], phases: [], tasks: [], notes: [], references: [] } }));
  development = await start({ NODE_ENV: 'development', LOCAL_WORK_PREVIEW: '1' }, true);
  // Deliberately enable the flag/capability: production environment must still refuse it.
  production = await start({ NODE_ENV: 'production', LOCAL_WORK_PREVIEW: '1' }, true);
});
after(() => Promise.all(servers.map(server => new Promise(resolve => server.close(resolve)))));

async function request(origin, route, headers = {}) {
  const response = await fetch(origin + route, { redirect: 'manual', headers });
  return { response, text: await response.text() };
}
async function localCookie() {
  const { response } = await request(development, '/work/preview');
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/work');
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie?.includes('kh_local='));
  return cookie.split(';')[0];
}

test('unauthenticated Work contains login only and hides Draft tools and demo URLs', async () => {
  for (const origin of [development, production]) {
    const { response, text } = await request(origin, '/login');
    assert.equal(response.status, 200);
    assert.match(text, /id="form-title">로그인/);
    for (const title of titles.slice(1)) assert.ok(!text.includes(title), 'private demo title is hidden');
    assert.ok(!text.includes('<h3>연구일지</h3>'), 'private journal launch slot is hidden');
    for (const demo of demos) assert.ok(!text.includes(demo), 'private demo URL is hidden');
    assert.ok(!text.includes('class="tool-grid"'));
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
});

test('authorized local Work groups demos and provides three illustrated tools', async () => {
  const cookie = await localCookie();
  const { response, text } = await request(development, '/work', { cookie });
  assert.equal(response.status, 200);
  const links = [...text.matchAll(/<a class="tool-card(?: [^"]*)?"[^>]+>/g)].map(match => match[0]);
  const pending = [...text.matchAll(/<button class="tool-card is-pending"[^>]*>/g)].map(match => match[0]);
  assert.equal(links.length, 3);
  assert.equal(pending.length, 0);
  assert.match(links[2], /href="\/work\/expenses\/"/);
  assert.match(links[0], /href="\/work\/app\/index\.html"/);
  assert.match(links[1],/href="\/work\/demos"/);
  const picker=await request(development,'/work/demos',{cookie});
  for(const demo of demos)assert.ok(picker.text.includes(demo));
  assert.equal((picker.text.match(/rel="noopener noreferrer"/g)||[]).length,2);
  for (const title of titles) assert.ok(text.includes(`<h2>${title}</h2>`));
  for (const button of pending) assert.match(button, /\sdisabled(?:\s|>)/);
  assert.equal((text.match(/공사 중/g) || []).length, 0);
  const document = new JSDOM(text).window.document;
  assert.ok([...document.querySelectorAll('a[href="/"]')].some(link => link.textContent.trim() === '홈으로'));
  assert.match(text, /<form action="\/api\/auth\/logout" method="post">/);
  assert.match(text, /localhost 전용/);
  assert.match(text, /이 프로젝트 사본에 저장/);
  assert.match(text, /Supabase와 동기화되지 않습니다/);
});

test('forgot-password contact opens a dialog, with no public signup or prefilled credential', async () => {
  const { text } = await request(production, '/login');
  assert.match(text, /data-contact-open/);
  assert.match(text, /<dialog id="account-help"/);
  assert.match(text, /href="mailto:fhzh@naver\.com"/);
  assert.equal(/action="[^\"]*(?:signup|register)/i.test(text), false);
  assert.equal(/<input[^>]+(?:id="password"[^>]+value=|value=[^>]+id="password")/.test(text), false);
  assert.match(text, /type="password"/);
  assert.equal(text.includes('/work/preview'), false);
});

test('production refuses preview despite local flag and does not show authenticated hub', async () => {
  const { response } = await request(production, '/work/preview');
  assert.equal(response.status, 404);
  const devCookie = await localCookie();
  const result = await request(production, '/work', { cookie: devCookie });
  assert.equal(result.response.status, 303);
  assert.equal(result.response.headers.get('location'), '/login?next=%2Fwork');
  assert.ok(!result.text.includes('class="tool-grid"'));
  for (const demo of demos) assert.ok(!result.text.includes(demo));
});

test('main retains three image-before-text whole-card links after adding Work hub', async () => {
  const { text } = await request(production, '/');
  const cards = [...text.matchAll(/<a class="portal[^\"]*"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(cards.length, 3);
  assert.match(cards[0][0], /href="\/resume"/);
  assert.match(cards[1][0], /href="\/work"/);
  for (const card of cards) assert.ok(card[1].indexOf('<img') < card[1].indexOf('<h2'));
});
