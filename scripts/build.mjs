import { execFileSync } from 'node:child_process';
import { readFile, access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,['scripts/build-resume.mjs'],{cwd:root,stdio:'inherit'});
execFileSync(process.execPath,['node_modules/typescript/lib/tsc.js','--noEmit'],{cwd:root,stdio:'inherit'});
// The development entry point is intentionally excluded from deployments.
for(const file of ['server/app.mjs','server/start.mjs','views/pages.mjs','api/index.mjs']) execFileSync(process.execPath,['--check',file],{cwd:root,stdio:'inherit'});
for(const file of ['public/resume/index.html','public/mascot/resume.png','public/mascot/work.png','public/site.css']) await access(path.join(root,file));
const handler=await readFile(path.join(root,'api/index.mjs'),'utf8');
if(!handler.includes('localPreview: false')) throw new Error('Production preview guard missing');
await mkdir(path.join(root,'artifacts'),{recursive:true});
await writeFile(path.join(root,'artifacts/build-result.json'),JSON.stringify({builtAt:new Date().toISOString(),resume:'source built',typecheck:'policy and workspace contracts',productionPreview:false},null,2));
console.log('Build passed: Resume, assets, syntax, policy types and deployment preview guard.');
