import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fail,uuid} from './paper-core.mjs';

export const DEFAULT_APPEARANCE={images:{light:null,dark:null},speed:40};
const types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'},maxBytes=5000000;
const validPath=value=>typeof value==='string'&&/^(?:localhost|[a-f0-9-]{36})\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(value);
export function validateAppearance(value){
  if(!value||!Number.isInteger(value.speed)||value.speed<0||value.speed>100)throw fail('배경 속도는 0~100으로 설정해 주세요.');
  const images={};for(const mode of ['light','dark']){const p=value.images?.[mode]??null;if(p!==null&&!validPath(p))throw fail('배경 이미지 경로를 확인해 주세요.');images[mode]=p;}
  return {images,speed:value.speed};
}
export function validateBackgroundImage(bytes,type){
  if(!types[type]||bytes.length<12||bytes.length>maxBytes)throw fail('PNG, JPG, WebP 이미지를 5 MB까지 올릴 수 있습니다.');
  const valid=type==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid)throw fail('파일 내용과 이미지 형식이 일치하지 않습니다.');return true;
}
export function appearanceRoutes({authorize,authFetch,bearer,send,body,rootDir,environment}){
  const localFile=path.join(rootDir,'private/appearance/state.json');let writes=Promise.resolve();
  const queue=fn=>{const r=writes.then(fn);writes=r.catch(()=>{});return r;};
  const localRead=async()=>{try{return JSON.parse(await readFile(localFile,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
  const localWrite=async row=>{await mkdir(path.dirname(localFile),{recursive:true});await writeFile(localFile+'.tmp',JSON.stringify(row),{mode:0o600});await rename(localFile+'.tmp',localFile);};
  const imageUrl=p=>p?environment.SUPABASE_URL?.replace(/\/$/,'')+'/storage/v1/object/public/site-backgrounds/'+p:null;
  const envelope=row=>{let config;try{config=validateAppearance(row?.config||DEFAULT_APPEARANCE);}catch{config=DEFAULT_APPEARANCE;}return{config,revision:row?.revision||null,urls:Object.fromEntries(['light','dark'].map(mode=>[mode,config.images[mode]?(config.images[mode].startsWith('localhost/')?'/api/appearance/file?path='+encodeURIComponent(config.images[mode]):imageUrl(config.images[mode])):null]))};};
  return async(req,res,url)=>{
    if(url.pathname!=='/api/appearance'&&url.pathname!=='/api/appearance/file'&&!url.pathname.startsWith('/api/settings/appearance'))return false;
    const isDev=environment.NODE_ENV==='development'&&!environment.VERCEL;
    try{
      const publicRead=async()=>{if(isDev)return localRead();if(!environment.SUPABASE_URL)return null;const r=await authFetch('/rest/v1/site_appearance?id=eq.site&select=config,revision');if(!r.ok)throw fail('배경 설정을 불러오지 못했습니다.',503);return(await r.json())[0]||null;};
      if(url.pathname==='/api/appearance'&&req.method==='GET'){send(res,200,envelope(await publicRead()));return true;}
      if(url.pathname==='/api/appearance/file'&&req.method==='GET'&&isDev){const p=url.searchParams.get('path');if(!validPath(p)||!p.startsWith('localhost/'))throw fail('이미지를 찾을 수 없습니다.',404);const bytes=await readFile(path.join(rootDir,'private/appearance/files',p));send(res,200,bytes,Object.keys(types).find(t=>p.endsWith('.'+types[t])));return true;}
      const access=await authorize(req,res);if(!access)throw fail('로그인 후 배경을 변경할 수 있습니다.',401);
      const upstream=async(p,opt={})=>{const r=await authFetch(p,{...opt,headers:{...bearer(access.token),...opt.headers}});if(!r.ok)throw fail('배경 저장소에 연결하지 못했습니다.',503);return r;};
      const getRow=async()=>access.mode==='local'?localRead():(await(await upstream('/rest/v1/site_appearance?id=eq.site&select=config,revision')).json())[0]||null;
      const p=url.pathname,uid=access.userId;
      if(p==='/api/settings/appearance'&&req.method==='GET'){send(res,200,{...envelope(await getRow()),role:access.role,mode:access.mode});return true;}
      if(access.role!=='editor')throw fail('읽기 전용 계정은 배경을 변경할 수 없습니다.',403);
      const ownPath=p=>validPath(p)&&p.split('/')[0]===uid;
      const readImage=async filePath=>{if(!ownPath(filePath))throw fail('이미지 경로가 올바르지 않습니다.');const type=Object.keys(types).find(t=>filePath.endsWith('.'+types[t]));const bytes=access.mode==='local'?await readFile(path.join(rootDir,'private/appearance/files',filePath)):Buffer.from(await(await upstream('/storage/v1/object/authenticated/site-backgrounds/'+filePath)).arrayBuffer());validateBackgroundImage(bytes,type);return{path:filePath,type,size:bytes.length,url:access.mode==='local'?'/api/appearance/file?path='+encodeURIComponent(filePath):imageUrl(filePath)};};
      if(p==='/api/settings/appearance/upload'&&req.method==='POST'){
        const input=JSON.parse(await body(req,1000));if(!types[input.type]||!Number.isInteger(input.size)||input.size<12||input.size>maxBytes)throw fail('PNG, JPG, WebP 이미지를 5 MB까지 올릴 수 있습니다.');
        if(access.mode==='local'){send(res,200,{local:true});return true;}
        const filePath=uid+'/'+randomUUID()+'.'+types[input.type],signed=await(await upstream('/storage/v1/object/upload/sign/site-backgrounds/'+filePath,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();
        if(typeof signed.url!=='string'||!signed.url.startsWith('/object/upload/sign/site-backgrounds/'+filePath+'?'))throw fail('업로드 주소를 준비하지 못했습니다.',503);
        send(res,200,{path:filePath,uploadUrl:environment.SUPABASE_URL.replace(/\/$/,'')+'/storage/v1'+signed.url});return true;
      }
      if(p==='/api/settings/appearance/file'&&req.method==='POST'&&access.mode==='local'){
        const input=JSON.parse(await body(req,6800000));if(typeof input.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64))throw fail('이미지 형식을 확인해 주세요.');const bytes=Buffer.from(input.base64,'base64');validateBackgroundImage(bytes,input.type);
        const filePath=uid+'/'+randomUUID()+'.'+types[input.type],dest=path.join(rootDir,'private/appearance/files',filePath);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes,{mode:0o600});send(res,200,{image:await readImage(filePath)});return true;
      }
      if(p==='/api/settings/appearance/complete'&&req.method==='POST'){const input=JSON.parse(await body(req,1000));send(res,200,{image:await readImage(input.path)});return true;}
      if(p==='/api/settings/appearance'&&req.method==='PUT'){
        const input=JSON.parse(await body(req,2000)),config=validateAppearance(input.config),expected=input.expectedRevision??null;if(expected!==null)uuid(expected);
        const persist=async()=>{const current=await getRow();if((current?.revision??null)!==expected)throw fail('다른 창에서 배경을 변경했습니다. 새로고침 후 다시 설정해 주세요.',409);
          for(const mode of ['light','dark'])if(config.images[mode]&&config.images[mode]!==current?.config?.images?.[mode])await readImage(config.images[mode]);
          const row={id:'site',config,revision:randomUUID(),updated_at:new Date().toISOString(),updated_by:access.mode==='local'?null:uid};
          if(access.mode==='local')await localWrite(row);else{const r=await authFetch('/rest/v1/site_appearance'+(expected?'?id=eq.site&revision=eq.'+expected:''),{method:expected?'PATCH':'POST',headers:{...bearer(access.token),'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});if(r.status===409)throw fail('다른 창에서 배경을 변경했습니다. 새로고침 후 다시 설정해 주세요.',409);if(!r.ok)throw fail('배경을 저장하지 못했습니다.',503);if(!(await r.json()).length)throw fail('다른 창에서 배경을 변경했습니다. 새로고침 후 다시 설정해 주세요.',409);}return row;};
        const row=access.mode==='local'?await queue(persist):await persist();send(res,200,{...envelope(row),role:access.role});return true;
      }
      throw fail('허용되지 않은 요청입니다.',405);
    }catch(error){send(res,error.status||503,{error:error.paperMessage||'배경 설정을 처리하지 못했습니다.'});return true;}
  };
}
