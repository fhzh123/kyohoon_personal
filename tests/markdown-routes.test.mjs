import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {markdownRoutes, THEMES} from '../server/markdown-routes.mjs';
import {MARKDOWN_THEME_KEYS} from '../views/markdown-themes.mjs';
import {createHandler} from '../server/app.mjs';

const privateDir = fileURLToPath(new URL('../private/', import.meta.url));
const editor = {mode:'local', role:'editor', userId:'localhost', token:''};
async function fixture(t, {access = editor, authFetch, rootDir, renderPdf} = {}) {
  if (!rootDir) {
    await mkdir(privateDir, {recursive:true});
    rootDir = await mkdtemp(path.join(privateDir, 'markdown-test-'));
    t.after(async () => {
      assert.equal(path.dirname(rootDir), path.resolve(privateDir));
      assert.ok(path.basename(rootDir).startsWith('markdown-test-'));
      await rm(rootDir, {recursive:true, force:true});
    });
  }
  const limits = [];
  const handler = markdownRoutes({
    rootDir, environment:{}, authorize:async () => access, renderPdf,
    authFetch:authFetch || (() => { throw Error('No network in local mode'); }),
    bearer:token => ({Authorization:'Bearer ' + token}),
    body:async (req, max) => {
      limits.push(max);
      const raw = req.raw === undefined ? JSON.stringify(req.input) : req.raw;
      if (Buffer.byteLength(raw) > max) throw Object.assign(Error('too large'), {status:413});
      return raw;
    },
    send:(res, status, value, contentType, headers) => Object.assign(res, {status, value, contentType, headers}),
  });
  const call = async (url, method = 'GET', input, raw) => {
    const res = {};
    res.handled = await handler({method, input, raw}, res, new URL(url, 'https://test.invalid'));
    return res;
  };
  return {rootDir, call, limits, setAccess:value => { access = value; }};
}
async function seed(h) {
  const folder = await h.call('/api/markdown/folders', 'POST', {name:' 기록 '});
  assert.equal(folder.status, 200);
  const document = await h.call('/api/markdown/documents', 'POST', {folder_id:folder.value.id, title:' 초안 '});
  assert.equal(document.status, 200);
  return {folder:folder.value, document:document.value};
}
const docUrl = document => '/api/markdown/documents/' + document.id;
const folderUrl = folder => '/api/markdown/folders/' + folder.id;

test('Markdown PDF lets the local preview download vector bytes without persisting the requested theme', async t => {
  const calls = [], pdf = Buffer.from('%PDF-1.7\nexample');
  const h = await fixture(t, {renderPdf:async document => { calls.push(document); return pdf; }});
  const {document} = await seed(h);
  const saved = (await h.call(docUrl(document), 'PATCH', {revision:document.revision, title:'한글 "문서"', content:'# 실제 본문', theme:'night'})).value;
  const response = await h.call(docUrl(document) + '/pdf?theme=github-dark');
  assert.equal(response.status, 200);
  assert.equal(response.contentType, 'application/pdf');
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.match(response.headers['Content-Disposition'], /^attachment; filename="document.pdf"; filename\*=UTF-8''/);
  assert.ok(response.headers['Content-Disposition'].endsWith(encodeURIComponent(saved.title) + '.pdf'));
  assert.deepEqual(response.value, pdf);
  assert.deepEqual(calls, [{title:saved.title, content:saved.content, theme:'github-dark'}]);
  assert.deepEqual((await h.call(docUrl(document))).value, saved);
  await h.call(docUrl(document) + '/pdf');
  assert.equal(calls[1].theme, 'night');
  for (const theme of MARKDOWN_THEME_KEYS) assert.equal((await h.call(docUrl(document) + '/pdf?theme=' + theme)).status, 200);
});

