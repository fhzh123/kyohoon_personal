import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export const TRAVEL_COLORS={conference:'#e16a79',tour:'#6098e8',unvisited:'#6f9c80'};
const types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
const fail=(message,status=400)=>Object.assign(new Error(message),{status,travelMessage:message});
const validPath=p=>typeof p==='string'&&/^(?:localhost|[a-f0-9-]{36})\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(p);
const validRevision=r=>r===null||typeof r==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(r);
export function travelColors(value){if(!value||Object.keys(TRAVEL_COLORS).some(k=>typeof value[k]!=='string'||!/^#[a-f0-9]{6}$/i.test(value[k])))throw fail('색상을 올바르게 선택해 주세요.');return Object.fromEntries(Object.keys(TRAVEL_COLORS).map(k=>[k,value[k].toLowerCase()]));}
export function travelEntry(value){if(typeof value?.title!=='string'||!value.title.trim()||value.title.trim().length>120)throw fail('제목을 1~120자로 입력해 주세요.');if(typeof value.description!=='string'||value.description.length>3000)throw fail('설명은 3,000자까지 입력할 수 있습니다.');if(!['conference','tour'].includes(value.purpose))throw fail('방문 목적을 선택해 주세요.');if(!Array.isArray(value.photos)||value.photos.length>24||value.photos.some(p=>!validPath(p))||new Set(value.photos).size!==value.photos.length)throw fail('사진 목록을 확인해 주세요.');return {title:value.title.trim(),description:value.description.trim(),purpose:value.purpose,photos:value.photos};}
export function travelImage(bytes,type){if(!types[type]||bytes.length<12||bytes.length>8000000)throw fail('JPG, PNG, WebP 사진을 장당 8 MB까지 올릴 수 있습니다.');const valid=type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!valid)throw fail('사진 내용과 파일 형식이 일치하지 않습니다.');}
export function travelRoutes({authorize,authFetch,bearer,send,body,rootDir,environment}){
 const statePath=path.join(rootDir,'private/travel/state.json');let queue=Promise.resolve(),regions;
 const read=async()=>{try{return JSON.parse(await readFile(statePath,'utf8'));}catch(e){if(e.code==='ENOENT')return {entries:{},settings:{config:TRAVEL_COLORS,revision:null},media:{}};throw e;}};
 const write=async state=>{await mkdir(path.dirname(statePath),{recursive:true});await writeFile(statePath+'.tmp',JSON.stringify(state),{mode:0o600});await rename(statePath+'.tmp',statePath);};
 const serialize=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 const photoUrl=p=>p.startsWith('localhost/')?'/api/travel/file?path='+encodeURIComponent(p):environment.SUPABASE_URL.replace(/\/$/,'')+'/storage/v1/object/public/travel-photos/'+p;
 const entryOut=e=>({regionId:e.region_id,title:e.title,description:e.description,purpose:e.purpose,photos:e.photos.filter(validPath).map(p=>({path:p,url:photoUrl(p)})),revision:e.revision,updatedAt:e.updated_at});
 const remote=async(p,opt={})=>{const r=await authFetch(p,opt);if(r.status===409)throw fail('다른 변경이 먼저 저장되었습니다. 기록을 다시 열어 주세요.',409);if(!r.ok)throw fail('여행 기록 저장소에 연결하지 못했습니다.',503);return r;};
 const isLocal=environment.NODE_ENV==='development'&&!environment.VERCEL;
 const publicRead=async()=>{if(isLocal){const state=await read();return {entries:Object.values(state.entries).map(entryOut),settings:state.settings};}if(!environment.SUPABASE_URL)throw fail('여행 기록 저장소 설정이 필요합니다.',503);const [a,b]=await Promise.all([remote('/rest/v1/travel_entries?select=region_id,title,description,purpose,photos,revision,updated_at&order=updated_at.desc'),remote('/rest/v1/travel_settings?id=eq.site&select=config,revision')]);return {entries:(await a.json()).map(entryOut),settings:(await b.json())[0]||{config:TRAVEL_COLORS,revision:null}};};
 return async(req,res,url)=>{
  const p=url.pathname;if(!p.startsWith('/api/travel/')&&p!=='/api/settings/travel')return false;
  try{
   if(p==='/api/travel/bootstrap'&&req.method==='GET'){const [data,access]=await Promise.all([publicRead(),authorize(req,res).catch(()=>null)]);send(res,200,{...data,role:access?.role||'reader',authenticated:!!access});return true;}
   if(p==='/api/travel/file'&&['GET','HEAD'].includes(req.method)&&isLocal){const file=url.searchParams.get('path');if(!validPath(file)||!file.startsWith('localhost/'))throw fail('사진을 찾을 수 없습니다.',404);const bytes=await readFile(path.join(rootDir,'private/travel/photos',file));send(res,200,req.method==='HEAD'?'':bytes,Object.keys(types).find(t=>file.endsWith('.'+types[t])));return true;}
   const access=await authorize(req,res);if(!access)throw fail('로그인 후 여행 기록을 변경할 수 있습니다.',401);
   if(p==='/api/settings/travel'&&req.method==='GET'){send(res,200,{...(await publicRead()).settings,role:access.role});return true;}
   if(access.role!=='editor')throw fail('Reader 계정은 여행 기록과 색상을 변경할 수 없습니다.',403);
   const headers={...bearer(access.token),'Content-Type':'application/json',Prefer:'return=representation'};
   if(p==='/api/settings/travel'&&req.method==='PUT'){
    const input=JSON.parse(await body(req,2000)),config=travelColors(input.config),expected=input.expectedRevision??null;if(!validRevision(expected))throw fail('설정을 다시 불러와 주세요.',409);
    const persist=async()=>{const state=access.mode==='local'?await read():null,current=state?.settings||(await(await remote('/rest/v1/travel_settings?id=eq.site&select=config,revision',{headers})).json())[0];if((current?.revision??null)!==expected)throw fail('다른 창에서 색상을 변경했습니다. 새로고침해 주세요.',409);const row={id:'site',config,revision:randomUUID(),updated_at:new Date().toISOString(),updated_by:access.mode==='local'?null:access.userId};if(state){state.settings=row;await write(state);}else{const r=await remote('/rest/v1/travel_settings'+(expected?'?id=eq.site&revision=eq.'+expected:''),{method:expected?'PATCH':'POST',headers,body:JSON.stringify(row)});if(!(await r.json()).length)throw fail('다른 창에서 색상을 변경했습니다. 새로고침해 주세요.',409);}return row;};const row=access.mode==='local'?await serialize(persist):await persist();send(res,200,{config:row.config,revision:row.revision,role:access.role});return true;
   }
   if(p==='/api/travel/upload'&&req.method==='POST'){
    const input=JSON.parse(await body(req,1000));if(!types[input.type]||!Number.isInteger(input.size)||input.size<12||input.size>8000000)throw fail('JPG, PNG, WebP 사진을 장당 8 MB까지 올릴 수 있습니다.');
    if(access.mode==='local'){send(res,200,{local:true});return true;}const file=access.userId+'/'+randomUUID()+'.'+types[input.type];const signed=await(await remote('/storage/v1/object/upload/sign/travel-photos/'+file,{method:'POST',headers,body:'{}'})).json();if(typeof signed.url!=='string'||!signed.url.startsWith('/object/upload/sign/travel-photos/'+file+'?'))throw fail('사진 업로드를 준비하지 못했습니다.',503);send(res,200,{path:file,uploadUrl:environment.SUPABASE_URL.replace(/\/$/,'')+'/storage/v1'+signed.url});return true;
   }
   if(p==='/api/travel/file'&&req.method==='POST'&&access.mode==='local'){
    const input=JSON.parse(await body(req,11000000));if(typeof input.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64))throw fail('사진 형식을 확인해 주세요.');const bytes=Buffer.from(input.base64,'base64');travelImage(bytes,input.type);const file='localhost/'+randomUUID()+'.'+types[input.type];await mkdir(path.join(rootDir,'private/travel/photos/localhost'),{recursive:true});await writeFile(path.join(rootDir,'private/travel/photos',file),bytes);await serialize(async()=>{const state=await read();state.media[file]={owner_id:'localhost'};await write(state);});send(res,200,{photo:{path:file,url:photoUrl(file)}});return true;
   }
   if(p==='/api/travel/complete'&&req.method==='POST'){
    const input=JSON.parse(await body(req,1000)),file=input.path;if(!validPath(file)||file.split('/')[0]!==access.userId)throw fail('사진 경로가 올바르지 않습니다.');const type=Object.keys(types).find(t=>file.endsWith('.'+types[t]));const bytes=Buffer.from(await(await remote('/storage/v1/object/authenticated/travel-photos/'+file,{headers})).arrayBuffer());travelImage(bytes,type);const exists=await(await remote('/rest/v1/travel_media?path=eq.'+encodeURIComponent(file)+'&select=path',{headers})).json();if(!exists.length)await remote('/rest/v1/travel_media',{method:'POST',headers,body:JSON.stringify({path:file,owner_id:access.userId,mime_type:type,size_bytes:bytes.length})});send(res,200,{photo:{path:file,url:photoUrl(file)}});return true;
   }
   const match=p.match(/^\/api\/travel\/entries\/([A-Z]{3}-\d+)$/);
   if(match&&req.method==='PUT'){
    if(!regions)regions=new Set((JSON.parse(await readFile(path.join(rootDir,'public/travel/regions.json'),'utf8'))).map(r=>r.id));const id=match[1];if(!regions.has(id))throw fail('지역을 찾을 수 없습니다.',404);
    const input=JSON.parse(await body(req,16000)),entry=travelEntry(input),expected=input.expectedRevision??null;if(!validRevision(expected))throw fail('기록을 다시 열어 주세요.',409);
    const persist=async()=>{const state=access.mode==='local'?await read():null,current=state?.entries[id]||(state?null:(await(await remote('/rest/v1/travel_entries?region_id=eq.'+id+'&select=photos,revision',{headers})).json())[0]);if((current?.revision??null)!==expected)throw fail('다른 변경이 먼저 저장되었습니다. 기록을 다시 열어 주세요.',409);
     const added=entry.photos.filter(p=>!current?.photos.includes(p));for(const photo of added){if(photo.split('/')[0]!==access.userId)throw fail('추가할 사진의 소유자가 올바르지 않습니다.');if(state){if(!state.media[photo])throw fail('사진 업로드를 먼저 완료해 주세요.');}else{const rows=await(await remote('/rest/v1/travel_media?path=eq.'+encodeURIComponent(photo)+'&owner_id=eq.'+access.userId+'&select=path',{headers})).json();if(!rows.length)throw fail('사진 업로드를 먼저 완료해 주세요.');}}
     const row={region_id:id,...entry,revision:randomUUID(),updated_at:new Date().toISOString(),updated_by:access.mode==='local'?null:access.userId};if(state){state.entries[id]=row;await write(state);}else{const r=await remote('/rest/v1/travel_entries'+(expected?'?region_id=eq.'+id+'&revision=eq.'+expected:''),{method:expected?'PATCH':'POST',headers,body:JSON.stringify(row)});if(!(await r.json()).length)throw fail('다른 변경이 먼저 저장되었습니다. 기록을 다시 열어 주세요.',409);}return row;
    };const row=access.mode==='local'?await serialize(persist):await persist();send(res,200,{entry:entryOut(row)});return true;
   }
   throw fail('허용되지 않은 요청입니다.',405);
  }catch(error){send(res,error.status||(error instanceof SyntaxError?400:503),{error:error.travelMessage||(error instanceof SyntaxError?'입력 형식을 확인해 주세요.':'여행 기록을 처리하지 못했습니다.')});return true;}
 };
}
