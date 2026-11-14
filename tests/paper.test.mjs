import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {Readable} from 'node:stream';
import {JSDOM} from 'jsdom';
import {encryptKey,decryptKey,publicSettings,validateProject,DEFAULT_PROMPTS,DEFAULT_MODELS,buildTask} from '../server/paper-core.mjs';
import {generate,listModels} from '../server/paper-providers.mjs';
import {paperRoutes} from '../server/paper-routes.mjs';
import {paperPage} from '../views/paper.mjs';
import {createHandler} from '../server/app.mjs';

const project=()=>({id:randomUUID(),type:'rebuttal',title:'Test Paper',venue:'ACL',deadline:'',status:'active',charLimit:1500,context:'',pdf:null,reviewers:[{id:randomUUID(),name:'R1',issues:[{id:randomUUID(),kind:'Weakness',title:'Baselines',original:'More baselines?',translation:'',notes:'추가 비교 필요',evidence:'unknown: ??',draft:'',done:false}]}],sections:{summary:'',strength:'',weakness:'',etc:''},reviewDraft:'',history:[]});
const environment={PAPER_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
test('API key authenticated encryption binds owner and provider; public output masks secrets',()=>{
 const key='synthetic-only-api-key-1234',encrypted=encryptKey(key,'alice','openai',environment);
 assert.equal(decryptKey(encrypted,'alice','openai',environment),key);
 assert.throws(()=>decryptKey(encrypted,'bob','openai',environment));
 assert.throws(()=>decryptKey(encrypted,'alice','gemini',environment));
 assert.equal(JSON.stringify(encrypted).includes(key),false);
 const s=publicSettings({encrypted_keys:{openai:encrypted}},environment);
 assert.deepEqual(s.keys.openai,{configured:true,last4:'1234'});assert.equal(JSON.stringify(s).includes(encrypted.data),false);
 assert.throws(()=>encryptKey(key,'alice','openai',{}),/암호화/);
});
test('validation limits, whitelisting, duplicate IDs and grounded task scope',()=>{
 const p=project();p.unexpected='drop';assert.equal(validateProject(p).unexpected,undefined);
 const i=p.reviewers[0].issues[0];const t=buildTask(p,{action:'translate',reviewerId:p.reviewers[0].id,issueId:i.id},DEFAULT_PROMPTS);
 assert.deepEqual(JSON.parse(t.user),{comment:'More baselines?'});assert.equal(t.user.includes('unknown'),false);
 const r=buildTask(p,{action:'rebuttal',reviewerId:p.reviewers[0].id,issueId:i.id},DEFAULT_PROMPTS);assert.match(r.user,/\?\?/);assert.match(r.system,/unperformed/);
 p.reviewers[0].issues.push({...i});assert.throws(()=>validateProject(p),/중복/);
});
test('all three provider adapters use selected key, correct PDF shapes and no automatic fallback',async()=>{
 for(const provider of ['openai','anthropic','gemini']){
  let seen;const fetcher=async(url,options)=>{seen={url,...options,body:JSON.parse(options.body)};return Response.json(provider==='openai'?{status:'completed',output:[{content:[{type:'output_text',text:'answer'}]}]}:provider==='anthropic'?{stop_reason:'end_turn',content:[{type:'text',text:'answer'}]}:{candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private reasoning'},{text:'answer'}]}}]});};
  const r=await generate({provider,key:'secret-only',model:'model-test',system:'instructions',user:'task',pdf:{name:'paper.pdf',base64:'JVBERi0='}},fetcher);assert.equal(r.text,'answer');assert.equal(seen.url.includes('secret-only'),false);
  if(provider==='openai'){assert.equal(seen.body.store,false);assert.equal(seen.body.input[0].content[0].type,'input_file');}
  if(provider==='anthropic')assert.equal(seen.body.messages[0].content[0].source.media_type,'application/pdf');
  if(provider==='gemini')assert.equal(seen.body.contents[0].parts[0].inlineData.mimeType,'application/pdf');
 }
 let calls=0;await assert.rejects(()=>generate({provider:'openai',key:'secret',model:'x',system:'x',user:'x'},async()=>{calls++;return new Response('sensitive upstream body',{status:401});}),/API 키/);assert.equal(calls,1);
 await assert.rejects(()=>generate({provider:'openai',key:'x',model:'x',system:'x',user:'x'},async()=>Response.json({status:'incomplete'})),/출력 길이/);
});
test('models discovery uses header credentials and includes generated text models',async()=>{
 const models=await listModels('gemini','hidden-key',async(url,opt)=>{assert.equal(url.includes('hidden-key'),false);assert.equal(opt.headers['x-goog-api-key'],'hidden-key');return Response.json({models:[{name:'models/text-model',supportedGenerationMethods:['generateContent']},{name:'models/embed',supportedGenerationMethods:['embedContent']}]});});assert.deepEqual(models,['text-model']);
});
async function localHarness(role='editor',fetcher=async()=>{throw Error('provider prohibited');}){
 const rootDir=await mkdtemp(path.join(tmpdir(),'paper-test-'));
 const handler=paperRoutes({authorize:async()=>({userId:'localhost',mode:'local',role}),authFetch:()=>{throw Error('network prohibited');},bearer:()=>({}),send:(res,status,value)=>{res.status=status;res.value=value;},body:async req=>JSON.stringify(req.input),rootDir,environment,fetcher});
 const call=async(url,method='GET',input)=>{const res={};await handler({method,input},res,new URL(url,'https://test.invalid'));return res;};
 return {rootDir,call,close:()=>rm(rootDir,{recursive:true,force:true})};
}
test('local routes persist papers, reject stale writes, mask saved keys and validate PDF upload',async()=>{
 const h=await localHarness();try{
  const p=project();let r=await h.call('/api/paper/project','PUT',{project:p,expectedRevision:null});assert.equal(r.status,200);const rev=r.value.project.revision;
  r=await h.call('/api/paper/project','PUT',{project:{...p,title:'changed'},expectedRevision:randomUUID()});assert.equal(r.status,409);
  r=await h.call('/api/paper/settings','PUT',{provider:'openai',models:DEFAULT_MODELS,prompts:DEFAULT_PROMPTS,keys:{openai:'synthetic-key-last4'},expectedRevision:null});assert.equal(r.status,200);assert.equal(r.value.settings.keys.openai.last4,'ast4');assert.equal(JSON.stringify(r.value).includes('synthetic-key'),false);
  assert.equal((await readFile(path.join(h.rootDir,'private/paper/state.json'),'utf8')).includes('synthetic-key'),false);
  r=await h.call('/api/paper/file','POST',{projectId:p.id,name:'bad.pdf',base64:Buffer.from('not a pdf').toString('base64')});assert.equal(r.status,400);
  r=await h.call('/api/paper/file','POST',{projectId:p.id,name:'test.pdf',base64:Buffer.from('%PDF-1.7\n').toString('base64')});assert.equal(r.status,200);const pdf=r.value.pdf;
  r=await h.call('/api/paper/project','PUT',{project:{...p,pdf:{...pdf,path:'other-user/'+p.id+'/a.pdf'}},expectedRevision:rev});assert.equal(r.status,400);
  r=await h.call('/api/paper/project','PUT',{project:{...p,pdf},expectedRevision:rev});assert.equal(r.status,200);
  r=await h.call('/api/paper/file?projectId='+p.id);assert.equal(r.status,200);assert.equal(r.value.subarray(0,5).toString(),'%PDF-');
 }finally{await h.close();}
});
test('generation reads saved configuration and source revision, never sends PDF for translation',async()=>{
 let request;
 const h=await localHarness('editor',async(url,opt)=>{request={url,body:JSON.parse(opt.body)};return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'번역 결과'}]}]});});
 try{
  const p=project(),saved=await h.call('/api/paper/project','PUT',{project:p,expectedRevision:null});
  await h.call('/api/paper/settings','PUT',{provider:'openai',models:DEFAULT_MODELS,prompts:DEFAULT_PROMPTS,keys:{openai:'synthetic-key-last4'},expectedRevision:null});
  const r=await h.call('/api/paper/generate','POST',{projectId:p.id,action:'translate',reviewerId:p.reviewers[0].id,issueId:p.reviewers[0].issues[0].id,includePdf:true});
  assert.equal(r.status,200);assert.equal(r.value.text,'번역 결과');assert.equal(r.value.sourceRevision,saved.value.project.revision);
  assert.equal(request.body.model,DEFAULT_MODELS.openai);assert.deepEqual(request.body.input[0].content.map(c=>c.type),['input_text']);
 }finally{await h.close();}
});
test('remote reads and writes always constrain owner and stale revision, ignore foreign projects',async()=>{
 const owner=randomUUID(),requests=[],foreign=randomUUID();
 const handler=paperRoutes({authorize:async()=>({userId:owner,mode:'supabase',role:'editor',token:'synthetic'}),authFetch:async(url,opt)=>{requests.push({url,opt});return Response.json([]);},bearer:()=>({}),send:(res,status,value)=>Object.assign(res,{status,value}),body:async req=>JSON.stringify(req.input),rootDir:'.',environment,fetcher:()=>{throw Error('no external call');}});
 const req={method:'GET'},res={};
 await handler(req,res,new URL('/api/paper/file?projectId='+foreign,'https://test.invalid'));
 assert.equal(res.status,404);assert.ok(requests[0].url.includes('user_id=eq.'+owner));assert.ok(requests[0].url.includes('id=eq.'+foreign));
});
test('cross-origin Paper changes are rejected before authorization or storage access',async()=>{
 const handler=createHandler({environment:{NODE_ENV:'production',VERCEL:'1'},fetcher:()=>{throw Error('must not call');}});
 const req=Readable.from([]);Object.assign(req,{url:'/api/paper/settings',method:'PUT',headers:{host:'test.invalid',origin:'https://other.invalid'},socket:{}});let status;
 await handler(req,{writeHead(s){status=s;},end(){}});assert.equal(status,403);
});
test('reader cannot write or generate; unauthenticated /paper and API stay protected',async()=>{
 const h=await localHarness('reader');try{for(const url of ['/api/paper/project','/api/paper/settings','/api/paper/generate'])assert.equal((await h.call(url,'PUT',{})).status,403);}finally{await h.close();}
 const handler=createHandler({environment:{NODE_ENV:'production',VERCEL:'1'}});
 for(const [url,status]of [['/paper',303],['/api/paper',401]]){let seen;const req=Readable.from([]);Object.assign(req,{url,method:'GET',headers:{host:'fixture.invalid'},socket:{}});await handler(req,{setHeader(){},writeHead(s){seen=s;},end(){}});assert.equal(seen,status);}
});
test('Paper DOM supports project editing, issue fields, review tabs, settings and safe text rendering',async()=>{
 const fixture={projects:[{id:'p',data:project(),revision:randomUUID(),updated_at:new Date().toISOString()}],settings:publicSettings(null,environment),defaults:DEFAULT_PROMPTS};
 fixture.projects[0].data.title='<img src=x onerror=alert(1)>';
 fixture.projects[0].id=fixture.projects[0].data.id;
 const w=new JSDOM(paperPage(),{url:'https://test.invalid/paper',runScripts:'outside-only'}).window;
 w.PAPER_PREVIEW=fixture;Object.defineProperty(w,'crypto',{value:{randomUUID}});w.scrollTo=()=>{};w.confirm=()=>true;w.prompt=()=>null;
 w.eval(await readFile(new URL('../public/paper.js',import.meta.url),'utf8'));await new Promise(r=>setTimeout(r,10));
 assert.equal(w.document.querySelectorAll('[data-open]').length,1);assert.equal(w.document.querySelectorAll('img[src=x]').length,0);
 w.document.querySelector('[data-open]').click();await new Promise(r=>setTimeout(r,10));
 const notes=w.document.querySelector('[data-field="issue.notes"]');assert.ok(notes);notes.value='new notes';notes.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.match(w.document.querySelector('[data-save-state]').textContent,/변경/);
 w.document.querySelector('[data-action=save]').click();await new Promise(r=>setTimeout(r,10));assert.match(w.document.querySelector('[data-save-state]').textContent,/저장/);
 w.document.querySelector('[data-action=settings]').click();await new Promise(r=>setTimeout(r,10));assert.equal(w.document.querySelectorAll('input[type=password]').length,3);assert.equal(w.document.querySelectorAll('textarea[id^=prompt-]').length,3);
 assert.equal(w.document.querySelector('#key-openai').disabled,true);w.close();
});
