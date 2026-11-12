import test from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import {Readable} from 'node:stream';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHandler} from '../server/app.mjs';
import {parseLedger,validateConfig} from '../server/card-ledger.mjs';
import {approvalNumber,approvalsIn,reportFor,budgetFor,monthStatus,recurringFor,classify} from '../work-expenses/core.js';
import {JSDOM,VirtualConsole} from 'jsdom';

const headers=['번호','사용일자','사용시간','카드번호','승인번호','이용금액(원)','부가세(원)','내부 사용자','메모','필수 정보','제출 및 승인상태','가맹점명','용도'];
function workbook(rows){const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['조회연월','199901'],[],headers,...rows]),'ExpenseData');return XLSX.write(book,{type:'buffer',bookType:'xlsx',compression:true});}
const row=(id,date,amount,memo='구독',required='2026-999',status='승인')=>[id,date,'120000','0000000000001234','approval-'+id,amount,0,'테스트사용자',memo,required,status,'OPENAI','연구'];
const bytes=()=>workbook([row('1','20260102',1000),row('2','20260103',2000,'API','2026-999','승인 대기'),row('3','20260104',300,'구독','2026-999','반려'),row('4','20260105',-100,'환불','2026-999','취소')]);
const options={fileName:'1234_01월_사용내역.xlsx',year:2026,month:1,asOf:'2026-02-01',complete:true};
const parse=()=>parseLedger(bytes(),options);
test('xlsx parser uses transaction dates and named headers, preserves source rows and masks card numbers',()=>{
  const m=parse();assert.equal(m.rows.length,4);assert.equal(m.card_last4,'1234');assert.equal(m.rows[0].sourceRow,4);assert.equal(m.rows[0].date,'2026-01-02');assert.equal(m.rows[0].service,'ChatGPT / OpenAI');assert.equal(m.rows[0].approvals[0],'2026-999');assert.ok(!JSON.stringify(m.rows).includes('0000000000001234'));assert.equal(m.file_base64,bytes().toString('base64'));
});
test('bad amounts, wrong month, premature completion, corrupt or non-xlsx uploads fail without dropping rows',()=>{
  assert.throws(()=>parseLedger(workbook([row('1','20260102','?')]),options),/4행/);
  assert.throws(()=>parseLedger(bytes(),{...options,month:2,asOf:'2026-03-01'}),/이외의 거래/);
  assert.throws(()=>parseLedger(bytes(),{...options,asOf:'2026-01-10'}),/월 마감/);
  assert.throws(()=>parseLedger(Buffer.from('bad'),options),/xlsx/);
  assert.throws(()=>parseLedger(bytes(),{...options,fileName:'sheet.xls'}),/xlsx/);
  assert.throws(()=>parseLedger(bytes(),{...options,asOf:'2026-02-30'}),/날짜/);
});
test('duplicate transactions in the same workbook are excluded once, different cards are rejected',()=>{
  const r=row('1','20260102',1000),m=parseLedger(workbook([r,r]),options);assert.equal(m.rows.length,1);assert.match(m.warnings[0],/1건/);
  const other=[...r];other[3]='0000000000005678';assert.throws(()=>parseLedger(workbook([r,other]),options),/여러 카드/);
});
test('approval matching respects whole numbers and accepts Korean prefixes',()=>{
  assert.equal(approvalNumber('품의번호 2026-0785'),'2026-785');assert.equal(approvalNumber('2026-785 trailing'),'');
  assert.deepEqual(approvalsIn('품의 2026-785 / 2026-7850 / 2026-785'),['2026-785','2026-7850']);
  const m=parseLedger(workbook([row('1','20260102',1000,'"2026-02 팀 구독" 품의에 따른 구독','2026-786')]),options);assert.deepEqual(m.rows[0].approvals,['2026-786']);
});
test('report includes pending, excludes rejected positive entries, subtracts refunds and deduplicates across files',()=>{
  const m=parse(),r=reportFor([m,{...m,id:'other',uploaded_at:'2020-01-01'}],'2026-999');
  assert.equal(r.total,2900);assert.equal(r.count,3);assert.equal(r.pending,1900);assert.equal(r.duplicates,4);assert.equal(reportFor([m],'2026-999',{includePending:false}).total,1000);
});
test('partial-month spending is excluded from averages and month freshness distinguishes missing and future files',()=>{
  const m=parse();assert.equal(reportFor([{...m,complete:false}],'2026-999').average,null);
  assert.equal(monthStatus(null,2026,11,'2026-11-12').kind,'missing');assert.equal(monthStatus(null,2026,12,'2026-11-12').kind,'future');
  const status=monthStatus({...m,complete:false,as_of:'2026-11-03'},2026,11,'2026-11-12');assert.equal(status.kind,'stale');assert.match(status.note,/9일/);
});
test('USD budget uses entered FX, changes balances immediately and handles overspending',()=>{
  const b=budgetFor(2000,{amount:3,currency:'USD'},1000);assert.equal(b.remaining,1);assert.ok(Math.abs(b.percent-200/3)<1e-10);assert.equal(budgetFor(2000,{amount:3,currency:'USD'},500).remaining,-1);assert.equal(budgetFor(1,{amount:1,currency:'USD'},0),null);assert.equal(budgetFor(20,{amount:100,currency:'KRW'},1).remaining,80);
});
test('recurring estimate uses complete months, active users and explicit overrides',()=>{
  const m=parse(),config={activeUsers:'테스트사용자'};let r=recurringFor([m],'2026-999',config);assert.equal(r.base,'2026-01');assert.equal(r.total,1000);
  config.recurring={[r.included[0].key]:false};assert.equal(recurringFor([m],'2026-999',config).total,0);
  assert.equal(recurringFor([{...m,complete:false}],'2026-999',{activeUsers:'테스트사용자'}).total,0);
});
test('service grouping merges merchant variations and settings reject invalid currencies and FX',()=>{
  assert.equal(classify('LINK.COM* OPENROUTER',''),'OpenRouter');assert.equal(classify('OPENROUTER, INC',''),'OpenRouter');assert.equal(classify('구글클라우드코리아',''),'Gemini / Google Cloud');
  assert.throws(()=>validateConfig({budgets:{'2026-999':{amount:1,currency:'USD',fx:0}}}),/환율/);
  assert.throws(()=>validateConfig({recurring:{abc:'yes'}}),/형식/);
});

