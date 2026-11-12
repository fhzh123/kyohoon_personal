/* Data is fetched after server authorization; no research content is bundled here. */
(async () => {
  'use strict';
  const notice = document.querySelector('#integration-notice');
  try {
    window.ResearchLoading?.stage('저장된 연구 계획을 확인하고 있습니다.');
    const initial = document.querySelector('#work-initial-data');
    let value;
    if (initial) { value = JSON.parse(initial.textContent); initial.remove(); }
    else {
      const response = await fetch('/api/work-bootstrap', { credentials: 'same-origin', cache: 'no-store', signal:AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? '업무 접근 권한을 확인해 주세요. 업무 홈에서 다시 로그인할 수 있습니다.' : '업무 자료를 불러오지 못했습니다.');
      value = await response.json();
    }
    if (!value.workspace?.state || !value.taxonomySource || !value.legacySeed || !value.context?.storageKey) throw new Error('연결된 업무 데이터 형식을 확인해 주세요.');
    window.RESEARCH_SEED = value.workspace.state;
    window.RESEARCH_TAXONOMY_SOURCE = value.taxonomySource;
    window.RESEARCH_LEGACY_SEED = value.legacySeed;
    window.WORK_CONTEXT = value.context;
    window.WORK_INITIAL_ENVELOPE = value.workspace;
    notice.textContent = value.context.mode === 'local'
      ? 'localhost 전용 · 로컬 원본 사본 — 연구일지의 변경은 이 프로젝트의 사본에만 저장됩니다.'
      : 'Supabase 연결 · 허용 사용자 연구일지';
    if (value.context.role === 'reader') {
      notice.textContent += ' 읽기 전용 계정입니다. 검색·탐색·상세 읽기만 사용할 수 있습니다.';
      installReadOnly();
    }
    window.ResearchLoading?.stage('기술과 세부 연구를 로드맵에 배치하고 있습니다.');
    if (window.startResearchAtlas) window.startResearchAtlas();
    else for (const name of ['papers.js', 'taxonomy.js', 'notebook.js', 'periods.js', 'hierarchy.js', 'timeline.js', 'workspace-sync.js', 'app.js']) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '/work/app/' + name;
        script.onload = resolve;
        script.onerror = () => reject(new Error('업무 화면 코드를 불러오지 못했습니다.'));
        document.body.append(script);
      });
    }
    if (!window.ResearchAtlas) throw new Error('연구 화면을 준비하지 못했습니다. 다시 시도해 주세요.');
    window.ResearchLoading?.done();
  } catch (error) {
    notice.textContent = error.name === 'TimeoutError' ? '연결 시간이 길어지고 있습니다. 다시 시도해 주세요.' : error.message || '업무 연결에 실패했습니다.';
    notice.classList.add('is-error');
    window.ResearchLoading?.fail(notice.textContent);
  }

  function installReadOnly() {
    const fieldsAllowed = '#global-search,#goal-filter,#category-filter,#status-filter,[data-note-search]';
    const mutations = '#add-task,#editor-add-child,#fit-children-range,#task-delete,#task-duplicate,#reset-colors,#import-json,#import-confirm,#restore-recovery,#restore-old-version,#sync-use-local,#visibility-apply,[data-paper-add],[data-paper-remove],[data-paper-clear-figure],[data-add-child],[data-add-month],[data-add-goal],[data-add-phase],[data-delete-goal],[data-delete-phase],[data-new-note],[data-new-paper],[data-delete-note],[data-place],[data-complete],[data-reorder-task],.timeline-cell';
    const deny = event => { event.preventDefault(); event.stopImmediatePropagation(); };
    const apply = () => {
      document.body.dataset.access = 'reader';
      for (const field of document.querySelectorAll('input,textarea,select')) {
        if (field.matches(fieldsAllowed)) continue;
        if (field.tagName === 'TEXTAREA' || (field.tagName === 'INPUT' && ['text','url','search','number','date'].includes(field.type))) field.readOnly = true;
        else field.disabled = true;
        field.setAttribute('aria-readonly','true');
      }
      for (const button of document.querySelectorAll(mutations + ',button[type=submit]')) {
        if (button.closest('#work-logout')) continue;
        button.disabled = true;
        button.setAttribute('aria-disabled','true');
        button.title = '읽기 전용 계정에서는 변경할 수 없습니다.';
      }
      for (const button of document.querySelectorAll('[data-edit-goal],[data-edit-phase]')) {
        if (button.textContent !== '상세 보기') button.textContent = '상세 보기';
        button.setAttribute('aria-label','상세 보기 · 읽기 전용');
      }
      for (const status of document.querySelectorAll('#annual-save-status,#task-save-status,#color-settings-status,[data-save-status]')) {
        if (status.textContent !== '읽기 전용 · 저장 권한 없음') status.textContent = '읽기 전용 · 저장 권한 없음';
      }
      const title = document.querySelector('#task-dialog-title');
      if (title && title.textContent !== '연구 상세 · 읽기 전용') title.textContent = '연구 상세 · 읽기 전용';
    };
    for (const type of ['input','change']) document.addEventListener(type, event => {
      if (event.target.matches('input,textarea,select') && !event.target.matches(fieldsAllowed)) deny(event);
    }, true);
    document.addEventListener('submit', event => { if (event.target.id !== 'work-logout') deny(event); }, true);
    document.addEventListener('click', event => { if (event.target.closest(mutations)) deny(event); }, true);
    document.addEventListener('pointerdown', event => {
      if (event.target.closest('.timeline-lane,[data-reorder-task],[data-open-task]')) deny(event);
    }, true);
    new MutationObserver(apply).observe(document.body, {childList:true,subtree:true});
    apply();
  }
})();
