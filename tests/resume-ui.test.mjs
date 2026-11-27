// DOM simulation only: jsdom does not render layout, paint images, or test a real browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const project = fileURLToPath(new URL('../', import.meta.url));
const resumeDirectory = path.join(project, 'public', 'resume');
const html = await fs.readFile(path.join(resumeDirectory, 'index.html'), 'utf8');
const bundle = await fs.readFile(path.join(resumeDirectory, 'resume.js'), 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await pause(5);
  }
  assert.ok(predicate(), message);
}

async function mount(t, width = 1280) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  virtualConsole.on('error', error => errors.push(String(error)));
  // No `resources: usable`: linked scripts/styles/images cannot fetch the network.
  const dom = new JSDOM(html, {
    url: 'http://localhost:3000/resume',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      Object.defineProperty(window, 'innerWidth', { value: width, writable: true });
      window.matchMedia = query => ({ matches: false, media: query, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      window.addEventListener('error', event => { errors.push(event.message); event.preventDefault(); });
    },
  });
  t.after(() => {
    dom.window.close();
    assert.deepEqual(errors, [], 'No synchronous/React/jsdom runtime errors');
  });
  try { dom.window.eval(bundle); } catch (error) { assert.fail(`Resume bundle failed to mount: ${error.message}`); }
  await waitFor(() => dom.window.document.body.textContent.includes('Kyohoon Jin | 진교훈'), 'Original Resume mounts');
  await pause(10); // Allow React mount effects to populate responsive background.
  return dom.window;
}

function exact(document, selector, text) {
  const element = [...document.querySelectorAll(selector)].find(node => node.textContent.trim() === text);
  assert.ok(element, `Rendered control exists: ${text}`);
  return element;
}

async function selectTab(window, text) {
  const tab = exact(window.document, 'button.resume-tab', text);
  tab.click();
  await waitFor(() => tab.classList.contains('is-active'), `Tab becomes active: ${text}`);
  await pause(5);
}

test('Resume static archived assets retain their recorded SHA-256 values', async () => {
  const legacy = path.join(project, 'legacy', 'resume');
  const manifest = JSON.parse(await fs.readFile(path.join(legacy, 'source-manifest.json'), 'utf8'));
  assert.equal(Object.keys(manifest.files).length, 36);
  for (const [relative, expected] of Object.entries(manifest.files)) {
    // Source files are now editable; the manifest records the original migration.
    if (relative.startsWith('src/') && !relative.startsWith('src/fonts/')) continue;
    if (relative === 'public/index.html') continue;
    const actual = createHash('sha256').update(await fs.readFile(path.join(legacy, relative))).digest('hex');
    assert.equal(actual, expected, relative);
  }
});

test('Resume document uses its isolated styles plus the shared typography', async () => {
  const dom = new JSDOM(html, { url: 'http://localhost:3000/resume' });
  const document = dom.window.document;
  assert.deepEqual([...document.querySelectorAll('link[rel=stylesheet]')].map(node => node.getAttribute('href')), ['/resume/resume.css', '/typography.css?v=20261112-1', '/taste.css?v=20261113-1', '/atmosphere.css?v=20261115-2', '/resume-details.css?v=20261114-2', '/kh-system.css?v=20261124-1', '/kh-site.css?v=20261124-1', '/kh/resume.css?v=20261127-2']);
  assert.deepEqual([...document.querySelectorAll('script[src]')].map(node => node.getAttribute('src')), ['/theme.js?v=20261116-2', '/resume/resume.js']);
  assert.equal(document.querySelector('link[rel=icon]').getAttribute('href'), '/mascot/face.png');
  assert.equal(document.querySelectorAll('iframe').length, 0);
  assert.ok(!html.includes('/main.css') && !html.includes('/work.css') && !html.includes('_next'));
  for (const node of document.querySelectorAll('script[src],link[href]:not([rel=preconnect])')) {
    const href = (node.getAttribute('src') || node.getAttribute('href')).split('?')[0];
    await fs.access(path.join(project, 'public', href));
  }
  const typography = await fs.readFile(path.join(project, 'public', 'typography.css'), 'utf8');
  assert.match(typography, /Pretendard Variable/);
  assert.equal(document.body.dataset.typography, 'resume');
  dom.window.close();
});

