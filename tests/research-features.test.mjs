import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const root=new URL('../',import.meta.url);
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
const seed={version:4,goals:[{id:'g1',title:'검증용 연구축'}],phases:[],notes:[],references:[],tasks:[
  {id:'root',title:'현재 연구',description:'기존 연구 질문',deliverable:'기존 판단 기준',owner:'연구자 A',goalId:'g1',start:'2026-11-02',end:'2026-12-06',planUnit:'week'},
  {id:'child',title:'세부 연구',owner:'연구자 B',parentId:'root',goalId:'g1',start:'2026-11-09',end:'2026-11-15',planUnit:'week'},
  {id:'done',title:'표 형식의 데이터를 분석하는 기술',goalId:'g1',status:'done'},
  {id:'future',title:'원천 데이터의 구조화 모달리티 확장 기술',goalId:'g1'}
]};
async function fixture(role='editor', initial=seed, catalog=[], currentDate='2026-11-09') {
  const html=(await readFile(new URL('work-app/index.html',root),'utf8')).replace(/<script[^>]*src=[^>]*><\/script>/g,'');
  const dom=new JSDOM(html,{url:'https://fixture.invalid/work/app/index.html',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,puts=[],gets=[];
  const RealDate=w.Date;w.Date=class extends RealDate {constructor(...args){super(...(args.length?args:[currentDate+'T12:00:00']));}static now(){return new RealDate(currentDate+'T12:00:00').getTime();}};let remote={revision:'4',state:clone(initial)};
  w.scrollTo=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.WORK_CONTEXT={mode:'supabase',storageKey:'synthetic-'+role,role};w.RESEARCH_SEED=clone(initial);w.RESEARCH_TAXONOMY_SOURCE={catalog};w.RESEARCH_LEGACY_SEED=clone(seed);w.WORK_INITIAL_ENVELOPE=clone(remote);
  w.fetch=async(url,options={})=>{
    assert.equal(url,'/api/research-state');
    if(options.method==='PUT'){const payload=JSON.parse(options.body);puts.push(payload);assert.equal(payload.revision,remote.revision);remote={revision:String(+remote.revision+1),state:clone(payload.state)};}
    else gets.push(url);
    return {ok:true,status:200,json:async()=>clone(remote)};
  };
  for(const name of ['papers','taxonomy','notebook','periods','date-picker','hierarchy','timeline','calendar','resources','workspace-sync','app'])w.eval(await readFile(new URL(`work-app/${name}.js`,root),'utf8'));
  await tick();
  return {w,document:w.document,puts,gets,close:()=>w.close()};
}

test('day picker preserves historical exact dates, cancels drafts and saves a cross-month range to shared state',async()=>{
  const initial=clone(seed);Object.assign(initial.tasks[1],{start:'2026-11-11',end:'2026-11-13',planUnit:'month'});
  const f=await fixture('editor',initial);try{
    const {w,document:d}=f,api=w.ResearchAtlas;
    api.operations.openTask('child');
    assert.equal(d.querySelector('#task-unit').type,'hidden');assert.equal(d.querySelector('#task-unit').value,'day');
    assert.equal(d.querySelector('#period-start').value,'2026-11-11');
    d.querySelector('[data-date-open="start"]').click();
    d.querySelector('[data-date-day="2026-11-28"]').click();
    assert.equal(d.querySelector('#research-date-panel').hidden,false,'choosing the start must keep the calendar open for the end date');
    assert.equal(d.querySelector('#period-start').value,'2026-11-11','draft does not mutate the form');
    d.querySelector('[data-date-cancel]').click();assert.equal(d.querySelector('#period-end').value,'2026-11-13');
    d.querySelector('[data-date-open="start"]').click();d.querySelector('[data-date-day="2026-11-28"]').click();
    d.querySelector('[data-date-next]').click();d.querySelector('[data-date-day="2026-12-03"]').click();
    assert.equal(d.querySelector('#research-date-panel').hidden,false,'choosing the end must leave the Apply button visible');
    assert.equal(d.querySelector('[data-date-count]').textContent,'6일간');d.querySelector('[data-date-apply]').click();
    assert.equal(d.querySelector('#period-start').value,'2026-11-28');assert.equal(d.querySelector('#period-end').value,'2026-12-03');
    assert.match(d.querySelector('#planning-duration').textContent,/6일간/);
    d.querySelector('#task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
    const saved=f.puts.at(-1).state.tasks.find(t=>t.id==='child');
    assert.equal(saved.start,'2026-11-28');assert.equal(saved.end,'2026-12-03');assert.equal(saved.planUnit,'day');
    assert.equal(api.validateState(api.getState()).tasks.find(t=>t.id==='child').planUnit,'day');
    for(const unit of ['month','year','week'])d.querySelector(`[data-unit="${unit}"]`).click();
    assert.equal(api.getState().tasks.find(t=>t.id==='child').start,'2026-11-28');
    api.operations.openTask('child');assert.equal(d.querySelector('#period-end').value,'2026-12-03');
  }finally{f.close();}
});

test('day picker supports a single day, reverse range selection, keyboard navigation and Escape without closing the editor',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f;w.ResearchAtlas.operations.openTask('child');
    d.querySelector('[data-date-open="start"]').click();d.querySelector('[data-date-day="2026-11-10"]').click();d.querySelector('[data-date-day="2026-11-10"]').click();
    assert.equal(d.querySelector('[data-date-count]').textContent,'1일간');d.querySelector('[data-date-apply]').click();
    assert.equal(d.querySelector('#period-start').value,d.querySelector('#period-end').value);
    d.querySelector('[data-date-open="start"]').click();
    d.querySelector('[data-date-day="2026-11-10"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
    assert.equal(d.activeElement.dataset.dateDay,'2026-11-11');
    d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
    assert.equal(d.querySelector('#research-date-panel').hidden,true);assert.equal(d.querySelector('#task-dialog').open,true);
    d.querySelector('[data-date-open="start"]').click();d.querySelector('[data-date-day="2026-11-20"]').click();
    d.querySelector('[data-date-day="2026-11-18"]').click();d.querySelector('[data-date-apply]').click();
    assert.equal(d.querySelector('#period-start').value,'2026-11-18');assert.equal(d.querySelector('#period-end').value,'2026-11-20');
  }finally{f.close();}
});

test('day clicks stay inside the calendar after rerender while an actual outside click discards only the draft',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f;w.ResearchAtlas.operations.openTask('child');
    d.querySelector('[data-date-open="start"]').click();
    const clicked=d.querySelector('[data-date-day="2026-11-18"]');clicked.click();
    assert.equal(clicked.isConnected,false,'the selected date button was replaced during the click');
    assert.equal(d.querySelector('#research-date-panel').hidden,false);
    assert.equal(d.querySelector('[data-date-mode="end"]').getAttribute('aria-pressed'),'true');
    d.querySelector('[data-date-day="2026-11-20"]').click();
    assert.equal(d.querySelector('#research-date-panel').hidden,false);
    assert.equal(d.querySelector('[data-date-apply]').disabled,false);
    d.querySelector('#task-title').click();
    assert.equal(d.querySelector('#research-date-panel').hidden,true);
    assert.equal(d.querySelector('#period-start').value,'2026-11-09');
    assert.equal(d.querySelector('#period-end').value,'2026-11-15');
    assert.equal(d.querySelector('#task-dialog').open,true);assert.equal(f.puts.length,0);
  }finally{f.close();}
});

test('daily parent translations keep all descendant offsets and resizing leaves children unchanged',async()=>{
  const f=await fixture();try{
    const api=f.w.ResearchAtlas;
    api.operations.reschedule('root','2026-11-03','2026-12-07','month');
    let tasks=api.getState().tasks;assert.equal(tasks.find(t=>t.id==='child').start,'2026-11-10');assert.equal(tasks.find(t=>t.id==='child').end,'2026-11-16');
    api.operations.reschedule('root','2026-11-03','2026-12-08','year');
    tasks=api.getState().tasks;assert.equal(tasks.find(t=>t.id==='child').start,'2026-11-10');assert.equal(tasks.find(t=>t.id==='root').end,'2026-12-08');
    assert.equal(tasks.find(t=>t.id==='root').planUnit,'day');
    api.operations.openTask('root');f.document.querySelector('#fit-children-range').click();
    assert.equal(f.document.querySelector('#period-start').value,'2026-11-10');assert.equal(f.document.querySelector('#period-end').value,'2026-11-16');await tick();
  }finally{f.close();}
});

