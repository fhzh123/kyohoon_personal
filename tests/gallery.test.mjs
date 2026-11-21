import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {JSDOM} from 'jsdom';
import {galleryPage} from '../views/gallery.mjs';
import {personalPage} from '../views/pages.mjs';
import {createHandler} from '../server/app.mjs';

const source=await readFile(new URL('../public/gallery/gallery.js',import.meta.url),'utf8');
const html=galleryPage();
const catalog=JSON.parse(new JSDOM(html).window.document.querySelector('#gallery-data').textContent);

function fixture(saved=[]){
 const w=new JSDOM(html,{url:'https://fixture.invalid/personal/gallery',runScripts:'outside-only'}).window;
 w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};w.TextEncoder=TextEncoder;w.Blob=Blob;
 w.fetch=async url=>new Response(await readFile(new URL('../public'+url,import.meta.url)));
 w.localStorage.setItem('kyohoon-gallery-favorites-v1',JSON.stringify(saved));
 w.URL.createObjectURL=blob=>{w.savedBlob=blob;return 'blob:fixture';};w.URL.revokeObjectURL=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){w.savedFilename=this.download;};
 w.eval(source);return w;
}

test('gallery is public, has both home destinations and uses the common settings link',async()=>{
 const handler=createHandler({environment:{NODE_ENV:'production'}});
 for(const [method,status]of [['GET',200],['HEAD',200],['POST',405]]){
  const req=Readable.from([]);Object.assign(req,{url:'/personal/gallery',method,headers:{host:'fixture.invalid',origin:'http://fixture.invalid'},socket:{}});
  const res={setHeader(){},writeHead(status,headers){this.status=status;this.headers=headers;},end(value){this.value=value;}};
  await handler(req,res);assert.equal(res.status,status);if(method==='HEAD')assert.equal(res.value,'');
 }
 const d=new JSDOM(html).window.document;
 assert.equal(d.querySelector('[data-space-parent]').getAttribute('href'),'/personal');
 assert.ok(d.querySelector('[data-space-navigation] a[href="/"]'));
 assert.ok(d.querySelector('[data-global-settings]'));assert.equal(d.querySelector('.preview-badge'),null);
 const personal=new JSDOM(personalPage()).window.document;
 assert.equal(personal.querySelectorAll('.tool-card')[1].getAttribute('href'),'/personal/gallery');
 assert.match(personal.querySelectorAll('.tool-card')[1].getAttribute('aria-label'),/갤러리 보기/);
});

test('all 77 items and 78 original assets are present with exact bytes and hashes',async()=>{
 assert.equal(catalog.items.length,77);assert.equal(Object.keys(catalog.assets).length,78);
 assert.ok(Buffer.byteLength(html)<50000);assert.ok(!html.includes('data:image/'));
 for(const asset of Object.values(catalog.assets)){
  assert.match(asset.src,/^\/(mascot|gallery\/assets)\/[\w.-]+$/);
  const bytes=await readFile(new URL('../public'+asset.src,import.meta.url));
  assert.equal(bytes.length,asset.bytes,asset.name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.name);
 }
});

test('search, favorites and saved browser state produce the expected visible collection',()=>{
 const w=fixture();try{
  const d=w.document;assert.equal(d.querySelector('#total-count').textContent,'77');
  d.querySelector('#favorite-current').click();assert.equal(d.querySelector('#favorite-count').textContent,'1');
  const saved=JSON.parse(w.localStorage.getItem('kyohoon-gallery-favorites-v1'));assert.equal(saved.length,1);
  d.querySelector('[data-view="favorites"]').click();assert.equal(d.querySelectorAll('.art-card').length,1);
  const search=d.querySelector('#search-images');search.value='not-a-real-mascot';search.dispatchEvent(new w.Event('input'));
  assert.equal(d.querySelectorAll('.art-card').length,0);assert.ok(d.querySelector('.empty'));
  const restored=fixture(saved);try{assert.equal(restored.document.querySelector('#favorite-count').textContent,'1');}finally{restored.close();}
 }finally{w.close();}
});

test('eight directions, walking frames and image selection remain consistent',()=>{
 const w=fixture();try{
  const d=w.document;d.querySelector('[data-view="rotate"]').click();
  assert.equal(d.querySelectorAll('[data-direction]').length,8);
  d.querySelector('[data-direction="right"]').click();assert.equal(w.MascotGallery.getState().direction,'right');
  assert.equal(d.querySelector('#stage-image').getAttribute('src'),catalog.assets[catalog.frames.right.idle].src);
  d.querySelector('[data-view="walk"]').click();d.querySelector('#step-frame').click();
  assert.equal(w.MascotGallery.getState().frame,1);
  assert.equal(d.querySelector('#stage-image').getAttribute('src'),catalog.assets[catalog.frames.right.walk[1]].src);
  d.querySelector('[data-group="poses"]').click();d.querySelector('[data-open="down-walk-01"]').click();assert.equal(w.MascotGallery.getState().view,'all');
  assert.equal(d.querySelector('#stage-image').getAttribute('src'),catalog.assets['down-walk-01'].src);
 }finally{w.close();}
});

test('original download bytes and favorite ZIP preserve filenames and data',async()=>{
 const w=fixture();try{
  const item=catalog.items[0],asset=catalog.assets[item.download];
  const bytes=await w.MascotGallery.bytesOf(item.download);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  w.document.querySelector('#favorite-current').click();await w.document.querySelector('#download-favorites').onclick();
  assert.equal(w.savedFilename,'mascot-favorites.zip');
  const zip=Buffer.from(await w.savedBlob.arrayBuffer());assert.equal(zip.readUInt32LE(0),0x04034b50);
  const length=zip.readUInt16LE(26);assert.equal(zip.subarray(30,30+length).toString(),'01-'+asset.name);
  assert.equal(createHash('sha256').update(zip.subarray(30+length,30+length+asset.bytes)).digest('hex'),asset.sha256);
  assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
 }finally{w.close();}
});