test('Resume mounts original identity, intro, six navigation tabs and profile assets', async t => {
  const window = await mount(t);
  const { document } = window;
  assert.match(document.body.textContent, /저는 셀렉트스타에서 AI Research Engineer로 근무/);
  for (const label of ['Experience', 'Education', 'Projects', 'Publications', 'Honors & Lecture', 'Patent']) exact(document, 'button.resume-tab', label);
  assert.ok(exact(document, 'button.resume-tab', 'Experience').classList.contains('is-active'));
  assert.equal(document.querySelector('img.resume-portrait[alt="Kyohoon Jin"]').getAttribute('src'), '/resume/profile.jpg');
  for (const image of document.querySelectorAll('img')) assert.match(image.getAttribute('src'), /^(https:\/\/|\/icons\/|\/mascot\/|\/resume\/)/);
});

test('Resume tab navigation and publication/lecture sub-tabs update actual content', async t => {
  const window = await mount(t);
  const { document } = window;
  await selectTab(window, 'Education');
  assert.match(document.body.textContent, /Ph\.D - 중앙대학교/);
  assert.equal([...document.querySelectorAll('a')].filter(node => node.href.includes('Transcript/')).length, 3);
  await selectTab(window, 'Projects');
  assert.match(document.body.textContent, /DATUMO 플랫폼 내 모니터링 대시보드 개발/);
  assert.ok([...document.querySelectorAll('button')].filter(node => node.textContent.trim() === '자세히 보기').length > 5);
  await selectTab(window, 'Publications');
  const international = [...document.querySelectorAll('button')].find(node => node.textContent.includes('International Paper'));
  assert.ok(international);
  assert.ok(international.classList.contains('bg-blue-600'));
  const internationalText = document.body.textContent;
  const domestic = [...document.querySelectorAll('button')].find(node => node.textContent.includes('Domestic Paper'));
  assert.ok(domestic);
  domestic.click();
  await waitFor(() => document.body.textContent !== internationalText, 'Domestic publication content appears');
  assert.ok(domestic.classList.contains('bg-blue-600'));
  assert.ok([...document.querySelectorAll('a.resume-paper-link[target=_blank]')].some(node => node.textContent.trim() === '논문↗'));
  await selectTab(window, 'Honors & Lecture');
  assert.match(document.body.textContent, /우수 논문상/);
  assert.ok(!document.body.textContent.includes('장소:'));
  const honors = [...document.querySelectorAll('button')].find(node => !node.classList.contains('resume-tab') && node.textContent.includes('Honors'));
  assert.ok(honors);
  assert.ok(honors.classList.contains('bg-blue-600'));
  const lecture = [...document.querySelectorAll('button')].find(node => !node.classList.contains('resume-tab') && node.textContent.includes('Lecture'));
  assert.ok(lecture);
  lecture.click();
  await waitFor(() => document.body.textContent.includes('장소:'), 'Lecture content appears');
  assert.ok(lecture.classList.contains('bg-blue-600'));
  await selectTab(window, 'Patent');
  assert.match(document.body.textContent, /출원번호:/);
  assert.match(document.body.textContent, /등록번호:/);
  await selectTab(window, 'Experience');
  assert.ok(!document.body.textContent.includes('출원번호:'));
});

test('Resume desktop and mobile language controls preserve Korean/English behavior', async t => {
  const window = await mount(t);
  const { document } = window;
  document.getElementById('en-lang-desktop').click();
  await waitFor(() => document.body.textContent.includes('I am Kyohoon Jin, an AI Research Engineer at Selectstar.'), 'English intro appears');
  assert.ok(document.getElementById('en-lang-desktop').checked);
  document.querySelector('button[title="Toggle Language"]').click();
  await waitFor(() => document.body.textContent.includes('저는 셀렉트스타에서 AI Research Engineer로 근무'), 'Mobile toggle restores Korean');
  assert.ok(document.getElementById('ko-lang-desktop').checked);
});