test('unscheduled dates can be set using the calendar, restored to pending, and remain read-only for readers',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f;w.ResearchAtlas.operations.openTask('done');
    assert.equal(d.querySelector('[data-date-open="start"]').disabled,true);
    d.querySelector('#unscheduled').click();assert.equal(d.querySelector('#research-date-panel').hidden,false);
    d.querySelector('[data-date-day="2026-11-12"]').click();d.querySelector('[data-date-day="2026-11-13"]').click();d.querySelector('[data-date-apply]').click();
    d.querySelector('#unscheduled').click();
    d.querySelector('#task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
    assert.equal(w.ResearchAtlas.getState().tasks.find(t=>t.id==='done').start,'');
  }finally{f.close();}
  const reader=await fixture('reader');try{
    reader.w.ResearchAtlas.operations.openTask('child');assert.equal(reader.document.querySelector('[data-date-open="start"]').disabled,true);
    assert.equal(reader.puts.length,0);
  }finally{reader.close();}
});

test('roadmap visibility can hide and restore a subtree without removing its data',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f,api=w.ResearchAtlas;
    assert.equal(d.querySelectorAll('[data-task-row]').length,2);
    api.operations.openRoadmapVisibility();
    const input=d.querySelector('[data-visible-task="root"]');input.checked=false;input.dispatchEvent(new w.Event('change',{bubbles:true}));
    assert.equal(d.querySelector('[data-visible-task="child"]').disabled,true);
    d.querySelector('#visibility-apply').click();await tick();
    assert.equal(d.querySelectorAll('[data-task-row]').length,0);
    assert.equal(api.getState().tasks.length,4);assert.equal(f.puts.at(-1).state.tasks.length,4);
    api.operations.openRoadmapVisibility();
    const rootInput=d.querySelector('[data-visible-task="root"]');rootInput.checked=true;rootInput.dispatchEvent(new w.Event('change',{bubbles:true}));
    d.querySelector('#visibility-apply').click();await tick();
    assert.equal(d.querySelectorAll('[data-task-row]').length,2);
    const state=api.validateState(api.getState());assert.equal(state.tasks.find(t=>t.id==='root').roadmapHidden,false);
    assert.equal(state.tasks.find(t=>t.id==='done').roadmapHidden,true);
  }finally{f.close();}
});

test('L5 papers survive editing, server sync, duplicate and backup validation',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f,api=w.ResearchAtlas;
    api.operations.openTask('child');d.querySelector('[data-paper-add]').click();
    for(const [name,value] of Object.entries({title:'Synthetic paper',venue:'Test venue',year:'2026',summary:'A short research summary',url:'https://example.invalid/paper',figure:'https://example.invalid/figure.png'})){
      const input=d.querySelector(`[data-paper-field="${name}"]`);input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));
    }
    d.querySelector('#task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
    const saved=api.getState().tasks.find(t=>t.id==='child').papers[0];assert.equal(saved.title,'Synthetic paper');assert.equal(saved.venue,'Test venue');assert.equal(saved.year,'2026');
    assert.equal(f.puts.at(-1).state.tasks.find(t=>t.id==='child').papers[0].figure,'https://example.invalid/figure.png');
    const duplicate=api.operations.duplicateTask('child');await tick();assert.equal(api.getState().tasks.find(t=>t.id===duplicate).papers[0].summary,saved.summary);
    const restored=api.validateState(clone(api.getState()));assert.equal(restored.tasks.find(t=>t.id==='child').papers[0].url,saved.url);
    api.operations.openTask('child');d.querySelector('[data-paper-remove]').click();d.querySelector('#task-cancel').click();
    assert.equal(api.getState().tasks.find(t=>t.id==='child').papers.length,1,'cancel preserves saved papers');
    assert.equal(w.ResearchPapers.safeURL('javascript:alert(1)'), '');assert.equal(w.ResearchPapers.safeURL('data:image/svg+xml,<svg/>',true),'');
  }finally{f.close();}
});

test('initial envelope avoids a duplicate read and normalized migrations do not create false conflicts',async()=>{
  const f=await fixture();try{
    assert.equal(f.gets.length,0);assert.equal(f.puts.length,0);assert.match(f.document.querySelector('#storage-status').textContent,/불러왔습니다/);
    f.w.dispatchEvent(new f.w.Event('focus'));await tick();assert.equal(f.gets.length,1);assert.ok(!f.document.querySelector('#backup-open').classList.contains('needs-attention'));
  }finally{f.close();}
});

test('weekly labels use the first Monday, with explicit dates still shown across month and year edges',async()=>{
  const f=await fixture();try{
    const p=f.w.ResearchPeriods;
    assert.equal(p.weekLabel('2026-11-02'),'11월 첫째주');assert.equal(p.weekLabel('2026-11-09'),'11월 둘째주');
    assert.equal(p.weekLabel('2026-11-30'),'11월 다섯째주');assert.equal(p.weekLabel('2027-01-04'),'1월 첫째주');
    assert.equal(p.columns('2026-11-01','week')[0].label,'11월 시작 주');assert.equal(p.columns('2026-11-01','week')[1].detail,'11.2–11.8');
    assert.match(p.spanLabel({start:'2026-12-28',end:'2027-01-10',planUnit:'week'}),/2027/);
  }finally{f.close();}
});

test('reader details cannot add papers or apply shared visibility changes',async()=>{
  const f=await fixture('reader');try{
    const api=f.w.ResearchAtlas;api.operations.openRoadmapVisibility();assert.equal(f.document.querySelector('#visibility-apply'),null);
    assert.ok([...f.document.querySelectorAll('[data-visible-task]')].every(input=>input.disabled));
    f.document.querySelector('#visibility-cancel').click();api.operations.openTask('child');assert.equal(f.document.querySelector('[data-paper-add]'),null);
    f.document.querySelector('#task-form').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(f.puts.length,0);
  }finally{f.close();}
});

function backdrop(f,downX=0) {
  const dialog=f.document.querySelector('#task-dialog');
  dialog.getBoundingClientRect=()=>({left:100,right:500,top:0,bottom:600,width:400,height:600});
  dialog.dispatchEvent(new f.w.MouseEvent('pointerdown',{bubbles:true,button:0,clientX:downX,clientY:50}));
  dialog.dispatchEvent(new f.w.MouseEvent('click',{bubbles:true,button:0,clientX:0,clientY:50}));
}

test('backdrop saves valid edits while keeping removed research fields in stored data',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f,api=w.ResearchAtlas;api.operations.openTask('root');
    assert.equal(d.querySelector('#task-description'),null);assert.equal(d.querySelector('#task-deliverable'),null);
    const owner=d.querySelector('#task-owner');owner.value='새 담당자';owner.dispatchEvent(new w.Event('input',{bubbles:true}));
    assert.equal(owner.closest('details'),null,'owner is visible without expanding advanced settings');
    backdrop(f);await tick();assert.equal(d.querySelector('#task-dialog').open,false,d.querySelector('#task-error').textContent+' / '+[...d.querySelectorAll('input,select,textarea')].filter(input=>!input.checkValidity()).map(input=>input.id+':'+input.value).join(', '));
    const saved=api.getState().tasks.find(task=>task.id==='root');assert.equal(saved.owner,'새 담당자');assert.equal(saved.description,'기존 연구 질문');assert.equal(saved.deliverable,'기존 판단 기준');
    assert.equal(f.puts.at(-1).state.tasks.find(task=>task.id==='root').owner,'새 담당자');
  }finally{f.close();}
});

test('invalid edits, image processing and local save failures keep the editor open',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f,api=w.ResearchAtlas;api.operations.openTask('root');
    const title=d.querySelector('#task-title');title.value='';title.dispatchEvent(new w.Event('input',{bubbles:true}));backdrop(f);await tick();
    assert.equal(d.querySelector('#task-dialog').open,true);assert.equal(f.puts.length,0);assert.equal(api.getState().tasks.find(task=>task.id==='root').title,'현재 연구');
    title.value='변경한 제목';title.dispatchEvent(new w.Event('input',{bubbles:true}));d.querySelector('#task-papers').dataset.processing='true';backdrop(f);
    assert.equal(d.querySelector('#task-dialog').open,true);assert.equal(f.puts.length,0);
    d.querySelector('#task-papers').dataset.processing='false';w.Storage.prototype.setItem=()=>{throw Error('synthetic storage full');};backdrop(f);await tick();
    assert.equal(d.querySelector('#task-dialog').open,true);assert.equal(f.puts.length,0);assert.equal(api.getState().tasks.find(task=>task.id==='root').title,'현재 연구');
  }finally{f.close();}
});

test('a text-selection gesture ending outside does not save or dismiss the editor',async()=>{
  const f=await fixture();try{
    f.w.ResearchAtlas.operations.openTask('root');const title=f.document.querySelector('#task-title');title.value='선택 중인 제목';title.dispatchEvent(new f.w.Event('input',{bubbles:true}));
    backdrop(f,200);await tick();assert.equal(f.document.querySelector('#task-dialog').open,true);assert.equal(f.puts.length,0);
  }finally{f.close();}
});

