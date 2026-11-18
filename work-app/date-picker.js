(() => {
  'use strict';
  const P = window.ResearchPeriods;
  const weekdays = ['일','월','화','수','목','금','토'];
  const label = value => {
    if (!P.validDate(value)) return '날짜 선택';
    const d=P.date(value);
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} (${weekdays[d.getDay()]})`;
  };
  function markup(task) {
    const start=P.validDate(task.start)?task.start:'',end=P.validDate(task.end)?task.end:'';
    return `<div class="research-date-picker"><input id="period-start" name="periodStart" type="hidden" value="${start}"><input id="period-end" name="periodEnd" type="hidden" value="${end}"><div class="date-range-fields"><button type="button" class="date-range-field" data-date-open="start" aria-expanded="false" aria-controls="research-date-panel"><span>시작일</span><strong data-date-label="start">${label(start)}</strong></button><span class="date-range-arrow" aria-hidden="true">→</span><button type="button" class="date-range-field" data-date-open="end" aria-expanded="false" aria-controls="research-date-panel"><span>종료일</span><strong data-date-label="end">${label(end)}</strong></button></div><div id="research-date-panel" class="date-range-panel" role="group" aria-label="연구 시작일과 종료일 선택" hidden><div class="date-picker-tabs"><button type="button" data-date-mode="start"><span>시작일</span><strong></strong></button><span aria-hidden="true">→</span><button type="button" data-date-mode="end"><span>종료일</span><strong></strong></button></div><p class="date-picker-prompt" aria-live="polite"></p><div class="date-picker-month"><button type="button" data-date-prev aria-label="이전 달">‹</button><strong aria-live="polite"></strong><button type="button" data-date-next aria-label="다음 달">›</button></div><div class="date-picker-weekdays" aria-hidden="true">${weekdays.map(d=>`<span>${d}</span>`).join('')}</div><div class="date-picker-days" role="group" aria-label="날짜"></div><div class="date-picker-footer"><button type="button" data-date-cancel class="secondary-button">취소</button><span data-date-count aria-live="polite"></span><button type="button" data-date-apply class="primary-button">기간 적용</button></div></div></div>`;
  }
  function mount(host,{onChange,signal,readOnly=false}={}) {
    const root=host.querySelector('.research-date-picker');if(!root)return;
    const startInput=root.querySelector('#period-start'),endInput=root.querySelector('#period-end'),panel=root.querySelector('.date-range-panel');
    let start='',end='',mode='start',month='',returnFocus=null;
    const enabled=()=>!readOnly&&!document.querySelector('#unscheduled')?.checked;
    function sync() {
      for(const key of ['start','end']) {
        const button=root.querySelector(`[data-date-open="${key}"]`),value=key==='start'?startInput.value:endInput.value;
        button.disabled=!enabled();button.querySelector('strong').textContent=label(value);
      }
      if(!enabled())close(false);
    }
    function close(focus=true) {
      panel.hidden=true;
      root.querySelectorAll('[data-date-open]').forEach(b=>b.setAttribute('aria-expanded','false'));
      if(focus)returnFocus?.focus({preventScroll:true});
    }
    function render(focusDate) {
      const heading=P.date(month),first=P.addDays(month,-heading.getDay()),today=P.iso(new Date());
      root.querySelector('.date-picker-month strong').textContent=`${heading.getFullYear()}년 ${heading.getMonth()+1}월`;
      root.querySelector('[data-date-prev]').disabled=month<=P.monthStart(P.MIN_DATE);
      root.querySelector('[data-date-next]').disabled=month>='9999-12-01';
      root.querySelector('.date-picker-prompt').textContent=mode==='start'?'시작일을 선택하세요.':'종료일을 선택하세요. 같은 날도 선택할 수 있습니다.';
      for(const key of ['start','end']) {
        const tab=root.querySelector(`[data-date-mode="${key}"]`);
        tab.setAttribute('aria-pressed',String(mode===key));tab.querySelector('strong').textContent=label(key==='start'?start:end);
      }
      root.querySelector('.date-picker-days').innerHTML=Array.from({length:42},(_,i)=>{
        const value=P.addDays(first,i),d=P.date(value),edge=value===start||value===end,inRange=!!start&&!!end&&value>=start&&value<=end;
        return `<button type="button" data-date-day="${value}" class="date-picker-day${value.slice(0,7)!==month.slice(0,7)?' is-other-month':''}${inRange?' is-in-range':''}${value===start?' is-start':''}${value===end?' is-end':''}" aria-label="${label(value)}${value===start?' 시작일':''}${value===end?' 종료일':''}" aria-pressed="${edge}" ${value===today?'aria-current="date"':''} ${value<P.MIN_DATE?'disabled':''} tabindex="${value===(focusDate||((mode==='end'?end:start)||month))?'0':'-1'}">${d.getDate()}</button>`;
      }).join('');
      const complete=!!start&&!!end;
      root.querySelector('[data-date-apply]').disabled=!complete;
      root.querySelector('[data-date-count]').textContent=complete?`${P.daysBetween(end,start)+1}일간`:start?'종료일 선택':'';
      if(focusDate)root.querySelector(`[data-date-day="${focusDate}"]`)?.focus({preventScroll:true});
    }
    function open(key,button) {
      if(!enabled())return;
      start=startInput.value;end=endInput.value;mode=key;returnFocus=button;
      const value=(key==='end'?end||start:start)||P.iso(new Date());
      month=P.monthStart(value<P.MIN_DATE?P.MIN_DATE:value);panel.hidden=false;
      root.querySelectorAll('[data-date-open]').forEach(b=>b.setAttribute('aria-expanded','true'));
      render(value<P.MIN_DATE?P.MIN_DATE:value);
      panel.scrollIntoView?.({block:'nearest',behavior:'smooth'});
    }
    root.addEventListener('click',event=>{
      const target=event.target.closest('button');if(!target)return;
      if(target.dataset.dateOpen){open(target.dataset.dateOpen,target);return;}
      if(target.hasAttribute('data-date-cancel')){close();return;}
      if(target.hasAttribute('data-date-apply')){
        if(!start||!end)return;
        startInput.value=start;endInput.value=end;close();sync();onChange?.();return;
      }
      if(target.dataset.dateMode){mode=target.dataset.dateMode;const v=(mode==='start'?start:end)||start||month;month=P.monthStart(v);render();return;}
      if(target.hasAttribute('data-date-prev')||target.hasAttribute('data-date-next')){month=P.step(month,target.hasAttribute('data-date-prev')?-1:1,'month');render();return;}
      const value=target.dataset.dateDay;if(!value)return;
      if(mode==='start'){start=value;if(end&&end<start)end='';mode='end';}
      else {if(!start)start=value;if(value<start){end=start;start=value;}else end=value;}
      month=P.monthStart(value);render(value);
    },{signal});
    root.addEventListener('keydown',event=>{
      if(panel.hidden)return;
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
      const value=event.target.dataset.dateDay;if(!value)return;
      const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
      let next;
      if(Object.hasOwn(offsets,event.key))next=P.addDays(value,offsets[event.key]);
      else if(event.key==='PageUp'||event.key==='PageDown')next=P.step(value,event.key==='PageUp'?-1:1,'month');
      else if(event.key==='Home')next=P.addDays(value,-P.date(value).getDay());
      else if(event.key==='End')next=P.addDays(value,6-P.date(value).getDay());
      if(!next)return;event.preventDefault();if(next<P.MIN_DATE)next=P.MIN_DATE;month=P.monthStart(next);render(next);
    },{signal});
    // Choosing a day replaces the day buttons. The event's original path still
    // contains this picker even when the clicked button is no longer connected.
    document.addEventListener('click',event=>{if(!panel.hidden&&!event.composedPath().includes(root))close(false);},{signal});
    sync();
    return {sync,open:()=>open('start',root.querySelector('[data-date-open="start"]'))};
  }
  window.ResearchDatePicker={markup,mount,label};
})();
