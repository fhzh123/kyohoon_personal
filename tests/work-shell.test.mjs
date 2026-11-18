import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {STATIC_PAGES, renderStatic} from '../scripts/sync-work-shell.mjs';
import {workPage, demosPage} from '../views/pages.mjs';
import {WORK_SECTIONS} from '../views/work-shell.mjs';

const source = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('the Selectstar landing page lists the tools without the sidebar', () => {
  const d = new JSDOM(workPage({mode: 'supabase', role: 'editor'})).window.document;
  assert.equal(d.querySelector('.ws-sidebar'), null);
  assert.equal(d.querySelector('[data-ws-open]'), null);
  assert.equal(d.querySelectorAll('main a.tool-card').length, 4);
  assert.equal(d.querySelector('.ws-actions').lastElementChild.id, 'work-logout');
});

test('static Work pages carry the current shared shell markup', async () => {
  for (const [file, config] of Object.entries(STATIC_PAGES)) {
    const html = await source(file);
    assert.equal(renderStatic(html, config), html, `${file} is stale: run node scripts/sync-work-shell.mjs`);
  }
});

test('every Work page shows one sidebar with the same sections and only its own section expanded', async () => {
  const pages = {
    demos: demosPage(),
    research: await source('work-app/index.html'), team: await source('views/team-resources.html'), expenses: await source('work-expenses/index.html'),
  };
  for (const [key, html] of Object.entries(pages)) {
    const d = new JSDOM(html).window.document;
    assert.equal(d.querySelectorAll('.ws-sidebar').length, 1, key);
    assert.deepEqual([...d.querySelectorAll('.ws-nav-link')].map(a => a.getAttribute('href')), WORK_SECTIONS.map(s => s.href), key);
    assert.equal(d.querySelector('.ws-nav-item.is-current').dataset.wsSection, key);
    for (const sub of d.querySelectorAll('.ws-sub')) assert.equal(sub.hidden, !sub.closest('.is-current'), key);
    // Page hooks exist only on the page they drive.
    for (const hooked of d.querySelectorAll('.ws-sidebar [data-view], .ws-sidebar [data-tab]')) assert.ok(hooked.closest('.is-current'), key);
    const actions = d.querySelector('.ws-topbar .ws-actions');
    assert.equal(actions.lastElementChild.id, 'work-logout', key);
    assert.ok(actions.querySelector('[data-space-navigation="work"] a[href="/work"]'), key);
    assert.ok(actions.querySelector('[data-global-settings]'), key);
  }
});

test('the research journal loads the neutral tone and polish after the shared shell', async () => {
  const html = await source('work-app/index.html');
  const shell = html.indexOf('<!--/ws:assets-->'), tone = html.indexOf('href="research-tone.css'), polish = html.indexOf('href="refine.css');
  assert.ok(shell > 0 && tone > shell && polish > tone);
  const {buildTone, retone, scopeSelector} = await import('../scripts/build-research-tone.mjs');
  assert.equal(await source('work-app/research-tone.css'), await buildTone());
  // Navy surfaces lose their blue cast; accents, category and status colours stay.
  assert.ok(retone('#121823'));
  for (const kept of ['#3479e9', '#a8c3ff', '#12a898', '#291313', '#ffffff']) assert.equal(retone(kept), null, kept);
  assert.equal(scopeSelector('.search-box input::placeholder'), '.search-box input:not(#ws-tone):not(.ws-sidebar *, .ws-topbar *)::placeholder');
});
