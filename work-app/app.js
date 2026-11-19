(() => {
  'use strict';
  const P = window.ResearchPeriods, H = window.ResearchHierarchy;
  const MIN_DATE = P.MIN_DATE, KEY = window.WORK_CONTEXT.storageKey;
  const readOnly = window.WORK_CONTEXT.role === 'reader';
  const RECOVERY = KEY + '-recovery', BEFORE_WEEKLY = KEY + '-before-weekly-v2', BEFORE_HIERARCHY = KEY + '-before-hierarchy-v3', BEFORE_TAXONOMY=KEY+'-before-taxonomy-v4';
  const $ = (s, root = document) => root.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = () => 'r' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const units = {week:'주차별', month:'월별', year:'연도별'};
  const categories = {research:'연구/조사',implementation:'코드 구현',design:'실험 설계',experiment:'실험 검증',writing:'문서 정리',meeting:'추가 협의'};
  const statuses = {backlog:'기간 미정',planned:'계획',active:'진행 중',done:'완료',paused:'보류'};
  const defaultColors = {research:'#3479e9',implementation:'#64748b',design:'#b78231',experiment:'#12a898',writing:'#527f97',meeting:'#b06c43'};
  const views = {roadmap:'연구 로드맵',overview:'연간 조망',resources:'담당자 리소스',backlog:'연구 후보',goals:'L3 연구축',notes:'연구 노트',settings:'설정'};
  const alias = key => ({calendar:'roadmap',gantt:'roadmap',references:'roadmap'}[key] || key);
  let hasUserData=false, workspaceSync=null, workspaceMessage='이 브라우저에 자동 저장';
  let state = validateState(clone(window.RESEARCH_SEED));
  const today = () => P.iso(new Date());
  const initialDate = today() < MIN_DATE ? MIN_DATE : today();
  let view='roadmap', unit='week', anchor=initialDate, selectedYear=Number(initialDate.slice(0,4)), overviewMonth=Number(initialDate.slice(5,7));
  let search='',goalFilter=null,categoryFilter=null,statusFilter=null,ownerFilter=null;
  let dirty=false, storageFailed=false, sourceIssue='', memoryRecovery=null, toastTimer, lastFocus=null;
  let taskSnapshot='', periodEdited=false, editorDraft=null, commitEditor=null, editorEvents=null;
  try { const raw=readOnly?null:localStorage.getItem(KEY); if(raw) {state=validateState(JSON.parse(raw));hasUserData=true;} }
  catch(e) { storageFailed=true; sourceIssue='기존 데이터를 읽지 못했습니다. 저장본을 덮어쓰지 않았습니다. 백업 메뉴에서 복구해 주세요.'; }

  function validateState(data) {
    if(!data || ![1,2,3,4].includes(data.version) || !['goals','phases','tasks','notes','references'].every(k=>Array.isArray(data[k]))) throw Error('지원하는 Research Atlas 백업이 아닙니다.');
    const out={version:data.version===4?4:3,annualPlans:[]};
    for(const key of ['deletedGoalIds','deletedTaskIds']) {
      if(data[key]!==undefined && (!Array.isArray(data[key])||data[key].some(id=>typeof id!=='string')))throw Error('삭제 기록 형식을 확인해 주세요.');
      out[key]=[...new Set(data[key]||[])];
    }
    if(data.taxonomyVersion)out.taxonomyVersion=data.taxonomyVersion;
    if(Array.isArray(data.legacyGroups))out.legacyGroups=clone(data.legacyGroups);
    if(data.settings!==undefined){
      if(!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw Error('설정 형식을 확인해 주세요.');
      const colors=data.settings.colors||{};
      if(typeof colors!=='object'||Array.isArray(colors))throw Error('색상 설정 형식을 확인해 주세요.');
      out.settings={colors:{}};
      if(data.settings.resourceOwnerOrder!==undefined){
        if(!Array.isArray(data.settings.resourceOwnerOrder)||data.settings.resourceOwnerOrder.some(name=>typeof name!=='string'||!name.trim()))throw Error('담당자 순서 형식을 확인해 주세요.');
        out.settings.resourceOwnerOrder=[...new Set(data.settings.resourceOwnerOrder.map(name=>name.trim()))];
      }
      for(const key of Object.keys(categories))if(colors[key]!==undefined){
        if(typeof colors[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(colors[key]))throw Error('올바른 색상 코드를 입력해 주세요.');
        out.settings.colors[key]=colors[key].toLowerCase();
      }
    }
    const fields={goals:['description','metric','color'],phases:['description','goalId'],tasks:['start','end','status','category','goalId','phaseId','description','deliverable','notes','owner','updatedAt'],notes:['body','kind','url','goalId','updatedAt'],references:['src','description']};
    for(const key of Object.keys(fields)) {
      const ids=new Set();
      out[key]=data[key].map(item=>{
        if(!item || typeof item!=='object' || typeof item.id!=='string' || !item.id || ids.has(item.id) || typeof item.title!=='string') throw Error('중복 ID 또는 항목 제목을 확인해 주세요.');
        ids.add(item.id); const obj={...item};
        for(const name of fields[key]) obj[name]=typeof obj[name]==='string'?obj[name]:'';
        for(const [name,value] of Object.entries(obj)) if(!['dependencies','papers','ownerAllocations'].includes(name) && value!==null && !['string','number','boolean'].includes(typeof value)) delete obj[name];
        if(key==='notes')obj.papers=window.ResearchPapers?.normalize(item.papers)||[];
        if(key==='tasks') {
          if(item.parentId!==undefined && typeof item.parentId!=='string')throw Error('상위 연구 ID는 문자열이어야 합니다.');
          obj.parentId=item.parentId||'';
          if(item.ownerAllocations!==undefined)obj.ownerAllocations=window.ResearchCalendar.normalizeAllocations(obj.owner,item.ownerAllocations,obj.parentId?100:Infinity);
          if(item.allocationMode!==undefined&&!['derived','manual'].includes(item.allocationMode))throw Error('L4 리소스 집계 방식을 확인해 주세요.');
          obj.roadmapHidden=typeof item.roadmapHidden==='boolean'?item.roadmapHidden:/표 형식의 데이터를|원천 데이터의 구조화 모달리티 확장/.test([item.title,item.officialTitle].join(' '));
          obj.papers=window.ResearchPapers?.normalize(item.papers)||[];
          if(!Number.isFinite(obj.sortOrder))delete obj.sortOrder;
          if(!!obj.start!==!!obj.end || (obj.start && (!P.validDate(obj.start)||!P.validDate(obj.end)||obj.start<MIN_DATE||obj.end<obj.start))) throw Error('올바른 연구 기간을 확인해 주세요. 2026년 11월 이후여야 합니다.');
          obj.category=obj.category==='milestone'?'writing':Object.hasOwn(categories,obj.category)?obj.category:'research';
          obj.status=Object.hasOwn(statuses,obj.status)?obj.status:(obj.start?'planned':'backlog');
          obj.dependencies=Array.isArray(item.dependencies)?item.dependencies.filter(x=>typeof x==='string'):[];
          obj.planUnit=['day',...Object.keys(units)].includes(item.planUnit)?item.planUnit:'day';
          // Preserve historical dates exactly; display scale never changes stored dates.
          obj.legacyDates=item.legacyDates===true;
        }
        return obj;
      });
    }
    H.validate(out.tasks);
    if(data.annualPlans!==undefined) {
      if(!Array.isArray(data.annualPlans)) throw Error('연간 방향 데이터 형식을 확인해 주세요.');
      const years=new Set();
      out.annualPlans=data.annualPlans.map(plan=>{
        if(!plan || !Number.isInteger(plan.year)||plan.year<2026||plan.year>9998||years.has(plan.year)) throw Error('연간 계획의 연도를 확인해 주세요.');
        years.add(plan.year);
        return {year:plan.year,...Object.fromEntries(['focus','success','notes'].map(k=>[k,typeof plan[k]==='string'?plan[k]:'']))};
      });
    }
    if(!window.ResearchTaxonomy)return out;
    const migrated=window.ResearchTaxonomy.migrate(out);
    return out.taxonomyVersion!==migrated.taxonomyVersion?validateState(migrated):migrated;
  }
  function save({sync=true}={}) {
    if(readOnly&&sync){toast('읽기 전용 계정에서는 변경할 수 없습니다.');return false;}
    if(storageFailed) { toast('브라우저 저장을 사용할 수 없습니다. JSON 백업으로 보관해 주세요.'); return false; }
    try {
      const previous=localStorage.getItem(KEY);
      let previousVersion=null;
      if(previous) {try {previousVersion=JSON.parse(previous).version;} catch(e) {if(!localStorage.getItem(KEY+'-unreadable'))localStorage.setItem(KEY+'-unreadable',previous);}}
      if(previousVersion===1 && !localStorage.getItem(BEFORE_WEEKLY)) localStorage.setItem(BEFORE_WEEKLY,previous);
      if([1,2].includes(previousVersion) && !localStorage.getItem(BEFORE_HIERARCHY))localStorage.setItem(BEFORE_HIERARCHY,previous);
      if(previousVersion&&previousVersion<4&&!localStorage.getItem(BEFORE_TAXONOMY))localStorage.setItem(BEFORE_TAXONOMY,previous);
      localStorage.setItem(KEY,JSON.stringify(state));hasUserData=true; $('#storage-status').textContent=workspaceMessage;
      if(sync&&workspaceSync)workspaceSync.save(clone(state));return true;
    } catch(e) {storageFailed=true;$('#storage-status').textContent='저장 실패 · 백업 필요';toast('현재 내용을 JSON 백업으로 저장해 주세요.');return false;}
  }
  function toast(message) {$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
  function navigate(next) {
    next=alias(next);if(!views[next])return;
    const changed=view!==next;view=next;location.hash=next;render();if(changed)window.scrollTo?.(0,0);
  }
  const taskOwners=task=>{const names=window.ResearchCalendar.ownersOf(task);return names.length?names:[''];};
  function filteredTasks() {return state.tasks.filter(t=>(!search||[t.title,t.officialTitle,t.description,t.deliverable,t.notes].join(' ').toLowerCase().includes(search.toLowerCase()))&&(goalFilter===null||goalFilter.includes(t.goalId||''))&&(categoryFilter===null||categoryFilter.includes(t.category))&&(statusFilter===null||statusFilter.includes(t.status))&&(ownerFilter===null||taskOwners(t).some(name=>ownerFilter.includes(name))));}
  function goalOptions(value,empty='모든 L3 연구축') {return `<option value="">${esc(empty)}</option>`+state.goals.map(g=>`<option value="${esc(g.id)}" ${g.id===value?'selected':''}>${esc(g.title)}</option>`).join('');}
  function options(map,value,empty) {return (empty!==undefined?`<option value="">${esc(empty)}</option>`:'')+Object.entries(map).map(([k,v])=>`<option value="${esc(k)}" ${value===k?'selected':''}>${esc(v)}</option>`).join('');}
  function statsHTML() {
    const roots=state.tasks.filter(t=>!t.parentId),allocated=roots.filter(t=>H.effectiveRange(state.tasks,t.id).start).length,subtasks=state.tasks.length-roots.length;
    return [['L3 연구축',state.goals.length,'L4 기술과 L5 세부 연구를 묶는 연구축','◎'],['기간을 잡은 L4',allocated,`L4 기술 ${roots.length}개 · L5 세부 연구 ${subtasks}개`,'▤'],['기간 미정 L4',roots.length-allocated,'각 기술의 전체 기간과 세부 기간을 나누어 계획','◇'],['연결된 연구 기록',state.notes.length,'논문과 긴 연구 메모를 함께','▧']].map(([label,n,meta,icon])=>`<div class="stat-card"><div class="stat-label">${label}</div><span class="stat-icon">${icon}</span><div class="stat-value">${n}<small>개</small></div><p class="stat-meta">${meta}</p></div>`).join('');
  }
  function updateStats() {$('#stats').innerHTML=statsHTML();}
  function palette(){return {...defaultColors,...state.settings?.colors};}
  function render() {
    window.ResearchTimeline?.destroy?.();
    // The shared Work sidebar owns these links; only the current item changes here.
    $('#navigation').querySelectorAll('[data-view]').forEach(link=>{const on=link.dataset.view===view;link.classList.toggle('is-active',on);if(on)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
    $('#breadcrumb-view').textContent=views[view];
    const titles={roadmap:['연구 로드맵','L4 연구의 기간을 배정하고 L5 세부 작업을 관리합니다.'],overview:['연간 조망','월별 핵심 성과와 분기별 연구 주제를 확인합니다.'],resources:['담당자 리소스','팀원마다 L5 계획에 배정된 리소스를 월별, 주별로 봅니다.'],backlog:['연구 후보','기간 미정인 연구와 진행 중인 연구를 함께 관리합니다.'],goals:['L3 연구축','L3 연구축에 L4 기술과 L5 세부 연구를 연결합니다.'],notes:['연구 노트','회의록, 논문 검토, 실험 메모를 기록합니다.'],settings:['설정','화면 테마와 연구 분류별 색상을 설정합니다.'],references:['연구 자료','로드맵과 목표 정의, 참고 자료를 확인합니다.']};
    $('#page-title').textContent=titles[view][0];$('#page-description').textContent=titles[view][1];updateStats();
    const host=$('#view-host');$('#stats').hidden=view==='settings'||view==='resources';
    if(view==='roadmap')renderRoadmap(host);
    else if(view==='overview')renderOverview(host);
    else if(view==='resources')window.ResearchResources.render(host,{state,escape:esc,openTask});
    else if(view==='settings')renderSettings(host);
    else if(view==='backlog'){host.innerHTML=backlogHTML();bindFilters();bindTasks(host);}
    else window.ResearchNotebook.render(view,host,{state,readOnly,escape:esc,uid,save,refresh:render,toast,openTask,navigate,rememberRecovery,updateStats,hierarchy:H,categoryLabels:categories,statusLabels:statuses});
  }
  function filterConfigs(){
    const people=[...new Set(state.tasks.flatMap(t=>window.ResearchCalendar.ownersOf(t)))].sort((a,b)=>a.localeCompare(b,'ko'));
    return [
      {name:'goal',id:'goal-filter',title:'L3 연구축',allLabel:'모든 L3 연구축',emptyLabel:'L3 선택 없음',unit:'개',hint:'원하는 연구축을 여러 개 선택하세요.',choices:[...state.goals.map(g=>({id:g.id,title:g.title})),{id:'',title:'L3 연결 전'}],selected:goalFilter,set:v=>goalFilter=v},
      {name:'category',id:'category-filter',title:'연구 유형',allLabel:'모든 연구 유형',emptyLabel:'연구 유형 선택 없음',unit:'개',hint:'보고 싶은 연구 유형을 선택하세요.',choices:Object.entries(categories).map(([id,title])=>({id,title})),selected:categoryFilter,set:v=>categoryFilter=v},
      {name:'status',id:'status-filter',title:'상태',allLabel:'모든 상태',emptyLabel:'상태 선택 없음',unit:'개',hint:'보고 싶은 진행 상태를 선택하세요.',choices:Object.entries(statuses).map(([id,title])=>({id,title})),selected:statusFilter,set:v=>statusFilter=v},
      {name:'owner',id:'owner-filter',title:'담당자',allLabel:'모든 담당자',emptyLabel:'담당자 선택 없음',unit:'명',hint:'여러 담당자를 선택할 수 있으며 공동 담당 연구도 포함됩니다.',choices:[...people.map(name=>({id:name,title:name})),{id:'',title:'담당 미정'}],selected:ownerFilter,set:v=>ownerFilter=v}
    ];
  }
  function checkboxFilterHTML(config){
    const {name,id,title,allLabel,emptyLabel,unit,hint,choices}=config,selected=config.selected===null?choices.map(c=>c.id):config.selected;
    const summary=config.selected===null?allLabel:selected.length?`${title} ${selected.length}${unit} 선택`:emptyLabel;
    return `<details class="goal-filter task-filter" id="${id}" data-filter-kind="${name}"><summary aria-label="${title} 필터">${esc(summary)}<span aria-hidden="true">⌄</span></summary><div class="goal-filter-menu"><div class="goal-filter-header"><strong>${title} 선택</strong><small>${esc(hint)}</small></div><label class="goal-filter-all"><input type="checkbox" data-filter-all data-${name}-filter-all ${choices.every(c=>selected.includes(c.id))?'checked':''}>전체 선택</label><div class="goal-filter-choices">${choices.map(c=>`<label><input type="checkbox" data-filter-choice data-${name}-filter-choice value="${esc(c.id)}" ${selected.includes(c.id)?'checked':''}><span>${esc(c.title)}</span></label>`).join('')}</div><div class="goal-filter-footer"><span data-filter-count data-${name}-filter-count>${selected.length}${unit} 선택</span><button type="button" class="secondary-button" data-filter-cancel data-${name}-filter-cancel>취소</button><button type="button" class="primary-button" data-filter-apply data-${name}-filter-apply>적용</button></div></div></details>`;
  }
  function filtersHTML() {
    return `<div class="planning-filters">${filterConfigs().map(checkboxFilterHTML).join('')}${search||[goalFilter,categoryFilter,statusFilter,ownerFilter].some(v=>v!==null)?'<button class="text-button" id="clear-filters">필터 초기화</button>':''}</div>`;
  }
  function bindFilters() {
    for(const config of filterConfigs()){
      const picker=$('#'+config.id);if(!picker)continue;
      const inputs=[...picker.querySelectorAll('[data-filter-choice]')],all=picker.querySelector('[data-filter-all]');
      const update=()=>{const count=inputs.filter(i=>i.checked).length;all.checked=count===inputs.length;all.indeterminate=count>0&&count<inputs.length;picker.querySelector('[data-filter-count]').textContent=count+config.unit+' 선택';};
      const reset=()=>{inputs.forEach(i=>i.checked=config.selected===null||config.selected.includes(i.value));update();};
      picker.addEventListener('toggle',()=>{if(picker.open){document.querySelectorAll('.task-filter[open]').forEach(other=>{if(other!==picker)other.open=false;});reset();}});
      all.onchange=()=>{inputs.forEach(i=>i.checked=all.checked);update();};
      inputs.forEach(i=>i.onchange=update);
      picker.querySelector('[data-filter-cancel]').onclick=()=>{picker.open=false;picker.querySelector('summary').focus();};
      picker.querySelector('[data-filter-apply]').onclick=()=>{const ids=inputs.filter(i=>i.checked).map(i=>i.value);config.set(ids.length===inputs.length?null:ids);render();$('#'+config.id+' summary')?.focus();};
      picker.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();picker.open=false;picker.querySelector('summary').focus();}};
      update();
    }
    if($('#clear-filters'))$('#clear-filters').onclick=()=>{goalFilter=categoryFilter=statusFilter=ownerFilter=null;search='';$('#global-search').value='';render();};
  }
  function reorderGoal(id,targetId,placement='before'){
    if(readOnly||id===targetId||!['before','after'].includes(placement))return false;
    const previous=state.goals,goal=previous.find(g=>g.id===id);
    if(!goal||!previous.some(g=>g.id===targetId))return false;
    const next=previous.filter(g=>g.id!==id),at=next.findIndex(g=>g.id===targetId)+(placement==='after'?1:0);
    next.splice(at,0,goal);if(next.every((g,index)=>g.id===previous[index].id))return false;
    state.goals=next;
    if(!save()){state.goals=previous;render();toast('저장하지 못해 L3 이동을 취소했습니다.');return false;}
    render();[...document.querySelectorAll('[data-reorder-goal]')].find(button=>button.dataset.reorderGoal===id)?.focus({preventScroll:true});
    toast('L3 순서를 저장했습니다. 하위 L4와 L5도 함께 이동했습니다.');return true;
  }
  function moveGoal(id,direction){
    if(readOnly||![-1,1].includes(direction))return false;
    const visible=state.goals.filter(g=>goalFilter===null||goalFilter.includes(g.id)),at=visible.findIndex(g=>g.id===id),target=visible[at+direction];
    if(at<0||!target)return false;
    return reorderGoal(id,target.id,direction<0?'before':'after');
  }
  function rangeHeading(cols) {
    const a=P.date(cols[0].start),b=P.date(cols.at(-1).end);
    return unit==='year'?`${a.getFullYear()} — ${b.getFullYear()}`:`${a.getFullYear()}.${String(a.getMonth()+1).padStart(2,'0')} — ${a.getFullYear()===b.getFullYear()?'':b.getFullYear()+'.'}${String(b.getMonth()+1).padStart(2,'0')}`;
  }
  function renderRoadmap(host) {
    const hiddenCount=state.tasks.filter(t=>!H.isRoadmapVisible(state.tasks,t.id)).length;
    const cols=P.columns(anchor,unit), focusYear=P.date(anchor).getFullYear(),resourcePeriod=window.ResearchCalendar.currentResourcePeriod(unit,today());
    const focus=state.annualPlans.find(p=>p.year===focusYear);
    host.innerHTML=`<section class="planning-panel"><div class="planning-toolbar"><div class="planning-tools"><h2>${rangeHeading(cols)}</h2><button type="button" id="roadmap-visibility" class="secondary-button roadmap-visibility-button">기술 표시 설정${hiddenCount?` <span>숨김 ${hiddenCount}</span>`:''}</button><button type="button" id="roadmap-today" class="secondary-button">오늘</button><label class="planning-jump"><span>기준 월</span><input id="anchor-month" type="month" min="2026-11" value="${anchor.slice(0,7)}" aria-label="로드맵 기준 월"></label></div><div class="planning-scale segmented-control" role="group" aria-label="로드맵 시간 단위">${Object.entries(units).map(([key,label])=>`<button data-unit="${key}" class="${unit===key?'active':''}" aria-pressed="${unit===key}">${label}</button>`).join('')}</div></div>${filtersHTML()}<div class="planning-caption"><span>${unit==='week'?'13주를 한눈에 · 월요일부터 일요일까지, 매월 첫 월요일이 첫째주':unit==='month'?'12개월을 한눈에 · 목표 기간은 일 단위로 설정':'5년을 한눈에 · 목표 기간은 일 단위로 설정'}</span><span>목표 기간은 달력에서 시작일과 종료일 선택</span></div><div id="roadmap-resources"></div><div id="timeline-host"></div></section><div class="bigpicture-strip"><div class="strategy-side-card"><div class="section-label">${focusYear}년의 연구 방향 <button class="text-button" id="edit-year-direction">방향 정리 ↗</button></div><p class="strategy-note">${esc(focus?.focus||'이 해의 핵심 질문을 먼저 정해 보세요. 어떤 가능성을 검증하고, 어떤 성과로 이어갈까요?')}</p></div><div class="strategy-side-card"><div class="section-label">L3별 배치</div><div class="year-goal-summary">${state.goals.filter(g=>goalFilter===null||goalFilter.includes(g.id)).map(g=>`<span class="strategy-meter"><span>${esc(g.title)}</span><strong>${state.tasks.filter(t=>t.goalId===g.id&&t.start).length}<small>개</small></strong></span>`).join('')}</div></div><div class="strategy-side-card"><div class="section-label">기획의 기준</div><p class="strategy-note">“언제까지 무엇을 밝혀낼까?”</p><p class="focus-help">하루의 할 일보다 연구 질문과 구간별 결과물에 집중해 보세요. 자세한 생각은 연구 노트에 이어서 남길 수 있어요.</p></div></div>${candidateHTML(6)}`;
    window.ResearchTimeline.render($('#timeline-host'),{state,unit,anchor,escape:esc,filteredTasks,openTask,reschedule,toast,periods:P,categories,statusLabels:statuses,colors:palette(),hierarchy:H,addChild,selectedL3Ids:goalFilter,strictTaskFilter:[categoryFilter,statusFilter,ownerFilter].some(v=>v!==null),hideEmptyGroups:!!search||[categoryFilter,statusFilter,ownerFilter].some(v=>v!==null),moveTask,reorderTask,stepPeriod,readOnly,hideTask,deleteTask:confirmDeleteTask,reorderGoal,moveGoal});
    window.ResearchCalendar.renderResources($('#roadmap-resources'),{tasks:state.tasks,...resourcePeriod,escape:esc,owners:ownerFilter,ownerOrder:state.settings?.resourceOwnerOrder,readOnly,onReorder:reorderResourceOwner});
    $('#roadmap-today').onclick=()=>{anchor=today()<MIN_DATE?MIN_DATE:today();render();};
    $('#roadmap-visibility').onclick=openRoadmapVisibility;
    bindFilters();bindTasks(host);
    host.querySelectorAll('[data-unit]').forEach(button=>button.onclick=()=>{unit=button.dataset.unit;render();});
    $('#anchor-month').onchange=e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)&&e.target.value>='2026-11'){anchor=e.target.value+'-01';render();}};
    $('#edit-year-direction').onclick=()=>{selectedYear=focusYear;navigate('overview');$('#annual-focus')?.focus();};
  }
function reorderResourceOwner(owner,target,placement='before'){
    if(readOnly||owner===target||!['before','after'].includes(placement))return false;
    const people=[...new Set(state.tasks.flatMap(t=>window.ResearchCalendar.ownersOf(t)))].sort((a,b)=>a.localeCompare(b,'ko'));
    const previous=state.settings?clone(state.settings):undefined,order=[...new Set([...(previous?.resourceOwnerOrder||[]),...people])];
    if(!order.includes(owner)||!order.includes(target))return false;
    const next=order.filter(name=>name!==owner);next.splice(next.indexOf(target)+(placement==='after'?1:0),0,owner);
    if(next.every((name,i)=>name===order[i]))return false;
    state.settings={...previous,resourceOwnerOrder:next};
    if(!save()){if(previous)state.settings=previous;else delete state.settings;render();toast('저장하지 못해 담당자 순서 변경을 취소했습니다.');return false;}
    render();[...document.querySelectorAll('[data-resource-drag]')].find(b=>b.dataset.resourceDrag===owner)?.focus({preventScroll:true});return true;
}
  function openRoadmapVisibility() {
    const draft=new Map(state.tasks.map(t=>[t.id,!t.roadmapHidden]));
    const effective=t=>draft.get(t.id)&&H.ancestorsOf(state.tasks,t.id).every(a=>draft.get(a.id));
    showUtility('로드맵에 표시할 기술',`<p class="visibility-intro">지금 집중할 기술만 선택하세요. 숨긴 기술의 일정, 세부 연구와 논문은 보관되며 언제든 다시 표시할 수 있습니다. 상위 기술을 숨기면 그 아래 연구도 함께 가려집니다.</p><div class="visibility-tools"><label><input id="visibility-all" type="checkbox" ${readOnly?'disabled':''}> 전체 선택</label><span id="visibility-count" class="field-help"></span></div><div class="visibility-list">${state.tasks.filter(t=>!t.parentId).flatMap(t=>[t,...H.descendantsOf(state.tasks,t.id)]).map(t=>`<label class="visibility-row ${t.parentId?'is-child':''}" data-visibility-row="${esc(t.id)}"><input type="checkbox" data-visible-task="${esc(t.id)}" ${draft.get(t.id)?'checked':''} ${readOnly?'disabled':''}><span>${esc(t.title)}<small>${t.parentId?'L5 세부 연구':esc(state.goals.find(g=>g.id===t.goalId)?.title||'L4 기술')} / ${statuses[t.status]}</small></span></label>`).join('')}</div>`,`<button type="button" class="secondary-button" id="visibility-cancel">닫기</button>${readOnly?'':'<button type="button" class="primary-button" id="visibility-apply">표시 적용</button>'}`);
    const dialog=$('#utility-dialog'), all=$('#visibility-all');
    const update=()=>{
      const visible=state.tasks.filter(effective).length;
      $('#visibility-count').textContent=`${visible}개 표시, ${state.tasks.length-visible}개 숨김`;
      all.checked=visible===state.tasks.length;all.indeterminate=visible>0&&visible<state.tasks.length;
      dialog.querySelectorAll('[data-visible-task]').forEach(input=>{
        const task=state.tasks.find(t=>t.id===input.dataset.visibleTask),inherited=H.ancestorsOf(state.tasks,task.id).some(a=>!draft.get(a.id));
        input.disabled=readOnly||inherited;input.closest('label').classList.toggle('is-inherited',inherited);
        input.closest('label').title=inherited?'상위 기술을 표시하면 다시 선택할 수 있습니다.':'';
      });
    };
    dialog.querySelectorAll('[data-visible-task]').forEach(input=>input.onchange=()=>{draft.set(input.dataset.visibleTask,input.checked);update();});
    all.onchange=()=>{state.tasks.forEach(t=>draft.set(t.id,all.checked));dialog.querySelectorAll('[data-visible-task]').forEach(input=>input.checked=all.checked);update();};
    $('#visibility-cancel').onclick=()=>dialog.close();
    if(!readOnly)$('#visibility-apply').onclick=()=>{state.tasks.forEach(t=>{t.roadmapHidden=!draft.get(t.id);});const ok=save();dialog.close();render();toast(ok?'로드맵 표시 설정을 저장했습니다.':'화면에 적용했습니다. 저장 상태를 확인해 주세요.');};
    update();
  }
  function candidateHTML(limit) {
    const all=filteredTasks().filter(t=>(view!=='roadmap'||H.isRoadmapVisible(state.tasks,t.id))&&!H.effectiveRange(state.tasks,t.id).start), items=limit?all.slice(0,limit):all;
    return `<section class="candidate-section"><div class="candidate-header"><div><h2>아직 구상 중인 연구 <small>${all.length}개</small></h2><p>주제를 먼저 모으고, 적절한 연구 구간에 배치하세요.</p></div><div class="button-row">${limit&&all.length>limit?'<button class="secondary-button" data-view="backlog">후보 전체 보기</button>':''}<button class="primary-button" id="new-candidate">＋ 연구 후보</button></div></div><div class="candidate-grid">${items.length?items.map(t=>`<article class="candidate-card"><span class="candidate-goal">${esc(state.goals.find(g=>g.id===t.goalId)?.title||'L3 미연결')}</span>${t.parentId?`<span class="candidate-parent">↳ ${esc(taskPath(t))}</span>`:''}<button class="candidate-title" data-task="${esc(t.id)}">${esc(t.title)}</button><p>${esc(t.deliverable||t.description||'연구 질문과 기대 결과를 적어 보세요.')}</p><div class="candidate-meta"><span class="badge">${categories[t.category]}</span><button class="text-button" data-place="${esc(t.id)}">기간 정하기 ↗</button></div></article>`).join(''):'<div class="empty-state"><strong>이 조건의 연구 후보가 없습니다.</strong><p>새로운 연구 아이디어를 추가해 보세요.</p></div>'}</div></section>`;
  }
  function backlogHTML() {
    const scheduled=filteredTasks().map(t=>({...t,...H.effectiveRange(state.tasks,t.id)})).filter(t=>t.start).sort((a,b)=>a.start.localeCompare(b.start));
    return `${filtersHTML()}${candidateHTML()}<section class="planning-panel"><div class="candidate-header"><div><h2>로드맵에 배치한 연구 <small>${scheduled.length}개</small></h2><p>각 연구가 어느 구간에 놓여 있는지 확인하세요.</p></div><button class="secondary-button" data-view="roadmap">로드맵으로 보기 ↗</button></div><div class="task-list">${scheduled.map(t=>`<div class="task-row"><button class="task-check ${t.status==='done'?'checked':''}" data-complete="${esc(t.id)}" aria-label="${esc(t.title)} 완료 상태 변경">${t.status==='done'?'✓':''}</button><button class="task-copy" data-task="${esc(t.id)}"><strong>${esc(t.title)}</strong><div class="task-meta">${t.parentId?`↳ ${esc(taskPath(t))} · `:''}${esc(state.goals.find(g=>g.id===t.goalId)?.title||'L3 미연결')}</div></button><div class="task-actions"><span class="task-date">${esc(P.spanLabel(t))}</span><span class="badge status-${t.status}">${statuses[t.status]}</span></div></div>`).join('')||'<div class="empty-state">아직 연구 기간을 정하지 않았습니다.</div>'}</div></section>`;
  }
  function bindTasks(host) {
    host.querySelectorAll('[data-task]').forEach(el=>el.onclick=()=>openTask(el.dataset.task));
    host.querySelectorAll('[data-place]').forEach(el=>el.onclick=()=>openTask(el.dataset.place,defaultPeriod()));
    host.querySelectorAll('[data-complete]').forEach(el=>el.onclick=()=>{const t=state.tasks.find(t=>t.id===el.dataset.complete);t.status=t.status==='done'?'planned':'done';save();render();});
    if($('#new-candidate'))$('#new-candidate').onclick=()=>openTask(null,{planUnit:unit});
  }
  function defaultPeriod() {const first=P.columns(anchor,unit)[0];return {start:first.start,end:first.end,planUnit:unit,status:'planned'};}
  function stepPeriod(direction,count=1){
    let next=P.step(anchor,direction*count,unit);
    if(unit==='week'&&next>MIN_DATE)next=P.startOfWeek(next);
    anchor=next<MIN_DATE?MIN_DATE:next;render();
  }
  function reorderTask(id,targetId,placement='before'){
    if(readOnly)return false;
    const task=state.tasks.find(t=>t.id===id),target=state.tasks.find(t=>t.id===targetId);
    if(!task||!target||id===targetId||!['before','after'].includes(placement))return false;
    if((task.parentId||'')!==(target.parentId||'')||(!task.parentId&&task.goalId!==target.goalId))return false;
    const peers=H.ordered(state.tasks.filter(t=>(t.parentId||'')===(task.parentId||'')&&(task.parentId||t.goalId===task.goalId)),t=>H.effectiveRange(state.tasks,t.id));
    const next=peers.filter(t=>t.id!==id),at=next.findIndex(t=>t.id===targetId)+(placement==='after'?1:0);
    next.splice(at,0,task);if(next.every((t,i)=>t.id===peers[i].id))return false;
    next.forEach((t,i)=>{t.sortOrder=i;});
    const ok=save();render();focusOrderHandle(id);toast(ok?'연구 순서를 저장했습니다.':'순서를 바꿨습니다. JSON 백업으로 보관해 주세요.');return true;
  }
  function moveTask(id,direction){
    if(readOnly)return false;
    const task=state.tasks.find(t=>t.id===id);if(!task||![-1,1].includes(direction))return false;
    const siblings=H.ordered(state.tasks.filter(t=>(t.parentId||'')===(task.parentId||'')&&(task.parentId||t.goalId===task.goalId)),t=>H.effectiveRange(state.tasks,t.id));
    const at=siblings.findIndex(t=>t.id===id),next=at+direction;
    if(next<0||next>=siblings.length)return false;
    [siblings[at],siblings[next]]=[siblings[next],siblings[at]];
    siblings.forEach((t,i)=>{t.sortOrder=i;});
    const ok=save();render();focusOrderHandle(id);toast(ok?'표시 순서를 바꿨습니다.':'순서를 바꿨습니다. JSON 백업으로 보관해 주세요.');return true;
  }
  function focusOrderHandle(id){Array.from(document.querySelectorAll('[data-reorder-task]')).find(el=>el.dataset.reorderTask===id)?.focus({preventScroll:true});}
  function renderSettings(host){
    const draft=palette();
    host.innerHTML=`<section class="settings-panel appearance-panel"><div class="settings-heading"><h2>화면 테마</h2><p>이 브라우저에 저장되며 홈과 업무 공간에 함께 적용됩니다.</p></div><div class="theme-options" role="group" aria-label="화면 테마"><button type="button" data-theme-value="dark" aria-pressed="true">☾ 다크 모드</button><button type="button" data-theme-value="light" aria-pressed="false">☀ 라이트 모드</button><button type="button" data-theme-value="system" aria-pressed="false">시스템 설정 따르기</button></div><p id="appearance-status" role="status"></p></section><section class="settings-panel"><div class="settings-heading"><h2>연구 유형별 색상</h2><p>색상 칸을 눌러 고르거나 색상 코드를 직접 입력하세요.</p></div><form id="color-settings-form"><div class="settings-colors">${Object.entries(categories).map(([key,label])=>`<div class="settings-color-row"><label for="color-${key}">${esc(label)}</label><input type="color" id="color-${key}" aria-label="${esc(label)} 색상" value="${draft[key]}"><label class="sr-only" for="color-hex-${key}">${esc(label)} 색상 코드</label><input class="settings-hex" id="color-hex-${key}" aria-label="${esc(label)} 색상 코드" value="${draft[key]}" pattern="#[0-9a-fA-F]{6}" maxlength="7" required spellcheck="false"><span class="settings-color-preview" id="color-preview-${key}" style="--event-color:${draft[key]}">${esc(label)} 일정</span></div>`).join('')}</div><p class="settings-color-help">전체 기간 막대는 같은 색을 진하게 표시합니다. 완료·보류 표시는 유지됩니다.</p><div class="settings-footer"><button type="button" class="secondary-button" id="reset-colors">기본 색상으로 돌리기</button><span id="color-settings-status" role="status">저장을 눌러 적용하세요.</span><button type="submit" class="primary-button">색상 저장</button></div></form></section>`;
    window.AtlasTheme?.refresh();
    const preview=(key,value)=>{
      if(!/^#[0-9a-f]{6}$/i.test(value))return;
      draft[key]=value.toLowerCase();$('#color-'+key).value=draft[key];$('#color-hex-'+key).value=draft[key];
      $('#color-preview-'+key).style.setProperty('--event-color',draft[key]);$('#color-settings-status').textContent='변경한 색상을 저장해 주세요.';
    };
    for(const key of Object.keys(categories)){
      $('#color-'+key).oninput=e=>preview(key,e.target.value);
      $('#color-hex-'+key).oninput=e=>preview(key,e.target.value);
    }
    $('#reset-colors').onclick=()=>{for(const [key,value]of Object.entries(defaultColors))preview(key,value);};
    $('#color-settings-form').onsubmit=e=>{
      e.preventDefault();const chosen={};
      for(const key of Object.keys(categories)){
        const value=$('#color-hex-'+key).value;
        if(!/^#[0-9a-f]{6}$/i.test(value))return toast('색상 코드는 #와 영문·숫자 6자리로 입력해 주세요.');
        chosen[key]=value.toLowerCase();
      }
      state.settings={...state.settings,colors:chosen};const ok=save();render();
      $('#color-settings-status').textContent=ok?'색상을 저장했습니다.':'브라우저 저장 상태를 확인해 주세요.';toast(ok?'연구 유형별 색상을 저장했습니다.':'JSON 백업으로 설정을 보관해 주세요.');
    };
  }
  function renderOverview(host) {
    if(selectedYear===2026&&overviewMonth<11)overviewMonth=11;
    const year=selectedYear, tasks=filteredTasks().map(t=>({...t,...H.effectiveRange(state.tasks,t.id)})).filter(t=>t.start&&t.start<=`${year}-12-31`&&t.end>=`${year}-01-01`);
    const plan=state.annualPlans.find(p=>p.year===year)||{focus:'',success:'',notes:''};
    host.innerHTML=`<div class="year-toolbar"><div class="button-row"><button class="icon-button" id="previous-year" aria-label="이전 연도" ${year===2026?'disabled':''}>‹</button><h2>${year}년의 연구 지도</h2><button class="icon-button" id="next-year" aria-label="다음 연도">›</button></div><button class="secondary-button" id="year-to-months">이 해를 월별 로드맵으로 보기 ↗</button></div><section class="year-focus-panel"><div class="year-focus-field"><label for="annual-focus">이 해에 풀고 싶은 핵심 질문</label><textarea id="annual-focus" placeholder="예: 취약점 진단과 온톨로지를 어떻게 하나의 개선 흐름으로 연결할까?">${esc(plan.focus)}</textarea></div><div class="year-focus-field"><label for="annual-success">연말에 무엇을 확보하면 성공일까요?</label><textarea id="annual-success" placeholder="검증할 가설, 남길 기술과 성과, 의사 결정 기준을 적어 보세요.">${esc(plan.success)}</textarea></div><div class="year-focus-field year-focus-notes"><label for="annual-notes">아직 열어 두고 싶은 선택지 · 제약</label><textarea id="annual-notes" placeholder="채용, 외부 협업, 선행 결과에 따라 달라질 연구 방향을 남겨 두세요.">${esc(plan.notes)}</textarea></div><span class="field-help" id="annual-save-status">입력하면 자동 저장됩니다.</span></section>${filtersHTML()}<div id="monthly-calendar-host"></div><details class="annual-quarter-summary"><summary>분기별 연구 목록과 연구축 보기</summary><div class="quarter-grid">${[0,1,2,3].map(q=>`<section class="quarter-card"><div class="quarter-header"><span>Q${q+1}</span><strong>${q*3+1} — ${q*3+3}월</strong></div>${[1,2,3].map(k=>{const n=q*3+k,m=`${year}-${String(n).padStart(2,'0')}`,afterMin=m>='2026-11',list=tasks.filter(t=>t.start<=P.monthEnd(m+'-01')&&t.end>=m+'-01');return `<div class="quarter-month ${!afterMin?'before-project':''}"><div class="quarter-month-title"><strong>${n}월</strong>${afterMin?`<button class="text-button" data-add-month="${m}" aria-label="${year}년 ${n}월에 연구 추가">＋</button>`:'<small>계획 시작 전</small>'}</div>${list.map(t=>`<button class="year-research-pill ${t.parentId?'is-subtask':''}" style="--event-color:${palette()[t.category]}" data-task="${esc(t.id)}"><span>${esc(t.title)}</span><small>${t.parentId?`↳ ${esc(taskPath(t))}`:esc(state.goals.find(g=>g.id===t.goalId)?.title||categories[t.category])}</small></button>`).join('')||`<p class="quarter-empty">${afterMin?'열려 있는 연구 구간':''}</p>`}</div>`;}).join('')}</section>`).join('')}</div><section class="year-goal-summary"><div class="candidate-header"><div><h2>이 해의 연구축</h2><p>한 해에 배치한 연구를 목표별로 점검하세요.</p></div></div><div class="candidate-grid">${state.goals.filter(g=>goalFilter===null||goalFilter.includes(g.id)).map(g=>{const list=tasks.filter(t=>t.goalId===g.id);return `<article class="year-goal-card"><h3>${esc(g.title)}</h3><p>${esc(g.metric)}</p><strong>${list.length}<small>개 연구 구간</small></strong><div class="button-row">${list.map(t=>`<button class="text-button" data-task="${esc(t.id)}">${esc(t.title)}</button>`).join('')||'<span class="field-help">아직 배치한 연구가 없습니다.</span>'}</div></article>`;}).join('')}</div></section></details>`;
    window.ResearchCalendar.render($('#monthly-calendar-host'),{month:`${year}-${String(overviewMonth).padStart(2,'0')}`,readOnly,onReorder:reorderResourceOwner,tasks:filteredTasks(),state,hierarchy:H,colors:palette(),escape:esc,openTask,onMonthChange:month=>{selectedYear=Number(month.slice(0,4));overviewMonth=Number(month.slice(5,7));render();}});
    $('#previous-year').onclick=()=>{if(selectedYear>2026){selectedYear--;render();}};$('#next-year').onclick=()=>{if(selectedYear<9998){selectedYear++;render();}};
    $('#year-to-months').onclick=()=>{anchor=`${year}-${year===2026?'11':'01'}-01`;unit='month';navigate('roadmap');};
    for(const field of ['focus','success','notes'])$('#annual-'+field).oninput=e=>{
      let savedPlan=state.annualPlans.find(p=>p.year===year);if(!savedPlan){savedPlan={year,focus:'',success:'',notes:''};state.annualPlans.push(savedPlan);}savedPlan[field]=e.target.value;
      $('#annual-save-status').textContent=save()?'연간 방향을 자동 저장했습니다.':'JSON 백업으로 보관해 주세요.';
    };
    host.querySelectorAll('[data-add-month]').forEach(el=>el.onclick=()=>{const start=el.dataset.addMonth+'-01';openTask(null,{start,end:P.monthEnd(start),planUnit:'month',status:'planned'});});
    bindFilters();bindTasks(host);
  }
  function taskPath(task) {return H.ancestorsOf(state.tasks,task.id).reverse().map(t=>t.title).join(' › ');}
  function hierarchyParentOptions(id,selected) {
    return '<option value="">독립적인 전체 연구</option>'+state.tasks.filter(t=>!id||H.canParent(state.tasks,id,t.id)).map(t=>{
      const path=[...H.ancestorsOf(state.tasks,t.id)].reverse().map(x=>x.title).concat(t.title).join(' › ');
      return `<option value="${esc(t.id)}" ${t.id===selected?'selected':''}>${esc(path)}</option>`;
    }).join('');
  }
  function addChild(parentId) {
    if(readOnly)return false;
    const parent=state.tasks.find(t=>t.id===parentId);if(!parent)return;
    const range=H.effectiveRange(state.tasks,parentId);
    const first=range.start?{start:range.start,end:range.start}:{start:'',end:''};
    openTask(null,{...first,parentId,planUnit:'day',goalId:H.rootOf(state.tasks,parentId)?.goalId||'',status:first.start?'planned':'backlog'});
  }
  function groupRangeUpdates(tasks,id,period,planUnit,moveChildren=true) {
    const task=tasks.find(t=>t.id===id), old=H.effectiveRange(tasks,id);
    if(!task)return [];
    const stamp=new Date().toISOString(), updates=[{id,...period,planUnit,legacyDates:false,updatedAt:stamp}];
    if(!moveChildren||!old.start||!period.start||!H.childrenOf(tasks,id).length)return updates;
    const n=P.daysBetween(period.start,old.start);
    // Only an exact translation moves descendants; resizing preserves their dates.
    if(!n||P.addDays(old.end,n)!==period.end)return updates;
    for(const child of H.descendantsOf(tasks,id).filter(t=>t.start)) {
      const start=P.addDays(child.start,n),end=P.addDays(child.end,n);
      if(!P.validDate(start)||!P.validDate(end)||start<MIN_DATE||end<start)throw Error('세부 연구가 계획 시작 범위를 벗어나 이동할 수 없습니다.');
      updates.push({id:child.id,start,end,planUnit:'day',legacyDates:false,updatedAt:stamp});
    }
    return updates;
  }
  function overflowMessage(id) {
    const related=[state.tasks.find(t=>t.id===id),...H.ancestorsOf(state.tasks,id)].filter(Boolean);
    const outside=new Set(related.flatMap(t=>H.findOverflow(state.tasks,t.id).map(x=>x.id)));
    return outside.size?` 세부 연구 ${outside.size}개의 기간이 전체 목표 기간 밖에 있습니다.`:'';
  }
  function reschedule(id,start,end,planUnit) {
    if(readOnly)return false;
    const task=state.tasks.find(t=>t.id===id);if(!task)return;
    try {
      const period=P.cover(start,end,'day'),updates=groupRangeUpdates(state.tasks,id,period,'day',true);
      for(const change of updates)Object.assign(state.tasks.find(t=>t.id===change.id),change);
      if(task.status==='backlog')task.status='planned';
      const ok=save();render();toast((ok?`연구 구간을 옮겼습니다.${updates.length>1?' 세부 연구도 함께 이동했습니다.':''}`:'화면에 반영했습니다. JSON 백업을 저장해 주세요.')+overflowMessage(id));
    } catch(e){toast(e.message);render();}
  }
  function deleteTask(id) {
    if(readOnly)return false;
    const target=state.tasks.find(t=>t.id===id);if(!target)return false;
    const previous=clone(state);rememberRecovery();
    state.tasks=state.tasks.filter(t=>t.id!==id);
    state.tasks.forEach(t=>{if(t.parentId===id)t.parentId=target.parentId||'';t.dependencies=t.dependencies.filter(x=>x!==id);});
    if(!save()){state=previous;render();toast('저장하지 못해 삭제를 취소했습니다.');return false;}
    dirty=false;$('#task-dialog').close();render();return true;
  }
  function hideTask(id) {
    if(readOnly)return false;const task=state.tasks.find(t=>t.id===id);if(!task)return false;
    const previous=task.roadmapHidden;task.roadmapHidden=true;
    const ok=save();if(!ok)task.roadmapHidden=previous;render();toast(ok?'로드맵에서 숨겼습니다. 기술 표시 설정에서 다시 표시할 수 있습니다.':'표시 설정을 저장하지 못했습니다.');return ok;
  }
  function confirmDeleteTask(id) {
    if(readOnly)return false;const task=state.tasks.find(t=>t.id===id);if(!task)return false;
    const children=H.childrenOf(state.tasks,id);
    if(!confirm(`‘${task.title}’ 연구를 삭제할까요?${children.length?' 하위 연구는 보존하고 한 단계 위로 옮깁니다.':''} 백업 메뉴에서 되돌릴 수 있습니다.`))return false;
    const ok=deleteTask(id);if(ok)toast('연구를 삭제했습니다. 백업 메뉴에서 되돌릴 수 있습니다.');return ok;
  }
  function duplicateTask(id) {
    if(readOnly)return false;
    const original=state.tasks.find(t=>t.id===id);if(!original)return '';
    const source=[original,...H.descendantsOf(state.tasks,id)], ids=new Map(source.map(t=>[t.id,uid()]));
    state.tasks.push(...source.map(t=>({...clone(t),id:ids.get(t.id),title:t.id===id?t.title+' (복사)':t.title,parentId:ids.get(t.parentId)||t.parentId||'',dependencies:t.dependencies.map(d=>ids.get(d)||d)})));
    save();render();return ids.get(id);
  }
  function subtaskSectionHTML(task) {
    const children=H.ordered(H.childrenOf(state.tasks,task.id),t=>H.effectiveRange(state.tasks,t.id)),progress=H.progress(state.tasks,task.id);
    return `<section class="subtask-section field-full"><div class="subtask-section-header"><div><h3>세부 연구 <small>${children.length}개</small></h3>${children.length?`<p class="subtask-summary">세부 완료 ${progress.done}/${progress.total} · ${progress.percent}%</p>`:''}</div><button type="button" class="secondary-button" id="editor-add-child">＋ 세부 연구</button></div><div class="subtask-list">${children.map(child=>{const range=H.effectiveRange(state.tasks,child.id);return `<div class="subtask-item"><button type="button" class="subtask-title" data-edit-child="${esc(child.id)}">${esc(child.title)}</button><span class="subtask-period">${esc(P.spanLabel({...child,...range}))}</span><span class="badge status-${child.status}">${statuses[child.status]}</span></div>`;}).join('')||'<p class="subtask-empty">전체 연구 아래에 기능 연구·실험·증분 업데이트를 나눠 보세요.</p>'}</div>${children.length?'<button type="button" class="text-button hierarchy-inline-action" id="fit-children-range">전체 목표 기간을 세부 기간에 맞추기 ↔</button>':''}</section>`;
  }
  function periodFieldsHTML(task) {
    return window.ResearchDatePicker.markup(task)+`<p class="field-help">시작일과 종료일을 하루 단위로 선택합니다.</p><div class="planning-duration" id="planning-duration">${task.start?esc(P.spanLabel(task)):'아직 기간을 정하지 않았습니다.'}</div>`;
  }
  function readEditorPeriod() {
    if($('#unscheduled').checked)return {start:'',end:''};
    const start=$('#period-start').value,end=$('#period-end').value;
    if(!P.validDate(start)||!P.validDate(end)||end<start||start<MIN_DATE)throw Error('시작일과 종료일을 올바른 순서로 선택해 주세요.');
    return {start,end};
  }
  function updateDuration() {
    try {const period=readEditorPeriod();$('#planning-duration').textContent=period.start?P.spanLabel(period):'아직 기간을 정하지 않았습니다.';}
    catch(e){$('#planning-duration').textContent='시작일과 종료일을 선택해 주세요.';}
  }
  function markDirty() {dirty=true;$('#task-save-status').textContent='아직 저장하지 않은 변경';}
  function openTask(id,defaults={}) {
    if(readOnly&&!id)return false;
    const original=id?state.tasks.find(t=>t.id===id):null;if(id&&!original)return;
    editorEvents?.abort();editorEvents=new AbortController();
    lastFocus=document.activeElement;
    const task={title:'',start:'',end:'',status:'backlog',category:'research',goalId:goalFilter?.length===1?goalFilter[0]:'',phaseId:'',description:'',deliverable:'',notes:'',dependencies:[],owner:'',planUnit:'day',parentId:'',...clone(original||{}),...defaults};
    task.planUnit='day';
    if(task.parentId)task.goalId=H.rootOf(state.tasks,task.parentId)?.goalId||'';
    if(task.start&&task.status==='backlog')task.status='planned';
    editorDraft=task;periodEdited=!!defaults.start;
    const children=original?H.childrenOf(state.tasks,id):[],dialog=$('#task-dialog');
    dialog.innerHTML=`<form id="task-form" class="task-form"><div class="drawer-header"><div><span class="eyebrow">${task.parentId?'L5 · SUB RESEARCH':'L4 · RESEARCH TECHNOLOGY'}</span><h2 id="task-dialog-title">${task.parentId?'세부 연구 수정':original?'연구 기간 수정':'연구 추가'}</h2><p>${task.start?esc(P.spanLabel(task)):'기간 없이 연구 후보로 등록할 수 있습니다.'}</p></div><button class="close-button" type="button" id="task-close" aria-label="닫기">×</button></div><div class="drawer-body"><div class="form-grid">${!original&&task.start?`<div class="form-field field-full"><label for="assign-existing">기존 연구 후보를 이 구간에 배치</label><select id="assign-existing"><option value="">새 연구 구간 작성</option>${state.tasks.filter(t=>!t.start&&(!task.parentId||(!t.assetId&&H.canParent(state.tasks,t.id,task.parentId)))).map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></div>`:''}${task.assetId?`<div class="taxonomy-source-card field-full"><span>L4 · 기술자산 맵 ${esc(task.sourceCell||'')}</span><strong>${esc((task.officialTitle||task.title).split(/\s*->\s*/)[0])}</strong><small>기술의 공식 분류입니다. 아래 제목·일정·메모는 수정할 수 있습니다.</small></div>`:''}<div class="form-field field-full"><label for="task-title">${task.parentId?'L5 세부 연구':'L4 기술 · 연구'} <span class="required">*</span></label><input id="task-title" name="title" value="${esc(task.title)}" required maxlength="300" placeholder="연구 제목"></div><div class="form-field field-full owner-editor-field"><label for="task-owner">담당자</label><input id="task-owner" name="owner" value="${esc(task.owner)}" placeholder="담당자 이름을 입력하세요"><span class="field-help">공동 담당자는 쉼표로 구분해 주세요.</span><label class="allocation-mode" id="allocation-mode-field" ${task.parentId?'hidden':''}><input type="checkbox" id="l4-allocation-manual" ${task.allocationMode==='manual'?'checked':''} ${readOnly?'disabled':''}> L4 리소스 직접 수정</label><div id="task-allocations" class="allocation-editor"></div></div><div class="hierarchy-editor field-full"><div class="form-field"><label for="task-parent">상위 기술 · 연구</label><select class="hierarchy-parent-picker" id="task-parent" name="parentId">${hierarchyParentOptions(id,task.parentId)}</select></div><div id="hierarchy-parent-context" class="hierarchy-parent-context"></div><p class="hierarchy-editor-help">L4는 기술의 전체 기간, L5는 그 아래에서 진행할 세부 연구입니다. 기존의 더 깊은 연결도 유지합니다.</p></div><div class="form-field field-full"><label for="task-goal">연결할 L3 연구축</label><select id="task-goal" name="goalId">${goalOptions(task.goalId,'L3 미연결')}</select></div><div class="planning-intent field-full"><input id="task-unit" name="planUnit" type="hidden" value="day"><p class="allocation-heading">목표 기간</p><label class="period-unscheduled"><input id="unscheduled" type="checkbox" ${!task.start?'checked':''}> ${children.length?'전체 목표 기간은 미정 · 세부 기간으로 요약 표시':'기간은 아직 미정'}</label><div id="period-fields">${periodFieldsHTML(task)}</div>${children.length?'<label class="period-unscheduled hierarchy-parent-note"><input type="checkbox" id="move-children" checked> 전체 기간을 이동할 때 세부 연구도 함께 이동</label><p class="field-help">전체 기간의 길이만 늘이거나 줄이면 세부 기간은 유지됩니다.</p>':''}</div><div class="hierarchy-warning field-full" id="hierarchy-period-warning"></div>${original?subtaskSectionHTML(original):''}<label class="task-visibility-field field-full"><input id="task-roadmap-visible" type="checkbox" ${!task.roadmapHidden?'checked':''}> 연구 로드맵에 표시</label><div class="task-papers field-full" id="task-papers"></div><div class="form-field"><label for="task-status">연구 상태</label><select id="task-status" name="status">${options(statuses,task.status)}</select></div><div class="form-field"><label for="task-category">연구 유형</label><select id="task-category" name="category">${options(categories,task.category)}</select></div><details class="advanced-plan field-full"><summary>연구 단계 · 담당 · 선행 연구 · 상세 메모</summary><div class="form-grid"><div class="form-field"><label for="task-phase">로드맵 단계</label><select id="task-phase" name="phaseId"><option value="">단계 미연결</option>${state.phases.map(p=>`<option value="${esc(p.id)}" ${task.phaseId===p.id?'selected':''}>${esc(p.title)}</option>`).join('')}</select></div><div class="form-field field-full"><label for="task-dependencies">먼저 확인해야 하는 연구</label><select id="task-dependencies" name="dependencies" multiple size="4">${state.tasks.filter(t=>t.id!==id).map(t=>`<option value="${esc(t.id)}" ${task.dependencies.includes(t.id)?'selected':''}>${esc(t.title)}</option>`).join('')}</select><span class="field-help">⌘/Ctrl+클릭으로 여러 개 선택. 선행 연구에 따라 구간을 자동 이동하지는 않습니다.</span></div><div class="form-field field-full"><label for="task-notes">상세 메모</label><textarea id="task-notes" name="notes" rows="7">${esc(task.notes)}</textarea></div></div></details>${original?`<div class="linked-notes field-full"><div class="section-label">이 연구축의 기록</div>${state.notes.filter(n=>n.goalId&&n.goalId===task.goalId).slice(0,4).map(n=>`<button class="linked-note" type="button" data-note="${esc(n.id)}">▧ ${esc(n.title)} ↗</button>`).join('')||'<p class="field-help">연구 노트에 같은 연구축을 지정하면 여기에 표시됩니다.</p>'}</div>`:''}<p class="form-error field-full" id="task-error" role="alert"></p></div></div><div class="drawer-footer"><div class="button-row">${original?'<button type="button" class="danger-button" id="task-delete">삭제</button><button type="button" class="secondary-button" id="task-duplicate">복제</button>':''}<span class="field-help" id="task-save-status">밖을 누르거나 닫으면 자동 저장됩니다.</span></div><div class="button-row"><button type="button" class="secondary-button" id="task-cancel">변경 취소</button><button type="submit" class="primary-button">연구 구간 저장</button></div></div></form>`;
    const form=$('#task-form');dirty=false;
    window.ResearchPapers.mount($('#task-papers'),task,{readOnly,onChange:markDirty,toast,uid});
    $('#task-roadmap-visible').onchange=markDirty;
    const syncHierarchy=()=>{
      const parentId=$('#task-parent').value,parent=state.tasks.find(t=>t.id===parentId),context=$('#hierarchy-parent-context');
      $('#task-goal').disabled=!!parent||!!task.assetId;$('#task-parent').disabled=!!task.assetId;
      if(parent){$('#task-goal').value=H.rootOf(state.tasks,parentId)?.goalId||'';const range=H.effectiveRange(state.tasks,parentId);context.innerHTML=`<strong>${esc(parent.title)}</strong><span>${esc(P.spanLabel({...parent,...range}))}</span><small>상위 L4와 같은 L3 연구축에 연결됩니다.</small>`;}
      else context.replaceChildren();
      try {
        const period=original&&!periodEdited?{start:original.start,end:original.end}:readEditorPeriod();
        const next=state.tasks.map(t=>t.id===id?{...t,...period,parentId}:t);
        if(!original)next.push({...task,...period,parentId,id:'__editor_draft__'});
        const warnings=[];
        if(parent?.start&&period.start&&(period.start<parent.start||period.end>parent.end))warnings.push('세부 기간이 상위 연구의 전체 목표 기간 밖에 있습니다. 저장 후 전체 기간을 맞추거나 세부 기간을 조정할 수 있어요.');
        if(original&&period.start&&H.findOverflow(next,id).length)warnings.push('전체 목표 기간 밖에 있는 세부 연구가 있습니다. 전체 기간과 세부 기간을 확인해 주세요.');
        $('#hierarchy-period-warning').textContent=warnings.join(' ');updateAllocationWarning();
      }catch(e){$('#hierarchy-period-warning').textContent='';}
    };
    form.oninput=e=>{if(e.target.id==='task-owner')renderAllocations();if(e.target.matches('[data-allocation-input]')){const row=e.target.closest('.allocation-row');row.style.setProperty('--allocation',Math.min(100,Math.max(0,Number(e.target.value)||0))+'%');updateAllocationWarning();}if(!e.target.name&&!['unscheduled','move-children'].includes(e.target.id))return;markDirty();if(['periodStart','periodEnd','planUnit'].includes(e.target.name)){periodEdited=true;updateDuration();syncHierarchy();}};
    let allocationDraft=new Map((task.ownerAllocations||[]).map(row=>[row.owner,row.percent]));
    function readAllocations(){
      return [...dialog.querySelectorAll('[data-allocation-input]')].filter(input=>input.value!=='').map(input=>({owner:input.dataset.allocationOwner,percent:Number(input.value)}));
    }
function renderAllocations(){
      for(const input of dialog.querySelectorAll('[data-allocation-input]:not([readonly])'))allocationDraft.set(input.dataset.allocationOwner,input.value===''?null:Number(input.value));
      const isL5=!!$('#task-parent').value,manual=isL5||$('#l4-allocation-manual').checked;
      $('#allocation-mode-field').hidden=isL5;
      const current={...task,id:id||'__allocation_draft__',parentId:$('#task-parent').value,owner:$('#task-owner').value,allocationMode:manual?'manual':'derived'};
      const rows=manual?window.ResearchCalendar.ownersOf(current).map(owner=>({owner,percent:allocationDraft.get(owner)??null})):window.ResearchCalendar.taskAllocations(current,state.tasks);
      $('#task-allocations').innerHTML=`<p class="allocation-heading">${isL5?'L5 담당자별 리소스':manual?'L4 리소스 직접 입력':'L5 합산 최대값 / 자동'}</p>${rows.map((row,index)=>{const {owner:name,percent}=row;return `<div class="allocation-row" style="--allocation:${Math.min(100,percent??0)}%"><label for="allocation-${index}">${esc(name)}</label><div class="allocation-track" aria-hidden="true"><i></i></div><label class="allocation-value"><span class="sr-only">${esc(name)} 리소스 비율</span><input id="allocation-${index}" name="allocation-${index}" type="number" min="0" ${isL5?'max="100"':''} step="0.1" inputmode="decimal" placeholder="미입력" data-allocation-input data-allocation-owner="${esc(name)}" value="${percent??''}" ${readOnly||!manual?'readonly':''}><span>%</span></label></div>`;}).join('')}<p class="field-help">${isL5?'L5 과업 하나당 0~100%. 빈칸은 미입력이며 0%와 구분합니다.':manual?'L4 직접 입력값은 표시용이며 MM과 전체 담당자 리소스 합계에는 포함하지 않습니다.':'하위 L5를 같은 날짜에 합산한 담당자별 최대값입니다. L5 변경 시 자동으로 갱신됩니다.'}</p>${!rows.length?'<p class="field-help">담당자와 하위 L5 리소스를 입력해 주세요.</p>':''}<div id="allocation-warning" class="allocation-warning" aria-live="polite"></div>`;
      updateAllocationWarning();
}
    $('#l4-allocation-manual').onchange=()=>{
      if($('#l4-allocation-manual').checked){
        const derived=window.ResearchCalendar.taskAllocations({...task,owner:$('#task-owner').value,allocationMode:'derived'},state.tasks);
        const names=[...new Set([...window.ResearchCalendar.ownersOf({owner:$('#task-owner').value}),...derived.map(row=>row.owner)])];$('#task-owner').value=names.join(', ');
        for(const row of derived)if(!allocationDraft.has(row.owner))allocationDraft.set(row.owner,row.percent);
      }
      markDirty();renderAllocations();
    };
    function updateAllocationWarning(){
      const host=$('#allocation-warning');if(!host)return;
      try{
        const period=original&&!periodEdited?{start:original.start,end:original.end}:readEditorPeriod();
        const pending={...task,...period,id:id||'__allocation_draft__',parentId:$('#task-parent').value,owner:$('#task-owner').value,status:$('#task-status').value,ownerAllocations:readAllocations()};
        const tasks=state.tasks.filter(t=>t.id!==id).concat(pending),range=H.effectiveRange(tasks,pending.id);
        if(!range.start){host.textContent='기간을 정하면 동시 배정과 MM을 계산합니다.';host.classList.remove('is-over');return;}
        const names=window.ResearchCalendar.ownersOf(pending),rows=window.ResearchCalendar.resourceSummary(tasks,range.start,range.end).filter(row=>names.includes(row.owner));
        host.classList.toggle('is-over',rows.some(row=>row.peak>100));
        host.textContent=rows.map(row=>`${row.owner}: 기간 내 최대 ${row.peak}%${row.peak>100?` (${Math.round((row.peak-100)*10)/10}% 초과, ${row.firstOver}부터)`:''}`).join(' / ');
      }catch{host.textContent='리소스는 0~100%로 입력하고 연구 기간을 확인해 주세요.';}
    }
    $('#task-status').onchange=updateAllocationWarning;
    let datePicker;
    const bindPeriodInputs=()=>{
      datePicker=window.ResearchDatePicker.mount($('#period-fields'),{signal:editorEvents.signal,readOnly,onChange:()=>{periodEdited=true;markDirty();updateDuration();syncHierarchy();}});
      for(const inputId of ['period-start','period-end'])$('#'+inputId).onchange=()=>{datePicker.sync();periodEdited=true;markDirty();updateDuration();syncHierarchy();};
    };bindPeriodInputs();
    $('#task-parent').onchange=()=>{markDirty();renderAllocations();syncHierarchy();};
    $('#unscheduled').onchange=()=>{
      datePicker.sync();periodEdited=true;markDirty();updateDuration();syncHierarchy();
      if(!$('#unscheduled').checked)datePicker.open();
    };
    const assign=$('#assign-existing');if(assign)assign.onchange=()=>{if(!assign.value)return;if(dirty&&!confirm('작성 중인 내용을 닫고 연구 후보를 배치할까요?')){assign.value='';return;}const chosen=state.tasks.find(t=>t.id===assign.value);dirty=false;openTask(assign.value,{start:task.start,end:task.end,planUnit:task.planUnit,parentId:task.parentId||chosen.parentId||'',status:'planned'});};
    $('#task-close').onclick=()=>closeTask();$('#task-cancel').onclick=()=>closeTask('discard');dialog.oncancel=e=>{e.preventDefault();closeTask();};
    // Only dismiss a gesture that starts and ends on the backdrop.
    // Selecting text inside the drawer and releasing outside must keep it open.
    const outside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
    let backdropPressed=false;
    dialog.addEventListener('pointerdown',e=>{backdropPressed=e.button===0&&outside(e);},{signal:editorEvents.signal});
    dialog.addEventListener('pointercancel',()=>{backdropPressed=false;},{signal:editorEvents.signal});
    dialog.onclick=e=>{const dismiss=backdropPressed&&outside(e);backdropPressed=false;if(dismiss)closeTask();};
    dialog.querySelectorAll('[data-note]').forEach(el=>el.onclick=()=>{if(!closeTask())return;navigate('notes');window.ResearchNotebook.openNote(el.dataset.note);});
    if(original) {
      $('#editor-add-child').onclick=()=>{if(closeTask())addChild(id);};
      dialog.querySelectorAll('[data-edit-child]').forEach(el=>el.onclick=()=>{if(closeTask())openTask(el.dataset.editChild);});
      if($('#fit-children-range'))$('#fit-children-range').onclick=()=>{
        const ranges=H.descendantsOf(state.tasks,id).filter(t=>t.start);if(!ranges.length)return toast('아직 기간을 정한 세부 연구가 없습니다.');
        const covered=P.cover(ranges.reduce((a,t)=>t.start<a?t.start:a,ranges[0].start),ranges.reduce((a,t)=>t.end>a?t.end:a,ranges[0].end),$('#task-unit').value);
        task.start=covered.start;task.end=covered.end;$('#unscheduled').checked=false;$('#period-fields').innerHTML=periodFieldsHTML({...task,planUnit:$('#task-unit').value});bindPeriodInputs();periodEdited=true;markDirty();updateDuration();syncHierarchy();
      };
      $('#task-delete').onclick=()=>confirmDeleteTask(id);
      $('#task-duplicate').onclick=()=>{if(dirty&&!confirm('저장된 내용으로 복제할까요? 편집 중인 내용은 저장되지 않습니다.'))return;dirty=false;dialog.close();const copyId=duplicateTask(id);openTask(copyId);};
    }
    commitEditor=()=>{
      if(readOnly)return false;
      if(!form.reportValidity())return taskError('필수 항목과 입력 형식을 확인해 주세요. 저장 전까지 편집창을 유지합니다.');if($('#task-papers').dataset.processing==='true')return taskError('Figure 준비가 끝나면 저장해 주세요.');const fd=new FormData(form),values=Object.fromEntries(fd);values.title=values.title.trim();values.dependencies=fd.getAll('dependencies');
      if(!values.title)return taskError('연구 주제를 입력해 주세요.');
      let period;
      try{period=original&&!periodEdited?{start:original.start,end:original.end}:readEditorPeriod();}catch(error){return taskError(error.message);}
      values.allocationMode=values.parentId||!$('#l4-allocation-manual').checked?'derived':'manual';
      values.ownerAllocations=!values.parentId&&values.allocationMode==='derived'?(original?.ownerAllocations||[]):readAllocations();
      for(const key of Object.keys(values))if(key.startsWith('allocation-'))delete values[key];
      values.roadmapHidden=!$('#task-roadmap-visible').checked;values.papers=window.ResearchPapers.normalize(task.papers);
      delete values.periodStart;delete values.periodEnd;
      if(hasCycle(id,values.dependencies))return taskError('선행 연구 관계가 서로 순환합니다. 연결을 다시 선택해 주세요.');
      const newId=id||uid();
      Object.assign(values,period,{id:newId,parentId:values.parentId||'',legacyDates:original&&!periodEdited?original.legacyDates:false,updatedAt:new Date().toISOString()});
      if(values.start&&values.status==='backlog')values.status='planned';if(!values.start&&['planned','active'].includes(values.status))values.status='backlog';
      let next=state.tasks.map(t=>({...t}));
      const candidate={...(original||{}),...values};if(original)next=next.map(t=>t.id===id?candidate:t);else next.push(candidate);
      try {
        H.validate(next);
        const root=H.rootOf(next,newId);if(candidate.parentId)candidate.goalId=root?.goalId||''; if(!candidate.parentId&&!candidate.goalId)return taskError('L3 연구축을 선택해 주세요.');
        for(const child of H.descendantsOf(next,newId))child.goalId=candidate.goalId;
        if(original&&periodEdited&&period.start) {
          const changes=groupRangeUpdates(state.tasks,id,period,values.planUnit,$('#move-children')?.checked!==false);
          for(const change of changes.filter(c=>c.id!==id))Object.assign(next.find(t=>t.id===change.id),change);
        }
      }catch(error){return taskError(error.message);}
      const previousTasks=state.tasks;state.tasks=next;
      const ok=save();if(!ok){state.tasks=previousTasks;return taskError('저장하지 못해 편집창을 유지했습니다. 입력 내용을 보관하고 저장 상태를 확인해 주세요.');}
      dirty=false;dialog.close();if(values.start){const shown=P.columns(anchor,unit);if(values.start<shown[0].start||values.start>shown.at(-1).end)anchor=values.start;selectedYear=P.date(values.start).getFullYear();}render();toast('연구 구간을 저장했습니다.'+overflowMessage(newId));return true;
    };
    form.onsubmit=e=>{e.preventDefault();commitEditor();};
    renderAllocations();syncHierarchy();if(!dialog.open)dialog.showModal();$('#task-title').focus();
  }
  function taskError(message){$('#task-error').textContent=message;$('#task-error').scrollIntoView({block:'nearest'});return false;}
  function closeTask(mode='save'){
    if(dirty&&mode!=='discard'&&!readOnly)return commitEditor?commitEditor():false;
    if(dirty&&mode==='discard'&&!confirm('입력한 변경을 취소할까요? 저장된 연구 내용은 유지됩니다.'))return false;
    dirty=false;$('#task-dialog').close();lastFocus?.focus?.();return true;
  }
  function hasCycle(id,deps) {if(!id)return false;const visit=(at,seen)=>{if(at===id)return true;if(seen.has(at))return false;seen.add(at);return(state.tasks.find(t=>t.id===at)?.dependencies||[]).some(n=>visit(n,seen));};return deps.some(d=>visit(d,new Set()));}
  function rememberRecovery(){memoryRecovery=clone(state);try{localStorage.setItem(RECOVERY,JSON.stringify(state));}catch(e){toast('복구 사본을 저장하지 못했습니다. JSON 백업을 보관해 주세요.');}}
  function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function showUtility(title,body,footer=''){const d=$('#utility-dialog');d.innerHTML=`<div class="modal-header"><h2 id="utility-title">${esc(title)}</h2><button class="close-button" id="utility-close" aria-label="닫기">×</button></div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}`;$('#utility-close').onclick=()=>d.close();if(!d.open)d.showModal();}
  function openBackup(){
    showUtility('연구의 큰 그림 보관하기',`<div class="backup-intro"><span class="backup-symbol">↥</span><p>현재 저장 상태: ${esc(workspaceMessage)}. 연구 구간·목표·연간 방향·노트는 JSON 백업으로도 보관할 수 있습니다.</p></div><div class="backup-actions"><button class="backup-action" id="workspace-compare"><strong>공유 저장 연결 · 저장본 비교 ↗</strong><p>브라우저와 프로젝트 파일의 내용을 확인해요.</p></button><button class="backup-action" id="export-json"><strong>전체 JSON 백업 ↧</strong><p>연구 구간, 연간 방향, 목표와 노트</p></button><button class="backup-action" id="import-json"><strong>JSON 백업 가져오기 ↥</strong><p>이전 버전과 세부 연구 관계를 함께 보관해요.</p></button><button class="backup-action" id="restore-recovery"><strong>직전 삭제·가져오기 되돌리기 ↶</strong><p>마지막 복구 사본으로 복원</p></button><button class="backup-action" id="restore-old-version"><strong>개편 전 데이터 확인·복구 ↶</strong><p>기술자산 맵 적용 전의 원본 사본</p></button></div><div class="storage-summary"><span>연구 ${state.tasks.length}개</span><span>연구축 ${state.goals.length}개</span><span>노트 ${state.notes.length}개</span><span>연간 방향 ${state.annualPlans.length}개</span></div><p class="field-help">${window.WORK_CONTEXT?.mode==='supabase'?'변경 내용은 브라우저에 먼저 저장한 뒤 Supabase에 자동 저장됩니다. 왼쪽 아래에 ‘업무 저장소에 저장됨’이 표시되면 서버 저장이 완료된 상태입니다. 연결 오류나 저장본 충돌이 표시되면 서버 저장이 완료되지 않았을 수 있으니 JSON 백업을 보관해 주세요.':'로컬 개발 모드입니다. 변경은 브라우저와 이 프로젝트의 로컬 사본에 저장되며 Supabase로 전송되지 않습니다.'}</p>`);
    $('#workspace-compare').onclick=openWorkspaceConflict;
    $('#export-json').onclick=()=>{download(`research-atlas-${P.iso(new Date())}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2));toast('연구 계획 백업을 저장했습니다.');};$('#import-json').onclick=()=>$('#import-file').click();
    const restore=key=>{try{const raw=key===RECOVERY&&memoryRecovery?JSON.stringify(memoryRecovery):localStorage.getItem(key);if(!raw)return toast('이 브라우저에 해당 복구 사본이 없습니다.');const incoming=validateState(JSON.parse(raw));confirmImport(incoming,'복구 사본');}catch(e){toast('복구 사본을 읽을 수 없습니다.');}};
    $('#restore-recovery').onclick=()=>restore(RECOVERY);$('#restore-old-version').onclick=()=>restore(localStorage.getItem(BEFORE_TAXONOMY)?BEFORE_TAXONOMY:localStorage.getItem(BEFORE_HIERARCHY)?BEFORE_HIERARCHY:BEFORE_WEEKLY);
  }
  async function initWorkspace(){
    const sync=await window.ResearchWorkspaceSync.init({
      initialEnvelope:window.WORK_INITIAL_ENVELOPE,normalizeState:validateState,
      readState:()=>hasUserData?clone(state):null,
      applyState:incoming=>{const next=validateState(incoming);state=next;render();},
      saveLocal:()=>save({sync:false}),
      onStatus:status=>{workspaceMessage=status.message;$('#storage-status').textContent=workspaceMessage;$('.workspace-note').dataset.saveMode=status.mode;$('.workspace-note').title=status.message;},
      onConflict:()=>{toast('서로 다른 저장본이 있습니다. 백업 메뉴에서 비교해 주세요.');$('#backup-open').classList.add('needs-attention');}
    });
    workspaceSync=sync;
    const refresh=()=>{if(!dirty&&view!=='settings'&&!window.ResearchTimeline?.isInteracting?.()&&document.visibilityState!=='hidden'&&!$('#utility-dialog').open&&!$('#task-dialog').open&&!sync.getStatus().paused)void sync.refresh(null, {priority: 'low'});};
    window.addEventListener('focus',refresh);
    let refreshTimer;
    function stopPolling() {
      clearInterval(refreshTimer);
      refreshTimer = undefined;
    }
    function resumePolling() {
      if (document.hidden) {
        stopPolling();
      } else if (refreshTimer === undefined) {
        refresh();
        refreshTimer = setInterval(refresh, 10000);
      }
    }
    document.addEventListener('visibilitychange', resumePolling);
    window.addEventListener('pagehide', stopPolling);
    window.addEventListener('pageshow', resumePolling);
    if (!document.hidden) refreshTimer = setInterval(refresh, 10000);
  }
  function openWorkspaceConflict(){
    const conflict=workspaceSync?.exportConflict();
    if(!conflict){workspaceSync?.refresh();toast(workspaceMessage);return;}
    const summary=data=>`${data?.tasks?.length||0}개 연구 · ${data?.notes?.length||0}개 노트`;
    showUtility('저장본 비교',`<p>두 저장본은 자동으로 덮어쓰지 않았습니다. 사용할 내용을 선택하면 현재 브라우저 내용도 복구 사본으로 남깁니다.</p><div class="sync-choice-grid"><div><strong>현재 브라우저</strong><p>${esc(summary(conflict.local))}</p><button class="secondary-button" id="sync-export-local">이 내용 백업 ↧</button></div><div><strong>프로젝트 공유 파일</strong><p>${esc(summary(conflict.workspace))}</p><button class="secondary-button" id="sync-export-workspace">이 내용 백업 ↧</button></div></div>`,`<button class="secondary-button" id="sync-use-local">현재 브라우저 내용을 공유</button><button class="primary-button" id="sync-use-workspace">공유 파일 불러오기</button>`);
    $('#sync-export-local').onclick=()=>download('research-atlas-browser.json',JSON.stringify(workspaceSync.exportConflict().local,null,2));
    $('#sync-export-workspace').onclick=()=>download('research-atlas-workspace.json',JSON.stringify(conflict.workspace,null,2));
    for(const [id,choice]of[['sync-use-local','local'],['sync-use-workspace','workspace']])$('#'+id).onclick=async()=>{try{if(await workspaceSync.resolve(choice)){$('#utility-dialog').close();$('#backup-open').classList.remove('needs-attention');render();toast('선택한 연구 계획을 연결했습니다.');}}catch(e){toast(e.message);}};
  }
  function confirmImport(incoming,name) {
    if(readOnly)return false;
    showUtility('연구 계획 가져오기',`<p class="import-description"><strong>${esc(name)}</strong>의 내용을 가져옵니다. 현재 내용은 복구 사본으로 보관한 뒤 교체합니다.</p><div class="storage-summary"><span>연구 ${incoming.tasks.length}개</span><span>연구축 ${incoming.goals.length}개</span><span>노트 ${incoming.notes.length}개</span><span>연간 방향 ${incoming.annualPlans.length}개</span></div>`,'<button class="secondary-button" id="import-cancel">취소</button><button class="primary-button" id="import-confirm">이 계획으로 가져오기</button>');
    $('#import-cancel').onclick=()=>$('#utility-dialog').close();$('#import-confirm').onclick=()=>{rememberRecovery();state=incoming;storageFailed=false;save();$('#utility-dialog').close();render();toast('연구 계획을 가져왔습니다. 기존 기간도 보존했습니다.');};
  }
  $('#import-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>30*1024*1024)throw Error('30MB 이하의 JSON 파일을 선택해 주세요.');confirmImport(validateState(JSON.parse(await f.text())),f.name);}catch(error){toast('가져오기 실패: '+error.message);}};
  document.addEventListener('click',e=>{document.querySelectorAll('.task-filter[open]').forEach(picker=>{if(!picker.contains(e.target))picker.open=false;});const target=e.target.closest('[data-view]');if(target)navigate(target.dataset.view);});
  $('#global-search').oninput=e=>{search=e.target.value;if(!['roadmap','overview','backlog'].includes(view))navigate('backlog');else render();};
  $('#add-task').onclick=()=>openTask(null,view==='roadmap'?defaultPeriod():view==='overview'?{start:`${selectedYear}-${selectedYear===2026?'11':'01'}-01`,end:`${selectedYear}-12-31`,planUnit:'year'}:{planUnit:unit});
  $('#backup-open').onclick=$('#backup-top').onclick=openBackup;
  window.addEventListener('hashchange',()=>{const next=alias(location.hash.slice(1));if(views[next]&&next!==view){view=next;render();}});
  window.addEventListener('beforeunload',e=>{if(dirty||storageFailed){e.preventDefault();e.returnValue='';}});
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue)toast('다른 창에서 계획이 변경됐습니다. 현재 내용을 백업한 뒤 새로고침해 주세요.');});
  const initialParams=new URLSearchParams(location.search||'');
  if(Object.hasOwn(units,initialParams.get('unit')))unit=initialParams.get('unit');
  if(state.goals.some(g=>g.id===initialParams.get('l3')))goalFilter=[initialParams.get('l3')];
  const requested=alias(location.hash.slice(1));if(views[requested])view=requested;
  render();if(sourceIssue)toast(sourceIssue);
  if(window.ResearchWorkspaceSync&&!sourceIssue)initWorkspace();
  window.ResearchAtlas={getState:()=>clone(state),validateState,dateUtils:P,hierarchy:H,operations:{reorderResourceOwner,reorderGoal,moveGoal,openRoadmapVisibility,hideTask,openTask,addChild,reschedule,deleteTask,duplicateTask,moveTask,reorderTask,stepPeriod}};
})();