test('Markdown PDF validates authentication, IDs, themes, missing documents, and methods before rendering', async t => {
  let rendered = 0;
  const h = await fixture(t, {renderPdf:async () => { rendered++; return Buffer.from('%PDF'); }});
  const {document} = await seed(h), url = docUrl(document) + '/pdf';
  h.setAccess(null);
  assert.equal((await h.call(url)).status, 401);
  h.setAccess({...editor, role:'reader'});
  assert.equal((await h.call(url, 'POST')).status, 403);
  h.setAccess(editor);
  assert.equal((await h.call(url, 'POST')).status, 405);
  assert.equal((await h.call('/api/markdown/documents/bad/pdf')).status, 400);
  for (const theme of ['', 'unknown', 'IVORY', '%22%3E%3Cscript%3E']) assert.equal((await h.call(url + '?theme=' + theme)).status, 400);
  assert.equal((await h.call('/api/markdown/documents/' + randomUUID() + '/pdf')).status, 404);
  assert.equal(rendered, 0);
});

test('Markdown PDF remote reads use the member token and translate failures into JSON errors', async t => {
  const id = randomUUID(), reads = [];
  const h = await fixture(t, {
    access:{mode:'supabase', role:'editor', isOwner:true, token:'owner-token'},
    authFetch:async (url, options) => { reads.push({url, options}); return {ok:true, json:async () => [{id, title:'원격 문서', content:'# 본문', theme:'ivory'}]}; },
    renderPdf:async () => { throw Error('Browser internal details'); },
  });
  const response = await h.call('/api/markdown/documents/' + id + '/pdf?theme=chrome');
  assert.equal(response.status, 503);
  assert.deepEqual(response.value, {error:'PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'});
  assert.equal(reads.length, 1);
  assert.equal(reads[0].options.method, 'GET');
  assert.equal(reads[0].options.headers.Authorization, 'Bearer owner-token');
  assert.match(reads[0].url, new RegExp('id=eq\\.' + id));
  const forbidden = await fixture(t, {access:{mode:'supabase', role:'editor', isOwner:true, token:'stale-owner'}, authFetch:async () => ({ok:false, status:403})});
  assert.equal((await forbidden.call('/api/markdown/documents/' + id + '/pdf')).status, 403);
});

test('Markdown local CRUD persists across handlers, moves documents and cascades folder deletion', async t => {
  const h = await fixture(t);
  assert.deepEqual((await h.call('/api/markdown/tree')).value, {folders:[], documents:[], role:'editor'});
  const {folder, document} = await seed(h);
  assert.equal(folder.name, '기록');
  assert.equal(folder.position, 0);
  assert.equal(document.title, '초안');
  assert.equal(document.content, '');
  assert.equal(document.theme, 'ivory');
  assert.match(document.revision, /^[a-f0-9-]{36}$/);
  assert.ok(Number.isFinite(Date.parse(document.updated_at)));
  const rename = await h.call(folderUrl(folder), 'PATCH', {name:'새 폴더'});
  assert.equal(rename.status, 200);
  const saved = await h.call(docUrl(document), 'PATCH', {revision:document.revision, title:' 새 제목 ', content:'# 본문\n\n<u>밑줄</u>', theme:'github-dark'});
  assert.equal(saved.status, 200);
  assert.equal(saved.value.title, '새 제목');
  assert.notEqual(saved.value.revision, document.revision);
  const fresh = await fixture(t, {rootDir:h.rootDir});
  assert.deepEqual((await fresh.call(docUrl(document))).value, saved.value);
  const tree = (await fresh.call('/api/markdown/tree')).value;
  assert.deepEqual(tree.folders, [{...folder, name:'새 폴더'}]);
  assert.deepEqual(Object.keys(tree.documents[0]).sort(), ['id', 'folder_id', 'title', 'theme', 'updated_at'].sort());
  assert.equal(tree.documents[0].title, '새 제목');
  const other = (await h.call('/api/markdown/folders', 'POST', {name:'이동'})).value;
  const moved = await h.call(docUrl(document), 'PATCH', {revision:saved.value.revision, folder_id:other.id});
  assert.equal(moved.status, 200);
  assert.equal(moved.value.content, saved.value.content);
  assert.deepEqual((await h.call(folderUrl(folder), 'DELETE')).value, {ok:true});
  assert.equal((await h.call(docUrl(document))).status, 200);
  const second = (await h.call('/api/markdown/documents', 'POST', {folder_id:other.id, title:'삭제할 문서'})).value;
  assert.deepEqual((await h.call(docUrl(second), 'DELETE')).value, {ok:true});
  assert.equal((await h.call(docUrl(second))).status, 404);
  assert.deepEqual((await h.call(folderUrl(other), 'DELETE')).value, {ok:true});
  assert.equal((await h.call(docUrl(document))).status, 404);
  assert.deepEqual((await h.call('/api/markdown/tree')).value.documents, []);
  assert.deepEqual(await readdir(path.join(h.rootDir, 'private/markdown')), ['state.json']);
});