async function request(handler,url,{method='GET',headers={},body}={}){
  const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]);Object.assign(req,{url,method,headers:{host:'localhost:3000',...headers},socket:{remoteAddress:'127.0.0.1'}});
  const res={status:0,headers:{},data:null,setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(s,h){this.status=s;for(const[k,v]of Object.entries(h))this.setHeader(k,v);},end(data){this.data=data;}};await handler(req,res);return res;
}
async function context(){
  const rootDir=await mkdtemp(path.join(os.tmpdir(),'card-ledger-test-'));await mkdir(path.join(rootDir,'private/work'),{recursive:true});await writeFile(path.join(rootDir,'private/work/workspace-state.json'),'{}');await mkdir(path.join(rootDir,'work-expenses'));await writeFile(path.join(rootDir,'work-expenses/index.html'),'<title>synthetic expenses</title>');
  const handler=createHandler({rootDir,localPreview:true,environment:{NODE_ENV:'development'}}),preview=await request(handler,'/work/preview');return {handler,rootDir,headers:{cookie:preview.headers['set-cookie'].split(';')[0]}};
}
const payload=()=>({fileName:options.fileName,fileBase64:bytes().toString('base64'),year:2026,month:1,asOf:options.asOf,complete:true,expectedRevision:null});
test('unauthenticated users cannot read page, modules, reports, originals or upload previews',async()=>{
  const {handler}=await context();for(const url of ['/work/expenses/','/work/expenses/app.js','/api/card-ledger?year=2026','/api/card-ledger/file?id=2026-01-1234','/api/card-ledger/inspect']){const r=await request(handler,url);assert.equal(r.status,401);assert.match(r.headers['cache-control'],/no-store/);}
});
test('local upload preview is read-only; persistence and replacement are atomic with revision conflicts',async()=>{
  const {handler,headers}=await context();const input=payload();
  let r=await request(handler,'/api/card-ledger/inspect',{method:'POST',headers,body:input});assert.equal(r.status,200);assert.equal(JSON.parse(r.data).count,4);
  assert.equal(JSON.parse((await request(handler,'/api/card-ledger?year=2026',{headers})).data).months.length,0);
  r=await request(handler,'/api/card-ledger/upload',{method:'POST',headers,body:input});assert.equal(r.status,200);const saved=JSON.parse(r.data).month;assert.equal(saved.file_base64,undefined);
  assert.equal((await request(handler,'/api/card-ledger/upload',{method:'POST',headers,body:input})).status,409);
  input.expectedRevision=saved.revision;r=await request(handler,'/api/card-ledger/upload',{method:'POST',headers,body:input});assert.equal(r.status,200);
  const manifest=JSON.parse((await request(handler,'/api/card-ledger?year=2026',{headers})).data);assert.equal(manifest.months.length,1);assert.equal(manifest.months[0].rows.length,4);assert.equal(manifest.months[0].file_base64,undefined);
  const original=await request(handler,'/api/card-ledger/file?id=2026-01-1234',{headers});assert.equal(original.status,200);assert.deepEqual(original.data,bytes());
});
test('invalid replacement leaves old month intact and cross-origin uploads are rejected',async()=>{
  const {handler,headers}=await context(),input=payload();const saved=JSON.parse((await request(handler,'/api/card-ledger/upload',{method:'POST',headers,body:input})).data).month;
  const bad={...input,expectedRevision:saved.revision,fileBase64:Buffer.from('bad').toString('base64')};assert.equal((await request(handler,'/api/card-ledger/upload',{method:'POST',headers,body:bad})).status,400);
  assert.equal(JSON.parse((await request(handler,'/api/card-ledger?year=2026',{headers})).data).months[0].revision,saved.revision);
  assert.equal((await request(handler,'/api/card-ledger/upload',{method:'POST',headers:{...headers,origin:'https://example.invalid'},body:input})).status,403);
});
test('settings persist with revisions and a reader cannot mutate settings or upload files',async()=>{
  const {handler,headers}=await context(),config={budgets:{'2026-999':{amount:100,currency:'USD',fx:1000}},recurring:{},activeUsers:'テスト'};
  assert.equal((await request(handler,'/api/card-ledger/settings',{method:'PUT',headers,body:{config,expectedRevision:null}})).status,200);
  assert.equal((await request(handler,'/api/card-ledger/settings',{method:'PUT',headers,body:{config,expectedRevision:null}})).status,409);
  const fetcher=async url=>new Response(JSON.stringify(url.endsWith('/auth/v1/user')?{id:'reader'}:url.includes('workspace_members')?[{user_id:'reader',role:'reader'}]:[]),{status:200});
  const remote=createHandler({environment:{SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'fixture'},fetcher});
  for(const [url,method]of [['/api/card-ledger/inspect','POST'],['/api/card-ledger/upload','POST'],['/api/card-ledger/settings','PUT']])assert.equal((await request(remote,url,{method,headers:{cookie:'kh_access=fixture'},body:{}})).status,403);
});
test('Selectstar retains approval expenses',async()=>{
  const {handler,headers}=await context();const r=await request(handler,'/work',{headers});assert.equal(r.status,200);assert.match(r.data,/href="\/work\/expenses\/"/);assert.match(r.data,/3개의 도구/);assert.match(r.data,/href="\/work\/demos"/);
});

