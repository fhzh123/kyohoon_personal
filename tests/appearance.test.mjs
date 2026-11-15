import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {JSDOM} from 'jsdom';
import {appearanceRoutes,DEFAULT_APPEARANCE,validateAppearance,validateBackgroundImage} from '../server/appearance-routes.mjs';
import {createHandler} from '../server/app.mjs';
import {settingsPage} from '../views/settings.mjs';
const source=f=>readFile(new URL('../'+f,import.meta.url),'utf8'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
async function harness(role='editor'){
 const rootDir=await mkdtemp(path.join(tmpdir(),'appearance-test-'));let authCalls=0;
 const handler=appearanceRoutes({environment:{NODE_ENV:'development'},rootDir,authorize:async()=>{authCalls++;return role?{mode:'local',userId:'localhost',role}:null;},body:async req=>JSON.stringify(req.input),authFetch:()=>{throw Error('network disabled');},bearer:()=>({}),send:(res,status,value,type,headers)=>Object.assign(res,{status,value,type,headers})});
 return{rootDir,get authCalls(){return authCalls;},call:async(url,method='GET',input)=>{const res={};await handler({method,input},res,new URL(url,'https://test.invalid'));return res;},close:()=>rm(rootDir,{recursive:true,force:true})};
}
test('public display needs no session, but only authenticated editors can change backgrounds or request uploads',async()=>{
 for(const role of [null,'reader','editor']){const h=await harness(role);try{const r=await h.call('/api/appearance');assert.equal(r.status,200);assert.deepEqual(r.value.config,DEFAULT_APPEARANCE);assert.equal(h.authCalls,0);
 const saved=await h.call('/api/settings/appearance','PUT',{config:{images:{light:null,dark:null},speed:75},expectedRevision:null});assert.equal(saved.status,role==='editor'?200:role?403:401);
 if(role==='editor'){assert.equal((await h.call('/api/appearance')).value.config.speed,75);assert.equal((await h.call('/api/settings/appearance','PUT',{config:DEFAULT_APPEARANCE,expectedRevision:null})).status,409);}
 else assert.equal((await h.call('/api/settings/appearance/upload','POST',{type:'image/png',size:100})).status,role?403:401);
 }finally{await h.close();}}
});
test('independent mode images persist with one revision, reject forged ownership and enforce file signatures and 15MB limits',async()=>{
 const h=await harness();try{
 const uploaded=await h.call('/api/settings/appearance/file','POST',{type:'image/png',base64:png.toString('base64')});assert.equal(uploaded.status,200);assert.match(uploaded.value.image.path,/^localhost\//);
 const config={images:{light:uploaded.value.image.path,dark:null},speed:0};const r=await h.call('/api/settings/appearance','PUT',{config,expectedRevision:null});assert.equal(r.status,200);assert.equal(r.value.config.images.dark,null);assert.equal((await h.call('/api/appearance')).value.config.speed,0);
 const downloaded=await h.call(r.value.urls.light);assert.equal(downloaded.status,200);assert.deepEqual(downloaded.value,png);
 const foreign=randomUUID()+'/'+randomUUID()+'.png';assert.equal((await h.call('/api/settings/appearance','PUT',{config:{...config,images:{light:foreign,dark:null}},expectedRevision:r.value.revision})).status,400);
 assert.throws(()=>validateAppearance({images:{light:'https://evil.invalid/a.svg'},speed:40}),/경로/);assert.throws(()=>validateAppearance({...DEFAULT_APPEARANCE,speed:-1}),/속도/);
 assert.throws(()=>validateBackgroundImage(Buffer.from('<svg><script/>'), 'image/png'),/일치/);assert.throws(()=>validateBackgroundImage(png,'image/svg+xml'),/PNG/);assert.throws(()=>validateBackgroundImage(Buffer.alloc(15000001),'image/png'),/15 MB/);
 }finally{await h.close();}
});
test('signed uploads are owner scoped and save uses a revision filter with the authenticated token',async()=>{
 const uid=randomUUID(),revision=randomUUID();let seen,uploadPath;const rootDir='.';
 const handler=appearanceRoutes({rootDir,environment:{SUPABASE_URL:'https://project.supabase.co'},authorize:async()=>({mode:'supabase',role:'editor',userId:uid,token:'session'}),body:async req=>JSON.stringify(req.input),bearer:t=>({Authorization:'Bearer '+t}),send:(res,status,value)=>Object.assign(res,{status,value}),authFetch:async(url,opt={})=>{
  if(url.startsWith('/storage/v1/object/upload/sign/')){uploadPath=url.slice('/storage/v1/object/upload/sign/site-backgrounds/'.length);return Response.json({url:'/object/upload/sign/site-backgrounds/'+uploadPath+'?token=temporary'});}
  if(opt.method==='PATCH'){seen={url,opt};return Response.json([JSON.parse(opt.body)]);}
  return Response.json([{config:DEFAULT_APPEARANCE,revision}]);
 }});
 const call=async(url,method,input)=>{const res={};await handler({method,input},res,new URL(url,'https://test.invalid'));return res;};
 const ticket=await call('/api/settings/appearance/upload','POST',{type:'image/jpeg',size:15000000});assert.equal(ticket.status,200);assert.ok(uploadPath.startsWith(uid+'/'));assert.ok(uploadPath.endsWith('.jpg'));assert.equal(ticket.value.uploadUrl.includes('session'),false);
 const saved=await call('/api/settings/appearance','PUT',{config:{...DEFAULT_APPEARANCE,speed:100},expectedRevision:revision});assert.equal(saved.status,200);assert.match(seen.url,new RegExp('revision=eq.'+revision));assert.equal(seen.opt.headers.Authorization,'Bearer session');
});
test('cross-origin background changes are rejected before authentication and storage',async()=>{
 let calls=0;const handler=createHandler({environment:{SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'test'},fetcher:async()=>{calls++;throw Error('should not run');}});
 const req=Readable.from([]);Object.assign(req,{url:'/api/settings/appearance',method:'PUT',headers:{host:'site.invalid',origin:'https://evil.invalid','content-type':'application/json'},body:{config:DEFAULT_APPEARANCE},socket:{}});const res={setHeader(){},writeHead(s){this.status=s;},end(){}};await handler(req,res);assert.equal(res.status,403);assert.equal(calls,0);
});
test('background editor disables anonymous changes and an editor can save speed independently of LLM keys',async()=>{
 for(const role of [null,'reader','editor']){const w=new JSDOM(settingsPage({authenticated:!!role}),{url:'https://test.invalid/settings',runScripts:'outside-only'}).window;let written;
 w.AtlasBackground={set:(value)=>{written=value;}};w.fetch=async(url,opt={})=>{if(role===null&&url==='/api/settings/appearance')return Response.json({error:'로그인 필요'},{status:401});if(opt.method==='PUT'){written=JSON.parse(opt.body);return Response.json({config:written.config,urls:{light:null,dark:null},revision:randomUUID(),role});}return Response.json({config:DEFAULT_APPEARANCE,urls:{light:null,dark:null},revision:null,role});};
 try{w.eval(await source('public/appearance-settings.js'));await sleep(20);if(!role){assert.equal(w.document.querySelectorAll('[data-bg-file]').length,0);assert.ok(w.document.querySelector('#background-controls .settings-access img'));continue;}assert.equal(w.document.querySelectorAll('[data-bg-file]').length,2);const speed=w.document.querySelector('#background-speed');assert.equal(speed.disabled,role!=='editor');
 if(role==='editor'){speed.value='0';speed.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(written.config.speed,0);w.document.querySelector('[data-bg-save]').click();await sleep(20);assert.match(w.document.querySelector('[data-bg-status]').textContent,/저장했습니다/);}else assert.match(w.document.querySelector('#background-controls').textContent,role?/읽기 전용/:/로그인/);
 }finally{w.close();}}
});
test('public runtime applies mode-specific images, propagates speed and pause and follows theme changes',async()=>{
 const image='https://project.supabase.co/storage/v1/object/public/site-backgrounds/'+randomUUID()+'/'+randomUUID()+'.png';
 const w=new JSDOM('<html data-theme="dark"><head></head><body><div class="ambient-sky"></div></body></html>',{url:'https://test.invalid',runScripts:'outside-only'}).window;
 w.fetch=async()=>Response.json({config:{images:{light:null,dark:'path'},speed:20},urls:{light:null,dark:image},revision:randomUUID()});
 try{w.eval(await source('public/background.js'));await sleep(20);const root=w.document.documentElement;assert.equal(root.style.getPropertyValue('--sky-duration'),'240s');assert.equal(root.dataset.bgImage,'true');root.dataset.theme='light';await sleep(10);assert.equal(root.dataset.bgImage,'false');w.AtlasBackground.set({config:{images:{light:null,dark:null},speed:0},urls:{light:null,dark:null}},{persist:true});assert.equal(root.dataset.bgPaused,'true');assert.equal(JSON.parse(w.localStorage.getItem('kyohoon-site-background')).config.speed,0);
 const laterStyle=w.document.createElement('link');laterStyle.rel='stylesheet';laterStyle.href='/atmosphere.css';w.document.head.append(laterStyle);await sleep(130);assert.match(w.document.head.lastElementChild.href,/\/background.css\?/);
 const css=await source('public/background.css');assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/animation:none!important/);
 }finally{w.close();}
});
