import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../server/app.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
let server;
let origin;
before(async () => {
  server = http.createServer(createHandler({ rootDir: project, localPreview: false, environment: { NODE_ENV: 'production' } }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

async function get(path) {
  const response = await fetch(origin + path, { redirect: 'manual' });
  return { response, text: await response.text() };
}

test('public direct routes return independent HTML documents', async () => {
  for (const route of ['/', '/resume', '/resume/', '/work', '/work/']) {
    const { response, text } = await get(route);
    assert.equal(response.status, 200, `${route} responds`);
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assert.match(text, /<!doctype html>/i);
    assert.match(text, /name="viewport"/);
  }
});

test('home has two keyboard-native whole-card links with image above title and text', async () => {
  const { text } = await get('/');
  const portals = [...text.matchAll(/<a\s+class="portal[^\"]*"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.equal(portals.length, 2);
  assert.match(portals[0][0], /href="\/resume"/);
  assert.match(portals[1][0], /href="\/work"/);
  for (const [index, portal] of portals.entries()) {
    assert.ok(portal[1].indexOf('<img') < portal[1].indexOf('<h2'));
    assert.match(portal[1], /<img[^>]+alt="[^"]+"[^>]+width="\d+"[^>]+height="\d+"/);
    assert.match(portal[1], /<p>[^<]+<\/p>/);
    const label = index === 0 ? 'resume-label' : 'work-label';
    assert.ok(portal[0].includes(`aria-labelledby="${label}"`) && portal[1].includes(`id="${label}"`));
  }
  assert.match(text, /<html lang="ko" data-theme="dark">/);
  assert.match(text, /<main id="main">/);
  assert.match(text, /<script src="\/theme\.js\?v=20261112"><\/script>/, 'small appearance script is shared by public and protected pages');
});

test('all local home and login images/styles/font references resolve over actual HTTP', async () => {
  const html = (await get('/')).text + (await get('/work')).text;
  const sources = new Set([...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1]).filter(p => /\.(?:png|css)$/.test(p)));
  sources.add('/fonts/WantedSans-Medium.ttf');
  for (const source of sources) {
    const response = await fetch(origin + source);
    assert.equal(response.status, 200, `${source} resolves`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.ok(bytes.length > 100, `${source} is not an empty asset`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    if (source.endsWith('.png')) {
      assert.equal(response.headers.get('content-type'), 'image/png');
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(bytes.readUInt32BE(16), bytes.readUInt32BE(20), `${source} has square intrinsic aspect ratio`);
      assert.equal(bytes[25], 6, `${source} retains RGBA channel format`);
    }
    if (source.endsWith('.ttf')) assert.equal(response.headers.get('content-type'), 'font/ttf');
    if (source.endsWith('.css')) assert.match(response.headers.get('content-type'), /^text\/css/);
  }
});

test('Resume document resolves its own assets without main stylesheet or iframe', async () => {
  const { text } = await get('/resume');
  assert.equal(text.includes('/site.css'), false);
  assert.equal(/<iframe\b/i.test(text), false);
  const sources = new Set([...text.matchAll(/(?:src|href)="(\/resume\/[^"#]+)"/g)].map(match => match[1]));
  assert.ok(sources.has('/resume/resume.js'));
  assert.ok(sources.has('/resume/resume.css'));
  for (const source of sources) {
    const response = await fetch(origin + source);
    assert.equal(response.status, 200, `${source} resolves`);
  }
});

test('Work missing-config page has explicit labeled disabled login and home navigation', async () => {
  const { text } = await get('/work');
  assert.match(text, /Supabase 연결 전/);
  assert.match(text, /<label for="email">/);
  assert.match(text, /<input[^>]+id="email"[^>]+type="email"[^>]+autocomplete="username"[^>]+disabled/);
  assert.match(text, /<label for="password">/);
  assert.match(text, /<input[^>]+id="password"[^>]+type="password"[^>]+autocomplete="current-password"[^>]+disabled/);
  assert.match(text, /<button[^>]+type="submit"[^>]+disabled/);
  assert.match(text, /href="\/">← 홈으로/);
  assert.equal(/action="[^\"]*(?:signup|register)/i.test(text), false);
  assert.equal(text.includes('/work/preview'), false, 'production has no preview entry link');
});

test('unauthorized Work resources remain uncached and outside public files', async () => {
  for (const route of ['/api/work-bootstrap', '/api/research-state', '/work/app/index.html', '/work/app/taxonomy.js', '/work/app/assets/roadmap.png']) {
    const { response, text } = await get(route);
    assert.equal(response.status, 401);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(text.includes('"state"'), false);
    assert.equal(text.includes('"taxonomySource"'), false);
  }
  for (const route of ['/private/work/workspace-state.json', '/work-app/index.html', '/server/app.mjs', '/.env.example', '/Assets/02_웹개발_전달용_v9.zip']) {
    const { response } = await get(route);
    assert.equal(response.status, 404);
  }
  // Optional extra check for this working copy. A clean checkout deliberately has no private data.
  let title;
  try {
    const state = JSON.parse(await readFile(new URL('../private/work/workspace-state.json', import.meta.url), 'utf8'));
    title = state.state.tasks.find(task => typeof task.title === 'string' && task.title.length > 8)?.title;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (title) {
    for (const route of ['/', '/work', '/site.css', '/resume']) {
      const { text } = await get(route);
      assert.ok(!text.includes(title), 'private research sentinel is absent from public response');
    }
  }
});
