import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import {workPage,demosPage,personalPage,loginPage} from '../views/pages.mjs';
import {paperPage} from '../views/paper.mjs';
import {settingsPage} from '../views/settings.mjs';
import {travelPage} from '../views/travel.mjs';
import {demoRoutes} from '../server/demo-routes.mjs';
const source=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const check=(html,parent,icon)=>{
 const w=new JSDOM(html),nav=w.window.document.querySelector('[data-space-navigation]');assert.ok(nav);
 const links=[...nav.querySelectorAll('a')];assert.deepEqual(links.map(a=>a.getAttribute('href')),[parent,'/']);
 assert.deepEqual(links.map(a=>a.textContent.trim()),['','']);assert.equal(links[0].querySelector('img').getAttribute('src'),'/icons/ui-'+icon+'.svg');
 for(const link of links){assert.equal(link.className,'space-nav-button');assert.ok(link.getAttribute('aria-label'));assert.equal(link.title,link.getAttribute('aria-label'));}
 w.window.close();
};
test('Work, Paper and Personal expose two icon-only root destinations with one shared shape',async()=>{
 check(workPage({mode:'supabase',role:'editor'}),'/work','briefcase-business');check(demosPage(),'/work','briefcase-business');
 check(paperPage(),'/paper','book-open');check(personalPage(),'/personal','user-round');check(personalPage({role:'editor'}),'/personal','user-round');
 check(travelPage(null),'/personal','user-round');check(travelPage({role:'editor'}),'/personal','user-round');
 check(await source('work-app/index.html'),'/work','briefcase-business');check(await source('work-expenses/index.html'),'/work','briefcase-business');
});
test('Settings inherits only a safe same-origin space and includes one overall-home destination',async()=>{
 for(const [path,expected]of [['/work/app/index.html','/work'],['/paper#review','/paper'],['/personal/travel','/personal'],['/resume',null],['https://outside.invalid/work',null],['//outside.invalid/paper',null]]){
  const w=new JSDOM(settingsPage(),{url:'https://fixture.invalid/settings?returnTo='+encodeURIComponent(path),runScripts:'outside-only'}).window;
  w.eval(await source('public/space-navigation.js'));const nav=w.document.querySelector('[data-space-navigation]');
  assert.equal(nav.querySelector('[data-space-parent]')?.getAttribute('href')||null,expected);assert.equal(nav.querySelectorAll('a[href="/"]').length,1);w.close();
 }
});
test('demos are served as built, without the site navigation bar',async()=>{
 const route=demoRoutes({authorize:async()=>null,rootDir:fileURLToPath(new URL('..',import.meta.url)),send:(res,status,body)=>{res.status=status;res.body=String(body);}});
 for(const name of ['ontology','document-parsing']){
  const res={};await route({method:'GET',headers:{}},res,new URL('https://fixture.invalid/work/demos/'+name+'/'));
  assert.equal(res.status,200);assert.equal(res.body,await source('work-demos/'+name+'/index.html'));assert.doesNotMatch(res.body,/space-navigation|demo-spacebar/);
 }
});
test('Resume does not receive the shared navigation code or stylesheet',async()=>{
 const html=await source('public/resume/index.html');assert.equal(html.includes('space-navigation'),false);
 const login=new JSDOM(loginPage({configured:false,next:'/'})).window.document;const nav=login.querySelector('[data-space-navigation]');assert.ok(nav);assert.equal(nav.querySelectorAll('a').length,1);
});
const statusText=html=>{const d=new JSDOM(html).window.document;return [...d.querySelectorAll('.space-status')].map(n=>n.textContent.trim());};
const paperLanding=async access=>{
 const w=new JSDOM(paperPage(access),{url:'https://fixture.invalid/paper',runScripts:'outside-only'}).window;
 w.PAPER_PREVIEW={projects:[],settings:{provider:'openai',models:{openai:'x'},keys:{openai:{configured:false}}},defaults:{}};
 w.scrollTo=()=>{};w.eval(await source('public/paper.js'));await new Promise(r=>setTimeout(r,25));
 const d=w.document,out={status:[...d.querySelectorAll('#paper-app .space-status')].map(n=>n.textContent.trim()),text:d.getElementById('paper-app').textContent,inHero:!!d.querySelector('.paper-welcome > div > .space-status')};w.close();return out;
};
test('Personal and Paper hubs show the same connection status as Selectstar',async()=>{
 const cases=[[{mode:'supabase',role:'editor'},'연결됨 · 편집 가능'],[{mode:'supabase',role:'reader'},'연결됨 · 읽기 전용'],[{mode:'local',role:'editor'},'로컬 개발 미리보기 · localhost 전용']];
 for(const [access,text] of cases){
  assert.deepEqual(statusText(workPage(access)),[text]);
  assert.deepEqual(statusText(personalPage(access)),[text]);
  const paper=await paperLanding(access);assert.deepEqual(paper.status,[text]);assert.ok(paper.inHero);
 }
 assert.deepEqual(statusText(personalPage(null)),[]);assert.deepEqual(statusText(personalPage()),[]);
 assert.deepEqual((await paperLanding(null)).status,[]);
});
test('Paper choice screen no longer shows the navigation hint',async()=>{
 const paper=await paperLanding({mode:'supabase',role:'editor'});
 assert.ok(paper.text.includes('논문 리뷰 준비'));assert.equal(paper.text.includes('작업을 선택하면 해당 화면으로 이동합니다.'),false);
 assert.equal((await source('public/paper.js')).includes('작업을 선택하면'),false);
});
