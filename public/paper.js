(()=>{
  'use strict';
  const $=s=>document.querySelector(s),app=$('#paper-app'),dialog=$('#paper-dialog');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=x=>JSON.parse(JSON.stringify(x)),id=()=>crypto.randomUUID(),names={openai:'GPT',anthropic:'Claude',gemini:'Gemini'},types={rebuttal:'리뷰탈',review:'논문 리뷰'},sectionNames={summary:'Summary',strength:'Strength',weakness:'Weakness',etc:'ETC'};
  let saveTimer,maxSaveTimer,pendingSave=null,saveConflict=false,routeBusy=false;
  let data,view='landing',workspace=null,filter='all',query='',current=null,reviewerId=null,issueId=null,section='summary',dirty=false,busy=false,includePdf=true,toastTimer;
  const preview=!!window.PAPER_PREVIEW;
  const btn=(label,action,cls='',extra='')=>'<button type="button" class="paper-btn '+cls+'" data-action="'+action+'" '+extra+'>'+label+'</button>';
  const field=(label,key,value,placeholder='',cls='')=>'<label class="paper-field"><span>'+label+'</span><textarea class="'+cls+'" data-field="'+key+'" placeholder="'+esc(placeholder)+'">'+esc(value)+'</textarea></label>';
  const input=(label,key,value,type='text')=>'<label class="paper-field"><span>'+label+'</span><input type="'+type+'" name="'+key+'" value="'+esc(value)+'" '+(key==='title'?'required maxlength="300"':'')+'></label>';
  function notice(message,error=false){const node=$('#paper-status');node.textContent=message;node.classList.toggle('error',error);node.hidden=false;
    if(dialog.open){let status=dialog.querySelector('[data-dialog-status]');if(!status){status=document.createElement('p');status.dataset.dialogStatus='';status.setAttribute('role','alert');status.className='paper-subtle';dialog.querySelector('form')?.append(status);}status.textContent=message;}
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,error?14000:5000);}
  async function api(route,method='GET',body){
    if(preview){
      if(route==='/api/paper'&&method==='GET')return clone(window.PAPER_PREVIEW);
      if(route==='/api/paper/project'&&method==='PUT')return {project:{id:body.project.id,data:clone(body.project),revision:id(),updated_at:new Date().toISOString()}};
      if(route.endsWith('/delete'))return {deleted:true};
      throw Error('미리보기에서는 API 키와 PDF를 저장하거나 모델을 호출하지 않습니다.');
    }
    const r=await fetch(route,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body),keepalive:new Blob([JSON.stringify(body)]).size<60000}:{})});
    const value=await r.json().catch(()=>({error:'서버 응답을 확인해 주세요.'}));if(!r.ok)throw Object.assign(Error(value.error||'요청에 실패했습니다.'),{status:r.status});return value;
  }
  function saveState(message,error=false){const n=$('[data-save-state]');if(n){n.textContent=message;n.classList.toggle('dirty',dirty||error);n.setAttribute('role','status');}}
  function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(backgroundSave,700);if(!maxSaveTimer)maxSaveTimer=setTimeout(backgroundSave,3000);}
  function mark(){dirty=true;saveState('자동 저장 대기 중');updateCounts();if(!saveConflict)scheduleSave();}
  function safeLeave(){if(busy){notice('진행 중인 작업을 마친 뒤 이동해 주세요.');return false;}return true;}
  async function backgroundSave(){clearTimeout(saveTimer);clearTimeout(maxSaveTimer);maxSaveTimer=null;if(!dirty||saveConflict)return;try{await save();}catch(error){saveState(saveConflict?'다른 기기에서 변경됨 — MD 내보내기 후 새로고침':'저장 실패 — 다시 연결되면 재시도',true);notice(error.message,true);if(!saveConflict)saveTimer=setTimeout(backgroundSave,5000);}}
  function activeReviewer(){return current?.data.reviewers.find(r=>r.id===reviewerId);}
  function activeIssue(){return activeReviewer()?.issues.find(i=>i.id===issueId);}
  const statuses={planned:'진행 예정',active:'진행 중',done:'진행 완료'};
  const normalizeStatus=p=>{if(p.status==='archived')p.status='done';return p;};
  const workspaceName=type=>type==='rebuttal'?'논문 리뷰탈 준비':'논문 리뷰 준비';

  function renderLanding(){
    view='landing';workspace=null;current=null;query='';filter='all';
    app.innerHTML='<section class="paper-welcome"><div><p class="paper-eyebrow">논문을 위한 작업 공간</p><h1>Paper</h1><p>리뷰탈과 논문 리뷰를<br>나누어 관리합니다.</p></div><img src="/mascot/paper.png" alt="논문과 펜을 든 마스코트" width="210" height="210"></section>'+
      (preview?'<p class="paper-preview-note">가상 논문으로 구성한 미리보기입니다. 편집 내용은 이 화면에서만 유지됩니다.</p>':'')+
      '<nav class="paper-choices" aria-label="논문 작업 선택">'+['rebuttal','review'].map(type=>{
        const count=data.projects.filter(x=>x.data.type===type&&x.data.status==='active').length;
        return '<button type="button" class="paper-choice" data-action="choose-'+type+'"><img src="/mascot/'+(type==='rebuttal'?'rebuttal.png':'journal.webp')+'" alt="" width="168" height="168"><span class="paper-choice-role">'+(type==='rebuttal'?'저자로서':'리뷰어로서')+'</span><span class="paper-choice-title">'+workspaceName(type)+'<span aria-hidden="true">→</span></span><span class="paper-choice-description">'+(type==='rebuttal'?'리뷰어별 쟁점을 정리하고<br>근거를 담은 답변을 준비합니다.':'네 항목에 평가 메모를 적고<br>영문 리뷰를 작성합니다.')+'</span><span class="paper-choice-count">진행 중인 논문 '+count+'편</span></button>';
      }).join('')+'</nav><div class="paper-help"><p>작업을 선택하면 해당 논문 목록으로 이동합니다.</p>'+'</div>';
    app.setAttribute('aria-busy','false');
  }
  function renderList(){
    if(!workspace){renderLanding();return;}
    view='list';app.innerHTML='<button class="paper-back" data-action="back-paper">← Paper</button><section class="paper-welcome paper-workspace-welcome"><div><p class="paper-eyebrow">Paper / '+(workspace==='rebuttal'?'저자 작업':'리뷰어 작업')+'</p><h1>'+workspaceName(workspace)+'</h1><p>'+(workspace==='rebuttal'?'리뷰어별 쟁점과 답변을 정리합니다.':'평가 메모를 영문 리뷰로 다듬습니다.')+'</p></div><img src="/mascot/'+(workspace==='rebuttal'?'rebuttal.png':'journal.webp')+'" alt="" width="168" height="168"></section>'+
      (preview?'<p class="paper-preview-note">가상 논문으로 구성한 미리보기입니다. 편집 내용은 이 화면에서만 유지됩니다.</p>':'')+
      '<div class="paper-topline"><div class="paper-actions">'+btn(workspace==='rebuttal'?'＋ 리뷰탈 논문 추가':'＋ 리뷰할 논문 추가','new-'+workspace,'primary')+'</div>'+'</div>'+
      '<div class="paper-toolbar"><div class="paper-tabs" role="tablist" aria-label="작업 상태">'+[['all','전체'],...Object.entries(statuses)].map(([k,label])=>'<button type="button" role="tab" class="paper-tab" aria-selected="'+(filter===k)+'" data-filter="'+k+'">'+label+'<span>'+data.projects.filter(x=>x.data.type===workspace&&(k==='all'||x.data.status===k)).length+'</span></button>').join('')+'</div><input class="paper-search" id="paper-search" type="search" aria-label="논문 제목 또는 학회 검색" placeholder="제목 또는 학회 검색" value="'+esc(query)+'"></div><div class="paper-list" id="paper-list"></div>'+
      '<div class="paper-help"><p>'+esc(names[data.settings.provider])+' / '+esc(data.settings.models[data.settings.provider])+'<br>'+(!data.settings.keys[data.settings.provider].configured?'설정에서 API 키를 연결해 주세요.':'선택한 모델 하나로 모든 작업을 실행합니다.')+'</p></div>';
    renderRows();app.setAttribute('aria-busy','false');
  }
  function renderRows(){
    const rows=data.projects.filter(x=>x.data.type===workspace&&(filter==='all'||x.data.status===filter)&&[x.data.title,x.data.venue].join(' ').toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
    $('#paper-list').innerHTML=rows.length?rows.map(row=>{const p=row.data;const isAcl=/\b(?:ACL|ARR|EMNLP|NAACL|EACL|AACL)\b/i.test(p.venue);const venueLabel=esc(p.venue.trim().replace(/\b20\d{2}\b/g,'').trim()||'미지정');return '<article class="paper-row" tabindex="0" role="button" data-open="'+esc(p.id)+'" aria-label="'+esc(p.title)+' 열기"><div class="paper-venue '+(isAcl?'paper-venue-acl':'')+'">'+(isAcl?'<img src="/icons/venues/acl.svg" width="54" height="54" alt="ACL">':'<span>'+venueLabel+'</span>')+'</div><div><span class="paper-type">'+types[p.type]+' / '+statuses[p.status]+'</span><h2>'+esc(p.title)+'</h2><div class="paper-meta"><span>'+esc(p.venue||'학회 미입력')+'</span>'+(p.type==='rebuttal'?'<span>'+p.reviewers.length+'명 리뷰어</span>':'')+'</div></div><div class="paper-row-end"><strong>'+(p.deadline?esc(p.deadline)+' 마감':'마감일 미설정')+'</strong></div><span class="paper-arrow" aria-hidden="true">→</span></article>';}).join(''):'<div class="paper-empty"><h2>'+(query?'검색 결과가 없습니다.':'첫 번째 논문을 등록해 주세요.')+'</h2><p>제목과 학회를 적고 바로 메모를 시작할 수 있습니다.</p></div>';

  }
  function newProject(type){showProjectDialog({id:id(),type,title:'',venue:'',deadline:'',status:'planned',charLimit:0,context:'',pdf:null,reviewers:[],sections:{summary:'',strength:'',weakness:'',etc:''},reviewDraft:'',history:[]},true);}
  function showProjectDialog(p,isNew=false){
    dialog.innerHTML='<form id="paper-project-form"><h2 id="paper-dialog-title">'+(isNew?types[p.type]+' 시작':'논문 정보 수정')+'</h2>'+input('논문 제목','title',p.title)+input('학회 / 저널','venue',p.venue)+
      '<div class="paper-pair">'+input('마감일','deadline',p.deadline,'date')+input(p.type==='rebuttal'?'리뷰어별 글자 제한 (0: 없음)':'전체 리뷰 글자 제한 (0: 없음)','charLimit',p.charLimit,'number')+'</div>'+
      '<label class="paper-field"><span>상태</span><select name="status">'+Object.entries(statuses).map(([v,n])=>'<option value="'+v+'" '+(v===p.status?'selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
      (isNew&&p.type==='review'?'<label class="paper-field"><span>논문 PDF <small>선택 사항</small></span><input type="file" id="paper-create-pdf" name="pdf" accept="application/pdf,.pdf"><small class="paper-subtle">5 MB까지 첨부할 수 있으며, 나중에 추가해도 됩니다.</small></label>':'')+
      '<div class="paper-actions">'+btn('취소','close-dialog')+'<button class="paper-btn primary" type="submit">'+(isNew?'작업 만들기':'적용')+'</button></div></form>';
    showDialog();
    $('#paper-project-form').onsubmit=async e=>{e.preventDefault();const form=new FormData(e.target);const next={...clone(p),title:String(form.get('title')).trim(),venue:String(form.get('venue')),deadline:String(form.get('deadline')),status:form.get('status'),charLimit:Number(form.get('charLimit'))};
      if(!next.title||next.title.length>300||!Number.isInteger(next.charLimit)||next.charLimit<0||next.charLimit>100000){notice('제목과 글자 수 제한을 확인해 주세요.',true);return;}
      const file=isNew&&p.type==='review'?$('#paper-create-pdf')?.files[0]:null;
      if(file){try{validatePdf(file);}catch(error){notice(error.message,true);return;}}
      if(isNew){if(!safeLeave())return;await run(async()=>{current={id:next.id,data:next,revision:null};reviewerId=null;issueId=null;dirty=true;
        try{await save();}catch(error){notice(error.message,true);return;}
        dialog.close();route('editor',current.id);renderEditor();
        if(file){try{await uploadFile(file);}catch(error){notice('논문은 생성됐지만 PDF 첨부에 실패했습니다. '+error.message+' 편집 화면에서 다시 첨부해 주세요.',true);}}
      },e.submitter);}else{current.data=next;mark();dialog.close();renderEditor();}};
  }
  function showDialog(){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  async function openProject(projectId,restore=false){if(!safeLeave())return;await save();current=clone(data.projects.find(x=>x.id===projectId));workspace=current.data.type;reviewerId=current.data.reviewers[0]?.id;issueId=current.data.reviewers[0]?.issues[0]?.id;dirty=false;saveConflict=false;view='editor';if(!restore)route('editor',current.id);renderEditor();window.scrollTo?.(0,0);}
  function renderEditor(){
    view='editor';const p=current.data;app.innerHTML='<div class="paper-topline"><button class="paper-back" data-action="back">← '+workspaceName(p.type)+'</button></div>'+
      '<div class="paper-project-heading"><div><p class="paper-eyebrow">'+types[p.type]+' / '+statuses[p.status]+'</p><h1>'+esc(p.title)+'</h1><div class="paper-meta"><label class="paper-project-status"><span class="sr-only">진행 상태</span><select data-project-status aria-label="진행 상태">'+Object.entries(statuses).map(([v,n])=>'<option value="'+v+'" '+(v===p.status?'selected':'')+'>'+n+'</option>').join('')+'</select></label><span>'+esc(p.venue||'학회 미입력')+'</span><span>'+(p.deadline?esc(p.deadline)+' 마감':'마감일 미설정')+'</span>'+(p.charLimit?'<span>'+p.charLimit+'자 제한</span>':'')+'</div></div><div class="paper-actions">'+btn('정보 수정','edit-meta')+btn('MD 내보내기','export')+'</div></div>'+
      '<div class="paper-attachment"><div class="paper-actions">'+(p.pdf?'<a class="paper-btn quiet" '+(preview?'data-action="preview-file" href="#paper-app"':'href="/api/paper/file?projectId='+p.id+'"')+'>'+esc(p.pdf.name)+' ↗</a>'+btn('첨부 해제','detach','quiet'):'<span>논문 PDF를 첨부하면 초안에 함께 참고합니다.</span>')+'</div><div class="paper-actions">'+(p.pdf?'<label><input type="checkbox" id="paper-include-pdf" '+(includePdf?'checked':'')+'> 생성 시 PDF 포함</label>':'')+'<label class="paper-btn" for="paper-file">'+(p.pdf?'PDF 교체':'PDF 첨부')+'</label><input type="file" id="paper-file" accept="application/pdf,.pdf" hidden></div></div>'+
      '<details class="paper-context"><summary>논문 배경 및 공통 작성 지침 ＋</summary>'+field('모든 쟁점에 함께 전달할 내용','context',p.context,'논문 핵심 기여, 대응 방향, 지켜야 할 표현 등을 적어 주세요.')+'</details>'+
      (p.type==='rebuttal'?'<div class="paper-editor"><aside class="paper-outline" aria-label="리뷰어와 쟁점" id="paper-outline"></aside><div class="paper-editor-body" id="paper-editor-body"></div></div>':'<div id="paper-editor-body"></div>')+
      '<details class="paper-history"><summary>생성 이력 ('+p.history.length+')</summary>'+p.history.slice().reverse().map(h=>'<article><p class="paper-subtle">'+esc(h.at.replace('T',' ').slice(0,16))+' / '+esc(h.action)+' / '+esc(h.model)+'</p><pre>'+esc(h.text)+'</pre>'+btn('텍스트 복사','copy-history','','data-history="'+h.id+'"')+'</article>').join('')+'</details>'+
      '<div class="paper-save-bar"><span class="paper-save-state '+(dirty?'dirty':'')+'" data-save-state>'+(dirty?'자동 저장 대기 중':'자동 저장됨')+'</span>'+btn('저장','save','primary')+'</div><div class="paper-help"><p>'+esc(names[data.settings.provider])+' / '+esc(data.settings.models[data.settings.provider])+'</p>'+btn('작업 삭제','delete-project','quiet danger')+'</div>';
    if(p.type==='rebuttal'){renderOutline();renderIssue();}else renderReview();updateCounts();app.setAttribute('aria-busy','false');
  }
  function renderOutline(){
    $('#paper-outline').innerHTML='<h2>리뷰어</h2>'+current.data.reviewers.map(r=>'<div class="paper-reviewer-head"><button data-action="rename-reviewer" data-reviewer="'+r.id+'">'+esc(r.name)+'</button><button data-action="delete-reviewer" data-reviewer="'+r.id+'" aria-label="'+esc(r.name)+' 삭제">×</button></div><div class="paper-outline-items">'+r.issues.map((i,k)=>'<button class="paper-issue '+(i.id===issueId?'active':'')+'" data-issue="'+i.id+'" data-reviewer="'+r.id+'"><small>'+(i.done?'✓ ':'')+esc(i.kind)+' '+(k+1)+'</small>'+esc(i.title||i.original.slice(0,40)||'새 쟁점')+'</button>').join('')+'</div>'+btn('＋ 쟁점 추가','add-issue','quiet','data-reviewer="'+r.id+'"')).join('')+btn('＋ 리뷰어 추가','add-reviewer','');
  }
  function renderIssue(){
    const i=activeIssue();const body=$('#paper-editor-body');
    if(!i){body.innerHTML='<div class="paper-empty"><h2>리뷰어의 쟁점을 정리하세요.</h2><p>Weakness, Question, Suggestion을 하나씩 등록합니다.</p>'+btn('＋ 리뷰어 추가','add-reviewer','primary')+'</div>';return;}
    body.innerHTML='<div class="paper-stage-title"><h2>'+esc(activeReviewer().name)+'</h2><div class="paper-actions"><label><input type="checkbox" data-issue-field="done" '+(i.done?'checked':'')+'> 대응 완료</label>'+btn('쟁점 삭제','delete-issue','quiet')+'</div></div>'+
      '<div class="paper-pair"><label class="paper-field"><span>쟁점 제목</span><input data-issue-field="title" maxlength="300" value="'+esc(i.title)+'" placeholder="쟁점을 짧게 요약해 주세요"></label><label class="paper-field"><span>종류</span><select data-issue-field="kind">'+['Weakness','Question','Suggestion'].map(k=>'<option '+(k===i.kind?'selected':'')+'>'+k+'</option>').join('')+'</select></label></div>'+
      '<div class="paper-pair">'+field('리뷰 원문','issue.original',i.original,'리뷰어의 답변할 부분만 그대로 붙여 넣으세요.')+'<div><div class="paper-field-head"><label for="paper-translation">한국어 번역</label>'+btn('번역하기','translate')+'</div><textarea id="paper-translation" data-field="issue.translation" placeholder="원문의 의미와 강도를 유지해 번역합니다.">'+esc(i.translation)+'</textarea></div></div>'+
      '<div class="paper-pair">'+field('초도 대응 메모','issue.notes',i.notes,'어떤 문체든 편하게 적으세요. 무엇을 확인하고 어떻게 답할지 정리합니다.')+field('실험 결과와 근거','issue.evidence',i.evidence,'실제 수치, 표, 실험 조건과 확인된 사실을 적으세요. 미확인 수치는 ??로 남겨 두세요.')+'</div>'+
      '<div class="paper-draft-bar"><h2>영문 답변</h2><div class="paper-actions"><span class="paper-count" data-count="issue"></span>'+btn('답변 복사','copy-draft')+btn('초안 작성','rebuttal','primary')+'</div></div>'+
      '<textarea class="draft" aria-label="영문 리뷰탈 초안" data-field="issue.draft" placeholder="대응 메모와 실험 결과를 바탕으로 초안을 작성합니다.">'+esc(i.draft)+'</textarea><p class="paper-subtle">생성한 초안은 직접 다듬을 수 있습니다. 기존 초안은 생성 이력에 남습니다.</p>'+
      '<div class="paper-draft-bar"><span class="paper-count" data-count="reviewer"></span>'+btn('이 리뷰어 답변 모아 복사','copy-reviewer','quiet')+'</div>';
    updateCounts();
  }
  function renderReview(){
    const p=current.data;$('#paper-editor-body').innerHTML='<div class="paper-review-body"><div><div class="paper-review-tabs" role="tablist" aria-label="리뷰 메모 항목">'+Object.entries(sectionNames).map(([k,n])=>'<button role="tab" aria-selected="'+(section===k)+'" class="'+(section===k?'active':'')+'" data-section="'+k+'">'+n+'</button>').join('')+'</div><div class="paper-note-section">'+field(sectionNames[section]+' 메모','sections.'+section,p.sections[section],{summary:'논문이 무엇을 제안하는지 편하게 적으세요.',strength:'좋았던 점과 그 이유를 적으세요.',weakness:'부족한 점, 근거와 저자에게 물어볼 내용을 적으세요.',etc:'기타 의견이나 확인할 내용을 적으세요.'}[section])+'</div><p class="paper-subtle">어떤 문체나 짧은 메모로 작성해도 괜찮습니다.<br>네 가지 항목(Summary, Strength, Weakness, ETC)을 함께 읽어 영문 리뷰로 정리합니다.</p></div><div><div class="paper-draft-bar"><h2>영문 리뷰</h2><div class="paper-actions">'+btn('리뷰 복사','copy-draft')+btn('전체 리뷰 작성','review','primary')+'</div></div><textarea class="draft" aria-label="영문 논문 리뷰" data-field="reviewDraft" placeholder="Summary, Strength, Weakness, ETC 메모와 논문 PDF를 참고해 작성합니다.">'+esc(p.reviewDraft)+'</textarea><p class="paper-count" data-count="review"></p></div></div>';updateCounts();
  }
  function updateCounts(){if(!current)return;const p=current.data;const count=(sel,value,limit)=>{const n=$(sel);if(n){const len=Array.from(value||'').length;n.textContent=len.toLocaleString()+'자'+(limit?' / '+limit.toLocaleString()+'자':'');n.classList.toggle('over',!!limit&&len>limit);}};count('[data-count="issue"]',activeIssue()?.draft,0);count('[data-count="reviewer"]',activeReviewer()?.issues.map(i=>i.draft).filter(Boolean).join('\n\n'),p.charLimit);count('[data-count="review"]',p.reviewDraft,p.charLimit);}
  async function save(){
    if(pendingSave){await pendingSave;return save();}
    if(!current||!dirty)return;
    if(saveConflict)throw Error('다른 기기에서 먼저 저장했습니다. 현재 내용을 MD로 내보낸 뒤 새로 불러와 주세요.');
    clearTimeout(saveTimer);clearTimeout(maxSaveTimer);maxSaveTimer=null;
    const target=current;
    pendingSave=(async()=>{while(current===target&&dirty){
      const snapshot=clone(target.data);saveState('저장 중…');
      const r=await api('/api/paper/project','PUT',{project:snapshot,expectedRevision:target.revision});
      target.revision=r.project.revision;target.updated_at=r.project.updated_at;
      data.projects=[r.project,...data.projects.filter(x=>x.id!==target.id)];
      dirty=JSON.stringify(snapshot)!==JSON.stringify(target.data);
      saveState(dirty?'자동 저장 중…':preview?'이 화면에 저장됨':'자동 저장됨');
    }})();
    try{await pendingSave;}catch(error){if(error.status===409)saveConflict=true;saveState(saveConflict?'다른 기기에서 변경됨 — MD 내보내기 후 새로고침':'저장 실패 — 연결을 확인해 주세요',true);throw error;}finally{pendingSave=null;}
  }
  async function generateDraft(action){
    if(preview)throw Error('미리보기에서는 모델을 호출하지 않습니다. 배포 후 API 키를 연결하면 실행됩니다.');
    if(!data.settings.keys[data.settings.provider]?.configured)throw Error('모델 및 프롬프트 설정에서 API 키를 먼저 등록해 주세요.');
    const i=activeIssue(),existing=action==='review'?current.data.reviewDraft:action==='translate'?i?.translation:i?.draft;
    if(existing&&!confirm('기존 내용 대신 새 결과를 적용할까요? 기존 영문 초안은 생성 이력에 보관합니다.'))return;
    notice(action==='translate'?'리뷰 원문을 번역하고 있습니다.':'선택한 모델이 초안을 작성하고 있습니다.');
    await save();const revision=current.revision,stamp=JSON.stringify(current.data);
    const result=await api('/api/paper/generate','POST',{projectId:current.id,action,reviewerId,issueId,includePdf});
    if(result.sourceRevision!==revision||JSON.stringify(current.data)!==stamp){await copyText(result.text);throw Error('생성 중 내용이 변경되어 결과를 클립보드에 보관했습니다.');}
    if(existing&&action!=='translate')current.data.history.push({id:id(),at:new Date().toISOString(),action:'이전 초안',provider:data.settings.provider,model:data.settings.models[data.settings.provider],text:existing});
    if(action==='review')current.data.reviewDraft=result.text;else if(action==='translate')i.translation=result.text;else i.draft=result.text;
    current.data.history.push({id:id(),at:new Date().toISOString(),action,provider:result.provider,model:result.model,text:result.text});current.data.history=current.data.history.slice(-40);mark();renderEditor();await save();notice('결과를 저장했습니다. 근거와 표현을 확인해 주세요.');
  }
  function exportMarkdown(){
    const p=current.data;const lines=['# '+p.title,'','- 작업: '+types[p.type],'- 학회: '+p.venue,'- 마감: '+p.deadline,'',p.context?'## 공통 지침\n'+p.context:''];
    if(p.type==='review'){for(const [k,n]of Object.entries(sectionNames))lines.push('## '+n+' 메모',p.sections[k],'');lines.push('## 영문 리뷰',p.reviewDraft);}
    else for(const r of p.reviewers){lines.push('## '+r.name,'');for(const i of r.issues)lines.push('### '+(i.title||i.kind),'- 종류: '+i.kind,'- 완료: '+(i.done?'예':'아니오'),'','#### 원문',i.original,'','#### 번역',i.translation,'','#### 대응 메모',i.notes,'','#### 실험 결과와 근거',i.evidence,'','#### 영문 답변',i.draft,'');}
    const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=p.title.replace(/[\\/:*?"<>|]/g,'_').slice(0,100)+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function copyText(value){try{await navigator.clipboard.writeText(value||'');notice('클립보드에 복사했습니다.');}catch{dialog.innerHTML='<h2 id="paper-dialog-title">텍스트 복사</h2><p class="paper-subtle">아래 내용을 선택해 복사해 주세요.</p><textarea aria-label="복사할 텍스트" readonly>'+esc(value)+'</textarea><div class="paper-actions">'+btn('닫기','close-dialog')+'</div>';showDialog();dialog.querySelector('textarea').select();}}
  async function openSettings(){await save();window.location.assign('/settings?returnTo='+encodeURIComponent(location.pathname+location.search+location.hash)+'#llm');}
  async function uploadFile(file){
    validatePdf(file);
    if(preview)throw Error('미리보기에서는 PDF를 저장하지 않습니다.');
    await save();
    const ticket=await api('/api/paper/file/upload','POST',{projectId:current.id,name:file.name,size:file.size});let r;
    if(ticket.local){const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(file);});r=await api('/api/paper/file','POST',{projectId:current.id,name:file.name,base64});}
    else{const uploaded=await fetch(ticket.uploadUrl,{method:'PUT',credentials:'omit',headers:{'Content-Type':'application/pdf','x-upsert':'false'},body:file});if(!uploaded.ok)throw Error('PDF 업로드에 실패했습니다. 5 MB 이하인지 확인하고 다시 첨부해 주세요.');r=await api('/api/paper/file/complete','POST',{projectId:current.id,name:file.name,path:ticket.path});}
    current.data.pdf=r.pdf;mark();await save();renderEditor();notice('PDF를 첨부했습니다.');
  }
  function validatePdf(file){if(!file.size)throw Error('비어 있는 파일은 첨부할 수 없습니다.');if(file.size>5000000)throw Error('PDF는 5 MB까지 첨부할 수 있습니다.');if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name))throw Error('PDF 파일을 선택해 주세요.');}
  app.addEventListener('input',e=>{
    const n=e.target;if(busy)return;
    if(n.id==='paper-search'){query=n.value;renderRows();return;}
    if(!current)return;
    if(n.dataset.field){const [parent,key]=n.dataset.field.split('.');if(parent==='issue')activeIssue()[key]=n.value;else if(parent==='sections')current.data.sections[key]=n.value;else current.data[parent]=n.value;mark();}
    if(n.dataset.issueField){activeIssue()[n.dataset.issueField]=n.type==='checkbox'?n.checked:n.value;mark();if(n.dataset.issueField==='title'||n.dataset.issueField==='done')renderOutline();}
  });
  app.addEventListener('change',e=>{if(busy)return;if(e.target.matches('[data-project-status]')&&current){current.data.status=e.target.value;const label=$('.paper-project-heading .paper-eyebrow');if(label)label.textContent=types[current.data.type]+' / '+statuses[current.data.status];mark();return;}if(e.target.id==='paper-include-pdf')includePdf=e.target.checked;if(e.target.id==='paper-file'&&e.target.files[0])run(()=>uploadFile(e.target.files[0]));});
  app.addEventListener('keydown',e=>{const row=e.target.closest('[data-open]');if(row&&['Enter',' '].includes(e.key)){e.preventDefault();run(()=>openProject(row.dataset.open),row);}});
  document.addEventListener('click',async e=>{
    const n=e.target.closest('[data-action],[data-open],[data-filter],[data-issue],[data-section]');if(!n||!app.contains(n)&&!dialog.contains(n))return;
    if(busy){e.preventDefault();return;}
    if(n.dataset.open){await run(()=>openProject(n.dataset.open),n);return;}
    if(n.dataset.filter){filter=n.dataset.filter;renderList();return;}
    if(n.dataset.issue){reviewerId=n.dataset.reviewer;issueId=n.dataset.issue;renderOutline();renderIssue();return;}
    if(n.dataset.section){section=n.dataset.section;renderReview();return;}
    const a=n.dataset.action;if(!a)return;e.preventDefault();
    if(a==='close-dialog'){dialog.close();return;}
    await run(async()=>{
      if(a==='new-rebuttal'||a==='new-review'){newProject(a==='new-review'?'review':'rebuttal');return;}
      if(a==='choose-rebuttal'||a==='choose-review'){workspace=a==='choose-rebuttal'?'rebuttal':'review';query='';filter='all';route('list');renderList();return;}
      if(a==='back-paper'){await save();route('landing');renderLanding();return;}
      if(a==='back'){await save();route('list');current=null;renderList();return;}
      if(a==='edit-meta'){showProjectDialog(current.data);return;}
      if(a==='save'){await save();notice(preview?'편집 내용을 이 화면에 저장했습니다.':'저장했습니다.');return;}
      if(a==='export'){exportMarkdown();return;}
      if(a==='add-reviewer'){const i={id:id(),kind:'Weakness',title:'',original:'',translation:'',notes:'',evidence:'',draft:'',done:false};const r={id:id(),name:'Reviewer '+(current.data.reviewers.length+1),issues:[i]};current.data.reviewers.push(r);reviewerId=r.id;issueId=i.id;mark();renderEditor();return;}
      if(a==='rename-reviewer'){const r=current.data.reviewers.find(r=>r.id===n.dataset.reviewer);const name=prompt('리뷰어 이름 또는 ID',r.name);if(name?.trim()){r.name=name.trim().slice(0,120);mark();renderEditor();}return;}
      if(a==='delete-reviewer'){if(!confirm('이 리뷰어와 모든 쟁점을 삭제할까요?'))return;current.data.reviewers=current.data.reviewers.filter(r=>r.id!==n.dataset.reviewer);reviewerId=current.data.reviewers[0]?.id;issueId=current.data.reviewers[0]?.issues[0]?.id;mark();renderEditor();return;}
      if(a==='add-issue'){const r=current.data.reviewers.find(r=>r.id===n.dataset.reviewer);const i={id:id(),kind:'Weakness',title:'',original:'',translation:'',notes:'',evidence:'',draft:'',done:false};r.issues.push(i);reviewerId=r.id;issueId=i.id;mark();renderEditor();return;}
      if(a==='delete-issue'){if(!confirm('이 쟁점을 삭제할까요?'))return;const r=activeReviewer();r.issues=r.issues.filter(i=>i.id!==issueId);issueId=r.issues[0]?.id;mark();renderEditor();return;}
      if(['translate','rebuttal','review'].includes(a)){await generateDraft(a);return;}
      if(a==='copy-draft'){await copyText(current.data.type==='review'?current.data.reviewDraft:activeIssue()?.draft);return;}
      if(a==='copy-reviewer'){await copyText(activeReviewer().issues.map(i=>i.draft).filter(Boolean).join('\n\n'));return;}
      if(a==='copy-history'){await copyText(current.data.history.find(h=>h.id===n.dataset.history).text);return;}
      if(a==='detach'){if(!confirm('이 작업에서 PDF 첨부를 해제할까요?'))return;current.data.pdf=null;mark();await save();renderEditor();return;}
      if(a==='preview-file'){notice('미리보기용 가상 PDF입니다.');return;}
      if(a==='delete-project'){if(!confirm('이 논문의 메모와 초안을 모두 삭제할까요? 되돌릴 수 없습니다.'))return;await save();clearTimeout(saveTimer);clearTimeout(maxSaveTimer);await api('/api/paper/project/delete','POST',{id:current.id,expectedRevision:current.revision});data.projects=data.projects.filter(x=>x.id!==current.id);route('list',null,true);current=null;dirty=false;renderList();return;}
      if(a==='retry'){await init();return;}
    },n);
  });
  async function run(fn,button){
    // Navigation is synchronous; do not mark it busy until its event work begins.
    try{const result=fn();if(result&&typeof result.then==='function'){busy=true;if(button)button.disabled=true;app.setAttribute('aria-busy','true');for(const node of app.querySelectorAll('textarea,input,select'))node.readOnly=true;await result;}}
    catch(e){notice(e.message||'작업을 완료하지 못했습니다.',true);}
    finally{busy=false;if(button)button.disabled=false;app.setAttribute('aria-busy','false');for(const node of app.querySelectorAll('textarea,input,select'))node.readOnly=false;}
  }
  function route(kind,projectId=null,replace=false){const hash=kind==='landing'?'':kind==='editor'?'#'+workspace+'/'+projectId:'#'+workspace;const url=location.pathname+location.search+hash;if(url!==location.pathname+location.search+location.hash)history[replace?'replaceState':'pushState']({paper:true},'',url);window.AtlasTheme?.refresh();}
  async function restoreRoute(){const [type,projectId]=location.hash.slice(1).split('/');if(!['review','rebuttal'].includes(type)){renderLanding();return;}workspace=type;if(projectId&&data.projects.some(p=>p.id===projectId&&p.data.type===type)){await openProject(projectId,true);}else{current=null;renderList();}}
  window.addEventListener('popstate',async()=>{if(routeBusy)return;routeBusy=true;try{if(busy)throw Error('진행 중인 작업을 마친 뒤 이동해 주세요.');await save();await restoreRoute();}catch(e){if(current){workspace=current.data.type;route('editor',current.id,true);}notice(e.message,true);}finally{routeBusy=false;}});
  // Header back and settings links save first; the editor always returns to its own contents list.
  document.addEventListener('click',async e=>{const link=e.target.closest('a[href]');if(!link||e.defaultPrevented||!current||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname==='/api/paper/file')return;if(link.hasAttribute('data-paper-back')){e.preventDefault();if(busy)return;try{await save();route('list');current=null;renderList();}catch(error){notice(error.message,true);}return;}if(link.hasAttribute('data-global-settings')){e.preventDefault();if(!busy)try{await openSettings();}catch(error){notice(error.message,true);}return;}e.preventDefault();if(!busy)try{await save();location.assign(link.href);}catch(error){notice(error.message,true);}});
  document.addEventListener('submit',e=>{if(current&&dirty&&e.target.action?.includes('/api/auth/logout')){e.preventDefault();save().then(()=>e.target.submit()).catch(error=>notice(error.message,true));}});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();if(!busy)run(()=>save().then(()=>notice('저장했습니다.')));}});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')backgroundSave();});
  window.addEventListener('pagehide',backgroundSave);
  window.addEventListener('online',backgroundSave);
  window.addEventListener('focus',()=>{if(dirty)backgroundSave();else if(!busy&&current&&!pendingSave&&!saveConflict){const target=current;api('/api/paper').then(fresh=>{if(current!==target||dirty||pendingSave)return;fresh.projects.forEach(r=>normalizeStatus(r.data));const latest=fresh.projects.find(p=>p.id===target.id);data=fresh;if(latest&&latest.revision!==target.revision){current=clone(latest);renderEditor();notice('다른 기기에서 저장한 내용을 불러왔습니다.');}}).catch(()=>{});}});
  window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
  async function init(){try{data=await api('/api/paper');data.projects.forEach(r=>normalizeStatus(r.data));await restoreRoute();}catch(e){app.innerHTML='<div class="paper-empty"><h1>Paper</h1><p>'+esc(e.message)+'</p>'+btn('다시 불러오기','retry')+'</div>';app.setAttribute('aria-busy','false');}}
  init();
})();