test('Markdown requires authentication for reads and every write endpoint', async t => {
  const h = await fixture(t, {access:null});
  const id = randomUUID();
  for (const [url, method] of [
    ['/api/markdown/tree', 'GET'], ['/api/markdown/documents/' + id, 'GET'],
    ['/api/markdown/folders', 'POST'], ['/api/markdown/folders/' + id, 'PATCH'], ['/api/markdown/folders/' + id, 'DELETE'],
    ['/api/markdown/documents', 'POST'], ['/api/markdown/documents/' + id, 'PATCH'], ['/api/markdown/documents/' + id, 'DELETE'],
  ]) {
    const response = await h.call(url, method, {});
    assert.equal(response.status, 401, method + ' ' + url);
    assert.equal(typeof response.value.error, 'string');
  }
  assert.equal(h.limits.length, 0);
  await assert.rejects(readFile(path.join(h.rootDir, 'private/markdown/state.json')), {code:'ENOENT'});
  assert.equal((await h.call('/api/markdown-other/tree')).handled, false);
});

test('Markdown reader cannot read existing documents, export PDFs, or mutate data', async t => {
  const h = await fixture(t);
  const {folder, document} = await seed(h);
  h.setAccess({...editor, role:'reader'});
  for (const url of ['/api/markdown/tree', docUrl(document), docUrl(document) + '/pdf']) {
    assert.equal((await h.call(url)).status, 403);
  }
  const previousLimits = h.limits.length;
  for (const [url, method] of [
    ['/api/markdown/folders', 'POST'], [folderUrl(folder), 'PATCH'], [folderUrl(folder), 'DELETE'],
    ['/api/markdown/documents', 'POST'], [docUrl(document), 'PATCH'], [docUrl(document), 'DELETE'],
  ]) {
    const response = await h.call(url, method, {});
    assert.equal(response.status, 403);
    assert.deepEqual(response.value, {error:'소유자만 마크다운 에디터를 사용할 수 있습니다.'});
  }
  assert.equal(h.limits.length, previousLimits);
});

test('Markdown validates trimmed folder names and document titles at their boundaries', async t => {
  const h = await fixture(t);
  for (const name of ['', ' \n ', '가'.repeat(81), null, 123]) assert.equal((await h.call('/api/markdown/folders', 'POST', {name})).status, 400);
  const folder = (await h.call('/api/markdown/folders', 'POST', {name:'  ' + '가'.repeat(80) + '  '})).value;
  assert.equal(folder.name.length, 80);
  assert.equal((await h.call(folderUrl(folder), 'PATCH', {name:' '})).status, 400);
  for (const title of ['', ' \t ', '가'.repeat(121), null, {}]) assert.equal((await h.call('/api/markdown/documents', 'POST', {folder_id:folder.id, title})).status, 400);
  const created = await h.call('/api/markdown/documents', 'POST', {folder_id:folder.id, title:' ' + '가'.repeat(120) + ' '});
  assert.equal(created.status, 200);
  assert.equal(created.value.title.length, 120);
  assert.equal((await h.call(docUrl(created.value), 'PATCH', {revision:created.value.revision, title:' '})).status, 400);
});

