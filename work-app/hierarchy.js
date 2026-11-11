/* Pure task hierarchy helpers. Rendering and editing never alter task dates here. */
(() => {
  'use strict';
  const list = tasks => Array.isArray(tasks) ? tasks : [];
  const byId = (tasks, id) => list(tasks).find(task => task && task.id === id);
  const parent = task => typeof task?.parentId === 'string' ? task.parentId : '';
  function childrenOf(tasks, id) {
    return id ? list(tasks).filter(task => task && parent(task) === id) : [];
  }
  function ordered(items, rangeOf=task=>task) {
    return list(items).slice().sort((a,b)=>{
      const ar=Number.isFinite(a.sortOrder),br=Number.isFinite(b.sortOrder);
      if(ar||br){if(ar!==br)return ar?-1:1;if(a.sortOrder!==b.sortOrder)return a.sortOrder-b.sortOrder;}
      return (rangeOf(a).start||'9999').localeCompare(rangeOf(b).start||'9999')||a.title.localeCompare(b.title);
    });
  }
  function descendantsOf(tasks, id) {
    const result = [], seen = new Set([id]);
    const pending = childrenOf(tasks, id).slice().reverse();
    while (pending.length) {
      const task = pending.pop();
      if (seen.has(task.id)) continue;
      seen.add(task.id); result.push(task);
      pending.push(...childrenOf(tasks, task.id).slice().reverse());
    }
    return result;
  }
  function ancestorsOf(tasks, id) {
    const result = [], seen = new Set([id]);
    let task = byId(tasks, id);
    while (task && parent(task)) {
      const next = byId(tasks, parent(task));
      if (!next || seen.has(next.id)) break;
      seen.add(next.id); result.push(next); task = next;
    }
    return result;
  }
  function rootOf(tasks, id) {
    const ancestors = ancestorsOf(tasks, id);
    return ancestors.length ? ancestors[ancestors.length - 1] : byId(tasks, id);
  }
  function leafTasks(tasks) {
    const parents = new Set(list(tasks).map(parent).filter(Boolean));
    return list(tasks).filter(task => task && !parents.has(task.id));
  }
  function effectiveRange(tasks, id) {
    const task = byId(tasks, id);
    if (task?.start && task?.end) return { start: task.start, end: task.end, derived: false };
    const scheduled = descendantsOf(tasks, id).filter(child => child.start && child.end);
    if (!scheduled.length) return { start: '', end: '', derived: false };
    return { start: scheduled.reduce((min, child) => child.start < min ? child.start : min, scheduled[0].start),
      end: scheduled.reduce((max, child) => child.end > max ? child.end : max, scheduled[0].end), derived: true };
  }
  function progress(tasks, id) {
    const task = byId(tasks, id);
    const descendants = descendantsOf(tasks, id);
    const leaves = descendants.length ? leafTasks(descendants) : task ? [task] : [];
    const done = leaves.filter(child => child.status === 'done').length, total = leaves.length;
    return { done, total, percent: total ? Math.round(done / total * 100) : 0 };
  }
  function validate(tasks) {
    if (!Array.isArray(tasks)) throw new Error('작업 계층 목록이 올바르지 않습니다.');
    const ids = new Set();
    for (const task of tasks) {
      if (!task || typeof task.id !== 'string' || !task.id.trim() || ids.has(task.id)) throw new Error('작업 ID가 올바르지 않거나 중복되었습니다.');
      ids.add(task.id);
      if (task.parentId !== undefined && typeof task.parentId !== 'string') throw new Error('상위 작업 ID는 문자열이어야 합니다.');
    }
    const lookup = new Map(tasks.map(task => [task.id, task]));
    for (const task of tasks) {
      if (parent(task) && !ids.has(parent(task))) throw new Error('상위 작업을 찾을 수 없습니다.');
      const seen = new Set([task.id]);
      let cursor = task;
      while (parent(cursor)) {
        const id = parent(cursor);
        if (seen.has(id)) throw new Error('작업 계층에 자기 참조 또는 순환이 있습니다.');
        seen.add(id); cursor = lookup.get(id);
      }
    }
    return tasks;
  }
  function canParent(tasks, id, parentId) {
    if (typeof parentId !== 'string' || !byId(tasks, id)) return false;
    if (!parentId) return true;
    return parentId !== id && !!byId(tasks, parentId) && !descendantsOf(tasks, id).some(task => task.id === parentId);
  }
  function findOverflow(tasks, id) {
    const task = byId(tasks, id);
    if (!task?.start || !task?.end) return [];
    return descendantsOf(tasks, id).filter(child => {
      const range = effectiveRange(tasks, child.id);
      return range.start && range.end && (range.start < task.start || range.end > task.end);
    });
  }
  window.ResearchHierarchy = { ordered, childrenOf, descendantsOf, ancestorsOf, rootOf, leafTasks, effectiveRange, progress, validate, canParent, findOverflow };
})();
