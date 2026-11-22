import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {markdownPage} from '../views/pages.mjs';
import {MARKDOWN_THEMES} from '../views/markdown-themes.mjs';
import * as core from '../public/markdown-editor-core.js';
import {mountMarkdownEditor, createRenderer} from '../public/markdown-editor.js';

const vendor = name => readFile(new URL(`../public/vendor/${name}`, import.meta.url), 'utf8');
const markdownitSource = await vendor('markdown-it-14.3.3.min.js');
const purifySource = await vendor('purify-3.4.17.min.js');
function loadMarkdownIt() { const sandbox = {}; vm.runInNewContext(markdownitSource, sandbox); return sandbox.markdownit; }

// Runs a transform and returns the new text with the selection marked as [ ].
function run(fn, text, start = text.length, end = start) {
  const edit = fn(text, start, end);
  const next = core.applyToText(text, edit);
  return next.slice(0, edit.selStart) + '[' + next.slice(edit.selStart, edit.selEnd) + ']' + next.slice(edit.selEnd);
}
const sel = (text, word) => { const i = text.indexOf(word); return [i, i + word.length]; };

test('markdown page: editor sees the full editor, reader reads only, visitors get a login prompt', () => {
  const d = new JSDOM(markdownPage({mode: 'local', role: 'editor'})).window.document;
  const app = d.querySelector('[data-md-app]');
  assert.equal(app.dataset.role, 'editor');
  assert.ok(d.querySelector('.hub-header-actions a[href="/personal"]'), 'shared header keeps the Personal link');
  assert.ok(d.querySelector('textarea#md-source'));
  assert.equal(d.querySelector('label[for="md-source"]').textContent, '마크다운 원문');
  const toolbar = d.querySelector('[role=toolbar][data-toolbar]');
  assert.deepEqual([...toolbar.querySelectorAll('[data-cmd]')].map(b => b.dataset.cmd),
    ['bold', 'italic', 'underline', 'strike', 'heading', 'quote', 'code', 'bullet', 'ordered', 'task', 'link', 'image', 'table', 'rule']);
  for (const b of toolbar.querySelectorAll('button')) { assert.ok(b.getAttribute('aria-label'), 'icon buttons are named'); assert.equal(b.type, 'button'); }
  assert.deepEqual([...d.querySelectorAll('[data-view-mode]')].map(b => [b.dataset.viewMode, b.textContent]), [['edit', '편집만'], ['split', '나란히'], ['preview', '미리보기만']]);
  assert.equal(d.querySelector('[data-view-mode=split]').getAttribute('aria-pressed'), 'true');
  assert.ok(d.querySelector('article.md-doc[data-md-theme="ivory"][data-preview]'));
  const themes = [...d.querySelectorAll('#md-export-dialog input[name=theme]')];
  assert.deepEqual(themes.map(t => t.value), MARKDOWN_THEMES.map(t => t.key));
  for (const t of MARKDOWN_THEMES) assert.match(d.querySelector('#md-export-dialog').textContent, new RegExp(t.name));
  assert.ok(d.querySelector('dialog#md-name-dialog label[for="md-name-input"]'), 'name field has a visible label');
  assert.ok(d.querySelector('dialog#md-confirm-dialog [autofocus][value=cancel]'), 'delete confirmation focuses the safe action');
  assert.ok(d.querySelector('.md-print[data-print-root]'));
  const scripts = [...d.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  assert.ok(scripts.includes('/vendor/markdown-it-14.3.3.min.js') && scripts.includes('/vendor/purify-3.4.17.min.js'));
  assert.ok(scripts.some(s => /^\/markdown-editor\.js\?v=\d{8}-\d+$/.test(s)));
  assert.ok(scripts.every(s => s.startsWith('/')), 'no runtime CDN');
  const styles = [...d.querySelectorAll('link[rel=stylesheet]')].map(l => l.getAttribute('href'));
  assert.ok(styles.some(s => /^\/markdown-themes\.css\?v=/.test(s)) && styles.some(s => /^\/markdown-editor\.css\?v=/.test(s)));
  assert.equal(d.querySelectorAll('h1').length, 1);

  const r = new JSDOM(markdownPage({mode: 'supabase', role: 'reader'})).window.document;
  assert.equal(r.querySelector('[data-md-app]').dataset.role, 'reader');
  for (const selector of ['textarea', '[data-toolbar]', '[data-view-mode]', '[data-action=new-folder]', '#md-name-dialog', '#md-confirm-dialog']) assert.equal(r.querySelector(selector), null, selector);
  assert.ok(r.querySelector('[data-action=export]'), 'readers can still print');
  assert.match(r.querySelector('.md-readonly-note').textContent, /읽기 전용/);

  const a = new JSDOM(markdownPage(null)).window.document;
  assert.equal(a.querySelector('[data-md-app]'), null);
  assert.equal(a.querySelector('h1').textContent, '마크다운 에디터');
  assert.ok(a.querySelector('.md-gate a[href="/login?next=%2Fpersonal%2Fmarkdown"]'));
  assert.ok(a.querySelector('.site-header a.btn[href="/login?next=%2Fpersonal%2Fmarkdown"]'), 'header keeps its login link');
  assert.equal(a.querySelector('script[src^="/markdown-editor.js"]'), null);
});

test('inline transforms wrap, unwrap and keep a sensible selection', () => {
  assert.equal(run(core.bold, '안녕 세상', ...sel('안녕 세상', '세상')), '안녕 **[세상]**');
  assert.equal(run(core.bold, '안녕 **세상**', ...sel('안녕 **세상**', '세상')), '안녕 [세상]');
  assert.equal(run(core.bold, '안녕 **세상**', ...sel('안녕 **세상**', '**세상**')), '안녕 [세상]');
  assert.equal(run(core.bold, 'a '), 'a **[굵은 글씨]**');
  assert.equal(run(core.bold, 'word  more', 0, 6), '**[word]**  more', 'trailing spaces stay outside');
  assert.equal(run(core.italic, '**굵게**', 2, 4), '***[굵게]***', 'italic inside bold adds one star');
  assert.equal(run(core.italic, '***굵게***', 3, 5), '**[굵게]**', 'italic toggles off, bold stays');
  assert.equal(run(core.italic, '**굵게**', 0, 6).includes('*'), true);
  assert.equal(run(core.underline, '밑줄', 0, 2), '<u>[밑줄]</u>');
  assert.equal(run(core.underline, '<u>밑줄</u>', 3, 5), '[밑줄]');
  assert.equal(run(core.strike, '지움', 0, 2), '~~[지움]~~');
  assert.equal(run(core.code, 'x = 1', 0, 5), '`[x = 1]`');
  assert.equal(run(core.code, 'a\nb', 0, 3), '```\n[a\nb]\n```', 'multi-line selection becomes a fenced block');
  assert.equal(run(core.code, '```\na\n```', 0, 9), '[a]');
});

test('line transforms: headings, quote, lists and checkboxes', () => {
  assert.equal(run(core.cycleHeading, '제목', 1), '# 제[]목');
  assert.equal(run(core.cycleHeading, '# 제목', 3), '## 제[]목');
  assert.equal(run(core.cycleHeading, '### 제목', 5), '제[]목');
  assert.equal(run(core.COMMANDS.h2, '## 제목', 4), '제[]목', 'the same level toggles off');
  assert.equal(run(core.toggleQuote, 'a\n\nb', 0, 4), '[> a\n>\n> b]');
  assert.equal(run(core.toggleQuote, '> a\n>\n> b', 0, 9), '[a\n\nb]');
  assert.equal(run(core.bulletList, 'a\nb', 0, 3), '[- a\n- b]');
  assert.equal(run(core.bulletList, '- a\n- b', 0, 7), '[a\nb]');
  assert.equal(run(core.orderedList, '- a\n- b\n\n- c', 0, 12), '[1. a\n2. b\n\n3. c]', 'bullets convert to numbers');
  assert.equal(run(core.taskList, '할 일', 0), '- [ ] []할 일');
  assert.equal(run(core.taskList, '- [x] 끝', 0, 8), '[끝]');
  assert.equal(run(core.bulletList, '', 0), '- []');
  assert.equal(run(core.bulletList, 'x\n  y', 2, 5), 'x\n[  - y]', 'indent is kept');
});

test('insert transforms: link, image, table and rule sit where markdown expects them', () => {
  assert.equal(run(core.link, '보기', 0, 2), '[보기]([https://])');
  assert.equal(run(core.link, '', 0), '[[링크 텍스트]](https://)');
  assert.equal(run(core.link, 'https://kyohoon.app', 0, 19), '[[링크 텍스트]](https://kyohoon.app)');
  assert.equal(run(core.image, '고양이', 0, 3), '![고양이]([https://])');
  assert.equal(run(core.image, 'https://x.test/a.png', 0, 20), '![[이미지 설명]](https://x.test/a.png)');
  const t = core.applyToText('문단', core.table('문단', 2, 2));
  assert.equal(t, '문단\n\n' + core.TABLE_TEMPLATE + '\n');
  assert.equal(run(core.table, '', 0), '| [열 1] | 열 2 | 열 3 |\n| --- | --- | --- |\n| 내용 | 내용 | 내용 |\n| 내용 | 내용 | 내용 |\n');
  assert.equal(core.applyToText('문단\n다음', core.rule('문단\n다음', 2, 2)), '문단\n\n---\n\n다음', 'a blank line keeps --- from making a heading');
});

test('Enter continues lists and ends them on an empty item; shortcuts map to commands', () => {
  const cont = (text, pos = text.length) => { const e = core.continueList(text, pos, pos); return e && run(() => e, text, pos); };
  assert.equal(cont('- 사과'), '- 사과\n- []');
  assert.equal(cont('* 사과'), '* 사과\n* []');
  assert.equal(cont('3. 셋'), '3. 셋\n4. []');
  assert.equal(cont('  - [x] 끝'), '  - [x] 끝\n  - [ ] []');
  assert.equal(cont('- '), '[]');
  assert.equal(cont('  1. '), '  []');
  assert.equal(cont('보통 문단'), null);
  assert.equal(cont('- 사과', 1), null, 'inside the marker Enter is untouched');
  const key = (key, mods = {}) => core.shortcutFor({key, ctrlKey: true, ...mods});
  assert.equal(key('b'), 'bold'); assert.equal(key('B'), 'bold'); assert.equal(key('i'), 'italic'); assert.equal(key('u'), 'underline');
  assert.equal(key('k'), 'link'); assert.equal(key('e'), 'code');
  assert.equal(key('X', {shiftKey: true}), 'strike');
  assert.equal(key('*', {shiftKey: true, code: 'Digit8'}), 'bullet');
  assert.equal(key('1', {altKey: true, code: 'Digit1'}), 'h1');
  assert.equal(core.shortcutFor({key: 'b', metaKey: true}), 'bold');
  assert.equal(core.shortcutFor({key: 'b'}), null);
  assert.equal(key('s'), null);
  assert.equal(core.pdfTitle('보고서: 1/2 "초안"'), '보고서 1 2 초안');
  assert.equal(core.pdfTitle('  '), '마크다운 문서');
});

test('rendering: task lists, underline and sanitising with the vendored builds', () => {
  const md = loadMarkdownIt()({html: true});
  md.use(core.taskLists);
  const html = md.render('- [ ] 할 일\n- [x] 끝\n- 보통\n\n1. [x] 번호');
  const d = new JSDOM(html).window.document;
  const boxes = d.querySelectorAll('li.task-list-item > input.task-list-item-checkbox[type=checkbox][disabled]');
  assert.equal(boxes.length, 3);
  assert.deepEqual([...boxes].map(b => b.checked), [false, true, true]);
  assert.equal(d.querySelectorAll('ul.contains-task-list').length, 1);
  assert.equal(d.querySelectorAll('li').length - d.querySelectorAll('li.task-list-item').length, 1);
  assert.equal(d.querySelector('li.task-list-item').textContent.trim(), '할 일');

  const w = new JSDOM('<!doctype html><body></body>', {runScripts: 'outside-only'}).window;
  w.eval(markdownitSource); w.eval(purifySource);
  const render = createRenderer(w.markdownit, w.DOMPurify, w.document);
  const box = w.document.createElement('div');
  box.append(render('<u>밑줄</u> <script>alert(1)</script><img src=x onerror="alert(1)"> [링크](https://example.com) <a href="javascript:alert(1)">x</a>\n\n<style>body{}</style><input type="text" value="x">\n\n- [x] 됨'));
  assert.ok(box.querySelector('u'));
  assert.equal(box.querySelector('script'), null);
  assert.equal(box.querySelector('style'), null);
  assert.equal(box.querySelector('img').getAttribute('onerror'), null);
  assert.equal(box.querySelector('a[href^="javascript"]'), null);
  assert.equal(box.querySelector('a[href="https://example.com"]').getAttribute('rel'), 'noopener noreferrer');
  assert.equal(box.querySelectorAll('input').length, 1, 'only the task checkbox survives');
  assert.ok(box.querySelector('li.task-list-item input[type=checkbox][disabled][checked]'));
  w.close();
});

test('view mode: stored choice, narrow screens fall back to one pane, panes and pressed state follow', () => {
  const storage = new Map();
  const store = {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v)};
  assert.equal(core.readViewMode(store), 'split', 'split is the default');
  assert.equal(core.readViewMode(store, true), 'edit', 'phones default to one pane');
  core.writeViewMode(store, 'preview');
  assert.equal(core.readViewMode(store), 'preview');
  core.writeViewMode(store, 'nonsense');
  assert.equal(core.readViewMode(store), 'preview');
  const broken = {getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }};
  assert.equal(core.readViewMode(broken), 'split');
  assert.doesNotThrow(() => core.writeViewMode(broken, 'edit'));

  const d = new JSDOM(markdownPage({mode: 'local', role: 'editor'})).window.document;
  const root = d.querySelector('[data-md-app]');
  const editor = root.querySelector('[data-pane=editor]'), preview = root.querySelector('[data-pane=preview]');
  const pressed = () => [...root.querySelectorAll('[data-view-mode]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.viewMode);
  core.applyViewMode(root, 'edit');
  assert.deepEqual([root.dataset.view, editor.hidden, preview.hidden, pressed()], ['edit', false, true, ['edit']]);
  core.applyViewMode(root, 'preview');
  assert.deepEqual([root.dataset.view, editor.hidden, preview.hidden, pressed()], ['preview', true, false, ['preview']]);
  core.applyViewMode(root, 'split');
  assert.deepEqual([root.dataset.view, editor.hidden, preview.hidden, pressed()], ['split', false, false, ['split']]);
});

// A jsdom page with the real editor mounted against an in-memory API.
async function editorFixture({role = 'editor', handler, narrow = false, stored = {}} = {}) {
  const folder = {id: '11111111-1111-4111-8111-111111111111', name: '연구 노트', position: 0};
  let doc = {id: '22222222-2222-4222-8222-222222222222', folder_id: folder.id, title: '회의 메모', content: '# 제목\n\n본문', theme: 'ivory', revision: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', updated_at: '2026-11-22T00:00:00Z'};
  const dom = new JSDOM(markdownPage({mode: 'local', role}), {url: `https://fixture.invalid/personal/markdown?doc=${doc.id}`, runScripts: 'outside-only'});
  const w = dom.window;
  w.eval(markdownitSource); w.eval(purifySource);
  w.matchMedia = q => ({matches: narrow && /max-width/.test(q), addEventListener() {}});
  const requests = [];
  const fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({url, method: init.method || 'GET', body});
    const custom = handler && await handler(url, init.method || 'GET', body, {doc, setDoc: d => { doc = d; }});
    if (custom) return custom;
    if (url.endsWith('/tree')) return Response.json({folders: [folder], documents: [{id: doc.id, folder_id: doc.folder_id, title: doc.title, theme: doc.theme, updated_at: doc.updated_at}], role});
    if (url.endsWith(`/documents/${doc.id}`) && (init.method || 'GET') === 'GET') return Response.json(doc);
    if (url.endsWith(`/documents/${doc.id}`) && init.method === 'PATCH') {
      if (body.revision !== doc.revision) return Response.json({error: '다른 곳에서 먼저 수정되었습니다.', document: doc}, {status: 409});
      doc = {...doc, ...body, revision: crypto.randomUUID()}; return Response.json(doc);
    }
    return Response.json({error: '없음'}, {status: 404});
  };
  const storage = new Map(Object.entries(stored));
  const store = {getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v))};
  const root = w.document.querySelector('[data-md-app]');
  const app = mountMarkdownEditor(root, {window: w, fetch, storage: store, saveDelay: 5});
  await app.ready;
  const until = async (fn, ms = 2000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await new Promise(r => setTimeout(r, 5)); } throw new Error('timed out'); };
  return {w, d: w.document, root, app, requests, storage, until, getDoc: () => doc};
}

