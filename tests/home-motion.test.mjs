import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {settingsPage} from '../views/settings.mjs';
import {homePage} from '../views/pages.mjs';
const source=await readFile(new URL('../public/theme.js',import.meta.url),'utf8');
function setup({reduced=false,saved}={}){
 const w=new JSDOM(settingsPage({authenticated:true,manageHome:true}),{url:'https://fixture.invalid/settings',runScripts:'outside-only'}).window;
 w.matchMedia=query=>({matches:query.includes('reduced-motion')&&reduced,addEventListener(){}});
 if(saved)w.localStorage.setItem('kyohoon-home-motion',saved);
 w.eval(source);return w;
}
test('home entrance respects OS motion settings and explains when reduced motion disables it',()=>{
 for(const reduced of [true,false]){const w=setup({reduced});try{assert.equal(w.document.documentElement.dataset.homeMotion,'system');assert.match(w.document.querySelector('#home-motion-status').textContent,reduced?/동작 줄이기/:/기기 설정에 따라 재생/);}finally{w.close();}}
});
test('explicit home motion choice persists across visits independently of the OS setting',()=>{
 const w=setup({reduced:true});try{const field=w.document.querySelector('[data-home-motion-select]');field.value='on';field.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(w.document.documentElement.dataset.homeMotion,'on');assert.equal(w.localStorage.getItem('kyohoon-home-motion'),'on');const second=setup({reduced:true,saved:w.localStorage.getItem('kyohoon-home-motion')});try{assert.equal(second.document.documentElement.dataset.homeMotion,'on');assert.equal(second.document.querySelector('[data-home-motion-select]').value,'on');}finally{second.close();}}finally{w.close();}
});
test('off and system choices propagate from another tab, and unknown stored choices fall back safely',()=>{
 const w=setup({saved:'unknown'});try{assert.equal(w.document.documentElement.dataset.homeMotion,'system');for(const value of ['off','system']){w.dispatchEvent(new w.StorageEvent('storage',{key:'kyohoon-home-motion',newValue:value}));assert.equal(w.document.documentElement.dataset.homeMotion,value);assert.equal(w.document.querySelector('[data-home-motion-select]').value,value);}}finally{w.close();}
});

test('readers use system motion even if this browser has an owner preference',()=>{
 const w=new JSDOM(settingsPage({authenticated:true}),{url:'https://fixture.invalid/settings',runScripts:'outside-only'}).window;
 try {
  w.localStorage.setItem('kyohoon-home-motion','on');
  w.eval(source);
  assert.equal(w.document.documentElement.dataset.homeMotion,'system');
  assert.equal(w.document.querySelector('[data-home-motion-select]'),null);
 } finally { w.close(); }
});

test('the weather bubble stays dismissed after a menu preview and a late forecast',async()=>{
 const w=new JSDOM(homePage(),{url:'https://fixture.invalid/',runScripts:'outside-only'}).window;
 try {
  let resolveWeather;
  w.fetch=()=>new Promise(resolve=>{resolveWeather=resolve;});
  w.Image.prototype.decode=async()=>{};
  w.eval(await readFile(new URL('../public/home.js',import.meta.url),'utf8'));

  const bubble=w.document.querySelector('[data-desk-forecast]');
  const menu=w.document.querySelector('.home-spaces');
  assert.equal(bubble.hidden,false);
  menu.querySelector('[data-pose]').dispatchEvent(new w.Event('pointerenter'));
  assert.equal(bubble.hidden,true);
  menu.dispatchEvent(new w.Event('pointerleave'));
  const date=w.document.querySelector('[data-desk-date]').dateTime;
  resolveWeather({ok:true,json:async()=>({date,city:'서울',condition:'맑음',temperature:12,message:'내일은 맑대요.'})});
  await new Promise(resolve=>setImmediate(resolve));

  assert.equal(w.document.querySelector('[data-desk-weather]').textContent,'서울 · 맑음 12°');
  assert.equal(bubble.hidden,true);
 } finally { w.close(); }
});
