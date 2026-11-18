import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {JSDOM} from 'jsdom';
import {createHandler} from '../server/app.mjs';
import {IDLE_MS,sealIdle,readIdle} from '../server/idle-session.mjs';

const INITIAL=1794978000000,environment={NODE_ENV:'production',SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
async function request(handler,url,{method='GET',cookies={},data,headers={}}={}){
  const req=Readable.from(data===undefined?[]:[JSON.stringify(data)]);
  Object.assign(req,{url,method,headers:{host:'fixture.invalid','content-type':'application/json',cookie:Object.entries(cookies).map(([k,v])=>k+'='+encodeURIComponent(v)).join('; '),...headers},socket:{remoteAddress:'127.0.0.1'}});
  const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(status,values){this.status=status;for(const[k,v]of Object.entries(values))this.setHeader(k,v);},end(value){this.bytes=Buffer.from(value??'');this.text=String(value??'');}};
  await handler(req,res);return res;
}
const mergeCookies=(jar,res)=>{for(const row of res.headers['set-cookie']||[]){const [name,value]=row.split(';')[0].split('=');jar[name]=decodeURIComponent(value);}return jar;};
function serverFixture(){
  let now=INITIAL;const calls=[];
  const handler=createHandler({environment,clock:()=>now,fetcher:async(url,options)=>{
    calls.push({url,options});
    if(url.includes('grant_type=password'))return json({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:'member'}});
    if(url.includes('grant_type=refresh_token'))return json({access_token:'renewed-access',refresh_token:'renewed-refresh',expires_in:3600});
    if(url.endsWith('/auth/v1/user'))return options.headers.Authorization==='Bearer expired'?json({},401):json({id:'member'});
    if(url.includes('/workspace_members?'))return json([{user_id:'member',role:'editor'}]);
    if(url.includes('/workspaces?'))return json([{state:{version:4,goals:[],phases:[],tasks:[],notes:[],references:[]},revision:1}]);
    throw Error('Unexpected fixture request');
  }});
  return {handler,calls,setNow:value=>{now=value;},cookies:()=>({kh_access:'access',kh_refresh:'refresh',kh_idle:sealIdle(INITIAL,'refresh')})};
}
test('login issues a signed three-hour deadline and authenticated HTML loads activity tracking without credentials',async()=>{
 const f=serverFixture(),r=await request(f.handler,'/api/auth/login',{method:'POST',data:{email:'fixture@example.invalid',password:'synthetic'}}),jar=mergeCookies({},r);
 assert.equal(r.status,303);assert.equal(r.headers['set-cookie'].length,3);assert.equal(readIdle(jar.kh_idle,jar.kh_refresh,INITIAL).expiresAt,INITIAL+IDLE_MS);
 assert.ok(r.headers['set-cookie'].every(v=>v.includes('HttpOnly')&&v.includes('Secure')&&v.includes('SameSite=Strict')));
 const home=await request(f.handler,'/',{cookies:jar,headers:{'sec-fetch-dest':'document'}});
 assert.match(home.text,/session-activity\.js/);assert.match(home.text,/data-idle-ms="10800000"/);assert.ok(!home.text.includes('renewed-refresh'));assert.ok(!home.text.includes('kh_refresh'));
 assert.ok(!(await request(f.handler,'/')).text.includes('session-activity.js'));
});
test('a missing or expired access cookie refreshes while preserving the activity deadline',async()=>{
 for(const token of [undefined,'expired']){
  const f=serverFixture(),jar=f.cookies();if(token)jar.kh_access=token;else delete jar.kh_access;
  f.setNow(INITIAL+3601000);const r=await request(f.handler,'/api/research-state',{cookies:jar});
  assert.equal(r.status,200);mergeCookies(jar,r);assert.equal(jar.kh_access,'renewed-access');assert.equal(readIdle(jar.kh_idle,jar.kh_refresh,INITIAL+3601000).lastActive,INITIAL);
  assert.equal(f.calls.filter(c=>c.url.includes('grant_type=refresh_token')).length,1);
  const count=f.calls.length;f.setNow(INITIAL+IDLE_MS);
  const expired=await request(f.handler,'/api/research-state',{cookies:jar});assert.equal(expired.status,401);assert.equal(f.calls.length,count,'idle requests never refresh');
 }
});
test('authenticated gzip demo HTML remains valid gzip and includes the shared activity script',async()=>{
 const f=serverFixture(),r=await request(f.handler,'/work/demos/ontology/',{cookies:f.cookies(),headers:{'accept-encoding':'gzip','sec-fetch-dest':'document'}});
 assert.equal(r.status,200);assert.equal(r.headers['content-encoding'],'gzip');
 const html=gunzipSync(r.bytes).toString('utf8');assert.match(html,/<!doctype html>/i);assert.match(html,/session-activity\.js/);
});
test('background reads do not extend inactivity; explicit activity and navigation do',async()=>{
 const f=serverFixture(),jar=f.cookies();f.setNow(INITIAL+2*3600000);
 const read=await request(f.handler,'/api/research-state',{cookies:jar});assert.equal(read.status,200);assert.equal(read.headers['set-cookie'],undefined);
 const prefetched=await request(f.handler,'/',{cookies:jar,headers:{'sec-fetch-dest':'document','sec-purpose':'prefetch'}});assert.equal(prefetched.headers['set-cookie'],undefined);
 const activity=await request(f.handler,'/api/auth/activity',{method:'POST',cookies:jar,data:{lastActivity:INITIAL+2*3600000}});mergeCookies(jar,activity);
 assert.equal(JSON.parse(activity.text).expiresAt,INITIAL+5*3600000);
 f.setNow(INITIAL+4*3600000);assert.equal((await request(f.handler,'/api/research-state',{cookies:jar})).status,200);
 const page=await request(f.handler,'/',{cookies:jar,headers:{'sec-fetch-dest':'document'}});mergeCookies(jar,page);
 assert.equal(readIdle(jar.kh_idle,jar.kh_refresh,INITIAL+4*3600000).expiresAt,INITIAL+7*3600000);
});
test('expired activity cannot revive a session and forged timestamps and cross-origin requests are rejected',async()=>{
 const f=serverFixture(),jar=f.cookies();
 const tampered={...jar,kh_idle:sealIdle(INITIAL+IDLE_MS,'wrong-credential')};assert.equal((await request(f.handler,'/api/research-state',{cookies:tampered})).status,401);
 assert.equal((await request(f.handler,'/api/auth/activity',{method:'POST',cookies:jar,data:{lastActivity:INITIAL+120000}})).status,400);
 assert.equal((await request(f.handler,'/api/auth/activity',{method:'POST',cookies:jar,data:{lastActivity:INITIAL},headers:{origin:'https://foreign.invalid'}})).status,403);
 f.setNow(INITIAL+IDLE_MS);assert.equal((await request(f.handler,'/api/auth/activity',{method:'POST',cookies:jar,data:{lastActivity:INITIAL+IDLE_MS}})).status,401);
});
test('an idle tab cannot clear a session just renewed by another tab and idle logout does not revoke other devices',async()=>{
 const f=serverFixture(),jar=f.cookies();f.setNow(INITIAL+3600000);
 const renewed=await request(f.handler,'/api/auth/activity',{method:'POST',cookies:jar,data:{lastActivity:INITIAL+3600000}});mergeCookies(jar,renewed);
 f.setNow(INITIAL+IDLE_MS);const active=await request(f.handler,'/api/auth/idle-logout',{method:'POST',cookies:jar});assert.equal(active.status,409);assert.equal(active.headers['set-cookie'],undefined);
 f.setNow(INITIAL+4*3600000);const ended=await request(f.handler,'/api/auth/idle-logout',{method:'POST',cookies:jar});assert.equal(ended.status,204);assert.ok(ended.headers['set-cookie'].every(v=>v.includes('Max-Age=0')));
 assert.equal(f.calls.filter(c=>c.url.endsWith('/auth/v1/logout')).length,0);assert.equal(ended.headers['clear-site-data'],undefined,'idle logout preserves local work storage');
});
test('concurrent requests share refresh work and still revalidate each identity and membership',async()=>{
 let refreshes=0,identities=0;const handler=createHandler({environment,clock:()=>INITIAL,fetcher:async url=>{
  if(url.includes('grant_type=refresh_token')){refreshes++;await new Promise(r=>setImmediate(r));return json({access_token:'new',refresh_token:'new-refresh'});}
  if(url.endsWith('/auth/v1/user')){identities++;return json({id:'member'});}
  if(url.includes('/workspace_members?'))return json([{user_id:'member',role:'reader'}]);
  if(url.includes('/workspaces?'))return json([{state:{tasks:[]},revision:1}]);throw Error('unexpected');
 }});
 const cookies={kh_refresh:'refresh',kh_idle:sealIdle(INITIAL,'refresh')};
 const results=await Promise.all([request(handler,'/api/research-state',{cookies}),request(handler,'/api/research-state',{cookies})]);
 assert.ok(results.every(r=>r.status===200));assert.equal(refreshes,1);assert.equal(identities,2);
});
test('temporary auth outages return a retryable error without clearing or renewing the session',async()=>{
 for(const kh_access of ['access',undefined]){
  const handler=createHandler({environment,clock:()=>INITIAL,fetcher:async()=>json({},503)});
  const cookies={kh_refresh:'refresh',kh_idle:sealIdle(INITIAL,'refresh'),...(kh_access?{kh_access}:{})};
  const response=await request(handler,'/api/auth/activity',{method:'POST',cookies,data:{lastActivity:INITIAL}});
  assert.equal(response.status,503);assert.equal(response.headers['set-cookie'],undefined);
 }
});

