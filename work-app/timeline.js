(() => {
  'use strict';

  const MIN_DATE = '2026-11-01';
  const UNIT_LABELS = {week: '주차', month: '월', year: '연도'};
  const DEFAULT_STATUSES = {backlog: '기간 미정', planned: '예정', active: '진행 중', done: '완료', paused: '보류'};
  const DEFAULT_COLORS = {research: '#3479e9', experiment: '#12a898', writing: '#8864ce', meeting: '#dc9951', milestone: '#da6d8a'};
  let controller = null;
  let clearInteraction = null;
  const collapsedTasks = new Set();
  let showChildren = true;
  let interactionActive = false;

  const dayNumber = value => Date.parse(value + 'T00:00:00Z') / 86400000;
  const dayDistance = (end, start) => dayNumber(end) - dayNumber(start);
  const safeColor = value => /^#[0-9a-f]{3,8}$/i.test(value || '') ? value : '#3479e9';

  function destroy() {
    controller?.abort();
    controller = null;
    clearInteraction?.();
    clearInteraction = null;
  }

  function render(host, api) {
    destroy();
    const p = api.periods || window.ResearchPeriods;
    if (!host || !p) return;
    controller = new AbortController();
    const signal = controller.signal;
    const esc = api.escape;
    const unit = Object.hasOwn(UNIT_LABELS, api.unit) ? api.unit : 'week';
    const columns = p.columns(api.anchor || MIN_DATE, unit);
    if (!columns.length) return;
    const goals = api.state.goals || [];
    const statusLabels = api.statusLabels || DEFAULT_STATUSES;
    const colors = api.colors || DEFAULT_COLORS;
    const allTasks = api.state.tasks || [];
    const taskMap = new Map(allTasks.map(task => [task.id, task]));
    const H = api.hierarchy || window.ResearchHierarchy;
    // The fallback preserves the original flat timeline when used on its own.
    const childrenOf = id => H ? H.childrenOf(allTasks, id) : [];
    const ancestorsOf = id => H ? H.ancestorsOf(allTasks, id) : [];
    const rootOf = id => H ? H.rootOf(allTasks, id) : taskMap.get(id);
    const rangeOf = task => H ? H.effectiveRange(allTasks, task.id) : {start: task.start, end: task.end, derived: false};
    const hasRange = range => !!(range.start && range.end && range.end >= range.start);
    const progressOf = task => H ? H.progress(allTasks, task.id) : {done: +(task.status === 'done'), total: 1, percent: task.status === 'done' ? 100 : 0};
    const matches = api.filteredTasks().filter(task=>!H?.isRoadmapVisible||H.isRoadmapVisible(allTasks,task.id));
    const includedIds = new Set();
    matches.forEach(task => {
      includedIds.add(task.id);
      if(!api.strictTaskFilter)ancestorsOf(task.id).forEach(ancestor => includedIds.add(ancestor.id));
    });
    const tasks = allTasks.filter(task => includedIds.has(task.id));
    const visibleIds = new Set(tasks.map(task => task.id));
    const goalIds = new Set(goals.map(goal => goal.id));
    const rootGoalId = task => rootOf(task.id)?.goalId || '';
    const legacySelection=api.selectedL3Id||api.goalFilter;
    const selectedL3=Array.isArray(api.selectedL3Ids)?new Set(api.selectedL3Ids):legacySelection?new Set([legacySelection]):null;
    const groups = goals.filter(goal => !selectedL3 || selectedL3.has(goal.id)).map(goal => ({...goal, tasks: tasks.filter(task => rootGoalId(task) === goal.id)})).filter(group=>!api.hideEmptyGroups||group.tasks.length);
    const unlinked = tasks.filter(task => !goalIds.has(rootGoalId(task)));
    if ((!selectedL3||selectedL3.has('')) && unlinked.length) groups.push({id: '', title: 'L3 연결 전', tasks: unlinked});
    const displayTitle = task => !task.parentId && task.assetId ? (task.officialTitle||task.title).split(/\s*->\s*/)[0].trim() : task.title;
    const matchedIds = new Set(matches.map(task => task.id));
    const visibleStart = columns[0].start;
    const visibleEnd = columns[columns.length - 1].end;
    let interaction = null, orderFrame=null, suppressClick=false;

    function floor(value) {
      return unit === 'week' ? p.startOfWeek(value) : unit === 'month' ? p.monthStart(value) : p.yearStart(value);
    }
    function ceil(value) {
      return unit === 'week' ? p.endOfWeek(value) : unit === 'month' ? p.monthEnd(value) : p.yearEnd(value);
    }
    function position(value, isEnd) {
      if (value < visibleStart) return 0;
      if (value > visibleEnd) return columns.length;
      const index = columns.findIndex(column => value >= column.start && value <= column.end);
      if (index < 0) return 0;
      const column = columns[index];
      return index + (dayDistance(value, column.start) + (isEnd ? 1 : 0)) / (dayDistance(column.end, column.start) + 1);
    }
    function geometry(start, end) {
      // Week planning intentionally fills the complete week column, even for
      // historical day-level data. Coarser views retain date proportions.
      const first = unit === 'week' ? floor(start) : start;
      const last = unit === 'week' ? ceil(end) : end;
      if (last < visibleStart || first > visibleEnd) return {left: 0, width: 0, outside: true};
      const left = position(first, false), right = position(last, true);
      return {left: left / columns.length * 100, width: Math.max(0, right - left) / columns.length * 100, outside: false};
    }
    function spanLabel(task) { return p.spanLabel ? p.spanLabel(task) : `${task.start} — ${task.end}`; }
    function cells(goalId, task) {
      const scheduleTask = task && !hasRange(rangeOf(task)) ? task.id : '';
      const action = scheduleTask ? '이 연구의 기간 정하기' : task ? 'L5 세부 연구 만들기' : 'L4 기술 연구 만들기';
      return columns.map((column, index) => `<button type="button" class="timeline-cell" data-column="${index}" data-goal-id="${esc(goalId)}" data-parent-id="${esc(task?.id || '')}" data-schedule-task="${esc(scheduleTask)}" aria-label="${esc(column.group + ' ' + column.label + '에 ' + action)}" title="${esc(column.start)} — ${esc(column.end)} · ${action} · 기간을 끌어서 선택"></button>`).join('');
    }
    function barHTML(task) {
      const range = rangeOf(task);
      if (!hasRange(range)) return '<span class="timeline-unscheduled-label">기간 미정</span>';
      const geo = geometry(range.start, range.end);
      if (geo.outside) return '';
      const parent = childrenOf(task.id).length > 0;
      const progress = progressOf(task);
      const color = safeColor(colors[task.category]);
      const status = Object.hasOwn(statusLabels, task.status) ? task.status : 'planned';
      const depth=ancestorsOf(task.id).length, level=depth?'L5 하위 연구':'L4 기술', owner=task.owner?.trim()||'담당 미정';
      const label = `${level} / 담당: ${owner} / ${displayTitle(task)} · ${spanLabel({...task, ...range})}${parent ? ` · ${progress.done}/${progress.total} 완료` : ''} · Enter로 상세 편집`;
      return `<div class="timeline-bar status-${status}${parent ? ' is-summary' : ''}${ancestorsOf(task.id).length ? ' is-subtask' : ''}" role="button" tabindex="0" data-timeline-task="${esc(task.id)}" aria-label="${esc(label)}" title="${esc(label)}" style="left:${geo.left}%;width:${geo.width}%;--event-color:${color}"><span class="timeline-resize" data-resize="start" title="시작 ${UNIT_LABELS[unit]} 조정" aria-hidden="true"></span><span class="timeline-bar-copy"><span class="timeline-bar-heading"><b class="timeline-bar-level">${depth?'↳ L5':'L4'}</b><strong class="timeline-bar-title">${esc(task.title)}</strong></span><span class="timeline-bar-meta"><span class="timeline-bar-owner ${task.owner?.trim()?'':'is-unassigned'}">담당: ${esc(owner)}</span><span>${parent ? `${progress.done}/${progress.total} 완료` : esc(statusLabels[status])}</span>${range.derived ? '<span class="timeline-derived-badge">세부 기간</span>' : ''}</span></span><span class="timeline-resize" data-resize="end" title="종료 ${UNIT_LABELS[unit]} 조정" aria-hidden="true"></span></div>`;
    }
    function reorderHTML(task) {
      if(!api.reorderTask)return '';
      return `<button type="button" class="timeline-drag-handle" data-reorder-task="${esc(task.id)}" aria-label="${esc(task.title)} 순서 끌어 바꾸기" title="잡아서 위아래로 끌어 순서 변경 · 키보드 ↑ ↓">⠿</button>`;
    }
    function rowHTML(task, goalId) {
      if (!task) return `<div class="timeline-row"><div class="timeline-task-label timeline-empty-label"><strong>L4 기술 연구를 더해 보세요</strong><small>오른쪽 빈 기간을 선택하세요</small></div><div class="timeline-lane" data-goal-id="${esc(goalId)}">${cells(goalId)}</div></div>`;
      const range = rangeOf(task), scheduled = hasRange(range);
      const outside = scheduled && (range.end < visibleStart || range.start > visibleEnd);
      const children = childrenOf(task.id), depth = ancestorsOf(task.id).length;
      const parent = children.length > 0, progress = progressOf(task);
      const expanded = showChildren && !collapsedTasks.has(task.id);
      const overflow = H?.findOverflow(allTasks, task.id).length;
      const ancestorOverflow = scheduled && ancestorsOf(task.id).some(ancestor => ancestor.start && ancestor.end && (range.start < ancestor.start || range.end > ancestor.end));
      return `<div class="timeline-row${!matchedIds.has(task.id) ? ' hierarchy-context-row' : ''}${depth ? ' level-l5' : ' level-l4'}${parent ? ' is-parent' : ''}${depth ? ' is-child' : ''}" style="--task-depth:${depth}" data-task-row="${esc(task.id)}"><div class="timeline-task-label"><div class="timeline-task-label-main">${reorderHTML(task)}${parent ? `<button type="button" class="timeline-task-toggle" data-toggle-task="${esc(task.id)}" aria-expanded="${expanded}" aria-label="${esc(task.title)} 세부 과업 ${expanded ? '접기' : '펼치기'}" title="세부 과업 ${expanded ? '접기' : '펼치기'}">${expanded ? '▾' : '▸'}</button>` : '<span class="timeline-task-toggle-spacer" aria-hidden="true"></span>'}<button type="button" class="timeline-task-open" data-open-task="${esc(task.id)}" title="${esc(task.title)}"><strong>${esc(displayTitle(task))}</strong><small><span class="timeline-level-badge">${depth ? 'L5' : 'L4'}</span> ${depth ? '세부 연구' : '기술 연구'}${outside ? ' · 표시 기간 밖' : ''}${!scheduled ? ' · 기간 미정' : ''}</small><span class="timeline-row-owner ${task.owner?.trim()?'':'is-unassigned'}" title="담당: ${esc(task.owner?.trim()||'담당 미정')}">담당: ${esc(task.owner?.trim()||'담당 미정')}</span></button><button type="button" class="timeline-add-child" data-add-child="${esc(task.id)}" aria-label="${esc(task.title)}에 L5 세부 연구 추가" title="L5 세부 연구 추가">+</button></div>${parent ? `<small class="timeline-child-progress">세부 ${children.length}개 · ${progress.done}/${progress.total} 완료</small>` : ''}${overflow || ancestorOverflow ? `<small class="hierarchy-overflow-badge">${overflow ? '세부 기간 초과' : '상위 기간 밖'}</small>` : ''}</div><div class="timeline-lane" data-goal-id="${esc(goalId)}">${cells(goalId, task)}${barHTML(task)}</div></div>`;
    }
    function sorted(items) {
      return H?.ordered ? H.ordered(items,rangeOf) : items.slice().sort((a,b)=>(rangeOf(a).start||'9999').localeCompare(rangeOf(b).start||'9999')||a.title.localeCompare(b.title));
    }
    function groupRows(group) {
      if (!group.tasks.length) return rowHTML(null, group.id);
      const seen = new Set();
      function branch(task) {
        if (seen.has(task.id) || !visibleIds.has(task.id)) return '';
        seen.add(task.id);
        const row = rowHTML(task, group.id);
        const children = sorted(childrenOf(task.id).filter(child => visibleIds.has(child.id)));
        if (!showChildren || collapsedTasks.has(task.id)) {
          // Mark collapsed descendants so the malformed-data fallback cannot reveal them.
          H?.descendantsOf(allTasks, task.id).forEach(child => seen.add(child.id));
          return row;
        }
        return row + children.map(branch).join('');
      }
      const roots = sorted(group.tasks.filter(task => !task.parentId || !visibleIds.has(task.parentId)));
      let rows = roots.map(branch).join('');
      // Imported orphan/cyclic data remains inspectable instead of disappearing.
      sorted(group.tasks).forEach(task => { if (!seen.has(task.id)) rows += branch(task); });
      return rows;
    }
    function groupHeading(group) {
      const roots = group.tasks.filter(task => !task.parentId);
      const title = api.groupLabel ? api.groupLabel(group) : group.title;
      const label = `<span class="timeline-level-badge">L3</span><strong>${esc(title)}</strong>`;
      return `<div class="timeline-goal-heading" data-l3-group="${esc(group.id)}"><div class="timeline-l3-label">${group.l2Title ? `<span class="timeline-l2-eyebrow">L2 · ${esc(group.l2Title)}</span>` : ''}${api.reorderGoal && !api.readOnly && group.id ? `<button type="button" class="timeline-l3-drag" data-reorder-goal="${esc(group.id)}" aria-label="${esc(title)} L3 순서 끌어 바꾸기" title="이 L3 줄을 끌어 순서 변경 · 하위 L4/L5도 함께 이동 · 키보드 ↑ ↓"><span class="timeline-l3-grip" aria-hidden="true">⠿</span>${label}<span class="timeline-l3-drag-hint" aria-hidden="true">끌어서 순서 변경</span></button>` : `<div class="timeline-l3-title">${label}</div>`}</div><small>${roots.length}개 L4 · ${group.tasks.length - roots.length}개 L5</small></div>`;
    }
    const periodGroups = [];
    columns.forEach(column => {
      const last = periodGroups[periodGroups.length - 1];
      if (last && last.label === column.group) last.count++;
      else periodGroups.push({label: column.group, count: 1});
    });
    const rangeLabel=columns[0].start.replaceAll('-','.')+' — '+columns.at(-1).end.replaceAll('-','.');
    const navigation=api.stepPeriod?`<div class="timeline-period-navigation" role="group" aria-label="표시 기간 이동"><button type="button" data-step-period="-1" ${columns[0].start<=MIN_DATE?'disabled':''}>‹ 이전 1${{week:'주',month:'개월',year:'년'}[unit]}</button><span>${esc(rangeLabel)}</span><button type="button" data-step-period="1">다음 1${{week:'주',month:'개월',year:'년'}[unit]} ›</button></div>`:'';
    const legend=`<div class="timeline-color-legend" aria-label="연구 유형 색상 범례"><strong>색상 · 연구 유형</strong>${Object.entries(api.categories||{research:'연구·조사',experiment:'실험·검증',writing:'논문·문서',meeting:'협의·리뷰',milestone:'핵심 결과'}).map(([key,label])=>`<span><i style="background:${safeColor(colors[key])}" aria-hidden="true"></i>${esc(label)}</span>`).join('')}<small>진한 막대: 전체 기간 · 완료: 흐리게 · 보류: 점선</small></div>`;
    host.innerHTML = `<section class="research-timeline timeline-unit-${unit}" aria-label="${UNIT_LABELS[unit]} 연구 타임라인"><div class="hierarchy-view-controls" role="group" aria-label="세부 과업 표시"><button type="button" data-hierarchy-view="roots" aria-pressed="${!showChildren}">L4 기술만</button><button type="button" data-hierarchy-view="all" aria-pressed="${showChildren}">L5 세부 연구까지</button></div>${navigation}<div class="timeline-scroll" tabindex="0" aria-label="연구 타임라인 가로 스크롤"><div class="timeline-chart" style="--timeline-columns:${columns.length};--timeline-min-column:${unit === 'week' ? 96 : unit === 'month' ? 38 : 86}px"><div class="timeline-header"><div class="timeline-corner"><strong>L3 → L4 → L5</strong><small>기술과 세부 연구 일정</small></div><div class="timeline-axis"><div class="timeline-groups">${periodGroups.map(group => `<div class="timeline-period-group" style="grid-column:span ${group.count}">${esc(group.label)}</div>`).join('')}</div><div class="timeline-columns">${columns.map(column => `<div class="timeline-column"><strong>${esc(column.label)}</strong><small>${esc(column.detail || '')}</small></div>`).join('')}</div></div></div>${groups.map(group => `${groupHeading(group)}${groupRows(group)}`).join('')}${selectedL3?.size===0?'<p class="timeline-filter-empty">선택한 L3가 없습니다. L3 연구축 필터에서 표시할 항목을 선택해 주세요.</p>':!groups.length&&api.hideEmptyGroups?'<p class="timeline-filter-empty">조건에 맞는 연구가 없습니다. 필터를 변경해 주세요.</p>':''}</div></div>${navigation}${legend}<div class="timeline-help"><span>L3 제목 줄을 끌면 하위 L4/L5도 함께 이동 · 연구명으로 L4/L5 순서 변경</span><span>막대 이동 · 양 끝으로 기간 조정 · Enter로 상세 편집</span></div><div class="timeline-announcement sr-only" aria-live="polite"></div></section>`;

    let contextMenu=null,contextSource=null;
    function closeMenu(restoreFocus=false){contextMenu?.remove();contextMenu=null;if(restoreFocus)contextSource?.focus?.({preventScroll:true});}
    signal.addEventListener('abort',()=>closeMenu(),{once:true});
    function taskForTarget(target){
      if(!(target instanceof Element))return null;
      const row=target.closest('[data-task-row]'),bar=target.closest('[data-timeline-task]');
      const id=row?.dataset.taskRow||bar?.dataset.timelineTask;return id?taskMap.get(id):null;
    }
    function showTaskMenu(task,x,y,source){
      closeMenu();resetInteraction();contextSource=source;
      contextMenu=document.createElement('div');contextMenu.className='timeline-context-menu';contextMenu.setAttribute('role','menu');contextMenu.setAttribute('aria-label',task.title+' 연구 메뉴');contextMenu.tabIndex=-1;
      const disabled=api.readOnly?'disabled':'';
      contextMenu.innerHTML=`<p>${esc(task.title)}</p><button type="button" role="menuitem" data-context-hide ${disabled}>로드맵에서 숨기기</button><button type="button" role="menuitem" class="is-danger" data-context-delete ${disabled}>삭제</button>${api.readOnly?'<small>읽기 전용 계정입니다.</small>':''}`;
      document.body.append(contextMenu);
      const rect=contextMenu.getBoundingClientRect();contextMenu.style.left=Math.max(8,Math.min(x,window.innerWidth-rect.width-8))+'px';contextMenu.style.top=Math.max(8,Math.min(y,window.innerHeight-rect.height-8))+'px';
      contextMenu.querySelector('[data-context-hide]').onclick=()=>{closeMenu();api.hideTask?.(task.id);};
      contextMenu.querySelector('[data-context-delete]').onclick=()=>{closeMenu();api.deleteTask?.(task.id);};
      (contextMenu.querySelector('button:not(:disabled)')||contextMenu).focus({preventScroll:true});
    }
    host.addEventListener('contextmenu',event=>{const task=taskForTarget(event.target);if(!task)return;event.preventDefault();showTaskMenu(task,event.clientX,event.clientY,event.target.closest('button,[role=button]'));},{signal});
    host.addEventListener('keydown',event=>{
      if(event.key!=='ContextMenu'&&!(event.shiftKey&&event.key==='F10'))return;
      const task=taskForTarget(event.target);if(!task)return;event.preventDefault();const rect=event.target.getBoundingClientRect();showTaskMenu(task,rect.left+12,rect.bottom,event.target);
    },{signal});
    document.addEventListener('pointerdown',event=>{if(contextMenu&&!contextMenu.contains(event.target))closeMenu();},{capture:true,signal});
    document.addEventListener('keydown',event=>{
      if(!contextMenu)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMenu(true);return;}
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const buttons=[...contextMenu.querySelectorAll('button:not(:disabled)')];if(!buttons.length)return;
      event.preventDefault();const at=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(at+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length;buttons[next].focus();
    },{signal});
    window.addEventListener('resize',()=>closeMenu(),{signal});
    document.addEventListener('scroll',()=>closeMenu(),{capture:true,signal});

    function resetInteraction() {
      if (!interaction) return;
      if(['order','goal-order'].includes(interaction.kind)){
        cancelAnimationFrame(orderFrame);orderFrame=null;
        interaction.ghost?.remove();interaction.line?.remove();
        host.querySelectorAll('.is-order-source').forEach(row=>row.classList.remove('is-order-source'));
        document.body.classList.remove('is-reordering-research');
      }
      if (interaction.bar) {
        const geo = geometry(interaction.task.start, interaction.task.end);
        interaction.bar.style.left = geo.left + '%';
        interaction.bar.style.width = geo.width + '%';
        interaction.bar.classList.remove('is-dragging');
      }
      host.querySelectorAll('.timeline-cell.is-selected').forEach(cell => cell.classList.remove('is-selected'));
      interaction = null;interactionActive=false;
    }
    clearInteraction = resetInteraction;
    function visibleBlock(id){
      const ids=new Set([id,...(H?.descendantsOf(allTasks,id)||[]).map(t=>t.id)]);
      return Array.from(host.querySelectorAll('[data-task-row]')).filter(row=>ids.has(row.dataset.taskRow));
    }
    function goalBlock(id){
      const heading=[...host.querySelectorAll('[data-l3-group]')].find(row=>row.dataset.l3Group===id);if(!heading)return [];
      const rows=[heading];let next=heading.nextElementSibling;
      while(next&&!next.matches('[data-l3-group]')){if(next.matches('[data-task-row],.timeline-row'))rows.push(next);next=next.nextElementSibling;}
      return rows;
    }
    function paintGoalOrder(){
      const drag=interaction;if(!drag||drag.kind!=='goal-order'||!drag.moved)return;
      if(!drag.ghost){
        drag.ghost=document.createElement('div');drag.ghost.className='timeline-order-ghost';drag.ghost.textContent='L3 '+drag.goal.title+' — L4/L5 함께 이동';document.body.appendChild(drag.ghost);
        drag.line=document.createElement('div');drag.line.className='timeline-drop-indicator';document.body.appendChild(drag.line);
        goalBlock(drag.goal.id).forEach(row=>row.classList.add('is-order-source'));document.body.classList.add('is-reordering-research');
      }
      drag.ghost.style.left=Math.min(Math.max(8,drag.clientX+16),Math.max(8,window.innerWidth-300))+'px';drag.ghost.style.top=drag.clientY+14+'px';
      const blocks=groups.filter(g=>g.id&&g.id!==drag.goal.id).map(goal=>{const rows=goalBlock(goal.id);return rows.length?{goal,first:rows[0].getBoundingClientRect(),last:rows.at(-1).getBoundingClientRect()}:null;}).filter(Boolean);
      const own=goalBlock(drag.goal.id),rect=host.getBoundingClientRect();
      const top=Math.min(...blocks.map(b=>b.first.top),own[0]?.getBoundingClientRect().top??Infinity),bottom=Math.max(...blocks.map(b=>b.last.bottom),own.at(-1)?.getBoundingClientRect().bottom??-Infinity);
      drag.drop=null;drag.line.hidden=true;
      if(!blocks.length||drag.clientY<top-20||drag.clientY>bottom+20||drag.clientX<rect.left-20||drag.clientX>rect.right+20)return;
      let target=blocks.find(b=>drag.clientY<(b.first.top+b.first.bottom)/2),placement='before';
      if(!target){target=blocks.at(-1);placement='after';}
      drag.drop={id:target.goal.id,placement};
      const left=Math.max(0,rect.left),right=Math.min(window.innerWidth,rect.right);
      drag.line.style.cssText=`left:${left}px;width:${right-left}px;top:${placement==='before'?target.first.top:target.last.bottom}px`;drag.line.hidden=false;
    }
    function paintOrder(){
      if(interaction?.kind==='goal-order'){paintGoalOrder();return;}
      const drag=interaction;if(!drag||drag.kind!=='order'||!drag.moved)return;
      if(!drag.ghost){
        drag.ghost=document.createElement('div');drag.ghost.className='timeline-order-ghost';drag.ghost.textContent=drag.task.title;document.body.appendChild(drag.ghost);
        drag.line=document.createElement('div');drag.line.className='timeline-drop-indicator';document.body.appendChild(drag.line);
        visibleBlock(drag.task.id).forEach(row=>row.classList.add('is-order-source'));
        document.body.classList.add('is-reordering-research');
      }
      drag.ghost.style.left=Math.min(Math.max(8,drag.clientX+16),Math.max(8,window.innerWidth-300))+'px';drag.ghost.style.top=drag.clientY+14+'px';
      const peers=sorted(allTasks.filter(t=>t.id!==drag.task.id&&(t.parentId||'')===(drag.task.parentId||'')&&(drag.task.parentId||rootGoalId(t)===rootGoalId(drag.task))));
      const blocks=peers.map(task=>{const rows=visibleBlock(task.id);return rows.length?{task,first:rows[0].getBoundingClientRect(),last:rows.at(-1).getBoundingClientRect()}:null;}).filter(Boolean);
      const own=visibleBlock(drag.task.id),rect=host.getBoundingClientRect();
      const top=Math.min(...blocks.map(b=>b.first.top),own[0]?.getBoundingClientRect().top??Infinity),bottom=Math.max(...blocks.map(b=>b.last.bottom),own.at(-1)?.getBoundingClientRect().bottom??-Infinity);
      drag.drop=null;drag.line.hidden=true;
      if(!blocks.length||drag.clientY<top-20||drag.clientY>bottom+20||drag.clientX<rect.left-20||drag.clientX>rect.right+20)return;
      let target=blocks.find(b=>drag.clientY<(b.first.top+b.last.bottom)/2),placement='before';
      if(!target){target=blocks.at(-1);placement='after';}
      drag.drop={id:target.task.id,placement};
      const left=Math.max(0,rect.left),right=Math.min(window.innerWidth,rect.right);
      drag.line.style.cssText=`left:${left}px;width:${right-left}px;top:${placement==='before'?target.first.top:target.last.bottom}px`;
      drag.line.hidden=false;
    }
    function animateOrder(){
      if(!interaction||!['order','goal-order'].includes(interaction.kind)||!interaction.moved)return;
      const y=interaction.clientY,edge=65,delta=y<edge?-Math.ceil((edge-y)/5):y>window.innerHeight-edge?Math.ceil((y-window.innerHeight+edge)/5):0;
      if(delta){window.scrollBy(0,delta);paintOrder();}
      orderFrame=requestAnimationFrame(animateOrder);
    }
    function columnAt(lane, clientX) {
      const rect = lane.getBoundingClientRect();
      return Math.max(0, Math.min(columns.length - 1, Math.floor((clientX - rect.left) / (rect.width / columns.length))));
    }
    function paintSelection() {
      const a = Math.min(interaction.first, interaction.last), b = Math.max(interaction.first, interaction.last);
      interaction.lane.querySelectorAll('.timeline-cell').forEach((cell, index) => cell.classList.toggle('is-selected', index >= a && index <= b));
    }
    function proposedRange(task, delta, mode) {
      const covered = p.cover(task.start, task.end, unit);
      let start = floor(covered.start), end = ceil(covered.end);
      if (mode !== 'end') start = floor(p.step(start, delta, unit));
      if (mode !== 'start') end = ceil(p.step(floor(end), delta, unit));
      if (start < floor(MIN_DATE) || end < MIN_DATE || start > end) return null;
      start = start < MIN_DATE ? MIN_DATE : start;
      return {start, end};
    }
    function begin(event) {
      if (event.button !== 0 || interaction || event.isPrimary === false) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const goalHeading=target.closest('[data-l3-group]');
      if(goalHeading&&api.reorderGoal&&!api.readOnly&&goalHeading.dataset.l3Group&&host.contains(goalHeading)){
        const goal=goals.find(g=>g.id===goalHeading.dataset.l3Group);if(!goal)return;
        event.preventDefault();goalHeading.querySelector('[data-reorder-goal]')?.focus({preventScroll:true});
        interaction={kind:'goal-order',goal,pointerId:event.pointerId,x:event.clientX,y:event.clientY,clientX:event.clientX,clientY:event.clientY,moved:false,drop:null};interactionActive=true;return;
      }
      const handle=target.closest('[data-reorder-task]'),label=target.closest('[data-open-task]');
      if(api.reorderTask&&(handle||label)&&host.contains(handle||label)){
        const task=taskMap.get(handle?.dataset.reorderTask||label.dataset.openTask);if(!task)return;
        event.preventDefault();(handle||label).focus({preventScroll:true});
        interaction={kind:'order',task,pointerId:event.pointerId,x:event.clientX,y:event.clientY,clientX:event.clientX,clientY:event.clientY,moved:false,openOnClick:!!label,drop:null};interactionActive=true;return;
      }
      const bar = target.closest('[data-timeline-task]');
      if (bar && host.contains(bar)) {
        const source = taskMap.get(bar.dataset.timelineTask);
        if (!source) return;
        const task = {...source, ...rangeOf(source)};
        if (!hasRange(task)) return;
        event.preventDefault();
        bar.focus({preventScroll: true});
        interactionActive=true;interaction = {kind: 'bar', task, bar, lane: bar.closest('.timeline-lane'), mode: target.closest('[data-resize]')?.dataset.resize || 'move', x: event.clientX, pointerId: event.pointerId, delta: 0, moved: false, range: null};
        return;
      }
      const cell = target.closest('.timeline-cell');
      if (!cell || !host.contains(cell)) return;
      event.preventDefault();
      cell.focus({preventScroll: true});
      interactionActive=true;interaction = {kind: 'selection', lane: cell.closest('.timeline-lane'), first: +cell.dataset.column, last: +cell.dataset.column, goalId: cell.dataset.goalId || '', parentId: cell.dataset.parentId || '', scheduleTask: cell.dataset.scheduleTask || '', pointerId: event.pointerId};
      paintSelection();
    }
    function move(event) {
      if (!interaction || event.pointerId !== interaction.pointerId) return;
      if(['order','goal-order'].includes(interaction.kind)){
        interaction.clientX=event.clientX;interaction.clientY=event.clientY;
        interaction.moved ||= Math.hypot(event.clientX-interaction.x,event.clientY-interaction.y)>5;
        if(interaction.moved){paintOrder();if(orderFrame===null)orderFrame=requestAnimationFrame(animateOrder);}return;
      }
      if (interaction.kind === 'selection') {
        interaction.last = columnAt(interaction.lane, event.clientX);
        paintSelection();
        return;
      }
      const drag = interaction, distance = event.clientX - drag.x;
      drag.moved ||= Math.abs(distance) > 4;
      const width = drag.lane.getBoundingClientRect().width / columns.length;
      const delta = Math.round(distance / width);
      if (delta === drag.delta && drag.range) return;
      drag.delta = delta;
      drag.range = delta ? proposedRange(drag.task, delta, drag.mode) : null;
      drag.bar.classList.toggle('is-dragging', drag.moved);
      if (!drag.range) {
        const geo = geometry(drag.task.start, drag.task.end);
        drag.bar.style.left = geo.left + '%';
        drag.bar.style.width = geo.width + '%';
        return;
      }
      const geo = geometry(drag.range.start, drag.range.end);
      drag.bar.style.left = geo.left + '%';
      drag.bar.style.width = geo.width + '%';
    }
    function finish(event) {
      if (!interaction || event.pointerId !== interaction.pointerId) return;
      move(event);
      const completed = interaction;
      resetInteraction();
      if(completed.kind==='goal-order'){
        suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
        if(completed.moved&&completed.drop)api.reorderGoal(completed.goal.id,completed.drop.id,completed.drop.placement);
        return;
      }
      if(completed.kind==='order'){
        suppressClick=true;setTimeout(()=>{suppressClick=false;},0);
        if(!completed.moved&&completed.openOnClick)api.openTask(completed.task.id);
        else if(completed.moved&&completed.drop)api.reorderTask(completed.task.id,completed.drop.id,completed.drop.placement);
        return;
      }
      if (completed.kind === 'selection') {
        const first = columns[Math.min(completed.first, completed.last)], last = columns[Math.max(completed.first, completed.last)];
        openSelection(completed, first.start, last.end);
      } else if (!completed.moved) api.openTask(completed.task.id);
      else if (completed.delta && completed.range && (completed.range.start !== completed.task.start || completed.range.end !== completed.task.end)) {
        api.reschedule(completed.task.id, completed.range.start, completed.range.end, unit);
      } else if (completed.delta && !completed.range) api.toast?.('선택한 기간으로 옮길 수 없습니다. 연구 계획은 2026년 11월부터 만들 수 있습니다.');
    }
    function openSelection(selection, start, end) {
      const defaults = {start, end, goalId: selection.goalId || '', planUnit: unit};
      if (selection.scheduleTask) api.openTask(selection.scheduleTask, defaults);
      else api.openTask(null, {...defaults, parentId: selection.parentId || ''});
    }
    function addChild(id) {
      if (api.addChild) { api.addChild(id); return; }
      const parent = taskMap.get(id);
      if (!parent) return;
      const range = rangeOf(parent);
      api.openTask(null, {parentId: id, goalId: rootGoalId(parent), phaseId: parent.phaseId || '', owner: parent.owner || '', category: parent.category, planUnit: parent.planUnit || unit, ...(hasRange(range) ? {start: range.start, end: range.end} : {})});
    }
    host.addEventListener('pointerdown', begin, {signal});
    document.addEventListener('pointermove', move, {signal});
    document.addEventListener('pointerup', finish, {signal});
    document.addEventListener('pointercancel', event => {
      if (interaction && event.pointerId === interaction.pointerId) resetInteraction();
    }, {signal});
    window.addEventListener('blur', resetInteraction, {signal});
    host.addEventListener('click', event => {
      if(suppressClick){event.preventDefault();return;}
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if(target.closest('[data-reorder-task],[data-reorder-goal]'))return;
      const step=target.closest('[data-step-period]');
      if(step&&host.contains(step)){api.stepPeriod?.(Number(step.dataset.stepPeriod));return;}
      const view = target.closest('[data-hierarchy-view]');
      if (view && host.contains(view)) {
        showChildren = view.dataset.hierarchyView === 'all';
        render(host, api);
        host.querySelector(`[data-hierarchy-view="${showChildren ? 'all' : 'roots'}"]`)?.focus({preventScroll: true});
        return;
      }
      const toggle = target.closest('[data-toggle-task]');
      if (toggle && host.contains(toggle)) {
        const id = toggle.dataset.toggleTask;
        if (!showChildren) { showChildren = true; collapsedTasks.delete(id); }
        else if (collapsedTasks.has(id)) collapsedTasks.delete(id);
        else collapsedTasks.add(id);
        render(host, api);
        Array.from(host.querySelectorAll('[data-toggle-task]')).find(button => button.dataset.toggleTask === id)?.focus({preventScroll: true});
        return;
      }
      const add = target.closest('[data-add-child]');
      if (add && host.contains(add)) { addChild(add.dataset.addChild); return; }
      const label = event.target.closest('[data-open-task]');
      if (label && host.contains(label)) api.openTask(label.dataset.openTask);
      // Assistive technology can activate a button without pointer events.
      const bar = event.target.closest('[data-timeline-task]');
      if (bar && event.detail === 0 && host.contains(bar)) api.openTask(bar.dataset.timelineTask);
    }, {signal});
    host.addEventListener('keydown', event => {
      if (event.key === 'Escape' && interaction) { event.preventDefault(); resetInteraction(); return; }
      const goalHandle=event.target.closest('[data-reorder-goal]');
      if(goalHandle&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();api.moveGoal?.(goalHandle.dataset.reorderGoal,event.key==='ArrowUp'?-1:1);return;}
      const handle=event.target.closest('[data-reorder-task]');
      if(handle&&['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();api.moveTask?.(handle.dataset.reorderTask,event.key==='ArrowUp'?-1:1);return;}
      if (!['Enter', ' '].includes(event.key)) return;
      const bar = event.target.closest('[data-timeline-task]');
      if (bar) { event.preventDefault(); api.openTask(bar.dataset.timelineTask); return; }
      const cell = event.target.closest('.timeline-cell');
      if (!cell) return;
      event.preventDefault();
      const column = columns[+cell.dataset.column];
      openSelection({goalId: cell.dataset.goalId, parentId: cell.dataset.parentId, scheduleTask: cell.dataset.scheduleTask}, column.start, column.end);
    }, {signal});
  }

  window.ResearchTimeline = {render, destroy,isInteracting:()=>interactionActive};
})();
