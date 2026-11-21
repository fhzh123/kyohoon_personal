import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
 const route=demoRoutes({authorize:async()=>null,rootDir:new URL('..',import.meta.url).pathname,send:(res,status,body)=>{res.status=status;res.body=String(body);}});
 for(const name of ['ontology','document-parsing']){
  const res={};await route({method:'GET',headers:{}},res,new URL('https://fixture.invalid/work/demos/'+name+'/'));
  assert.equal(res.status,200);assert.equal(res.body,await source('work-demos/'+name+'/index.html'));assert.doesNotMatch(res.body,/space-navigation|demo-spacebar/);
 }
});
test('Resume does not receive the shared navigation code or stylesheet',async()=>{
 const html=await source('public/resume/index.html');assert.equal(html.includes('space-navigation'),false);
 const login=new JSDOM(loginPage({configured:false,next:'/'})).window.document;const nav=login.querySelector('[data-space-navigation]');assert.ok(nav);assert.equal(nav.querySelectorAll('a').length,1);
});
