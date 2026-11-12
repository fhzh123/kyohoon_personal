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
  const categories = {research:'연구·조사',experiment:'실험·검증',writing:'논문·문서',meeting:'협의·리뷰',milestone:'핵심 결과'};
  const statuses = {backlog:'기간 미정',planned:'계획',active:'진행 중',done:'완료',paused:'보류'};
  const defaultColors = {research:'#3479e9',experiment:'#12a898',writing:'#8864ce',meeting:'#dc9951',milestone:'#da6d8a'};
  const views = {roadmap:'연구 로드맵',overview:'연간 조망',backlog:'연구 후보',goals:'L3 연구축',notes:'연구 노트',references:'자료실',settings:'설정'};
  const icons = {roadmap:'▤',overview:'▦',backlog:'◇',goals:'◎',notes:'▧',references:'▱',settings:'⚙'};
  const alias = key => ({calendar:'roadmap',gantt:'roadmap'}[key] || key);
  let hasUserData=false, workspaceSync=null, workspaceMessage='이 브라우저에 자동 저장';
  let state = validateState(clone(window.RESEARCH_SEED));
  let view='roadmap', unit='week', anchor=MIN_DATE, selectedYear=2027;
  let search='',goalFilter='',categoryFilter='',statusFilter='';
  let dirty=false, storageFailed=false, sourceIssue='', memoryRecovery=null, toastTimer, lastFocus=null;
  let taskSnapshot='', periodEdited=false, editorDraft=null;
  try { const raw=readOnly?null:localStorage.getItem(KEY); if(raw) {state=validateState(JSON.parse(raw));hasUserData=true;} }
  catch(e) { storageFailed=true; sourceIssue='기존 데이터를 읽지 못했습니다. 저장본을 덮어쓰지 않았습니다. 백업 메뉴에서 복구해 주세요.'; }

  function validateState(data) {
    if(!data || ![1,2,3,4].includes(data.version) || !['goals','phases','tasks','notes','references'].every(k=>Array.isArray(data[k]))) throw Error('지원하는 Research Atlas 백업이 아닙니다.');
    const out={version:data.version===4?4:3,annualPlans:[]};
    if(data.taxonomyVersion)out.taxonomyVersion=data.taxonomyVersion;
    if(Array.isArray(data.legacyGroups))out.legacyGroups=clone(data.legacyGroups);
    if(data.settings!==undefined){
      if(!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw Error('설정 형식을 확인해 주세요.');
      const colors=data.settings.colors||{};
      if(typeof colors!=='object'||Array.isArray(colors))throw Error('색상 설정 형식을 확인해 주세요.');
      out.settings={colors:{}};
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
        for(const [name,value] of Object.entries(obj)) if(!['dependencies','papers'].includes(name) && value!==null && !['string','number','boolean'].includes(typeof value)) delete obj[name];
        if(key==='tasks') {
          if(item.parentId!==undefined && typeof item.parentId!=='string')throw Error('상위 연구 ID는 문자열이어야 합니다.');
          obj.parentId=item.parentId||'';
          obj.roadmapHidden=typeof item.roadmapHidden==='boolean'?item.roadmapHidden:/표 형식의 데이터를|원천 데이터의 구조화 모달리티 확장/.test([item.title,item.officialTitle].join(' '));
          obj.papers=window.ResearchPapers?.normalize(item.papers)||[];
          if(!Number.isFinite(obj.sortOrder))delete obj.sortOrder;
          if(!!obj.start!==!!obj.end || (obj.start && (!P.validDate(obj.start)||!P.validDate(obj.end)||obj.start<MIN_DATE||obj.end<obj.start))) throw Error('올바른 연구 기간을 확인해 주세요. 2026년 11월 이후여야 합니다.');
          obj.category=Object.hasOwn(categories,obj.category)?obj.category:'research';
          obj.status=Object.hasOwn(statuses,obj.status)?obj.status:(obj.start?'planned':'backlog');
          obj.dependencies=Array.isArray(item.dependencies)?item.dependencies.filter(x=>typeof x==='string'):[];
          obj.planUnit=Object.hasOwn(units,item.planUnit)?item.planUnit:'week';
          // Preserve existing exact dates. A deliberate period edit is required to round them to weeks.
          obj.legacyDates=!!obj.start && (!Object.hasOwn(units,item.planUnit)||item.legacyDates===true);
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
  function filteredTasks() {return state.tasks.filter(t=>(!search||[t.title,t.officialTitle,t.description,t.deliverable,t.notes].join(' ').toLowerCase().includes(search.toLowerCase()))&&(!goalFilter||t.goalId===goalFilter)&&(!categoryFilter||t.category===categoryFilter)&&(!statusFilter||t.status===statusFilter));}
  function goalOptions(value,empty='모든 L3 연구축') {return `<option value="">${esc(empty)}</option>`+state.goals.map(g=>`<option value="${esc(g.id)}" ${g.id===value?'selected':''}>${esc(g.title)}</option>`).join('');}
  function options(map,value,empty) {return (empty!==undefined?`<option value="">${esc(empty)}</option>`:'')+Object.entries(map).map(([k,v])=>`<option value="${esc(k)}" ${value===k?'selected':''}>${esc(v)}</option>`).join('');}
  function statsHTML() {
    const roots=state.tasks.filter(t=>!t.parentId),allocated=roots.filter(t=>H.effectiveRange(state.tasks,t.id).start).length,subtasks=state.tasks.length-roots.length;
    return [['L3 연구축',state.goals.length,'기술자산 맵의 주황색 연구축 + 직접 추가한 축','◎'],['기간을 잡은 L4',allocated,`L4 기술 ${roots.length}개 · L5 세부 연구 ${subtasks}개`,'▤'],['기간 미정 L4',roots.length-allocated,'각 기술의 전체 기간과 세부 기간을 나누어 계획','◇'],['연결된 연구 기록',state.notes.length,'논문과 긴 연구 메모를 함께','▧']].map(([label,n,meta,icon])=>`<div class="stat-card"><div class="stat-label">${label}</div><span class="stat-icon">${icon}</span><div class="stat-value">${n}<small>개</small></div><p class="stat-meta">${meta}</p></div>`).join('');
  }
  function updateStats() {$('#stats').innerHTML=statsHTML();}
  function palette(){return {...defaultColors,...state.settings?.colors};}
  function render() {
    window.ResearchTimeline?.destroy?.();
    $('#navigation').innerHTML=Object.entries(views).map(([key,title])=>`<button class="nav-item ${view===key?'active':''}" data-view="${key}" aria-label="${title}" title="${title}" ${view===key?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icons[key]}</span><span class="nav-label">${title}</span></button>`).join('');
    $('#breadcrumb-view').textContent=views[view];
    const titles={roadmap:['연구의 큰 흐름을 그려요','주차별로 배치하고, 월·연도 단위로 멀리 보세요. L4 행의 빈 구간을 드래그해 기간을 잡고, +로 L5 세부 연구를 더하세요.'],overview:['올해 무엇을 증명할까요?','연간 핵심 질문과 성공 기준을 먼저 정하고, 분기마다 어떤 연구를 이어갈지 살펴보세요.'],backlog:['다음 연구의 가능성을 모아요','아직 기간을 정하지 않은 연구 후보와 이미 배치한 연구를 함께 다듬습니다.'],goals:['연구의 방향을 먼저 정해요','주황색 L3 아래에 L4 기술을 묶고, 직접 작성한 L5 세부 연구로 구체화합니다.'],notes:['발견과 생각을 깊게 남겨요','관련 연구, 논문 읽기, 긴 메모를 연구축과 연결합니다.'],settings:['편안한 화면으로 연구해요','화면 테마와 연구 유형별 색상을 설정합니다.'],references:['처음의 생각을 다시 꺼내요','로드맵과 핵심 목표 원본, 관련 연구를 한곳에서 찾아보세요.']};
    $('#page-title').textContent=titles[view][0];$('#page-description').textContent=titles[view][1];updateStats();
    const host=$('#view-host');$('#stats').hidden=view==='settings';
    if(view==='roadmap')renderRoadmap(host);
    else if(view==='overview')renderOverview(host);
    else if(view==='settings')renderSettings(host);
    else if(view==='backlog'){host.innerHTML=backlogHTML();bindFilters();bindTasks(host);}
    else window.ResearchNotebook.render(view,host,{state,escape:esc,uid,save,refresh:render,toast,openTask,navigate,rememberRecovery,updateStats,hierarchy:H,categoryLabels:categories,statusLabels:statuses});
  }
  function filtersHTML() {
    return `<div class="planning-filters"><select id="goal-filter" aria-label="L3 연구축 필터">${goalOptions(goalFilter)}</select><select id="category-filter" aria-label="연구 유형 필터">${options(categories,categoryFilter,'모든 연구 유형')}</select><select id="status-filter" aria-label="상태 필터">${options(statuses,statusFilter,'모든 상태')}</select>${search||goalFilter||categoryFilter||statusFilter?'<button class="text-button" id="clear-filters">필터 초기화</button>':''}</div>`;
  }
  function bindFilters() {
    for(const [id,set] of [['goal-filter',v=>goalFilter=v],['category-filter',v=>categoryFilter=v],['status-filter',v=>statusFilter=v]]) {
      const el=$('#'+id);if(el)el.onchange=()=>{set(el.value);render();};
    }
    if($('#clear-filters'))$('#clear-filters').onclick=()=>{goalFilter=categoryFilter=statusFilter=search='';$('#global-search').value='';render();};
  }
  function rangeHeading(cols) {
    const a=P.date(cols[0].start),b=P.date(cols.at(-1).end);
    return unit==='year'?`${a.getFullYear()} — ${b.getFullYear()}`:`${a.getFullYear()}.${String(a.getMonth()+1).padStart(2,'0')} — ${a.getFullYear()===b.getFullYear()?'':b.getFullYear()+'.'}${String(b.getMonth()+1).padStart(2,'0')}`;
  }
  function renderRoadmap(host) {
    const hiddenCount=state.tasks.filter(t=>!H.isRoadmapVisible(state.tasks,t.id)).length;
    const cols=P.columns(anchor,unit), focusYear=P.date(anchor).getFullYear();
    const focus=state.annualPlans.find(p=>p.year===focusYear);
    host.innerHTML=`<section class="planning-panel"><div class="planning-toolbar"><div class="planning-tools"><h2>${rangeHeading(cols)}</h2><button type="button" id="roadmap-visibility" class="secondary-button roadmap-visibility-button">기술 표시 설정${hiddenCount?` <span>숨김 ${hiddenCount}</span>`:''}</button><label class="planning-jump"><span>기준 월</span><input id="anchor-month" type="month" min="2026-11" value="${anchor.slice(0,7)}" aria-label="로드맵 기준 월"></label></div><div class="planning-scale segmented-control" role="group" aria-label="로드맵 시간 단위">${Object.entries(units).map(([key,label])=>`<button data-unit="${key}" class="${unit===key?'active':''}" aria-pressed="${unit===key}">${label}</button>`).join('')}</div></div>${filtersHTML()}<div class="planning-caption"><span>${unit==='week'?'13주를 한눈에 · 월요일부터 일요일까지, 매월 첫 월요일이 첫째주':unit==='month'?'12개월을 한눈에 · 연구를 월 단위로 배치':'5년을 한눈에 · 장기 연구 방향을 배치'}</span><span>구간 드래그로 연구 배치 ↔</span></div><div id="timeline-host"></div></section><div class="bigpicture-strip"><div class="strategy-side-card"><div class="section-label">${focusYear}년의 연구 방향 <button class="text-button" id="edit-year-direction">방향 정리 ↗</button></div><p class="strategy-note">${esc(focus?.focus||'이 해의 핵심 질문을 먼저 정해 보세요. 어떤 가능성을 검증하고, 어떤 성과로 이어갈까요?')}</p></div><div class="strategy-side-card"><div class="section-label">L3별 배치</div><div class="year-goal-summary">${state.goals.map(g=>`<span class="strategy-meter"><span>${esc(g.title)}</span><strong>${state.tasks.filter(t=>t.goalId===g.id&&t.start).length}<small>개</small></strong></span>`).join('')}</div></div><div class="strategy-side-card"><div class="section-label">기획의 기준</div><p class="strategy-note">“언제까지 무엇을 밝혀낼까?”</p><p class="focus-help">하루의 할 일보다 연구 질문과 구간별 결과물에 집중해 보세요. 자세한 생각은 연구 노트에 이어서 남길 수 있어요.</p></div></div>${candidateHTML(6)}`;
    window.ResearchTimeline.render($('#timeline-host'),{state,unit,anchor,escape:esc,filteredTasks,openTask,reschedule,toast,periods:P,categories,statusLabels:statuses,colors:palette(),hierarchy:H,addChild,goalFilter,moveTask,reorderTask,stepPeriod,onSelectL3:id=>{goalFilter=id;render();}});
    $('#roadmap-visibility').onclick=openRoadmapVisibility;
    bindFilters();bindTasks(host);
    host.querySelectorAll('[data-unit]').forEach(button=>button.onclick=()=>{unit=button.dataset.unit;render();});
    $('#anchor-month').onchange=e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)&&e.target.value>='2026-11'){anchor=e.target.value+'-01';render();}};
    $('#edit-year-direction').onclick=()=>{selectedYear=focusYear;navigate('overview');$('#annual-focus')?.focus();};
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
    host.innerHTML=`<section class="settings-panel appearance-panel"><div class="settings-heading"><h2>화면 테마</h2><p>이 브라우저에 저장되며 홈과 업무 공간에 함께 적용됩니다.</p></div><div class="theme-options" role="group" aria-label="화면 테마"><button type="button" data-theme-value="dark" aria-pressed="true">☾ 다크 모드</button><button type="button" data-theme-value="light" aria-pressed="false">☀ 라이트 모드</button></div></section><section class="settings-panel"><div class="settings-heading"><h2>연구 유형별 색상</h2><p>색상 칸을 눌러 고르거나 색상 코드를 직접 입력하세요.</p></div><form id="color-settings-form"><div class="settings-colors">${Object.entries(categories).map(([key,label])=>`<div class="settings-color-row"><label for="color-${key}">${esc(label)}</label><input type="color" id="color-${key}" aria-label="${esc(label)} 색상" value="${draft[key]}"><label class="sr-only" for="color-hex-${key}">${esc(label)} 색상 코드</label><input class="settings-hex" id="color-hex-${key}" aria-label="${esc(label)} 색상 코드" value="${draft[key]}" pattern="#[0-9a-fA-F]{6}" maxlength="7" required spellcheck="false"><span class="settings-color-preview" id="color-preview-${key}" style="--event-color:${draft[key]}">${esc(label)} 일정</span></div>`).join('')}</div><p class="settings-color-help">전체 기간 막대는 같은 색을 진하게 표시합니다. 완료·보류 표시는 유지됩니다.</p><div class="settings-footer"><button type="button" class="secondary-button" id="reset-colors">기본 색상으로 돌리기</button><span id="color-settings-status" role="status">저장을 눌러 적용하세요.</span><button type="submit" class="primary-button">색상 저장</button></div></form></section>`;
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
    const year=selectedYear, tasks=filteredTasks().map(t=>({...t,...H.effectiveRange(state.tasks,t.id)})).filter(t=>t.start&&t.start<=`${year}-12-31`&&t.end>=`${year}-01-01`);
    const plan=state.annualPlans.find(p=>p.year===year)||{focus:'',success:'',notes:''};
    host.innerHTML=`<div class="year-toolbar"><div class="button-row"><button class="icon-button" id="previous-year" aria-label="이전 연도" ${year===2026?'disabled':''}>‹</button><h2>${year}년의 연구 지도</h2><button class="icon-button" id="next-year" aria-label="다음 연도">›</button></div><button class="secondary-button" id="year-to-months">이 해를 월별 로드맵으로 보기 ↗</button></div><section class="year-focus-panel"><div class="year-focus-field"><label for="annual-focus">이 해에 풀고 싶은 핵심 질문</label><textarea id="annual-focus" placeholder="예: 취약점 진단과 온톨로지를 어떻게 하나의 개선 흐름으로 연결할까?">${esc(plan.focus)}</textarea></div><div class="year-focus-field"><label for="annual-success">연말에 무엇을 확보하면 성공일까요?</label><textarea id="annual-success" placeholder="검증할 가설, 남길 기술과 성과, 의사 결정 기준을 적어 보세요.">${esc(plan.success)}</textarea></div><div class="year-focus-field year-focus-notes"><label for="annual-notes">아직 열어 두고 싶은 선택지 · 제약</label><textarea id="annual-notes" placeholder="채용, 외부 협업, 선행 결과에 따라 달라질 연구 방향을 남겨 두세요.">${esc(plan.notes)}</textarea></div><span class="field-help" id="annual-save-status">입력하면 자동 저장됩니다.</span></section>${filtersHTML()}<div class="quarter-grid">${[0,1,2,3].map(q=>`<section class="quarter-card"><div class="quarter-header"><span>Q${q+1}</span><strong>${q*3+1} — ${q*3+3}월</strong></div>${[1,2,3].map(k=>{const n=q*3+k,m=`${year}-${String(n).padStart(2,'0')}`,afterMin=m>='2026-11',list=tasks.filter(t=>t.start<=P.monthEnd(m+'-01')&&t.end>=m+'-01');return `<div class="quarter-month ${!afterMin?'before-project':''}"><div class="quarter-month-title"><strong>${n}월</strong>${afterMin?`<button class="text-button" data-add-month="${m}" aria-label="${year}년 ${n}월에 연구 추가">＋</button>`:'<small>계획 시작 전</small>'}</div>${list.map(t=>`<button class="year-research-pill ${t.parentId?'is-subtask':''}" style="--event-color:${palette()[t.category]}" data-task="${esc(t.id)}"><span>${esc(t.title)}</span><small>${t.parentId?`↳ ${esc(taskPath(t))}`:esc(state.goals.find(g=>g.id===t.goalId)?.title||categories[t.category])}</small></button>`).join('')||`<p class="quarter-empty">${afterMin?'열려 있는 연구 구간':''}</p>`}</div>`;}).join('')}</section>`).join('')}</div><section class="year-goal-summary"><div class="candidate-header"><div><h2>이 해의 연구축</h2><p>한 해에 배치한 연구를 목표별로 점검하세요.</p></div></div><div class="candidate-grid">${state.goals.map(g=>{const list=tasks.filter(t=>t.goalId===g.id);return `<article class="year-goal-card"><h3>${esc(g.title)}</h3><p>${esc(g.metric)}</p><strong>${list.length}<small>개 연구 구간</small></strong><div class="button-row">${list.map(t=>`<button class="text-button" data-task="${esc(t.id)}">${esc(t.title)}</button>`).join('')||'<span class="field-help">아직 배치한 연구가 없습니다.</span>'}</div></article>`;}).join('')}</div></section>`;
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
    const range=H.effectiveRange(state.tasks,parentId), childUnit=parent.planUnit||unit;
    const first=range.start?P.cover(range.start,range.start,childUnit):{start:'',end:''};
    openTask(null,{...first,parentId,planUnit:childUnit,goalId:H.rootOf(state.tasks,parentId)?.goalId||'',status:first.start?'planned':'backlog'});
  }
  function groupRangeUpdates(tasks,id,period,planUnit,moveChildren=true) {
    const task=tasks.find(t=>t.id===id), old=H.effectiveRange(tasks,id);
    if(!task)return [];
    const stamp=new Date().toISOString(), updates=[{id,...period,planUnit,legacyDates:false,updatedAt:stamp}];
    if(!moveChildren||!old.start||!period.start||!H.childrenOf(tasks,id).length)return updates;
    const floor=d=>planUnit==='week'?P.startOfWeek(d):planUnit==='month'?P.monthStart(d):P.yearStart(d);
    const ceil=d=>planUnit==='week'?P.endOfWeek(d):planUnit==='month'?P.monthEnd(d):P.yearEnd(d);
    const n=planUnit==='week'?Math.round(P.daysBetween(floor(period.start),floor(old.start))/7):planUnit==='month'?(+period.start.slice(0,4)-+old.start.slice(0,4))*12+(+period.start.slice(5,7)-+old.start.slice(5,7)):+period.start.slice(0,4)-+old.start.slice(0,4);
    const expectedStart=floor(P.step(floor(old.start),n,planUnit)), expectedEnd=ceil(P.step(floor(old.end),n,planUnit));
    // A resize changes the overall target; a translation carries the subtree together.
    if(!n||period.start!==(expectedStart<MIN_DATE?MIN_DATE:expectedStart)||period.end!==expectedEnd)return updates;
    for(const child of H.descendantsOf(tasks,id).filter(t=>t.start)) {
      const start=P.step(child.start,n,planUnit);
      let end=P.step(child.end,n,planUnit);
      if(planUnit!=='week'&&child.end===P.monthEnd(child.end))end=P.monthEnd(end);
      if(!P.validDate(start)||!P.validDate(end)||start<MIN_DATE||end<start)throw Error('세부 연구가 계획 시작 범위를 벗어나 이동할 수 없습니다.');
      const covered=P.cover(start,end,child.planUnit||'week');
      updates.push({id:child.id,start,end,legacyDates:covered.start!==start||covered.end!==end,updatedAt:stamp});
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
      const period=P.cover(start,end,planUnit),updates=groupRangeUpdates(state.tasks,id,period,planUnit,true);
      for(const change of updates)Object.assign(state.tasks.find(t=>t.id===change.id),change);
      if(task.status==='backlog')task.status='planned';
      const ok=save();render();toast((ok?`연구 구간을 옮겼습니다.${updates.length>1?' 세부 연구도 함께 이동했습니다.':''}`:'화면에 반영했습니다. JSON 백업을 저장해 주세요.')+overflowMessage(id));
    } catch(e){toast(e.message);render();}
  }
  function deleteTask(id) {
    if(readOnly)return false;
    const target=state.tasks.find(t=>t.id===id);if(!target)return false;
    rememberRecovery();
    state.tasks=state.tasks.filter(t=>t.id!==id);
    state.tasks.forEach(t=>{if(t.parentId===id)t.parentId=target.parentId||'';t.dependencies=t.dependencies.filter(x=>x!==id);});
    dirty=false;$('#task-dialog').close();save();render();return true;
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
    const u=task.planUnit||unit, start=task.start||anchor, end=task.end||start, disabled=!task.start?'disabled':'';
    const label={week:['시작 주','마지막 주'],month:['시작 월','마지막 월'],year:['시작 연도','마지막 연도']}[u];
    const type={week:'week',month:'month',year:'number'}[u],min={week:P.toWeek(MIN_DATE),month:'2026-11',year:'2026'}[u];
    const value=s=>u==='week'?P.toWeek(s):u==='month'?s.slice(0,7):s.slice(0,4);
    return `<div class="period-fields"><div class="form-field"><label for="period-start">${label[0]}</label><input id="period-start" name="periodStart" type="${type}" min="${min}" ${u==='year'?'max="9998"':''} value="${value(start)}" ${disabled}></div><div class="form-field"><label for="period-end">${label[1]}</label><input id="period-end" name="periodEnd" type="${type}" min="${min}" ${u==='year'?'max="9998"':''} value="${value(end)}" ${disabled}></div></div><p class="field-help">${u==='week'?'월요일부터 일요일까지를 한 주로 봅니다. 월을 걸치는 주도 한 구간입니다.':u==='month'?'한 달 전체를 하나의 연구 구간으로 배치합니다.':'한 해 전체를 하나의 연구 구간으로 배치합니다.'}</p><div class="planning-duration" id="planning-duration">${task.start?esc(P.spanLabel({...task,planUnit:u})):'아직 기간을 정하지 않았습니다.'}</div>`;
  }
  function readEditorPeriod() {
    if($('#unscheduled').checked)return {start:'',end:''};
    const u=$('#task-unit').value,a=$('#period-start').value,b=$('#period-end').value;
    let start='',end='';
    if(u==='week'){start=P.fromWeek(a);const monday=P.fromWeek(b);end=monday?P.endOfWeek(monday):'';}
    if(u==='month'&&/^\d{4}-\d{2}$/.test(a)&&/^\d{4}-\d{2}$/.test(b)){start=a+'-01';end=P.monthEnd(b+'-01');}
    if(u==='year'&&/^\d{4}$/.test(a)&&/^\d{4}$/.test(b)){start=a+'-01-01';end=b+'-12-31';}
    if(!P.validDate(start)||!P.validDate(end)||end<start||end<MIN_DATE)throw Error('시작 구간과 마지막 구간을 올바른 순서로 입력해 주세요.');
    return P.cover(start,end,u);
  }
  function updateDuration() {
    try {const period=readEditorPeriod();$('#planning-duration').textContent=period.start?P.spanLabel({...period,planUnit:$('#task-unit').value}):'아직 기간을 정하지 않았습니다.';}
    catch(e){$('#planning-duration').textContent='연구 구간을 확인해 주세요.';}
  }
  function markDirty() {dirty=true;$('#task-save-status').textContent='아직 저장하지 않은 변경';}
  function openTask(id,defaults={}) {
    if(readOnly&&!id)return false;
    const original=id?state.tasks.find(t=>t.id===id):null;if(id&&!original)return;
    lastFocus=document.activeElement;
    const task={title:'',start:'',end:'',status:'backlog',category:'research',goalId:goalFilter,phaseId:'',description:'',deliverable:'',notes:'',dependencies:[],owner:'',planUnit:unit,parentId:'',...clone(original||{}),...defaults};
    if(task.parentId)task.goalId=H.rootOf(state.tasks,task.parentId)?.goalId||'';
    if(task.start&&task.status==='backlog')task.status='planned';
    editorDraft=task;periodEdited=!!defaults.start;
    const children=original?H.childrenOf(state.tasks,id):[],dialog=$('#task-dialog');
    dialog.innerHTML=`<form id="task-form" class="task-form"><div class="drawer-header"><div><span class="eyebrow">${task.parentId?'L5 · SUB RESEARCH':'L4 · RESEARCH TECHNOLOGY'}</span><h2 id="task-dialog-title">${task.parentId?'세부 연구 다듬기':original?'연구 구간 다듬기':'새로운 연구 구간'}</h2><p>${task.start?esc(P.spanLabel(task)):'연구의 가능성을 먼저 기록하고 기간은 나중에 정해도 좋아요.'}</p></div><button class="close-button" type="button" id="task-close" aria-label="닫기">×</button></div><div class="drawer-body"><div class="form-grid">${!original&&task.start?`<div class="form-field field-full"><label for="assign-existing">기존 연구 후보를 이 구간에 배치</label><select id="assign-existing"><option value="">새 연구 구간 작성</option>${state.tasks.filter(t=>!t.start&&(!task.parentId||(!t.assetId&&H.canParent(state.tasks,t.id,task.parentId)))).map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('')}</select></div>`:''}${task.assetId?`<div class="taxonomy-source-card field-full"><span>L4 · 기술자산 맵 ${esc(task.sourceCell||'')}</span><strong>${esc((task.officialTitle||task.title).split(/\s*->\s*/)[0])}</strong><small>기술의 공식 분류입니다. 아래 제목·일정·메모는 자유롭게 다듬으세요.</small></div>`:''}<div class="form-field field-full"><label for="task-title">${task.parentId?'L5 세부 연구':'L4 기술 · 연구'} <span class="required">*</span></label><input id="task-title" name="title" value="${esc(task.title)}" required maxlength="300" placeholder="이 구간에서 어떤 연구를 할까요?"></div><div class="hierarchy-editor field-full"><div class="form-field"><label for="task-parent">상위 기술 · 연구</label><select class="hierarchy-parent-picker" id="task-parent" name="parentId">${hierarchyParentOptions(id,task.parentId)}</select></div><div id="hierarchy-parent-context" class="hierarchy-parent-context"></div><p class="hierarchy-editor-help">L4는 기술의 전체 기간, L5는 그 아래에서 진행할 세부 연구입니다. 기존의 더 깊은 연결도 유지합니다.</p></div><div class="form-field field-full"><label for="task-goal">연결할 L3 연구축</label><select id="task-goal" name="goalId">${goalOptions(task.goalId,'L3 미연결')}</select></div><div class="planning-intent field-full"><div class="form-field"><label for="task-unit">어느 단위로 계획할까요?</label><select id="task-unit" name="planUnit">${options(units,task.planUnit)}</select></div><label class="period-unscheduled"><input id="unscheduled" type="checkbox" ${!task.start?'checked':''}> ${children.length?'전체 목표 기간은 미정 · 세부 기간으로 요약 표시':'기간은 아직 미정'}</label><div id="period-fields">${periodFieldsHTML(task)}</div>${children.length?'<label class="period-unscheduled hierarchy-parent-note"><input type="checkbox" id="move-children" checked> 전체 기간을 이동할 때 세부 연구도 함께 이동</label><p class="field-help">전체 기간의 길이만 늘이거나 줄이면 세부 기간은 유지됩니다.</p>':''}${task.legacyDates&&!defaults.start?'<p class="legacy-period-note">기존에 입력한 기간은 그대로 보존했습니다. 기간을 수정할 때 선택한 주·월·연 단위로 맞춥니다.</p>':''}</div><div class="hierarchy-warning field-full" id="hierarchy-period-warning"></div>${original?subtaskSectionHTML(original):''}<label class="task-visibility-field field-full"><input id="task-roadmap-visible" type="checkbox" ${!task.roadmapHidden?'checked':''}> 연구 로드맵에 표시</label><div class="task-papers field-full" id="task-papers"></div><div class="form-field field-full"><label for="task-description">핵심 연구 질문 · 접근 방향</label><textarea id="task-description" name="description" rows="5" placeholder="어떤 질문에 답하고, 어떤 가설을 검증할까요?">${esc(task.description)}</textarea></div><div class="form-field field-full"><label for="task-deliverable">이 구간에서 확보할 결과 · 판단 기준</label><textarea id="task-deliverable" name="deliverable" rows="3" placeholder="논문 초안, 검증된 가설, 기술의 가능성 판단 등">${esc(task.deliverable)}</textarea></div><div class="form-field"><label for="task-status">연구 상태</label><select id="task-status" name="status">${options(statuses,task.status)}</select></div><div class="form-field"><label for="task-category">연구 유형</label><select id="task-category" name="category">${options(categories,task.category)}</select></div><details class="advanced-plan field-full"><summary>연구 단계 · 담당 · 선행 연구 · 상세 메모</summary><div class="form-grid"><div class="form-field"><label for="task-phase">로드맵 단계</label><select id="task-phase" name="phaseId"><option value="">단계 미연결</option>${state.phases.map(p=>`<option value="${esc(p.id)}" ${task.phaseId===p.id?'selected':''}>${esc(p.title)}</option>`).join('')}</select></div><div class="form-field"><label for="task-owner">담당 · 협업</label><input id="task-owner" name="owner" value="${esc(task.owner)}" placeholder="담당자 또는 협업 그룹"></div><div class="form-field field-full"><label for="task-dependencies">먼저 확인해야 하는 연구</label><select id="task-dependencies" name="dependencies" multiple size="4">${state.tasks.filter(t=>t.id!==id).map(t=>`<option value="${esc(t.id)}" ${task.dependencies.includes(t.id)?'selected':''}>${esc(t.title)}</option>`).join('')}</select><span class="field-help">⌘/Ctrl+클릭으로 여러 개 선택. 선행 연구에 따라 구간을 자동 이동하지는 않습니다.</span></div><div class="form-field field-full"><label for="task-notes">상세 메모</label><textarea id="task-notes" name="notes" rows="7">${esc(task.notes)}</textarea></div></div></details>${original?`<div class="linked-notes field-full"><div class="section-label">이 연구축의 기록</div>${state.notes.filter(n=>n.goalId&&n.goalId===task.goalId).slice(0,4).map(n=>`<button class="linked-note" type="button" data-note="${esc(n.id)}">▧ ${esc(n.title)} ↗</button>`).join('')||'<p class="field-help">연구 노트에서 같은 연구축을 연결할 수 있어요.</p>'}</div>`:''}<p class="form-error field-full" id="task-error" role="alert"></p></div></div><div class="drawer-footer"><div class="button-row">${original?'<button type="button" class="danger-button" id="task-delete">삭제</button><button type="button" class="secondary-button" id="task-duplicate">복제</button>':''}<span class="field-help" id="task-save-status">저장을 눌러 반영하세요</span></div><div class="button-row"><button type="button" class="secondary-button" id="task-cancel">취소</button><button type="submit" class="primary-button">연구 구간 저장</button></div></div></form>`;
    const form=$('#task-form');dirty=false;
    window.ResearchPapers.mount($('#task-papers'),task,{readOnly,onChange:markDirty,toast,uid});
    $('#task-roadmap-visible').onchange=markDirty;
    const syncHierarchy=()=>{
      const parentId=$('#task-parent').value,parent=state.tasks.find(t=>t.id===parentId),context=$('#hierarchy-parent-context');
      $('#task-goal').disabled=!!parent||!!task.assetId;$('#task-parent').disabled=!!task.assetId;
      if(parent){$('#task-goal').value=H.rootOf(state.tasks,parentId)?.goalId||'';const range=H.effectiveRange(state.tasks,parentId);context.innerHTML=`<strong>${esc(parent.title)}</strong><span>${esc(P.spanLabel({...parent,...range}))}</span><small>상위 L4와 같은 L3 연구축에 연결됩니다.</small>`;}
      else context.innerHTML='';
      try {
        const period=original&&!periodEdited?{start:original.start,end:original.end}:readEditorPeriod();
        const next=state.tasks.map(t=>t.id===id?{...t,...period,parentId}:t);
        if(!original)next.push({...task,...period,parentId,id:'__editor_draft__'});
        const warnings=[];
        if(parent?.start&&period.start&&(period.start<parent.start||period.end>parent.end))warnings.push('세부 기간이 상위 연구의 전체 목표 기간 밖에 있습니다. 저장 후 전체 기간을 맞추거나 세부 기간을 조정할 수 있어요.');
        if(original&&period.start&&H.findOverflow(next,id).length)warnings.push('전체 목표 기간 밖에 있는 세부 연구가 있습니다. 전체 기간과 세부 기간을 확인해 주세요.');
        $('#hierarchy-period-warning').textContent=warnings.join(' ');
      }catch(e){$('#hierarchy-period-warning').textContent='';}
    };
    form.oninput=e=>{if(!e.target.name&&!['unscheduled','move-children'].includes(e.target.id))return;markDirty();if(['periodStart','periodEnd','planUnit'].includes(e.target.name)){periodEdited=true;updateDuration();syncHierarchy();}};
    const bindPeriodInputs=()=>{for(const inputId of ['period-start','period-end'])$('#'+inputId).onchange=()=>{periodEdited=true;markDirty();updateDuration();syncHierarchy();};};bindPeriodInputs();
    $('#task-parent').onchange=()=>{markDirty();syncHierarchy();};
    $('#task-unit').onchange=()=>{
      let previous;try{previous=readPeriodForPreviousUnit(task.planUnit);}catch(e){previous={start:task.start||anchor,end:task.end||anchor};}
      task.planUnit=$('#task-unit').value;const pending=$('#unscheduled').checked;
      $('#period-fields').innerHTML=periodFieldsHTML({...task,...previous,start:pending?'':previous.start,end:pending?'':previous.end});bindPeriodInputs();periodEdited=true;markDirty();updateDuration();syncHierarchy();
    };
    $('#unscheduled').onchange=()=>{for(const inputId of ['period-start','period-end'])$('#'+inputId).disabled=$('#unscheduled').checked;periodEdited=true;markDirty();updateDuration();syncHierarchy();};
    const assign=$('#assign-existing');if(assign)assign.onchange=()=>{if(!assign.value)return;if(dirty&&!confirm('작성 중인 내용을 닫고 연구 후보를 배치할까요?')){assign.value='';return;}const chosen=state.tasks.find(t=>t.id===assign.value);dirty=false;openTask(assign.value,{start:task.start,end:task.end,planUnit:task.planUnit,parentId:task.parentId||chosen.parentId||'',status:'planned'});};
    $('#task-close').onclick=$('#task-cancel').onclick=closeTask;dialog.oncancel=e=>{e.preventDefault();closeTask();};
    // Only dismiss a gesture that starts and ends on the backdrop.
    // Selecting text inside the drawer and releasing outside must keep it open.
    const outside=e=>{const r=dialog.getBoundingClientRect();return e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom);};
    let backdropPressed=false;
    dialog.onpointerdown=e=>{backdropPressed=e.button===0&&outside(e);};
    dialog.onpointercancel=()=>{backdropPressed=false;};
    dialog.onclick=e=>{const dismiss=backdropPressed&&outside(e);backdropPressed=false;if(dismiss)closeTask(true);};
    dialog.querySelectorAll('[data-note]').forEach(el=>el.onclick=()=>{if(!closeTask())return;navigate('notes');window.ResearchNotebook.openNote(el.dataset.note);});
    if(original) {
      $('#editor-add-child').onclick=()=>{if(closeTask())addChild(id);};
      dialog.querySelectorAll('[data-edit-child]').forEach(el=>el.onclick=()=>{if(closeTask())openTask(el.dataset.editChild);});
      if($('#fit-children-range'))$('#fit-children-range').onclick=()=>{
        const ranges=H.descendantsOf(state.tasks,id).filter(t=>t.start);if(!ranges.length)return toast('아직 기간을 정한 세부 연구가 없습니다.');
        const covered=P.cover(ranges.reduce((a,t)=>t.start<a?t.start:a,ranges[0].start),ranges.reduce((a,t)=>t.end>a?t.end:a,ranges[0].end),$('#task-unit').value);
        task.start=covered.start;task.end=covered.end;$('#unscheduled').checked=false;$('#period-fields').innerHTML=periodFieldsHTML({...task,planUnit:$('#task-unit').value});bindPeriodInputs();periodEdited=true;markDirty();updateDuration();syncHierarchy();
      };
      $('#task-delete').onclick=()=>{if(!confirm(`‘${original.title}’ 연구를 삭제할까요?${children.length?' 세부 연구는 유지하고 한 단계 위로 옮깁니다.':''} 백업 메뉴에서 되돌릴 수 있습니다.`))return;deleteTask(id);toast('연구를 삭제했습니다. 세부 연구는 보존했습니다.');};
      $('#task-duplicate').onclick=()=>{if(dirty&&!confirm('저장된 내용으로 복제할까요? 편집 중인 내용은 저장되지 않습니다.'))return;dirty=false;dialog.close();const copyId=duplicateTask(id);openTask(copyId);};
    }
    form.onsubmit=e=>{
      e.preventDefault();if(readOnly)return;if($('#task-papers').dataset.processing==='true')return taskError('Figure 준비가 끝나면 저장해 주세요.');const fd=new FormData(form),values=Object.fromEntries(fd);values.title=values.title.trim();values.dependencies=fd.getAll('dependencies');
      if(!values.title)return taskError('연구 주제를 입력해 주세요.');
      let period;
      try{period=original&&!periodEdited?{start:original.start,end:original.end}:readEditorPeriod();}catch(error){return taskError(error.message);}
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
      state.tasks=next;
      const ok=save();dirty=false;dialog.close();if(values.start){const shown=P.columns(anchor,unit);if(values.start<shown[0].start||values.start>shown.at(-1).end)anchor=values.start;selectedYear=P.date(values.start).getFullYear();}render();toast((ok?'연구 구간을 저장했습니다.':'화면에 반영했습니다. JSON 백업으로 보관해 주세요.')+overflowMessage(newId));
    };
    syncHierarchy();if(!dialog.open)dialog.showModal();$('#task-title').focus();
  }
  function readPeriodForPreviousUnit(previousUnit) {
    if($('#unscheduled').checked)return {start:editorDraft.start||anchor,end:editorDraft.end||anchor};
    const a=$('#period-start').value,b=$('#period-end').value;
    if(previousUnit==='week'){const start=P.fromWeek(a),end=P.fromWeek(b);if(!start||!end)throw Error();return {start,end:P.endOfWeek(end)};}
    if(previousUnit==='month'){const start=a+'-01',end=P.monthEnd(b+'-01');if(!P.validDate(start)||!P.validDate(end))throw Error();return {start,end};}
    const start=a+'-01-01',end=b+'-12-31';if(!P.validDate(start)||!P.validDate(end))throw Error();return {start,end};
  }
  function taskError(message){$('#task-error').textContent=message;$('#task-error').scrollIntoView({block:'nearest'});}
  function closeTask(discard=false){if(dirty&&discard!==true&&!confirm('저장하지 않은 변경 사항이 있습니다. 닫을까요?'))return false;dirty=false;$('#task-dialog').close();lastFocus?.focus?.();return true;}
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
    const refresh=()=>{if(!dirty&&view!=='settings'&&!window.ResearchTimeline?.isInteracting?.()&&document.visibilityState!=='hidden'&&!$('#utility-dialog').open&&!$('#task-dialog').open&&!sync.getStatus().paused)void sync.refresh();};
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    setInterval(refresh,10000);
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
  document.addEventListener('click',e=>{const target=e.target.closest('[data-view]');if(target)navigate(target.dataset.view);});
  $('#global-search').oninput=e=>{search=e.target.value;if(!['roadmap','overview','backlog'].includes(view))navigate('backlog');else render();};
  $('#add-task').onclick=()=>openTask(null,view==='roadmap'?defaultPeriod():view==='overview'?{start:`${selectedYear}-${selectedYear===2026?'11':'01'}-01`,end:`${selectedYear}-12-31`,planUnit:'year'}:{planUnit:unit});
  $('#backup-open').onclick=$('#backup-top').onclick=openBackup;
  window.addEventListener('hashchange',()=>{const next=alias(location.hash.slice(1));if(views[next]&&next!==view){view=next;render();}});
  window.addEventListener('beforeunload',e=>{if(dirty||storageFailed){e.preventDefault();e.returnValue='';}});
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue)toast('다른 창에서 계획이 변경됐습니다. 현재 내용을 백업한 뒤 새로고침해 주세요.');});
  const initialParams=new URLSearchParams(location.search||'');
  if(Object.hasOwn(units,initialParams.get('unit')))unit=initialParams.get('unit');
  if(state.goals.some(g=>g.id===initialParams.get('l3')))goalFilter=initialParams.get('l3');
  const requested=alias(location.hash.slice(1));if(views[requested])view=requested;
  render();if(sourceIssue)toast(sourceIssue);
  if(window.ResearchWorkspaceSync&&!sourceIssue)initWorkspace();
  window.ResearchAtlas={getState:()=>clone(state),validateState,dateUtils:P,hierarchy:H,operations:{openRoadmapVisibility,openTask,addChild,reschedule,deleteTask,duplicateTask,moveTask,reorderTask,stepPeriod}};
})();