test('Markdown validates UUIDs, JSON objects, patch fields and required revisions', async t => {
  const h = await fixture(t);
  const {document} = await seed(h);
  for (const raw of ['{', 'null', '[]', 'true', '"text"']) assert.equal((await h.call('/api/markdown/folders', 'POST', undefined, raw)).status, 400);
  for (const id of ['bad', 'a'.repeat(36), '%27or%3Dtrue', '%2e%2e%2fsecret']) {
    assert.equal((await h.call('/api/markdown/documents/' + id)).status, 400);
    assert.equal((await h.call('/api/markdown/folders/' + id, 'DELETE')).status, 400);
    assert.equal((await h.call('/api/markdown/documents', 'POST', {folder_id:id, title:'제목'})).status, 400);
  }
  for (const revision of [undefined, null, 'stale', 123]) assert.equal((await h.call(docUrl(document), 'PATCH', {revision, content:'수정'})).status, 400);
  assert.equal((await h.call(docUrl(document), 'PATCH', {revision:document.revision})).status, 400);
  assert.equal((await h.call(docUrl(document), 'PATCH', {revision:document.revision, folder_id:null})).status, 400);
  assert.deepEqual((await h.call(docUrl({id:document.id.toUpperCase()}))).value, document);
});

test('Markdown accepts every fixed theme and rejects unsafe themes and invalid content', async t => {
  assert.deepEqual(THEMES, MARKDOWN_THEME_KEYS);
  const h = await fixture(t);
  let {document} = await seed(h);
  for (const theme of THEMES) {
    const response = await h.call(docUrl(document), 'PATCH', {revision:document.revision, theme});
    assert.equal(response.status, 200);
    assert.equal(response.value.theme, theme);
    document = response.value;
  }
  for (const theme of ['unknown', 'IVORY', '', null, {key:'ivory'}]) assert.equal((await h.call(docUrl(document), 'PATCH', {revision:document.revision, theme})).status, 400);
  for (const content of [null, 123, {}, 'a'.repeat(500001)]) assert.equal((await h.call(docUrl(document), 'PATCH', {revision:document.revision, content})).status, 400);
  const content = '가'.repeat(500000);
  const response = await h.call(docUrl(document), 'PATCH', {revision:document.revision, content});
  assert.equal(response.status, 200);
  assert.equal(response.value.content, content);
  assert.ok(h.limits.every(limit => limit >= 1024 * 1024));
  const escaped = '\0'.repeat(500000);
  const escapedResponse = await h.call(docUrl(document), 'PATCH', {revision:response.value.revision, content:escaped});
  assert.equal(escapedResponse.status, 200);
  assert.equal(escapedResponse.value.content, escaped);
  assert.equal((await h.call(docUrl(document), 'PATCH', undefined, ' '.repeat(4 * 1024 * 1024 + 1))).status, 413);
});

test('Markdown returns 404 for missing folders and documents without changing saved state', async t => {
  const h = await fixture(t);
  const {document} = await seed(h), missing = randomUUID();
  for (const [url, method, input] of [
    [docUrl({id:missing}), 'GET'], [docUrl({id:missing}), 'DELETE'],
    [docUrl({id:missing}), 'PATCH', {revision:document.revision, content:'없음'}],
    [folderUrl({id:missing}), 'PATCH', {name:'없음'}], [folderUrl({id:missing}), 'DELETE'],
    ['/api/markdown/documents', 'POST', {folder_id:missing, title:'없음'}],
    [docUrl(document), 'PATCH', {revision:document.revision, folder_id:missing}],
  ]) assert.equal((await h.call(url, method, input)).status, 404, method + ' ' + url);
  assert.deepEqual((await h.call(docUrl(document))).value, document);
  assert.equal((await h.call('/api/markdown/tree', 'POST', {})).status, 404);
  assert.equal((await h.call(docUrl(document), 'PUT', {})).status, 405);
});

test('Markdown serializes local concurrent writes and returns the full latest document on conflict', async t => {
  const h = await fixture(t);
  const {folder, document} = await seed(h);
  const results = await Promise.all(['첫째', '둘째'].map(content => h.call(docUrl(document), 'PATCH', {revision:document.revision, content})));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  const winner = results.find(r => r.status === 200).value;
  assert.deepEqual(results.find(r => r.status === 409).value, {error:'다른 곳에서 먼저 수정되었습니다.', document:winner});
  assert.deepEqual((await h.call(docUrl(document), 'PATCH', {revision:document.revision, title:'덮어쓰기'})).value.document, winner);
  assert.equal((await h.call(docUrl(document), 'PATCH', {revision:winner.revision, content:'다음 저장'})).status, 200);
  const created = await Promise.all(Array.from({length:8}, (_, i) => h.call('/api/markdown/documents', 'POST', {folder_id:folder.id, title:'문서 ' + i})));
  assert.ok(created.every(r => r.status === 200));
  assert.equal((await h.call('/api/markdown/tree')).value.documents.length, 9);
});