async function browserFixture(responder){
 const dom=new JSDOM('<html><head></head><body><textarea></textarea></body></html>',{url:'https://fixture.invalid/work/app/index.html',runScripts:'outside-only'}),w=dom.window;
 let time=INITIAL,nextId=0;const timers=new Map(),requests=[],navigations=[];
 w.Date.now=()=>time;
 w.setTimeout=(callback,delay=0)=>{const id=++nextId;timers.set(id,{callback,at:time+Math.max(0,delay)});return id;};w.clearTimeout=id=>timers.delete(id);
 w.fetch=async(url,options)=>{const item={url,options,time};requests.push(item);if(responder)return responder(item);if(url.endsWith('/activity')){const lastActive=JSON.parse(options.body).lastActivity;return json({lastActive,expiresAt:lastActive+IDLE_MS,serverNow:time});}return new Response(null,{status:204});};
 w.eval(await readFile(new URL('../public/session-activity.js',import.meta.url),'utf8'));
 const session=w.KyohoonIdleSession.start({idleMs:IDLE_MS,lastActive:INITIAL,serverNow:INITIAL,sessionKey:'fixture',navigate:url=>navigations.push(url)});
 const settle=()=>new Promise(resolve=>setImmediate(resolve));
 async function advance(delta){const end=time+delta;let rounds=0;while(true){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;if(++rounds>10000)throw Error('timer loop');time=due[1].at;timers.delete(due[0]);due[1].callback();await settle();}time=end;await settle();}
 return {w,requests,navigations,advance,jump:delta=>{time+=delta;},interact:type=>w.document.dispatchEvent(new w.Event(type,{bubbles:true})),close:()=>{session.stop();w.close();}};
}
test('no interaction expires at three hours, without a background heartbeat',async()=>{
 const f=await browserFixture();try{
  await f.advance(IDLE_MS-1);assert.equal(f.requests.length,0);assert.equal(f.navigations.length,0);
  await f.advance(1);assert.equal(f.requests.length,1);assert.equal(f.requests[0].url,'/api/auth/idle-logout');assert.match(f.navigations[0],/reason=idle/);
 }finally{f.close();}
});
test('typing, clicks and scrolling keep an active page alive beyond one hour and reset its three-hour deadline',async()=>{
 const f=await browserFixture();try{
  for(const type of ['input','pointerdown','scroll','keydown']){await f.advance(3600000);f.interact(type);await f.advance(1);assert.equal(f.navigations.length,0);}
  assert.equal(f.requests.filter(r=>r.url==='/api/auth/activity').length,4);
  await f.advance(IDLE_MS-2);assert.equal(f.navigations.length,0);await f.advance(1);assert.equal(f.navigations.length,1);
 }finally{f.close();}
});
test('returning from sleep after expiry cannot count its first interaction as a renewal',async()=>{
 const f=await browserFixture();try{
  f.jump(IDLE_MS+1000);f.interact('pointerdown');await f.advance(0);
  assert.equal(f.requests.filter(r=>r.url.endsWith('/activity')).length,0);assert.equal(f.navigations.length,1);
 }finally{f.close();}
});
test('activity in another tab extends the shared deadline and a newer server deadline defeats a stale idle timer',async()=>{
 const f=await browserFixture();try{
  await f.advance(2*3600000);const last=INITIAL+2*3600000;
  f.w.localStorage.setItem('kh-activity:fixture',String(last));f.w.dispatchEvent(new f.w.StorageEvent('storage',{key:'kh-activity:fixture',newValue:String(last)}));
  await f.advance(3600000);assert.equal(f.navigations.length,0);await f.advance(2*3600000);assert.equal(f.navigations.length,1);
 }finally{f.close();}
 let checks=0;const other=await browserFixture(item=>{assert.equal(item.url,'/api/auth/idle-logout');checks++;return checks===1?json({lastActive:INITIAL+3600000,expiresAt:INITIAL+4*3600000,serverNow:item.time},409):new Response(null,{status:204});});
 try{await other.advance(IDLE_MS);assert.equal(other.navigations.length,0);await other.advance(3600000);assert.equal(other.navigations.length,1);}finally{other.close();}
});
