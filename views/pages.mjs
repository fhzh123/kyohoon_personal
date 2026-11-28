import {canAccessMarkdown} from '../server/policy.mjs';
import {spaceNavigation} from './navigation.mjs';
import {workSidebar, workTopbar, WORK_SHELL_ASSETS, WORK_SECTIONS} from './work-shell.mjs';
import {markdownHead, markdownEditorMain, markdownTail, markdownGate} from './markdown-editor.mjs';
const uiIcon = name => `<img class="ui-icon" src="/icons/ui-${name}.svg" width="18" height="18" alt="" aria-hidden="true">`;
const themeButton = () => `<a class="theme-toggle theme-toggle--icon space-nav-button" href="/settings" data-global-settings aria-label="설정" title="설정">${uiIcon('settings')}</a>`;
const brand = () => '<a class="wordmark" href="/" aria-label="Kyohoon Jin 홈"><img src="/mascot/face.png" alt="" width="36" height="36"><span>Kyohoon Jin</span></a>';
const footer = () => `<footer class="site-footer"><span>© ${new Date().getFullYear()} Kyohoon Jin</span></footer>`;
// kh design system: shared tokens and bridge on every page, then one file per surface.
const KH_V = '20261124-2';
const HOME_V = '20261128-desk-4';
export const DEFAULT_HOME_TITLE = '작업실.';
const KH_PAGES = new Set(['login', 'selectstar', 'personal', 'demos', 'paper', 'settings', 'travel', 'gallery']);
const shell = (title, body, surface = '', {manageHome = false} = {}) => `<!doctype html>
<html lang="ko" data-theme="dark" data-type="service" data-radius="soft" data-motion${manageHome ? ' data-manage-home' : ''}>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#131517">
<meta name="description" content="AI Research Engineer 진교훈의 경력과 연구 기록. Selectstar 연구일지와 업무 도구.">
<meta name="page-type" content="service"><meta name="site-kind" content="other">
<meta property="og:title" content="${title} | Kyohoon Jin"><meta property="og:description" content="AI Research Engineer 진교훈의 경력과 연구 기록."><meta property="og:type" content="website"><meta property="og:image" content="/mascot/resume.png"><meta name="twitter:card" content="summary">
<title>${title} | Kyohoon Jin</title><link rel="icon" href="/mascot/face.png">

<script src="/theme.js?v=20261128-2"></script><script src="/loading.js?v=20261113-1" defer></script>

<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin><link rel="stylesheet" href="/typography.css?v=20261112-1">
<link rel="stylesheet" href="/taste.css?v=20261113-1"><link rel="stylesheet" href="/assets/taste/motion/motion.css">
<script>document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700)</script>
<script type="module" src="/assets/taste/motion/motion.js"></script>
<link rel="stylesheet" href="/atmosphere.css?v=20261115-2">
<link rel="stylesheet" href="/auth.css?v=20261113-2"><link rel="stylesheet" href="/space-navigation.css?v=20261117-1"><script src="/space-navigation.js?v=20261117-1" defer></script><link rel="stylesheet" href="/kh-system.css?v=${KH_V}"><link rel="stylesheet" href="/kh-site.css?v=${KH_V}">${KH_PAGES.has(surface) ? `<link rel="stylesheet" href="/kh/${surface}.css?v=${KH_V}">` : ''}${surface === 'home' ? '<link rel="stylesheet" href="/home.css?v='+HOME_V+'">'+(manageHome ? '<script src="/home-title.js?v=1" defer></script>' : '')+'<script src="/home.js?v='+HOME_V+'" defer></script>' : ''}${surface === 'demos' ? WORK_SHELL_ASSETS : ''}
</head><body data-surface="${surface}"${surface === 'demos' ? ' data-work-shell' : ''}><div class="ambient-sky" aria-hidden="true"></div><a class="skip-link" href="#main">본문으로 건너뛰기</a>${body}</body></html>`;


const HOME_SPACES = [
  {id:'resume', href:'/resume', title:'Resume', pose:'resume-hover.webp'},
  {id:'work', href:'/work', title:'Selectstar', pose:'selectstar-hover.webp'},
  {id:'paper', href:'/paper', title:'Paper', pose:'paper-pose.webp'},
  {id:'personal', href:'/personal', title:'Personal', pose:'personal-pose.webp'},
];

