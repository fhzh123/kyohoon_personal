import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Vercel's Node runtime refuses require() of ES modules. Local Node 22 allows it,
// which once hid a crash that took the whole site down (sanitize-html requiring an
// ESM-only htmlparser2). Load the entry points the way Vercel does.
const root = fileURLToPath(new URL('..', import.meta.url));
const load = specifier => spawnSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', `await import(${JSON.stringify(specifier)});`], {cwd:root, encoding:'utf8', env:{...process.env, VERCEL:'1', NODE_ENV:'production'}});

for (const entry of ['./api/index.mjs', './server/markdown-pdf.mjs']) {
  test(`${entry} loads without require(esm)`, () => {
    const result = load(entry);
    assert.equal(result.status, 0, result.stderr);
  });
}
