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

for(const f of ['server/paper-core.mjs','server/paper-providers.mjs','server/paper-routes.mjs','views/paper.mjs','public/paper.js'])execFileSync(process.execPath,['--check',f],{cwd:root,stdio:'inherit'});
await access(path.join(root,'public/paper.css'));
await access(path.join(root,'public/mascot/paper.png'));

await access(path.join(root,'public/mascot/paper-hover.png'));
for(const f of ['views/settings.mjs','public/settings.js','public/theme.js'])execFileSync(process.execPath,['--check',f],{cwd:root,stdio:'inherit'});
for(const f of ['public/settings.css','public/icons/ui-settings.svg','public/mascot/personal-t1.png'])await access(path.join(root,f));

for(const f of ['server/appearance-routes.mjs','public/background.js','public/appearance-settings.js'])execFileSync(process.execPath,['--check',f],{cwd:root,stdio:'inherit'});
for(const f of ['public/background.css','public/icons/venues/acl.svg'])await access(path.join(root,f));

await access(path.join(root,'public/mascot/login-required.png'));

for(const f of ['server/demo-routes.mjs'])execFileSync(process.execPath,['--check',f],{cwd:root,stdio:'inherit'});
for(const f of ['work-demos/ontology/index.html','work-demos/document-parsing/index.html','work-demos/ontology/outputs/evaluation_results.html','work-demos/ontology/outputs/hits5_case_analysis.html','public/demo-links.css'])await access(path.join(root,f));

// Validate every demo image/data artifact and the delivery handler before deployment.
await import('./check-demo-resources.mjs');

// Travel is served from the same production handler; all map code and assets are local.
for(const f of ['server/travel-routes.mjs','views/travel.mjs','public/travel/travel.js','public/travel-settings.js'])execFileSync(process.execPath,['--check',f],{cwd:root,stdio:'inherit'});
for(const f of ['public/personal.css','public/home-refinement.css','public/travel/travel.css','public/travel/world-regions.topo.bin','public/travel/d3.min.js','public/travel/topojson-client.min.js',...['travel-globe','personal-coming-one','personal-coming-two'].map(n=>'public/mascot/'+n+'.webp')])await access(path.join(root,f));
const travelRegions=JSON.parse(await readFile(path.join(root,'public/travel/regions.json'),'utf8'));
if(travelRegions.length<4500||travelRegions.some(r=>!/^([A-Z]{3}-[0-9]+)$/.test(r.id))||new Set(travelRegions.map(r=>r.id)).size!==travelRegions.length)throw new Error('Travel region registry is incomplete');
console.log('Travel assets, syntax and worldwide region registry verified.');
