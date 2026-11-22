import {spaceNavigation} from './navigation.mjs';
import {workSidebar, workTopbar, WORK_SHELL_ASSETS, WORK_SECTIONS} from './work-shell.mjs';
import {markdownHead, markdownEditorMain, markdownTail, markdownGate} from './markdown-editor.mjs';
const uiIcon = name => `<img class="ui-icon" src="/icons/ui-${name}.svg" width="18" height="18" alt="" aria-hidden="true">`;
const themeButton = () => `<a class="theme-toggle theme-toggle--icon space-nav-button" href="/settings" data-global-settings aria-label="설정" title="설정">${uiIcon('settings')}</a>`;
const brand = () => '<a class="wordmark" href="/" aria-label="Kyohoon Jin 홈"><img src="/mascot/face.png" alt="" width="36" height="36"><span>Kyohoon Jin</span></a>';
const footer = () => `<footer class="site-footer"><span>© ${new Date().getFullYear()} Kyohoon Jin</span></footer>`;
const shell = (title, body, surface = '') => `<!doctype html>
<html lang="ko" data-theme="dark" data-type="service" data-radius="soft" data-motion>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#131517">
<meta name="description" content="AI Research Engineer 진교훈의 경력과 연구 기록. Selectstar 연구일지와 업무 도구.">
<meta name="page-type" content="service"><meta name="site-kind" content="other">
<meta property="og:title" content="${title} | Kyohoon Jin"><meta property="og:description" content="AI Research Engineer 진교훈의 경력과 연구 기록."><meta property="og:type" content="website"><meta property="og:image" content="/mascot/resume.png"><meta name="twitter:card" content="summary">
<title>${title} | Kyohoon Jin</title><link rel="icon" href="/mascot/face.png">

<script src="/theme.js?v=20261116-2"></script><script src="/loading.js?v=20261113-1" defer></script>

<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin><link rel="stylesheet" href="/typography.css?v=20261112-1">
<link rel="stylesheet" href="/taste.css?v=20261113-1"><link rel="stylesheet" href="/assets/taste/motion/motion.css">
<script>document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700)</script>
<script type="module" src="/assets/taste/motion/motion.js"></script>
<link rel="stylesheet" href="/atmosphere.css?v=20261115-2">
<link rel="stylesheet" href="/auth.css?v=20261113-2"><link rel="stylesheet" href="/space-navigation.css?v=20261117-1"><script src="/space-navigation.js?v=20261117-1" defer></script>${surface === 'home' ? '<link rel="stylesheet" href="/home-motion.css?v=20261118-1"><link rel="stylesheet" href="/home-refinement.css?v=20261116-3">' : ''}${surface === 'demos' ? WORK_SHELL_ASSETS : ''}
</head><body data-surface="${surface}"${surface === 'demos' ? ' data-work-shell' : ''}><div class="ambient-sky" aria-hidden="true"></div><a class="skip-link" href="#main">본문으로 건너뛰기</a>${body}</body></html>`;

function artwork(idle, hover, alt) {
  return `<div class="portal-art ${hover && hover !== idle ? 'has-swap' : ''}"><img class="pose-idle" src="/mascot/${idle}" alt="${alt}" width="768" height="768" decoding="async">${hover && hover !== idle ? `<img class="pose-active" src="/mascot/${hover}" alt="" aria-hidden="true" width="768" height="768" decoding="async">` : ''}</div>`;
}

