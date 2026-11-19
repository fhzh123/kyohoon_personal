(() => {
  'use strict';
  // 담당자 리소스: how much of each person the L5 plan assigns, month by month or week by week.
  //
  // `plan()` is a pure function on purpose. Its periods use the same keys as the 팀 리소스
  // dashboard ("YYYY-MM" for months, the Monday "YYYY-MM-DD" for weeks) and the same person
  // names, so the planned allocation can later be set beside the recorded Notion hours without
  // reshaping either side.
  const P=window.ResearchPeriods, C=window.ResearchCalendar, H=window.ResearchHierarchy;
  const scheduled=task=>P.validDate(task.start)&&P.validDate(task.end)&&task.start<=task.end;
  const weekday=day=>{const d=P.date(day).getDay();return d!==0&&d!==6;};
  const round1=value=>Math.round(value*10)/10;
  const monthDaysCache=new Map();
  function monthBusinessDays(month){
    if(!monthDaysCache.has(month))monthDaysCache.set(month,C.businessDays(month+'-01',P.monthEnd(month+'-01')));
    return monthDaysCache.get(month);
  }
  function businessDaysIn(start,end){const days=[];for(let d=start;d<=end;d=P.addDays(d,1))if(weekday(d))days.push(d);return days;}
  function periodsOf(start,end,unit){
    const list=[];
    if(unit==='week'){
      for(let monday=P.startOfWeek(start);monday<=end;monday=P.addDays(monday,7)){
        const friday=P.addDays(monday,4),thursday=P.addDays(monday,3);
        if(friday<start)continue; // no weekday of this week falls inside the range
        list.push({key:monday,start:monday,end:P.addDays(monday,6),label:`${Number(thursday.slice(5,7))}월 ${Math.ceil(Number(thursday.slice(8))/7)}주`,title:`${Number(thursday.slice(0,4))}년 ${Number(thursday.slice(5,7))}월 ${Math.ceil(Number(thursday.slice(8))/7)}주차 (${Number(monday.slice(5,7))}.${Number(monday.slice(8))}–${Number(friday.slice(5,7))}.${Number(friday.slice(8))})`});
      }
    } else {
      for(let month=P.monthStart(start);month<=end;month=P.step(month,1,'month'))
        list.push({key:month.slice(0,7),start:month,end:P.monthEnd(month),label:Number(month.slice(5,7))+'월',title:`${Number(month.slice(0,4))}년 ${Number(month.slice(5,7))}월`});
    }
    return list;
  }
  // The span the L5 plan covers, in whole months.
  function planRange(tasks){
    const rows=tasks.filter(t=>t.parentId&&t.status!=='paused'&&scheduled(t)&&C.allocationsOf(t).length);
    if(!rows.length)return null;
    const start=rows.reduce((a,t)=>t.start<a?t.start:a,rows[0].start),end=rows.reduce((b,t)=>t.end>b?t.end:b,rows[0].end);
    return {start:P.monthStart(start<P.MIN_DATE?P.MIN_DATE:start),end:P.monthEnd(end)};
  }
  // Same rules as the roadmap's MM summary: L5 only, paused excluded, blank allocation is unknown.
  function plan(tasks,{start,end,unit='month'}){
    const periods=periodsOf(start,end,unit),people=new Map();
    const person=name=>{if(!people.has(name))people.set(name,{owner:name,days:new Map(),tasks:new Map(),missing:new Set()});return people.get(name);};
    for(const task of tasks){
      if(!task.parentId||task.status==='paused'||!scheduled(task)||task.end<start||task.start>end)continue;
      for(const row of C.allocationsOf(task)){
        const entry=person(row.owner);
        if(row.percent===null){entry.missing.add(task.id);continue;}
        entry.tasks.set(task.id,task);
        for(const day of businessDaysIn(task.start<start?start:task.start,task.end>end?end:task.end)){
          if(!entry.days.has(day))entry.days.set(day,new Map());
          entry.days.get(day).set(task.id,(entry.days.get(day).get(task.id)||0)+row.percent);
        }
      }
    }
    const result=[...people.values()].map(entry=>{
      const rows=periods.map(period=>{
        const days=businessDaysIn(period.start<start?start:period.start,period.end>end?end:period.end);
        let sum=0,peak=0,mm=0,overDays=0;const byTask=new Map();
        for(const day of days){
          const items=entry.days.get(day);if(!items)continue;
          let total=0;for(const [id,percent] of items){total+=percent;byTask.set(id,(byTask.get(id)||0)+percent);}
          sum+=total;peak=Math.max(peak,total);mm+=total/100/monthBusinessDays(day.slice(0,7));if(total>100.0001)overDays++;
        }
        return {...period,businessDays:days.length,average:days.length?round1(sum/days.length):0,peak:round1(peak),mm:Math.round(mm*100)/100,overDays,
          tasks:[...byTask].map(([id,total])=>({id,average:round1(total/days.length)})).sort((a,b)=>b.average-a.average)};
      });
      return {owner:entry.owner,periods:rows,mm:Math.round(rows.reduce((s,r)=>s+r.mm,0)*100)/100,peak:Math.max(0,...rows.map(r=>r.peak)),
        overDays:rows.reduce((s,r)=>s+r.overDays,0),missing:[...entry.missing],taskIds:[...entry.tasks.keys()]};
    });
    return {start,end,unit,periods,people:result};
  }

  const COLORS=['#4f7fd9','#d08a3c','#3e9f8f','#9a6fd0','#c46a6a','#5b9cc4','#8a9a4c','#c9a24a','#6f86a6','#b47a9a'];
  let unit='month',selected=null;
  function orderOwners(names,order=[]){
    const rank=new Map(order.map((name,i)=>[name,i]));
    return [...names].sort((a,b)=>(rank.has(a)?rank.get(a):1e3)-(rank.has(b)?rank.get(b):1e3)||a.localeCompare(b,'ko'));
  }
  const cellTone=value=>value>100?'is-over':value>=80?'is-high':value>0?'is-some':'is-none';

  function chart(person,periods,rootOf,rootColor,esc,space){
    // Drawn at real pixel size so labels stay legible; a narrow screen scrolls instead of shrinking.
    const W=Math.max(Math.round(space),periods.length*(unit==='week'?40:64)+52),Hh=260,L=40,R=12,T=14,B=34,pw=W-L-R,ph=Hh-T-B,max=Math.max(100,...person.periods.map(p=>p.average))*1.08;
    const slot=pw/periods.length,bar=Math.min(46,slot*0.62),y=v=>T+ph-(v/max)*ph;
    let svg='';
    for(const tick of [0,50,100,max>150?150:null].filter(v=>v!==null))svg+=`<line class="rp-grid${tick===100?' is-full':''}" x1="${L}" x2="${W-R}" y1="${y(tick)}" y2="${y(tick)}"/><text class="rp-tick" x="${L-8}" y="${y(tick)+4}" text-anchor="end">${tick}%</text>`;
    person.periods.forEach((period,i)=>{
      const x=L+slot*i+(slot-bar)/2;let acc=0;
      const groups=new Map();for(const t of period.tasks){const root=rootOf(t.id);groups.set(root.id,{root,value:(groups.get(root.id)?.value||0)+t.average});}
      for(const {root,value} of [...groups.values()].sort((a,b)=>a.root.title.localeCompare(b.root.title,'ko'))){
        const top=y(acc+value),h=y(acc)-top;acc+=value;
        svg+=`<rect class="rp-seg" x="${x}" y="${top}" width="${bar}" height="${Math.max(0,h-0.5)}" rx="2" fill="${rootColor(root.id)}"><title>${esc(period.title)} / ${esc(root.title)} ${round1(value)}%</title></rect>`;
      }
      svg+=`<text class="rp-value${period.average>100?' is-over':''}" x="${x+bar/2}" y="${y(period.average)-6}" text-anchor="middle">${period.average?period.average+'%':''}</text>`;
      if(periods.length<=14||i%2===0)svg+=`<text class="rp-tick" x="${x+bar/2}" y="${Hh-12}" text-anchor="middle">${esc(period.label)}</text>`;
    });
    return `<svg class="rp-chart" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${esc(person.owner)}의 ${unit==='week'?'주별':'월별'} 평균 배정">${svg}</svg>`;
  }

  let last=null,resizeTimer=0;
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(last&&last.host.isConnected&&last.host.querySelector('.rp'))render(last.host,last.options);},150);});
  function render(host,options){
    last={host,options};const {state,escape:esc,openTask}=options;
    const tasks=state.tasks,range=planRange(tasks);
    if(!range){host.innerHTML='<div class="empty-state">L5 세부 연구에 담당자와 리소스를 입력하면 담당자별 계획이 표시됩니다.</div>';return;}
    const data=plan(tasks,{...range,unit});
    const owners=orderOwners(data.people.map(p=>p.owner),state.settings?.resourceOwnerOrder);
    if(!owners.includes(selected))selected=owners[0];
    const person=data.people.find(p=>p.owner===selected);
    const byId=new Map(tasks.map(t=>[t.id,t]));
    const rootOf=id=>H.rootOf(tasks,id)||byId.get(id);
    const roots=[...new Set(data.people.flatMap(p=>p.taskIds.map(id=>rootOf(id).id)))].sort();
    const rootColor=id=>COLORS[Math.max(0,roots.indexOf(id))%COLORS.length];
    // Chart width: the person card's inner width (card padding 24px or 16px on phones, plus borders).
    const space=Math.max(320,(host.clientWidth||960)-(window.matchMedia?.('(max-width: 767px)').matches?34:50));
    const current=P.iso(new Date()),isNow=p=>p.start<=current&&current<=p.end;
    const matrix=`<div class="rp-matrix-wrap"><table class="rp-matrix"><thead><tr><th scope="col">담당자</th>${data.periods.map(p=>`<th scope="col" class="${isNow(p)?'is-now':''}" title="${esc(p.title)}">${esc(p.label)}</th>`).join('')}<th scope="col">합계</th></tr></thead><tbody>${owners.map(name=>{
      const row=data.people.find(p=>p.owner===name);
      return `<tr class="${name===selected?'is-selected':''}"><th scope="row"><button type="button" data-resource-person="${esc(name)}" aria-pressed="${name===selected}">${esc(name)}</button></th>${row.periods.map(p=>`<td class="${cellTone(p.average)}${isNow(p)?' is-now':''}" title="${esc(name)} / ${esc(p.title)}: 평균 ${p.average}% / 최대 ${p.peak}% / ${p.mm.toFixed(2)} MM"><span>${p.average?p.average+'%':'–'}</span></td>`).join('')}<td class="rp-total">${row.mm.toFixed(2)}<small> MM</small></td></tr>`;
    }).join('')}</tbody></table></div>`;
    const active=person.periods.filter(p=>p.average>0);
    const avg=active.length?round1(active.reduce((s,p)=>s+p.average,0)/active.length):0;
    const over=person.periods.filter(p=>p.peak>100);
    const legend=[...new Set(person.taskIds.map(id=>rootOf(id).id))].map(id=>`<span><i style="background:${rootColor(id)}"></i>${esc(byId.get(id)?.title||'')}</span>`).join('');
    const taskRows=person.taskIds.map(id=>byId.get(id)).sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title,'ko')).map(task=>{
      const share=C.allocationsOf(task).find(r=>r.owner===selected)?.percent;
      return `<tr><td><button type="button" class="rp-task" data-resource-task="${esc(task.id)}"><i style="background:${rootColor(rootOf(task.id).id)}"></i><span><b>${esc(task.title)}</b><small>${esc(rootOf(task.id).title)}</small></span></button></td><td class="num">${esc(task.start.slice(5).replace('-','.'))}–${esc(task.end.slice(5).replace('-','.'))}</td><td class="num">${share}%</td></tr>`;
    }).join('');
    host.innerHTML=`<section class="rp" aria-label="담당자 리소스">
      <div class="rp-toolbar"><div class="rp-unit" role="group" aria-label="집계 단위"><button type="button" data-resource-unit="month" aria-pressed="${unit==='month'}">월별</button><button type="button" data-resource-unit="week" aria-pressed="${unit==='week'}">주별</button></div><p>${esc(range.start.slice(0,7).replace('-','.'))} ~ ${esc(range.end.slice(0,7).replace('-','.'))} / L5 계획 기준 / 평일 평균 배정</p></div>
      <div class="rp-block"><div class="rp-head"><h2>팀원 한눈에</h2><span>칸은 그 ${unit==='week'?'주':'달'} 평일의 평균 배정입니다. 100%를 넘으면 붉게 표시합니다.</span></div>${matrix}</div>
      <div class="rp-block rp-person"><div class="rp-head"><h2>${esc(selected)}</h2><span>이름을 누르면 바꿀 수 있습니다.</span></div>
        <div class="rp-stats"><div><span>계획된 MM</span><b>${person.mm.toFixed(2)}</b><small>${esc(range.start.slice(0,7).replace('-','.'))} ~ ${esc(range.end.slice(0,7).replace('-','.'))}</small></div><div><span>평균 배정</span><b>${avg}<small>%</small></b><small>배정이 있는 ${unit==='week'?'주':'달'} 기준</small></div><div><span>최대 동시 배정</span><b class="${person.peak>100?'is-over':''}">${person.peak}<small>%</small></b><small>${over.length?`${over.map(p=>p.label).slice(0,3).join(', ')}${over.length>3?' 외':''} 100% 초과`:'100% 이내'}</small></div><div><span>배정된 L5</span><b>${person.taskIds.length}<small>개</small></b><small>${person.missing.length?`리소스 미입력 ${person.missing.length}개`:'모두 입력됨'}</small></div></div>
        <div class="rp-chart-wrap">${chart(person,data.periods,rootOf,rootColor,esc,space)}</div><div class="rp-legend">${legend}</div>
        <table class="rp-tasks"><thead><tr><th>L5 세부 연구 / L4</th><th class="num">기간</th><th class="num">배정</th></tr></thead><tbody>${taskRows||'<tr><td colspan="3" class="empty">배정된 L5가 없습니다.</td></tr>'}</tbody></table>
      </div>
      <details class="resource-method"><summary>계산 기준</summary><div class="resource-method-content"><p><strong>대상</strong>연구 로드맵의 담당자 리소스와 같은 규칙입니다. L5에 입력한 배정만 합산하고 보류 연구는 제외합니다. 리소스가 빈칸인 L5는 계산하지 않고 미입력으로 따로 셉니다.</p><p><strong>평균 배정</strong>그 기간 평일마다 동시에 배정된 비율을 더한 뒤 평일 수로 나눕니다. 월별 평균 배정 100%는 1 MM입니다.</p><p><strong>주차</strong>주는 월요일부터이며, 이름은 그 주 목요일이 속한 달을 따릅니다. 팀 리소스의 주차와 같습니다.</p></div></details>
    </section>`;
    host.querySelectorAll('[data-resource-unit]').forEach(b=>b.onclick=()=>{unit=b.dataset.resourceUnit;render(host,{state,escape:esc,openTask});});
    host.querySelectorAll('[data-resource-person]').forEach(b=>b.onclick=()=>{selected=b.dataset.resourcePerson;render(host,{state,escape:esc,openTask});[...host.querySelectorAll('[data-resource-person]')].find(x=>x.dataset.resourcePerson===selected)?.focus();});
    host.querySelectorAll('[data-resource-task]').forEach(b=>b.onclick=()=>openTask(b.dataset.resourceTask));
  }
  window.ResearchResources={plan,planRange,periodsOf,render};
})();
