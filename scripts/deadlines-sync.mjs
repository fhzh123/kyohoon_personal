#!/usr/bin/env node
// Rebuilds server/deadlines/deadlines.json for the Paper deadline page.
//
// Sources, in order of trust:
//   1. server/deadlines/manual.json: editions checked by hand against the conference's own pages.
//   2. ccfddl/ccf-deadlines (MIT): community data, usually updated within days of an announcement.
//   3. huggingface/ai-deadlines (MIT): adds deadline kinds ccfddl does not track, such as camera-ready.
//
// A checked edition keeps its own dates. Dataset dates fill its TBA rows and add kinds it does not
// list; a dataset date that disagrees with a checked one is kept beside it as a note, never over it.
//
//   node scripts/deadlines-sync.mjs --local <dir>   read clones in <dir>/ccf-deadlines and <dir>/ai-deadlines
//                                                   (the weekly workflow clones both, then runs this)
//   node scripts/deadlines-sync.mjs                 fetch both datasets through the GitHub API instead
//   node scripts/deadlines-sync.mjs --now <iso>     pretend the run happens at that time (tests)

import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {parse} from 'yaml';
import {CONFERENCES,ORGANIZERS,CATEGORIES,KINDS} from '../server/deadlines/catalog.mjs';
import {toInstant,isKnownZone} from '../server/deadlines/time.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(root,'server/deadlines/deadlines.json');
const MANUAL=path.join(root,'server/deadlines/manual.json');
const DAY=86400000;

const SOURCES={
  ccf:{name:'ccfddl/ccf-deadlines',repo:'ccfddl/ccf-deadlines',file:c=>`conference/${c.ccf}.yml`,has:c=>!!c.ccf},
  hf:{name:'huggingface/ai-deadlines',repo:'huggingface/ai-deadlines',file:c=>`src/data/conferences/${c.hf}.yml`,has:c=>!!c.hf}
};

function args(){
  const a=process.argv.slice(2),get=k=>{const i=a.indexOf(k);return i<0?null:a[i+1];};
  return {local:get('--local'),now:get('--now')?new Date(get('--now')):new Date(),out:get('--out')||OUT};
}

async function github(url){
  const headers={'User-Agent':'paper-deadlines-sync','Accept':'application/vnd.github+json'};
  if(process.env.GITHUB_TOKEN)headers.Authorization='Bearer '+process.env.GITHUB_TOKEN;
  for(let attempt=1;;attempt++){
    try{
      const r=await fetch(url,{headers});
      if(r.status===404)return null;
      if(!r.ok)throw Error(url+' answered '+r.status);
      return r;
    }catch(error){
      if(attempt>=3)throw error;
      await new Promise(done=>setTimeout(done,1500*attempt));
    }
  }
}

