/* Month layout and workload counts use inclusive calendar days, not effort estimates. */
(() => {
  'use strict';
  const P=window.ResearchPeriods;
  const ownersOf=task=>[...new Set(String(task.owner||'').split(/[,，;；/|\n]+/).map(name=>name.trim()).filter(Boolean))];
  const ownerNames=task=>ownersOf(task).length?ownersOf(task):['담당 미정'];
  const scheduled=task=>P.validDate(task.start)&&P.validDate(task.end)&&task.start<=task.end;
  function workItems(tasks) {
    const scheduledTasks=tasks.filter(scheduled),ids=new Set(scheduledTasks.map(task=>task.id)),hasScheduledChild=new Set();
    // Omit a summary only when an actual scheduled descendant is in this view.
    const all=new Map(tasks.map(task=>[task.id,task]));
    for(const task of scheduledTasks){const seen=new Set([task.id]);let parent=task.parentId;while(parent&&!seen.has(parent)){seen.add(parent);if(ids.has(parent))hasScheduledChild.add(parent);parent=all.get(parent)?.parentId;}}
    return scheduledTasks.filter(task=>!hasScheduledChild.has(task.id));
  }
  function summary(tasks,start,end) {
    const days={};let peak=0,overlapDays=0;
    const selected=tasks.filter(task=>scheduled(task)&&task.start<=end&&task.end>=start);
    for(let day=start;day<=end;day=P.addDays(day,1)){
      const count=selected.filter(task=>task.start<=day&&task.end>=day).length;
      days[day]=count;peak=Math.max(peak,count);if(count>1)overlapDays++;
    }
    return {count:selected.length,peak,overlapDays,days};
  }
  function ownerSummary(tasks,start,end) {
    const names=[...new Set(tasks.filter(task=>scheduled(task)&&task.start<=end&&task.end>=start).flatMap(ownerNames))];
    return names.map(owner=>({owner,...summary(tasks.filter(task=>ownerNames(task).includes(owner)),start,end)})).sort((a,b)=>b.peak-a.peak||b.overlapDays-a.overlapDays||a.owner.localeCompare(b.owner,'ko'));
  }
  function packWeek(tasks,start,end) {
    const segments=tasks.filter(task=>scheduled(task)&&task.start<=end&&task.end>=start).map(task=>({task,start:task.start<start?start:task.start,end:task.end>end?end:task.end})).sort((a,b)=>a.start.localeCompare(b.start)||b.end.localeCompare(a.end)||a.task.id.localeCompare(b.task.id));
    const lanes=[];
    for(const segment of segments){let lane=lanes.findIndex(last=>last<segment.start);if(lane<0)lane=lanes.length;lanes[lane]=segment.end;segment.lane=lane;}
    return {segments,lanes:lanes.length};
  }
  let selectedOwner='',visibleOnly=true,selectedDay='';
  function render(host,api) {
    const {escape:esc,month,state,hierarchy:H,colors,openTask,onMonthChange}=api;
    const start=month+'-01',end=P.monthEnd(start),today=P.iso(new Date());
    let items=api.tasks.filter(task=>!visibleOnly||H.isRoadmapVisible(state.tasks,task.id));
    const actual=workItems(items);
    // Test for descendants using all visible dates, then restrict to the displayed month.
    const monthTasks=actual.filter(task=>task.start<=end&&task.end>=start);
    const people=ownerSummary(monthTasks,start,end);
    if(selectedOwner&&!people.some(row=>row.owner===selectedOwner))selectedOwner='';
    const tasks=selectedOwner?monthTasks.filter(task=>ownerNames(task).includes(selectedOwner)):monthTasks;
    const counts=summary(tasks,start,end);
    const first=P.startOfWeek(start),last=P.endOfWeek(end),weeks=[];
    for(let week=first;week<=last;week=P.addDays(week,7))weeks.push(week);
    const title=task=>`${task.parentId?'L5 하위 연구':'L4 기술'} / ${task.title} / 담당: ${ownerNames(task).join(', ')} / ${task.start} — ${task.end}`;
    host.innerHTML=`<section class="month-planning" aria-label="월간 연구 캘린더"><div class="month-planning-toolbar"><div><h2>월간 연구 일정</h2></div><div class="month-controls"><button type="button" class="icon-button" data-month-step="-1" aria-label="이전 월" ${month<='2026-11'?'disabled':''}>‹</button><label><span class="sr-only">캘린더 기준 월</span><input type="month" data-calendar-month value="${month}" min="2026-11" max="9998-12" aria-label="캘린더 기준 월"></label><button type="button" class="icon-button" data-month-step="1" aria-label="다음 월" ${month>='9998-12'?'disabled':''}>›</button></div></div><div class="month-calendar-filters"><label>담당자 <select data-calendar-owner aria-label="캘린더 담당자"><option value="">전체 담당자</option>${people.map(row=>`<option value="${esc(row.owner)}" ${row.owner===selectedOwner?'selected':''}>${esc(row.owner)}</option>`).join('')}</select></label><label class="calendar-visibility"><input type="checkbox" data-calendar-visible ${visibleOnly?'checked':''}> 로드맵에서 숨긴 연구 제외</label></div><p class="calendar-count-note">기간이 정해진 하위 연구가 있으면 상위 전체 기간은 집계에서 제외합니다.</p><div class="overlap-summary" aria-label="선택한 일정의 겹침 요약"><div><span>이 달의 연구</span><strong>${counts.count}<small>개</small></strong></div><div><span>최대 동시 진행</span><strong>${counts.peak}<small>개</small></strong></div><div><span>일정이 겹치는 날</span><strong>${counts.overlapDays}<small>일</small></strong></div></div><div class="month-calendar-scroll"><div class="month-calendar"><div class="calendar-weekdays">${['월','화','수','목','금','토','일'].map(day=>`<span>${day}</span>`).join('')}</div>${weeks.map(week=>{
      const weekEnd=P.addDays(week,6),a=week<start?start:week,b=weekEnd>end?end:weekEnd,{segments,lanes}=packWeek(tasks,a,b);
      return `<section class="calendar-week${P.startOfWeek(today)===week?' is-current-week':''}" aria-label="${week} 주간 연구"><div class="calendar-week-dates">${Array.from({length:7},(_,i)=>{const day=P.addDays(week,i),inside=day>=start&&day<=end;return `<button type="button" class="calendar-date ${inside?'':'is-outside'}${day===today?' is-today':''}" ${day===today?'aria-current="date"':''} data-calendar-day="${day}" ${inside?'':'disabled'} aria-label="${day} 연구 일정 보기"><span>${Number(day.slice(8))}</span></button>`;}).join('')}</div><div class="calendar-week-events" style="--week-lanes:${Math.max(1,lanes)}">${segments.map(segment=>{const task=segment.task;return `<button type="button" class="calendar-research-bar ${task.parentId?'is-subtask':''} status-${esc(task.status||'planned')}" data-calendar-task="${esc(task.id)}" style="grid-column:${P.daysBetween(segment.start,week)+1} / span ${P.daysBetween(segment.end,segment.start)+1};grid-row:${segment.lane+1};--event-color:${colors[task.category]||'#3479e9'}" title="${esc(title(task))}" aria-label="${esc(title(task))}"><span><b class="calendar-level">${task.parentId?'↳ L5':'L4'}</b> ${segment.start>task.start?'‹ ':''}${esc(task.title)}${segment.end<task.end?' ›':''}</span><small>담당: ${esc(ownerNames(task).join(', '))}</small></button>`;}).join('')}</div></section>`;
    }).join('')}</div></div><div data-calendar-resources></div><div data-calendar-day-detail class="calendar-day-detail" hidden></div></section>`;
    renderResources(host.querySelector('[data-calendar-resources]'),{tasks:state.tasks,start,end,escape:esc,owners:selectedOwner?[selectedOwner]:null});
    const open=id=>openTask(id);
    host.querySelectorAll('[data-calendar-task]').forEach(button=>button.onclick=()=>open(button.dataset.calendarTask));
    const showDay=day=>{
      selectedDay=day;const detail=host.querySelector('[data-calendar-day-detail]'),list=tasks.filter(task=>task.start<=day&&task.end>=day);
      detail.hidden=false;detail.innerHTML=`<h3>${esc(day)} 연구 일정</h3>${list.map(task=>`<button type="button" class="calendar-day-task" data-day-task="${esc(task.id)}"><span>${task.parentId?'↳ L5':'L4'} ${esc(task.title)}</span><strong>담당: ${esc(ownerNames(task).join(', '))}</strong></button>`).join('')||'<p class="field-help">이 날짜에는 배치된 연구가 없습니다.</p>'}`;
      detail.querySelectorAll('[data-day-task]').forEach(button=>button.onclick=()=>open(button.dataset.dayTask));
      host.querySelectorAll('[data-calendar-day]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.calendarDay===day)));
    };
    host.querySelectorAll('[data-calendar-day]').forEach(button=>button.onclick=()=>showDay(button.dataset.calendarDay));
    host.querySelector('[data-calendar-owner]').onchange=event=>{selectedOwner=event.target.value;render(host,api);};
    host.querySelector('[data-calendar-visible]').onchange=event=>{visibleOnly=event.target.checked;render(host,api);};
    host.querySelector('[data-calendar-month]').onchange=event=>{const value=event.target.value;if(/^\d{4}-\d{2}$/.test(value)&&value>='2026-11'&&value<='9998-12')onMonthChange(value);};
    host.querySelectorAll('[data-month-step]').forEach(button=>button.onclick=()=>onMonthChange(P.step(start,Number(button.dataset.monthStep),'month').slice(0,7)));
    if(selectedDay>=start&&selectedDay<=end)showDay(selectedDay);
  }
  // Allocations are explicit per person. An absent entry is unknown, never 0%.
  function normalizeAllocations(owner,values) {
    if(values===undefined)return [];
    if(!Array.isArray(values))throw Error('담당자 리소스 형식을 확인해 주세요.');
    const names=new Set(ownersOf({owner})),seen=new Set();
    return values.map(row=>{
      if(!row||typeof row.owner!=='string'||typeof row.percent!=='number'||!Number.isFinite(row.percent)||row.percent<0||row.percent>100||seen.has(row.owner))throw Error('담당자 리소스는 중복 없이 0~100%로 입력해 주세요.');
      seen.add(row.owner);return {owner:row.owner,percent:Math.round(row.percent*10)/10};
    }).filter(row=>names.has(row.owner));
  }
  function allocationsOf(task) {
    const values=normalizeAllocations(task.owner,task.ownerAllocations);
    return ownersOf(task).map(owner=>({owner,percent:values.find(row=>row.owner===owner)?.percent??null}));
  }
  const round=value=>Math.round(value*10)/10;
  function businessDays(start,end) {
    if(start>end)return 0;
    const count=P.daysBetween(end,start)+1,weeks=Math.floor(count/7),first=P.date(start).getDay();
    let days=weeks*5;for(let i=0;i<count%7;i++){const weekday=(first+i)%7;if(weekday!==0&&weekday!==6)days++;}
    return days;
  }
  function monthEquivalent(start,end) {
    let mm=0;
    for(let month=P.monthStart(start);month<=end;month=P.step(month,1,'month')){
      const last=P.monthEnd(month),a=start>month?start:month,b=end<last?end:last;
      mm+=businessDays(a,b)/businessDays(month,last);
    }
    return mm;
  }
  function resourceSummary(tasks,start,end) {
    if(!P.validDate(start)||!P.validDate(end)||start>end)return [];
    const H=window.ResearchHierarchy;
    const groups=new Map();
    for(const task of tasks){
      if(task.status==='paused')continue;
      const range=H?H.effectiveRange(tasks,task.id):task;
      if(!scheduled(range)||range.start>end||range.end<start)continue;
      for(const row of allocationsOf(task)){
        if(!groups.has(row.owner))groups.set(row.owner,[]);
        groups.get(row.owner).push({...row,id:task.id,start:range.start<start?start:range.start,end:range.end>end?end:range.end,ancestors:new Set(H?H.ancestorsOf(tasks,task.id).map(t=>t.id):[])});
      }
    }
    return [...groups].map(([owner,rows])=>{
      const points=[...new Set(rows.flatMap(row=>[row.start,P.addDays(row.end,1)]))].sort();
      let peak=0,mm=0,overDays=0,firstOver='',estimatedDays=0;
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=P.addDays(points[i+1],-1),active=rows.filter(row=>row.start<=a&&row.end>=a&&row.percent!==null);
        // A child's explicit allocation replaces its ancestor for the same owner,
        // only while that child is scheduled. Siblings remain additive.
        const actual=active.filter(row=>!active.some(other=>other.ancestors.has(row.id)));
        const percent=round(actual.reduce((sum,row)=>sum+row.percent,0));
        peak=Math.max(peak,percent);mm+=monthEquivalent(a,b)*percent/100;
        const days=businessDays(a,b);if(actual.length)estimatedDays+=days;
        if(percent>100){overDays+=days;if(!firstOver)firstOver=a;}
      }
      return {owner,peak,mm:Math.round(mm*100)/100,overDays,firstOver,estimatedDays,missing:rows.filter(row=>row.percent===null).length,assigned:rows.filter(row=>row.percent!==null).length};
    }).sort((a,b)=>b.peak-a.peak||a.owner.localeCompare(b.owner,'ko'));
  }
  function allocationHTML(task,esc) {
    const rows=allocationsOf(task);
    if(!rows.length)return '<span class="timeline-row-owner is-unassigned">담당 미정</span>';
    return `<span class="task-allocation-list timeline-row-owner">${rows.map(row=>`<span class="task-allocation" style="--allocation:${row.percent??0}%"><span class="task-allocation-name">${esc(row.owner)}</span><span class="task-allocation-track" aria-hidden="true"><i></i></span><span class="task-allocation-percent">${row.percent===null?'미입력':row.percent+'%'}</span></span>`).join('')}</span>`;
  }
  function renderResources(host,{tasks,start,end,escape:esc,owners=null}) {
    const rows=resourceSummary(tasks,start,end).filter(row=>owners===null||owners.includes(row.owner));
    host.innerHTML=`<section class="resource-summary" aria-label="담당자별 리소스와 MM"><div class="resource-summary-heading"><div><h3>담당자 리소스</h3><p>${esc(start)} ~ ${esc(end)} / 전체 연구 기준</p></div><span>기간 내 최대 동시 배정</span></div><div class="resource-people">${rows.map(row=>`<div class="resource-person${row.peak>100?' is-over':''}" data-resource-owner="${esc(row.owner)}"><div class="resource-person-heading"><strong>${esc(row.owner)}</strong><span class="resource-percent">${row.assigned?row.peak+'%':'미입력'}</span></div><div class="resource-meter" role="meter" aria-label="${esc(row.owner)} 최대 동시 배정${row.peak>100?', '+round(row.peak-100)+'% 초과':''}" aria-valuemin="0" aria-valuemax="${Math.max(100,row.peak)}" aria-valuenow="${row.peak}" aria-valuetext="${row.peak}%${row.missing?', 미입력 과업 있음':''}" style="--allocation:${Math.min(100,row.peak)}%"><i></i><span></span></div><div class="resource-person-detail"><span>${row.assigned?row.mm.toFixed(2)+' MM':'MM 미산정'}</span>${row.peak>100?`<strong>! ${round(row.peak-100)}% 초과</strong>`:'<span>기준 100%</span>'}</div>${row.firstOver?`<p class="resource-over-date">${esc(row.firstOver)}부터 초과${row.overDays?' / 평일 '+row.overDays+'일':''}</p>`:''}${row.missing?`<p class="resource-missing">리소스 미입력 ${row.missing}개</p>`:''}</div>`).join('')||'<p class="field-help">기간이 정해진 연구에 담당자를 입력하면 리소스가 표시됩니다.</p>'}</div><details class="resource-method"><summary>MM 계산 기준</summary><p>월별 평일 수를 기준으로 100% 배정한 한 달을 1 MM으로 계산합니다. 주말을 제외하며 공휴일과 휴가는 반영하지 않습니다. 하위 연구에 같은 담당자의 리소스를 입력한 기간은 하위 값으로 계산하고, 나머지 기간은 상위 값을 사용합니다. 보류 연구는 제외하며 완료 연구는 배정 기록으로 포함합니다. 화면 필터나 숨김과 관계없이 전체 연구를 합산합니다. 빈칸은 계산에서 제외하므로 미입력 과업이 있으면 합계가 실제보다 작을 수 있습니다.</p></details></section>`;
  }

  window.ResearchCalendar={render,workItems,summary,ownerSummary,packWeek,ownersOf,normalizeAllocations,allocationsOf,businessDays,resourceSummary,allocationHTML,renderResources};
})();