test('editor opens the linked document, autosaves with the revision and switches views', async () => {
  const {w, d, root, requests, storage, until, getDoc} = await editorFixture();
  try {
    assert.equal(root.dataset.state, 'document');
    assert.equal(d.querySelector('[data-doc-title]').textContent, '회의 메모');
    assert.match(d.querySelector('[data-crumb]').textContent, /연구 노트/);
    assert.equal(d.querySelector('#md-source').value, '# 제목\n\n본문');
    assert.equal(d.querySelector('[data-preview] h1').textContent, '제목');
    assert.ok(d.querySelector('.md-doc-item.is-current a[aria-current=page]'));

    const ta = d.querySelector('#md-source');
    const before = getDoc().revision;
    ta.setSelectionRange(ta.value.length - 2, ta.value.length);
    d.querySelector('[data-cmd=bold]').click();
    assert.equal(ta.value, '# 제목\n\n**본문**');
    assert.equal([ta.selectionStart, ta.selectionEnd].join(), `${ta.value.length - 4},${ta.value.length - 2}`);
    await until(() => d.querySelector('[data-save]').dataset.saveState === 'saved' && requests.some(r => r.method === 'PATCH'));
    const patch = requests.find(r => r.method === 'PATCH');
    assert.deepEqual(patch.body, {content: '# 제목\n\n**본문**', revision: before});
    assert.equal(d.querySelector('[data-save-text]').textContent, '저장됨');
    await until(() => d.querySelector('[data-preview] strong')?.textContent === '본문');

    d.querySelector('[data-view-mode=preview]').click();
    assert.equal(root.dataset.view, 'preview');
    assert.equal(d.querySelector('[data-pane=editor]').hidden, true);
    assert.equal(storage.get(core.VIEW_MODE_KEY), 'preview');
    d.querySelector('[data-view-mode=edit]').click();
    assert.deepEqual([root.dataset.view, d.querySelector('[data-pane=preview]').hidden], ['edit', true]);
  } finally { w.close(); }
});

