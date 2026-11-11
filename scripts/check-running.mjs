import { spawn } from 'node:child_process';
import { mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='http://127.0.0.1:3000';const results={};
for(const route of ['/','/resume','/work']){const r=await fetch(base+route);assert.equal(r.status,200);results[route]=r.status;}
const entry=await fetch(base+'/work/preview',{redirect:'manual'});assert.equal(entry.status,303);assert.equal(entry.headers.get('location'),'/work');
const cookie=entry.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
const hub=await fetch(base+'/work',{headers:{cookie}});assert.equal(hub.status,200);const text=await hub.text();assert.ok(text.includes('Ontology 연구 데모'));assert.equal((text.match(/class="tool-card is-pending"/g)||[]).length,4);
const diary=await fetch(base+'/work/app/index.html',{headers:{cookie}});assert.equal(diary.status,200);
const bootstrap=await fetch(base+'/api/work-bootstrap',{headers:{cookie}});assert.equal(bootstrap.status,200);const state=await bootstrap.json();assert.equal(state.context.mode,'local');assert.equal(state.workspace.state.tasks.length,36);
const attachment=await fetch(base+'/work/app/assets/roadmap.png',{headers:{cookie}});assert.equal(attachment.status,200);
assert.equal((await fetch(base+'/api/work-bootstrap')).status,401);
results.localHub='200; 3 active, 4 disabled';results.localDiary='200';results.actualState='local source copy loaded, 36 tasks';results.attachment=200;results.anonymousApi=401;
const child=spawn(process.execPath,['server/start.mjs','--dev'],{cwd:root,env:{...process.env,PORT:'3001',LOCAL_WORK_PREVIEW:'1'},stdio:['ignore','pipe','pipe']});
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('production startup timed out')),10000);child.once('error',reject);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});});
  assert.equal((await fetch('http://127.0.0.1:3001/work/preview')).status,404);
  const closed=await fetch('http://127.0.0.1:3001/work');assert.equal(closed.status,200);assert.ok(!(await closed.text()).includes('href="/work/preview"'));
  assert.equal((await fetch('http://127.0.0.1:3001/api/work-bootstrap')).status,401);
  results.productionCli='preview404; anonymous API401; --dev flag ignored';
} finally {child.kill();}
await mkdir(path.join(root,'artifacts'),{recursive:true});
await writeFile(path.join(root,'artifacts/running-check.json'),JSON.stringify({checkedAt:new Date().toISOString(),...results},null,2));
console.log('Live HTTP passed: 3 direct routes, local hub/diary/real-data/attachment, anonymous block, production CLI preview block.');
