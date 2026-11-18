import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {STATIC_PAGES, renderStatic} from '../scripts/sync-work-shell.mjs';
import {workPage, demosPage} from '../views/pages.mjs';
import {WORK_SECTIONS} from '../views/work-shell.mjs';

const source = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('static Work pages carry the current shared shell markup', async () => {
  for (const [file, config] of Object.entries(STATIC_PAGES)) {
    const html = await source(file);
    assert.equal(renderStatic(html, config), html, `${file} is stale: run node scripts/sync-work-shell.mjs`);
  }
});

test('every Work page shows one sidebar with the same sections and only its own section expanded', async () => {
  const pages = {
    home: workPage({mode: 'supabase', role: 'editor'}), demos: demosPage(),
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
