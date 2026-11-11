import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import jsdom from 'jsdom';

const {JSDOM, ResourceLoader, VirtualConsole} = jsdom;
const root = fileURLToPath(new URL('../', import.meta.url));
const clone = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
async function until(condition) {
  const stop = Date.now() + 3000;
  while (!condition()) { if (Date.now() > stop) throw new Error('DOM simulation timed out'); await tick(); }
}

// jsdom simulates DOM/events; it does not verify browser painting, images,
// desktop/mobile layout, focus appearance, or actual Supabase connectivity.
async function fixture(role = 'editor') {
  const workspaceBytes = await fs.readFile(path.join(root,'private/work/workspace-state.json'));
  const sourceHash = createHash('sha256').update(workspaceBytes).digest('hex');
  let remote = JSON.parse(workspaceBytes);
  const original = clone(remote.state);
  const taxonomySource = JSON.parse(await fs.readFile(path.join(root,'private/work/taxonomy-source.json'),'utf8'));
  const legacySeed = JSON.parse(await fs.readFile(path.join(root,'private/work/legacy-seed.json'),'utf8'));
  const errors = [], puts = [];
  class LocalScripts extends ResourceLoader {
    fetch(url) {
      const name = new URL(url).pathname.replace('/work/app/','');
      if (!/^[a-z-]+\.js$/.test(name)) return null;
      const promise = fs.readFile(path.join(root,'work-app',name));
      promise.abort = () => {};
      return promise;
    }
  }
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(await fs.readFile(path.join(root,'work-app/index.html'),'utf8'), {
    url:'http://127.0.0.1:3000/work/app/index.html',runScripts:'dangerously',resources:new LocalScripts(),
    pretendToBeVisual:true,virtualConsole,
    beforeParse(window) {
      window.scrollTo = () => {};
      window.confirm = () => true;
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
      window.HTMLDialogElement.prototype.close = function () { this.open = false; };
      window.fetch = async (url, options = {}) => {
        const method = options.method || 'GET';
        const response = (status, value) => ({status,ok:status>=200&&status<300,json:async()=>clone(value)});
        if (url === '/api/work-bootstrap') return response(200,{
          workspace:remote,taxonomySource,legacySeed,
          context:{mode:role==='reader'?'supabase':'local',role,storageKey:'dom-simulation-'+role},
        });
        assert.equal(url,'/api/research-state');
        if (method === 'GET') return response(200,remote);
        assert.equal(method,'PUT');
        puts.push(JSON.parse(options.body));
        if (role === 'reader') return response(403,{error:'read-only'});
        const incoming = puts.at(-1);
        if (String(incoming.revision) !== String(remote.revision)) return response(409,remote);
        remote={revision:'dom-'+puts.length,state:incoming.state,updatedAt:new Date().toISOString()};
        return response(200,remote);
      };
    },
  });
  await until(() => dom.window.ResearchAtlas || errors.length);
  assert.deepEqual(errors,[]);
  await tick();
  const document = dom.window.document;
  const navigate = async view => {
    const button = document.querySelector(`[data-view="${view}"]`);
    assert.ok(button,'navigation '+view+' exists');
    button.click(); await tick();
    assert.equal(dom.window.location.hash,'#'+view);
    assert.ok(document.querySelector('#view-host').textContent.trim());
  };
  return {
    dom,document,original,errors,puts,navigate,getRemote:()=>clone(remote),
    async close() {
      dom.window.close();
      const after = await fs.readFile(path.join(root,'private/work/workspace-state.json'));
      assert.equal(createHash('sha256').update(after).digest('hex'),sourceHash,'DOM simulation never saves the actual private state');
    },
  };
}