test('roadmap rows and bars show the owner and explicit L5 hierarchy',async()=>{
  const f=await fixture();try{
    const root=f.document.querySelector('[data-task-row="root"]'),child=f.document.querySelector('[data-task-row="child"]');
    assert.match(root.querySelector('.timeline-row-owner').textContent,/연구자 A/);assert.match(child.querySelector('.timeline-row-owner').textContent,/연구자 B/);
    assert.equal(child.querySelector('.timeline-bar-level').textContent,'↳ L5');assert.equal(root.querySelector('.timeline-bar-level').textContent,'L4');
    assert.match(child.querySelector('[data-timeline-task]').getAttribute('aria-label'),/L5 하위 연구.*연구자 B/);
  }finally{f.close();}
});

test('right click hides a subtree and keyboard context menu deletes only its selected research',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f,api=w.ResearchAtlas;
    d.querySelector('[data-open-task="root"]').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:300,clientY:300,button:2}));
    assert.ok(d.querySelector('[role="menu"]'));d.querySelector('[data-context-hide]').click();await tick();
    assert.equal(d.querySelectorAll('[data-task-row]').length,0);assert.equal(api.getState().tasks.length,4);
    api.operations.openRoadmapVisibility();d.querySelector('[data-visible-task="root"]').checked=true;d.querySelector('[data-visible-task="root"]').dispatchEvent(new w.Event('change',{bubbles:true}));d.querySelector('#visibility-apply').click();await tick();
    d.querySelector('[data-open-task="root"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'F10',shiftKey:true,bubbles:true,cancelable:true}));
    d.querySelector('[data-context-delete]').click();await tick();assert.equal(api.getState().tasks.length,3);assert.ok(!api.getState().tasks.some(task=>task.id==='root'));
    assert.equal(api.getState().tasks.find(task=>task.id==='child').parentId,'');assert.equal(d.querySelector('[role="menu"]'),null);
  }finally{f.close();}
});

test('reader context menu cannot hide or delete research',async()=>{
  const f=await fixture('reader');try{
    const {w,document:d}=f;
    d.querySelector('[data-open-task="root"]').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:100,clientY:100,button:2}));
    assert.ok([...d.querySelectorAll('[role="menuitem"]')].every(button=>button.disabled));
    d.querySelector('[data-context-hide]').click();d.querySelector('[data-context-delete]').click();await tick();assert.equal(f.puts.length,0);assert.equal(w.ResearchAtlas.getState().tasks.length,4);
    d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.querySelector('[role="menu"]'),null);
  }finally{f.close();}
});

test('a failed local write rolls back a deletion and preserves its children',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f;w.Storage.prototype.setItem=()=>{throw Error('synthetic storage full');};
    d.querySelector('[data-open-task="root"]').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2,clientX:200,clientY:200}));
    d.querySelector('[data-context-delete]').click();await tick();
    const state=w.ResearchAtlas.getState();assert.equal(state.tasks.length,4);assert.equal(state.tasks.find(task=>task.id==='child').parentId,'root');assert.equal(f.puts.length,0);
  }finally{f.close();}
});

test('calendar counts real work once, supports co-owners and packs inclusive date boundaries',async()=>{
  const f=await fixture();try{
    const C=f.w.ResearchCalendar;
    const tasks=[{id:'p',start:'2026-11-01',end:'2026-11-30',owner:'A'},{id:'a',parentId:'p',start:'2026-11-02',end:'2026-11-10',owner:'A'},{id:'b',parentId:'p',start:'2026-11-09',end:'2026-11-15',owner:'A, B'},{id:'c',start:'2026-11-11',end:'2026-11-20',owner:'B'}];
    const work=C.workItems(tasks);assert.equal(work.length,3);assert.ok(!work.some(task=>task.id==='p'));
    const total=C.summary(work,'2026-11-01','2026-11-30');assert.equal(total.count,3);assert.equal(total.peak,2);assert.equal(total.overlapDays,7);
    const people=C.ownerSummary(work,'2026-11-01','2026-11-30');assert.equal(people.find(row=>row.owner==='A').overlapDays,2);assert.equal(people.find(row=>row.owner==='B').overlapDays,5);
    const packed=C.packWeek(work,'2026-11-09','2026-11-15');assert.equal(packed.lanes,2);
    for(const a of packed.segments)for(const b of packed.segments)if(a!==b&&a.lane===b.lane)assert.ok(a.end<b.start||b.end<a.start);
    assert.equal(C.summary([{id:'edge',start:'2026-10-31',end:'2026-11-01'}],'2026-11-01','2026-11-30').days['2026-11-01'],1);
  }finally{f.close();}
});

test('annual overview month calendar filters by owner and reveals a selected day',async()=>{
  const f=await fixture();try{
    const {w,document:d}=f;d.querySelector('[data-view="overview"]').click();
    assert.equal(d.querySelector('[data-calendar-month]').value,'2026-11');
    assert.equal(d.querySelector('.owner-overlap-section'), null);
    assert.equal(d.querySelector('.calendar-date small'), null);
    assert.ok(d.querySelector('#integration-notice').closest('.app-footer'));
    assert.equal(d.querySelector('.topbar-actions').lastElementChild.id, 'work-logout');
    assert.ok(d.querySelector('[data-calendar-task="child"]'));assert.equal(d.querySelector('[data-calendar-task="root"]'),null,'summary period is not counted twice');
    const owner=d.querySelector('[data-calendar-owner]');owner.value='연구자 B';owner.dispatchEvent(new w.Event('change',{bubbles:true}));
    d.querySelector('[data-calendar-day="2026-11-09"]').click();assert.equal(d.querySelector('[data-calendar-day-detail]').hidden,false);assert.match(d.querySelector('[data-calendar-day-detail]').textContent,/연구자 B/);
    d.querySelector('[data-calendar-month]').value='2027-01';d.querySelector('[data-calendar-month]').dispatchEvent(new w.Event('change',{bubbles:true}));assert.match(d.querySelector('.year-toolbar h2').textContent,/2027/);assert.equal(d.querySelector('[data-calendar-month]').value,'2027-01');
  }finally{f.close();}
});

test('appearance is only in Settings and library bookmarks return to roadmap',async()=>{
 const f=await fixture();try{
  const d=f.document;assert.equal(d.querySelector('[data-theme-toggle]'),null);assert.equal(d.querySelector('[data-view="references"]'),null);
  d.querySelector('[data-view="settings"]').click();await tick();
  assert.deepEqual([...d.querySelectorAll('[data-theme-value]')].map(x=>x.dataset.themeValue),['dark','light','system']);
  f.w.location.hash='references';await tick();assert.equal(d.querySelector('#breadcrumb-view').textContent,'연구 로드맵');
 }finally{f.close();}
});

