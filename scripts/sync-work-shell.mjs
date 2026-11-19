// Writes the shared Work sidebar and top bar into the static Work pages.
// `node scripts/sync-work-shell.mjs` updates the files; `--check` only verifies them.
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {workSidebar, workTopbar, WORK_SHELL_ASSETS} from '../views/work-shell.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const icon = name => `<img class="ui-icon" src="/icons/ui-${name}.svg" width="18" height="18" alt="" aria-hidden="true">`;

export const STATIC_PAGES = {
  'work-app/index.html': {
    section: 'research',
    topbar: {
      crumb: '연구 로드맵', crumbId: 'breadcrumb-view',
      actions: `<label class="search-box">${icon('search')}<input id="global-search" type="search" placeholder="연구 주제 검색" aria-label="연구 주제 검색"></label><button class="icon-button" id="backup-top" type="button" title="백업 및 가져오기" aria-label="백업 및 가져오기">${icon('upload')}</button><button class="primary-button" id="add-task" type="button">${icon('plus')}<span>연구 구간 추가</span></button>`,
    },
    footer: '<div class="ws-foot-mascot"><img src="/mascot/journal.webp" alt="" width="44" height="44"><p>큰 목표를, 작은 한 걸음으로.</p></div><div class="ws-foot-status workspace-note"><span class="save-dot"></span><span id="storage-status">이 브라우저에 자동 저장</span></div><button id="backup-open" type="button">백업 · 가져오기</button>',
  },
  'views/team-resources.html': {
    section: 'team',
    topbar: {crumb: '과업 배분', crumbId: 'crumb'},
    footer: '<div class="ws-foot-mascot"><img src="/mascot/team-resources.png" alt="" width="44" height="44"><p>주간 기록은 매주 목요일 오전 7시에 갱신합니다.</p></div><button type="button" data-action="method">집계 기준 보기</button>',
  },
  'work-expenses/index.html': {
    section: 'expenses',
    topbar: {crumb: '품의 분석', crumbId: 'ws-crumb'},
    footer: '<div class="ws-foot-mascot"><img src="/mascot/expenses.webp" alt="" width="44" height="44"><p>원본 엑셀은 허용된 계정만 열 수 있습니다.</p></div>',
  },
};

export function renderStatic(html, {section, topbar, footer}) {
  const blocks = {
    assets: WORK_SHELL_ASSETS,
    sidebar: workSidebar(section, {footer}),
    topbar: workTopbar(section, topbar),
  };
  let output = html;
  for (const [name, markup] of Object.entries(blocks)) {
    const pattern = new RegExp(`<!--ws:${name}-->[\\s\\S]*?<!--/ws:${name}-->`);
    if (!pattern.test(output)) throw new Error(`Missing ws:${name} marker`);
    output = output.replace(pattern, () => `<!--ws:${name}-->${markup}<!--/ws:${name}-->`);
  }
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let stale = [];
  for (const [file, config] of Object.entries(STATIC_PAGES)) {
    const target = path.join(root, file), current = await readFile(target, 'utf8'), next = renderStatic(current, config);
    if (current === next) continue;
    if (check) stale.push(file); else await writeFile(target, next);
  }
  if (stale.length) { console.error('Work shell is out of date: ' + stale.join(', ')); process.exit(1); }
  console.log(check ? 'Work shell markup is in sync.' : 'Work shell markup written.');
}
