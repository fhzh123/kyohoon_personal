import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdir, mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../server/app.mjs';
import { previewAllowed, safeRelativePath } from '../server/policy.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const fixtureParent = path.join(project, 'artifacts', 'security-fixture');
const marker = 'SYNTHETIC_PRIVATE_RESEARCH_MARKER';
const baseEnvironment = { NODE_ENV: 'development', LOCAL_WORK_PREVIEW: '1' };
const state = (title = marker) => ({ goals: [], phases: [], tasks: [{ id: 'synthetic-task', title }], notes: [], references: [] });

async function fixture() {
  await mkdir(fixtureParent, { recursive: true });
  const rootDir = await mkdtemp(path.join(fixtureParent, 'case-'));
  await mkdir(path.join(rootDir, 'private/work/assets'), { recursive: true });
  await mkdir(path.join(rootDir, 'work-app'), { recursive: true });
  await mkdir(path.join(rootDir, 'public'), { recursive: true });
  await writeFile(path.join(rootDir, 'private/work/workspace-state.json'), JSON.stringify({ revision: 'fixture-r1', state: state(), updatedAt: '2026-01-01T00:00:00Z' }));
  await writeFile(path.join(rootDir, 'private/work/taxonomy-source.json'), JSON.stringify({ fixture: marker }));
  await writeFile(path.join(rootDir, 'private/work/legacy-seed.json'), JSON.stringify({ fixture: marker }));
  await writeFile(path.join(rootDir, 'private/work/assets/fixture.png'), Buffer.from(marker));
  await writeFile(path.join(rootDir, 'work-app/index.html'), '<!doctype html><title>Synthetic fixture</title>');
  await writeFile(path.join(rootDir, 'work-app/taxonomy.js'), '// guarded synthetic fixture');
  return rootDir;
}

async function request(handler, url, { method = 'GET', headers = {}, address = '127.0.0.1', body } = {}) {
  const req = Readable.from(body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]);
  req.url = url;
  req.method = method;
  req.headers = { host: 'localhost:3000', ...headers };
  req.socket = { remoteAddress: address };
  const response = { status: 0, headers: {}, text: '', setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, writeHead(status, values) { this.status = status; for (const [name, value] of Object.entries(values)) this.setHeader(name, value); }, end(value) { this.text = value == null ? '' : Buffer.isBuffer(value) ? value.toString('utf8') : String(value); } };
  await handler(req, response);
  return response;
}

async function localContext() {
  const rootDir = await fixture();
  const handler = createHandler({ rootDir, localPreview: true, environment: baseEnvironment });
  const preview = await request(handler, '/work/preview');
  assert.equal(preview.status, 303);
  const setCookie = preview.headers['set-cookie'];
  assert.equal(typeof setCookie, 'string');
  assert.match(setCookie, /; HttpOnly;/);
  assert.match(setCookie, /; SameSite=Strict;/);
  return { rootDir, handler, cookie: setCookie.split(';')[0] };
}

function noPrivateContent(response) {
  assert.ok(!response.text.includes(marker), 'private synthetic marker must not be disclosed');
  assert.match(response.headers['cache-control'], /no-store/);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
}

test('public homepage exposes only the three public navigation targets', async () => {
  const handler = createHandler({ rootDir: await fixture(), environment: baseEnvironment });
  const response = await request(handler, '/');
  assert.equal(response.status, 200);
  assert.match(response.text, /href="\/resume"/);
  assert.match(response.text, /href="\/work"/);
  noPrivateContent(response);
});