const HOME_TOOLS = [
  {id:'journal', href:'/work/app/index.html', title:'이번 주 연구일지', detail:'연구 로드맵', icon:'calendar', locked:true},
  {id:'rebuttal', href:'/paper#rebuttal', title:'논문 리뷰탈', detail:'Paper', icon:'document', locked:true, fullAccess:true},
  {id:'markdown', href:'/personal/markdown', title:'마크다운 에디터', detail:'Personal', icon:'edit', locked:true, owner:true},
  {id:'resources', href:'/work/team-resources', title:'팀 리소스', detail:'Selectstar', icon:'calendar', locked:true},
  {id:'review', href:'/paper#review', title:'논문 리뷰', detail:'Paper', icon:'document', locked:true, fullAccess:true},
  {id:'gallery', href:'/personal/gallery', title:'마스코트 갤러리', detail:'Personal', icon:'image'},
  {id:'travel', href:'/personal/travel', title:'여행의 흔적', detail:'Personal', icon:'globe'},
  {id:'resume', href:'/resume', title:'이력서', detail:'Resume', icon:'document'},
];

const DESK_ICONS = {
  calendar:'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm2-2v4m10-4v4M4 11h16m-11 4h1m4 0h1',
  document:'M6 3h8l4 4v14H6zM14 3v5h4m-9 4h6m-6 4h6',
  edit:'m14 7 3 3M5 16 16 5a2.1 2.1 0 0 1 3 3L8 19l-4 1z',
  image:'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5m-5-8h.01',
  globe:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c5 5 5 13 0 18-5-5-5-13 0-18ZM3 12h18',
  clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
  chevron:'m9 5 7 7-7 7',
  shuffle:'M4 7h3c4 0 6 10 10 10h3m-3-3 3 3-3 3M4 17h3c1.4 0 2.6-1.3 3.4-2.6M13.6 9.6C14.4 8.3 15.6 7 17 7h3m-3-3 3 3-3 3',
};
const deskIcon = name => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + DESK_ICONS[name] + '"/></svg>';

function deskTool(tool, authenticated) {
  const needsLogin = tool.locked && !authenticated;
  const href = needsLogin ? '/login?next=' + encodeURIComponent(tool.href) : tool.href;
  return '<li data-tool="' + tool.id + '"><a class="desk-tool" href="' + href + '"><span class="desk-icon">' + deskIcon(tool.icon) + '</span><strong>' + tool.title + '</strong><span class="desk-tool-detail">' + (needsLogin ? '로그인 후 이용' : tool.detail) + '</span>' + deskIcon('chevron') + '</a></li>';
}

function deskRecent(authenticated, selectstarOnly) {
  if (selectstarOnly) return '';
  const href = authenticated ? '/paper#rebuttal' : '/login?next=%2Fpaper%23rebuttal';
  return '<section class="desk-recent" aria-labelledby="desk-recent-heading"' + (authenticated ? ' data-desk-recent' : '') + '><h2 id="desk-recent-heading">이어쓰기</h2><a href="' + href + '"><span class="desk-icon">' + deskIcon('clock') + '</span><span class="desk-recent-copy"><strong>Paper 작업 열기</strong><small>' + (authenticated ? '논문 리뷰와 리뷰탈' : '로그인하면 최근 Paper 작업을 이어서 열 수 있어요.') + '</small></span>' + deskIcon('chevron') + '</a></section>';
}

