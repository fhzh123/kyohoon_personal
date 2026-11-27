import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {paperPage} from '../views/paper.mjs';
import {settingsPage} from '../views/settings.mjs';
import {paperRoutes} from '../server/paper-routes.mjs';
import {DEFAULT_PROMPTS,publicSettings,validateSettings,encryptKey,MAX_PDF_BYTES} from '../server/paper-core.mjs';
import {generate} from '../server/paper-providers.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const makeProject=()=>{const id=randomUUID();return {id,revision:randomUUID(),updated_at:new Date().toISOString(),data:{id,type:'review',title:'Cross-device review',venue:'ARR',deadline:'',status:'active',charLimit:0,context:'',pdf:null,reviewers:[],sections:{summary:'',strength:'',weakness:'',etc:''},reviewDraft:'',history:[]}};};
test('automatic saves reach the server while typing and another device reads them; back retains review contents',async()=>{
 let row=makeProject(),writes=0;const settings=publicSettings(null,{});
 const fetcher=async(url,opt={})=>{if(url==='/api/paper')return Response.json({projects:[row],settings,defaults:DEFAULT_PROMPTS});if(url==='/api/paper/project'){const body=JSON.parse(opt.body);assert.equal(body.expectedRevision,row.revision);row={id:row.id,data:body.project,revision:randomUUID(),updated_at:new Date().toISOString()};writes++;return Response.json({project:row});}throw Error(url);};
 const boot=async hash=>{const w=new JSDOM(paperPage(),{url:'https://test.invalid/paper'+hash,runScripts:'outside-only'}).window;w.fetch=fetcher;Object.defineProperty(w,'crypto',{value:{randomUUID}});w.scrollTo=()=>{};w.confirm=()=>{throw Error('No discard confirmation should be needed');};w.eval(await readFile(new URL('../public/paper.js',import.meta.url),'utf8'));await sleep(25);return w;};
 const w=await boot('');let other;
 try{
  w.document.querySelector('[data-action=choose-review]').click();await sleep(15);w.document.querySelector('[data-open]').click();await sleep(20);
  const notes=w.document.querySelector('[data-field="sections.summary"]');notes.value='Written on laptop';notes.dispatchEvent(new w.Event('input',{bubbles:true}));await sleep(850);
  assert.equal(writes,1);assert.equal(row.data.sections.summary,'Written on laptop');assert.match(w.document.querySelector('[data-save-state]').textContent,/자동 저장됨/);
  other=await boot('#review/'+row.id);assert.equal(other.document.querySelector('[data-field="sections.summary"]').value,'Written on laptop');
  notes.value='Saved before browser back';notes.dispatchEvent(new w.Event('input',{bubbles:true}));w.history.back();await sleep(70);
  assert.equal(w.location.hash,'#review');assert.match(w.document.querySelector('h1').textContent,/논문 리뷰 준비/);assert.equal(row.data.sections.summary,'Saved before browser back');
  w.document.querySelector('[data-open]').click();await sleep(20);w.document.querySelector('[data-action=back]').click();await sleep(20);assert.equal(w.location.pathname,'/paper');assert.equal(w.location.hash,'#review');
 }finally{w.close();other?.close();}
});
test('stale automatic saves stop with a visible conflict and never overwrite the other device',async()=>{
 const row=makeProject();let writes=0;const w=new JSDOM(paperPage(),{url:'https://test.invalid/paper#review/'+row.id,runScripts:'outside-only'}).window;
 w.fetch=async(url)=>url==='/api/paper'?Response.json({projects:[row],settings:publicSettings(null,{}),defaults:DEFAULT_PROMPTS}):(writes++,Response.json({error:'다른 기기에서 먼저 저장했습니다.'},{status:409}));Object.defineProperty(w,'crypto',{value:{randomUUID}});w.scrollTo=()=>{};
 try{w.eval(await readFile(new URL('../public/paper.js',import.meta.url),'utf8'));await sleep(25);const n=w.document.querySelector('[data-field="sections.summary"]');n.value='local text';n.dispatchEvent(new w.Event('input',{bubbles:true}));await sleep(850);assert.match(w.document.querySelector('[data-save-state]').textContent,/다른 기기/);assert.equal(n.value,'local text');n.value+=' kept';n.dispatchEvent(new w.Event('input',{bubbles:true}));await sleep(800);assert.equal(writes,1);assert.equal(row.data.sections.summary,'');}finally{w.close();}
});
test('shared settings preserve encrypted keys, persist effort and expose only last four characters',()=>{
 const env={PAPER_ENCRYPTION_KEY:randomBytes(32).toString('base64')},key=encryptKey('synthetic-secret-1234','owner','openai',env);
 const row={config:{prompts:{...DEFAULT_PROMPTS,review:'Custom review'}},encrypted_keys:{openai:key}};
 const result=validateSettings({provider:'anthropic',efforts:{openai:'high',anthropic:'medium',gemini:'none'}},row,'owner',env);
 assert.deepEqual(result.encrypted_keys.openai,key);assert.equal(result.config.prompts.review,'Custom review');assert.equal(result.config.efforts.anthropic,'medium');
 const safe=publicSettings(result,env);assert.equal(safe.keys.openai.last4,'1234');assert.equal(JSON.stringify(safe).includes(key.data),false);assert.throws(()=>validateSettings({provider:'openai',efforts:{openai:'very high!'}},row,'owner',env),/Effort/);assert.throws(()=>validateSettings({provider:'openai',efforts:{openai:'x'.repeat(33)}},row,'owner',env),/Effort/);
 const custom=validateSettings({provider:'openai',efforts:{openai:'ultra',gemini:'2048'}},row,'owner',env);assert.equal(custom.config.efforts.openai,'ultra','a typed effort outside today\'s list is kept');assert.equal(publicSettings(custom,env).efforts.gemini,'2048');
});
test('global settings offers appearance without a login, saves preset and typed efforts, and leaves prompts to Paper',async()=>{
 let settings=publicSettings(null,{}),saved;const w=new JSDOM(settingsPage({authenticated:true}),{url:'https://test.invalid/settings?returnTo=%2Fpaper%23review#llm',runScripts:'outside-only'}).window;
 w.fetch=async(url,opt={})=>{assert.equal(url,'/api/settings/llm');if(opt.method==='PUT'){saved=JSON.parse(opt.body);settings={...settings,...saved,keys:settings.keys,revision:randomUUID()};}return Response.json({settings,defaults:DEFAULT_PROMPTS,role:'editor'});};
 try{w.eval(await readFile(new URL('../public/theme.js',import.meta.url),'utf8'));w.eval(await readFile(new URL('../public/settings.js',import.meta.url),'utf8'));await sleep(25);assert.equal(w.document.querySelectorAll('[data-theme-value]').length,3);assert.equal(w.document.querySelectorAll('input[type=password]').length,3);assert.equal(w.document.querySelectorAll('select[id^=effort-]').length,3);assert.equal(w.document.querySelector('#settings-return').getAttribute('href'),'/paper#review');
 assert.equal(w.document.querySelector('[id^=prompt-]'),null,'prompts are edited in Paper');assert.equal(w.document.querySelector('#effort-custom-openai').hidden,true);
 w.document.querySelector('#effort-openai').value='high';const gemini=w.document.querySelector('#effort-gemini');gemini.value='custom';gemini.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(w.document.querySelector('#effort-custom-gemini').hidden,false);w.document.querySelector('#effort-custom-gemini').value='deep-think';
 w.document.querySelector('[data-action=save-settings]').click();await sleep(25);assert.equal(saved.efforts.openai,'high');assert.equal(saved.efforts.gemini,'deep-think');assert.equal(saved.prompts,undefined);assert.deepEqual(saved.keys,{});
 assert.equal(w.document.querySelector('#effort-gemini').value,'custom','a saved typed effort reopens as 직접 입력');assert.equal(w.document.querySelector('#effort-custom-gemini').value,'deep-think');w.AtlasTheme.set('system');assert.equal(w.document.documentElement.dataset.appearance,'system');}finally{w.close();}
});
test('reasoning parameters use each provider API and None omits every reasoning option',async()=>{
 for(const provider of ['openai','anthropic','gemini'])for(const effort of ['high','none']){
  let payload;await generate({provider,key:'test',model:provider==='anthropic'?'claude-sonnet-5-5':provider==='gemini'?'gemini-4-hydrogen':'gpt-6.1-sol',system:'task',user:'note',effort},async(url,opt)=>{payload=JSON.parse(opt.body);return Response.json(provider==='openai'?{output:[{content:[{type:'output_text',text:'ok'}]}]}:provider==='anthropic'?{content:[{type:'text',text:'ok'}]}:{candidates:[{content:{parts:[{text:'ok'}]}}]});});
  if(effort==='none'){assert.equal(payload.reasoning,undefined);assert.equal(payload.output_config,undefined);assert.equal(payload.thinking,undefined);assert.equal(payload.generationConfig?.thinkingConfig,undefined);}else if(provider==='openai')assert.equal(payload.reasoning.effort,'high');else if(provider==='anthropic')assert.equal(payload.output_config.effort,'high');else assert.equal(payload.generationConfig.thinkingConfig.thinkingLevel,'high');
 }
});
test('17 MB PDFs use owner-scoped signed uploads and completion validates the private PDF before attaching',async()=>{
 const uid=randomUUID(),row=makeProject(),bytes=Buffer.alloc(17000000,32);bytes.write('%PDF-1.7');let signedPath;
 const handler=paperRoutes({authorize:async()=>({userId:uid,role:'editor',mode:'supabase',token:'session'}),environment:{SUPABASE_URL:'https://storage.invalid'},rootDir:'.',bearer:()=>({Authorization:'Bearer session'}),body:async req=>JSON.stringify(req.input),send:(res,status,value)=>Object.assign(res,{status,value}),authFetch:async(url,opt)=>{
 if(url.startsWith('/rest/v1/paper_projects')){assert.match(url,new RegExp('user_id=eq.'+uid));return Response.json([row]);}
 if(url.startsWith('/storage/v1/object/upload/sign/')){signedPath=url.slice('/storage/v1/object/upload/sign/paper-files/'.length);return Response.json({url:'/object/upload/sign/paper-files/'+signedPath+'?token=temporary'});}
 if(url.startsWith('/storage/v1/object/authenticated/'))return new Response(bytes);throw Error(url);
 }});
 const call=async(path,input)=>{const res={};await handler({method:'POST',input},res,new URL(path,'https://test.invalid'));return res;};
 const t=await call('/api/paper/file/upload',{projectId:row.id,name:'large.pdf',size:bytes.length});assert.equal(t.status,200);assert.ok(signedPath.startsWith(uid+'/'+row.id+'/'));assert.match(t.value.uploadUrl,/^https:\/\/storage.invalid\/storage\/v1\/object\/upload\/sign\//);
 const done=await call('/api/paper/file/complete',{projectId:row.id,name:'large.pdf',path:signedPath});assert.equal(done.status,200);assert.equal(done.value.pdf.size,17000000);
 assert.equal((await call('/api/paper/file/complete',{projectId:row.id,name:'large.pdf',path:randomUUID()+'/'+row.id+'/'+randomUUID()+'.pdf'})).status,400);
 assert.equal((await call('/api/paper/file/upload',{projectId:row.id,name:'large.pdf',size:MAX_PDF_BYTES+1})).status,413);
});
test('large private downloads redirect to a short-lived signed URL instead of crossing the function response limit',async()=>{
 const uid=randomUUID(),row=makeProject();row.data.pdf={name:'large paper.pdf',path:uid+'/'+row.id+'/'+randomUUID()+'.pdf',size:4900000};let options;
 const handler=paperRoutes({authorize:async()=>({userId:uid,role:'editor',mode:'supabase',token:'session'}),environment:{SUPABASE_URL:'https://storage.invalid'},rootDir:'.',bearer:()=>({Authorization:'Bearer session'}),send:(res,status,value,type,headers)=>Object.assign(res,{status,value,headers}),authFetch:async(url,opt)=>{
  if(url.startsWith('/rest/v1/paper_projects'))return Response.json([row]);
  assert.equal(url,'/storage/v1/object/sign/paper-files/'+row.data.pdf.path);options=JSON.parse(opt.body);return Response.json({signedURL:'/object/sign/paper-files/'+row.data.pdf.path+'?token=short-lived'});
 }});
 const res={};await handler({method:'GET'},res,new URL('/api/paper/file?projectId='+row.id,'https://test.invalid'));assert.equal(res.status,303);assert.deepEqual(options,{expiresIn:60});assert.equal(res.value,'');assert.match(res.headers.Location,/&download=large%20paper.pdf$/);
});