async function ui(role='editor'){
  const root=new URL('../',import.meta.url),html=await readFile(new URL('work-expenses/index.html',root),'utf8'),core=await readFile(new URL('work-expenses/core.js',root),'utf8'),app=await readFile(new URL('work-expenses/app.js',root),'utf8');
  const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(html,{url:'https://fixture.invalid/work/expenses/?year=2026&approval=2026-999',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
  const w=dom.window,m=parse();let config={budgets:{'2026-999':{amount:100,currency:'USD',fx:1000}},recurring:{},activeUsers:'테스트사용자'},revision='config-1';
  w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=()=>{};w.fetch=async(url,options={})=>{
    if(String(url).startsWith('/api/card-ledger?'))return {ok:true,json:async()=>({months:[m],settings:{config,revision},role})};
    if(url==='/api/card-ledger/settings'){const input=JSON.parse(options.body);config=input.config;revision='config-2';return{ok:true,json:async()=>({settings:{config,revision}})};}
    throw Error('unexpected fixture API request');
  };
  w.eval('(function(){'+core.replaceAll('export ','')+'\n'+app.replace(/^import[^;]+;/,'')+'\nwindow.__fixture={state,renderReport,stageFiles};})()');
  await new Promise(resolve=>setTimeout(resolve,10));return {dom,w,d:w.document,errors,settings:()=>config};
}
test('expense UI renders exact totals, responsive month cards, search filters and live FX without stored HTML execution',async()=>{
  const {dom,w,d,errors}=await ui();assert.equal(d.querySelectorAll('.month-card').length,12);assert.match(d.querySelector('#report-content').textContent,/2,900원/);
  d.querySelector('#filter-text').value='API';d.querySelector('#filter-text').dispatchEvent(new w.Event('input'));assert.match(d.querySelector('#filtered-total').textContent,/1건 \/ 2,000원/);
  d.querySelector('#budget-fx').value='500';d.querySelector('#budget-fx').dispatchEvent(new w.Event('input',{bubbles:true}));assert.match(d.querySelector('#budget-results').textContent,/\$94\.20/);
  d.querySelector('[data-tab="files"]').click();assert.equal(d.querySelector('#files-view').hidden,false);assert.equal(d.querySelector('#report-view').hidden,true);
  assert.deepEqual(errors,[]);dom.window.close();
});
test('expense UI saves shared budget settings and readers retain usable viewing filters without write controls',async()=>{
  const edit=await ui();edit.d.querySelector('#budget-amount').value='200';const event=new edit.w.Event('submit',{bubbles:true,cancelable:true});Object.defineProperty(event,'submitter',{value:edit.d.querySelector('#budget-form button')});edit.d.querySelector('#budget-form').dispatchEvent(event);await new Promise(r=>setTimeout(r,10));assert.equal(edit.settings().budgets['2026-999'].amount,200);assert.match(edit.d.querySelector('#budget-save-state').textContent,/저장했습니다/);edit.dom.window.close();
  const read=await ui('reader');assert.equal(read.d.querySelector('#upload-label').hidden,true);assert.equal(read.d.querySelector('#budget-amount').readOnly,true);assert.equal(read.d.querySelector('#budget-form button'),null);assert.equal(read.d.querySelector('#filter-text').disabled,false);assert.equal(read.d.querySelector('#fixed-form button'),null);assert.deepEqual(read.errors,[]);read.dom.window.close();
});
