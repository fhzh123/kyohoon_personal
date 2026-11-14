const uiIcon = name => `<img class="ui-icon" src="/icons/ui-${name}.svg" width="18" height="18" alt="" aria-hidden="true">`;
const themeButton = () => `<button type="button" class="theme-toggle theme-toggle--icon btn btn--secondary" data-theme-toggle aria-label="라이트 모드로 전환" aria-pressed="true"><span class="theme-sun">${uiIcon('sun')}</span><span class="theme-moon">${uiIcon('moon')}</span><span data-theme-label hidden>라이트 모드</span></button>`;
const brand = () => '<a class="wordmark" href="/" aria-label="Kyohoon Jin 홈"><img src="/mascot/face.png" alt="" width="36" height="36"><span>Kyohoon Jin</span></a>';
const footer = () => `<footer class="site-footer"><span>© ${new Date().getFullYear()} Kyohoon Jin</span></footer>`;
const shell = (title, body, surface = '') => `<!doctype html>
<html lang="ko" data-theme="dark" data-type="service" data-radius="soft" data-motion>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#131517">
<meta name="description" content="AI Research Engineer 진교훈의 경력과 연구 기록. Selectstar 연구일지와 업무 도구.">
<meta name="page-type" content="service"><meta name="site-kind" content="other">
<meta property="og:title" content="${title} | Kyohoon Jin"><meta property="og:description" content="AI Research Engineer 진교훈의 경력과 연구 기록."><meta property="og:type" content="website"><meta property="og:image" content="/mascot/resume.png"><meta name="twitter:card" content="summary">
<title>${title} | Kyohoon Jin</title><link rel="icon" href="/mascot/face.png">

<script src="/theme.js?v=20261113-1"></script><script src="/loading.js?v=20261113-1" defer></script>

<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin><link rel="stylesheet" href="/typography.css?v=20261112-1">
<link rel="stylesheet" href="/taste.css?v=20261113-1"><link rel="stylesheet" href="/assets/taste/motion/motion.css">
<script>document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700)</script>
<script type="module" src="/assets/taste/motion/motion.js"></script>
<link rel="stylesheet" href="/atmosphere.css?v=20261114-motion-1">
<link rel="stylesheet" href="/auth.css?v=20261113-2">
</head><body data-surface="${surface}"><div class="ambient-sky" aria-hidden="true"></div><a class="skip-link" href="#main">본문으로 건너뛰기</a>${body}</body></html>`;

function artwork(idle, hover, alt) {
  return `<div class="portal-art ${hover && hover !== idle ? 'has-swap' : ''}"><img class="pose-idle" src="/mascot/${idle}" alt="${alt}" width="768" height="768" decoding="async">${hover && hover !== idle ? `<img class="pose-active" src="/mascot/${hover}" alt="" aria-hidden="true" width="768" height="768" decoding="async">` : ''}</div>`;
}

export const homePage = ({authenticated = false} = {}) => shell('진교훈', `
<div class="home-shell">
  <header class="site-header">${brand()}<nav class="header-actions" aria-label="빠른 이동"><a class="text-link home-shortcut" href="/resume">${uiIcon('file-text')}<span>Resume</span></a><a class="text-link home-shortcut" href="/work">${uiIcon('briefcase-business')}<span>Work</span></a>${themeButton()}${authenticated ? '<form action="/api/auth/logout" method="post"><button class="btn header-login" type="submit">로그아웃</button></form>' : '<a class="btn header-login" href="/login">로그인</a>'}</nav></header>
  <main id="main" class="home-main hero hero--split" data-enter aria-labelledby="intro-title">
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
        <div class="portal-copy"><div class="portal-title"><h2 id="work-label">Selectstar</h2><span class="arrow" aria-hidden="true">→</span></div><p>연구일지, 데모, 품의 사용내역</p><span class="portal-detail">로그인 필요</span></div>
      </a>
      <a class="portal card personal-portal" href="/personal" aria-labelledby="personal-label">
        ${artwork('personal-idle.webp', 'personal-build.webp', '머그잔을 든 마스코트')}
        <div class="portal-copy"><div class="portal-title"><h2 id="personal-label">Personal</h2><span class="arrow" aria-hidden="true">→</span></div><p>개인 공간</p><span class="portal-detail">로그인 필요</span></div>
      </a>
    </nav>
  </main>${footer()}
</div>`, 'home');

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}

export function loginPage({configured, preview, message = '', next = '/work'}) {
  return shell('로그인', `
<div class="login-shell"><header class="site-header">${brand()}<div class="header-actions"><a class="text-link link" href="/">${uiIcon('house')}<span>홈으로</span></a>${themeButton()}</div></header>
<main id="main" class="login-main hero" data-enter aria-labelledby="login-title">
  <div class="login-art hero-text"><p class="login-eyebrow">Kyohoon Jin</p><h1 id="login-title">나의 공간에<br>로그인하세요.</h1><p>연구일지와 개인 공간을<br>등록된 계정으로 이용하세요.</p><div class="auth-mascot auth-mascot--login"><img src="/mascot/login-mascots.png" alt="키 카드를 들고 안내하는 마스코트" width="1920" height="819"></div></div>
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
<dialog id="account-help" class="contact-dialog" aria-labelledby="contact-title" aria-describedby="contact-description">
 <div class="contact-content"><button class="dialog-close" type="button" data-contact-close aria-label="문의 안내 닫기">×</button>
 <div class="auth-mascot auth-mascot--support" aria-hidden="true"><img src="/mascot/login-mascots.png" alt="" width="1920" height="819"></div>
 <h2 id="contact-title">계정 도움이 필요하신가요?</h2><p id="contact-description">비밀번호를 잊으셨다면<br>아래 연락처로 관리자에게 직접 문의해 주세요.</p>
 <div class="contact-methods"><div class="contact-qr"><div class="qr-frame"><img src="https://i.ibb.co/VYhm8hmW/image.png" alt="관리자 카카오톡 QR코드" width="164" height="164"></div><strong>카카오톡으로 문의</strong><p>카카오톡 앱으로 QR코드를 스캔해 주세요.</p></div>
 <div class="contact-email"><span>관리자 이메일</span><a href="mailto:fhzh@naver.com">fhzh@naver.com</a><button type="button" class="btn" data-copy-email>이메일 주소 복사</button><p class="copy-status" role="status" aria-live="polite"></p></div></div>
 <button type="button" class="btn btn--primary contact-done" data-contact-close>확인</button></div>
</dialog><script src="/auth.js?v=20261113-1" defer></script>`, 'login');
}

