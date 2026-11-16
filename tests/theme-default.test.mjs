import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const source=await readFile(new URL('../public/theme.js',import.meta.url),'utf8');
function browser(dark,saved){
 const w=new JSDOM('<button data-theme-value="system"></button><p id="appearance-status"></p>',{url:'https://test.invalid',runScripts:'outside-only'}).window;
 const system={matches:dark,addEventListener:(_,fn)=>system.change=fn};w.matchMedia=q=>q.includes('color-scheme')?system:{matches:false,addEventListener(){}};
 if(saved!==undefined)w.localStorage.setItem('kyohoon-appearance',saved);
 w.eval(source);return {w,system};
}
test('new visitors use the OS theme by default without recording a manual choice',()=>{
 for(const dark of [false,true]){const {w,system}=browser(dark);try{assert.equal(w.AtlasTheme.preference(),'system');assert.equal(w.AtlasTheme.get(),dark?'dark':'light');assert.equal(w.localStorage.getItem('kyohoon-appearance'),null);assert.equal(w.document.querySelector('button').getAttribute('aria-pressed'),'true');system.matches=!dark;system.change();assert.equal(w.AtlasTheme.get(),dark?'light':'dark');}finally{w.close();}}
});
test('explicit light or dark choices survive the new default and OS changes',()=>{
 for(const choice of ['light','dark']){const {w,system}=browser(false,choice);try{assert.equal(w.AtlasTheme.preference(),choice);assert.equal(w.AtlasTheme.get(),choice);system.matches=true;system.change();assert.equal(w.AtlasTheme.get(),choice);}finally{w.close();}}
});
test('invalid or cleared choices return to system mode instead of dark',()=>{
 const {w}=browser(false,'invalid');try{assert.equal(w.AtlasTheme.preference(),'system');w.AtlasTheme.set('dark');w.dispatchEvent(new w.StorageEvent('storage',{key:'kyohoon-appearance',newValue:null}));assert.equal(w.AtlasTheme.preference(),'system');assert.equal(w.AtlasTheme.get(),'light');}finally{w.close();}
});