test('a 409 stops autosave, tells the user and can load the latest version', async () => {
  const {w, d, requests, until, getDoc, app} = await editorFixture();
  try {
    // Someone else saved first: the server now holds a newer revision.
    app.state.revision = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const ta = d.querySelector('#md-source');
    ta.value += '\n추가';
    ta.dispatchEvent(new w.Event('input', {bubbles: true}));
    await until(() => !d.querySelector('[data-conflict]').hidden);
    assert.match(d.querySelector('[data-conflict]').textContent, /먼저 수정/);
    assert.equal(d.querySelector('[data-save]').dataset.saveState, 'conflict');
    const patches = requests.filter(r => r.method === 'PATCH').length;
    ta.value += '!'; ta.dispatchEvent(new w.Event('input', {bubbles: true}));
    await new Promise(r => setTimeout(r, 30));
    assert.equal(requests.filter(r => r.method === 'PATCH').length, patches, 'no saves while the conflict is open');
    d.querySelector('[data-action=load-latest]').click();
    await until(() => d.querySelector('[data-conflict]').hidden);
    assert.equal(ta.value, getDoc().content);
    assert.equal(app.state.revision, getDoc().revision);
  } finally { w.close(); }
});

test('reader sees the document without editing controls; empty workspace guides the first folder', async () => {
  const reader = await editorFixture({role: 'reader'});
  try {
    assert.equal(reader.root.dataset.view, 'preview');
    assert.equal(reader.d.querySelector('[data-preview] h1').textContent, '제목');
    assert.equal(reader.d.querySelector('textarea'), null);
    assert.equal(reader.d.querySelector('[data-action=rename-document]'), null);
    assert.equal(reader.requests.filter(r => r.method !== 'GET').length, 0);
  } finally { reader.w.close(); }

  const dom = new JSDOM(markdownPage({mode: 'local', role: 'editor'}), {url: 'https://fixture.invalid/personal/markdown', runScripts: 'outside-only'});
  const w = dom.window; w.eval(markdownitSource); w.eval(purifySource);
  const app = mountMarkdownEditor(w.document.querySelector('[data-md-app]'), {window: w, storage: null, fetch: async () => Response.json({folders: [], documents: [], role: 'editor'})});
  await app.ready;
  try {
    const d = w.document;
    assert.equal(d.querySelector('[data-md-app]').dataset.state, 'empty');
    assert.match(d.querySelector('[data-empty-title]').textContent, /첫 폴더/);
    assert.equal(d.querySelector('[data-empty-action]').dataset.action, 'new-folder');
    assert.ok(d.querySelector('[data-tree] [data-action=new-folder]'));
    assert.equal(d.querySelector('[data-panes]').hidden, true);
    assert.equal(d.querySelector('[data-action=export]').disabled, true);
  } finally { w.close(); }
});