function privateHeader(back = '/') {
  return `<header class="site-header">${brand()}<div class="hub-header-actions"><a class="text-link link" href="${back}">${uiIcon(back === '/' ? 'house' : 'briefcase-business')}<span>${back === '/' ? '홈으로' : 'Selectstar 홈'}</span></a>${themeButton()}<form action="/api/auth/logout" method="post"><button class="logout-button btn btn--secondary" type="submit">${uiIcon('log-out')}<span>로그아웃</span></button></form></div></header>`;
}

export function workPage({mode, role}) {
  const local = mode === 'local';
  const tools = [
    {title:'연구일지', image:'journal.webp', alt:'연구 노트를 쓰는 마스코트', description:'연구 로드맵과 실험 기록을 관리합니다.', href:'/work/app/index.html', action:'연구일지 열기'},
    {title:'데모', image:'demo.webp', alt:'홀로그램을 시연하는 마스코트', description:'Ontology와 Document Parsing을 실행합니다.', href:'/work/demos', action:'데모 선택하기'},
    {title:'품의 사용내역', image:'expenses.webp', alt:'계산기와 영수증을 든 마스코트', description:'월별 카드 내역과 품의별 예산을 확인합니다.', href:'/work/expenses/', action:'품의 분석 열기'},
  ];
  return shell('Selectstar', `
<div class="hub-shell spaces-hub">${privateHeader()}<main id="main" class="hub-main">
  <section class="hub-intro hero" data-enter><div class="hero-text"><h1>Selectstar</h1><p>연구일지와 업무 도구</p><span class="connection-tag">${local ? '로컬 개발 미리보기 / localhost 전용' : role === 'reader' ? '연결됨 / 읽기 전용' : '연결됨 / 편집 가능'}</span></div></section>
  ${local ? '<p class="hub-local-note">개발 미리보기입니다. 연구일지 변경은 이 프로젝트 사본에 저장되며 Supabase와 동기화되지 않습니다.</p>' : ''}
  <div class="tool-grid illustrated-tools">${tools.map(t => `<a class="tool-card card" href="${t.href}"><div class="tool-illustration"><img src="/mascot/${t.image}" alt="${t.alt}" width="380" height="380"></div><div class="tool-copy"><h2>${t.title}</h2><p>${t.description}</p><span class="tool-action">${t.action}<span aria-hidden="true">→</span></span></div></a>`).join('')}</div>
</main>${footer()}</div>`, 'selectstar');
}

export function demosPage() {
  const demos = [
    {title:'Ontology', image:'ontology.webp', alt:'지식 그래프를 살펴보는 마스코트', text:'문서에서 개념과 관계를 추출하고 지식 구조를 확인합니다.', href:'https://selectstar-ai-vertical-research-feasibility.kyohoon-jin.chatgpt.site/'},
    {title:'Document Parsing', image:'parsing.webp', alt:'돋보기로 문서를 살펴보는 마스코트', text:'문서의 레이아웃을 분석하고 텍스트와 표를 추출합니다.', href:'https://selectstar-ai-vertical-research-feasibility-document-parsing.kyohoon-jin.chatgpt.site/'},
  ];
  return shell('연구 데모', `
<div class="hub-shell demo-shell">${privateHeader('/work')}<main id="main" class="hub-main">
  <section class="demo-heading hero" data-enter><div class="hero-text"><h1>연구 데모</h1><p>각 데모는 새 창에서 열립니다.</p></div></section>
  <div class="portal-grid demo-portals">${demos.map(d => `<a class="portal card demo-portal" href="${d.href}" target="_blank" rel="noopener noreferrer">${artwork(d.image, d.image, d.alt)}<div class="portal-copy"><div class="portal-title"><h2>${d.title}</h2></div><p>${d.text}</p><span class="demo-launch">데모 열기 <span aria-hidden="true">↗</span></span><span class="sr-only">새 창에서 열림</span></div></a>`).join('')}</div>
</main>${footer()}</div>`, 'demos');
}

export function personalPage() {
  return shell('Personal', `
<div class="hub-shell personal-shell">${privateHeader()}<main id="main" class="construction-main hero" data-enter><div class="hero-text"><h1>Personal</h1><p>아직 등록된 콘텐츠가 없습니다.</p><a class="primary-button btn btn--primary home-return" href="/">홈으로 돌아가기 <span aria-hidden="true">→</span></a></div><div class="construction-art"><img src="/mascot/personal-build.webp" alt="안전모를 쓴 마스코트" width="480" height="480"></div></main>${footer()}</div>`, 'personal');
}