const axisCatalog=[{id:'g1',name:'검증용 연구축',sourceCell:'A1',l2:{sourceCell:'A2'},l4:[{id:'asset1',name:'기존 기술',sourceCell:'A3'}]}];
test('built-in L3 deletion removes descendants and survives migration, sync and backups',async()=>{
 const f=await fixture('editor',seed,axisCatalog);try{
  const {w,document:d}=f,api=w.ResearchAtlas;
  d.querySelector('[data-view="goals"]').click();
  const button=d.querySelector('[data-delete-goal="g1"]');assert.ok(button);assert.equal(button.textContent,'');assert.match(button.getAttribute('aria-label'),/삭제/);
  button.click();d.querySelector('[data-confirm-delete-goal]').click();await tick();
  let state=api.getState();assert.equal(state.goals.length,0);assert.equal(state.tasks.length,0);assert.ok(state.deletedGoalIds.includes('g1'));
  assert.equal(f.puts.at(-1).state.goals.length,0);
  state.taxonomyVersion='older';state=api.validateState(state);assert.equal(state.goals.length,0);assert.equal(state.tasks.length,0);
 }finally{f.close();}
});
test('L3-only deletion keeps research and notes, failure restores the original state',async()=>{
 const initial=clone(seed);initial.notes=[{id:'n1',title:'보존할 노트',goalId:'g1'}];
 const f=await fixture('editor',initial,axisCatalog);try{
  const {w,document:d}=f,api=w.ResearchAtlas;
  d.querySelector('[data-view="goals"]').click();d.querySelector('[data-delete-goal]').click();
  d.querySelector('[name="delete-scope"][value="axis"]').checked=true;d.querySelector('[data-confirm-delete-goal]').click();await tick();
  let state=api.getState();const count=state.tasks.length;state.taxonomyVersion='older';state=api.validateState(state);assert.equal(state.tasks.length,count);assert.equal(state.goals.length,0);assert.ok(state.tasks.length>=4);assert.equal(state.tasks.find(t=>t.id==='child').parentId,'root');assert.equal(state.notes[0].goalId,'');assert.ok(state.tasks.every(t=>!t.goalId));
 }finally{f.close();}
 const g=await fixture();try{
  const d=g.document,before=g.w.ResearchAtlas.getState();d.querySelector('[data-view="goals"]').click();d.querySelector('[data-delete-goal]').click();
  g.w.Storage.prototype.setItem=()=>{throw Error('full');};d.querySelector('[data-confirm-delete-goal]').click();
  assert.deepEqual(g.w.ResearchAtlas.getState(),before);
 }finally{g.close();}
});
test('explicitly rejected axes are removed without destroying recorded research',async()=>{
 const initial=clone(seed);initial.goals[0].title='멀티에이전트 토론으로 텍스트를 세그멘테이션하는 기술';
 const f=await fixture('editor',initial);try{
  const state=f.w.ResearchAtlas.getState();assert.equal(state.goals.length,0);assert.equal(state.tasks.length,4);assert.ok(state.tasks.every(t=>!t.goalId));
 }finally{f.close();}
});
test('notes keep multiple paper records separate from reference URL through save and validation',async()=>{
 const f=await fixture();try{
  const {w,document:d}=f,api=w.ResearchAtlas;
  d.querySelector('[data-view="notes"]').click();d.querySelector('[data-new-note]').click();
  const ref=d.querySelector('#note-url');ref.value='https://example.invalid/reference';ref.dispatchEvent(new w.Event('input',{bubbles:true}));
  for(const title of ['Paper one','Paper two']){
   d.querySelector('#note-papers [data-paper-add]').click();const inputs=d.querySelectorAll('#note-papers [data-paper-field="title"]');const input=inputs[inputs.length-1];input.value=title;input.dispatchEvent(new w.Event('input',{bubbles:true}));
  }
  assert.equal(d.querySelector('#note-papers .paper-card:last-child h4').textContent,'Paper two');
  await tick();let state=api.validateState(api.getState());assert.deepEqual(Array.from(state.notes[0].papers,p=>p.title),['Paper one','Paper two']);assert.equal(state.notes[0].url,ref.value);assert.equal(f.puts.at(-1).state.notes[0].papers.length,2);
  d.querySelector('[data-view="goals"]').click();d.querySelector('[data-view="notes"]').click();assert.equal(d.querySelectorAll('#note-papers .paper-card').length,2);
  d.querySelector('#note-papers [data-paper-remove]').click();await tick();assert.equal(api.getState().notes[0].papers[0].title,'Paper two');
 }finally{f.close();}
});
test('readers cannot change L3 or note papers',async()=>{
 const initial=clone(seed);initial.notes=[{id:'n1',title:'읽기 노트',papers:[{id:'p1',title:'Read paper'}]}];
 const f=await fixture('reader',initial,axisCatalog);try{
  const d=f.document;d.querySelector('[data-view="goals"]').click();assert.equal(d.querySelector('[data-delete-goal]'),null);
  d.querySelector('[data-view="notes"]').click();assert.equal(d.querySelector('[data-paper-add]'),null);assert.equal(d.querySelector('[data-paper-field="title"]').readOnly,true);assert.equal(d.querySelector('#note-title').disabled,true);
 }finally{f.close();}
});