function remoteStore() {
  const calls = [], folders = new Map(), documents = new Map();
  let beforePatch, failure;
  const authFetch = async (url, options) => {
    calls.push({url, ...options});
    if (failure) return Response.json(failure.body, {status:failure.status});
    const parsed = new URL(url, 'https://supabase.invalid');
    const params = parsed.searchParams, table = parsed.pathname.endsWith('folders') ? folders : documents;
    const id = params.get('id')?.slice(3), method = options.method;
    let rows;
    if (method === 'POST') {
      const row = JSON.parse(options.body);
      if (row.folder_id && !folders.has(row.folder_id)) return Response.json({code:'23503'}, {status:409});
      table.set(row.id, row); rows = [row];
    } else if (method === 'PATCH') {
      if (beforePatch) { const callback = beforePatch; beforePatch = null; callback(documents); }
      const row = table.get(id), revision = params.get('revision')?.slice(3);
      const changes = JSON.parse(options.body);
      if (changes.folder_id && !folders.has(changes.folder_id)) return Response.json({code:'23503'}, {status:409});
      rows = row && (!revision || row.revision === revision) ? [Object.assign(row, changes)] : [];
    } else if (method === 'DELETE') {
      rows = table.has(id) ? [table.get(id)] : [];
      table.delete(id);
      if (table === folders) for (const row of documents.values()) if (row.folder_id === id) documents.delete(row.id);
    } else rows = id ? (table.has(id) ? [table.get(id)] : []) : [...table.values()];
    return Response.json(rows.map(row => Object.fromEntries(params.get('select').split(',').map(key => [key, row[key]]))));
  };
  return {calls, folders, documents, authFetch, onPatch:callback => { beforePatch = callback; }, fail:value => { failure = value; }};
}

test('Markdown Supabase CRUD sends user bearer tokens, selected fields and revision predicates', async t => {
  const store = remoteStore(), userId = randomUUID();
  const h = await fixture(t, {access:{mode:'supabase', role:'editor', isOwner:true, userId, token:'user-token'}, authFetch:store.authFetch});
  const {folder, document} = await seed(h);
  assert.equal(store.folders.get(folder.id).updated_by, userId);
  assert.equal(store.documents.get(document.id).updated_by, userId);
  assert.equal((await h.call(folderUrl(folder), 'PATCH', {name:'수정'})).value.name, '수정');
  const save = await h.call(docUrl(document), 'PATCH', {revision:document.revision, content:'본문', theme:'chrome', updated_by:randomUUID(), id:randomUUID()});
  assert.equal(save.status, 200);
  assert.equal(save.value.id, document.id);
  assert.equal(save.value.content, '본문');
  const patch = store.calls.find(call => call.method === 'PATCH' && call.url.includes('markdown_documents'));
  const query = new URL(patch.url, 'https://test.invalid').searchParams;
  assert.equal(query.get('id'), 'eq.' + document.id);
  assert.equal(query.get('revision'), 'eq.' + document.revision);
  const patchBody = JSON.parse(patch.body);
  assert.equal(patchBody.updated_by, userId);
  assert.notEqual(patchBody.revision, document.revision);
  assert.equal(Object.hasOwn(patchBody, 'id'), false);
  assert.equal(Object.hasOwn(patchBody, 'created_at'), false);
  assert.deepEqual((await h.call(docUrl(document))).value, save.value);
  const tree = (await h.call('/api/markdown/tree')).value;
  assert.equal(tree.documents[0].theme, 'chrome');
  assert.equal(Object.hasOwn(tree.documents[0], 'content'), false);
  assert.equal(Object.hasOwn(tree.documents[0], 'revision'), false);
  const treeCalls = store.calls.filter(call => call.method === 'GET' && new URL(call.url, 'https://test.invalid').searchParams.has('order'));
  assert.equal(treeCalls.length, 2);
  assert.equal(new URL(treeCalls[1].url, 'https://test.invalid').searchParams.get('select'), 'id,folder_id,title,theme,updated_at');
  const other = (await h.call('/api/markdown/folders', 'POST', {name:'이동'})).value;
  assert.equal((await h.call(docUrl(document), 'PATCH', {revision:save.value.revision, folder_id:other.id})).status, 200);
  assert.equal((await h.call(folderUrl(other), 'DELETE')).status, 200);
  assert.equal((await h.call(docUrl(document))).status, 404);
  const second = (await h.call('/api/markdown/documents', 'POST', {folder_id:folder.id, title:'삭제'})).value;
  assert.equal((await h.call(docUrl(second), 'DELETE')).status, 200);
  assert.equal((await h.call(docUrl(second), 'DELETE')).status, 404);
  assert.equal((await h.call(folderUrl(folder), 'DELETE')).status, 200);
  assert.equal((await h.call(folderUrl(folder), 'DELETE')).status, 404);
  for (const call of store.calls) {
    assert.equal(call.headers.Authorization, 'Bearer user-token');
    assert.equal(call.headers.Prefer, 'return=representation');
    assert.equal(call.headers['Content-Type'], 'application/json');
  }
  await assert.rejects(readFile(path.join(h.rootDir, 'private/markdown/state.json')), {code:'ENOENT'});
});

