import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {toInstant,fixedOffsetMinutes} from '../server/deadlines/time.mjs';
import {CONFERENCES,ORGANIZERS,KINDS} from '../server/deadlines/catalog.mjs';
import {build} from '../scripts/deadlines-sync.mjs';

const fixtures=new URL('./fixtures/deadlines/',import.meta.url).pathname;

test('deadline times written in AoE, UTC offsets and IANA zones become one exact moment',()=>{
  assert.equal(toInstant('2026-12-04 23:59','AoE'),'2026-12-05T11:59:00.000Z');
  assert.equal(toInstant('2026-12-04 23:59:59','UTC-12'),'2026-12-05T11:59:59.000Z');
  assert.equal(toInstant('2026-01-29 11:59:59','UTC+0'),'2026-01-29T11:59:59.000Z');
  assert.equal(toInstant('2026-10-01 12:00','GMT+02'),'2026-10-01T10:00:00.000Z');
  assert.equal(toInstant('2026-12-17','AoE'),'2026-12-18T11:59:59.000Z','a date with no time means the end of that day');
  // Pacific time is UTC-7 in July and UTC-8 in December.
  assert.equal(toInstant('2026-07-01 23:59:59','America/Los_Angeles'),'2026-07-02T06:59:59.000Z');
  assert.equal(toInstant('2026-12-01 23:59:59','America/Los_Angeles'),'2026-12-02T07:59:59.000Z');
  assert.equal(toInstant('TBD','AoE'),null);
  assert.equal(toInstant('2026-02-30','AoE'),null);
  assert.equal(toInstant('2026-02-01','Mars/Olympus'),null);
  assert.equal(fixedOffsetMinutes('UTC-8'),-480);
  assert.equal(fixedOffsetMinutes('UTC+5:30'),330);
});

test('a hand-checked edition wins over the datasets, keeps their disagreement visible and takes their dates for its TBA rows',async()=>{
  const data=await build({local:fixtures,now:new Date('2026-11-01T00:00:00Z'),manualPath:fixtures+'manual.json'});
  const conf=id=>data.conferences.find(c=>c.id===id);
  const pakdd=conf('pakdd').editions.find(e=>e.year===2027);
  assert.equal(pakdd.deadlines.length,1);
  assert.equal(pakdd.deadlines[0].date,'2026-12-04 23:59');
  assert.equal(pakdd.deadlines[0].checked,'2026-11-28');
  assert.equal(pakdd.deadlines[0].disagreement.date,'2026-11-20 23:59:59');
  const acl=conf('acl').editions.find(e=>e.year===2027);
  const commitment=acl.deadlines.find(d=>d.kind==='commitment');
  assert.equal(commitment.date,'2027-03-20 23:59:59');
  assert.match(commitment.filledFrom,/ccf-deadlines/);
  assert.equal(acl.deadlines.filter(d=>d.kind==='submission').length,1,'the dataset copy of a checked date is not repeated');
  // ccfddl rows that name the wrong year are filed under the year in their dates.
  const emnlp=conf('emnlp').editions.find(e=>e.year===2027);
  assert.ok(emnlp,'EMNLP 2027 comes from its date text, not year: 2021');
  assert.deepEqual(emnlp.deadlines.map(d=>d.kind),['abstract','submission','notification','camera_ready','submission']);
  assert.equal(emnlp.deadlines.at(-1).at,null,'a TBD row stays as TBA');
  assert.equal(emnlp.deadlines.find(d=>d.kind==='camera_ready').at,'2027-09-01T19:00:00.000Z');
  assert.ok(!emnlp.deadlines.some(d=>/registration/i.test(d.label)),'kinds outside the list are left out');
});