export const homePage = ({authenticated = false, selectstarOnly = false, markdownAllowed = !authenticated, manageHome = false} = {}) => {
  const tools = HOME_TOOLS.filter(tool => (!selectstarOnly || (!tool.fullAccess && !tool.owner)) && (!tool.owner || markdownAllowed));
  const spaces = HOME_SPACES.filter(space => !selectstarOnly || space.id !== 'paper');
  // Calendar is the owner's own schedule, so only the owner sees it in the space list.
  if (!selectstarOnly) spaces.push({id:'calendar', href:'/calendar', title:'Calendar'});
  return shell('진교훈', `
<div class="home">
  <header class="site-header home-header">${brand()}
    <nav class="home-spaces" aria-label="홈페이지 공간">
      ${spaces.map(space => `<a href="${space.href}"${space.pose ? ` data-pose="/mascot/${space.pose}"` : ''}>${space.title}</a>`).join('')}
    </nav>
    <nav class="header-actions" aria-label="계정과 설정">${selectstarOnly ? '' : themeButton()}${authenticated ? logoutButton() : '<a class="btn header-login" href="/login">로그인</a>'}</nav>
  </header>
  <main id="main" class="home-main" aria-labelledby="intro-title">
    <div class="desk-intro">
      <div class="desk-day"><time class="desk-date" data-desk-date></time><span class="desk-weather" data-desk-weather hidden></span></div>
      <h1 id="intro-title"${manageHome ? ` data-default-home-title="${DEFAULT_HOME_TITLE}"` : ''}><span data-home-title-text>${DEFAULT_HOME_TITLE.slice(0,-1)}</span><span class="desk-title-period" data-home-title-period>.</span></h1>
    </div>
    <div class="desk-work">
      <section class="desk-shortcuts" aria-labelledby="desk-shortcut-heading">
        <div class="desk-section-heading"><h2 id="desk-shortcut-heading">바로가기</h2>${manageHome ? '<button class="desk-edit" type="button" data-desk-edit hidden>편집</button>' : ''}</div>
        <ul class="desk-tools" data-desk-tools data-desk-profile="${selectstarOnly ? 'selectstar' : markdownAllowed ? 'full' : 'member'}">${tools.slice(0, 3).map(tool => deskTool(tool, authenticated)).join('')}</ul>
        ${manageHome ? `<template data-desk-options>${tools.map(tool => deskTool(tool, authenticated)).join('')}</template>` : ''}
      </section>
      ${deskRecent(authenticated, selectstarOnly)}
    </div>
    <section class="home-stage" aria-label="마스코트" data-home-stage>
      <div class="desk-scene">
        <p class="desk-forecast" data-desk-forecast hidden></p>
        <div class="desk-horizon" aria-hidden="true"></div><div class="desk-plinth" aria-hidden="true"></div>
        <button class="desk-mascot" type="button" aria-label="마스코트 콕 찌르기" data-desk-poke disabled>
          <img class="home-pose" src="/mascot/original.png" width="512" height="512" alt="" fetchpriority="high" data-default-pose>
          <span class="desk-poke-feedback" aria-hidden="true" hidden>콕!</span>
        </button>
        <span class="desk-announce" role="status" data-desk-announce></span>
      </div>
      <div class="desk-stage-controls">
        <a href="/personal/gallery">마스코트 갤러리</a>
        ${manageHome ? `<button type="button" data-desk-pose hidden>${deskIcon('shuffle')}<span>모습 바꾸기</span></button>` : ''}
      </div>
    </section>
  </main>
  <footer class="site-footer"><a href="https://open-meteo.com/en/license" data-desk-weather-source hidden>날씨 · Open-Meteo</a><span>© ${new Date().getFullYear()} Kyohoon Jin</span></footer>
  ${manageHome ? `<dialog class="desk-dialog" data-desk-dialog aria-labelledby="desk-dialog-heading">
    <form method="dialog">
      <h2 id="desk-dialog-heading">바로가기 편집</h2>
      <p id="desk-dialog-help">자주 쓰는 도구를 최대 3개 골라주세요.</p>
      <fieldset aria-label="도구 선택" aria-describedby="desk-dialog-help">${tools.map(tool => `<label><input type="checkbox" name="tool" value="${tool.id}">${tool.title}</label>`).join('')}</fieldset>
      <p class="desk-dialog-error" role="status"></p>
      <div class="desk-dialog-actions"><button value="cancel" formnovalidate>취소</button><button value="save">저장</button></div>
    </form>
  </dialog>` : ''}
</div>`, 'home', {manageHome});
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}