const filterSeed=()=>({...clone(seed),taxonomyVersion:'orange-l3-2026-11-10-v1',goals:[{id:'g1',title:'첫 연구축'},{id:'g2',title:'둘째 연구축'},{id:'g3',title:'셋째 연구축'}],tasks:[...clone(seed.tasks),{id:'second',title:'두번째 기술',goalId:'g2'},{id:'third',title:'세번째 기술',goalId:'g3'},{id:'unlinked',title:'미연결 기술'}]});
function chooseGoals(f,ids){
 const d=f.document;for(const input of d.querySelectorAll('[data-goal-filter-choice]'))input.checked=ids.includes(input.value);
 d.querySelector('[data-goal-filter-apply]').click();
}
test('multiple L3 checkbox filters include only chosen groups and preserve task data',async()=>{
 const f=await fixture('editor',filterSeed());try{
  const d=f.document,before=clone(f.w.ResearchAtlas.getState());
  chooseGoals(f,['g1','g3']);
  assert.deepEqual([...d.querySelectorAll('[data-l3-group]')].map(e=>e.dataset.l3Group),['g1','g3']);
  assert.ok(d.querySelector('[data-task-row="root"]'));assert.ok(d.querySelector('[data-task-row="third"]'));assert.equal(d.querySelector('[data-task-row="second"]'),null);
  assert.match(d.querySelector('#goal-filter summary').textContent,/2개 선택/);
  chooseGoals(f,[]);assert.equal(d.querySelectorAll('[data-l3-group]').length,0);assert.match(d.querySelector('.timeline-filter-empty').textContent,/선택한 L3가 없습니다/);
  chooseGoals(f,['']);assert.deepEqual([...d.querySelectorAll('[data-l3-group]')].map(e=>e.dataset.l3Group),['']);assert.ok(d.querySelector('[data-task-row="unlinked"]'));
  d.querySelector('#clear-filters').click();assert.equal(d.querySelectorAll('[data-l3-group]').length,4);
  assert.deepEqual(clone(f.w.ResearchAtlas.getState()),before);assert.equal(f.puts.length,0,'view filters do not write shared state');
 }finally{f.close();}
});
test('filter cancellation preserves applied selection across roadmap, overview and backlog',async()=>{
 const f=await fixture('editor',filterSeed());try{
  const d=f.document;chooseGoals(f,['g1','g2']);d.querySelector('[data-goal-filter-choice][value="g3"]').checked=true;d.querySelector('[data-goal-filter-cancel]').click();
  d.querySelector('[data-view="overview"]').click();assert.equal(d.querySelector('[data-goal-filter-choice][value="g3"]').checked,false);assert.equal(d.querySelector('[data-goal-filter-choice][value="g2"]').checked,true);
  d.querySelector('[data-view="backlog"]').click();const candidates=[...d.querySelectorAll('.candidate-title')].map(e=>e.textContent);assert.ok(candidates.includes('두번째 기술'));assert.ok(!candidates.includes('세번째 기술'));
  d.querySelector('[data-view="roadmap"]').click();assert.equal(d.querySelectorAll('[data-l3-group]').length,2);
 }finally{f.close();}
});
function pointer(f,target,type,x,y){
 const event=new f.w.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});Object.defineProperties(event,{pointerId:{value:7},isPrimary:{value:true}});target.dispatchEvent(event);
}
test('timeline dragging and resizing preserve daily precision in week, month and year views',async()=>{
 for(const unit of ['week','month','year']) {
  const initial=clone(seed);Object.assign(initial.tasks[1],{start:'2026-11-11',end:'2026-11-13',planUnit:'day'});
  const f=await fixture('editor',initial);try{
   const {w,document:d}=f,p=w.ResearchPeriods;d.querySelector(`[data-unit="${unit}"]`).click();
   const cols=p.columns('2026-11-09',unit),width=cols.length*4000;
   const x=date=>{const i=cols.findIndex(c=>c.start<=date&&date<=c.end),c=cols[i];return (i+(p.daysBetween(date,c.start)+.5)/(p.daysBetween(c.end,c.start)+1))*4000;};
   const prepare=()=>{const bar=d.querySelector('[data-timeline-task="child"]');bar.closest('.timeline-lane').getBoundingClientRect=()=>({left:0,width});return bar;};
   let bar=prepare();pointer(f,bar,'pointerdown',x('2026-11-11'),200);pointer(f,d,'pointermove',x('2026-11-12'),200);pointer(f,d,'pointerup',x('2026-11-12'),200);await tick();
   let task=w.ResearchAtlas.getState().tasks.find(t=>t.id==='child');assert.equal(task.start,'2026-11-12',unit);assert.equal(task.end,'2026-11-14',unit);
   bar=prepare();pointer(f,bar.querySelector('[data-resize="end"]'),'pointerdown',x('2026-11-14'),200);pointer(f,d,'pointermove',x('2026-11-15'),200);pointer(f,d,'pointerup',x('2026-11-15'),200);await tick();
   task=w.ResearchAtlas.getState().tasks.find(t=>t.id==='child');assert.equal(task.start,'2026-11-12');assert.equal(task.end,'2026-11-15');assert.equal(task.planUnit,'day');
  }finally{f.close();}
 }
});
test('timeline range creation selects days inside a month rather than expanding to month boundaries',async()=>{
 const f=await fixture();try{
  const {w,document:d}=f;d.querySelector('[data-unit="month"]').click();
  const cell=d.querySelector('[data-task-row="root"] .timeline-cell'),lane=cell.closest('.timeline-lane');lane.getBoundingClientRect=()=>({left:0,width:3720});
  pointer(f,cell,'pointerdown',105,200);pointer(f,d,'pointermove',125,200);pointer(f,d,'pointerup',125,200);
  assert.equal(d.querySelector('#period-start').value,'2026-11-11');assert.equal(d.querySelector('#period-end').value,'2026-11-13');
  assert.equal(d.querySelector('#task-unit').value,'day');
 }finally{f.close();}
});
function positionGoalRows(f){
 const rect=(top,height=60)=>({top,bottom:top+height,left:0,right:900,width:900,height,x:0,y:top,toJSON(){return this;}});
 const host=f.document.querySelector('#timeline-host');host.getBoundingClientRect=()=>rect(100,1600);
 let top=200;for(const row of host.querySelector('.timeline-chart').children){row.getBoundingClientRect=()=>rect(0);if(row.matches('[data-l3-group],.timeline-row')){const y=top;row.getBoundingClientRect=()=>rect(y);top+=60;}}
}
test('dragging an L3 heading moves its complete block and saves the same order in cards and filters',async()=>{
 const f=await fixture('editor',filterSeed());try{
  const {w,document:d}=f,api=w.ResearchAtlas,originalTasks=clone(api.getState().tasks);positionGoalRows(f);
  const source=d.querySelector('[data-reorder-goal="g3"]'),target=d.querySelector('[data-l3-group="g1"]').getBoundingClientRect();
  pointer(f,source,'pointerdown',120,550);pointer(f,d,'pointermove',120,target.top+2);
  assert.ok(d.querySelector('.timeline-order-ghost'));assert.ok(d.querySelector('[data-l3-group="g3"]').classList.contains('is-order-source'));
  assert.match(d.querySelector('.timeline-order-ghost').textContent,/L4\/L5 함께 이동/);
  pointer(f,d,'pointerup',120,target.top+2);await tick();assert.deepEqual(Array.from(api.getState().goals,g=>g.id),['g3','g1','g2']);
  assert.equal(d.querySelector('.timeline-order-ghost'),null);assert.deepEqual(clone(api.getState().tasks),originalTasks);
  assert.deepEqual([...d.querySelectorAll('[data-l3-group]')].map(e=>e.dataset.l3Group),['g3','g1','g2','']);
  assert.deepEqual([...d.querySelectorAll('[data-goal-filter-choice]')].map(e=>e.value),['g3','g1','g2','']);assert.deepEqual(f.puts.at(-1).state.goals.map(g=>g.id),['g3','g1','g2']);
  const old=api.getState();old.taxonomyVersion='older';assert.deepEqual(Array.from(api.validateState(old).goals,g=>g.id),['g3','g1','g2']);
  d.querySelector('[data-view="goals"]').click();assert.match(d.querySelector('.goal-card h3').textContent,/셋째 연구축/);
 }finally{f.close();}
});
test('L3 dragging can be cancelled and filtered keyboard movement preserves hidden axes and task relationships',async()=>{
 const f=await fixture('editor',filterSeed());try{
  const {w,document:d}=f,api=w.ResearchAtlas,before=clone(api.getState());positionGoalRows(f);
  pointer(f,d.querySelector('[data-reorder-goal="g3"]'),'pointerdown',120,550);pointer(f,d,'pointermove',120,201);d.querySelector('[data-reorder-goal="g3"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));pointer(f,d,'pointerup',120,201);assert.deepEqual(clone(api.getState()),before);assert.equal(d.querySelector('.timeline-order-ghost'),null);
  pointer(f,d.querySelector('[data-reorder-goal="g3"]'),'pointerdown',120,550);pointer(f,d,'pointermove',120,201);pointer(f,d,'pointercancel',120,201);assert.deepEqual(clone(api.getState()),before);assert.equal(w.ResearchTimeline.isInteracting(),false);
  chooseGoals(f,['g1','g3']);d.querySelector('[data-reorder-goal="g3"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));await tick();
  assert.deepEqual(Array.from(api.getState().goals,g=>g.id),['g3','g1','g2']);assert.equal(d.querySelectorAll('[data-l3-group]').length,2);assert.deepEqual(clone(api.getState().tasks),before.tasks);
 }finally{f.close();}
});
test('failed L3 drag saves roll back and reader headings cannot move',async()=>{
 const f=await fixture('editor',filterSeed());try{
  const {w,document:d}=f,api=w.ResearchAtlas;positionGoalRows(f);w.Storage.prototype.setItem=()=>{throw Error('full');};
  pointer(f,d.querySelector('[data-reorder-goal="g3"]'),'pointerdown',120,550);pointer(f,d,'pointermove',120,201);pointer(f,d,'pointerup',120,201);
  assert.equal(api.getState().goals[0].id,'g1');assert.match(d.querySelector('#toast').textContent,/이동을 취소/);assert.equal(d.querySelector('.timeline-order-ghost'),null);
 }finally{f.close();}
 const g=await fixture('reader',filterSeed());try{
  assert.equal(g.document.querySelector('[data-reorder-goal]'),null);assert.equal(g.w.ResearchAtlas.operations.moveGoal('g3',-1),false);assert.equal(g.w.ResearchAtlas.operations.reorderGoal('g3','g1'),false);chooseGoals(g,['g2','g3']);assert.equal(g.document.querySelectorAll('[data-l3-group]').length,2);assert.equal(g.puts.length,0);
 }finally{g.close();}
});

const checkboxSeed=()=>({...filterSeed(),tasks:[
 {id:'joint',title:'공동 연구',goalId:'g1',category:'research',status:'active',owner:'연구자 A, 연구자 B',start:'2026-11-02',end:'2026-11-15',planUnit:'week'},
 {id:'a-only',title:'A 실험',goalId:'g1',category:'experiment',status:'planned',owner:'연구자 A',start:'2026-11-02',end:'2026-11-15',planUnit:'week'},
 {id:'b-only',title:'B 논문',goalId:'g2',category:'writing',status:'done',owner:'연구자 B',start:'2026-11-02',end:'2026-11-15',planUnit:'week'},
 {id:'c-only',title:'C 회의',goalId:'g3',category:'meeting',status:'paused',owner:'연구자 C',start:'2026-11-02',end:'2026-11-15',planUnit:'week'},
 {id:'unassigned',title:'담당자 미정 연구',goalId:'g3',category:'research',status:'backlog',owner:''}
]});
function chooseFilter(f,name,ids){const d=f.document;d.querySelectorAll(`[data-${name}-filter-choice]`).forEach(i=>i.checked=ids.includes(i.value));d.querySelector(`[data-${name}-filter-apply]`).click();}
const shownTasks=f=>[...f.document.querySelectorAll('[data-task-row]')].map(row=>row.dataset.taskRow);
test('type, status and owner checkbox selections combine across dimensions without changing shared data',async()=>{
 const f=await fixture('editor',checkboxSeed());try{
  const before=clone(f.w.ResearchAtlas.getState());chooseFilter(f,'category',['research','writing']);chooseFilter(f,'status',['active','done']);chooseFilter(f,'owner',['연구자 B']);
  assert.deepEqual(shownTasks(f),['joint','b-only']);assert.equal(f.document.querySelectorAll('[data-owner-filter-choice][value="연구자 B"]').length,1);
  chooseFilter(f,'owner',['연구자 A']);assert.deepEqual(shownTasks(f),['joint']);chooseFilter(f,'owner',['연구자 A','연구자 B']);assert.deepEqual(shownTasks(f),['joint','b-only']);
  assert.deepEqual(clone(f.w.ResearchAtlas.getState()),before);assert.equal(f.puts.length,0);
 }finally{f.close();}
});
test('empty selections show no results, unassigned owners can be selected and reset restores all filters',async()=>{
 const f=await fixture('editor',checkboxSeed());try{
  chooseFilter(f,'owner',['']);assert.deepEqual(shownTasks(f),['unassigned']);chooseFilter(f,'category',[]);assert.deepEqual(shownTasks(f),[]);assert.match(f.document.querySelector('.timeline-filter-empty').textContent,/조건에 맞는 연구가 없습니다/);
  f.document.querySelector('#clear-filters').click();assert.equal(shownTasks(f).length,5);assert.equal(f.document.querySelector('#owner-filter summary').textContent,'모든 담당자⌄');
  chooseFilter(f,'status',[]);assert.equal(shownTasks(f).length,0);f.document.querySelector('#clear-filters').click();assert.equal(shownTasks(f).length,5);
 }finally{f.close();}
});
test('cancelled checkbox edits do not apply and selections follow navigation into overview and backlog',async()=>{
 const f=await fixture('editor',checkboxSeed());try{
  const d=f.document;chooseFilter(f,'owner',['연구자 B']);d.querySelector('[data-owner-filter-choice][value="연구자 C"]').checked=true;d.querySelector('[data-owner-filter-cancel]').click();
  d.querySelector('[data-view="overview"]').click();assert.equal(d.querySelector('[data-owner-filter-choice][value="연구자 C"]').checked,false);assert.ok(d.querySelector('[data-calendar-task="joint"]'));assert.equal(d.querySelector('[data-calendar-task="c-only"]'),null);
  d.querySelector('[data-view="backlog"]').click();const titles=[...d.querySelectorAll('.task-copy strong')].map(t=>t.textContent);assert.deepEqual(titles,['공동 연구','B 논문']);
  d.querySelector('[data-view="roadmap"]').click();assert.deepEqual(shownTasks(f),['joint','b-only']);assert.equal(f.puts.length,0);
 }finally{f.close();}
});
test('owner filters include joint assignments but exclude nonmatching parents without changing parent links',async()=>{
 const f=await fixture();try{
  chooseFilter(f,'owner',['연구자 B']);assert.deepEqual(shownTasks(f),['child']);assert.equal(f.w.ResearchAtlas.getState().tasks.find(t=>t.id==='child').parentId,'root');assert.equal(f.puts.length,0);
 }finally{f.close();}
});


test('journal opens at the local current week and month, including a week across New Year',async()=>{
 const f=await fixture('editor',seed,[],'2026-12-31');try{
  const d=f.document;assert.equal(d.querySelector('#anchor-month').value,'2026-12');
  const current=d.querySelector('.timeline-column.is-current');assert.match(current.textContent,/이번 주/);assert.match(current.textContent,/12.28–1.3/);assert.equal(d.querySelectorAll('.timeline-column.is-current').length,1);
  assert.equal(d.querySelectorAll('.timeline-cell.is-current').length,d.querySelectorAll('.timeline-row').length);
  d.querySelector('[data-step-period="1"]').click();assert.equal(d.querySelector('.timeline-column.is-current'),null);
  d.querySelector('#roadmap-today').click();assert.match(d.querySelector('.timeline-column.is-current').textContent,/12.28–1.3/);
  d.querySelector('[data-view="overview"]').click();assert.equal(d.querySelector('[data-calendar-month]').value,'2026-12');assert.equal(d.querySelectorAll('.calendar-week.is-current-week').length,1);assert.equal(d.querySelector('.calendar-date.is-today').dataset.calendarDay,'2026-12-31');
  assert.equal(f.puts.length,0);
 }finally{f.close();}
 const g=await fixture('reader',seed,[],'2027-01-01');try{g.document.querySelector('[data-view="overview"]').click();assert.equal(g.document.querySelector('[data-calendar-month]').value,'2027-01');}finally{g.close();}
});
test('all L3 axes share the same badge, creation label and editable title',async()=>{
 const initial=clone(seed);initial.goals.push({id:'official',title:'원본 연구축',assetId:'official'});
 const f=await fixture('editor',initial);try{
  const d=f.document;d.querySelector('[data-view="goals"]').click();assert.equal(d.querySelector('[data-add-goal]').textContent,'+ L3 연구축');
  assert.deepEqual([...d.querySelectorAll('.goal-card h3 .badge')].map(x=>x.textContent),['L3','L3']);
  d.querySelector('[data-edit-goal="official"]').click();assert.equal(d.querySelector('#goal-title').readOnly,false);d.querySelector('#goal-title').value='수정한 연구축';d.querySelector('#goal-form').dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.equal(f.w.ResearchAtlas.getState().goals.find(g=>g.id==='official').title,'수정한 연구축');
 }finally{f.close();}
});
test('six research categories preserve legacy tasks and expose the same choices in settings',async()=>{
 const initial=clone(seed);initial.tasks[0].category='milestone';initial.tasks[1].category='experiment';
 const f=await fixture('editor',initial);try{
  f.w.ResearchAtlas.operations.openTask('root');
  assert.deepEqual([...f.document.querySelector('#task-category').options].map(x=>x.textContent),['연구/조사','코드 구현','실험 설계','실험 검증','문서 정리','추가 협의']);
  assert.equal(f.w.ResearchAtlas.getState().tasks.find(t=>t.id==='root').category,'writing');assert.equal(f.w.ResearchAtlas.getState().tasks.find(t=>t.id==='child').category,'experiment');
  f.document.querySelector('#task-cancel').click();f.document.querySelector('[data-view="settings"]').click();assert.ok(f.document.querySelector('#color-design'));assert.ok(f.document.querySelector('#color-implementation'));assert.equal(f.document.querySelector('#color-milestone'),null);
 }finally{f.close();}
});
const allocationSeed=()=>({...clone(seed),tasks:[
 {id:'root',title:'상위 연구',goalId:'g1',owner:'A, B',ownerAllocations:[{owner:'A',percent:80},{owner:'B',percent:30}],start:'2026-11-02',end:'2026-11-30',planUnit:'week'},
 {id:'child',title:'하위 연구',goalId:'g1',parentId:'root',owner:'A',ownerAllocations:[{owner:'A',percent:50}],start:'2026-11-09',end:'2026-11-15',planUnit:'week'},
 {id:'sibling',title:'병행 연구',goalId:'g1',parentId:'root',owner:'A',ownerAllocations:[{owner:'A',percent:60}],start:'2026-11-09',end:'2026-11-15',planUnit:'week'},
 {id:'deep',title:'더 깊은 연구',goalId:'g1',parentId:'child',owner:'A',ownerAllocations:[{owner:'A',percent:20}],start:'2026-11-11',end:'2026-11-13',planUnit:'week'},
 {id:'b-work',title:'B 연구',goalId:'g1',parentId:'root',owner:'B',ownerAllocations:[{owner:'B',percent:30}],start:'2026-11-02',end:'2026-11-30',planUnit:'week'},
 {id:'unknown',title:'미입력 연구',goalId:'g1',parentId:'root',owner:'C',start:'2026-11-02',end:'2026-11-30',planUnit:'week'}
]});
test('MM and overload use real overlapping dates, per-person descendants and weekday month fractions',async()=>{
 const f=await fixture('editor',allocationSeed());try{
  const C=f.w.ResearchCalendar,rows=C.resourceSummary(f.w.ResearchAtlas.getState().tasks,'2026-11-01','2026-11-30'),a=rows.find(r=>r.owner==='A'),b=rows.find(r=>r.owner==='B');
  assert.equal(a.peak,130);assert.equal(a.overDays,5);assert.equal(a.firstOver,'2026-11-09');assert.equal(a.mm,0.29);assert.equal(b.mm,0.30);assert.equal(b.peak,30);
  const card=f.document.querySelector('[data-resource-owner="A"]');assert.ok(card.classList.contains('is-over'));assert.match(card.textContent,/30% 초과/);assert.equal(rows.find(r=>r.owner==='C').missing,1);assert.match(f.document.querySelector('[data-resource-owner="C"]').textContent,/MM 미산정/);
  const task=(id,start,end,percent,extra={})=>({id,title:id,parentId:'root',owner:'A',ownerAllocations:[{owner:'A',percent}],start,end,...extra});
  assert.equal(C.resourceSummary([task('m','2026-12-01','2026-12-31',100)],'2026-12-01','2026-12-31')[0].mm,1);
  assert.equal(C.resourceSummary([task('a','2026-12-01','2026-12-10',60),task('b','2026-12-11','2026-12-31',60)],'2026-12-01','2026-12-31')[0].peak,60);
  assert.equal(C.resourceSummary([task('a','2026-12-01','2026-12-10',100),task('b','2026-12-10','2026-12-31',20)],'2026-12-01','2026-12-31')[0].peak,120);
  assert.equal(C.resourceSummary([task('parent','2026-12-01','2026-12-31',80,{parentId:''}),task('child','2026-12-01','2026-12-31',0,{parentId:'parent'})],'2026-12-01','2026-12-31')[0].peak,0);
  assert.equal(C.resourceSummary([task('paused','2026-12-01','2026-12-31',100,{status:'paused'})],'2026-12-01','2026-12-31').length,0);
 }finally{f.close();}
});
test('allocation edits preview overload, retain individual values through sync, duplicate and backup, and reject invalid input',async()=>{
 const f=await fixture('editor',allocationSeed());try{
  const {w,document:d}=f,api=w.ResearchAtlas;api.operations.openTask('child');
  const input=d.querySelector('[data-allocation-input]');input.value='70';input.dispatchEvent(new w.Event('input',{bubbles:true}));assert.match(d.querySelector('#allocation-warning').textContent,/150%.*50% 초과/);
  d.querySelector('#task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.equal(f.puts.at(-1).state.tasks.find(t=>t.id==='child').ownerAllocations[0].percent,70);assert.equal(d.querySelector('[data-task-row="child"] .task-allocation-percent').textContent,'70%');
  const copyId=api.operations.duplicateTask('child');assert.equal(api.validateState(api.getState()).tasks.find(t=>t.id===copyId).ownerAllocations[0].percent,70);
  api.operations.openTask('child');const percent=d.querySelector('[data-allocation-input]');percent.value='101';d.querySelector('#task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(d.querySelector('#task-dialog').open,true);assert.equal(api.getState().tasks.find(t=>t.id==='child').ownerAllocations[0].percent,70);
  percent.value='0';d.querySelector('#task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(api.getState().tasks.find(t=>t.id==='child').ownerAllocations[0].percent,0);
  const invalid=api.getState();invalid.tasks.find(t=>t.id==='child').ownerAllocations=[{owner:'A',percent:-1}];assert.throws(()=>api.validateState(invalid),/0~100/);
  invalid.tasks.find(t=>t.id==='child').ownerAllocations=[{owner:'A',percent:NaN}];assert.throws(()=>api.validateState(invalid),/0~100/);await tick();
 }finally{f.close();}
});
test('resource warnings include hidden and filtered work and readers cannot save allocation changes',async()=>{
 const initial=allocationSeed();initial.tasks.find(t=>t.id==='sibling').roadmapHidden=true;
 const f=await fixture('editor',initial);try{
  chooseFilter(f,'category',[]);assert.equal(f.document.querySelectorAll('[data-task-row]').length,0);assert.match(f.document.querySelector('[data-resource-owner="A"]').textContent,/130%/);
 }finally{f.close();}
 const r=await fixture('reader',initial);try{
  r.w.ResearchAtlas.operations.openTask('root');const input=r.document.querySelector('[data-allocation-input]');assert.equal(input.readOnly,true);input.value='90';r.document.querySelector('#task-form').dispatchEvent(new r.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(r.puts.length,0);assert.equal(r.w.ResearchAtlas.getState().tasks[0].ownerAllocations[0].percent,80);
 }finally{r.close();}
});

test('roadmap shows ISO week codes alongside monthly ordinal weeks and preserves the ISO year at New Year',async()=>{
 const f=await fixture('editor',seed,[],'2026-11-17');try{
  const d=f.document,headers=[...d.querySelectorAll('.timeline-column')],fourth=headers.find(column=>column.querySelector('strong').textContent==='11월 넷째주');
  assert.equal(fourth.querySelector('.timeline-week-code').textContent,'2026-W48');
  assert.equal(d.querySelector('.timeline-column.is-current .timeline-week-code').textContent,'2026-W47');
 }finally{f.close();}
 const n=await fixture('editor',seed,[],'2027-01-01');try{
  assert.equal(n.document.querySelector('.timeline-column.is-current .timeline-week-code').textContent,'2026-W53');
 }finally{n.close();}
});
test('all MM uses L5 even when L4 has dates, a different owner, or a manual override',async()=>{
 const f=await fixture('editor',allocationSeed());try{
  const C=f.w.ResearchCalendar,tasks=f.w.ResearchAtlas.getState().tasks;
  const before=clone(C.resourceSummary(tasks,'2026-11-01','2026-11-30'));
  tasks.find(t=>t.id==='root').owner='Root only';tasks.find(t=>t.id==='root').ownerAllocations=[{owner:'Root only',percent:700}];tasks.find(t=>t.id==='root').allocationMode='manual';
  assert.deepEqual(clone(C.resourceSummary(tasks,'2026-11-01','2026-11-30')),before);
  assert.equal(C.resourceSummary([tasks.find(t=>t.id==='root')],'2026-11-01','2026-11-30').length,0);
  assert.equal(C.resourceSummary(tasks,'2026-11-16','2026-11-30').some(row=>row.owner==='A'),false);
 }finally{f.close();}
});
test('L4 derives peak concurrent L5 demand, refreshes on changes, and supports a persisted display-only override',async()=>{
 const f=await fixture('editor',allocationSeed());try{
  const {w,document:d}=f,api=w.ResearchAtlas,C=w.ResearchCalendar;
  const tasks=api.getState().tasks;assert.equal(C.taskAllocations(tasks[0],tasks).find(row=>row.owner==='A').percent,130);
  api.operations.openTask('root');assert.equal(d.querySelector('[data-allocation-owner="A"]').value,'130');assert.equal(d.querySelector('[data-allocation-owner="A"]').readOnly,true);
  const mode=d.querySelector('#l4-allocation-manual');mode.checked=true;mode.dispatchEvent(new w.Event('change',{bubbles:true}));
  const input=d.querySelector('[data-allocation-owner="A"]');assert.equal(input.readOnly,false);input.value='145';input.dispatchEvent(new w.Event('input',{bubbles:true}));d.querySelector('#task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  const saved=api.validateState(api.getState());assert.equal(saved.tasks[0].allocationMode,'manual');assert.equal(saved.tasks[0].ownerAllocations.find(row=>row.owner==='A').percent,145);
  assert.equal(C.taskAllocations(saved.tasks[0],saved.tasks).find(row=>row.owner==='A').percent,145);assert.match(d.querySelector('[data-resource-owner="A"]').textContent,/130%/);
  api.operations.openTask('root');d.querySelector('#l4-allocation-manual').checked=false;d.querySelector('#l4-allocation-manual').dispatchEvent(new w.Event('change',{bubbles:true}));d.querySelector('#task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.equal(api.getState().tasks[0].allocationMode,'derived');assert.equal(C.taskAllocations(api.getState().tasks[0],api.getState().tasks).find(row=>row.owner==='A').percent,130);
  api.operations.openTask('deep');d.querySelector('[data-allocation-input]').value='40';d.querySelector('#task-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();
  assert.equal(C.taskAllocations(api.getState().tasks[0],api.getState().tasks).find(row=>row.owner==='A').percent,150);
 }finally{f.close();}
});
test('L4 peak sums only simultaneously scheduled L5 and does not add sequential peaks',async()=>{
 const f=await fixture('editor',allocationSeed());try{
  const C=f.w.ResearchCalendar,tasks=[{id:'parent',owner:'A'},...[
   {id:'first',start:'2026-11-02',end:'2026-11-08',percent:70},
   {id:'second',start:'2026-11-09',end:'2026-11-15',percent:80}
  ].map(t=>({...t,parentId:'parent',owner:'A',ownerAllocations:[{owner:'A',percent:t.percent}]}))];
  assert.equal(C.taskAllocations(tasks[0],tasks)[0].percent,80);
  tasks[2].start='2026-11-08';assert.equal(C.taskAllocations(tasks[0],tasks)[0].percent,150);
 }finally{f.close();}
});
test('roadmap resources use this week, this month and this year independently of chart navigation',async()=>{
 const initial=allocationSeed();initial.tasks.push({id:'future-allocation',title:'Future',parentId:'root',goalId:'g1',owner:'A',ownerAllocations:[{owner:'A',percent:90}],start:'2027-02-01',end:'2027-02-28',planUnit:'week'});
 const f=await fixture('editor',initial,[],'2026-11-17');try{
  const d=f.document,heading=()=>d.querySelector('#roadmap-resources').textContent;
  assert.match(heading(),/이번 주.*2026-W47/);assert.match(heading(),/2026-11-16 ~ 2026-11-22/);assert.equal(d.querySelector('[data-resource-owner="A"] .resource-percent').textContent,'0%');assert.match(d.querySelector('[data-resource-owner="A"]').textContent,/이 기간에 배정된 L5 없음/);
  d.querySelector('[data-step-period="1"]').click();assert.match(heading(),/2026-11-16 ~ 2026-11-22/);
  d.querySelector('[data-unit="month"]').click();assert.match(heading(),/이번 달/);assert.match(heading(),/2026-11-01 ~ 2026-11-30/);assert.match(d.querySelector('[data-resource-owner="A"]').textContent,/130%/);
  d.querySelector('[data-unit="year"]').click();assert.match(heading(),/올해/);assert.match(heading(),/2026-01-01 ~ 2026-12-31/);assert.match(d.querySelector('[data-resource-owner="A"]').textContent,/0.29 MM/);
 }finally{f.close();}
});
const resourceOrder=f=>[...f.document.querySelectorAll('#roadmap-resources [data-resource-owner]')].map(card=>card.dataset.resourceOwner);
test('resource roster includes more than three owners across L4, future, pending and paused work without inflating MM',async()=>{
 const initial=allocationSeed();initial.tasks.push(
  {id:'root-only',title:'L4 only',goalId:'g1',owner:'D',start:'2026-11-01',end:'2026-11-30',ownerAllocations:[{owner:'D',percent:200}],allocationMode:'manual'},
  {id:'future-owner',title:'Future',parentId:'root',goalId:'g1',owner:'E',start:'2027-02-01',end:'2027-02-28',ownerAllocations:[{owner:'E',percent:100}]},
  {id:'pending-owner',title:'Pending',parentId:'root',goalId:'g1',owner:'F',ownerAllocations:[{owner:'F',percent:60}]},
  {id:'paused-owner',title:'Paused',parentId:'root',goalId:'g1',owner:'G',start:'2026-11-01',end:'2026-11-30',status:'paused',ownerAllocations:[{owner:'G',percent:80}]},
  {id:'zero-owner',title:'Zero',parentId:'root',goalId:'g1',owner:'H',start:'2026-11-01',end:'2026-11-30',ownerAllocations:[{owner:'H',percent:0}]}
 );initial.settings={resourceOwnerOrder:['Deleted owner']};
 const f=await fixture('editor',initial);try{
  const {w,document:d}=f;d.querySelector('[data-unit="month"]').click();
  assert.deepEqual(resourceOrder(f),['A','B','C','D','E','F','G','H']);
  assert.equal(d.querySelector('.resource-owner-count').textContent,'8명');
  for(const name of ['D','E','F','G']){
   const card=d.querySelector(`[data-resource-owner="${name}"]`);
   assert.equal(card.querySelector('.resource-percent').textContent,'0%');assert.match(card.textContent,/0.00 MM/);assert.ok(card.querySelector('.resource-period-empty'));
  }
  assert.match(d.querySelector('[data-resource-owner="C"]').textContent,/미입력.*MM 미산정/);
  assert.equal(d.querySelector('[data-resource-owner="H"] .resource-period-empty'),null);
  const rows=w.ResearchCalendar.resourceSummary(w.ResearchAtlas.getState().tasks,'2026-11-01','2026-11-30');
  assert.equal(rows.find(r=>r.owner==='A').mm,0.29);assert.equal(rows.find(r=>r.owner==='D'),undefined);
  assert.equal(f.puts.length,0,'rendering the roster never writes shared research data');
  assert.equal(w.ResearchAtlas.operations.reorderResourceOwner('D','A'),true);await tick();assert.equal(resourceOrder(f)[0],'D');
  assert.equal(f.puts.at(-1).state.settings.resourceOwnerOrder.includes('D'),true);
  for(const unit of ['year','week','month']){d.querySelector(`[data-unit="${unit}"]`).click();assert.equal(resourceOrder(f).length,8);}
  d.querySelector('[data-view="overview"]').click();assert.equal(d.querySelectorAll('[data-resource-owner]').length,8);
 }finally{f.close();}
});
test('resource owner filters remain explicit and exclude unselected people while preserving full totals',async()=>{
 const f=await fixture('editor',allocationSeed());try{
  chooseFilter(f,'owner',['C','A']);
  assert.deepEqual(resourceOrder(f),['A','C']);assert.equal(f.document.querySelector('.resource-owner-count').textContent,'2명 / 필터 적용');
  assert.match(f.document.querySelector('[data-resource-owner="A"]').textContent,/130%/);
 }finally{f.close();}
});
test('resource order changes by buttons and keyboard, persists across views, validation and sync, and preserves absent people',async()=>{
 const initial=allocationSeed();initial.settings={colors:{research:'#3479e9'},resourceOwnerOrder:['Not this week','C','B','A']};
 const f=await fixture('editor',initial);try{
  const {w,document:d}=f;assert.deepEqual(resourceOrder(f),['C','B','A']);
  d.querySelector('[data-resource-move="up"][data-owner="A"]').click();await tick();assert.deepEqual(resourceOrder(f),['C','A','B']);
  assert.deepEqual(Array.from(w.ResearchAtlas.validateState(w.ResearchAtlas.getState()).settings.resourceOwnerOrder),['Not this week','C','A','B']);
  d.querySelector('[data-resource-drag="A"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await tick();assert.deepEqual(resourceOrder(f),['A','C','B']);
  assert.equal(f.puts.at(-1).state.settings.colors.research,'#3479e9');
  d.querySelector('[data-unit="month"]').click();assert.deepEqual(resourceOrder(f),['A','C','B']);d.querySelector('[data-view="overview"]').click();assert.deepEqual([...d.querySelectorAll('[data-resource-owner]')].map(card=>card.dataset.resourceOwner),['A','C','B']);
 }finally{f.close();}
});
test('resource drag reorder saves and cancelled drags and readers never mutate order',async()=>{
 const f=await fixture('editor',allocationSeed());try{
  const {w,document:d}=f,host=d.querySelector('#roadmap-resources'),before=clone(w.ResearchAtlas.getState()),drag=d.querySelector('[data-resource-drag="C"]');
  drag.dispatchEvent(new w.Event('dragstart',{bubbles:true}));host.dispatchEvent(new w.Event('dragend',{bubbles:true}));assert.deepEqual(clone(w.ResearchAtlas.getState()),before);
  d.querySelector('[data-resource-drag="C"]').dispatchEvent(new w.Event('dragstart',{bubbles:true}));d.querySelector('[data-resource-owner="A"]').dispatchEvent(new w.MouseEvent('drop',{clientY:0,bubbles:true,cancelable:true}));await tick();
  assert.equal(resourceOrder(f)[0],'C');assert.equal(f.puts.at(-1).state.settings.resourceOwnerOrder[0],'C');
 }finally{f.close();}
 const r=await fixture('reader',allocationSeed());try{assert.equal(r.document.querySelector('[data-resource-drag]'),null);assert.equal(r.w.ResearchAtlas.operations.reorderResourceOwner('C','A'),false);assert.equal(r.puts.length,0);}finally{r.close();}
});
test('failed order persistence restores both prior order and unrelated settings',async()=>{
 const f=await fixture('editor',allocationSeed());try{
  const before=clone(f.w.ResearchAtlas.getState());f.w.Storage.prototype.setItem=()=>{throw Error('full');};
  assert.equal(f.w.ResearchAtlas.operations.reorderResourceOwner('C','A'),false);assert.deepEqual(clone(f.w.ResearchAtlas.getState()),before);assert.match(f.document.querySelector('#toast').textContent,/순서 변경을 취소/);
 }finally{f.close();}
});
test('per-person resource view follows the roadmap MM rules by month and by week, with team-resource period keys',async()=>{
 const f=await fixture('editor',allocationSeed());try{
  const {w,document:d}=f,R=w.ResearchResources,tasks=w.ResearchAtlas.getState().tasks;
  const range=R.planRange(tasks);assert.equal(range.start+'~'+range.end,'2026-11-01~2026-11-30');
  const month=R.plan(tasks,{...range,unit:'month'}),a=month.people.find(p=>p.owner==='A'),b=month.people.find(p=>p.owner==='B');
  const summary=w.ResearchCalendar.resourceSummary(tasks,'2026-11-01','2026-11-30');
  assert.deepEqual([...month.periods.map(p=>p.key)],['2026-11']);
  assert.equal(a.mm,summary.find(r=>r.owner==='A').mm);assert.equal(b.mm,summary.find(r=>r.owner==='B').mm);
  assert.equal(a.peak,130);assert.equal(a.periods[0].overDays,5);assert.equal(b.periods[0].average,30);
  assert.equal(month.people.find(p=>p.owner==='C').missing.length,1);assert.equal(month.people.some(p=>p.taskIds.includes('root')),false,'L4 allocations never count');
  const week=R.plan(tasks,{...range,unit:'week'}),aw=week.people.find(p=>p.owner==='A');
  assert.deepEqual([...week.periods.map(p=>p.key)],['2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30'],'weeks start on Monday like 팀 리소스, and a week with no weekday in range is left out');
  assert.deepEqual([...week.periods.slice(0,2).map(p=>p.label)],['11월 1주','11월 2주']);
  assert.equal(aw.periods[1].average,122);assert.equal(aw.periods[1].peak,130);assert.equal(aw.periods[0].average,0);
  d.querySelector('[data-view="resources"]').click();
  assert.match(d.querySelector('.rp-matrix').textContent,/11월/);
  d.querySelector('[data-resource-unit="week"]').click();d.querySelector('[data-resource-person="B"]').click();
  assert.equal(d.querySelector('[data-resource-unit="week"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelector('.rp-person h2').textContent,'B');assert.equal(d.querySelectorAll('.rp-matrix thead th').length,7);
  d.querySelector('[data-resource-task="b-work"]').click();assert.equal(d.querySelector('#task-dialog').open,true);
  assert.equal(f.puts.length,0,'viewing resources never writes the research state');
 }finally{f.close();}
});
