import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../server/app.mjs';

const environment = {NODE_ENV:'production', SUPABASE_URL:'https://project.supabase.co', SUPABASE_ANON_KEY:'fixture'};
const documentId = '11111111-1111-4111-8111-111111111111';
const roles = {
  company:{role:'selectstar_reader'}, reader:{role:'reader'},
  editor:{role:'editor'}, owner:{role:'editor', is_owner:true},
  invalid:{role:'unknown'},
};

function fixture() {
  const dataRequests = [];
  const handler = createHandler({environment, fetcher:async (raw, options) => {
    const url = new URL(raw);
    const token = options.headers.Authorization?.slice(7);
    const membership = roles[token];
    if (url.pathname === '/auth/v1/user') {
      return Response.json({id:token, user_metadata:{role:'editor', is_owner:true}});
    }
    if (url.pathname === '/auth/v1/token') {
      return Response.json({access_token:'company', refresh_token:'company-refresh', user:{id:'company'}});
    }
    if (url.pathname === '/rest/v1/workspace_members') {
      assert.equal(url.searchParams.get('active'), 'eq.true');
      return Response.json(membership ? [{user_id:token, ...membership}] : []);
    }
    dataRequests.push(url.pathname);
    if (url.pathname === '/rest/v1/workspaces') {
      return Response.json([{revision:1, state:{goals:[]}, taxonomy_source:{}, legacy_seed:{}}]);
    }
    if (url.pathname === '/rest/v1/team_resource_snapshots') {
      return Response.json([{payload:{months:['2026-11'], people:['Person'], rows:[]}}]);
    }
    if (url.pathname === '/storage/v1/object/authenticated/work-attachments/research/example.pdf') {
      return new Response('private work PDF');
    }
    if (/^\/rest\/v1\/(markdown_|card_ledger_|travel_)/.test(url.pathname)) return Response.json([]);
    throw Error('Unexpected upstream request to ' + url.pathname);
  }});
  const request = async (url, token, method = 'GET', body) => {
    const headers = {host:'test.invalid'};
    if (token) headers.cookie = 'kh_access=' + token;
    if (body) headers['content-type'] = 'application/json';
    const res = {
      headers:{},
      setHeader(key, value) { this.headers[key] = value; },
      writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); },
      end(value) { this.text = String(value); },
    };
    await handler({url, method, body, headers, socket:{}}, res);
    return res;
  };
  return {request, dataRequests};
}

test('Selectstar company members use the Work pages and private assets in read-only mode', async () => {
  const {request} = fixture();
  for (const path of ['/work', '/work/', '/work/app/index.html', '/work/team-resources/',
    '/work/demos', '/work/expenses', '/work/expenses/', '/work/expenses/index.html']) {
    const response = await request(path, 'company');
    assert.equal(response.status, 200, path);
    assert.doesNotMatch(response.text, /data-global-settings/, path);
  }
  const bootstrap = await request('/api/work-bootstrap', 'company');
  assert.equal(bootstrap.status, 200);
  assert.equal(JSON.parse(bootstrap.text).context.role, 'reader');
  assert.equal((await request('/api/research-state', 'company')).status, 200);
  assert.equal((await request('/api/card-ledger', 'company')).status, 200);
  assert.equal((await request('/work/app/assets/example.pdf', 'company')).text, 'private work PDF');
  for (const [path, method] of [
    ['/api/research-state', 'PUT'], ['/api/card-ledger/inspect', 'POST'],
    ['/api/card-ledger/upload', 'POST'], ['/api/card-ledger/settings', 'PUT'],
  ]) assert.equal((await request(path, 'company', method, {})).status, 403, path);
  for (const path of ['/work-app/index.html', '/work-expenses/index.html', '/private/work/example.pdf']) {
    assert.equal((await request(path, 'company')).status, 404, path);
  }
  assert.equal((await request('/work/app/app.js')).status, 401);
  assert.equal((await request('/work/expenses/app.js')).status, 401);
  assert.equal((await request('/work/app/assets/example.pdf')).status, 401);
});

test('Company sessions preserve public pages and reject private Paper and Settings routes and aliases', async () => {
  const {request, dataRequests} = fixture();
  for (const [path, method] of [
    ['/paper', 'GET'], ['/paper/', 'HEAD'], ['/api/paper/bootstrap', 'GET'],
    ['/api/paper/settings', 'GET'], ['/settings', 'GET'], ['/settings/', 'HEAD'],
    ['/api/settings/llm', 'GET'], ['/api/settings/llm/models', 'GET'], ['/api/settings/travel', 'GET'],
    ['/api/settings/appearance', 'GET'], ['/api/settings/appearance', 'PUT'],
    ['/api/travel/entries', 'POST'],
  ]) assert.equal((await request(path, 'company', method)).status, 403, path);
  assert.deepEqual(dataRequests, []);
  for (const path of ['/', '/resume', '/personal', '/personal/travel', '/personal/gallery', '/work/demos']) {
    assert.equal((await request(path, 'company')).status, 200, path);
  }
  const travel = await request('/api/travel/bootstrap', 'company');
  assert.equal(travel.status, 200);
  assert.equal(JSON.parse(travel.text).authenticated, false);
  assert.equal((await request('/settings', 'reader')).status, 200);
  assert.equal((await request('/paper', 'editor')).status, 200);
  assert.equal((await request('/api/work-bootstrap', 'invalid')).status, 401);
  assert.equal((await request('/api/work-bootstrap', 'inactive')).status, 401);
});

test('Company login and existing company sessions redirect to Work or a safe Work deep link', async () => {
  const {request} = fixture();
  for (const [next, expected] of [['/', '/work'], ['/personal/markdown', '/work'],
    ['/work/team-resources?month=11', '/work/team-resources?month=11']]) {
    const login = await request('/api/auth/login', null, 'POST', {next});
    assert.equal(login.headers.Location, expected);
    const existing = await request('/login?next=' + encodeURIComponent(next), 'company');
    assert.equal(existing.headers.Location, expected);
  }
});

test('Only the explicit active Owner gets the Markdown page and API', async () => {
  const {request, dataRequests} = fixture();
  for (const token of ['company', 'reader', 'editor']) {
    for (const path of ['/personal/markdown', '/personal/markdown/']) {
      assert.equal((await request(path, token)).status, 403, token);
      assert.equal((await request(path, token, 'HEAD')).status, 403, token);
    }
    assert.doesNotMatch((await request('/personal', token)).text, /href="\/personal\/markdown"/);
    for (const path of ['/api/markdown/tree', '/api/markdown/documents/' + documentId, '/api/markdown/documents/' + documentId + '/pdf']) {
      assert.equal((await request(path, token)).status, 403, token + ' ' + path);
    }
    assert.equal((await request('/api/markdown/documents/' + documentId, token, 'DELETE')).status, 403);
  }
  assert.deepEqual(dataRequests, []);
  const gate = await request('/personal/markdown');
  assert.equal(gate.status, 401);
  assert.doesNotMatch(gate.text, /data-md-app/);
  assert.equal((await request('/api/markdown/tree')).status, 401);
  assert.match((await request('/personal/markdown', 'owner')).text, /data-md-app/);
  assert.match((await request('/personal', 'owner')).text, /href="\/personal\/markdown"/);
  assert.equal((await request('/api/markdown/tree', 'owner')).status, 200);
  assert.equal((await request('/api/markdown/documents/' + documentId + '/pdf', 'owner')).status, 404);
});
