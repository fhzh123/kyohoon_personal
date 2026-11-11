import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHandler } from '../server/app.mjs';

test('Vercel pre-parsed form and JSON bodies authenticate without rereading a consumed stream', async()=>{
  for(const contentType of ['application/json','application/x-www-form-urlencoded']) {
    const sent=[];
    const handler=createHandler({environment:{NODE_ENV:'production',VERCEL:'1',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_ANON_KEY:'synthetic'},fetcher:async(url,options)=>{
      if(url.includes('/token?')){sent.push(JSON.parse(options.body));return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',user:{id:'fixture'}});}
      if(url.includes('/workspace_members?'))return Response.json([{user_id:'fixture',role:'editor'}]);
      throw Error('unexpected');
    }});
    const req=Readable.from([]);Object.assign(req,{url:'/api/auth/login',method:'POST',headers:{host:'fixture.example',origin:'https://fixture.example','content-type':contentType},socket:{remoteAddress:'192.0.2.10'},body:{email:'fixture@example.invalid',password:'synthetic-only'}});
    const headers={};let status;
    const res={setHeader(k,v){headers[k]=v;},writeHead(s,h){status=s;Object.assign(headers,h);},end(){}};
    await handler(req,res);
    assert.equal(status,303);assert.equal(headers.Location,'/work');
    assert.equal(sent.length,1);assert.equal(sent[0].email,'fixture@example.invalid');
  }
});

test('a different origin scheme cannot post credentials even when the host matches',async()=>{
  const handler=createHandler({environment:{NODE_ENV:'production',VERCEL:'1'}});
  const req=Readable.from([]);Object.assign(req,{url:'/api/auth/login',method:'POST',headers:{host:'fixture.example',origin:'http://fixture.example'},socket:{remoteAddress:'192.0.2.10'}});
  let status;const res={writeHead(s){status=s;},end(){}};
  await handler(req,res);assert.equal(status,403);
});
