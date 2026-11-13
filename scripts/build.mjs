import { execFileSync } from 'node:child_process';
import { readFile, access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,['scripts/build-resume.mjs'],{cwd:root,stdio:'inherit'});
execFileSync(process.execPath,['node_modules/typescript/lib/tsc.js','--noEmit'],{cwd:root,stdio:'inherit'});
// The development entry point is intentionally excluded from deployments.
for(const file of ['server/app.mjs','server/start.mjs','views/pages.mjs','api/index.mjs','server/card-ledger.mjs','server/expense-routes.mjs','work-expenses/app.js','work-expenses/core.js','public/theme.js','public/auth.js','public/loading.js','public/galaxy.js']) execFileSync(process.execPath,['--check',file],{cwd:root,stdio:'inherit'});
for(const file of ['public/resume/index.html','public/mascot/resume.png','public/mascot/login-mascots.png','public/auth.css','public/icons/ui-log-in.svg','public/mascot/work.png','public/site.css','public/spaces.css',...['selectstar-idle','selectstar-hover','personal-idle','personal-build','resume-hover','journal','demo','ontology','parsing','expenses','galaxy'].map(name=>'public/mascot/'+name+'.webp'),'public/mascot/selectstar-logo.png']) await access(path.join(root,file));
const handler=await readFile(path.join(root,'api/index.mjs'),'utf8');
if(!handler.includes('localPreview: false')) throw new Error('Production preview guard missing');
await mkdir(path.join(root,'artifacts'),{recursive:true});
await writeFile(path.join(root,'artifacts/build-result.json'),JSON.stringify({builtAt:new Date().toISOString(),resume:'source built',typecheck:'policy and workspace contracts',productionPreview:false},null,2));
console.log('Build passed: Resume, assets, syntax, policy types and deployment preview guard.');

const researchScripts = ['papers.js','taxonomy.js','notebook.js','periods.js','hierarchy.js','timeline.js','calendar.js','workspace-sync.js','app.js'];
const researchStyles = ['styles.css','details.css','planning.css','hierarchy.css','taxonomy.css','integration.css','features.css'];
const scripts = await Promise.all(researchScripts.map(file => readFile(path.join(root,'work-app',file),'utf8')));
const css = await Promise.all(researchStyles.map(file => readFile(path.join(root,'work-app',file),'utf8')));
const bootstrap = await readFile(path.join(root,'work-app/bootstrap.js'),'utf8');
await writeFile(path.join(root,'work-app/workspace.bundle.js'),'window.startResearchAtlas = function () {\n'+scripts.join('\n;\n')+'\n};\n'+bootstrap);
await writeFile(path.join(root,'work-app/workspace.bundle.css'),css.join('\n'));
execFileSync(process.execPath,['--check','work-app/workspace.bundle.js'],{cwd:root,stdio:'inherit'});
console.log('Research UI bundled: one script and one stylesheet; private data excluded.');
