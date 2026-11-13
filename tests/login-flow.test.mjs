import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createHandler} from '../server/app.mjs';
import {safeLoginDestination} from '../server/policy.mjs';
import {homePage,loginPage} from '../views/pages.mjs';
const environment={NODE_ENV:'production',SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture'};
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
async function request(handler,url,{method='GET',body,headers={}}={}){
 const req=Readable.from(body?[new URLSearchParams(body).toString()]:[]);Object.assign(req,{url,method,headers:{host:'fixture.invalid','content-type':'application/x-www-form-urlencoded',...headers},socket:{remoteAddress:'127.0.0.1'}});
 const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(status,headers){this.status=status;for(const[k,v]of Object.entries(headers))this.setHeader(k,v);},end(text){this.text=String(text??'');}};await handler(req,res);return res;
}
test('all private document entry points redirect to one login while APIs remain unauthorized',async()=>{
 const handler=createHandler({environment:{NODE_ENV:'production'}});
 for(const route of ['/work','/work/','/personal','/personal/','/work/demos','/work/app/index.html','/work/expenses/','/work/expenses/index.html?year=2026']){
  const r=await request(handler,route);assert.equal(r.status,303,route);assert.equal(r.headers.location,'/login?next='+encodeURIComponent(route));assert.match(r.headers['cache-control'],/no-store/);
 }
 for(const route of ['/api/research-state','/api/work-bootstrap','/api/card-ledger','/work/app/app.js','/work/expenses/app.js'])assert.equal((await request(handler,route)).status,401,route);
});
test('return destinations cannot become an external or API redirect',()=>{
 for(const value of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/%2f%2fevil.invalid','/api/auth/logout','/login','/work/../../api/research-state','/work\n','/work/%5c%5cevil.invalid'])assert.equal(safeLoginDestination(value),'/work',value);
 assert.equal(safeLoginDestination('/work/expenses/?year=2026&approval=2'),'/work/expenses/?year=2026&approval=2');
});
test('successful login keeps the requested destination and validates active membership',async()=>{
 const calls=[];const handler=createHandler({environment,fetcher:async(url,options)=>{calls.push({url,options});if(url.includes('grant_type=password'))return json({access_token:'private-token',refresh_token:'private-refresh',user:{id:'member'}});if(url.includes('workspace_members'))return json([{user_id:'member',role:'reader'}]);throw Error('Unexpected call');}});
 const r=await request(handler,'/api/auth/login',{method:'POST',body:{email:'member@example.invalid',password:'test-only',next:'/work/expenses/?year=2026'}});
 assert.equal(r.status,303);assert.equal(r.headers.location,'/work/expenses/?year=2026');assert.equal(r.headers['set-cookie'].length,2);assert.ok(r.headers['set-cookie'].every(c=>c.includes('HttpOnly')&&c.includes('Secure')));assert.ok(!r.text.includes('private-token'));assert.equal(calls.length,2);
});
test('failed login retains a safe destination and shows the same contact dialog',async()=>{
 const handler=createHandler({environment,fetcher:async()=>new Response('{}',{status:400})});
 const r=await request(handler,'/api/auth/login',{method:'POST',body:{email:'member@example.invalid',password:'test-only',next:'/personal'}});
 assert.equal(r.status,401);const d=new JSDOM(r.text).window.document;assert.equal(d.querySelector('[name=next]').value,'/personal');assert.ok(d.querySelector('#account-help'));assert.ok(d.querySelector('[role=alert]'));assert.equal(r.headers['set-cookie'],undefined);
});
test('authenticated home shows logout and authenticated login redirects immediately',async()=>{
 const handler=createHandler({environment,fetcher:async url=>url.endsWith('/auth/v1/user')?json({id:'member'}):json([{user_id:'member',role:'reader'}])});
 const r=await request(handler,'/login?next=%2Fpersonal',{headers:{cookie:'kh_access=test-only'}});assert.equal(r.headers.location,'/personal');
 const home=new JSDOM(homePage({authenticated:true})).window.document;assert.ok(home.querySelector('.header-actions form[action="/api/auth/logout"]'));assert.equal(home.querySelector('a[href="/login"]'),null);
 const anonymous=new JSDOM(homePage()).window.document;assert.equal(anonymous.querySelector('[data-theme-toggle]').nextElementSibling.getAttribute('href'),'/login');
});
test('password help uses native dialog, copies contact details and never sends recovery email',async()=>{
 const w=new JSDOM(loginPage({configured:true,preview:false}),{url:'https://fixture.invalid/login',runScripts:'outside-only'}).window;
 const dialog=w.document.querySelector('dialog');dialog.showModal=function(){this.open=true;this.querySelector('button').focus();};dialog.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 let copied='';Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});w.fetch=()=>{throw Error('No recovery request is allowed');};w.eval(await readFile(new URL('../public/auth.js',import.meta.url),'utf8'));
 const opener=w.document.querySelector('[data-contact-open]');opener.click();assert.equal(dialog.open,true);assert.equal(w.document.body.style.overflow,'hidden');assert.equal(dialog.querySelector('.contact-qr img').src,'https://i.ibb.co/VYhm8hmW/image.png');assert.equal(dialog.querySelector('.contact-email a').textContent,'fhzh@naver.com');
 dialog.querySelector('[data-copy-email]').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(copied,'fhzh@naver.com');assert.match(dialog.querySelector('[role=status]').textContent,/복사했습니다/);
 dialog.querySelector('[data-contact-close]').click();assert.equal(dialog.open,false);assert.equal(w.document.activeElement,opener);assert.equal(w.document.body.style.overflow,'');
 w.document.querySelector('.password-toggle').click();assert.equal(w.document.querySelector('#password').type,'text');w.document.querySelector('.password-toggle').click();assert.equal(w.document.querySelector('#password').type,'password');w.close();
});
