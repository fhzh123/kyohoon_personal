(function () {
  'use strict';
  let context = null;
  let selectedNote = '';
  let noteKind = 'all';
  let noteQuery = '';
  let requestedNote = '';
  const e = value => context.api.escape(String(value == null ? '' : value));
  const list = name => Array.isArray(context.api.state[name]) ? context.api.state[name] : [];
  const goalName = id => (list('goals').find(goal => goal.id === id) || {}).title || '목표 미연결';
  const label = (map, key) => map && map[key] || key || '미정';
  const empty = text => '<div class="empty-page"><strong>' + e(text) + '</strong></div>';
  const timestamp = value => {
    if (!value || Number.isNaN(new Date(value).getTime())) return '아직 수정하지 않음';
    return new Date(value).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  function webUrl(value) {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) return '';
    try { const url = new URL(value.trim()); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; }
  }
  function imageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    value = value.trim();
    if (webUrl(value)) return webUrl(value);
    // Source assets may be relative to the buildless local page. Never execute a scheme.
    if (/^[a-z][a-z\d+.-]*:/i.test(value) || /^[\\/]{2}/.test(value) || /[\u0000-\u001f\\]/.test(value)) return '';
    return value;
  }
  function persist(message) {
    try {
      const saved = context.api.save();
      if (saved === false) return false;
      if (message) context.api.toast(message);
      return true;
    } catch (_) { context.api.toast('저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.'); return false; }
    finally { if (context.api.updateStats) context.api.updateStats(); }
  }
  function rerender() { render(context.view, context.host, context.api); }
  function refresh() { if (context.api.refresh) context.api.refresh(); else rerender(); }
  function goalOptions(selected) {
    return '<option value="">목표 미연결</option>' + list('goals').map(goal => '<option value="' + e(goal.id) + '"' + (goal.id === selected ? ' selected' : '') + '>' + e(goal.title || '제목 없는 목표') + '</option>').join('');
  }
  function dialog(title, body, footer) {
    const node = document.createElement('dialog');
    node.className = 'modal';
    node.setAttribute('aria-label', title);
    node.style.cssText = 'border:0;padding:0;margin:auto;max-width:min(900px,calc(100vw - 32px))';
    node.innerHTML = '<div class="modal-header"><h2>' + e(title) + '</h2><button type="button" class="icon-button" data-close aria-label="닫기">✕</button></div><div class="modal-body">' + body + '</div>' + (footer ? '<div class="modal-footer">' + footer + '</div>' : '');
    document.body.appendChild(node);
    node.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => node.close()));
    node.addEventListener('close', () => node.remove());
    node.addEventListener('click', event => { if (event.target === node) { const bounds = node.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) node.close(); } });
    node.showModal();
    return node;
  }
  function editGoal(id) {
    if(context.api.readOnly)return;
    const goal = list('goals').find(item => item.id === id);
    const node = dialog(goal ? 'L3 연구축 수정' : 'L3 연구축 추가', '<form id="goal-form" class="form-grid"><div class="form-field field-full"><label for="goal-title">L3 연구축 이름</label><input id="goal-title" name="title" '+(goal&&goal.assetId?'readonly ':'')+'required maxlength="300" value="' + e(goal ? goal.title : '') + '"></div><div class="form-field field-full"><label for="goal-description">목표 설명</label><textarea id="goal-description" name="description">' + e(goal ? goal.description : '') + '</textarea></div><div class="form-field field-full"><label for="goal-metric">성공 기준 · 평가 지표</label><textarea id="goal-metric" name="metric" placeholder="확인할 지표와 성공 기준을 적어 주세요">' + e(goal ? goal.metric : '') + '</textarea></div></form>', '<button class="secondary-button" data-close type="button">취소</button><button class="primary-button" type="submit" form="goal-form">목표 저장</button>');
    node.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const title = form.elements.title.value.trim();
      if (!title) { form.elements.title.setCustomValidity('목표 이름을 입력하세요.'); form.elements.title.reportValidity(); return; }
      const fields = { title, description: form.elements.description.value, metric: form.elements.metric.value };
      if (goal) Object.assign(goal, fields);
      else context.api.state.goals.push(Object.assign({ id: context.api.uid('goal'), color: '#486b87' }, fields));
      persist('목표를 저장했습니다.'); node.close(); refresh();
    });
    node.querySelector('[name=title]').addEventListener('input', event => event.target.setCustomValidity(''));
  }
  function removeGoal(id) {
    if(context.api.readOnly)return;
    const goal=list('goals').find(item=>item.id===id);if(!goal)return;
    const linked=new Set(list('tasks').filter(t=>t.goalId===id).map(t=>t.id));
    for(const taskId of [...linked])context.api.hierarchy.descendantsOf(list('tasks'),taskId).forEach(t=>linked.add(t.id));
    const node=dialog('L3 연구축 삭제', '<p><strong>'+e(goal.title)+'</strong> 연구축을 삭제합니다.</p><p class="field-help">연결된 연구 '+linked.size+'개, 노트 '+list('notes').filter(n=>n.goalId===id).length+'개</p><div class="goal-delete-options"><label><input type="radio" name="delete-scope" value="all" checked> 하위 L4와 L5 연구도 함께 삭제</label><label><input type="radio" name="delete-scope" value="axis"> L3만 삭제하고 연구는 미연결 상태로 보관</label></div><p class="field-help">노트와 연구 단계는 보관하며 L3 연결만 해제합니다. 백업 메뉴에서 직전 삭제를 되돌릴 수 있습니다.</p>', '<button type="button" class="secondary-button" data-close>취소</button><button type="button" class="danger-button" data-confirm-delete-goal>삭제</button>');
    node.querySelector('[data-confirm-delete-goal]').onclick=()=>{
      const before=JSON.parse(JSON.stringify(context.api.state));
      context.api.rememberRecovery?.();
      const state=context.api.state, cascade=node.querySelector('[name="delete-scope"]:checked').value==='all';
      state.goals=list('goals').filter(g=>g.id!==id);
      state.deletedGoalIds=[...new Set([...(state.deletedGoalIds||[]),id])];
      if(cascade){
        state.deletedTaskIds=[...new Set([...(state.deletedTaskIds||[]),...linked])];
        state.tasks=list('tasks').filter(t=>!linked.has(t.id));
        state.tasks.forEach(t=>{t.dependencies=(t.dependencies||[]).filter(dep=>!linked.has(dep));});
      }
      ['tasks','phases','notes'].forEach(name=>list(name).forEach(item=>{
        if(item.goalId===id||item.l3Id===id){item.goalId='';for(const key of ['l3Id','l2Id','assetId','linkedAssetId','officialTitle','sourceCell'])delete item[key];}
      }));
      if(!persist()){
        Object.keys(state).forEach(key=>delete state[key]);Object.assign(state,before);
        context.api.toast('저장하지 못해 삭제를 취소했습니다.');node.close();refresh();return;
      }
      node.close();refresh();context.api.toast('L3 연구축을 삭제했습니다.');
    };
  }
  function editPhase(id) {
    if(context.api.readOnly)return;
    const phase = list('phases').find(item => item.id === id);
    const node = dialog(phase ? '연구 단계 수정' : '연구 단계 추가', '<form id="phase-form" class="form-grid"><div class="form-field field-full"><label for="phase-title">단계 이름</label><input id="phase-title" name="title" required maxlength="300" value="' + e(phase ? phase.title : '') + '"></div><div class="form-field field-full"><label for="phase-description">단계 설명</label><textarea id="phase-description" name="description">' + e(phase ? phase.description : '') + '</textarea></div><div class="form-field field-full"><label for="phase-goal">연결 목표</label><select id="phase-goal" name="goalId">' + goalOptions(phase ? phase.goalId : '') + '</select><span class="field-help">과업 상세창에서 이 단계를 연결할 수 있습니다. 단계의 목표를 바꾸어도 기존 과업의 목표는 유지됩니다.</span></div></form>', '<button class="secondary-button" data-close type="button">취소</button><button class="primary-button" type="submit" form="phase-form">단계 저장</button>');
    node.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      const form = event.currentTarget;
      const title = form.elements.title.value.trim();
      if (!title) { form.elements.title.setCustomValidity('단계 이름을 입력하세요.'); form.elements.title.reportValidity(); return; }
      const fields = { title, description: form.elements.description.value, goalId: form.elements.goalId.value };
      if (phase) Object.assign(phase, fields);
      else context.api.state.phases.push(Object.assign({ id: context.api.uid('phase') }, fields));
      persist('연구 단계를 저장했습니다.'); node.close(); refresh();
    });
    node.querySelector('[name=title]').addEventListener('input', event => event.target.setCustomValidity(''));
  }
  function removePhase(id) {
    if(context.api.readOnly)return;
    const phase = list('phases').find(item => item.id === id);
    if (!phase || !window.confirm('“' + (phase.title || '제목 없는 단계') + '” 단계를 삭제할까요? 연결된 과업은 유지되며 단계 연결만 해제됩니다. 과업의 목표 연결은 유지됩니다.')) return;
    if (context.api.rememberRecovery) context.api.rememberRecovery();
    context.api.state.phases = list('phases').filter(item => item.id !== id);
    list('tasks').forEach(task => { if (task.phaseId === id) task.phaseId = ''; });
    persist('연구 단계를 삭제했습니다.'); refresh();
  }
  function measuredTasks(items) {
    const hierarchy=context.api.hierarchy||window.ResearchHierarchy;
    if(!hierarchy)return items;
    const all=list('tasks'),measured=new Map();
    for(const item of items){const descendants=hierarchy.descendantsOf(all,item.id);for(const leaf of descendants.length?hierarchy.leafTasks(descendants):[item])measured.set(leaf.id,leaf);}
    return [...measured.values()];
  }
  const actionIcon = name => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(name==='edit'?'<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>':'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>')+'</svg>';
  function renderGoals() {
    const goals = list('goals');
    const tasks = list('tasks');
    context.host.innerHTML = '<div class="board-toolbar"><div><h2>L3 연구축 · L4 기술</h2><p>기술자산 맵의 주황색 L3와 하위 L4입니다. 각 기술의 세부 연구와 성공 기준을 정리하세요.</p></div><button class="primary-button" data-add-goal>+ 사용자 연구축</button></div>' + (goals.length ? '<div class="card-grid">' + goals.map(goal => {
      const linked = tasks.filter(task => task.goalId === goal.id);
      const measured = measuredTasks(linked);
      const done = measured.filter(task => task.status === 'done').length;
      const progress = measured.length ? Math.round(done / measured.length * 100) : 0;
      return '<article class="goal-card"><div class="goal-header"><h3><span class="badge">'+(goal.assetId?'L3':'사용자 연구축')+'</span> ' + e(goal.title || '제목 없는 목표') + '</h3><div class="button-row card-actions">'+(context.api.readOnly?'':'<button type="button" class="icon-button card-action" data-edit-goal="' + e(goal.id) + '" aria-label="' + e(goal.title) + ' 수정" title="연구축 수정">'+actionIcon('edit')+'</button><button type="button" class="icon-button card-action is-danger" data-delete-goal="' + e(goal.id) + '" aria-label="' + e(goal.title) + ' 삭제" title="연구축 삭제">'+actionIcon('delete')+'</button>')+'</div></div><p>' + e(goal.description || '목표 설명을 추가해 주세요.') + '</p><div class="goal-metric">' + progress + '<small>% 완료</small></div><div class="progress-label"><span>진행 집계 ' + measured.length + '개</span><span>' + done + '개 완료</span></div><div class="progress-track" role="progressbar" aria-label="' + e(goal.title) + ' 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '"><div class="progress-fill" style="width:' + progress + '%"></div></div><p><strong>성공 기준</strong><br>' + e(goal.metric || '성공 기준 미정') + '</p>' + (linked.length ? '<details class="taxonomy-linked-tasks"><summary>L4 기술 '+linked.filter(t=>!t.parentId).length+'개 · 세부 연구 '+linked.filter(t=>t.parentId).length+'개</summary><div class="button-row" style="margin-top:14px">' + linked.map(task => '<button class="text-button" data-task="' + e(task.id) + '">' + (task.parentId ? '↳ ' : '') + e(task.title) + ' · ' + e(label(context.api.statusLabels, task.status)) + '</button>').join('') + '</div></details>' : '') + '</article>';
    }).join('') + '</div>' : empty('목표를 추가해 연구 방향을 정리하세요.')) + '<div class="board-toolbar" style="margin-top:32px"><div><h2>연구 단계 · 로드맵</h2><p>단계를 추가·수정하고, 연결 과업을 열어 일정과 진행 상황을 관리하세요.</p></div><button class="primary-button" data-add-phase>+ 단계 추가</button></div><div class="phase-list">' + list('phases').map((phase, index) => {
      const linked = tasks.filter(task => task.phaseId === phase.id);
      const measured = measuredTasks(linked);
      const done = measured.filter(task => task.status === 'done').length;
      return '<article class="phase-card"><span class="badge">' + String(index + 1).padStart(2, '0') + '</span><div><div class="goal-header" style="margin-bottom:0"><h3 style="min-width:0;overflow-wrap:anywhere">' + e(phase.title) + '</h3><div class="button-row" style="flex-shrink:0"><button type="button" class="text-button" data-edit-phase="' + e(phase.id) + '" aria-label="' + e(phase.title) + ' 단계 수정">' + actionIcon('edit') + '</button><button type="button" class="text-button" data-delete-phase="' + e(phase.id) + '" aria-label="' + e(phase.title) + ' 단계 삭제" title="단계 삭제">' + actionIcon('delete') + '</button></div></div><p>' + e(phase.description) + '</p><p>' + e(goalName(phase.goalId)) + ' · ' + done + '/' + measured.length + '개 완료</p><div class="button-row" style="margin-top:10px">' + (linked.map(task => '<button class="secondary-button" data-task="' + e(task.id) + '">' + (task.parentId ? '↳ ' : '') + e(task.title) + ' · ' + e(label(context.api.statusLabels, task.status)) + '</button>').join('') || '<span class="field-help">연결된 과업이 없습니다.</span>') + '</div></div></article>';
    }).join('') + '</div>';
    context.host.querySelector('[data-add-goal]').addEventListener('click', () => editGoal());
    context.host.querySelector('[data-add-phase]').addEventListener('click', () => editPhase());
    context.host.querySelectorAll('[data-edit-phase]').forEach(button => button.addEventListener('click', () => editPhase(button.dataset.editPhase)));
    context.host.querySelectorAll('[data-delete-phase]').forEach(button => button.addEventListener('click', () => removePhase(button.dataset.deletePhase)));
    context.host.querySelectorAll('[data-edit-goal]').forEach(button => button.addEventListener('click', () => editGoal(button.dataset.editGoal)));
    context.host.querySelectorAll('[data-delete-goal]').forEach(button => button.addEventListener('click', () => removeGoal(button.dataset.deleteGoal)));
    context.host.querySelectorAll('[data-task]').forEach(button => button.addEventListener('click', () => context.api.openTask(button.dataset.task)));
  }
  function filteredNotes() {
    const query = noteQuery.trim().toLocaleLowerCase();
    return list('notes').filter(note => (noteKind === 'all' || note.kind === noteKind) && (!query || [note.title, note.body, note.url, goalName(note.goalId), ...(note.papers||[]).flatMap(p=>[p.title,p.venue,p.year,p.summary,p.url])].join(' ').toLocaleLowerCase().includes(query)));
  }
  function noteListMarkup() {
    const notes = filteredNotes();
    return notes.length ? notes.map(note => '<button type="button" class="note-list-item' + (note.id === selectedNote ? ' active' : '') + '" data-note="' + e(note.id) + '" aria-pressed="' + (note.id === selectedNote) + '"><strong>' + e(note.title || '제목 없는 노트') + '</strong><span>' + (note.kind === 'paper' ? '논문' : '연구 노트') + ' · ' + e(goalName(note.goalId)) + '</span><small>' + e(timestamp(note.updatedAt)) + '</small></button>').join('') : '<div class="empty-state">검색 결과가 없습니다.</div>';
  }
  function bindNoteList() {
    context.host.querySelectorAll('[data-note]').forEach(button => button.addEventListener('click', () => { selectedNote = button.dataset.note; renderNoteDocument(); repaintNoteList(); }));
  }
  function repaintNoteList() {
    const host = context.host.querySelector('.note-list');
    if (!host) return;
    host.innerHTML = noteListMarkup(); bindNoteList();
  }
  function createNote(kind) {
    if(context.api.readOnly)return;
    const note = { id: context.api.uid('note'), title: kind === 'paper' ? '새 논문 노트' : '새 연구 노트', kind: kind || 'note', papers: [], url: '', goalId: '', body: '', updatedAt: new Date().toISOString() };
    context.api.state.notes.push(note); selectedNote = note.id; noteQuery = ''; noteKind = 'all';
    persist('노트를 만들었습니다.');
    if (context.view !== 'notes') { requestedNote = note.id; context.api.navigate('notes'); }
    else { renderNotes(); context.host.querySelector('[name=title]').focus(); }
  }
  function removeNote(id) {
    if(context.api.readOnly)return;
    const note = list('notes').find(item => item.id === id);
    if (!note || !window.confirm('“' + (note.title || '제목 없는 노트') + '” 노트를 삭제할까요?')) return;
    if (context.api.rememberRecovery) context.api.rememberRecovery();
    context.api.state.notes = list('notes').filter(item => item.id !== id);
    selectedNote = ''; persist('노트를 삭제했습니다.'); renderNotes();
  }
  function renderNoteDocument() {
    const host = context.host.querySelector('.note-document');
    const note = list('notes').find(item => item.id === selectedNote);
    if (!note) { host.innerHTML = empty('노트를 선택하거나 새로 작성하세요.'); return; }
    const valid = webUrl(note.url);
    host.innerHTML = '<div class="board-toolbar"><div><span class="badge">' + (note.kind === 'paper' ? '논문' : '연구 노트') + '</span></div><button type="button" class="danger-button" data-delete-note aria-label="노트 삭제" title="노트 삭제">' + actionIcon('delete') + '</button></div><form class="form-grid" novalidate><div class="form-field field-full"><label for="note-title">제목</label><input id="note-title" name="title" placeholder="노트 제목" value="' + e(note.title) + '"></div><div class="form-field"><label for="note-kind">구분</label><select id="note-kind" name="kind"><option value="note"' + (note.kind !== 'paper' ? ' selected' : '') + '>연구 노트</option><option value="paper"' + (note.kind === 'paper' ? ' selected' : '') + '>논문</option></select></div><div class="form-field"><label for="note-goal">연결 목표</label><select id="note-goal" name="goalId">' + goalOptions(note.goalId) + '</select></div><div class="form-field field-full"><label for="note-url">참고 URL</label><input type="url" id="note-url" name="url" placeholder="https://" value="' + e(note.url) + '" aria-describedby="note-url-help"><span class="field-help" id="note-url-help"></span><a class="text-button" data-note-link target="_blank" rel="noopener noreferrer"' + (valid ? ' href="' + e(valid) + '"' : ' hidden') + '>참고 링크 열기 ↗</a></div><section class="task-papers note-papers field-full" id="note-papers" aria-label="노트의 관련 논문"></section><div class="form-field field-full"><label for="note-body">연구 내용 · 읽기 메모</label><textarea id="note-body" class="note-textarea" name="body" placeholder="가설, 실험 과정, 논문 요약과 다음 할 일을 자유롭게 기록하세요.">' + e(note.body) + '</textarea></div></form><div class="note-meta" role="status" aria-live="polite" data-save-status>저장됨 · ' + e(timestamp(note.updatedAt)) + '</div>';
    const form = host.querySelector('form');
    form.addEventListener('submit', event => event.preventDefault());
    function validateUrl() {
      const input = form.elements.url;
      const href = webUrl(input.value);
      const invalid = input.value.trim() && !href;
      input.setCustomValidity(invalid ? 'http:// 또는 https:// 주소를 입력하세요.' : '');
      input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      host.querySelector('#note-url-help').textContent = invalid ? 'http:// 또는 https:// 주소를 입력하세요. 현재 입력은 초안으로 저장되며 링크는 열리지 않습니다.' : '입력 내용은 브라우저에 자동 저장됩니다.';
      const link = host.querySelector('[data-note-link]');
      link.hidden = !href;
      if (href) link.href = href; else link.removeAttribute('href');
    }
    function savePapers() {
      note.updatedAt=new Date().toISOString();
      const saved=persist();
      host.querySelector('[data-save-status]').textContent=saved?'자동 저장됨 — '+timestamp(note.updatedAt):'저장하지 못했습니다. 저장 상태를 확인해 주세요.';
    }
    context.api.readOnly && form.querySelectorAll('input,select,textarea').forEach(input=>input.disabled=true);
    window.ResearchPapers.mount(host.querySelector('#note-papers'),note,{readOnly:context.api.readOnly,autosave:true,onChange:savePapers,toast:context.api.toast,uid:context.api.uid});
    function saveInput(event) {
      if(context.api.readOnly)return;
      const field = event.target.name;
      if (!['title', 'kind', 'goalId', 'url', 'body'].includes(field)) return;
      if (note[field] === event.target.value) return;
      note[field] = event.target.value;
      note.updatedAt = new Date().toISOString();
      const saved = persist();
      host.querySelector('[data-save-status]').textContent = saved ? '자동 저장됨 · ' + timestamp(note.updatedAt) : '저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.';
      if (field === 'url') validateUrl();
      if (field === 'kind') host.querySelector('.badge').textContent = note.kind === 'paper' ? '논문' : '연구 노트';
      if (field !== 'body' && field !== 'url') repaintNoteList();
    }
    form.addEventListener('input', saveInput); form.addEventListener('change', saveInput);
    host.querySelector('[data-delete-note]').addEventListener('click', () => removeNote(note.id));
    if(context.api.readOnly)host.querySelector('[data-delete-note]').hidden=true;
    validateUrl();
  }
  function renderNotes() {
    if (requestedNote) { selectedNote = requestedNote; requestedNote = ''; noteKind = 'all'; noteQuery = ''; }
    const notes = filteredNotes();
    if (!notes.some(note => note.id === selectedNote)) selectedNote = notes.length ? notes[0].id : '';
    context.host.innerHTML = '<div class="board-toolbar"><div><h2>연구 노트 · 논문</h2><p>긴 메모도 입력하는 즉시 이 브라우저에 저장됩니다.</p></div><div class="button-row"><button class="secondary-button" data-new-paper>+ 논문 노트</button><button class="primary-button" data-new-note>+ 연구 노트</button></div></div><div class="board-toolbar"><div class="segmented-control button-row" role="group" aria-label="노트 구분">' + [['all','전체'],['note','연구 노트'],['paper','논문']].map(item => '<button type="button" class="' + (noteKind === item[0] ? 'primary-button' : 'secondary-button') + '" data-kind="' + item[0] + '" aria-pressed="' + (noteKind === item[0]) + '">' + item[1] + '</button>').join('') + '</div><div class="form-field"><input type="search" data-note-search aria-label="노트 검색" placeholder="제목·내용·링크 검색" value="' + e(noteQuery) + '"></div></div><div class="note-editor-layout"><nav class="note-list" aria-label="노트 목록">' + noteListMarkup() + '</nav><article class="note-document"></article></div>';
    bindNoteList(); renderNoteDocument();
    context.host.querySelector('[data-new-note]').addEventListener('click', () => createNote('note'));
    context.host.querySelector('[data-new-paper]').addEventListener('click', () => createNote('paper'));
    context.host.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => { noteKind = button.dataset.kind; renderNotes(); }));
    context.host.querySelector('[data-note-search]').addEventListener('input', event => {
      noteQuery = event.target.value;
      const filtered = filteredNotes();
      if (!filtered.some(note => note.id === selectedNote)) { selectedNote = filtered.length ? filtered[0].id : ''; renderNoteDocument(); }
      repaintNoteList();
    });
  }
  function enlargeReference(id) {
    const item = list('references').find(ref => ref.id === id);
    if (!item) return;
    const src = imageUrl(item.src);
    if (!src) { context.api.toast('열 수 없는 이미지 주소입니다.'); return; }
    dialog(item.title || '참고 이미지', '<img src="' + e(src) + '" alt="' + e(item.title) + '" style="width:100%;height:auto;object-fit:contain"><p class="field-help" style="margin-top:14px">' + e(item.description) + '</p>', '<a class="secondary-button" href="' + e(src) + '" target="_blank" rel="noopener noreferrer">원본을 새 탭에서 열기 ↗</a><button class="primary-button" type="button" data-close>닫기</button>');
  }
  function renderReferences() {
    const papers = list('notes').filter(note => note.kind === 'paper');
    context.host.innerHTML = '<div class="board-toolbar"><div><h2>원본 자료</h2><p>이미지를 누르면 확대할 수 있습니다. 원본은 수정하지 않습니다.</p></div></div><div class="reference-grid">' + list('references').map(item => {
      const src = imageUrl(item.src);
      return '<article class="reference-card"><button type="button" class="reference-image" style="width:100%;padding:0" data-reference="' + e(item.id) + '" aria-label="' + e(item.title) + ' 확대">' + (src ? '<img loading="lazy" src="' + e(src) + '" alt="' + e(item.title) + '">' : '<span>이미지를 열 수 없습니다.</span>') + '</button><div><span class="badge">원본 이미지</span><h3>' + e(item.title) + '</h3><p>' + e(item.description) + '</p><button type="button" class="text-button" style="margin-top:12px" data-reference="' + e(item.id) + '">확대해서 보기 ↗</button></div></article>';
    }).join('') + '</div><div class="board-toolbar" style="margin-top:32px"><div><h2>연결된 논문 노트</h2><p>확인한 논문과 메모를 직접 추가해 연구 목표에 연결하세요.</p></div><button type="button" class="primary-button" data-new-paper>+ 논문 노트</button></div>' + (papers.length ? '<div class="card-grid">' + papers.map(note => '<article class="research-card"><span class="badge">논문</span><h3 style="margin-top:10px">' + e(note.title || '제목 없는 논문 노트') + '</h3><p>' + e(goalName(note.goalId)) + '</p><div class="note-body">' + e(note.body || '논문 메모를 작성해 주세요.') + '</div><div class="note-meta"><button class="text-button" data-paper="' + e(note.id) + '">노트 열기 →</button>' + (webUrl(note.url) ? '<a href="' + e(webUrl(note.url)) + '" target="_blank" rel="noopener noreferrer">논문 링크 ↗</a>' : '<span>논문 URL 미정</span>') + '</div></article>').join('') + '</div>' : empty('등록된 논문이 없습니다. 확인한 논문을 추가해 주세요.'));
    context.host.querySelectorAll('[data-reference]').forEach(button => button.addEventListener('click', () => enlargeReference(button.dataset.reference)));
    context.host.querySelector('[data-new-paper]').addEventListener('click', () => createNote('paper'));
    context.host.querySelectorAll('[data-paper]').forEach(button => button.addEventListener('click', () => openNote(button.dataset.paper)));
  }
  function render(view, host, api) {
    context = { view, host, api };
    if (view === 'goals') renderGoals();
    else if (view === 'notes') renderNotes();
    else if (view === 'references') renderReferences();
  }
  function openNote(id) {
    requestedNote = id;
    if (!context) return;
    // The shell may have navigated away since our last render; always route through it.
    context.api.navigate('notes');
  }
  window.ResearchNotebook = { render, openNote };
})();
