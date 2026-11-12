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
    const start=month+'-01',end=P.monthEnd(start);
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
    host.innerHTML=`<section class="month-planning" aria-label="월간 연구 캘린더"><div class="month-planning-toolbar"><div><span class="eyebrow">MONTHLY RESEARCH</span><h2>연구 일정과 겹침</h2></div><div class="month-controls"><button type="button" class="icon-button" data-month-step="-1" aria-label="이전 월" ${month<='2026-11'?'disabled':''}>‹</button><label><span class="sr-only">캘린더 기준 월</span><input type="month" data-calendar-month value="${month}" min="2026-11" max="9998-12" aria-label="캘린더 기준 월"></label><button type="button" class="icon-button" data-month-step="1" aria-label="다음 월" ${month>='9998-12'?'disabled':''}>›</button></div></div><div class="month-calendar-filters"><label>담당자 <select data-calendar-owner aria-label="캘린더 담당자"><option value="">전체 담당자</option>${people.map(row=>`<option value="${esc(row.owner)}" ${row.owner===selectedOwner?'selected':''}>${esc(row.owner)}</option>`).join('')}</select></label><label class="calendar-visibility"><input type="checkbox" data-calendar-visible ${visibleOnly?'checked':''}> 로드맵에서 숨긴 연구 제외</label></div><p class="calendar-count-note">기간이 정해진 하위 연구가 있으면 상위 전체 기간은 집계에서 제외합니다. 겹침은 같은 날짜에 2개 이상 진행되는 연구를 뜻하며, 기간은 주말을 포함합니다.</p><div class="overlap-summary" aria-label="선택한 일정의 겹침 요약"><div><span>이 달의 연구</span><strong>${counts.count}<small>개</small></strong></div><div><span>최대 동시 진행</span><strong>${counts.peak}<small>개</small></strong></div><div><span>일정이 겹치는 날</span><strong>${counts.overlapDays}<small>일</small></strong></div></div><div class="month-calendar-scroll"><div class="month-calendar"><div class="calendar-weekdays">${['월','화','수','목','금','토','일'].map(day=>`<span>${day}</span>`).join('')}</div>${weeks.map(week=>{
      const weekEnd=P.addDays(week,6),a=week<start?start:week,b=weekEnd>end?end:weekEnd,{segments,lanes}=packWeek(tasks,a,b);
      return `<section class="calendar-week" aria-label="${week} 주간 연구"><div class="calendar-week-dates">${Array.from({length:7},(_,i)=>{const day=P.addDays(week,i),inside=day>=start&&day<=end,count=counts.days[day]||0;return `<button type="button" class="calendar-date ${inside?'':'is-outside'} ${count>1?'has-overlap':''}" data-calendar-day="${day}" ${inside?'':'disabled'} aria-label="${day}, 연구 ${count}개${count>1?', 일정 겹침':''}"><span>${Number(day.slice(8))}</span>${inside&&count?`<small>${count}개${count>1?' 겹침':''}</small>`:''}</button>`;}).join('')}</div><div class="calendar-week-events" style="--week-lanes:${Math.max(1,lanes)}">${segments.map(segment=>{const task=segment.task;return `<button type="button" class="calendar-research-bar ${task.parentId?'is-subtask':''} status-${esc(task.status||'planned')}" data-calendar-task="${esc(task.id)}" style="grid-column:${P.daysBetween(segment.start,week)+1} / span ${P.daysBetween(segment.end,segment.start)+1};grid-row:${segment.lane+1};--event-color:${colors[task.category]||'#3479e9'}" title="${esc(title(task))}" aria-label="${esc(title(task))}"><span><b class="calendar-level">${task.parentId?'↳ L5':'L4'}</b> ${segment.start>task.start?'‹ ':''}${esc(task.title)}${segment.end<task.end?' ›':''}</span><small>담당: ${esc(ownerNames(task).join(', '))}</small></button>`;}).join('')}</div></section>`;
    }).join('')}</div></div><div data-calendar-day-detail class="calendar-day-detail" hidden></div><section class="owner-overlap-section" aria-label="담당자별 일정 겹침"><div class="papers-heading"><div><h3>담당자별 겹침 현황</h3><p>담당자를 누르면 그 사람의 연구만 캘린더에 표시합니다. 공동 담당 연구는 각 담당자에 포함합니다.</p></div></div><div class="owner-table-scroll"><table class="owner-overlap-table"><thead><tr><th scope="col">담당자</th><th scope="col">연구 수</th><th scope="col">최대 동시 진행</th><th scope="col">겹치는 날짜</th></tr></thead><tbody>${people.map(row=>`<tr class="${row.owner===selectedOwner?'is-selected':''}"><th scope="row"><button type="button" data-select-owner="${esc(row.owner)}">${esc(row.owner)}</button></th><td>${row.count}개</td><td><span class="overlap-count ${row.peak>1?'is-busy':''}">${row.peak}개</span></td><td>${row.overlapDays}일</td></tr>`).join('')||'<tr><td colspan="4">이 달에 배치한 연구가 없습니다.</td></tr>'}</tbody></table></div></section></section>`;
    const open=id=>openTask(id);
    host.querySelectorAll('[data-calendar-task]').forEach(button=>button.onclick=()=>open(button.dataset.calendarTask));
    const showDay=day=>{
      selectedDay=day;const detail=host.querySelector('[data-calendar-day-detail]'),list=tasks.filter(task=>task.start<=day&&task.end>=day);
      detail.hidden=false;detail.innerHTML=`<h3>${esc(day)} <small>동시 진행 ${list.length}개</small></h3>${list.map(task=>`<button type="button" class="calendar-day-task" data-day-task="${esc(task.id)}"><span>${task.parentId?'↳ L5':'L4'} ${esc(task.title)}</span><strong>담당: ${esc(ownerNames(task).join(', '))}</strong></button>`).join('')||'<p class="field-help">이 날짜에는 배치된 연구가 없습니다.</p>'}`;
      detail.querySelectorAll('[data-day-task]').forEach(button=>button.onclick=()=>open(button.dataset.dayTask));
      host.querySelectorAll('[data-calendar-day]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.calendarDay===day)));
    };
    host.querySelectorAll('[data-calendar-day]').forEach(button=>button.onclick=()=>showDay(button.dataset.calendarDay));
    host.querySelector('[data-calendar-owner]').onchange=event=>{selectedOwner=event.target.value;render(host,api);};
    host.querySelectorAll('[data-select-owner]').forEach(button=>button.onclick=()=>{selectedOwner=selectedOwner===button.dataset.selectOwner?'':button.dataset.selectOwner;render(host,api);});
    host.querySelector('[data-calendar-visible]').onchange=event=>{visibleOnly=event.target.checked;render(host,api);};
    host.querySelector('[data-calendar-month]').onchange=event=>{const value=event.target.value;if(/^\d{4}-\d{2}$/.test(value)&&value>='2026-11'&&value<='9998-12')onMonthChange(value);};
    host.querySelectorAll('[data-month-step]').forEach(button=>button.onclick=()=>onMonthChange(P.step(start,Number(button.dataset.monthStep),'month').slice(0,7)));
    if(selectedDay>=start&&selectedDay<=end)showDay(selectedDay);
  }
  window.ResearchCalendar={render,workItems,summary,ownerSummary,packWeek,ownersOf};
})();
