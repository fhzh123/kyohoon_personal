// AI 컨퍼런스 데드라인. paper.js가 #deadlines 화면을 열 때 PaperDeadlines.render(app)를 부릅니다.
// 데이터는 매주 목요일 오전 9시(KST)에 GitHub Actions가 다시 만든 server/deadlines/deadlines.json입니다.
// 남은 시간과 표시 시각은 모두 브라우저에서 KST(Asia/Seoul)로 계산합니다.
(()=>{
  'use strict';
  const KST='Asia/Seoul',DAY=86400000,STORE='paper-deadlines-view';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KIND_NAMES={abstract:'Abstract',submission:'Submission',supplementary:'Supplementary',reviews:'Reviews',rebuttal:'Rebuttal',commitment:'Commitment',notification:'Notification',camera_ready:'Camera-ready',other:'Other'};
  const KIND_HELP={abstract:'초록, 논문 등록',submission:'논문 제출',supplementary:'부록, 코드',reviews:'리뷰 공개',rebuttal:'리뷰탈, 저자 응답',commitment:'ARR 커밋',notification:'결과 발표',camera_ready:'최종본 제출',other:'기타'};
  const parts=(iso,opts)=>Object.fromEntries(new Intl.DateTimeFormat('ko-KR',{timeZone:KST,...opts}).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));
  const kstDate=iso=>{const p=parts(iso,{year:'numeric',month:'numeric',day:'numeric',weekday:'short'});return p.year+'년 '+p.month+'월 '+p.day+'일 ('+p.weekday+')';};
  const kstShort=iso=>{const p=parts(iso,{month:'numeric',day:'numeric',weekday:'short'});return p.month+'월 '+p.day+'일 ('+p.weekday+')';};
  const kstTime=iso=>{const p=parts(iso,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});return p.hour+':'+p.minute;};
  const kstDay=iso=>{const p=parts(iso,{year:'numeric',month:'2-digit',day:'2-digit'});return p.year+'-'+p.month+'-'+p.day;};
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // 학회가 쓴 그대로: "Dec 4, 2026 23:59 AoE (UTC-12)"
  function original(d){
    const [date,time]=d.date.split(' '),[y,m,day]=date.split('-').map(Number);
    const zone=/^aoe$/i.test(d.timezone)||/^utc\s*-\s*12(:?00)?$/i.test(d.timezone)?'AoE (UTC-12)':d.timezone;
    return MONTHS[m-1]+' '+day+', '+y+(d.dateOnly?'':' '+(time||'23:59').slice(0,5))+' '+zone.replace(/ \(/,'\u00a0(').replace(/-/g,'\u2011');
  }
  function left(ms){
    if(ms<=0)return '마감';
    const m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60),min=m%60;
    if(d>0)return d+'일 '+h+'시간';
    if(h>0)return h+'시간 '+min+'분';
    return min+'분';
  }
  // 오늘(KST)부터 마감일(KST)까지 달력 날짜로 센 D-day
  function dday(iso,now){const a=Date.parse(kstDay(new Date(now).toISOString())),b=Date.parse(kstDay(iso));const n=Math.round((b-a)/DAY);return n===0?'D-day':n>0?'D-'+n:'D+'+(-n);}
  const urgency=ms=>ms<=0?'past':ms<7*DAY?'soon':ms<30*DAY?'near':'later';

  let state={category:'all',kinds:null},data=null,root=null,timer=null;
  try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved&&typeof saved==='object'){state.category=typeof saved.category==='string'?saved.category:'all';state.kinds=Array.isArray(saved.kinds)?saved.kinds:null;}}catch{}
  const save=()=>{try{localStorage.setItem(STORE,JSON.stringify(state));}catch{}};
  const kindOn=k=>!state.kinds||state.kinds.includes(k);

  // 한 학회에서 지금 보여줄 회차와 그 회차의 다음 마감을 고릅니다.
  function pick(conf,now){
    const eds=conf.editions,thisYear=new Date(now).getUTCFullYear();
    for(const e of eds){
      const next=e.deadlines.find(d=>d.at&&Date.parse(d.at)>now&&kindOn(d.kind));
      if(next)return {conf,edition:e,next,status:'upcoming'};
    }
    const anyFuture=eds.flatMap(e=>e.deadlines.filter(d=>d.at&&Date.parse(d.at)>now).map(d=>({e,d})))[0];
    if(anyFuture)return {conf,edition:anyFuture.e,status:'filtered',other:anyFuture.d};
    const announced=eds.filter(e=>e.year>=thisYear&&e.deadlines.some(d=>!d.at));
    if(announced.length)return {conf,edition:announced[0],status:'tba'};
    return {conf,edition:eds.at(-1)||null,status:'unknown'};
  }

  function logo(org){
    if(!org)return '';
    // 로고 파일이 없는 기관은 약칭을 씁니다. 긴 약칭은 단어마다 줄을 바꿉니다.
    const mark=org.name.replace(/ Foundation$/,''),words=mark.split(' ');
    return '<span class="dl-org'+(org.logo&&org.tile?org.tile.split(' ').map(t=>' is-'+esc(t)).join(''):'')+'" title="'+esc(org.full)+'">'+(org.logo?'<img src="'+esc(org.logo)+'" alt="'+esc(org.name)+'" width="28" height="28">':'<b'+(Math.max(...words.map(w=>w.length))>4?' class="is-long"':'')+' aria-label="'+esc(org.name)+'">'+words.map(esc).join('<br>')+'</b>')+'</span>';
  }
  const badge=k=>'<span class="dl-kind" data-kind="'+esc(k)+'">'+esc(KIND_NAMES[k]||k)+'</span>';
  const external=(href,label,cls='dl-site')=>href?'<a class="'+cls+'" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+label+'<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></a>':'';
  const sourceName=url=>/ccf-deadlines/.test(url)?'ccfddl':/ai-deadlines/.test(url)?'Hugging Face ai-deadlines':(()=>{try{return new URL(url).hostname.replace(/^www\./,'');}catch{return '출처';}})();

  function nextBlock(d,now){
    const ms=Date.parse(d.at)-now,u=urgency(ms);
    return '<div class="dl-next" data-urgency="'+u+'">'+
      '<div class="dl-next-head">'+badge(d.kind)+'<span class="dl-next-label">'+esc(d.label)+'</span></div>'+
      '<div class="dl-next-row"><div class="dl-when"><strong>'+kstShort(d.at)+' '+kstTime(d.at)+' <small>KST</small></strong>'+
      '<span>공지 '+esc(original(d))+(d.dateOnly?'<em>시각 미공지, 그날 끝 기준</em>':'')+'</span></div>'+
      '<div class="dl-left" data-at="'+esc(d.at)+'"><b>'+left(ms)+'</b><span>'+dday(d.at,now)+'</span></div></div>'+
      (d.note?'<p class="dl-note">'+esc(d.note)+'</p>':'')+
      (d.disagreement?'<p class="dl-note dl-warn">공개 데이터셋은 '+esc(original(d.disagreement))+'로 표기합니다. 공식 페이지를 다시 확인해 주세요.</p>':'')+
    '</div>';
  }

  function timeline(e,now,highlight){
    return '<ol class="dl-timeline">'+e.deadlines.map(d=>{
      const past=d.at&&Date.parse(d.at)<=now,tba=!d.at;
      return '<li class="'+(past?'is-past':'')+(tba?' is-tba':'')+(d===highlight?' is-next':'')+'">'+badge(d.kind)+
        '<span class="dl-t-label">'+esc(d.label)+'</span>'+
        '<span class="dl-t-date">'+(tba?'TBA':kstShort(d.at)+(d.dateOnly?'':' '+kstTime(d.at)))+'</span>'+
        '<span class="dl-t-left">'+(tba?'':past?'지남':dday(d.at,now))+'</span></li>';
    }).join('')+'</ol>';
  }

  function sourceLine(e){
    const checked=e.checked?'공식 페이지 확인 '+e.checked.slice(5).replace('-','월 ').replace(/^0/,'')+'일':'';
    const urls=[...new Set((e.sources.length?e.sources:e.deadlines.map(d=>d.source)).filter(Boolean))].slice(0,3);
    return '<p class="dl-source">'+(checked?'<span>'+checked+'</span>':'<span>공개 데이터셋 기준</span>')+urls.map(u=>external(u,esc(sourceName(u)),'dl-source-link')).join('')+'</p>';
  }

  function card(p,now){
    const {conf,edition:e}=p,org=data.organizers[conf.organizer];
    const cats=conf.categories.map(c=>data.categories.find(x=>x.id===c)).filter(Boolean);
    const upcoming=e.deadlines.filter(d=>d.at&&Date.parse(d.at)>now&&d!==p.next).slice(0,3);
    return '<article class="dl-card" data-urgency="'+urgency(Date.parse(p.next.at)-now)+'">'+
      '<header class="dl-card-head">'+logo(org)+'<div class="dl-title"><h2>'+esc(conf.name)+' '+e.year+'</h2><span>'+esc(org?.name||'')+'</span></div>'+external(e.link,'홈페이지')+'</header>'+
      nextBlock(p.next,now)+
      (upcoming.length?'<ul class="dl-after">'+upcoming.map(d=>'<li>'+badge(d.kind)+'<span>'+esc(d.label)+'</span><time>'+kstShort(d.at)+'</time></li>').join('')+'</ul>':'')+
      '<div class="dl-meta"><p>'+esc(e.dates||'일정 미발표')+'<br>'+esc(e.place||'')+'</p><div class="dl-tags">'+cats.map(c=>'<span title="'+esc(c.full)+'">'+esc(c.name)+'</span>').join('')+'</div></div>'+
      '<details class="dl-all"><summary>전체 일정 '+e.deadlines.length+'개</summary>'+timeline(e,now,p.next)+sourceLine(e)+'</details>'+
    '</article>';
  }

  function quietRow(p,now){
    const {conf,edition:e,status}=p,org=data.organizers[conf.organizer];
    let what;
    if(status==='filtered')what='선택한 종류의 마감은 없습니다. 다음 일정: '+esc(KIND_NAMES[p.other.kind])+' '+kstShort(p.other.at);
    else if(status==='tba'){const t=e.deadlines.filter(d=>!d.at).map(d=>esc(d.label)).join(', ');what=esc(conf.name)+' '+e.year+' 마감 미발표'+(t?' ('+t+')':'');}
    else if(e&&e.year>new Date(now).getUTCFullYear())what=esc(conf.name)+' '+e.year+' 마감은 모두 지났습니다. 학회 개최 전입니다.';
    else what=e?'다음 회차 일정 미발표. 지난 회차 '+esc(conf.name)+' '+e.year:'일정 정보 없음';
    return '<li class="dl-quiet-row">'+logo(org)+'<div><h3>'+esc(conf.name)+(e&&status!=='unknown'?' '+e.year:'')+'</h3><p>'+what+'</p>'+(e?'<p class="dl-quiet-meta">'+esc([e.dates,e.place].filter(x=>x&&x!=='TBA').join(', '))+'</p>':'')+'</div>'+(e?external(e.link,'홈페이지'):'')+'</li>';
  }

  function header(){
    const g=data.generatedAt;
    const src=data.sources.filter(s=>s.url).map(s=>external(s.url,esc(s.name),'dl-source-link')).join('');
    return '<button class="paper-back" data-action="back-paper">← Paper</button>'+
      '<section class="paper-welcome paper-workspace-welcome dl-welcome"><div><p class="paper-eyebrow">Paper / 투고 일정</p><h1>AI 컨퍼런스 데드라인</h1>'+
      '<p>마감 시각은 KST로 바꿔 보여주고, 학회가 공지한 원래 시각을 함께 적습니다.</p>'+
      '<p class="dl-updated"><span>'+(g?kstDate(g)+' '+kstTime(g)+' KST 갱신':'갱신 기록 없음')+'</span><span>매주 목요일 오전 9시 자동 갱신</span></p></div>'+
      '<img src="/mascot/paper-pose.webp" alt="" width="168" height="168"></section>'+
      '<div class="dl-sources">출처: 각 학회 공식 페이지'+src+'</div>';
  }

  function toolbar(picks){
    const count=c=>picks.filter(p=>p.status==='upcoming'&&(c==='all'||p.conf.categories.includes(c))).length;
    return '<div class="dl-toolbar"><div class="paper-tabs" role="tablist" aria-label="분야">'+
      [['all','전체'],...data.categories.map(c=>[c.id,c.name])].map(([id,name])=>'<button type="button" role="tab" class="paper-tab" aria-selected="'+(state.category===id)+'" data-dl-category="'+id+'">'+esc(name)+'<span>'+count(id)+'</span></button>').join('')+
      '</div><div class="dl-kinds" role="group" aria-label="마감 종류">'+data.kinds.filter(k=>k!=='other').map(k=>'<button type="button" class="dl-kind-toggle" data-dl-kind="'+k+'" aria-pressed="'+kindOn(k)+'" title="'+esc(KIND_HELP[k])+'">'+badge(k)+'</button>').join('')+
      (state.kinds?'<button type="button" class="dl-reset" data-dl-kind-reset>모든 종류</button>':'')+'</div></div>';
  }

  function draw(){
    if(!root||!data)return;
    const now=Date.now();
    const picks=data.conferences.map(c=>pick(c,now));
    const visible=picks.filter(p=>state.category==='all'||p.conf.categories.includes(state.category));
    const upcoming=visible.filter(p=>p.status==='upcoming').sort((a,b)=>Date.parse(a.next.at)-Date.parse(b.next.at));
    const quiet=visible.filter(p=>p.status!=='upcoming');
    const open=new Set([...root.querySelectorAll('.dl-all[open]')].map(n=>n.closest('.dl-card')?.dataset.conf));
    root.innerHTML=header()+toolbar(picks)+
      (upcoming.length?'<div class="dl-grid">'+upcoming.map(p=>card(p,now).replace('<article class="dl-card"','<article class="dl-card" data-conf="'+esc(p.conf.id)+'"')).join('')+'</div>':'<div class="paper-empty"><h2>다가오는 마감이 없습니다.</h2><p>분야나 마감 종류를 바꿔 보세요.</p></div>')+
      (quiet.length?'<section class="dl-quiet" aria-labelledby="dl-quiet-title"><h2 id="dl-quiet-title">예정된 마감이 없는 학회</h2><ul>'+quiet.map(p=>quietRow(p,now)).join('')+'</ul></section>':'');
    for(const n of root.querySelectorAll('.dl-card[data-conf]'))if(open.has(n.dataset.conf))n.querySelector('.dl-all')?.setAttribute('open','');
  }

  // 남은 시간만 고칩니다. 마감을 지난 카드가 생기면 전체를 다시 그립니다.
  function tick(){
    if(!root?.isConnected||!root.classList.contains('dl-root')){clearInterval(timer);timer=null;return;}
    const now=Date.now();let crossed=false;
    for(const n of root.querySelectorAll('.dl-left[data-at]')){
      const ms=Date.parse(n.dataset.at)-now;if(ms<=0)crossed=true;
      n.querySelector('b').textContent=left(ms);n.querySelector('span').textContent=dday(n.dataset.at,now);
      const u=urgency(ms),box=n.closest('.dl-next');if(box&&box.dataset.urgency!==u){box.dataset.urgency=u;box.closest('.dl-card').dataset.urgency=u;}
    }
    if(crossed)draw();
  }

  function onClick(e){
    const cat=e.target.closest('[data-dl-category]'),kind=e.target.closest('[data-dl-kind]');
    if(cat){state.category=cat.dataset.dlCategory;save();draw();return;}
    if(kind){
      const k=kind.dataset.dlKind,all=data.kinds.filter(x=>x!=='other');
      let on=state.kinds?[...state.kinds]:[...all];
      // 모두 켜진 상태에서 하나를 누르면 그 종류만 남깁니다. 보통은 "제출만" 같은 보기를 원하기 때문입니다.
      if(!state.kinds)on=[k];else on=on.includes(k)?on.filter(x=>x!==k):[...on,k];
      state.kinds=on.length&&on.length<all.length?on:null;save();draw();return;
    }
    if(e.target.closest('[data-dl-kind-reset]')){state.kinds=null;save();draw();}
  }

  async function render(app){
    root=app;app.setAttribute('aria-busy','true');
    app.innerHTML='<button class="paper-back" data-action="back-paper">← Paper</button><div class="paper-loading" role="status">마감 일정을 불러오는 중입니다.</div>';
    try{
      if(!data){
        if(window.PAPER_DEADLINES)data=window.PAPER_DEADLINES;
        else{const r=await fetch('/api/paper/deadlines',{credentials:'same-origin'});if(!r.ok)throw Error('마감 일정을 불러오지 못했습니다.');data=await r.json();}
      }
      if(root!==app||!app.isConnected)return;
      app.classList.add('dl-root');draw();
      if(!app.dataset.dlBound){app.addEventListener('click',onClick);app.dataset.dlBound='1';}
      clearInterval(timer);timer=setInterval(tick,30000);
    }catch(error){
      app.innerHTML='<button class="paper-back" data-action="back-paper">← Paper</button><div class="paper-empty"><h2>마감 일정을 불러오지 못했습니다.</h2><p>'+esc(error.message)+'</p></div>';
    }finally{app.setAttribute('aria-busy','false');}
  }
  function leave(){clearInterval(timer);timer=null;if(root)root.classList.remove('dl-root');root=null;}

  window.PaperDeadlines={render,leave,_test:{pick,left,dday,original,kstShort,kstTime}};
})();
