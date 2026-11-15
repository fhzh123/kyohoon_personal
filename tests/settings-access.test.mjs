import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {settingsPage} from '../views/settings.mjs';
import {publicSettings,DEFAULT_PROMPTS} from '../server/paper-core.mjs';
import {validateBackgroundImage} from '../server/appearance-routes.mjs';
const source=f=>readFile(new URL('../public/'+f,import.meta.url),'utf8'),sleep=()=>new Promise(r=>setTimeout(r,25));
test('three settings menus isolate screen, background and LLM; anonymous gates show the mascot and preserve login destinations',async()=>{
 const w=new JSDOM(settingsPage(),{url:'https://test.invalid/settings?returnTo=%2Fpaper%23review#background',runScripts:'outside-only'}).window;let calls=0;w.fetch=()=>{calls++;throw Error('anonymous settings must not call private APIs');};
 try{w.eval(await source('settings.js'));w.eval(await source('appearance-settings.js'));await sleep();const d=w.document;
 assert.deepEqual([...d.querySelectorAll('[data-settings-tab]')].map(n=>n.dataset.settingsTab),['appearance','background','llm']);assert.equal(d.querySelector('#appearance').contains(d.querySelector('#background-controls')),false);assert.equal(d.querySelector('#appearance').hidden,true);assert.equal(d.querySelector('#background').hidden,false);assert.equal(d.querySelector('#llm').hidden,true);assert.equal(calls,0);
 for(const id of ['#background-controls','#llm-app']){const gate=d.querySelector(id);assert.ok(gate.querySelector('.settings-access img[src="/mascot/login-required.png"]'));assert.match(gate.textContent,/로그인 후/);assert.equal(gate.querySelector('input'),null);const login=new URL(gate.querySelector('[data-access-login]').href);assert.equal(login.searchParams.get('next'),'/settings?returnTo=%2Fpaper%23review#'+(id==='#llm-app'?'llm':'background'));}
 w.location.hash='#llm';w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.equal(d.querySelector('#llm').hidden,false);assert.equal(d.querySelector('#background').hidden,true);w.location.hash='#appearance';w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.equal(d.querySelector('#appearance').hidden,false);assert.equal(d.querySelectorAll('[data-theme-value]:disabled').length,0);
 }finally{w.close();}
});
test('authenticated controls survive menu changes and expired sessions use the same mascot gate in both panels',async()=>{
 for(const expired of [false,true]){const w=new JSDOM(settingsPage({authenticated:true}),{url:'https://test.invalid/settings#background',runScripts:'outside-only'}).window;
 w.fetch=async url=>expired?Response.json({error:'로그인 필요'},{status:401}):url==='/api/settings/llm'?Response.json({settings:publicSettings(null,{}),defaults:DEFAULT_PROMPTS,role:'editor'}):Response.json({config:{images:{light:null,dark:null},speed:40},urls:{light:null,dark:null},revision:null,role:'editor'});
 try{w.eval(await source('settings.js'));w.eval(await source('appearance-settings.js'));await sleep();const d=w.document;
 if(expired){assert.equal(d.querySelectorAll('#background-controls .settings-access img,#llm-app .settings-access img').length,2);assert.equal(d.querySelector('#background-controls input'),null);assert.equal(d.querySelector('#llm-app input'),null);}
 else{assert.equal(d.querySelectorAll('[data-bg-file]').length,2);assert.equal(d.querySelectorAll('input[type=password]').length,3);assert.match(d.querySelector('#background-controls').textContent,/15 MB/);assert.equal(d.querySelector('#llm-app .settings-access'),null);d.querySelector('#model-openai').value='custom-model';w.location.hash='#llm';w.dispatchEvent(new w.HashChangeEvent('hashchange'));assert.equal(d.querySelector('#model-openai').value,'custom-model');assert.equal(d.querySelector('#llm').hidden,false);}
 }finally{w.close();}}
});
test('background images allow the full 15MB while rejecting a byte above the cap and invalid formats',()=>{
 const bytes=Buffer.alloc(15000000);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);assert.equal(validateBackgroundImage(bytes,'image/png'),true);assert.throws(()=>validateBackgroundImage(Buffer.alloc(15000001),'image/png'),/15 MB/);assert.throws(()=>validateBackgroundImage(Buffer.from('not an image at all'),'image/png'),/일치/);
});