test('authorized HTML contains one escaped bootstrap record, no tokens and no extra bootstrap read', async () => {
  const rootDir=await fixture(),calls=[];
  await writeFile(path.join(rootDir,'work-app/index.html'),'<!doctype html><!--WORK_INITIAL_DATA--><script src="workspace.bundle.js" defer></script>');
  const malicious='</script><script>alert("fixture")</script>';
  const fetcher=async url=>{
    calls.push(url);
    if(url.endsWith('/auth/v1/user'))return jsonResponse({id:'fixture-editor'});
    if(url.includes('/workspace_members?'))return jsonResponse([{user_id:'fixture-editor',role:'editor'}]);
    if(url.includes('/workspaces?'))return jsonResponse([{state:state(malicious),revision:4,taxonomy_source:{},legacy_seed:{}}]);
    throw Error('unexpected upstream request');
  };
  const handler=createHandler({rootDir,environment:remoteEnvironment,fetcher});
  const result=await request(handler,'/work/app/index.html',{headers:{cookie:'kh_access=synthetic-secret-token'}});
  assert.equal(result.status,200);assert.equal(calls.length,3);assert.ok(!result.text.includes(malicious));assert.ok(!result.text.includes('synthetic-secret-token'));
  const json=result.text.match(/<script id="work-initial-data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.equal(JSON.parse(json).workspace.state.tasks[0].title,malicious);
  assert.match(result.headers['cache-control'],/no-store/);assert.match(result.headers['server-timing'],/auth;dur=.*data;dur=/);
  const denied=await request(handler,'/work/app/workspace.bundle.js');assert.equal(denied.status,401);
});

test('unauthenticated API, application code and attachments are all guarded before reading', async () => {
  const handler = createHandler({ rootDir: await fixture(), environment: baseEnvironment, fetcher() { throw new Error('must not contact upstream'); } });
  for (const url of ['/api/research-state', '/api/work-bootstrap', '/work/app/index.html', '/work/app/taxonomy.js', '/work/app/assets/fixture.png']) {
    const response = await request(handler, url);
    assert.equal(response.status, 401, url);
    noPrivateContent(response);
  }
});

test('project private files and source are never served through a static fallback', async () => {
  const { handler, cookie } = await localContext();
  for (const url of ['/private/work/workspace-state.json', '/private/work/taxonomy-source.json', '/server/app.mjs', '/work-app/index.html', '/.env.local', '/docs/work-source.md']) {
    const response = await request(handler, url, { headers: { cookie } });
    assert.equal(response.status, 404, url);
    noPrivateContent(response);
  }
});

test('missing Supabase configuration presents a disabled login and no workspace contents', async () => {
  const handler = createHandler({ rootDir: await fixture(), environment: baseEnvironment });
  const response = await request(handler, '/work');
  assert.equal(response.status, 200);
  assert.match(response.text, /Supabase 연결 전/);
  assert.match(response.text, /공개 회원가입은 제공하지 않습니다/);
  assert.match(response.text, /type="password"[^>]*disabled/);
  assert.ok(!response.text.includes('/work/preview'));
  noPrivateContent(response);
  const login = await request(handler, '/api/auth/login', { method: 'POST', body: { email: 'fixture@example.invalid', password: 'synthetic-only' }, headers: { 'content-type': 'application/json' } });
  assert.equal(login.status, 503);
  noPrivateContent(login);
});

test('production/default handler cannot enable preview through environment flags or localhost headers', async () => {
  const rootDir = await fixture();
  const configurations = [
    { localPreview: false, environment: { ...baseEnvironment } },
    { localPreview: true, environment: { ...baseEnvironment, NODE_ENV: 'production' } },
    { localPreview: true, environment: { ...baseEnvironment, VERCEL: '1' } },
    { localPreview: true, environment: { ...baseEnvironment, LOCAL_WORK_PREVIEW: '0' } },
  ];
  for (const configuration of configurations) {
    const response = await request(createHandler({ rootDir, ...configuration }), '/work/preview');
    assert.equal(response.status, 404);
    assert.equal(response.headers['set-cookie'], undefined);
    noPrivateContent(response);
  }
});

test('local preview requires both exact loopback host and actual loopback peer address', async () => {
  const handler = createHandler({ rootDir: await fixture(), localPreview: true, environment: baseEnvironment });
  for (const options of [
    { headers: { host: 'example.com' } },
    { headers: { host: 'localhost.evil.example' } },
    { headers: { host: '127.0.0.1.evil.example' } },
    { address: '192.0.2.1' },
    { address: '10.0.0.5', headers: { 'x-forwarded-for': '127.0.0.1', 'x-forwarded-host': 'localhost:3000' } },
  ]) {
    const response = await request(handler, '/work/preview', options);
    assert.equal(response.status, 404);
    assert.equal(response.headers['set-cookie'], undefined);
  }
});

test('successful local preview issues a private session and returns only the isolated fixture state', async () => {
  const { handler, cookie } = await localContext();
  const bootstrap = await request(handler, '/api/work-bootstrap', { headers: { cookie } });
  assert.equal(bootstrap.status, 200);
  const payload = JSON.parse(bootstrap.text);
  assert.equal(payload.context.mode, 'local');
  assert.equal(payload.context.role, 'editor');
  assert.equal(payload.workspace.revision, 'fixture-r1');
  assert.equal(payload.workspace.state.tasks[0].title, marker);
  assert.equal(payload.taxonomySource.fixture, marker);
  assert.match(bootstrap.headers['cache-control'], /no-store/);
  const app = await request(handler, '/work/app/index.html', { headers: { cookie } });
  assert.equal(app.status, 200);
});

test('forged, external-host and other-instance local cookies cannot authorize data access', async () => {
  const { handler, cookie } = await localContext();
  for (const options of [
    { headers: { cookie: 'kh_local=forged' } },
    { headers: { cookie, host: 'example.com' } },
    { headers: { cookie }, address: '192.0.2.7' },
  ]) {
    const response = await request(handler, '/api/research-state', options);
    assert.equal(response.status, 401);
    noPrivateContent(response);
  }
  const freshHandler = createHandler({ rootDir: await fixture(), localPreview: true, environment: baseEnvironment });
  assert.equal((await request(freshHandler, '/api/research-state', { headers: { cookie } })).status, 401);
});

test('cross-site writes are rejected without changing the local state', async () => {
  const { rootDir, handler, cookie } = await localContext();
  for (const headers of [{ origin: 'https://attacker.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const response = await request(handler, '/api/research-state', { method: 'PUT', headers: { cookie, ...headers }, body: { revision: 'fixture-r1', state: state('forbidden-change') } });
    assert.equal(response.status, 403);
    noPrivateContent(response);
  }
  const stored = JSON.parse(await readFile(path.join(rootDir, 'private/work/workspace-state.json'), 'utf8'));
  assert.equal(stored.state.tasks[0].title, marker);
});

test('local writes use optimistic revisions, retain backups, and reject stale overwrites', async () => {
  const { rootDir, handler, cookie } = await localContext();
  const first = await request(handler, '/api/research-state', { method: 'PUT', headers: { cookie, origin: 'http://localhost:3000' }, body: { revision: 'fixture-r1', state: state('accepted-change') } });
  assert.equal(first.status, 200);
  const saved = JSON.parse(first.text);
  assert.notEqual(saved.revision, 'fixture-r1');
  const stale = await request(handler, '/api/research-state', { method: 'PUT', headers: { cookie }, body: { revision: 'fixture-r1', state: state('stale-change') } });
  assert.equal(stale.status, 409);
  assert.equal(JSON.parse(stale.text).state.tasks[0].title, 'accepted-change');
  const stored = JSON.parse(await readFile(path.join(rootDir, 'private/work/workspace-state.json'), 'utf8'));
  assert.equal(stored.state.tasks[0].title, 'accepted-change');
  const backups = await readdir(path.join(rootDir, 'private/work/backups'));
  assert.equal(backups.length, 1);
  assert.equal(JSON.parse(await readFile(path.join(rootDir, 'private/work/backups', backups[0]), 'utf8')).revision, 'fixture-r1');
});

test('simultaneous local writes serialize revision checks so only one same-revision write wins', async () => {
  const { rootDir, handler, cookie } = await localContext();
  const responses = await Promise.all(['parallel-a', 'parallel-b'].map(title => request(handler, '/api/research-state', { method: 'PUT', headers: { cookie }, body: { revision: 'fixture-r1', state: state(title) } })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const winning = JSON.parse(responses.find(r => r.status === 200).text);
  const stored = JSON.parse(await readFile(path.join(rootDir, 'private/work/workspace-state.json'), 'utf8'));
  assert.deepEqual(stored, winning);
});

test('invalid state shape and oversized requests cannot overwrite local data', async () => {
  const { handler, cookie } = await localContext();
  const invalid = await request(handler, '/api/research-state', { method: 'PUT', headers: { cookie }, body: { revision: 'fixture-r1', state: { tasks: [] } } });
  assert.equal(invalid.status, 400);
  const oversized = await request(handler, '/api/research-state', { method: 'PUT', headers: { cookie }, body: 'x'.repeat(5 * 1024 * 1024 + 1) });
  assert.equal(oversized.status, 413);
  assert.equal(JSON.parse((await request(handler, '/api/research-state', { headers: { cookie } })).text).revision, 'fixture-r1');
});

test('encoded traversal and hidden paths cannot read outside allowlisted file roots', async () => {
  const { handler, cookie } = await localContext();
  for (const url of ['/work/app/%2e%2e%2fprivate/work/workspace-state.json', '/work/app/assets/%2e%2e%2fworkspace-state.json', '/%2e%2e%5cprivate/work/workspace-state.json', '/%00', '/%zz', '/.env.local']) {
    const response = await request(handler, url, { headers: { cookie } });
    assert.equal(response.status, 404, url);
    noPrivateContent(response);
  }
  assert.equal(safeRelativePath('assets/../secret'), null);
  assert.equal(safeRelativePath('%2e%2e%2fsecret'), null);
});

const remoteEnvironment = { NODE_ENV: 'production', SUPABASE_URL: 'https://synthetic.supabase.invalid', SUPABASE_ANON_KEY: 'synthetic-public-key' };
const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('valid identity without an active allowed membership cannot access or log into Work', async () => {
  const calls = [];
  const fetcher = async url => {
    calls.push(url);
    if (url.includes('/auth/v1/token?grant_type=password')) return jsonResponse({ access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', user: { id: 'fixture-user' } });
    if (url.endsWith('/auth/v1/user')) return jsonResponse({ id: 'fixture-user' });
    if (url.includes('/workspace_members?')) return jsonResponse([]);
    throw new Error('workspace data must not be queried');
  };
  const handler = createHandler({ rootDir: await fixture(), environment: remoteEnvironment, fetcher });
  const access = await request(handler, '/api/research-state', { headers: { cookie: 'kh_access=synthetic-token' } });
  assert.equal(access.status, 401);
  noPrivateContent(access);
  const login = await request(handler, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: { email: 'fixture@example.invalid', password: 'synthetic-only' } });
  assert.equal(login.status, 403);
  assert.equal(login.headers['set-cookie'], undefined);
  assert.ok(!calls.some(url => url.includes('/workspaces?')));
});

test('reader membership can read a protected remote record but cannot mutate it', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, method: options.method || 'GET' });
    if (url.endsWith('/auth/v1/user')) return jsonResponse({ id: 'fixture-reader' });
    if (url.includes('/workspace_members?')) return jsonResponse([{ user_id: 'fixture-reader', role: 'reader' }]);
    if (url.includes('/workspaces?')) return jsonResponse([{ state: state('remote-fixture'), revision: 4, updated_at: '2026-01-01', taxonomy_source: {}, legacy_seed: {} }]);
    throw new Error('unexpected request');
  };
  const handler = createHandler({ rootDir: await fixture(), environment: remoteEnvironment, fetcher });
  const headers = { cookie: 'kh_access=synthetic-reader-token' };
  const read = await request(handler, '/api/research-state', { headers });
  assert.equal(read.status, 200);
  assert.equal(JSON.parse(read.text).revision, '4');
  const write = await request(handler, '/api/research-state', { method: 'PUT', headers, body: { revision: '4', state: state('forbidden') } });
  assert.equal(write.status, 403);
  assert.ok(!calls.some(call => call.method === 'PATCH'));
});

test('allowed remote login uses HttpOnly Secure SameSite cookies and never returns tokens in HTML', async () => {
  const accessToken = 'synthetic-access-should-not-appear-in-body';
  const refreshToken = 'synthetic-refresh-should-not-appear-in-body';
  const fetcher = async url => {
    if (url.includes('/auth/v1/token?grant_type=password')) return jsonResponse({ access_token: accessToken, refresh_token: refreshToken, user: { id: 'fixture-editor' } });
    if (url.includes('/workspace_members?')) return jsonResponse([{ user_id: 'fixture-editor', role: 'editor' }]);
    throw new Error('unexpected request');
  };
  const handler = createHandler({ rootDir: await fixture(), environment: remoteEnvironment, fetcher });
  const response = await request(handler, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: { email: 'fixture@example.invalid', password: 'synthetic-only' } });
  assert.equal(response.status, 303);
  assert.equal(response.headers.location, '/work');
  assert.equal(response.headers['set-cookie'].length, 2);
  for (const cookie of response.headers['set-cookie']) {
    assert.match(cookie, /; HttpOnly;/);
    assert.match(cookie, /; SameSite=Strict;/);
    assert.match(cookie, /; Secure$/);
  }
  assert.ok(!response.text.includes(accessToken));
  assert.ok(!response.text.includes(refreshToken));
});

test('expired remote access refreshes and revalidates identity before serving workspace data', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, authorization: options.headers.Authorization });
    if (url.endsWith('/auth/v1/user')) return options.headers.Authorization === 'Bearer synthetic-expired' ? jsonResponse({}, 401) : jsonResponse({ id: 'fixture-refreshed-user' });
    if (url.includes('/auth/v1/token?grant_type=refresh_token')) return jsonResponse({ access_token: 'synthetic-refreshed', refresh_token: 'synthetic-rotated-refresh' });
    if (url.includes('/workspace_members?')) return jsonResponse([{ user_id: 'fixture-refreshed-user', role: 'reader' }]);
    if (url.includes('/workspaces?')) return jsonResponse([{ state: state('refreshed-fixture'), revision: 5, updated_at: '2026-01-01' }]);
    throw new Error('unexpected request');
  };
  const handler = createHandler({ rootDir: await fixture(), environment: remoteEnvironment, fetcher });
  const response = await request(handler, '/api/research-state', { headers: { cookie: 'kh_access=synthetic-expired; kh_refresh=synthetic-refresh' } });
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.text).revision, '5');
  assert.equal(calls.filter(call => call.url.endsWith('/auth/v1/user')).length, 2);
  assert.equal(calls.find(call => call.url.includes('/workspaces?')).authorization, 'Bearer synthetic-refreshed');
  assert.equal(response.headers['set-cookie'].length, 2);
});