export function loginPage({configured, preview, message = '', next = '/'}) {
  return shell('로그인', `
<div class="login-shell"><header class="site-header">${brand()}<div class="header-actions">${spaceNavigation()}${themeButton()}</div></header>
<main id="main" class="login-main hero" data-enter aria-labelledby="login-title">
  <div class="login-art hero-text"><p class="login-eyebrow">Kyohoon Jin</p><h1 id="login-title">나의 공간에<br>로그인하세요.</h1><p>연구일지와 Paper를<br>등록된 계정으로 이용하세요.</p><div class="auth-mascot auth-mascot--login"><img src="/mascot/login-mascots.png" alt="키 카드를 들고 안내하는 마스코트" width="1920" height="819"></div></div>
  <section class="login-card" aria-labelledby="form-title"><div class="login-card-heading"><span class="login-symbol" aria-hidden="true">${uiIcon('log-in')}</span><h2 id="form-title">로그인</h2><p class="muted">이메일과 비밀번호를 입력해 주세요.</p></div>
  ${message ? `<p class="notice error" role="alert">${escapeHtml(message)}</p>` : ''}
  ${!configured ? '<p class="notice" role="status">지금은 로그인을 이용할 수 없습니다. 관리자에게 문의해 주세요.</p>' : ''}
  <form method="post" action="/api/auth/login" data-login-form>
    <input type="hidden" name="next" value="${escapeHtml(next)}">
    <label for="email">이메일</label><input id="email" name="email" type="email" autocomplete="username" placeholder="name@example.com" required ${!configured ? 'disabled' : ''}>
    <label for="password">비밀번호</label><div class="password-field"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호 입력" required ${!configured ? 'disabled' : ''}><button type="button" class="password-toggle" aria-label="비밀번호 표시" aria-pressed="false" ${!configured ? 'disabled' : ''}>보기</button></div>
    <button class="primary-button btn btn--primary" type="submit" ${!configured ? 'disabled' : ''}><span>로그인</span><span aria-hidden="true">→</span></button>
  </form>
  <p class="forgot-link"><button type="button" class="link" data-contact-open aria-haspopup="dialog" aria-controls="account-help">비밀번호를 잊어버리셨나요?</button></p>
  <p class="login-help">등록된 계정만 이용할 수 있습니다.</p>
  ${preview ? '<div class="preview-box"><strong>로컬 미리보기</strong><p>localhost 전용 개발 미리보기입니다.</p><a class="secondary-button btn btn--secondary" href="/work/preview">로컬 미리보기 열기 →</a></div>' : ''}
  </section>
</main>${footer()}</div>
<dialog id="account-help" closedby="any" class="contact-dialog" aria-labelledby="contact-title" aria-describedby="contact-description">
 <div class="contact-content"><button class="dialog-close" type="button" data-contact-close aria-label="문의 안내 닫기">×</button>
 <div class="auth-mascot auth-mascot--support" aria-hidden="true"><img src="/mascot/login-mascots.png" alt="" width="1920" height="819"></div>
 <h2 id="contact-title">계정 도움이 필요하신가요?</h2><p id="contact-description">비밀번호를 잊으셨다면<br>아래 연락처로 관리자에게 직접 문의해 주세요.</p>
 <div class="contact-methods"><div class="contact-qr"><div class="qr-frame"><img src="https://i.ibb.co/VYhm8hmW/image.png" alt="관리자 카카오톡 QR코드" width="164" height="164"></div><strong>카카오톡으로 문의</strong><p>카카오톡 앱으로 QR코드를 스캔해 주세요.</p></div>
 <div class="contact-email"><span>관리자 이메일</span><a href="mailto:fhzh@naver.com">fhzh@naver.com</a><button type="button" class="btn" data-copy-email>이메일 주소 복사</button><p class="copy-status" role="status" aria-live="polite"></p></div></div>
 <button type="button" class="btn btn--primary contact-done" data-contact-close>확인</button></div>
</dialog><script src="/auth.js?v=20261118-1" defer></script>`, 'login');
}

// 모든 화면이 같은 로그아웃 버튼을 씁니다: 아이콘과 글자, 테두리 있는 버튼.
const logoutButton = () => `<form action="/api/auth/logout" method="post"><button class="logout-button btn btn--secondary" type="submit">${uiIcon('log-out')}<span>로그아웃</span></button></form>`;
function privateHeader(back = '/', section = '') {
  const space=section||(back==='/personal'?'personal':back==='/paper'?'paper':back==='/work'?'work':'');
  return `<header class="site-header">${brand()}<div class="hub-header-actions">${spaceNavigation(space)}${themeButton()}${logoutButton()}</div></header>`;
}

// Space landing pages (Selectstar, Personal) share the Paper home layout: a large
// title with its mascot, then big two-column cards that wrap as tools are added.
const SPACE_HUB_CSS = '<link rel="stylesheet" href="/space-hub.css?v=20261118-1">';
function spaceHub({header, eyebrow, title, description, hero, heroAlt, note = '', label, cards, extraClass = ''}) {
  const card = c => {
    const body = `<img class="space-card-art" src="/mascot/${c.image}" alt="" width="168" height="168" decoding="async"><span class="space-card-kicker">${c.kicker}</span><div class="space-card-title"><h2>${c.title}</h2>${c.href ? '<span class="space-card-arrow" aria-hidden="true">→</span>' : ''}</div><span class="space-card-text">${c.description}</span><span class="space-card-meta">${c.meta}</span>`;
    return c.href
      ? `<a class="tool-card space-card" href="${c.href}" aria-label="${c.title}: ${c.action}">${body}</a>`
      : `<article class="tool-card space-card is-pending">${body}</article>`;
  };
  return `${SPACE_HUB_CSS}<div class="hub-shell space-shell">${header}<main id="main" class="space-main"><section class="space-hero"><div><p class="space-eyebrow">${eyebrow}</p><h1>${title}</h1><p class="space-lede">${description}</p>${note}</div><img src="/mascot/${hero}" alt="${heroAlt}" width="220" height="220"></section><nav class="space-cards${extraClass ? ' ' + extraClass : ''}" aria-label="${label}">${cards.map(card).join('')}</nav></main>${footer()}</div>`;
}

