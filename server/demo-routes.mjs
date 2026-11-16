import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {safeRelativePath} from './policy.mjs';

const formats={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};

export function demoRoutes({authorize,send,rootDir}) {
  return async (req,res,url) => {
    if(!url.pathname.startsWith('/work/demos/'))return false;
    const match=/^\/work\/demos\/(ontology|document-parsing)(\/.*)?$/.exec(url.pathname);
    if(!match)return false;
    if(!['GET','HEAD'].includes(req.method)){send(res,405,{error:'허용되지 않은 요청입니다.'});return true;}
    const access=await authorize(req,res);
    if(!access){send(res,303,'','text/plain',{Location:'/login?next='+encodeURIComponent(url.pathname+url.search)});return true;}
    if(!match[2]){send(res,308,'','text/plain',{Location:url.pathname+'/'+url.search});return true;}
    const relative=safeRelativePath(match[2]==='/'?'index.html':match[2]);
    const format=relative&&formats[path.extname(relative)];
    if(!relative||!format){send(res,404,{error:'찾을 수 없습니다.'});return true;}
    // Keep the original page URLs working while using an explicitly included resource directory.
    const resource=relative.replace(/^assets\//,'resources/');
    const file=path.join(rootDir,'work-demos',match[1],resource);
    try {
      const acceptsGzip=String(req.headers['accept-encoding']||'').split(',').some(value=>/^gzip(?:\s*;\s*q=(?!0(?:\.0*)?$)[\d.]+)?\s*$/i.test(value.trim()));
      let data,compressed=false;
      if(acceptsGzip&&['.html','.js'].includes(path.extname(file))){
        try{data=await readFile(file+'.gz');compressed=true;}catch{}
      }
      data??=await readFile(file);
      send(res,200,req.method==='HEAD'?'':data,format,{Vary:'Accept-Encoding',...(compressed?{'Content-Encoding':'gzip'}:{})});
    }catch{send(res,404,{error:'찾을 수 없습니다.'});}
    return true;
  };
}
