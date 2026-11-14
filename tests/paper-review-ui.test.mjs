import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {paperPage} from '../views/paper.mjs';
import {DEFAULT_PROMPTS,publicSettings} from '../server/paper-core.mjs';
test('review tabs retain rough notes and Markdown import populates all four sections',async()=>{
 const p={id:randomUUID(),type:'review',title:'Review fixture',venue:'ARR',deadline:'',status:'active',charLimit:0,context:'',pdf:null,reviewers:[],sections:{summary:'rough summary',strength:'rough strength',weakness:'rough weakness',etc:''},reviewDraft:'',history:[]};
 const w=new JSDOM(paperPage(),{url:'https://fixture.invalid/paper',runScripts:'outside-only'}).window;
 Object.defineProperty(w,'crypto',{value:{randomUUID}});w.scrollTo=()=>{};w.confirm=()=>true;
 w.PAPER_PREVIEW={projects:[{id:p.id,data:p,revision:randomUUID(),updated_at:new Date().toISOString()}],settings:publicSettings(null,{}),defaults:DEFAULT_PROMPTS};
 w.eval(await readFile(new URL('../public/paper.js',import.meta.url),'utf8'));await new Promise(r=>setTimeout(r,10));
 const click=s=>w.document.querySelector(s).click();
 click('[data-open]');await new Promise(r=>setTimeout(r,10));click('[data-section=weakness]');
 let n=w.document.querySelector('[data-field="sections.weakness"]');n.value='specific concern';n.dispatchEvent(new w.Event('input',{bubbles:true}));
 click('[data-section=summary]');click('[data-section=weakness]');assert.equal(w.document.querySelector('[data-field="sections.weakness"]').value,'specific concern');
 const file=w.document.querySelector('#paper-md');Object.defineProperty(file,'files',{value:[{size:120,text:async()=>'# Summary\nImported summary\n\n## Strengths\nClear method\n\n## Weaknesses\nMissing baseline\n\n## ETC\nCheck appendix'}]});
 file.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,20));
 for(const [s,value]of [['summary','Imported summary'],['strength','Clear method'],['weakness','Missing baseline'],['etc','Check appendix']]){click('[data-section='+s+']');assert.equal(w.document.querySelector('[data-field="sections.'+s+'"]').value,value);}
 click('[data-action=settings]');await new Promise(r=>setTimeout(r,20));const prompt=w.document.querySelector('#prompt-review');prompt.value='Custom review instruction';prompt.dispatchEvent(new w.Event('input',{bubbles:true}));click('[data-action=save-settings]');await new Promise(r=>setTimeout(r,20));assert.equal(w.document.querySelector('#prompt-review').value,'Custom review instruction');w.close();
});