test('phones start in one pane even when split was stored', async () => {
  const {w, root} = await editorFixture({narrow: true, stored: {[core.VIEW_MODE_KEY]: 'split'}});
  try { assert.equal(root.dataset.view, 'edit'); } finally { w.close(); }
});

test('PDF export saves the chosen theme, prints only the themed document under the document title', async () => {
  const {w, d, requests, until, getDoc} = await editorFixture();
  try {
    let printed = null;
    w.print = () => {
      printed = {
        title: d.title,
        printing: d.documentElement.classList.contains('md-printing'),
        article: d.querySelector('[data-print-root] > article.md-doc')?.dataset.mdTheme,
        heading: d.querySelector('[data-print-root] h1')?.textContent,
      };
    };
    w.HTMLDialogElement.prototype.showModal ??= function () { this.setAttribute('open', ''); };
    d.querySelector('[data-action=export]').click();
    const dialog = d.querySelector('#md-export-dialog');
    assert.equal(dialog.querySelector('input[name=theme]:checked').value, 'ivory');
    const dark = dialog.querySelector('input[name=theme][value="github-dark"]');
    dark.checked = true; dark.dispatchEvent(new w.Event('change', {bubbles: true}));
    assert.equal(d.querySelector('[data-preview]').dataset.mdTheme, 'github-dark', 'the preview follows the choice');
    dialog.removeAttribute('open'); dialog.returnValue = 'print'; dialog.dispatchEvent(new w.Event('close'));
    await until(() => printed);
    assert.deepEqual(printed, {title: '회의 메모', printing: true, article: 'github-dark', heading: '제목'});
    await until(() => requests.some(r => r.method === 'PATCH' && r.body.theme === 'github-dark'));
    assert.equal(getDoc().theme, 'github-dark');
    w.dispatchEvent(new w.Event('afterprint'));
    assert.equal(d.documentElement.classList.contains('md-printing'), false);
    assert.equal(d.querySelector('[data-print-root]').children.length, 0);
    assert.match(d.title, /회의 메모 \| 마크다운 에디터/);

    // Ctrl+P without the dialog prints the same way, in the current theme.
    w.dispatchEvent(new w.Event('beforeprint'));
    assert.equal(d.querySelector('[data-print-root] > article').dataset.mdTheme, 'github-dark');
    assert.equal(d.title, '회의 메모');
    w.dispatchEvent(new w.Event('afterprint'));
    assert.equal(d.querySelector('[data-print-root]').children.length, 0);
  } finally { w.close(); }
});

test('the phone drawer makes the rest of the page inert and Escape closes it', async () => {
  const {w, d, root} = await editorFixture({narrow: true});
  try {
    const header = d.querySelector('.md-shell > .site-header');
    assert.equal(root.dataset.sidebar, 'closed');
    d.querySelector('[data-action=toggle-sidebar]').click();
    assert.equal(root.dataset.sidebar, 'open');
    assert.equal(d.querySelector('[data-sidebar-panel]').getAttribute('role'), 'dialog');
    assert.equal(header.inert, true);
    assert.equal(d.querySelector('[data-workspace]').inert, true);
    d.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    assert.equal(root.dataset.sidebar, 'closed');
    assert.equal(header.inert, false);
    assert.equal(d.querySelector('[data-action=toggle-sidebar]').getAttribute('aria-expanded'), 'false');
  } finally { w.close(); }
});