test('DOM simulation: original Work navigation, real startup counts, search and mocked editing', async () => {
  const f = await fixture();
  try {
    const state=f.dom.window.ResearchAtlas.getState();
    for (const key of ['goals','phases','tasks','notes','references']) assert.equal(state[key].length,f.original[key].length);
    assert.equal(f.document.querySelector('#integration-notice').textContent.includes('로컬 원본 사본'),true);
    assert.ok(f.document.querySelector('a[href="/work"]'),'research diary returns to protected Work hub');
    const logout=f.document.querySelector('#work-logout');
    assert.equal(logout.method,'post'); assert.equal(logout.getAttribute('action'),'/api/auth/logout');
    for (const view of ['goals','overview','notes','references','settings','backlog','roadmap']) await f.navigate(view);
    assert.equal(f.document.querySelectorAll('#navigation [data-view]').length,7);
    const query=f.original.tasks.find(task=>task.title.length>20).title;
    const input=f.document.querySelector('#global-search');
    input.value=query; input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
    await tick();
    assert.ok(f.document.querySelector('#view-host').textContent.includes(query));
    input.value=''; input.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
    await f.navigate('backlog');
    const taskButton=f.document.querySelector('[data-task]');
    assert.ok(taskButton);
    const id=taskButton.dataset.task;
    taskButton.click(); await tick();
    assert.equal(f.document.querySelector('#task-dialog').open,true);
    const title=f.document.querySelector('#task-title');
    assert.equal(title.value,f.original.tasks.find(task=>task.id===id).title);
    const expected=title.value+' [DOM TEST]';
    title.value=expected;
    title.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
    f.document.querySelector('#task-form').dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));
    await until(()=>f.puts.length>0);
    await until(()=>f.document.querySelector('#storage-status').textContent.includes('업무 저장소에 저장됨'));
    assert.equal(f.getRemote().state.tasks.find(task=>task.id===id).title,expected);
    assert.equal(f.document.querySelector('#task-dialog').open,false);
    assert.deepEqual(f.errors,[]);
  } finally { await f.close(); }
});

test('DOM simulation: reader can navigate/search/read details but cannot edit, drag, import or save', async () => {
  const f=await fixture('reader');
  try {
    assert.ok(f.document.querySelector('#integration-notice').textContent.includes('읽기 전용'));
    assert.equal(f.document.querySelector('#add-task').disabled,true);
    assert.equal(f.document.querySelector('#work-logout button').disabled,false);
    assert.equal(f.document.querySelector('#global-search').readOnly,false);
    assert.equal(f.document.querySelector('[data-reorder-task]').disabled,true);
    await f.navigate('overview');
    assert.equal(f.document.querySelector('#annual-focus').readOnly,true);
    assert.equal(f.document.querySelector('#annual-save-status').textContent,'읽기 전용 · 저장 권한 없음');
    await f.navigate('goals');
    assert.equal(f.document.querySelector('[data-add-goal]').disabled,true);
    assert.equal(f.document.querySelector('[data-edit-goal]').textContent,'상세 보기');
    await f.navigate('notes');
    assert.equal(f.document.querySelector('[data-new-note]').disabled,true);
    assert.equal(f.document.querySelector('#note-body').readOnly,true);
    await f.navigate('references');
    await f.navigate('backlog');
    const task=f.document.querySelector('[data-task]');
    task.click(); await tick();
    const before=JSON.stringify(f.dom.window.ResearchAtlas.getState());
    const title=f.document.querySelector('#task-title');
    assert.equal(title.readOnly,true);
    assert.equal(f.document.querySelector('#task-form button[type=submit]').disabled,true);
    title.value='SIMULATED ATTEMPT';
    title.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));
    f.document.querySelector('#task-form').dispatchEvent(new f.dom.window.Event('submit',{bubbles:true,cancelable:true}));
    const id=task.dataset.task;
    f.dom.window.ResearchAtlas.operations.deleteTask(id);
    f.dom.window.ResearchAtlas.operations.duplicateTask(id);
    f.dom.window.ResearchAtlas.operations.reschedule(id,'2027-01-01','2027-01-07','week');
    await tick();
    assert.equal(JSON.stringify(f.dom.window.ResearchAtlas.getState()),before);
    assert.equal(f.puts.length,0,'reader sends no remote PUT');
    assert.deepEqual(f.errors,[]);
  } finally { await f.close(); }
});