test('remote identity/member mismatch and upstream failures fail closed', async () => {
  const mismatch = createHandler({ rootDir: await fixture(), environment: remoteEnvironment, fetcher: async url => url.endsWith('/auth/v1/user') ? jsonResponse({ id: 'actual-fixture-user' }) : jsonResponse([{ user_id: 'different-fixture-user', role: 'editor' }]) });
  const denied = await request(mismatch, '/api/work-bootstrap', { headers: { cookie: 'kh_access=synthetic-token' } });
  assert.equal(denied.status, 401);
  noPrivateContent(denied);
  const failing = createHandler({ rootDir: await fixture(), environment: remoteEnvironment, fetcher: async () => { throw new Error('synthetic upstream failure'); } });
  const failure = await request(failing, '/api/work-bootstrap', { headers: { cookie: 'kh_access=synthetic-token' } });
  assert.equal(failure.status, 503);
  noPrivateContent(failure);
});

test('preview policy requires every independent environment and network condition', () => {
  const allowed = { enabled: true, development: true, vercel: false, host: '[::1]:3000', address: '::1' };
  assert.equal(previewAllowed(allowed), true);
  for (const disabled of [{ enabled: false }, { development: false }, { vercel: true }, { host: 'evil.example' }, { address: '192.0.2.10' }]) assert.equal(previewAllowed({ ...allowed, ...disabled }), false);
});