// Connection line shown above a space's tools. Logged-out visitors (access is null) see nothing.
export function spaceStatus(access) {
  if (!access) return '';
  const text = access.mode === 'local' ? '로컬 개발 미리보기 · localhost 전용' : access.role !== 'editor' ? '연결됨 · 읽기 전용' : '연결됨 · 편집 가능';
  return `<p class="space-status"><span aria-hidden="true"></span>${text}</p>`;
}

const subMenu = key => (WORK_SECTIONS.find(section => section.key === key)?.items || []).map(item => item[1]).join(' · ');

export function workPage(access) {
  const local = access.mode === 'local';
  const cards = [
    {kicker:'연구 관리', title:'연구일지', image:'journal.webp', description:'연구 로드맵과 L3 연구축을 세우고<br>연구 노트를 함께 남깁니다.', meta:subMenu('research'), href:'/work/app/index.html', action:'연구일지 열기'},
    {kicker:'팀 운영', title:'팀 리소스', image:'team-resources.png', description:'주간 기록으로 팀원별 과업 배분과<br>월별 변화를 봅니다.', meta:subMenu('team'), href:'/work/team-resources', action:'과업 배분 보기'},
    {kicker:'시연', title:'데모', image:'demo.webp', description:'연구 결과를 바로 보여 줄 수 있는<br>데모를 새 창에서 엽니다.', meta:subMenu('demos'), href:'/work/demos', action:'데모 선택하기'},
    {kicker:'예산', title:'품의 사용내역', image:'expenses.webp', description:'월별 카드 내역과 품의별 예산을<br>한눈에 확인합니다.', meta:subMenu('expenses'), href:'/work/expenses/', action:'품의 분석 열기'},
  ];
  const note = `${spaceStatus(access)}${local ? '<p class="space-notice">개발 미리보기입니다. 연구일지 변경은 이 프로젝트 사본에 저장되며 Supabase와 동기화되지 않습니다.</p>' : ''}`;
  return shell('Selectstar', spaceHub({
    header: privateHeader('/work'), eyebrow: 'AI 1팀 · Vertical 업무 공간', title: 'Selectstar',
    description: '연구와 팀 업무에 쓰는 도구를<br>한곳에서 엽니다.', hero: 'selectstar-idle.webp', heroAlt: 'Selectstar 로고를 든 마스코트',
    note, label: 'Selectstar 도구', cards,
  }), 'selectstar');
}

export function personalPage(access) {
  const header = access ? privateHeader('/personal') : publicHeader('personal').replace('</div></header>', '<a class="btn" href="/login?next=%2Fpersonal">로그인</a></div></header>');
  const cards = [
    {kicker:'기록', title:'여행의 흔적', image:'travel-globe.webp', description:'다녀온 곳의 사진과 이야기를<br>지구본 위에 남깁니다.', meta:'지구본 · 여행 기록', href:'/personal/travel', action:'여행 기록 보기'},
    {kicker:'컬렉션', title:'갤러리', image:'gallery.png', description:'마스코트의 다양한 모습을<br>둘러보고 내려받습니다.', meta:'모아보기 · 8방향 · 걷는 모습', href:'/personal/gallery', action:'갤러리 보기'},
    {kicker:'글쓰기', title:'마크다운 에디터', image:'markdown-editor.webp', description:'마크다운으로 글을 쓰고<br>모양을 바로 확인합니다.', meta:canAccessMarkdown(access) ? '폴더 · 나란히 보기 · PDF 내보내기' : 'Owner 전용', href:'/personal/markdown', action:'마크다운 에디터 열기'},
  ];
  return shell('Personal', spaceHub({
    header, eyebrow: '여행과 일상을 위한 공간', title: 'Personal',
    description: '여행과 일상의 기록을<br>모아두는 공간입니다.', hero: 'personal-idle.webp', heroAlt: '소파에 앉아 쉬는 마스코트',
    note: spaceStatus(access), label: 'Personal 도구', cards, extraClass: 'personal-tools',
  }), 'personal');
}

