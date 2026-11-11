/* Optional same-origin workspace persistence. Local saving stays the app's responsibility. */
(() => {
  'use strict';
  const copy = value => value == null ? null : JSON.parse(JSON.stringify(value));
  const stable = value => JSON.stringify(value, function (key, item) {
    return item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item;
  });
  async function init(options) {
    const {readState, applyState, saveLocal, onStatus = () => {}, onConflict = () => {}} = options;
    let revision = null, ready = false, paused = false, running = false, pending = null, conflict = null, lastSynced;
    let status = {mode:'local', message:'이 브라우저에 자동 저장', revision};
    const report = (mode, message) => { status = {mode, message, revision}; onStatus({...status}); };
    const request = async (method, body) => {
      const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8000);
      let response, value;
      try {
        response = await fetch('/api/research-state', {method, signal:abort.signal, cache:'no-store', credentials:'same-origin', headers:body ? {'Content-Type':'application/json'} : {}, ...(body ? {body:JSON.stringify(body)} : {})});
        value = await response.json();
      } finally { clearTimeout(timer); }
      if (!response.ok && response.status !== 409) throw Error(value.error || 'Workspace unavailable');
      if (!Object.hasOwn(value, 'revision') || !Object.hasOwn(value, 'state')) throw Error('Invalid workspace response');
      return {value, conflict:response.status === 409};
    };
    const snapshot = async local => {
      if (local == null) return;
      // Never adopt another copy unless the current browser copy has a recovery snapshot.
      const key = 'selectstar-research-atlas-workspace-snapshot-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      localStorage.setItem(key, JSON.stringify({savedAt:new Date().toISOString(), state:local}));
      if (options.snapshotLocal) await options.snapshotLocal(copy(local));
    };
    const showConflict = (workspace, reason) => {
      paused = true;
      conflict = {local:copy(readState()), workspace:copy(workspace.state), revision:workspace.revision, reason};
      report('conflict', '다른 저장본이 있습니다 · 비교 후 선택해 주세요');
      onConflict(copy(conflict));
    };
    const drain = async () => {
      if (running || paused || !ready || !pending || window.WORK_CONTEXT?.role === 'reader') return;
      running = true;
      let inFlight = null;
      try {
        while (pending && !paused) {
          const next = pending; pending = null; inFlight = next;
          report('saving', '이 브라우저 저장됨 · 업무 저장소 저장 중');
          const result = await request('PUT', {revision, state:next});
          if (result.conflict) { pending = copy(readState()) || next; showConflict(result.value, 'changed'); break; }
          revision = result.value.revision; lastSynced = stable(next); inFlight = null;
          report('synced', '업무 저장소에 저장됨');
        }
      } catch (error) {
        pending = copy(readState()) || pending || inFlight; ready = false;
        report('offline', '이 브라우저에 저장됨 · 업무 저장 연결 확인 필요');
      } finally { running = false; }
    };
    const refresh = async () => {
      if (running) return false;
      const before = stable(readState());
      try {
        const {value} = await request('GET');
        revision = value.revision; ready = true;
        const local = readState();
        const localPrint = stable(local), remotePrint = stable(value.state);
        if (value.state && remotePrint !== localPrint && (local == null || (lastSynced !== undefined && localPrint === lastSynced && !pending)) && localPrint === before) {
          await snapshot(local); await applyState(copy(value.state));
          if (await saveLocal() === false) throw Error('Local save failed');
          paused = false; conflict = null; pending = null; lastSynced = remotePrint;
          report('synced', '업무 저장소을 불러왔습니다');
        } else if (value.state && remotePrint !== localPrint && !(lastSynced !== undefined && remotePrint === lastSynced && pending && !paused)) {
          showConflict(value, 'startup');
        } else {
          paused = false; conflict = null;
          if (remotePrint === localPrint) lastSynced = remotePrint;
          report(value.state ? 'synced' : 'ready', value.state ? '업무 저장소과 같은 내용입니다' : '브라우저 저장 중 · 수정하면 업무 저장소에 저장');
          await drain();
        }
        return true;
      } catch (error) {
        ready = false; report('offline', '이 브라우저에 저장됨 · 업무 저장 연결 확인 필요'); return false;
      }
    };
    const controller = {
      save(state) { if (window.WORK_CONTEXT?.role === 'reader') return; pending = copy(state); if (paused) { if (conflict) conflict.local = copy(state); return; } void drain(); },
      refresh,
      async resolve(choice, mergedState) {
        if (window.WORK_CONTEXT?.role === 'reader' && choice !== 'workspace') throw Error('읽기 전용 계정에서는 저장본을 변경할 수 없습니다.');
        if (!conflict) return false;
        const current = copy(readState());
        const next = choice === 'workspace' ? conflict.workspace : choice === 'local' ? current : choice === 'merge' ? mergedState : undefined;
        if (!next || typeof next !== 'object') throw Error('선택한 데이터가 없습니다.');
        // Save recovery BEFORE either local adoption or remote replacement.
        await snapshot(current);
        revision = conflict.revision;
        if (choice !== 'local') {
          await applyState(copy(next));
          if (await saveLocal() === false) throw Error('브라우저 저장에 실패했습니다.');
        }
        conflict = null; paused = false; ready = true; pending = null;
        if (choice === 'workspace') { lastSynced = stable(next); report('synced', '업무 저장소을 불러왔습니다'); }
        else { pending = copy(next); await drain(); }
        return !paused;
      },
      exportConflict() { return conflict ? {...copy(conflict), local:copy(readState())} : null; },
      getStatus() { return {...status, paused, ready}; }
    };
    if (window.WORK_CONTEXT && ['local','supabase'].includes(window.WORK_CONTEXT.mode)) await refresh();
    else report('local', '이 브라우저에 자동 저장 · 업무 저장은 로컬 서버에서 사용');
    return controller;
  }
  window.ResearchWorkspaceSync = {init};
})();
