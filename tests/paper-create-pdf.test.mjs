import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {JSDOM} from 'jsdom';
import {paperPage} from '../views/paper.mjs';
import {homePage} from '../views/pages.mjs';
import {DEFAULT_PROMPTS,publicSettings} from '../server/paper-core.mjs';
import {createHandler} from '../server/app.mjs';
test('Personal stays public even when header authentication is unavailable',async()=>{
 let authCalls=0;const handler=createHandler({environment:{NODE_ENV:'production',SUPABASE_URL:'https://test.invalid',SUPABASE_ANON_KEY:'synthetic'},fetcher:async()=>{authCalls++;throw Error('auth unavailable');}});
 for(const method of ['GET','HEAD'])for(const url of ['/personal','/personal/']){
  const req=Readable.from([]);Object.assign(req,{url,method,headers:{host:'test.invalid',cookie:'kh_access=invalid'},socket:{}});
  const res={setHeader(){},writeHead(status){this.status=status;},end(body){this.body=body;}};
  await handler(req,res);assert.equal(res.status,200);if(method==='HEAD')assert.equal(res.body,'');else{assert.match(res.body,/Personal/);assert.doesNotMatch(res.body,/api\/auth\/logout/);}
 }assert.ok(authCalls>0);
 const d=new JSDOM(homePage()).window.document;
 assert.equal(d.querySelector('a.portal[href="/personal"] .home-access').textContent,'누구나 볼 수 있음');
 assert.ok(d.querySelector('a.portal[href="/paper"] .home-access.is-locked'));assert.notEqual(d.querySelector('a.portal[href="/paper"]').dataset.pose,d.querySelector('[data-default-pose]').getAttribute('src'));
});
async function creation(withFile,failUpload=false){
 const fixture={projects:[],settings:publicSettings(null,{}),defaults:DEFAULT_PROMPTS},calls=[];
 const w=new JSDOM(paperPage(),{url:'https://fixture.invalid/paper',runScripts:'outside-only'}).window;
 Object.defineProperty(w,'crypto',{value:{randomUUID}});w.confirm=()=>true;w.scrollTo=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async(url,opt={})=>{
  calls.push({url,body:opt.body?JSON.parse(opt.body):null});
  if(url==='/api/paper')return Response.json(fixture);
  if(url==='/api/paper/project'){const p=JSON.parse(opt.body).project;return Response.json({project:{id:p.id,data:p,revision:randomUUID(),updated_at:new Date().toISOString()}});}
  if(url==='/api/paper/file/upload')return Response.json({local:true});
  if(url==='/api/paper/file')return failUpload?Response.json({error:'Upload fixture failure'},{status:503}):Response.json({pdf:{path:'owner/project/file.pdf',name:'review.pdf',size:15}});
  throw Error('unexpected route');
 };
 w.eval(await readFile(new URL('../public/paper.js',import.meta.url),'utf8'));
 const settle=()=>new Promise(r=>setTimeout(r,15));await settle();
 w.document.querySelector('[data-action=choose-review]').click();await settle();w.document.querySelector('[data-action=new-review]').click();await settle();
 const fileInput=w.document.querySelector('#paper-create-pdf');assert.ok(fileInput);assert.equal(fileInput.required,false);
 w.document.querySelector('input[name=title]').value='New review paper';
 if(withFile)Object.defineProperty(fileInput,'files',{value:[new w.File(['%PDF-1.7\n test'], 'review.pdf',{type:'application/pdf'})]});
 w.document.querySelector('#paper-project-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,100));
 assert.match(w.document.querySelector('h1').textContent,/New review paper/);assert.equal(w.document.querySelector('#paper-md'),null);
 if(withFile){assert.equal(calls.filter(c=>c.url==='/api/paper/file').length,1);const fileCall=calls.find(c=>c.url==='/api/paper/file'),saveCall=calls.find(c=>c.url==='/api/paper/project');assert.equal(fileCall.body.projectId,saveCall.body.project.id);assert.ok(calls.indexOf(saveCall)<calls.indexOf(fileCall));
  if(failUpload)assert.match(w.document.querySelector('#paper-status').textContent,/논문은 생성됐지만 PDF 첨부에 실패/);else{assert.match(w.document.querySelector('.paper-attachment').textContent,/review.pdf/);assert.ok(calls.filter(c=>c.url==='/api/paper/project').at(-1).body.project.pdf);}
 }else assert.equal(calls.filter(c=>c.url==='/api/paper/file').length,0);
 w.close();
}
test('review can be created without an optional PDF',()=>creation(false));
test('review creation saves its record before uploading and attaching the selected PDF',()=>creation(true));
test('failed initial PDF upload retains the new review and shows a recoverable error',()=>creation(true,true));
