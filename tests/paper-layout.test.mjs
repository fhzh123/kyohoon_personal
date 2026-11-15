import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {paperPage} from '../views/paper.mjs';
import {DEFAULT_PROMPTS,publicSettings,validateProject} from '../server/paper-core.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function row(status,venue='ACL ARR'){const id=randomUUID();return{id,revision:randomUUID(),updated_at:'2026-11-15T00:00:00.000Z',data:{id,type:'review',title:'Paper '+status,venue,deadline:'',status,charLimit:0,context:'',pdf:null,reviewers:[],sections:{summary:'a',strength:'b',weakness:'c',etc:'d'},reviewDraft:'A draft',history:[]}};}
test('Paper removes memo counters and duplicate settings, uses conference identity and places save below the editor',async()=>{
 const p=row('planned'),old=row('archived','AAAI');const w=new JSDOM(paperPage(),{url:'https://test.invalid/paper',runScripts:'outside-only'}).window;
 Object.defineProperty(w,'crypto',{value:{randomUUID}});w.scrollTo=()=>{};w.PAPER_PREVIEW={projects:[p,old],settings:publicSettings(null,{}),defaults:DEFAULT_PROMPTS};
 try{w.eval(await readFile(new URL('../public/paper.js',import.meta.url),'utf8'));await sleep(20);assert.equal(w.document.querySelector('[data-action=settings]'),null);w.document.querySelector('[data-action=choose-review]').click();await sleep(20);
 assert.equal(w.document.querySelectorAll('.paper-tab').length,4);assert.equal(w.document.querySelector('[data-filter=archived]'),null);assert.equal(w.document.querySelector('.paper-row-symbol'),null);assert.equal(w.document.querySelector('.paper-progress'),null);assert.equal(w.document.body.textContent.includes('메모 작성'),false);assert.ok(w.document.querySelector('.paper-venue img[alt=ACL]'));assert.match(w.document.querySelectorAll('.paper-venue')[1].textContent,/AAAI/);
 w.document.querySelector('[data-filter=done]').click();await sleep(10);assert.match(w.document.querySelector('.paper-row h2').textContent,/archived/);w.document.querySelector('[data-filter=planned]').click();await sleep(10);w.document.querySelector('[data-open]').click();await sleep(20);
 assert.equal(w.document.querySelector('.paper-topline [data-action=save]'),null);assert.ok(w.document.querySelector('.paper-save-bar [data-save-state]'));assert.ok(w.document.querySelector('.paper-save-bar [data-action=save]'));assert.equal(w.document.querySelector('[data-action=settings]'),null);assert.ok(w.document.querySelector('[data-global-settings]'));
 const editor=w.document.querySelector('[data-field=reviewDraft]'),save=w.document.querySelector('.paper-save-bar');assert.ok(editor.compareDocumentPosition(save)&w.Node.DOCUMENT_POSITION_FOLLOWING);
 const status=w.document.querySelector('[data-project-status]');assert.equal(status.value,'planned');status.value='active';status.dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(850);assert.match(w.document.querySelector('.paper-project-heading .paper-eyebrow').textContent,/진행 중/);assert.match(w.document.querySelector('[data-save-state]').textContent,/저장됨/);
 const css=await readFile(new URL('../public/paper.css',import.meta.url),'utf8');assert.match(css,/textarea\.draft\{font-family:var\(--font-sans\)/);
 }finally{w.close();}
});
test('all three new statuses validate and old archived records become done without losing any notes',()=>{
 for(const status of ['planned','active','done'])assert.equal(validateProject(row(status).data).status,status);
 const p=row('archived').data,result=validateProject(p);assert.equal(result.status,'done');assert.deepEqual(result.sections,p.sections);assert.equal(result.reviewDraft,p.reviewDraft);assert.equal(p.status,'archived');assert.throws(()=>validateProject({...p,status:'unknown'}),/상태/);
});
