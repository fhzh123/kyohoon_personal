import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {gunzipSync} from 'node:zlib';
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {createHandler} from '../server/app.mjs';
import {safeLoginDestination} from '../server/policy.mjs';
import {demosPage} from '../views/pages.mjs';

const rootDir=fileURLToPath(new URL('../',import.meta.url));
const prefix='/work/demos/';
async function withServer(run){
 const handler=createHandler({rootDir,environment:{SUPABASE_URL:'https://auth.invalid',SUPABASE_ANON_KEY:'fixture'},fetcher:async url=>new Response(JSON.stringify(String(url).includes('/auth/v1/user')?{id:'member'}:[{user_id:'member',role:'reader'}]))});
 await run(async(url,{method='GET',headers={}}={})=>{
  const req=Object.assign(Readable.from([]),{url,method,headers:{host:'fixture.invalid','accept-encoding':'gzip',...headers},socket:{remoteAddress:'127.0.0.1'}});
  const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(status,headers){this.status=status;for(const[k,v]of Object.entries(headers))this.setHeader(k,v);},end(data){this.data=Buffer.from(data??'');}};
  await handler(req,res);
  const data=res.headers['content-encoding']==='gzip'&&res.data.length?gunzipSync(res.data):res.data;
  return new Response(data,{status:res.status,headers:res.headers});
 });
}
const headers={cookie:'kh_access=fixture'};
test('demo cards open both local copies and retain both original GPT Sites links',()=>{
 const html=demosPage();
 for(const slug of ['ontology','document-parsing'])assert.ok(html.includes('href="'+prefix+slug+'/"'));
 assert.equal((html.match(/class="demo-original link"/g)||[]).length,2);
 assert.equal((html.match(/\.chatgpt\.site\//g)||[]).length,2);
 assert.equal((html.match(/<article class="demo-entry">/g)||[]).length,2);
});
test('all local demo pages, data and images require membership and preserve login destinations',()=>withServer(async request=>{
 const image=(await readdir(path.join(rootDir,'work-demos/ontology/assets'))).find(x=>x.endsWith('.png'));
 for(const route of ['ontology/','document-parsing/','ontology/outputs/evaluation_results.html','ontology/outputs/hits5_case_analysis.html','ontology/assets/widget-data-00.js','ontology/assets/'+image]){
  const url=prefix+route;const response=await request(url);assert.equal(response.status,303,url);
  const login=new URL(response.headers.get('location'),'https://fixture.invalid');assert.equal(login.pathname,'/login');assert.equal(login.searchParams.get('next'),url);
 }
 for(const url of [prefix+'ontology/',prefix+'document-parsing/',prefix+'ontology/outputs/hits5_case_analysis.html#case-1'])assert.equal(safeLoginDestination(url),url);
 assert.equal(safeLoginDestination('//outside.invalid'),'/work');
 assert.equal(safeLoginDestination(prefix+'ontology/assets/widget-data-00.js'),'/work');
}));
test('authorized demos load nested reports and every local asset, with no oversized response',()=>withServer(async request=>{
 for(const slug of ['ontology','document-parsing']){
  const url=prefix+slug+'/';const response=await request(url,{headers});assert.equal(response.status,200);assert.equal(response.headers.get('content-encoding'),'gzip');
  const html=await response.text();assert.match(html,/<title>/);assert.ok(!html.includes('data:image/'));
  const refs=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]).filter(x=>x.startsWith(url)||x.startsWith('outputs/'));
  for(const ref of new Set(refs)){
   const assetUrl=new URL(ref,'http://local.invalid'+url).pathname;const asset=await request(assetUrl,{headers});assert.equal(asset.status,200,assetUrl);
   assert.match(asset.headers.get('cache-control'),/no-store/);assert.equal(asset.headers.get('x-content-type-options'),'nosniff');assert.ok((await asset.arrayBuffer()).byteLength<4_000_000,assetUrl);
  }
 }
 const canonical=await request(prefix+'ontology?view=1',{headers});assert.equal(canonical.status,308);assert.equal(canonical.headers.get('location'),prefix+'ontology/?view=1');
 const head=await request(prefix+'ontology/',{method:'HEAD',headers});assert.equal(head.status,200);assert.equal(await head.text(),'');
 const plain=await request(prefix+'ontology/',{headers:{...headers,'accept-encoding':'identity'}});assert.equal(plain.status,200);assert.equal(plain.headers.get('content-encoding'),null);
 for(const url of [prefix+'ontology/sources.json',prefix+'ontology/%2e%2e%2fsources.json','/work-demos/ontology/index.html','/work-demos/sources.json'])assert.equal((await request(url,{headers})).status,404,url);
 assert.equal((await request(prefix+'ontology/',{method:'POST',headers})).status,405);
}));
test('split ontology data reconstructs the original JSON byte for byte',async()=>{
 const html=await readFile(path.join(rootDir,'work-demos/ontology/index.html'),'utf8');
 const files=[...html.matchAll(/<script src="([^"]*widget-data-\d+\.js)"><\/script>/g)].map(m=>m[1]);assert.ok(files.length>1);
 const element={textContent:''};const context=vm.createContext({document:{getElementById:id=>{assert.equal(id,'widget-data');return element;}}});
 for(const file of files)vm.runInContext(await readFile(path.join(rootDir,'work-demos',file.slice(prefix.length)),'utf8'),context);
 const data=JSON.parse(element.textContent);assert.ok(data.cases.length>0);assert.ok(data.references);
 const snapshot=JSON.parse(await readFile(path.join(rootDir,'work-demos/sources.json'),'utf8'));
 assert.ok(snapshot.ontology.source_sha256['index.html']);
 assert.equal(createHash('sha256').update(element.textContent).digest('hex'),'a57097fd8539924b36c3dbd36007003d494e1c299ecf1b7ce4a2890b0af85012');
 async function checkSize(directory){for(const name of await readdir(directory)){const file=path.join(directory,name);const s=await stat(file);if(s.isDirectory())await checkSize(file);else assert.ok(s.size<4_000_000,file);}}
 await checkSize(path.join(rootDir,'work-demos'));
});