test('Personal and demo picker enforce existing allowed membership, with allowlisted login destinations',async()=>{
 let allowed=true;
 const fetcher=async url=>{
  if(url.includes('/auth/v1/token?grant_type=password'))return jsonResponse({access_token:'synthetic-private',refresh_token:'synthetic-refresh',user:{id:'space-user'}});
  if(url.endsWith('/auth/v1/user'))return jsonResponse({id:'space-user'});
  if(url.includes('/workspace_members?'))return jsonResponse(allowed?[{user_id:'space-user',role:'reader'}]:[]);
  throw Error('New spaces must not fetch research data');
 };
 const handler=createHandler({rootDir:await fixture(),environment:remoteEnvironment,fetcher});
 const anonymous=await request(handler,'/personal');assert.match(anonymous.text,/Personal 로그인/);assert.ok(!anonymous.text.includes('personal-build.webp'));
 assert.equal((await request(handler,'/work/demos')).status,303);
 const headers={cookie:'kh_access=synthetic-private'};
 const personal=await request(handler,'/personal',{headers});assert.match(personal.text,/personal-build.webp/);assert.match(personal.headers['cache-control'],/no-store/);
 assert.match((await request(handler,'/work/demos',{headers})).text,/Document Parsing/);
 for(const [space,destination]of [['personal','/personal'],['selectstar','/work'],['https://outside.invalid','/work']]){
  const r=await request(handler,'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:{space,email:'fixture@example.invalid',password:'synthetic'}});assert.equal(r.headers.location,destination);
 }
 allowed=false;assert.match((await request(handler,'/personal',{headers})).text,/Personal 로그인/);
});