test('the shipped data covers every conference, names its sources and only holds readable moments',async()=>{
  const data=JSON.parse(await readFile(new URL('../server/deadlines/deadlines.json',import.meta.url),'utf8'));
  assert.deepEqual(data.conferences.map(c=>c.id),CONFERENCES.map(c=>c.id));
  assert.ok(!Number.isNaN(Date.parse(data.generatedAt)));
  for(const c of data.conferences){
    assert.ok(ORGANIZERS[c.organizer],c.id+' has an organizer');
    for(const e of c.editions)for(const d of e.deadlines){
      assert.ok(KINDS.includes(d.kind),c.id+' '+d.kind);
      assert.match(d.source,/^https:\/\//);
      if(d.at)assert.equal(toInstant(d.date,d.timezone),d.at,c.id+' '+e.year+' '+d.label);
      else assert.equal(d.date,null);
    }
  }
  for(const o of Object.values(ORGANIZERS))if(o.logo)await readFile(new URL('../public'+o.logo,import.meta.url));
});

test('the deadline screen counts down in KST, shows the announced time and filters by field and deadline kind',async()=>{
  const now=Date.parse('2026-11-28T15:00:00Z');// 2026-11-29 00:00 KST
  const at=toInstant('2026-12-04 23:59','AoE');// 2026-12-05 20:59 KST
  const conf=(id,name,cat,deadlines)=>({id,name,full:name,categories:[cat],organizer:'acl',editions:[{year:2027,link:'https://example.org/',dates:'May 2027',place:'Seoul',checked:'2026-11-28',sources:['https://example.org/'],deadlines}]});
  const row=(kind,label,date,extra={})=>({kind,label,date,timezone:'AoE',at:date?toInstant(date,'AoE'):null,dateOnly:false,note:'',source:'https://example.org/',...extra});
  const fixture={generatedAt:'2026-11-26T00:00:00.000Z',sources:[{name:'ccfddl/ccf-deadlines',url:'https://github.com/ccfddl/ccf-deadlines'}],
    categories:[{id:'nlp',name:'NLP',full:'NLP'},{id:'cv',name:'CV',full:'CV'}],organizers:ORGANIZERS,kinds:KINDS,
    conferences:[
      conf('a','ALPHA','nlp',[row('submission','Paper submission','2026-12-04 23:59',{note:'11월 20일에서 연장됨'}),row('notification','Notification','2027-02-10',{dateOnly:true})]),
      conf('b','BETA','cv',[row('rebuttal','Rebuttal','2027-01-20 23:59'),row('camera_ready','Camera-ready',null)]),
      conf('c','GAMMA','nlp',[row('submission','Paper submission','2026-05-01 23:59')])
    ]};
  const w=new JSDOM('<!doctype html><main class="paper-main"><div id="app"></div></main>',{url:'https://fixture.invalid/paper#deadlines',runScripts:'outside-only'}).window;
  w.Date.now=()=>now;w.PAPER_DEADLINES=fixture;
  w.eval(await readFile(new URL('../public/paper-deadlines.js',import.meta.url),'utf8'));
  const app=w.document.querySelector('#app');
  await w.PaperDeadlines.render(app);
  const cards=()=>[...app.querySelectorAll('.dl-card h2')].map(h=>h.textContent);
  assert.deepEqual(cards(),['ALPHA 2027','BETA 2027'],'nearest deadline first; GAMMA has none left');
  const first=app.querySelector('.dl-card');
  assert.match(first.querySelector('.dl-when strong').textContent,/12월 5일 \(토\) 20:59/);
  assert.match(first.querySelector('.dl-when span').textContent,/Dec 4, 2026 23:59 AoE/);
  assert.equal(first.querySelector('.dl-left b').textContent,'6일 20시간');
  assert.equal(first.querySelector('.dl-left span').textContent,'D-6');
  assert.equal(first.dataset.urgency,'soon');
  assert.match(first.querySelector('.dl-note').textContent,/연장/);
  assert.match(app.querySelector('.dl-quiet').textContent,/GAMMA/);
  assert.match(app.querySelector('.dl-updated').textContent,/2026년 11월 26일 \(목\) 09:00 KST 갱신/);
  app.querySelector('[data-dl-category=cv]').click();
  assert.deepEqual(cards(),['BETA 2027']);
  app.querySelector('[data-dl-category=all]').click();
  app.querySelector('[data-dl-kind=rebuttal]').click();
  assert.deepEqual(cards(),['BETA 2027'],'one kind on its own once picked');
  assert.match(app.querySelector('.dl-quiet').textContent,/선택한 종류의 마감은 없습니다/);
  app.querySelector('[data-dl-kind-reset]').click();
  assert.deepEqual(cards(),['ALPHA 2027','BETA 2027']);
  const {left,dday}=w.PaperDeadlines._test;
  assert.equal(left(3*3600000+5*60000),'3시간 5분');
  assert.equal(left(-1),'마감');
  assert.equal(dday(at,now),'D-6');
  w.PaperDeadlines.leave();w.close();
});

test('the deadline list is behind the same sign-in as the rest of Paper',async()=>{
  const {paperRoutes}=await import('../server/paper-routes.mjs');
  const sent=[];
  const handler=paperRoutes({authorize:async()=>null,send:(res,status,value)=>sent.push([status,value]),rootDir:new URL('..',import.meta.url).pathname,environment:{}});
  await handler({method:'GET'},{}, new URL('https://fixture.invalid/api/paper/deadlines'));
  assert.equal(sent[0][0],401);
  const ok=paperRoutes({authorize:async()=>({mode:'local',role:'reader',userId:'x'}),send:(res,status,value)=>sent.push([status,value]),rootDir:new URL('..',import.meta.url).pathname,environment:{}});
  await ok({method:'GET'},{},new URL('https://fixture.invalid/api/paper/deadlines'));
  assert.equal(sent[1][0],200);
  assert.equal(sent[1][1].conferences.length,CONFERENCES.length);
});
