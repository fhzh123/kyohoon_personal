import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function walk(dir){const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const draftDir=path.join(root,'Assets/Draft');
const draftMarkdown=(await walk(draftDir)).find(p=>p.endsWith('.md'));
const draft=await fs.readFile(draftMarkdown,'utf8');
const temporarySecret=draft.match(/비밀번호는\s*[‘']([^’']+)[’']/)?.[1];
if(!temporarySecret) throw Error('Draft credential audit cannot determine source pattern.');
const checked=[];
for(const dir of ['server','views','public','work-app','docs','api','scripts','supabase','types','tests']) {
  for(const file of await walk(path.join(root,dir))) {
    if(!/\.(mjs|js|css|html|md|sql|ts|json|txt|example)$/.test(file))continue;
    if((await fs.readFile(file,'utf8')).includes(temporarySecret))throw Error('Sensitive Draft value found in an authored file; delivery stopped.');
    checked.push(path.relative(root,file));
  }
}
const publicPaths=await walk(path.join(root,'public'));
if(publicPaths.some(p=>p.includes('workspace-state')||p.includes('taxonomy-source')||p.includes('legacy-seed')))throw Error('Private data in public files.');
const ignore=await fs.readFile(path.join(root,'.vercelignore'),'utf8');
for(const excluded of ['private/','Assets/','artifacts/','server/dev.mjs'])if(!ignore.split(/\r?\n/).includes(excluded))throw Error('Deployment exclusion missing.');
const production=await fs.readFile(path.join(root,'server/start.mjs'),'utf8');
if(!production.includes('localPreview:false')||production.includes("process.argv.includes('--dev')"))throw Error('Production preview guard changed.');
const json=await fs.readFile(path.join(root,'package-lock.json'),'utf8');
const lock=JSON.parse(json),pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
for(const [name,version] of Object.entries(pkg.devDependencies))if(lock.packages[''].devDependencies[name]!==version||lock.packages[`node_modules/${name}`]?.version!==version)throw Error('Lockfile mismatch.');
await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
await fs.writeFile(path.join(root,'artifacts/delivery-check.json'),JSON.stringify({checkedAt:new Date().toISOString(),authoredTextFilesChecked:checked.length,temporaryCredentialNotCopied:true,noPrivateStaticData:true,deploymentExclusions:true,productionPreviewDisabled:true,lockfileDirectVersions:true},null,2));
console.log('Delivery audit passed: secret not copied; public/deployment boundaries; production gate; lockfile.');
