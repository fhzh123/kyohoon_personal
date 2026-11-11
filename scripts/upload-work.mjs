import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const privateRoot = path.join(root, 'private/work');
const apply = process.argv.includes('--upload');
const unknown = process.argv.slice(2).filter(arg => !['--upload', '--dry-run'].includes(arg));
if (unknown.length || (process.argv.includes('--dry-run') && apply)) {
  throw new Error('Usage: node scripts/upload-work.mjs [--dry-run | --upload]');
}
const readJson = async name => JSON.parse(await readFile(path.join(privateRoot, name), 'utf8'));
const workspace = await readJson('workspace-state.json');
const taxonomySource = await readJson('taxonomy-source.json');
const legacySeed = await readJson('legacy-seed.json');
if (!workspace.state || ![1,2,3,4].includes(workspace.state.version) ||
    !['goals','phases','tasks','notes','references'].every(key => Array.isArray(workspace.state[key])) ||
    !Array.isArray(taxonomySource.catalog) || !legacySeed.goals) {
  throw new Error('Local import files are invalid. Nothing was uploaded.');
}
const fileTypes = {
  '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.pdf':'application/pdf', '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const assetDir = path.join(privateRoot, 'assets');
const assetNames = (await readdir(assetDir, { withFileTypes:true }))
  .filter(entry => entry.isFile()).map(entry => entry.name).sort();
const assets = [];
for (const name of assetNames) {
  const contentType = fileTypes[path.extname(name).toLowerCase()];
  if (!contentType) throw new Error('Unsupported attachment type. Nothing was uploaded.');
  const data = await readFile(path.join(assetDir, name));
  if (data.length > 20 * 1024 * 1024) throw new Error('An attachment exceeds the private bucket size limit.');
  assets.push({name, data, contentType});
}
console.log(`Validated local workspace and ${assets.length} private attachments.`);
if (!apply) {
  console.log('Dry run only. No network requests were made. Use --upload after configuring your own Supabase project.');
  process.exit(0);
}

const base = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !secret) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this process only.');
const target = new URL(base);
if (target.protocol !== 'https:' || !target.hostname.endsWith('.supabase.co') ||
    target.username || target.password || target.search || target.hash || !['','/'].includes(target.pathname)) {
  throw new Error('Uploader requires the HTTPS project URL ending in .supabase.co. No request was sent.');
}
const apiBase = target.origin;
const headers = {apikey:secret, Authorization:`Bearer ${secret}`};
async function request(relative, options = {}) {
  try {
    return await fetch(apiBase + relative, {
      ...options,
      signal:AbortSignal.timeout(30000),
      headers:{...headers, ...options.headers},
      redirect:'error',
    });
  } catch {
    throw new Error('Supabase request failed. Check local network access and your project settings.');
  }
}
const existing = await request('/rest/v1/workspaces?id=eq.research&select=id');
if (!existing.ok) throw new Error(`Workspace check failed (HTTP ${existing.status}). Run schema.sql first.`);
const rows = await existing.json();
if (!Array.isArray(rows)) throw new Error('Unexpected workspace response; stopped without uploading.');
if (rows.length) throw new Error('A remote research workspace already exists. This initial importer never overwrites it.');

let count = 0;
for (const asset of assets) {
  const response = await request('/storage/v1/object/work-attachments/research/' + encodeURIComponent(asset.name), {
    method:'POST', headers:{'Content-Type':asset.contentType,'x-upsert':'false'}, body:asset.data,
  });
  if (!response.ok) {
    throw new Error(`Private attachment upload stopped (HTTP ${response.status}); ${count}/${assets.length} completed. Existing remote files were not overwritten.`);
  }
  count++;
  console.log(`Private attachments uploaded: ${count}/${assets.length}.`);
}
const response = await request('/rest/v1/workspaces', {
  method:'POST', headers:{'Content-Type':'application/json',Prefer:'return=minimal'},
  body:JSON.stringify({id:'research',state:workspace.state,taxonomy_source:taxonomySource,legacy_seed:legacySeed,revision:1}),
});
if (!response.ok) throw new Error(`Workspace import failed (HTTP ${response.status}). Uploaded private attachments were retained; no existing workspace was replaced.`);
console.log('Initial Supabase workspace and private attachments uploaded. No membership was automatically granted.');
