import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {homePage, privateHeader} from '../views/pages.mjs';
import {workTopbar} from '../views/work-shell.mjs';

test('every page uses the same logout button: an icon and the word 로그아웃', () => {
  const home = new JSDOM(homePage({authenticated: true})).window.document;
  const paper = JSDOM.fragment(privateHeader('/paper'));
  const work = JSDOM.fragment(workTopbar('research'));
  for (const [name, root] of [['home', home], ['paper', paper]]) {
    const button = root.querySelector('form[action="/api/auth/logout"] button');
    assert.ok(button.querySelector('img[src="/icons/ui-log-out.svg"]'), name);
    assert.equal(button.textContent.trim(), '로그아웃', name);
  }
  const shell = work.querySelector('#work-logout button');
  assert.ok(shell.querySelector('svg'));assert.equal(shell.textContent.trim(), '로그아웃');
});

test('the home header no longer carries Resume and Work shortcuts', () => {
  for (const authenticated of [true, false]) {
    const header = new JSDOM(homePage({authenticated})).window.document.querySelector('.site-header');
    assert.equal(header.querySelector('a[href="/resume"]'), null);
    assert.equal(header.querySelector('a[href="/work"]'), null);
    assert.ok(header.querySelector('[data-global-settings]'));
  }
});

test('Resume projects link the ontology and document parsing demos inside Selectstar', async () => {
  const data = await readFile(new URL('../legacy/resume/src/projectsData.js', import.meta.url), 'utf8');
  assert.match(data, /title: '전문가의 워크플로우가 포함된 온톨로지 구축',\n  period: 'Aug 2026 - '/);
  // The demo is a button in the project's 추가 정보, not a link on the card.
  assert.match(data, /externalLinks: \[\{ name: '데모', url: '\/work\/demos\/ontology\/' \}\]/);
  assert.match(data, /externalLinks: \[\{name:'데모', url:'\/work\/demos\/document-parsing\/'\}\]/);
  assert.doesNotMatch(data, /\bdemo: '/);
  assert.doesNotMatch(data, /document-parsing\.kyohoon-jin\.chatgpt\.site/);
  const experience = await readFile(new URL('../legacy/resume/src/experienceData.js', import.meta.url), 'utf8');
  const dates = [...experience.split('const experienceEN_')[0].matchAll(/\((\d{4}\.\d{2}) - (\d{4}\.\d{2})? ?\)/g)].map(m => m[1] + (m[2] ? '~' + m[2] : '~'));
  assert.deepEqual(dates, ['2026.08~', '2026.01~2026.08', '2025.03~2026.08', '2025.03~2025.12'], 'Selectstar work is listed newest first');
});