test('English names apply to patents while Domestic Paper keeps Korean authors', async t => {
  const window = await mount(t);
  const {document} = window;
  document.getElementById('en-lang-desktop').click();
  await waitFor(() => document.documentElement.lang === 'en', 'English language is selected');
  await selectTab(window, 'Patent');
  for (const name of ['Kyohoon Jin','Youngbin Kim','Jaewon Kim','Soojin Jang','Junho Lee','Jungmin Yun','Juhwan Choi']) assert.ok(document.body.textContent.includes(name), name);
  assert.ok(!document.body.textContent.includes('김영빈'));
  await selectTab(window, 'Publications');
  const paper = document.querySelector('a[href="https://arxiv.org/abs/2611.07246v2"]');
  assert.ok(paper, 'New paper is linked');
  assert.match(document.body.textContent, /WSDM 2027/);
  [...document.querySelectorAll('button')].find(node => node.textContent.includes('Domestic Paper')).click();
  await waitFor(() => document.body.textContent.includes('진교훈'), 'Korean domestic authors are preserved');
  assert.ok(document.body.textContent.includes('김영빈'));
});

test('No project is pending and Samsung keeps its detail and image', async t => {
  const window = await mount(t);
  const {document} = window;
  await selectTab(window, 'Projects');
  assert.equal((document.body.textContent.match(/\(수정예정\)/g) || []).length, 0);
  assert.match(document.body.textContent, /전문가의 워크플로우가 포함된 온톨로지 구축/);
  const buttons = [...document.querySelectorAll('button')].filter(node => node.textContent.trim() === '자세히 보기');
  buttons[5].click();
  await waitFor(() => document.querySelector('h2')?.textContent.includes('[삼성생명 C-Lab]'), 'Original Samsung detail opens');
  assert.match(document.querySelector('h2').parentElement.textContent, /Python 분석 도구는 전체 테이블에서 연산을 실행합니다/);
  assert.ok(document.querySelector('h2').parentElement.querySelector('img[src*="Project_ATA.png"]'));
});

test('Project 추가 정보 links papers and DATUMO docs as new-tab links', async t => {
  const window = await mount(t);
  const {document} = window;
  await selectTab(window, 'Projects');
  const expected = {
    'DATUMO 플랫폼 내 모니터링 대시보드 개발': [
      ['서비스 문서 · DATUMO Observability', 'https://docs.datumo.com/en/docs/observability/core-concept'],
      ['논문 · KG-Neighbor (WSDM)', 'https://arxiv.org/html/2611.07246v1']
    ],
    'RAG 평가용 데이터셋 합성 기술 연구': [
      ['논문 · GRADE (EMNLP 2025 Findings)', 'https://aclanthology.org/2025.findings-emnlp.236/'],
      ['논문 · MHTS (LREC 2026)', 'https://arxiv.org/abs/2504.08756']
    ],
    'Neural Journalism: 빅데이터와 딥러닝 기반 차세대 저널리즘 연구': [
      ['논문 · PRISM (IEEE Access 2024)', 'https://ieeexplore.ieee.org/document/10766499'],
      ['논문 · SUMMPILOT (AAAI 2025 Demonstration Track)', 'https://arxiv.org/abs/2601.08475']
    ],
    '[인공지능 학습용 데이터 구축 사업] 작업현장 안전 데이터 사업': [
      ['논문 · Robust Detector (ESWA 2023)', 'https://www.sciencedirect.com/science/article/abs/pii/S0957417423014860'],
      ['논문 · Instance Segmentation (Automation in Construction 2022)', 'https://www.sciencedirect.com/science/article/abs/pii/S0926580521004854']
    ]
  };
  const seen = new Set();
  const count = [...document.querySelectorAll('button')].filter(node => node.textContent.trim() === '자세히 보기').length;
  for (let i = 0; i < count; i++) {
    [...document.querySelectorAll('button')].filter(node => node.textContent.trim() === '자세히 보기')[i].click();
    await waitFor(() => document.querySelector('h2'), 'Project detail opens');
    const detail = document.querySelector('h2').parentElement;
    const title = document.querySelector('h2').textContent;
    if (expected[title]) {
      seen.add(title);
      const links = [...detail.querySelectorAll('a[target=_blank]')].map(node => [node.textContent.trim(), node.getAttribute('href')]);
      assert.deepEqual(links, expected[title]);
      if (title.startsWith('DATUMO')) {
        assert.equal(detail.querySelector('img')?.getAttribute('src'), '/resume/projects/datumo-observability.png');
        assert.match(detail.textContent, /경계 후보 주변의 문맥/);
        assert.match(detail.textContent, /지식그래프 트리플/);
        assert.match(detail.textContent, /자동 프롬프트 튜닝/);
        assert.doesNotMatch(detail.textContent, /GIFT|CALM|심사 중/);
        assert.match(detail.textContent, /프로젝트 기한: Feb 2026 - Aug 2026/);
      }
    }
    exact(document, 'button', '×').click();
    await waitFor(() => !document.querySelector('h2'), 'Project detail closes');
  }
  assert.equal(seen.size, Object.keys(expected).length);
});