async function loadSource(key,local){
  const src=SOURCES[key],files={};
  if(local){
    const dir=path.join(local,key==='ccf'?'ccf-deadlines':'ai-deadlines');
    for(const c of CONFERENCES)if(src.has(c)){
      try{files[c.id]=parse(await readFile(path.join(dir,src.file(c)),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    }
    let commit=null,committedAt=null;
    try{[commit,committedAt]=execFileSync('git',['-C',dir,'log','-1','--format=%H %cI'],{encoding:'utf8'}).trim().split(' ');}catch{}
    return {name:src.name,url:'https://github.com/'+src.repo,commit,committedAt,files};
  }
  const head=await(await github(`https://api.github.com/repos/${src.repo}/commits/HEAD`)).json();
  for(const c of CONFERENCES)if(src.has(c)){
    const r=await github(`https://raw.githubusercontent.com/${src.repo}/${head.sha}/${src.file(c)}`);
    if(r)files[c.id]=parse(await r.text());
  }
  return {name:src.name,url:'https://github.com/'+src.repo,commit:head.sha,committedAt:head.commit.committer.date,files};
}

// "August 10-13, 2026" names its own year; a few dataset rows carry the wrong `year`.
function editionYear(e){
  const years=String(e.date||'').match(/\b20\d{2}\b/g);
  return years?Number(years.at(-1)):Number(e.year);
}

const clean=s=>String(s??'').replace(/\s+/g,' ').trim();

function item({kind,label,date,timezone,source,dateOnly=false,note=''}){
  const local=date&&/^\d{4}-\d{2}-\d{2}/.test(String(date))?String(date).trim():null;
  const at=local&&isKnownZone(timezone)?toInstant(local,timezone):null;
  return {kind,label:clean(label),date:at?local:null,timezone:clean(timezone)||'AoE',at,dateOnly:!!dateOnly&&!!at,note:clean(note),source};
}

function fromCcf(conf,data,sourceUrl){
  const out=[];
  for(const e of data?.[0]?.confs||[]){
    const deadlines=[];
    for(const t of e.timeline||[]){
      const comment=clean(t.comment);
      const commit=/commit/i.test(comment);
      const track=comment&&!commit&&!/^arr submission$/i.test(comment)?' ('+comment+')':'';
      if(t.abstract_deadline)deadlines.push(item({kind:'abstract',label:'Abstract'+track,date:t.abstract_deadline,timezone:e.timezone,source:sourceUrl}));
      if(t.deadline!==undefined)deadlines.push(item({kind:commit?'commitment':'submission',label:commit?comment:(/^arr submission$/i.test(comment)?'ARR submission':'Paper submission'+track),date:t.deadline,timezone:e.timezone,source:sourceUrl}));
      if(t.rebuttal_deadline)deadlines.push(item({kind:'rebuttal',label:'Rebuttal'+track,date:t.rebuttal_deadline,timezone:e.timezone,source:sourceUrl}));
      if(t.decision_deadline)deadlines.push(item({kind:'notification',label:'Notification'+track,date:t.decision_deadline,timezone:e.timezone,source:sourceUrl}));
    }
    out.push({year:editionYear(e),link:e.link||'',dates:clean(e.date),place:clean(e.place),deadlines});
  }
  return out;
}

const HF_KINDS=[[/^abstract/,'abstract'],[/^(paper|submission|full_paper)/,'submission'],[/^supplementary/,'supplementary'],[/^review_release/,'reviews'],[/^(rebuttal|author_response|author_feedback)/,'rebuttal'],[/^commitment/,'commitment'],[/^(notification|decision)/,'notification'],[/^camera_ready/,'camera_ready']];

function fromHf(conf,data,sourceUrl){
  return (Array.isArray(data)?data:[]).map(e=>({
    year:Number(e.year),link:e.link||'',dates:clean(e.date),place:[e.city,e.country].filter(Boolean).join(', '),
    deadlines:(e.deadlines||[]).map(d=>{const kind=HF_KINDS.find(([re])=>re.test(String(d.type||'')))?.[1];return kind?item({kind,label:d.label||kind,date:d.date,timezone:d.timezone,source:sourceUrl}):null;}).filter(Boolean)
  }));
}

const near=(a,b)=>a.at&&b.at&&Math.abs(Date.parse(a.at)-Date.parse(b.at))<=DAY;

// ccfddl first; Hugging Face only adds kinds the ccfddl edition does not have.
function mergeDatasets(ccf,hf){
  const byYear=new Map();
  for(const e of ccf)byYear.set(e.year,{...e,deadlines:[...e.deadlines]});
  for(const e of hf){
    const base=byYear.get(e.year);
    if(!base){byYear.set(e.year,{...e});continue;}
    const kinds=new Set(base.deadlines.map(d=>d.kind));
    for(const d of e.deadlines)if(!kinds.has(d.kind)&&!base.deadlines.some(b=>b.kind===d.kind&&near(b,d)))base.deadlines.push(d);
    for(const k of ['link','dates','place'])if(!base[k])base[k]=e[k];
  }
  return byYear;
}

function applyManual(auto,manual,now){
  const deadlines=manual.deadlines.map(d=>({...item({...d,source:d.source}),checked:manual.checked}));
  for(const d of auto?.deadlines||[]){
    if(!d.at)continue;
    const same=deadlines.filter(m=>m.kind===d.kind);
    if(same.some(m=>near(m,d)))continue;
    const open=same.find(m=>!m.at&&!m.filledFrom);
    if(open){Object.assign(open,{date:d.date,timezone:d.timezone,at:d.at,dateOnly:false,source:d.source,checked:null,filledFrom:d.source});continue;}
    if(same.some(m=>m.at)){
      // A dataset row that disagrees with a checked date: keep it visible, only while it still matters.
      if(d.source.includes('ccf-deadlines')&&Date.parse(d.at)>now.getTime()){
        const target=same.find(m=>m.at);
        target.disagreement={date:d.date,timezone:d.timezone,at:d.at,source:d.source};
      }
      continue;
    }
    deadlines.push(d);
  }
  return {year:manual.year,link:manual.link||auto?.link||'',dates:manual.dates||auto?.dates||'',place:manual.place||auto?.place||'',checked:manual.checked,sources:manual.sources||[],deadlines};
}

const order=d=>[d.at?Date.parse(d.at):Infinity,KINDS.indexOf(d.kind)];

export async function build({local=null,now=new Date(),manualPath=MANUAL}={}){
  const manual=JSON.parse(await readFile(manualPath,'utf8')).editions;
  const [ccf,hf]=await Promise.all([loadSource('ccf',local),loadSource('hf',local)]);
  const blob=(src,c,key)=>`${src.url}/blob/${src.commit||'main'}/${SOURCES[key].file(c)}`;
  const minYear=now.getUTCFullYear()-1;
  const conferences=CONFERENCES.map(c=>{
    const editions=mergeDatasets(ccf.files[c.id]?fromCcf(c,ccf.files[c.id],blob(ccf,c,'ccf')):[],hf.files[c.id]?fromHf(c,hf.files[c.id],blob(hf,c,'hf')):[]);
    for(const m of manual.filter(m=>m.conference===c.id))editions.set(m.year,applyManual(editions.get(m.year),m,now));
    const list=[...editions.values()].filter(e=>e.year>=minYear).sort((a,b)=>a.year-b.year).map(e=>({
      ...e,checked:e.checked||null,sources:e.sources||[],
      deadlines:e.deadlines.filter(d=>KINDS.includes(d.kind)).sort((a,b)=>{const [x,y]=[order(a),order(b)];return x[0]-y[0]||x[1]-y[1];})
    }));
    return {id:c.id,name:c.name,full:c.full,categories:c.categories,organizer:c.organizer,editions:list};
  });
  return {
    generatedAt:now.toISOString(),
    schedule:'Every Thursday 09:00 KST',
    sources:[
      {name:'Official conference pages',url:null,note:'Checked by hand; see each edition.'},
      ...[ccf,hf].map(s=>({name:s.name,url:s.url,commit:s.commit,committedAt:s.committedAt,licence:'MIT'}))
    ],
    categories:CATEGORIES,organizers:ORGANIZERS,kinds:KINDS,conferences
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const opts=args();
  const data=await build(opts);
  const next=JSON.stringify(data,null,1)+'\n';
  await writeFile(opts.out,next);
  const upcoming=data.conferences.flatMap(c=>c.editions.flatMap(e=>e.deadlines.filter(d=>d.at&&Date.parse(d.at)>opts.now.getTime()).map(d=>`${c.name} ${e.year} ${d.label} ${d.date} ${d.timezone}${d.checked?' (checked)':''}${d.disagreement?' [dataset says '+d.disagreement.date+']':''}`)));
  console.log(`Wrote ${path.relative(root,opts.out)}: ${data.conferences.length} conferences, ${upcoming.length} upcoming deadlines.`);
  for(const line of upcoming.sort())console.log('  '+line);
}
