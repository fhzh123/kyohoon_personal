import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export function expenseRoutes({authorize,authFetch,bearer,send,body,serveFile,rootDir}){
  let writes=Promise.resolve();
  const localFile=path.join(rootDir,'private/card-ledger/state.json');
  const empty=()=>({months:[],settings:{id:'default',revision:null,config:{budgets:{},recurring:{},activeUsers:''}}});
  const readLocal=async()=>{try{return JSON.parse(await readFile(localFile,'utf8'));}catch(e){if(e.code==='ENOENT')return empty();throw e;}};
  const saveLocal=async value=>{await mkdir(path.dirname(localFile),{recursive:true});await writeFile(localFile+'.tmp',JSON.stringify(value));await rename(localFile+'.tmp',localFile);};
  const queue=fn=>{const operation=writes.then(fn);writes=operation.catch(()=>{});return operation;};
  const publicMonth=m=>{const {file_base64,...rest}=m;return rest;};
  return async(req,res,url)=>{
    const pathname=url.pathname;
    if(!(pathname==='/work/expenses'||pathname.startsWith('/work/expenses/')||pathname==='/api/card-ledger'||pathname.startsWith('/api/card-ledger/')))return false;
    const access=await authorize(req,res);
    if(!access){
      if(['GET','HEAD'].includes(req.method)&&['/work/expenses','/work/expenses/','/work/expenses/index.html'].includes(pathname))send(res,303,'','text/plain',{Location:'/login?next='+encodeURIComponent(pathname+url.search)});
      else send(res,401,{error:'허용된 사용자로 로그인해 주세요.'});
      return true;
    }
    try{
      if(pathname==='/work/expenses'||pathname.startsWith('/work/expenses/')){
        if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'허용되지 않은 요청입니다.'});return true;}
        const relative=pathname.replace(/^\/work\/expenses\/?/,'')||'index.html';
        await serveFile(req,res,path.join(rootDir,'work-expenses'),relative);return true;
      }
      const {parseLedger,MAX_FILE_BYTES,LEDGER_SELECT,validateConfig,fail}=await import('./card-ledger.mjs');
      const upstream=async(p,options={})=>{
        const result=await authFetch(p,{...options,headers:{...bearer(access.token),...options.headers}});
        if(!result.ok)throw fail('자료를 저장하거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',503);
        return result;
      };
      if(pathname==='/api/card-ledger'&&req.method==='GET'){
        const year=Number(url.searchParams.get('year')||new Date().getFullYear());if(!Number.isInteger(year)||year<2020||year>2100)throw fail('연도를 확인해 주세요.');
        let months,settings;
        if(access.mode==='local'){const data=await readLocal();months=data.months.filter(m=>m.year===year);settings=data.settings;}
        else{
          const result=await Promise.all([upstream(`/rest/v1/card_ledger_months?year=eq.${year}&select=${LEDGER_SELECT}&order=month.asc`),upstream('/rest/v1/card_ledger_settings?id=eq.default&select=id,revision,config')]);
          months=await result[0].json();settings=(await result[1].json())[0]||empty().settings;
        }
        send(res,200,{months:months.map(publicMonth),settings,role:access.role,mode:access.mode});return true;
      }
      if(pathname==='/api/card-ledger/file'&&req.method==='GET'){
        const id=url.searchParams.get('id');if(!/^20\d{2}-\d{2}-\d{4}$/.test(id||''))throw fail('파일을 찾을 수 없습니다.',404);
        const row=access.mode==='local'?(await readLocal()).months.find(m=>m.id===id):(await(await upstream(`/rest/v1/card_ledger_months?id=eq.${id}&select=file_name,file_base64`)).json())[0];
        if(!row?.file_base64)throw fail('원본 파일을 찾을 수 없습니다.',404);
        send(res,200,Buffer.from(row.file_base64,'base64'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',{'Content-Disposition':`attachment; filename="card-ledger.xlsx"; filename*=UTF-8''${encodeURIComponent(row.file_name)}`});return true;
      }
      if(access.role!=='editor'){send(res,403,{error:'읽기 전용 계정입니다.'});return true;}
      if(['/api/card-ledger/inspect','/api/card-ledger/upload'].includes(pathname)&&req.method==='POST'){
        const input=JSON.parse(await body(req,3*1024*1024));
        if(typeof input.fileBase64!=='string'||input.fileBase64.length>Math.ceil(MAX_FILE_BYTES/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.fileBase64))throw fail('파일 형식이나 크기를 확인해 주세요.');
        const row=parseLedger(Buffer.from(input.fileBase64,'base64'),{fileName:input.fileName,year:input.year,month:input.month,asOf:input.asOf,complete:input.complete,fileModifiedAt:input.fileModifiedAt});
        if(pathname.endsWith('/inspect')){send(res,200,{id:row.id,cardLast4:row.card_last4,count:row.rows.length,amount:row.rows.reduce((n,r)=>n+r.amount,0),firstDate:row.rows.map(r=>r.date).sort()[0],lastDate:row.rows.map(r=>r.date).sort().at(-1),warnings:row.warnings});return true;}
        const expected=input.expectedRevision??null;
        if(access.mode==='local')await queue(async()=>{const data=await readLocal(),old=data.months.find(m=>m.id===row.id);if((old?.revision??null)!==expected)throw fail('다른 변경이 먼저 저장되었습니다. 새로고침 후 다시 업로드해 주세요.',409);data.months=[...data.months.filter(m=>m.id!==row.id),row];await saveLocal(data);});
        else if(expected){
          if(!/^[a-f0-9-]{36}$/.test(expected))throw fail('자료를 다시 불러와 주세요.',409);
          const result=await upstream(`/rest/v1/card_ledger_months?id=eq.${row.id}&revision=eq.${expected}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});
          if(!(await result.json()).length)throw fail('다른 변경이 먼저 저장되었습니다. 새로고침 후 다시 업로드해 주세요.',409);
        }else{
          const result=await authFetch('/rest/v1/card_ledger_months',{method:'POST',headers:{...bearer(access.token),'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(row)});
          if(result.status===409)throw fail('이미 등록된 월입니다. 새로고침 후 교체해 주세요.',409);
          if(!result.ok)throw fail('업로드를 저장하지 못했습니다. 기존 자료는 유지됩니다.',503);
        }
        send(res,200,{month:publicMonth(row)});return true;
      }
      if(pathname==='/api/card-ledger/settings'&&req.method==='PUT'){
        const input=JSON.parse(await body(req,150000)),config=validateConfig(input.config),expected=input.expectedRevision??null,row={id:'default',config,revision:randomUUID(),updated_at:new Date().toISOString()};
        if(access.mode==='local')await queue(async()=>{const data=await readLocal();if((data.settings.revision??null)!==expected)throw fail('다른 설정이 먼저 저장되었습니다. 새로고침 후 다시 저장해 주세요.',409);data.settings=row;await saveLocal(data);});
        else if(expected){
          if(!/^[a-f0-9-]{36}$/.test(expected))throw fail('설정을 다시 불러와 주세요.',409);
          const result=await upstream(`/rest/v1/card_ledger_settings?id=eq.default&revision=eq.${expected}`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(row)});
          if(!(await result.json()).length)throw fail('다른 설정이 먼저 저장되었습니다. 새로고침 후 다시 저장해 주세요.',409);
        }else{
          const result=await authFetch('/rest/v1/card_ledger_settings',{method:'POST',headers:{...bearer(access.token),'Content-Type':'application/json'},body:JSON.stringify(row)});
          if(result.status===409)throw fail('다른 설정이 먼저 저장되었습니다. 새로고침해 주세요.',409);
          if(!result.ok)throw fail('설정을 저장하지 못했습니다.',503);
        }
        send(res,200,{settings:row});return true;
      }
      send(res,405,{error:'허용되지 않은 요청입니다.'});return true;
    }catch(error){send(res,error.status||503,{error:error.ledgerMessage||'요청을 처리하지 못했습니다. 파일과 연결 상태를 확인해 주세요.'});return true;}
  };
}