test('Markdown Supabase CAS detects a race at the write and returns the latest document', async t => {
  const store = remoteStore();
  const h = await fixture(t, {access:{...editor, mode:'supabase', isOwner:true, userId:randomUUID()}, authFetch:store.authFetch});
  const {document} = await seed(h);
  const newer = {...document, content:'다른 창에서 저장', revision:randomUUID()};
  store.onPatch(documents => documents.set(document.id, newer));
  const stale = await h.call(docUrl(document), 'PATCH', {revision:document.revision, content:'덮어쓰기'});
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.value, {error:'다른 곳에서 먼저 수정되었습니다.', document:newer});
  assert.equal(store.documents.get(document.id).content, newer.content);
  store.onPatch(documents => documents.delete(document.id));
  assert.equal((await h.call(docUrl(document), 'PATCH', {revision:newer.revision, content:'삭제 후 저장'})).status, 404);
});

test('Markdown Supabase rejects non-owners before fetching data and hides upstream failure details', async t => {
  const store = remoteStore();
  const h = await fixture(t, {authFetch:store.authFetch});
  for (const role of ['reader', 'editor', 'selectstar_reader']) {
    h.setAccess({mode:'supabase', role, isOwner:false, token:'non-owner-token'});
    assert.equal((await h.call('/api/markdown/tree')).status, 403);
    assert.equal((await h.call('/api/markdown/folders', 'POST', {name:'금지'})).status, 403);
  }
  assert.equal(store.calls.length, 0);
  h.setAccess({...editor, mode:'supabase', isOwner:true, userId:randomUUID(), token:'owner-token'});
  assert.equal((await h.call('/api/markdown/documents', 'POST', {folder_id:randomUUID(), title:'없는 폴더'})).status, 404);
  for (const status of [401, 403, 500]) {
    store.fail({status, body:{message:'private upstream detail'}});
    const response = await h.call('/api/markdown/tree');
    assert.equal(response.status, status === 500 ? 503 : status);
    assert.ok(!JSON.stringify(response.value).includes('private upstream detail'));
  }
});

async function httpCall(handler, url, method, body, headers = {}) {
  const req = Readable.from([]);
  Object.assign(req, {url, method, body, headers:{host:'test.invalid', 'content-type':'application/json', ...headers}, socket:{}});
  const res = {setHeader(){}, writeHead(status){this.status = status;}, end(value){this.value = JSON.parse(String(value));}};
  await handler(req, res);
  return res;
}

