import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual, randomUUID } from 'node:crypto';
import { homePage, loginPage, workPage } from '../views/pages.mjs';
import { previewAllowed, safeRelativePath, validState } from './policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.ttf':'font/ttf','.json':'application/json; charset=utf-8','.pdf':'application/pdf'};
const cookieNames = ['kh_access', 'kh_refresh', 'kh_local'];
const securityHeaders = {
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'same-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};

/** All confidential routes enter this handler and authorize before opening files. */
export function createHandler({localPreview = false, rootDir = root, environment = process.env, fetcher = fetch} = {}) {
  const localToken = randomBytes(32).toString('hex');
  const attempts = new Map();
  // Serialize local writes; check the revision inside this queue, never before it.
  let writes = Promise.resolve();
  const configured = Boolean(environment.SUPABASE_URL && environment.SUPABASE_ANON_KEY);
  const supabaseBase = configured ? environment.SUPABASE_URL.replace(/\/$/, '') : '';
  const baseHeaders = {apikey: environment.SUPABASE_ANON_KEY || ''};
  const preview = req => previewAllowed({ enabled: localPreview && environment.LOCAL_WORK_PREVIEW !== '0', development: environment.NODE_ENV === 'development', vercel: Boolean(environment.VERCEL), host: req.headers.host, address: req.socket?.remoteAddress });
  const send = (res, status, value, contentType = 'application/json; charset=utf-8', extras = {}) => {
    res.writeHead(status, {...securityHeaders, 'Cache-Control':'private, no-store, max-age=0', 'Content-Type':contentType, ...extras});
    res.end(Buffer.isBuffer(value) || typeof value === 'string' ? value : JSON.stringify(value));
  };
  const redirect = (res, location, cookies) => send(res, 303, '', 'text/plain', {Location:location, ...(cookies ? {'Set-Cookie':cookies} : {})});
  const setCookie = (name,value,maxAge=3600) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${environment.NODE_ENV === 'production' || environment.VERCEL ? '; Secure' : ''}`;
  const cookiesOf = req => Object.fromEntries(String(req.headers.cookie || '').split(';').map(x=>x.trim().split(/=(.*)/s)).filter(x=>x.length>1).map(([k,v])=>[k, decodeCookie(v)]));
  const authFetch = async (url, options = {}) => fetcher(supabaseBase + url, {...options, signal:AbortSignal.timeout(12000), headers:{...baseHeaders,...options.headers}});
  const bearer = token => ({Authorization:`Bearer ${token}`});
  const member = async token => {
    const response = await authFetch('/rest/v1/workspace_members?select=user_id,role&active=eq.true', {headers:bearer(token)});
    if (!response.ok) return null;
    const rows = await response.json();
    return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  };
  async function authorize(req, res) {
    const cookies = cookiesOf(req);
    if (preview(req) && secureEqual(cookies.kh_local,localToken)) return {mode:'local',role:'editor',userId:'localhost',token:''};
    if (!configured || !cookies.kh_access) return null;
    let token = cookies.kh_access;
    let response = await authFetch('/auth/v1/user', {headers:bearer(token)});
    if (response.status === 401 && cookies.kh_refresh) {
      const refreshed = await authFetch('/auth/v1/token?grant_type=refresh_token', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:cookies.kh_refresh})});
      if (!refreshed.ok) return null;
      const session = await refreshed.json();
      token = session.access_token;
      response = await authFetch('/auth/v1/user',{headers:bearer(token)});
      if (response.ok) res.setHeader('Set-Cookie',[setCookie('kh_access',token),setCookie('kh_refresh',session.refresh_token,60*60*24*7)]);
    }
    if (!response.ok) return null;
    const user = await response.json();
    const membership = await member(token);
    if (!membership || membership.user_id !== user.id) return null;
    return {mode:'supabase',role:membership.role,userId:user.id,token};
  }
  async function localEnvelope() {
    return JSON.parse(await readFile(path.join(rootDir,'private/work/workspace-state.json'),'utf8'));
  }
  async function remoteRecord(access) {
    const result = await authFetch('/rest/v1/workspaces?id=eq.research&select=state,revision,updated_at,taxonomy_source,legacy_seed',{headers:bearer(access.token)});
    if (!result.ok) throw new Error('data unavailable');
    const rows = await result.json();
    if (!rows.length) throw new Error('not imported');
    return rows[0];
  }
  async function stateEnvelope(access) {
    if (access.mode === 'local') return localEnvelope();
    const record = await remoteRecord(access);
    return {revision:String(record.revision), state:record.state,updatedAt:record.updated_at};
  }
  async function serveFile(req,res,base,relative) {
    const safe = safeRelativePath(relative);
    if (safe === null) return send(res,404,{error:'찾을 수 없습니다.'});
    const resolved = path.resolve(base,safe);
    if (resolved !== base && !resolved.startsWith(base+path.sep)) return send(res,404,{error:'찾을 수 없습니다.'});
    try { const data = await readFile(resolved); return send(res,200,req.method === 'HEAD' ? '' : data,mime[path.extname(resolved)] || 'application/octet-stream'); }
    catch { return send(res,404,{error:'찾을 수 없습니다.'}); }
  }
  return async function handler(req,res) {
    try {
      const requestUrl = new URL(req.url,'http://local.invalid');
      const pathname = requestUrl.pathname;
      if (!['GET','HEAD','POST','PUT'].includes(req.method)) return send(res,405,{error:'허용되지 않은 요청입니다.'});
      if (['POST','PUT'].includes(req.method) && !sameOrigin(req,environment)) return send(res,403,{error:'다른 출처의 요청은 허용되지 않습니다.'});

      if (pathname === '/api/auth/login' && req.method === 'POST') {
        if (!configured) return send(res,503,{error:'인증 설정 전입니다.'});
        const ip = req.socket?.remoteAddress || 'unknown';
        const now = Date.now();
        const recent = (attempts.get(ip) || []).filter(t=>now-t<600000);
        if (recent.length >= 8) return send(res,429,{error:'잠시 후 다시 시도해 주세요.'});
        recent.push(now); attempts.set(ip,recent);
        if (attempts.size > 500) attempts.delete(attempts.keys().next().value);
        const raw = await body(req,16384);
        const values = String(req.headers['content-type']||'').includes('application/json') ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
        const result = await authFetch('/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:values.email,password:values.password})});
        if (!result.ok) return send(res,401,loginPage({configured,preview:preview(req),message:'이메일 또는 비밀번호를 확인해 주세요.'}),'text/html; charset=utf-8');
        const session = await result.json();
        const membership = await member(session.access_token);
        if (!membership || membership.user_id !== session.user?.id) return send(res,403,loginPage({configured,preview:preview(req),message:'이 계정에는 업무 공간 접근 권한이 없습니다.'}),'text/html; charset=utf-8');
        return redirect(res,'/work',[setCookie('kh_access',session.access_token),setCookie('kh_refresh',session.refresh_token,604800)]);
      }
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        const access = cookiesOf(req).kh_access;
        if (access && configured) await authFetch('/auth/v1/logout',{method:'POST',headers:bearer(access)}).catch(()=>{});
        res.setHeader('Clear-Site-Data','"cache", "storage"');
        return redirect(res,'/work',cookieNames.map(n=>setCookie(n,'',0)));
      }
      if (pathname === '/work/preview') {
        if (req.method !== 'GET') return send(res,405,{error:'허용되지 않은 요청입니다.'});
        if (!preview(req)) return send(res,404,{error:'찾을 수 없습니다.'});
        try { await localEnvelope(); } catch { return send(res,503,{error:'프로젝트에 업무 자료를 먼저 가져와 주세요.'}); }
        return redirect(res,'/work',setCookie('kh_local',localToken,3600));
      }
      if (pathname === '/work' || pathname === '/work/') {
        const access = await authorize(req,res);
        if (access) return send(res,200,workPage(access),'text/html; charset=utf-8');
        return send(res,200,loginPage({configured,preview:preview(req)}),'text/html; charset=utf-8');
      }
      if (pathname.startsWith('/work/app/') || pathname === '/api/research-state' || pathname === '/api/work-bootstrap') {
        const access = await authorize(req,res);
        if (!access) return send(res,401,{error:'허용된 사용자로 로그인해 주세요.'});
        if (pathname === '/api/work-bootstrap' && req.method === 'GET') {
          let workspace,taxonomySource,legacySeed;
          if (access.mode === 'local') {
            workspace = await localEnvelope();
            taxonomySource = JSON.parse(await readFile(path.join(rootDir,'private/work/taxonomy-source.json'),'utf8'));
            legacySeed = JSON.parse(await readFile(path.join(rootDir,'private/work/legacy-seed.json'),'utf8'));
          } else {
            const row = await remoteRecord(access);
            workspace={revision:String(row.revision),state:row.state,updatedAt:row.updated_at};
            taxonomySource=row.taxonomy_source; legacySeed=row.legacy_seed;
          }
          return send(res,200,{workspace,taxonomySource,legacySeed,context:{mode:access.mode,storageKey:`kyohoon-work-${access.mode}-${access.userId}`,role:access.role}});
        }
        if (pathname === '/api/research-state') {
          if (req.method === 'GET') return send(res,200,await stateEnvelope(access));
          if (req.method !== 'PUT') return send(res,405,{error:'허용되지 않은 요청입니다.'});
          if (access.role !== 'editor') return send(res,403,{error:'읽기 전용 계정입니다.'});
          const incoming = JSON.parse(await body(req,5*1024*1024));
          if (!validState(incoming.state)) return send(res,400,{error:'업무 자료 형식이 올바르지 않습니다.'});
          if (access.mode === 'local') {
            const operation = writes.then(async () => {
              const current = await localEnvelope();
              if (String(incoming.revision) !== String(current.revision)) return send(res,409,{error:'다른 변경이 먼저 저장되었습니다.',...current});
              const next={revision:randomUUID(),updatedAt:new Date().toISOString(),state:incoming.state};
              const destination=path.join(rootDir,'private/work/workspace-state.json');
              await mkdir(path.join(rootDir,'private/work/backups'),{recursive:true});
              await writeFile(path.join(rootDir,'private/work/backups',`${Date.now()}-${randomUUID()}.json`),JSON.stringify(current));
              await writeFile(destination+'.tmp',JSON.stringify(next,null,2)); await rename(destination+'.tmp',destination);
              return send(res,200,next);
            });
            writes=operation.catch(()=>{}); return await operation;
          }
          if (!/^\d+$/.test(String(incoming.revision))) return send(res,409,{error:'자료를 새로 불러와 주세요.'});
          const nextRevision = Number(incoming.revision)+1;
          const result = await authFetch(`/rest/v1/workspaces?id=eq.research&revision=eq.${incoming.revision}`,{method:'PATCH',headers:{...bearer(access.token),'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({state:incoming.state,revision:nextRevision,updated_at:new Date().toISOString()})});
          if (!result.ok) return send(res,503,{error:'저장에 실패했습니다. 다시 시도해 주세요.'});
          const rows = await result.json();
          if (!rows.length) return send(res,409,{error:'다른 변경이 먼저 저장되었습니다.',...await stateEnvelope(access)});
          return send(res,200,{revision:String(rows[0].revision),state:rows[0].state,updatedAt:rows[0].updated_at});
        }
        const relative = pathname.slice('/work/app/'.length);
        if (relative.startsWith('assets/')) {
          if (access.mode === 'local') return serveFile(req,res,path.join(rootDir,'private/work/assets'),relative.slice(7));
          const safe = safeRelativePath(relative.slice(7));
          if (!safe) return send(res,404,{error:'찾을 수 없습니다.'});
          const result = await authFetch(`/storage/v1/object/authenticated/work-attachments/research/${safe.split('/').map(encodeURIComponent).join('/')}`,{headers:bearer(access.token)});
          if (!result.ok) return send(res,404,{error:'첨부파일을 찾을 수 없습니다.'});
          return send(res,200,Buffer.from(await result.arrayBuffer()),mime[path.extname(safe)]||'application/octet-stream');
        }
        if (!['GET','HEAD'].includes(req.method)) return send(res,405,{error:'허용되지 않은 요청입니다.'});
        return serveFile(req,res,path.join(rootDir,'work-app'),relative);
      }
      if (!['GET','HEAD'].includes(req.method)) return send(res,405,{error:'허용되지 않은 요청입니다.'});
      if (pathname === '/') return send(res,200,homePage(),'text/html; charset=utf-8');
      if (pathname === '/resume' || pathname === '/resume/') return serveFile(req,res,path.join(rootDir,'public/resume'),'index.html');
      // Only public is exposed. Never expose project files, source, private data or docs.
      return serveFile(req,res,path.join(rootDir,'public'),pathname);
    } catch (error) {
      // Never log passwords, tokens, upstream bodies, file contents or private filenames.
      const status=error?.status || 503;
      return send(res,status,{error:status===413?'요청이 너무 큽니다.':'요청을 처리하지 못했습니다. 설정과 연결 상태를 확인해 주세요.'});
    }
  };
}
function decodeCookie(value) { try{return decodeURIComponent(value);}catch{return '';} }
function secureEqual(a,b) { const left=Buffer.from(a||''); const right=Buffer.from(b||''); return left.length===right.length && timingSafeEqual(left,right); }
function sameOrigin(req,environment) {
  const origin=req.headers.origin;
  if (!origin) return req.headers['sec-fetch-site'] !== 'cross-site';
  const protocol = environment.VERCEL || req.socket?.encrypted ? 'https:' : 'http:';
  try { return new URL(origin).origin === `${protocol}//${req.headers.host}`; } catch { return false; }
}
async function body(req,max) {
  // Vercel Node functions may already have parsed the incoming request body.
  if (req.body !== undefined) {
    const value=Buffer.isBuffer(req.body)?req.body.toString('utf8'):typeof req.body==='string'?req.body:String(req.headers['content-type']||'').includes('application/x-www-form-urlencoded')?new URLSearchParams(req.body).toString():JSON.stringify(req.body);
    if(Buffer.byteLength(value)>max){const e=new Error('too large');e.status=413;throw e;}
    return value;
  }
  let length=0; const chunks=[];
  for await (const chunk of req) {length+=Buffer.byteLength(chunk);if(length>max){const e=new Error('too large');e.status=413;throw e;}chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks).toString('utf8');
}
