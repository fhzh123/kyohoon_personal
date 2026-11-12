import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const root=new URL('../',import.meta.url);
const clone=value=>JSON.parse(JSON.stringify(value));
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
const seed={version:4,goals:[{id:'g1',title:'검증용 연구축'}],phases:[],notes:[],references:[],tasks:[
  {id:'root',title:'현재 연구',goalId:'g1',start:'2026-11-02',end:'2026-12-06',planUnit:'week'},
  {id:'child',title:'세부 연구',parentId:'root',goalId:'g1',start:'2026-11-09',end:'2026-11-15',planUnit:'week'},
  {id:'done',title:'표 형식의 데이터를 분석하는 기술',goalId:'g1',status:'done'},
  {id:'future',title:'원천 데이터의 구조화 모달리티 확장 기술',goalId:'g1'}
]};
async function fixture(role='editor') {
  const html=(await readFile(new URL('work-app/index.html',root),'utf8')).replace(/<script[^>]*src=[^>]*><\/script>/g,'');
  const dom=new JSDOM(html,{url:'https://fixture.invalid/work/app/index.html',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,puts=[],gets=[];let remote={revision:'4',state:clone(seed)};
  w.scrollTo=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.WORK_CONTEXT={mode:'supabase',storageKey:'synthetic-'+role,role};w.RESEARCH_SEED=clone(seed);w.WORK_INITIAL_ENVELOPE=clone(remote);
  w.fetch=async(url,options={})=>{
    assert.equal(url,'/api/research-state');
    if(options.method==='PUT'){const payload=JSON.parse(options.body);puts.push(payload);assert.equal(payload.revision,remote.revision);remote={revision:String(+remote.revision+1),state:clone(payload.state)};}
    else gets.push(url);
    return {ok:true,status:200,json:async()=>clone(remote)};
  };
  for(const name of ['papers','periods','hierarchy','timeline','workspace-sync','app'])w.eval(await readFile(new URL(`work-app/${name}.js`,root),'utf8'));
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
