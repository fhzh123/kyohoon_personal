/* Official orange L3/L4 taxonomy. Source strings and source-cell IDs are stable.
 * migrate is pure: no storage, clocks, network, or mutations of its input. */
(function (global) {
  'use strict';
  const source = global.RESEARCH_TAXONOMY_SOURCE;
  const legacySeed = global.RESEARCH_LEGACY_SEED;
  const taxonomyVersion = 'orange-l3-2026-11-10-v1';
  const catalog = source.catalog;
  const l2 = [...new Map(catalog.map(g => [g.l2.sourceCell, {id:'l2-'+g.l2.sourceCell.slice(1), ...g.l2}])).values()];
  const clone = value => JSON.parse(JSON.stringify(value));
  const rootMap = {diversity:'l4-27', 'rubric-items':'l4-48',layout:'l4-20',graph:'l4-24',workflow:'l4-26',prompt:'l4-95',failure:'l4-99'};
  const childMap = {vertical:'l4-28',multiagent:'l4-28','diversity-paper':'l4-27',restore:'l4-20',ready:'l4-23',rag:'l4-24','workflow-action':'l4-24',feasibility:'l4-24'};
  const mixed = new Set(['restore','multiagent']);
  const defaults = {parentId:'', owner:'',planUnit:'week',legacyDates:false,updatedAt:''};
  function unchanged(item, original) {
    if (!original) return false;
    return Object.keys(item).every(key => {
      if (['assetId','l3Id','l2Id','officialTitle','taxonomyVersion','legacyGoalId'].includes(key)) return true;
      if (Object.prototype.hasOwnProperty.call(original,key)) return JSON.stringify(item[key])===JSON.stringify(original[key]);
      if (Object.prototype.hasOwnProperty.call(defaults,key)) return item[key]===defaults[key];
      return false;
    }) && Object.keys(original).every(key => item[key]===undefined || JSON.stringify(item[key])===JSON.stringify(original[key]));
  }
  // These two axes were explicitly rejected by the workspace owner. Keep research
  // records, but remove the grouping and its stale source associations.
  const rejectedTitles = new Set(['멀티에이전트 토론으로 텍스트를 세그멘테이션하는 기술','단일 에이전트 세그멘테이션 (#4의 출발점)']);
  function applyDeletions(out) {
    const goals = new Set(out.deletedGoalIds || []), tasks = new Set(out.deletedTaskIds || []);
    catalog.forEach(g=>{if(rejectedTitles.has(g.name))goals.add(g.id);});
    out.goals.forEach(g=>{if(rejectedTitles.has(g.title)||rejectedTitles.has(g.officialTitle))goals.add(g.id);});
    out.goals=out.goals.filter(g=>!goals.has(g.id));
    out.tasks=out.tasks.filter(t=>!tasks.has(t.id));
    const remaining=new Set(out.tasks.map(t=>t.id));
    [...out.tasks,...out.notes,...out.phases].forEach(item=>{
      if(goals.has(item.goalId)||goals.has(item.l3Id)) {
        item.goalId='';
        for(const key of ['l3Id','l2Id','assetId','linkedAssetId','officialTitle','sourceCell'])delete item[key];
      }
    });
    out.tasks.forEach(t=>{if(t.parentId&&!remaining.has(t.parentId))t.parentId='';if(t.dependencies)t.dependencies=t.dependencies.filter(id=>!tasks.has(id));});
    out.deletedGoalIds=[...goals];out.deletedTaskIds=[...tasks];
    return out;
  }
  function migrate(data) {
    if (!data || ![1,2,3,4].includes(data.version)) throw new Error('지원하는 Research Atlas 데이터 버전이 아닙니다.');
    const out = clone(data);
    ['goals','phases','tasks','notes','references'].forEach(key=>{if(!Array.isArray(out[key]))out[key]=[];});
    applyDeletions(out);
    const activeCatalog=catalog.filter(g=>!out.deletedGoalIds.includes(g.id));
    if (out.version===4 && out.taxonomyVersion===taxonomyVersion) return applyDeletions(out);
    out.annualPlans = out.annualPlans || [];
    const legacyGroups = new Map((out.legacyGroups||[]).map(g=>[g.id,g]));
    const seedGoals = new Map(legacySeed.goals.map(g=>[g.id,g]));
    const authoredGoals = out.goals.filter(g=> {
      if (catalog.some(c=>c.id===g.id)) return true;
      const original=seedGoals.get(g.id);
      if (original) legacyGroups.set(g.id,clone(g));
      return !original || JSON.stringify(g)!==JSON.stringify(original);
    });
    out.legacyGroups = [...legacyGroups.values()];
    const goals = new Map(authoredGoals.map(g=>[g.id,g]));
    activeCatalog.forEach(g=> {
      const previous=goals.get(g.id);
      goals.set(g.id,{title:g.name,description:'',metric:'',color:'#d5793d',...previous,id:g.id,assetId:g.id,l3Id:g.id,l2Id:'l2-'+g.l2.sourceCell.slice(1),officialTitle:g.name,sourceCell:g.sourceCell});
    });
    out.goals=[...goals.values()];
    const phaseGoals={discovery:'l3-27',rubric:'l3-48',document:'l3-20',ontology:'l3-24',optimization:'l3-95'};
    [...out.phases,...out.notes].forEach(item=>{
      if(!seedGoals.has(item.goalId))return;
      item.legacyGoalId=item.legacyGoalId||item.goalId;
      item.goalId=phaseGoals[item.id]||'';
    });
    const originalTasks=new Map(legacySeed.tasks.map(t=>[t.id,t]));
    const taskIds=new Set(out.tasks.map(t=>t.id));
    // Any ID referenced anywhere outside its own task is retained, including unknown note schemas.
    const referencesId=(id)=> {
      const has=(v)=>typeof v==='string'?v===id:Array.isArray(v)?v.some(has):v&&typeof v==='object'?Object.values(v).some(has):false;
      return out.tasks.some(t=>t.id!==id&&has(t)) || has(out.notes)||has(out.phases)||has(out.annualPlans);
    };
    out.tasks=out.tasks.filter(t=>!mixed.has(t.id)||!unchanged(t,originalTasks.get(t.id))||referencesId(t.id));
    const displayTitle=a=>a.name.split(/\s*->\s*/)[0].trim();
    const roots=new Map();
    const official=new Map();
    activeCatalog.forEach(g=>g.l4.forEach(a=>official.set(a.id,{a,g})));
    // Authored independent candidates win over untouched seed placeholders.
    const candidates=new Map();
    out.tasks.forEach(t=> {
      const asset=official.has(t.assetId)?t.assetId:rootMap[t.id]||(t.id==='workflow-action'?'l4-24':null);
      if(official.has(asset)&&!t.parentId) {
        const score=(t.assetId===asset?10:0)+(!unchanged(t,originalTasks.get(t.id))?4:0)+(referencesId(t.id)?2:0)+(rootMap[t.id]?1:0);
        if(!candidates.has(asset)||score>candidates.get(asset).score)candidates.set(asset,{task:t,score});
      }
    });
    candidates.forEach(({task},asset)=>roots.set(asset,task));
    out.tasks=out.tasks.filter(t=> {
      const asset=rootMap[t.id];
      return !official.has(asset)||roots.get(asset)===t||!unchanged(t,originalTasks.get(t.id))||referencesId(t.id);
    });
    const allocate=(preferred)=>{let id=preferred,n=2;while(taskIds.has(id))id=preferred+'-'+n++;taskIds.add(id);return id;};
    official.forEach(({a,g},asset)=> {
      let t=roots.get(asset);
      if(!t) {
        t={id:allocate(asset),title:displayTitle(a),parentId:'',start:'',end:'',status:'backlog',category:'research',phaseId:'',description:'',deliverable:'',notes:'',dependencies:[],owner:'',planUnit:'week'};
        out.tasks.push(t);roots.set(asset,t);
      }
      if(unchanged(t,originalTasks.get(t.id)))t.title=displayTitle(a);
      if(t.goalId&&t.goalId!==g.id&&!t.legacyGoalId)t.legacyGoalId=t.goalId;
      Object.assign(t,{assetId:asset,l3Id:g.id,l2Id:'l2-'+g.l2.sourceCell.slice(1),officialTitle:a.name,goalId:g.id,sourceCell:a.sourceCell});
    });
    const canonicalIds=new Set([...roots.values()].map(t=>t.id));
    // Preserve every user-authored parent edge; only attach currently independent legacy tasks.
    out.tasks.forEach(t=> {
      if(canonicalIds.has(t.id))return;
      const asset=childMap[t.id]||rootMap[t.id];
      if(!official.has(asset))return;
      const parent=roots.get(asset), {g}=official.get(asset);
      if(!t.parentId)t.parentId=parent.id;
      if(!t.legacyGoalId&&t.goalId&&t.goalId!==g.id)t.legacyGoalId=t.goalId;
      // Existing nested task goals are retained; root attachments adopt their canonical goal.
      if(t.parentId===parent.id)t.goalId=g.id;
      t.l3Id=g.id;t.l2Id='l2-'+g.l2.sourceCell.slice(1);
      t.linkedAssetId=asset;
    });
    const byId=new Map(out.tasks.map(t=>[t.id,t]));
    out.tasks.forEach(t=>{
      let root=t, seen=new Set();
      while(root.parentId&&byId.has(root.parentId)&&!seen.has(root.id)) {seen.add(root.id);root=byId.get(root.parentId);}
      if(!canonicalIds.has(root.id))return;
      if(t.goalId&&t.goalId!==root.goalId&&!t.legacyGoalId)t.legacyGoalId=t.goalId;
      t.goalId=root.goalId;t.l3Id=root.l3Id;t.l2Id=root.l2Id;
    });
    out.version=4;out.taxonomyVersion=taxonomyVersion;
    return applyDeletions(out);
  }
  global.ResearchTaxonomy={catalog,l2,source:source.source,taxonomyVersion,migrate};
})(typeof window!=='undefined'?window:globalThis);
