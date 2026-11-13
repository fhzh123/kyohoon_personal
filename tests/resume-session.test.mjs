import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../server/app.mjs';

const environment={NODE_ENV:'production',SUPABASE_URL:'https://auth.test.invalid',SUPABASE_ANON_KEY:'public-test-key'};
function makeHandler(){
  return createHandler({environment,fetcher:async(url,options)=>{
    const valid=options.headers.Authorization==='Bearer verified';
    if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify(valid?{id:'member-1'}:{error:'invalid token'}),{status:valid?200:401});
    if(url.includes('/rest/v1/workspace_members'))return new Response(JSON.stringify(valid?[{user_id:'member-1',role:'editor'}]:[]));
    throw Error('Unexpected upstream request');
  }});
}
async function request(cookie='',method='GET'){
  const req={url:'/resume',method,headers:{host:'kyohoon.app',cookie},socket:{remoteAddress:'203.0.113.5'}};
  let resolve;const finished=new Promise(r=>resolve=r);
  const result={headers:{},status:0,body:''};
  const res={setHeader(k,v){result.headers[k]=v},writeHead(status,headers){result.status=status;Object.assign(result.headers,headers)},end(value){result.body=String(value??'');resolve()}};
  await makeHandler()(req,res);await finished;return result;
}
test('public Resume remains available and marks anonymous requests unauthenticated',async()=>{
  const result=await request();assert.equal(result.status,200);assert.match(result.body,/RESUME_SESSION=\{authenticated:false\}/);assert.match(result.headers['Cache-Control'],/no-store/);
});
test('validated Supabase identity and membership enable the Home shortcut',async()=>{
  const result=await request('kh_access=verified');assert.equal(result.status,200);assert.match(result.body,/RESUME_SESSION=\{authenticated:true\}/);
});
test('forged or expired session cookies keep the Home shortcut disabled',async()=>{
  const result=await request('kh_access=forged');assert.equal(result.status,200);assert.match(result.body,/RESUME_SESSION=\{authenticated:false\}/);
});
test('HEAD returns no HTML body',async()=>{const result=await request('','HEAD');assert.equal(result.status,200);assert.equal(result.body,'');});