export const homePage = ({authenticated = false} = {}) => shell('진교훈', `
<div class="home-shell">
  <header class="site-header">${brand()}<nav class="header-actions" aria-label="빠른 이동">${themeButton()}${authenticated ? logoutButton() : '<a class="btn header-login" href="/login">로그인</a>'}</nav></header>
  <main id="main" class="home-main hero hero--split" data-enter="off" aria-labelledby="intro-title">
    <section class="intro hero-text">
      <p class="home-role">AI Research Engineer</p>
      <h1 id="intro-title">진교훈 <span class="name-en" lang="en">Kyohoon Jin</span></h1>
      <p class="home-about">Selectstar에서 데이터 생성과<br>AI 모델 평가를 연구합니다.</p>
      <a class="home-resume-link link" href="/resume">경력과 연구 보기 <span aria-hidden="true">→</span></a>
    </section>
    <nav class="portal-grid three-worlds" aria-label="홈페이지 공간">
      <a class="portal card resume-portal" href="/resume" aria-labelledby="resume-label">
        ${artwork('resume.png', 'resume-hover.webp', '포트폴리오를 든 마스코트')}
        <div class="portal-copy"><div class="portal-title"><h2 id="resume-label">Resume</h2><span class="arrow" aria-hidden="true">↗</span></div><p>경력, 논문, 프로젝트</p><span class="portal-detail">공개</span></div>
      </a>
      <a class="portal card selectstar-portal work-portal" href="/work" aria-labelledby="work-label">
        ${artwork('selectstar-idle.webp', 'selectstar-hover.webp', 'Selectstar 마스코트')}
        <div class="portal-copy"><div class="portal-title"><h2 id="work-label">Selectstar</h2><span class="arrow" aria-hidden="true">→</span></div><p>연구일지, 팀 리소스와 업무 도구</p><span class="portal-detail">로그인 필요</span></div>
      </a>
      <a class="portal card paper-portal" href="/paper" aria-labelledby="paper-label">
        ${artwork('paper.png', 'paper-hover.png', '논문과 펜을 든 마스코트')}
        <div class="portal-copy"><div class="portal-title"><h2 id="paper-label">Paper</h2><span class="arrow" aria-hidden="true">→</span></div><p>리뷰탈 준비, 논문 리뷰</p><span class="portal-detail">로그인 필요</span></div>
      </a>
      <a class="portal card personal-portal" href="/personal" aria-labelledby="personal-label">
        ${artwork('personal-idle.webp', 'personal-t1.png', '머그잔을 든 마스코트')}
        <div class="portal-copy"><div class="portal-title"><h2 id="personal-label">Personal</h2><span class="arrow" aria-hidden="true">→</span></div><p>개인 공간</p><span class="portal-detail">공개</span></div>
      </a>
    </nav>
  </main>${footer()}
</div>`, 'home');

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

const subMenu = key => (WORK_SECTIONS.find(section => section.key === key)?.items || []).map(item => item[1]).join(' · ');

export function workPage({mode, role}) {
  const local = mode === 'local';
  const cards = [
    {kicker:'연구 관리', title:'연구일지', image:'journal.webp', description:'연구 로드맵과 L3 연구축을 세우고<br>연구 노트를 함께 남깁니다.', meta:subMenu('research'), href:'/work/app/index.html', action:'연구일지 열기'},
    {kicker:'팀 운영', title:'팀 리소스', image:'team-resources.png', description:'주간 기록으로 팀원별 과업 배분과<br>월별 변화를 봅니다.', meta:subMenu('team'), href:'/work/team-resources', action:'과업 배분 보기'},
    {kicker:'시연', title:'데모', image:'demo.webp', description:'연구 결과를 바로 보여 줄 수 있는<br>데모를 새 창에서 엽니다.', meta:subMenu('demos'), href:'/work/demos', action:'데모 선택하기'},
    {kicker:'예산', title:'품의 사용내역', image:'expenses.webp', description:'월별 카드 내역과 품의별 예산을<br>한눈에 확인합니다.', meta:subMenu('expenses'), href:'/work/expenses/', action:'품의 분석 열기'},
  ];
  const status = local ? '로컬 개발 미리보기 · localhost 전용' : role === 'reader' ? '연결됨 · 읽기 전용' : '연결됨 · 편집 가능';
  const note = `<p class="space-status"><span aria-hidden="true"></span>${status}</p>${local ? '<p class="space-notice">개발 미리보기입니다. 연구일지 변경은 이 프로젝트 사본에 저장되며 Supabase와 동기화되지 않습니다.</p>' : ''}`;
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
    {kicker:'글쓰기', title:'마크다운 에디터', image:'markdown-editor.webp', description:'마크다운으로 글을 쓰고<br>모양을 바로 확인합니다.', meta:'폴더 · 나란히 보기 · PDF 내보내기', href:'/personal/markdown', action:'마크다운 에디터 열기'},
  ];
  return shell('Personal', spaceHub({
    header, eyebrow: '여행과 일상을 위한 공간', title: 'Personal',
    description: '여행과 일상의 기록을<br>모아두는 공간입니다.', hero: 'personal-idle.webp', heroAlt: '소파에 앉아 쉬는 마스코트',
    label: 'Personal 도구', cards, extraClass: 'personal-tools',
  }), 'personal');
}

// 마크다운 에디터: 폴더와 문서 목록, 편집기와 미리보기, PDF 내보내기.
// 로그인하지 않은 방문자에게는 로그인 안내만 보여 줍니다.
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