// 마크다운 에디터: 폴더와 문서 목록, 편집기와 미리보기, PDF 내보내기.
// 로그인하지 않은 방문자에게는 로그인 안내만 보여 줍니다.
export function accessDeniedPage({markdown = false, calendar = false, selectstarOnly = false} = {}) {
  const description = calendar
    ? 'Calendar는 사이트 소유자만 열 수 있습니다.'
    : markdown
    ? '마크다운 에디터는 사이트 소유자만 열 수 있습니다.'
    : '현재 로그인한 계정에는 이 페이지를 읽을 권한이 없습니다.';
  const back = selectstarOnly ? '/work' : markdown ? '/personal' : '/';
  const backLabel = selectstarOnly ? 'Selectstar로 돌아가기' : markdown ? 'Personal로 돌아가기' : '홈으로 돌아가기';
  return shell('접근 권한 없음', `
<link rel="stylesheet" href="/access-denied.css">
<div class="access-denied-shell">
  <header class="site-header">${brand()}${logoutButton()}</header>
  <main id="main" class="access-denied" aria-labelledby="denied-title">
    <div>
      <h1 id="denied-title">이 페이지를 열 수 없어요</h1>
      <p>${description}</p>
      <a class="btn btn--primary" href="${back}">${backLabel}</a>
    </div>
    <img src="/mascot/login-required.png" width="512" height="512" alt="">
  </main>
  ${footer()}
</div>`);
}

export function markdownPage(access) {
  if (!access) {
    const header = publicHeader('personal').replace('</div></header>', '<a class="btn" href="/login?next=%2Fpersonal%2Fmarkdown">로그인</a></div></header>');
    return shell('마크다운 에디터', `${markdownHead()}<div class="hub-shell md-shell md-shell--gate">${header}${markdownGate()}${footer()}</div>`, 'personal');
  }
  return shell('마크다운 에디터', `${markdownHead()}<div class="hub-shell md-shell">${privateHeader('/personal')}${markdownEditorMain(access)}${footer()}</div>${markdownTail(access)}`, 'personal');
}

export function demosPage({authenticated = true} = {}) {
  const demos = [
    {title:'Ontology', image:'ontology.webp', alt:'지식 그래프를 살펴보는 마스코트', text:'문서에서 개념과 관계를 추출하고 지식 구조를 확인합니다.', href:'/work/demos/ontology/', original:'https://selectstar-ai-vertical-research-feasibility.kyohoon-jin.chatgpt.site/'},
    {title:'Document Parsing', image:'parsing.webp', alt:'돋보기로 문서를 살펴보는 마스코트', text:'문서의 레이아웃을 분석하고 텍스트와 표를 추출합니다.', href:'/work/demos/document-parsing/', original:'https://selectstar-ai-vertical-research-feasibility-document-parsing.kyohoon-jin.chatgpt.site/'},
  ];
  return shell('연구 데모', `
<div class="ws-app">${workSidebar('demos')}<div class="ws-main">${workTopbar('demos', {authenticated, next: '/work/demos'})}<main id="main" class="ws-content">
  <div class="ws-heading"><div><h1>연구 데모</h1><p>각 데모는 새 창에서 열립니다.</p></div></div>
  <div class="ws-demos">${demos.map(d => `<article class="demo-entry"><a class="ws-demo" href="${d.href}" target="_blank" rel="noopener noreferrer"><div class="ws-demo-copy"><h2>${d.title}</h2><p>${d.text}</p><span class="tool-action">데모 열기 <span aria-hidden="true">↗</span></span><span class="sr-only">새 창에서 열림</span></div><img src="/mascot/${d.image}" alt="${d.alt}" width="180" height="180" decoding="async"></a><a class="demo-original link" href="${d.original}" target="_blank" rel="noopener noreferrer">기존 GPT Sites에서 열기 <span aria-hidden="true">↗</span><span class="sr-only">새 창에서 열림</span></a></article>`).join('')}</div>
</main></div></div>`, 'demos');
}

function publicHeader(section='') {
  return '<header class="site-header">'+brand()+'<div class="hub-header-actions">'+spaceNavigation(section)+themeButton()+'</div></header>';
}


export {shell,privateHeader,publicHeader,footer};



