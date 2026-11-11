import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));

test('Work importer accepts all source settings and preserves integrated code and existing private data',async()=>{
  const artifacts=path.join(root,'artifacts');
  await fs.mkdir(artifacts,{recursive:true});
  const sandbox=await fs.mkdtemp(path.join(artifacts,'test-import-'));
  try {
    const project=path.join(sandbox,'project'),source=path.join(sandbox,'source');
    const script=path.join(project,'scripts/import-work.mjs');
    await fs.mkdir(path.dirname(script),{recursive:true});
    await fs.copyFile(path.join(root,'scripts/import-work.mjs'),script);
    await fs.mkdir(path.join(source,'research-planner/sources'),{recursive:true});
    await fs.mkdir(path.join(source,'research-planner/data'),{recursive:true});
    await fs.mkdir(path.join(source,'Asset'),{recursive:true});
    for(const name of ['Roadmap.png','Draft_Goal.png','셀동이_로고.png','셀동이_이미지.png','셀렉트스타_로고.png'])
      await fs.writeFile(path.join(source,'Asset',name),'synthetic fixture');
    const state={version:4,goals:[],phases:[],tasks:[],notes:[],references:[]};
    await fs.writeFile(path.join(source,'research-planner/seed.js'),'window.RESEARCH_SEED = '+JSON.stringify(state)+';');
    await fs.writeFile(path.join(source,'research-planner/app.js'),'// original fixture app');
    await fs.writeFile(path.join(source,'research-planner/index.html'),'<!doctype html><title>Fixture</title>');
    await fs.writeFile(path.join(source,'research-planner/sources/taxonomy-source.json'),JSON.stringify({catalog:[]}));
    await fs.writeFile(path.join(source,'research-planner/sources/technology-asset-map.xlsx'),'synthetic attachment');
    await fs.writeFile(path.join(source,'research-planner/data/workspace-state.json'),JSON.stringify({revision:'fixture-original',state}));
    const run=(args,env={})=>{
      const result=spawnSync(process.execPath,[script,...args],{cwd:project,env:{...process.env,...env},encoding:'utf8'});
      assert.equal(result.status,0,result.stderr||result.stdout);
    };
    run(['--source',source]);
    const destination=path.join(project,'private/work/workspace-state.json');
    const code=path.join(project,'work-app/app.js');
    const firstManifest=await fs.readFile(path.join(project,'private/work/source-manifest.json'),'utf8');
    await fs.writeFile(code,'// integrated reader and logout fixes');
    const edited=JSON.stringify({revision:'project-edited',state});
    await fs.writeFile(destination,edited);
    await fs.writeFile(path.join(source,'research-planner/app.js'),'// source changed after first import');
    await fs.writeFile(path.join(source,'research-planner/data/workspace-state.json'),JSON.stringify({revision:'new-source',state}));
    run([source]);
    run([],{WORK_SOURCE_DIR:source});
    assert.equal(await fs.readFile(code,'utf8'),'// integrated reader and logout fixes');
    assert.equal(await fs.readFile(destination,'utf8'),edited);
    assert.equal(await fs.readFile(path.join(project,'private/work/source-manifest.json'),'utf8'),firstManifest);
    assert.equal((await fs.readFile(path.join(project,'private/work/import-log.jsonl'),'utf8')).trim().split('\n').length,3);
    assert.equal(await fs.readFile(path.join(source,'research-planner/app.js'),'utf8'),'// source changed after first import');
  } finally {
    // Only the unique sandbox created above may be removed.
    const resolved=path.resolve(sandbox);
    assert.equal(path.dirname(resolved),path.resolve(artifacts));
    assert.ok(path.basename(resolved).startsWith('test-import-'));
    await fs.rm(resolved,{recursive:true,force:true});
  }
});
