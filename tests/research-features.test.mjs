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
async function fixture(role='editor', initial=seed, catalog=[]) {
  const html=(await readFile(new URL('work-app/index.html',root),'utf8')).replace(/<script[^>]*src=[^>]*><\/script>/g,'');
  const dom=new JSDOM(html,{url:'https://fixture.invalid/work/app/index.html',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,puts=[],gets=[];let remote={revision:'4',state:clone(initial)};
  w.scrollTo=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.WORK_CONTEXT={mode:'supabase',storageKey:'synthetic-'+role,role};w.RESEARCH_SEED=clone(initial);w.RESEARCH_TAXONOMY_SOURCE={catalog};w.RESEARCH_LEGACY_SEED=clone(seed);w.WORK_INITIAL_ENVELOPE=clone(remote);
  w.fetch=async(url,options={})=>{
    assert.equal(url,'/api/research-state');
    if(options.method==='PUT'){const payload=JSON.parse(options.body);puts.push(payload);assert.equal(payload.revision,remote.revision);remote={revision:String(+remote.revision+1),state:clone(payload.state)};}
    else gets.push(url);
    return {ok:true,status:200,json:async()=>clone(remote)};
  };
  for(const name of ['papers','taxonomy','notebook','periods','hierarchy','timeline','calendar','workspace-sync','app'])w.eval(await readFile(new URL(`work-app/${name}.js`,root),'utf8'));
  await tick();
  return {w,document:w.document,puts,gets,close:()=>w.close()};
}

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
