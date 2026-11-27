import {existsSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {homePage,workPage,demosPage,personalPage} from '../views/pages.mjs';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('four home destinations preserve existing poses; tools use unique illustrations',()=>{
 const d=new JSDOM(homePage()).window.document;
 assert.deepEqual([...d.querySelectorAll('a.portal')].map(a=>a.getAttribute('href')),['/resume','/work','/paper','/personal']);
 const poses=[...d.querySelectorAll('a.portal')].map(a=>a.dataset.pose);assert.equal(new Set(poses).size,4,'each space has its own mascot pose');
 for(const pose of poses)assert.ok(existsSync(new URL('../public'+pose,import.meta.url)),pose);
 assert.ok(!poses.includes(d.querySelector('[data-default-pose]').getAttribute('src')),'the resting pose differs from every space pose');
 const hub=new JSDOM(workPage({mode:'supabase',role:'editor'})).window.document;
 assert.deepEqual([...hub.querySelectorAll('a.tool-card')].map(a=>a.getAttribute('href')),['/work/app/index.html','/work/team-resources','/work/demos','/work/expenses/']);
 assert.equal(new Set([...hub.querySelectorAll('.space-card-art')].map(x=>x.src)).size,4);
 assert.equal(new JSDOM(demosPage()).window.document.querySelectorAll('main a[target="_blank"][rel="noopener noreferrer"]').length,4);
 const personal=new JSDOM(personalPage()).window.document;assert.equal(personal.querySelectorAll('.personal-tools .tool-card').length,3);assert.equal(personal.querySelectorAll('.personal-tools .is-pending').length,0);assert.equal(personal.querySelector('.personal-tools a').getAttribute('href'),'/personal/travel');
});
test('same-page brand navigation never activates loader, actual document navigation does',async()=>{
 const w=new JSDOM('<div class="app-shell"></div><a id="brand" href="#roadmap">Atlas</a><a id="open" href="/work/app/index.html?reload=1">Open</a>',{url:'https://fixture.invalid/work/app/index.html',runScripts:'outside-only'}).window;
 w.eval(await source('public/loading.js'));w.document.addEventListener('click',e=>e.preventDefault());
 w.document.querySelector('#brand').click();assert.equal(w.document.querySelector('#research-loading'),null);
 w.document.querySelector('#open').click();assert.equal(w.document.querySelector('#research-loading').hidden,false);
 w.ResearchAtlas={};w.dispatchEvent(new w.Event('hashchange'));assert.equal(w.document.querySelector('#research-loading').hidden,true);assert.equal(w.document.querySelector('.app-shell').hasAttribute('inert'),false);w.close();
});
test('system appearance tracks OS changes and manual override persists',async()=>{
 const w=new JSDOM('<button data-theme-value="system"></button><p id="appearance-status"></p>',{url:'https://fixture.invalid',runScripts:'outside-only'}).window;
 const media={matches:false,addEventListener:(_,f)=>media.changed=f};w.matchMedia=()=>media;
 w.eval(await source('public/theme.js'));w.document.querySelector('button').click();assert.equal(w.document.documentElement.dataset.theme,'light');
 media.matches=true;media.changed();assert.equal(w.document.documentElement.dataset.theme,'dark');
 w.AtlasTheme.set('light');media.changed();assert.equal(w.AtlasTheme.get(),'light');assert.equal(w.localStorage.getItem('kyohoon-appearance'),'light');w.close();
});