test('Resume opens global settings and preserves theme preferences without playback controls', async t => {
  const window = await mount(t);
  window.eval(await fs.readFile(path.join(project,'public/theme.js'),'utf8'));
  const d=window.document;
  assert.ok(d.querySelector('[data-global-settings] img[src="/icons/ui-settings.svg"]'));
  assert.match(d.querySelector('[data-global-settings]').href,/\/settings\?returnTo=/);
  window.AtlasTheme.set('light');
  assert.equal(d.documentElement.dataset.theme,'light');
  assert.equal(window.localStorage.getItem('kyohoon-appearance'),'light');
  assert.equal(d.querySelector('[data-theme-toggle]'),null);
  assert.equal(d.querySelector('[data-ambient-toggle]'), null);
});

test('Resume project detail modal opens, shows ontology details, and closes by button/backdrop', async t => {
  const window = await mount(t);
  const { document } = window;
  await selectTab(window, 'Projects');
  const open = () => exact(document, 'button', '자세히 보기').click();
  open();
  await waitFor(() => document.querySelector('h2')?.textContent === '전문가의 워크플로우가 포함된 온톨로지 구축', 'Project detail heading appears');
  const detail = document.querySelector('h2').parentElement;
  assert.match(detail.textContent, /프로젝트 기한: Aug 2026 -/);
  assert.equal(detail.querySelector('img')?.getAttribute('src'), '/resume/projects/ontology-expert-workflow.png');
  assert.match(detail.textContent, /판례 기반 온톨로지·지식그래프 구축과 판례 검색/);
  assert.ok(!detail.textContent.includes('삼성생명'));
  assert.match(detail.textContent, /추가 정보/);
  const demo = [...detail.querySelectorAll('a[target=_blank]')].find(node => node.textContent.trim() === '데모');
  assert.ok(demo, 'Ontology project links its demo under 추가 정보');
  assert.equal(demo.getAttribute('href'), '/work/demos/ontology/');
  exact(document, 'button', '×').click();
  await waitFor(() => !document.querySelector('h2'), 'Close button closes project detail');
  open();
  await waitFor(() => document.querySelector('h2'), 'Project detail can be reopened');
  document.querySelector('h2').parentElement.parentElement.click();
  await waitFor(() => !document.querySelector('h2'), 'Backdrop closes project detail');
});

test('Resume portrait stays static and the KakaoTalk QR modal remains interactive', async t => {
  const window = await mount(t);
  const { document } = window;
  const portrait = document.querySelector('img.resume-portrait');
  assert.equal(portrait.closest('button, a, [role="button"], [tabindex]'), null);
  portrait.click();
  assert.equal(document.querySelector('img.resume-portrait'), portrait);
  assert.equal(portrait.getAttribute('src'), '/resume/profile.jpg');
  assert.equal(document.querySelector('img[alt="Profile Back"]'), null);
  const kakao = document.querySelector('a[title=KakaoTalk]');
  assert.ok(kakao);
  kakao.click();
  await waitFor(() => document.querySelector('h2')?.textContent === '카카오톡 QR 코드', 'Kakao QR modal opens');
  assert.match(document.querySelector('img[alt="카카오톡 QR 코드"]').getAttribute('src'), /^https:\/\//);
  exact(document, 'button', '×').click();
  await waitFor(() => !document.querySelector('h2'), 'Kakao QR modal closes');
});


