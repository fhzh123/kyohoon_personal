import {shell,privateHeader,publicHeader,footer,escapeHtml} from './pages.mjs';
import {homeMascotOptions} from './gallery.mjs';

const descriptions={background:'배경 이미지를 바꾸고 움직임 속도를 조절하려면 로그인해 주세요.',llm:'API 키와 모델 설정은 로그인 후 이용할 수 있습니다.'};
function loginGate(tab){return `<div class="settings-access"><img src="/mascot/login-required.png" width="220" height="220" alt="자물쇠를 들고 로그인 필요 상태를 안내하는 마스코트" loading="lazy"><div><h2>로그인 후 이용할 수 있습니다</h2><p data-access-description>${descriptions[tab]}</p><a class="paper-btn primary" data-access-login href="/login?next=${encodeURIComponent('/settings#'+tab)}">로그인</a></div></div>`;}
const mascotGroups = {basic:'인사와 기본', daily:'여행과 일상', work:'일하는 모습', poses:'방향과 포즈'};
function mascotSettings() {
  const groups = Object.entries(mascotGroups).map(([group,label]) => {
    const options = homeMascotOptions.filter(item => item.group === group);
    return options.length ? `<optgroup label="${label}">${options.map(item => `<option value="${escapeHtml(item.src)}">${escapeHtml(item.title)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  return `<section class="mascot-settings" aria-labelledby="home-mascot-title" data-mascot-settings>
    <div class="settings-section-title"><h2 id="home-mascot-title">홈 마스코트</h2><p>이 브라우저에서 홈을 열 때 보일 모습을 고르세요.</p></div>
    <div class="mascot-settings-picker">
      <img class="mascot-settings-preview" src="/mascot/original.png" width="120" height="120" alt="기본 마스코트" data-mascot-preview>
      <div class="mascot-settings-fields">
        <label class="paper-field" for="home-mascot">마스코트 모습</label>
        <select id="home-mascot"><option value="">기본 모습</option>${groups}</select>
        <div class="mascot-settings-actions"><button type="button" class="paper-btn" data-mascot-reset>기본으로 돌리기</button><a href="/personal/gallery">갤러리 둘러보기</a></div>
      </div>
    </div>
    <p class="paper-subtle mascot-settings-status" role="status" data-mascot-status></p>
  </section>`;
}
export function settingsPage({authenticated=false}={}){
  const content=(tab,label)=>authenticated?`<p class="paper-subtle">${label} 설정을 불러오는 중입니다.</p>`:loginGate(tab);
  return shell('설정',`<link rel="stylesheet" href="/paper.css?v=20261120-1"><link rel="stylesheet" href="/settings.css?v=20261120-1"><link rel="stylesheet" href="/home-mascot-settings.css?v=20261128-1"><link rel="stylesheet" href="/personal.css?v=20261116-3"><div class="paper-shell">
  ${authenticated?privateHeader():publicHeader()}
  <main id="main" class="settings-main paper-main"><a class="paper-back" id="settings-return" href="/">← 돌아가기</a>
  <div class="settings-heading"><p class="paper-eyebrow">PREFERENCES</p><h1>설정</h1><p>화면과 배경, LLM 사용 환경을 설정합니다.</p></div>
  <div class="settings-layout"><nav class="settings-nav" aria-label="설정 항목">
    <a href="#appearance" data-settings-tab="appearance">화면<span>Display</span></a>
    <a href="#background" data-settings-tab="background">배경<span>Background</span></a>
    <a href="#llm" data-settings-tab="llm">LLM 설정<span>Models</span></a>
  </nav><div class="settings-content">
    <section id="appearance" class="settings-panel"><div class="settings-section-title"><h2>화면 모드</h2><p>이 브라우저에서 사용할 화면을 선택하세요.</p></div>
    <div class="appearance-options">${[['light','라이트','밝고 선명하게'],['dark','다크','차분한 어둠 속에서'],['system','시스템','기기 설정에 맞춰서']].map(([v,n,d])=>`<button type="button" class="appearance-option" data-theme-value="${v}" aria-pressed="false"><span class="appearance-sample sample-${v}" aria-hidden="true"><i></i><b></b><b></b></span><strong>${n}</strong><small>${d}</small></button>`).join('')}</div>
    <p class="paper-subtle" id="appearance-status" role="status"></p>
    <div class="settings-section-title"><h2>시작 애니메이션</h2><p>홈 화면이 처음 나타날 때의 움직임을 설정합니다.</p></div>
    <label class="paper-field" for="home-motion">재생 방식</label><select id="home-motion" data-home-motion-select><option value="system">기기 설정 따르기</option><option value="on">켜기</option><option value="off">끄기</option></select>
    <p class="paper-subtle" id="home-motion-status" role="status"></p>
    ${mascotSettings()}</section>
    <section id="background" class="settings-panel" hidden><div id="background-controls" class="background-settings" data-authenticated="${authenticated}">${content('background','배경')}</div></section>
    <section id="llm" class="settings-panel" hidden><div id="llm-app" data-authenticated="${authenticated}" aria-busy="${authenticated}">${content('llm','모델')}</div></section>
  </div></div></main>${footer()}</div>
  <template id="settings-login-template">${loginGate('llm')}</template>
  <div id="settings-status" class="paper-toast" role="status" aria-live="polite" hidden></div>
  <script src="/settings.js?v=20261128-1" defer></script><script src="/appearance-settings.js?v=20261115-3" defer></script>`,'settings');
}

