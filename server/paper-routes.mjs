import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {paperPage} from '../views/paper.mjs';
import {PROVIDERS,DEFAULT_PROMPTS,validateProject,validateSettings,publicSettings,uuid,text,fail,decryptKey,buildTask,MAX_PDF_BYTES} from './paper-core.mjs';
import {generate,listModels} from './paper-providers.mjs';

export function paperRoutes({authorize,authFetch,bearer,send,body,rootDir,environment,fetcher}){
  let writes=Promise.resolve();const active=new Set();
  const queue=fn=>{const p=writes.then(fn);writes=p.catch(()=>{});return p;};
  const localPath=path.join(rootDir,'private/paper/state.json');
  const readLocal=async()=>{try{return JSON.parse(await readFile(localPath,'utf8'));}catch(e){if(e.code==='ENOENT')return {projects:[],settings:null};throw e;}};
  const writeLocal=async data=>{await mkdir(path.dirname(localPath),{recursive:true});await writeFile(localPath+'.tmp',JSON.stringify(data),{mode:0o600});await rename(localPath+'.tmp',localPath);};
  return async(req,res,url)=>{
    if(!['/paper','/paper/'].includes(url.pathname)&&!url.pathname.startsWith('/api/paper'))return false;
    const access=await authorize(req,res);
    if(!access){send(res,['GET','HEAD'].includes(req.method)&&url.pathname.startsWith('/paper')?303:401,{error:'로그인 후 이용해 주세요.'},'application/json; charset=utf-8',url.pathname.startsWith('/paper')?{Location:'/login?next=%2Fpaper'}:{});return true;}
    try{
      if(url.pathname==='/paper'||url.pathname==='/paper/'){if(!['GET','HEAD'].includes(req.method))throw fail('허용되지 않은 요청입니다.',405);send(res,200,req.method==='HEAD'?'':paperPage(),'text/html; charset=utf-8');return true;}
      const uid=access.userId;
      const upstream=async(p,options={})=>{const r=await authFetch(p,{...options,headers:{...bearer(access.token),...options.headers}});if(!r.ok)throw fail('Paper 저장소에 연결하지 못했습니다. 서버 설정과 데이터베이스 준비 상태를 확인해 주세요.',503);return r;};
      const getSettings=async()=>access.mode==='local'?(await readLocal()).settings:(await(await upstream('/rest/v1/paper_settings?user_id=eq.'+encodeURIComponent(uid)+'&select=config,encrypted_keys,revision')).json())[0]||null;
      const getProject=async id=>{uuid(id);const row=access.mode==='local'?(await readLocal()).projects.find(p=>p.id===id):(await(await upstream('/rest/v1/paper_projects?id=eq.'+id+'&user_id=eq.'+encodeURIComponent(uid)+'&select=id,data,revision,updated_at')).json())[0];if(!row)throw fail('작업을 찾을 수 없습니다.',404);return row;};
      const validPdfPath=(p,id)=>typeof p==='string'&&p.startsWith(uid+'/'+id+'/')&&/^[a-f0-9-]+\.pdf$/.test(p.split('/').at(-1))&&p.split('/').length===3;
      const getPdf=async project=>{if(!project.pdf)return null;if(!validPdfPath(project.pdf.path,project.id))throw fail('첨부파일 경로가 올바르지 않습니다.');
        const bytes=access.mode==='local'?await readFile(path.join(rootDir,'private/paper/files',...project.pdf.path.split('/'))):Buffer.from(await(await upstream('/storage/v1/object/authenticated/paper-files/'+project.pdf.path)).arrayBuffer());
        if(bytes.length>MAX_PDF_BYTES)throw fail('첨부파일이 너무 큽니다.',413);return {name:project.pdf.name,base64:bytes.toString('base64'),bytes};};
      const p=url.pathname;
      if(p==='/api/paper'&&req.method==='GET'){
        const [rows,settings]=await Promise.all([access.mode==='local'?readLocal().then(x=>x.projects):upstream('/rest/v1/paper_projects?user_id=eq.'+encodeURIComponent(uid)+'&select=id,data,revision,updated_at&order=updated_at.desc&limit=200').then(r=>r.json()),getSettings()]);
        send(res,200,{projects:rows,settings:publicSettings(settings,environment),defaults:DEFAULT_PROMPTS,role:access.role,mode:access.mode});return true;
      }
      if(p==='/api/paper/file'&&req.method==='GET'){
        const row=await getProject(url.searchParams.get('projectId'));const file=await getPdf(row.data);if(!file)throw fail('첨부된 PDF가 없습니다.',404);
        send(res,200,file.bytes,'application/pdf',{'Content-Disposition':"attachment; filename=paper.pdf; filename*=UTF-8''"+encodeURIComponent(file.name),'Content-Security-Policy':"sandbox; default-src 'none'"});return true;
      }
      if(access.role!=='editor')throw fail('읽기 전용 계정입니다.',403);
      if(p==='/api/paper/project'&&req.method==='PUT'){
        const input=JSON.parse(await body(req,1700000)),project=validateProject(input.project),expected=input.expectedRevision??null;
        if(project.pdf&&!validPdfPath(project.pdf.path,project.id))throw fail('첨부파일 경로가 올바르지 않습니다.');if(expected!==null)uuid(expected);
        const row={id:project.id,user_id:uid,data:project,revision:randomUUID(),updated_at:new Date().toISOString()};
        if(access.mode==='local')await queue(async()=>{const state=await readLocal(),old=state.projects.find(p=>p.id===row.id);if((old?.revision??null)!==expected)throw fail('다른 탭에서 먼저 저장했습니다. 현재 내용을 내보낸 뒤 새로 불러와 주세요.',409);state.projects=[row,...state.projects.filter(p=>p.id!==row.id)];await writeLocal(state);});
        else if(expected){const r=await upstream('/rest/v1/paper_projects?id=eq.'+row.id+'&user_id=eq.'+uid+'&revision=eq.'+expected,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});if(!(await r.json()).length)throw fail('다른 탭에서 먼저 저장했습니다. 현재 내용을 내보낸 뒤 새로 불러와 주세요.',409);}
        else{const r=await authFetch('/rest/v1/paper_projects',{method:'POST',headers:{...bearer(access.token),'Content-Type':'application/json'},body:JSON.stringify(row)});if(r.status===409)throw fail('이미 저장된 작업입니다. 다시 불러와 주세요.',409);if(!r.ok)throw fail('작업을 저장하지 못했습니다.',503);}
        send(res,200,{project:row});return true;
      }
      if(p==='/api/paper/project/delete'&&req.method==='POST'){
        const input=JSON.parse(await body(req,2000));uuid(input.id);uuid(input.expectedRevision);
        if(access.mode==='local')await queue(async()=>{const s=await readLocal(),row=s.projects.find(p=>p.id===input.id);if(!row||row.revision!==input.expectedRevision)throw fail('작업이 변경되었습니다. 다시 불러와 주세요.',409);s.projects=s.projects.filter(p=>p.id!==input.id);await writeLocal(s);});
        else{const r=await upstream('/rest/v1/paper_projects?id=eq.'+input.id+'&user_id=eq.'+uid+'&revision=eq.'+input.expectedRevision,{method:'DELETE',headers:{Prefer:'return=representation'}});if(!(await r.json()).length)throw fail('작업이 변경되었습니다. 다시 불러와 주세요.',409);}
        send(res,200,{deleted:true});return true;
      }
      if(p==='/api/paper/settings'&&req.method==='PUT'){
        const input=JSON.parse(await body(req,60000)),expected=input.expectedRevision??null;if(expected!==null)uuid(expected);let row;
        const apply=current=>{if((current?.revision??null)!==expected)throw fail('설정이 다른 탭에서 변경되었습니다. 다시 불러와 주세요.',409);return {user_id:uid,...validateSettings(input,current,uid,environment),revision:randomUUID(),updated_at:new Date().toISOString()};};
        if(access.mode==='local')await queue(async()=>{const s=await readLocal();row=apply(s.settings);s.settings=row;await writeLocal(s);});
        else{row=apply(await getSettings());const r=await authFetch('/rest/v1/paper_settings'+(expected?'?user_id=eq.'+uid+'&revision=eq.'+expected:''),{method:expected?'PATCH':'POST',headers:{...bearer(access.token),'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});if(r.status===409)throw fail('설정이 변경되었습니다. 다시 불러와 주세요.',409);if(!r.ok)throw fail('설정을 저장하지 못했습니다.',503);if(!(await r.json()).length)throw fail('설정이 변경되었습니다. 다시 불러와 주세요.',409);}
        send(res,200,{settings:publicSettings(row,environment)});return true;
      }
      if(p==='/api/paper/file'&&req.method==='POST'){
        const input=JSON.parse(await body(req,3450000));const row=await getProject(input.projectId);text(input.name,250);
        if(typeof input.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64))throw fail('PDF 형식을 확인해 주세요.');
        const bytes=Buffer.from(input.base64,'base64');if(bytes.length>MAX_PDF_BYTES)throw fail('PDF는 2.5 MB까지 첨부할 수 있습니다.',413);if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw fail('PDF 파일만 첨부할 수 있습니다.');
        const filePath=uid+'/'+row.id+'/'+randomUUID()+'.pdf';
        if(access.mode==='local'){const dest=path.join(rootDir,'private/paper/files',...filePath.split('/'));await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,bytes,{mode:0o600});}
        else await upstream('/storage/v1/object/paper-files/'+filePath,{method:'POST',headers:{'Content-Type':'application/pdf','x-upsert':'false'},body:bytes});
        send(res,200,{pdf:{name:input.name,path:filePath,size:bytes.length}});return true;
      }
      if(p==='/api/paper/models'&&req.method==='GET'){
        const provider=url.searchParams.get('provider');if(!PROVIDERS.includes(provider))throw fail('제공사를 확인해 주세요.');const settings=await getSettings(),record=settings?.encrypted_keys?.[provider];if(!record)throw fail('API 키를 먼저 저장해 주세요.');const models=await listModels(provider,decryptKey(record,uid,provider,environment),fetcher);send(res,200,{models});return true;
      }
      if(p==='/api/paper/generate'&&req.method==='POST'){
        if(active.has(uid))throw fail('진행 중인 생성이 끝난 후 다시 실행해 주세요.',429);active.add(uid);
        try{const input=JSON.parse(await body(req,4000)),row=await getProject(input.projectId),settings=await getSettings(),config=publicSettings(settings,environment),provider=config.provider,record=settings?.encrypted_keys?.[provider];if(!record)throw fail('설정에서 선택한 제공사의 API 키를 먼저 저장해 주세요.');
          const task=buildTask(row.data,input,config.prompts),pdf=input.includePdf&&input.action!=='translate'?await getPdf(row.data):null;
          const result=await generate({provider,key:decryptKey(record,uid,provider,environment),model:config.models[provider],...task,pdf},fetcher);
          send(res,200,{...result,sourceRevision:row.revision});return true;
        }finally{active.delete(uid);}
      }
      throw fail('허용되지 않은 요청입니다.',405);
    }catch(error){send(res,error.status||503,{error:error.paperMessage||'Paper 요청을 처리하지 못했습니다. 입력은 보존됩니다.'});return true;}
  };
}