test('Markdown app wiring permits PATCH and DELETE only for this API and blocks foreign origins before auth', async () => {
  let networkCalls = 0;
  const handler = createHandler({environment:{SUPABASE_URL:'https://project.supabase.co', SUPABASE_ANON_KEY:'fixture'}, fetcher:async () => { networkCalls++; throw Error('Unexpected network'); }});
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    const url = '/api/markdown/' + (method === 'GET' ? 'tree' : 'documents/' + randomUUID());
    assert.equal((await httpCall(handler, url, method, {})).status, 401);
  }
  for (const method of ['POST', 'PATCH', 'DELETE']) {
    for (const headers of [{origin:'https://evil.invalid'}, {'sec-fetch-site':'cross-site'}]) {
      const response = await httpCall(handler, '/api/markdown/documents/' + randomUUID(), method, {}, headers);
      assert.equal(response.status, 403);
    }
  }
  for (const method of ['PATCH', 'DELETE']) assert.equal((await httpCall(handler, '/api/research-state', method, {})).status, 405);
  assert.equal(networkCalls, 0);
});

test('Markdown HTTP integration authenticates the user and enforces the actual body byte limit', async () => {
  const userId = randomUUID(), store = remoteStore();
  const handler = createHandler({environment:{SUPABASE_URL:'https://project.supabase.co', SUPABASE_ANON_KEY:'fixture'}, fetcher:async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return Response.json({id:userId});
    if (url.includes('/rest/v1/workspace_members?')) return Response.json([{user_id:userId, role:'editor', is_owner:true}]);
    return store.authFetch(url.replace('https://project.supabase.co', ''), options);
  }});
  const headers = {cookie:'kh_access=fixture-token', origin:'http://test.invalid'};
  const folder = await httpCall(handler, '/api/markdown/folders', 'POST', {name:'HTTP 폴더'}, headers);
  assert.equal(folder.status, 200);
  const document = await httpCall(handler, '/api/markdown/documents', 'POST', {folder_id:folder.value.id, title:'HTTP 문서'}, headers);
  assert.equal(document.status, 200);
  const content = '가'.repeat(500000);
  const saved = await httpCall(handler, docUrl(document.value), 'PATCH', {revision:document.value.revision, content}, headers);
  assert.equal(saved.status, 200);
  assert.equal(saved.value.content, content);
  const oversized = await httpCall(handler, docUrl(document.value), 'PATCH', {revision:saved.value.revision, content:'가'.repeat(1500000)}, headers);
  assert.equal(oversized.status, 413);
  assert.deepEqual(oversized.value, {error:'요청이 너무 큽니다.'});
  assert.equal((await httpCall(handler, docUrl(document.value), 'DELETE', undefined, headers)).status, 200);
});

test('Markdown migration enables private member RLS, editor mutations, FK indexes and cascade deletion', async () => {
  const sql = await readFile(new URL('../supabase/markdown.sql', import.meta.url), 'utf8');
  assert.match(sql, /references public\.markdown_folders\(id\) on delete cascade/);
  assert.match(sql, /char_length\(content\) <= 500000/);
  assert.match(sql, /theme in \('ivory','github-dark','chrome','sprinkles'\)/);
  assert.doesNotMatch(sql, /grant[^;]+to anon/i);
  for (const table of ['folders', 'documents']) {
    assert.match(sql, new RegExp('alter table public.markdown_' + table + ' enable row level security'));
    assert.match(sql, new RegExp('create index markdown_' + table + '_updated_by_idx'));
    for (const action of ['select', 'insert', 'update', 'delete']) {
      const policy = sql.split(';').find(statement => statement.includes('on public.markdown_' + table + ' for ' + action + ' to authenticated'));
      assert.ok(policy, table + ' ' + action);
      assert.match(policy, /m\.user_id=\(select auth\.uid\(\)\) and m\.active/);
      if (action !== 'select') assert.match(policy, /m\.role='editor'/);
      if (['insert', 'update'].includes(action)) assert.match(policy, /with check \(updated_by=\(select auth\.uid\(\)\)/);
    }
  }
  assert.match(sql, /create index markdown_documents_folder_id_idx/);
});
