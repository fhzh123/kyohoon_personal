// One navigation shell for every Selectstar (Work) page.
// Server-rendered pages call these functions directly; static pages receive the
// same markup through `node scripts/sync-work-shell.mjs` (checked by tests).
import {spaceNavigation} from './navigation.mjs';

const paths = {
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  book: '<path d="M4 4.5h6a3 3 0 0 1 3 3v12a3 3 0 0 0-3-2.5H4z"/><path d="M20 4.5h-4a3 3 0 0 0-3 3v12a3 3 0 0 1 3-2.5h4z"/>',
  chart: '<path d="M4 4v16h16"/><path d="M8.5 16v-4M12.5 16V8M16.5 16v-6"/>',
  layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>',
  wallet: '<rect x="3.5" y="5.5" width="17" height="14" rx="2.5"/><path d="M3.5 9.5h17M15.5 14.5h2"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  logout: '<path d="M9 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4"/><path d="m15 16 4-4-4-4M19 12H9"/>',
  external: '<path d="M8 16 16 8M9 8h7v7"/>',
};
export const shellIcon = name => `<svg class="ws-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;

// Sub-items carry page hooks (data-view / data-tab) only on their own page, so a
// research link never triggers the team page's tab handler and vice versa.
export const WORK_SECTIONS = [
  {key: 'home', label: 'Selectstar 홈', href: '/work', icon: 'grid'},
  {key: 'research', label: '연구일지', href: '/work/app/index.html', icon: 'book', hook: 'view', items: [
    ['roadmap', '연구 로드맵'], ['overview', '연간 조망'], ['backlog', '연구 후보'],
    ['goals', 'L3 연구축'], ['notes', '연구 노트'], ['settings', '설정'],
  ]},
  {key: 'team', label: '팀 리소스', href: '/work/team-resources', icon: 'chart', hook: 'tab', items: [
    ['overview', '과업 배분'], ['people', '월별 변화'], ['records', '주간 원본 기록', 'record-count'],
  ]},
  {key: 'demos', label: '데모', href: '/work/demos', icon: 'layers', items: [
    ['ontology', 'Ontology', '', '/work/demos/ontology/'],
    ['document-parsing', 'Document Parsing', '', '/work/demos/document-parsing/'],
  ]},
  {key: 'expenses', label: '품의 사용내역', href: '/work/expenses/', icon: 'wallet', hook: 'tab', items: [
    ['report', '품의 분석'], ['files', '월별 파일', 'file-count'],
  ]},
];

export const sectionOf = key => WORK_SECTIONS.find(section => section.key === key);

function subItem(section, [key, label, count, external], active) {
  if (external) {
    return `<a class="ws-sub-link" href="${external}" target="_blank" rel="noopener noreferrer" data-ws-item="${key}"><span>${label}</span>${shellIcon('external')}<span class="sr-only">새 창에서 열림</span></a>`;
  }
  const own = active && section.hook;
  const hook = own ? ` data-${section.hook}="${key}"${section.key === 'team' ? ` id="tab-${key}"` : ''}` : '';
  const href = active ? `#${key}` : `${section.href}#${key}`;
  const badge = count ? `<span class="ws-count"${own ? ` id="${count}"` : ''}></span>` : '';
  return `<a class="ws-sub-link" href="${href}" data-ws-item="${key}"${hook}><span>${label}</span>${badge}</a>`;
}

function sectionEntry(section, active) {
  const current = section.key === active;
  const items = section.items || [];
  const subId = `ws-sub-${section.key}`;
  const link = `<a class="ws-nav-link" href="${section.href}"${current ? ' aria-current="page"' : ''}>${shellIcon(section.icon)}<span class="ws-nav-label">${section.label}</span></a>`;
  if (!items.length) return `<li class="ws-nav-item${current ? ' is-current' : ''}" data-ws-section="${section.key}"><div class="ws-nav-row">${link}</div></li>`;
  const toggle = `<button class="ws-nav-toggle" type="button" aria-expanded="${current}" aria-controls="${subId}" aria-label="${section.label} 하위 메뉴 ${current ? '접기' : '펼치기'}">${shellIcon('chevron')}</button>`;
  const list = `<div class="ws-sub" id="${subId}"${current ? '' : ' hidden'}><div class="ws-sub-list"${section.key === 'research' && current ? ' id="navigation"' : ''}>${items.map(item => subItem(section, item, current)).join('')}</div></div>`;
  return `<li class="ws-nav-item${current ? ' is-current' : ''}" data-ws-section="${section.key}"><div class="ws-nav-row">${link}${toggle}</div>${list}</li>`;
}

/** Left sidebar shared by every Work page. `footer` is page-specific markup. */
export function workSidebar(active, {footer = ''} = {}) {
  return `<aside class="ws-sidebar" id="ws-sidebar" aria-label="Selectstar 메뉴">
  <div class="ws-sidebar-head"><a class="ws-brand" href="/" aria-label="Kyohoon Jin 홈"><img src="/mascot/face.png" alt="" width="32" height="32"><span><strong>Kyohoon Jin</strong></span></a><button class="ws-drawer-close" type="button" data-ws-close aria-label="메뉴 닫기">${shellIcon('close')}</button></div>
  <nav class="ws-nav" aria-label="워크스페이스"><ul>${WORK_SECTIONS.map(section => sectionEntry(section, active)).join('')}</ul></nav>
  ${footer ? `<div class="ws-sidebar-foot">${footer}</div>` : ''}
</aside><div class="ws-scrim" data-ws-close hidden></div>`;
}

/**
 * Top bar: menu button, breadcrumb, page actions, then the same global cluster
 * (Work 홈, 전체 홈, 설정, 로그아웃) in the same order on every page.
 */
export function workTopbar(active, {crumb = '', crumbId = '', actions = ''} = {}) {
  const section = sectionOf(active);
  const trail = [`<a href="/work">Selectstar</a>`];
  if (section && section.key !== 'home') trail.push(crumb ? `<a href="${section.href}">${section.label}</a>` : `<strong>${section.label}</strong>`);
  if (crumb) trail.push(`<strong${crumbId ? ` id="${crumbId}"` : ''}>${crumb}</strong>`);
  return `<header class="ws-topbar">
  <button class="ws-menu-button" type="button" data-ws-open aria-controls="ws-sidebar" aria-expanded="false" aria-label="메뉴 열기">${shellIcon('menu')}</button>
  <nav class="ws-crumbs" aria-label="현재 위치">${trail.join('<span aria-hidden="true">/</span>')}</nav>
  <div class="ws-actions topbar-actions">${actions ? `<div class="ws-page-actions">${actions}</div><span class="ws-divider" aria-hidden="true"></span>` : ''}${spaceNavigation('work', 'ws-space-nav')}<a class="ws-icon-button" href="/settings" data-global-settings aria-label="설정" title="설정">${shellIcon('settings')}</a><form id="work-logout" class="ws-logout" action="/api/auth/logout" method="post"><button type="submit" aria-label="로그아웃" title="로그아웃">${shellIcon('logout')}<span>로그아웃</span></button></form></div>
</header>`;
}

export const WORK_SHELL_ASSETS = '<link rel="stylesheet" href="/work-shell.css?v=20261118-1"><script src="/work-shell.js?v=20261118-1" defer></script>';
