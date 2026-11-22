import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
const origin='https://www.kyohoon.app';
const expected=process.env.EXPECT_TRAVEL_VERSION;
const checks=[];
// A push to main starts this check while Vercel may still be switching production
// to the new deployment, so retry server errors for up to ~3 minutes before failing.
async function get(path){
 let response;
 for(let attempt=0;attempt<18;attempt++){
  response=await fetch(new URL(path,origin),{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(response.status<500)break;
  await new Promise(resolve=>setTimeout(resolve,10000));
 }
 assert.equal(response.status,200,path+' must return 200');
 checks.push(path);
 return response;
}
const personal=await(await get('/personal')).text();
assert.match(personal,/여행의 흔적/);
assert.match(personal,/href="\/personal\/gallery"/);
// The Personal hub links each finished tool. Check the links, not a count of
// "coming soon" cards, which changes every time a tool ships.
for(const tool of ['travel','gallery','markdown'])assert.match(personal,new RegExp('href="/personal/'+tool+'"'),'/personal must link /personal/'+tool);
let travel;
for(let attempt=0;attempt<18;attempt++){
 travel=await(await get('/personal/travel')).text();
 if(!expected||travel.includes('/travel/travel.js?v='+expected))break;
 if(attempt===17)throw Error('New travel version did not reach the production domain');
 await new Promise(resolve=>setTimeout(resolve,10000));
}
assert.match(travel,/data-globe/);
const bootstrap=await(await get('/api/travel/bootstrap')).json();
assert.equal(bootstrap.role,'reader');
assert.equal(bootstrap.authenticated,false);
assert.ok(Array.isArray(bootstrap.entries));
for(const key of ['conference','tour','unvisited'])assert.match(bootstrap.settings.config[key],/^#[a-f0-9]{6}$/i);
const regions=await(await get('/travel/regions.json')).json();
assert.ok(regions.length>=4500);
const compressed=Buffer.from(await(await get('/travel/world-regions.topo.bin')).arrayBuffer());
const topology=JSON.parse(gunzipSync(compressed));
assert.equal(topology.type,'Topology');
const geometries=Object.values(topology.objects)[0].geometries;
const registeredIds=regions.map(region=>region.id).sort();
const validMapIds=[...new Set(geometries.filter(geometry=>geometry.type!==null).map(geometry=>geometry.properties.i).filter(id=>/^[A-Z]{3}-[0-9]+$/.test(id)))].sort();
assert.deepEqual(validMapIds,registeredIds,'Every selectable region must match the server registry');
console.log('Map geometries:',geometries.length,'; selectable IDs:',validMapIds.length);

for(const path of ['/travel/travel.js','/travel/travel.css','/travel/d3.min.js','/travel/topojson-client.min.js','/mascot/travel-globe.webp','/mascot/personal-coming-one.webp','/mascot/personal-coming-two.webp']){
 const response=await get(path);assert.ok((await response.arrayBuffer()).byteLength>100);
}
const login=await(await get('/login')).text();
assert.match(login,/name="next" value="\/"/);
const privatePage=await fetch(origin+'/work',{redirect:'manual',signal:AbortSignal.timeout(20000)});
assert.equal(privatePage.status,303);
assert.equal(privatePage.headers.get('location'),'/login?next=%2Fwork');
console.log(JSON.stringify({checked:checks.length,regions:regions.length,entries:bootstrap.entries.length,publicRole:bootstrap.role,loginReturn:'/',privateSpace:'requires login',version:expected||'existing production'},null,2));
