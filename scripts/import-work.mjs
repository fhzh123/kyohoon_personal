import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Source is intentionally a CLI argument, never a machine-specific runtime path.
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const sourceArg = args[0] === '--source' && args.length === 2 ? args[1]
  : args.length === 1 && !args[0].startsWith('--') ? args[0]
  : args.length === 0 ? (process.env.WORK_SOURCE_DIR || process.env.WORK_IMPORT_SOURCE) : undefined;
if (!sourceArg) throw new Error('Usage: node scripts/import-work.mjs [--source] <read-only research source folder>, or set WORK_SOURCE_DIR');
const source = path.resolve(sourceArg);
const appSource = path.join(source, 'research-planner');
const appOut = path.join(root, 'work-app');
const privateOut = path.join(root, 'private/work');
await fs.mkdir(appOut, { recursive: true });
await fs.mkdir(path.join(privateOut, 'assets'), { recursive: true });
if (!(await fs.stat(appSource)).isDirectory()) throw new Error('Source must contain a research-planner directory.');
async function preserveExisting(destination, bytes) {
  try { await fs.writeFile(destination, bytes, {flag:'wx'}); return true; }
  catch (error) { if (error.code !== 'EEXIST') throw error; return false; }
}
const sourceManifest = [];
async function read(relative) {
  const bytes = await fs.readFile(path.join(source, relative));
  sourceManifest.push({ path: relative.replaceAll('\\', '/'), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
  return bytes;
}
const assetNames = new Map([
  ['Roadmap.png', 'roadmap.png'], ['Draft_Goal.png', 'draft-goal.png'],
  ['셀동이_로고.png', 'celdong-logo.png'], ['셀동이_이미지.png', 'celdong.png'],
  ['셀렉트스타_로고.png', 'selectstar-logo.png'],
]);
const names = await fs.readdir(path.join(source, 'Asset'));
for (const [canonical, output] of assetNames) {
  const actual = names.find(name => name.normalize('NFC') === canonical.normalize('NFC'));
  if (!actual) throw new Error('Missing original asset: ' + canonical);
  await fs.writeFile(path.join(privateOut, 'assets', output), await read(path.join('Asset', actual)));
}
const normalizeReference = value => {
  if (typeof value !== 'string') return value;
  const file = value.split('/').at(-1).normalize('NFC');
  return assetNames.has(file) ? '/work/app/assets/' + assetNames.get(file) : value;
};
function normalizeState(state) {
  return { ...state, references: state.references.map(item => ({ ...item, src: normalizeReference(item.src) })) };
}
const seedCode = (await read('research-planner/seed.js')).toString('utf8');
const legacySeed = normalizeState(JSON.parse(seedCode.slice(seedCode.indexOf('window.RESEARCH_SEED = ') + 'window.RESEARCH_SEED = '.length).trim().replace(/;\s*$/, '')));
await preserveExisting(path.join(privateOut, 'legacy-seed.json'), JSON.stringify(legacySeed, null, 2) + '\n');
const taxonomy = JSON.parse((await read('research-planner/sources/taxonomy-source.json')).toString('utf8'));
await preserveExisting(path.join(privateOut, 'taxonomy-source.json'), JSON.stringify(taxonomy, null, 2) + '\n');
await fs.writeFile(path.join(privateOut, 'assets/technology-asset-map.xlsx'), await read('research-planner/sources/technology-asset-map.xlsx'));
const originalState = JSON.parse((await read('research-planner/data/workspace-state.json')).toString('utf8'));
originalState.state = normalizeState(originalState.state);
try {
  await fs.writeFile(path.join(privateOut, 'workspace-state.json'), JSON.stringify(originalState, null, 2) + '\n', { flag: 'wx' });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Existing project workspace preserved; import did not overwrite local edits.');
}
const files = (await fs.readdir(appSource)).filter(name => /\.(js|css|html)$/.test(name) && name !== 'seed.js');
for (const name of files) {
  let code = (await read(path.join('research-planner', name))).toString('utf8');
  if (name === 'taxonomy.js') {
    code = code.replace(/^  const source = .*;\r?$/m, '  const source = global.RESEARCH_TAXONOMY_SOURCE;');
    code = code.replace(/^  const legacySeed = .*;\r?$/m, '  const legacySeed = global.RESEARCH_LEGACY_SEED;');
  }
  if (name === 'app.js') {
    code = code.replace("KEY = 'selectstar-research-atlas-v1'", "KEY = window.WORK_CONTEXT.storageKey");
    code = code.replace(/const notice=\$\('#workspace-notice'\);if\(notice\)\{notice\.hidden=.*?;\}\},/, "},");
  }
  if (name === 'workspace-sync.js') {
    code = code.replace("if (location.protocol === 'http:' && ['localhost','127.0.0.1'].includes(location.hostname)) await refresh();", "if (window.WORK_CONTEXT && ['local','supabase'].includes(window.WORK_CONTEXT.mode)) await refresh();");
    code = code.replaceAll('공유 파일', '업무 저장소').replaceAll('공유 저장', '업무 저장');
  }
  if (name === 'index.html') {
    for (const [canonical, output] of assetNames) {
      code = code.replaceAll('../Asset/' + canonical, '/work/app/assets/' + output);
      code = code.replaceAll('../Asset/' + canonical.normalize('NFD'), '/work/app/assets/' + output);
    }
    code = code.replace(/  <script src="seed\.js[^\n]*\r?\n(?:  <script[^\n]*\r?\n)*/m, '  <script src="bootstrap.js" defer></script>\n');
    code = code.replace('<div class="page-content">', '<div class="page-content"><div class="integration-notice" id="integration-notice" role="status">업무 연결을 확인하고 있습니다.</div>');
    code = code.replace('<div class="topbar-actions">', '<div class="topbar-actions"><a class="secondary-button home-link" href="/">홈으로</a>');
    code = code.replace('</head>', '  <link rel="stylesheet" href="integration.css">\n</head>');
  }
  // Integrated reader/logout fixes and other existing app changes survive re-imports.
  await preserveExisting(path.join(appOut, name), code);
}
await preserveExisting(path.join(privateOut, 'source-manifest.json'), JSON.stringify(sourceManifest, null, 2) + '\n');
await fs.appendFile(path.join(privateOut, 'import-log.jsonl'), JSON.stringify({importedAt:new Date().toISOString(),sourceFiles:sourceManifest}) + '\n');
console.log('Work source imported to guarded work-app + private/work; source files were read only.');
