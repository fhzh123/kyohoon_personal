(()=>{
'use strict';
const $=s=>document.querySelector(s),app=$('#llm-app'),preview=false,clone=x=>JSON.parse(JSON.stringify(x));
const names={openai:'GPT',anthropic:'Claude',gemini:'Gemini'},efforts={openai:['none','minimal','low','medium','high','xhigh','max'],anthropic:['none','low','medium','high','xhigh','max'],gemini:['none','minimal','low','medium','high']};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(label,action,cls='',extra='')=>'<button type="button" class="paper-btn '+cls+'" data-action="'+action+'" '+extra+'>'+label+'</button>';
let data,settingsDirty=false,removedKeys={},busy=false,timer;
function notice(message,error=false){const n=$('#settings-status');n.textContent=message;n.classList.toggle('error',error);n.hidden=false;clearTimeout(timer);timer=setTimeout(()=>n.hidden=true,error?14000:5000);}
async function api(url,method='GET',body){const r=await fetch(url,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json().catch(()=>({error:'응답을 읽지 못했습니다.'}));if(!r.ok)throw Object.assign(Error(v.error||'설정을 저장하지 못했습니다.'),{status:r.status});return v;}
function selectTab(){const requested=location.hash.slice(1);if(requested==='travel'){location.replace('/personal/travel#colors');return;}const tab=['appearance','background','llm'].includes(requested)?requested:'appearance';for(const n of document.querySelectorAll('[data-settings-tab]')){n.setAttribute('aria-current',n.dataset.settingsTab===tab?'page':'false');}for(const section of ['appearance','background','llm'])$('#'+section).hidden=tab!==section;window.AtlasTheme?.refresh();}
const returnLink=$('#settings-return');try{const u=new URL(new URLSearchParams(location.search).get('returnTo')||'/',location.origin);if(u.origin===location.origin&&/^\/(?:$|paper(?:\/|$)|resume(?:\/|$)|work(?:\/|$)|personal(?:\/|$))/.test(u.pathname))returnLink.href=u.pathname+u.search+u.hash;}catch{}
window.SettingsAccess={render(tab){const fragment=$('#settings-login-template').content.cloneNode(true);fragment.querySelector('[data-access-description]').textContent=tab==='background'?'배경 이미지를 바꾸고 움직임 속도를 조절하려면 로그인해 주세요.':'API 키와 모델 설정은 로그인 후 이용할 수 있습니다.';fragment.querySelector('[data-access-login]').href='/login?next='+encodeURIComponent('/settings'+location.search+'#'+tab);const holder=document.createElement('div');holder.append(fragment);return holder.innerHTML;}};
window.addEventListener('hashchange',selectTab);selectTab();
  // Reasoning Effort: the provider's current levels, or any value typed in, in case the scheme changes later.
  function effortField(p){
    const saved=data.settings.efforts?.[p]||'none',custom=!efforts[p].includes(saved);
    return '<label class="paper-field effort-field" for="effort-'+p+'"><span>Reasoning Effort</span></label><div class="effort-row"><select id="effort-'+p+'" aria-label="'+names[p]+' Reasoning Effort" data-effort-select="'+p+'">'+efforts[p].map(value=>'<option value="'+value+'" '+(!custom&&value===saved?'selected':'')+'>'+(value==='none'?'None — 옵션 보내지 않음':value.charAt(0).toUpperCase()+value.slice(1))+'</option>').join('')+'<option value="custom" '+(custom?'selected':'')+'>직접 입력</option></select><input type="text" id="effort-custom-'+p+'" aria-label="'+names[p]+' Reasoning Effort 직접 입력" placeholder="예: high, 2048" maxlength="32" spellcheck="false" autocomplete="off" value="'+(custom?esc(saved):'')+'" '+(custom?'':'hidden')+'></div><p class="paper-subtle">None은 모델의 기본 동작을 사용합니다. 목록에 없는 값은 직접 입력을 골라 적으면 그대로 제공사에 보냅니다(영문, 숫자, -, _ 32자 이내). 지원하는 수준은 모델마다 다르며, 높을수록 시간과 사용량이 늘어날 수 있습니다.</p>';
  }
  function effortValue(p){const select=$('#effort-'+p);if(select.value!=='custom')return select.value;const typed=$('#effort-custom-'+p).value.trim();if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(typed))throw Error(names[p]+' Reasoning Effort 직접 입력 값을 확인해 주세요. 영문, 숫자, -, _ 32자 이내입니다.');return typed;}
  function renderSettings(){
    settingsDirty=false;removedKeys={};
    app.innerHTML='<div class="paper-settings"><div class="paper-settings-head"><div><p class="paper-eyebrow">공통 LLM 설정</p><h2>모델</h2></div>'+btn('설정 저장','save-settings','primary')+'</div>'+
      (preview?'<p class="paper-preview-note">설정 화면 미리보기입니다. 실제 API 키를 입력하지 마세요.</p>':'')+
      '<section class="paper-setting-section"><h2>사용할 모델</h2><p class="paper-subtle">등록한 키와 선택한 모델을 LLM 기능에서 공통으로 사용합니다.<br>API 키는 암호화해 저장하며 끝 네 자리만 표시합니다.<br>번역, 리뷰탈, 리뷰 프롬프트는 <a href="/paper">Paper</a>의 각 작업 화면에서 설정합니다.</p>'+(!data.settings.encryptionReady&&!preview?'<p class="paper-preview-note">서버에 API 키 암호화 설정이 필요합니다. 키 저장은 설정 완료 후 이용할 수 있습니다.</p>':'')+
      Object.keys(names).map(p=>'<div class="paper-provider"><div class="paper-provider-head"><label><input type="radio" name="paper-provider" value="'+p+'" '+(data.settings.provider===p?'checked':'')+'>'+names[p]+'</label><span class="paper-key-mask" id="key-mask-'+p+'">'+(data.settings.keys[p].configured?'등록됨 / •••• '+esc(data.settings.keys[p].last4):'등록된 키 없음')+'</span></div><label class="paper-field"><span>API 키</span></label><div class="paper-key-row"><input type="password" id="key-'+p+'" aria-label="'+names[p]+' API 키" autocomplete="new-password" spellcheck="false" placeholder="'+(data.settings.keys[p].configured?'변경할 때만 새 키 입력':'API 키 입력')+'" '+(preview?'disabled':'')+'>'+btn('키 삭제','remove-key','','data-provider="'+p+'"')+'</div><label class="paper-field"><span>모델 ID</span></label><div class="paper-model-row"><input type="text" id="model-'+p+'" list="models-'+p+'" aria-label="'+names[p]+' 모델 ID" value="'+esc(data.settings.models[p])+'" maxlength="160"><datalist id="models-'+p+'"><option value="'+esc(data.settings.models[p])+'"></datalist>'+btn('모델 불러오기','models','','data-provider="'+p+'"')+'</div>'+effortField(p)+'<p class="paper-subtle">키를 저장한 뒤 계정에서 사용 가능한 모델을 불러오거나, 모델 ID를 직접 입력하세요.</p></div>').join('')+'</section>'+
      '<div class="settings-save-bar"><small data-settings-save-state>변경한 설정을 저장해 주세요.</small>'+btn('설정 저장','save-settings','primary')+'</div></div>';
  }
  function collectSettings(){return {provider:$('input[name="paper-provider"]:checked').value,efforts:Object.fromEntries(Object.keys(names).map(p=>[p,effortValue(p)])),models:Object.fromEntries(Object.keys(names).map(p=>[p,$('#model-'+p).value.trim()])),keys:Object.fromEntries(Object.keys(names).flatMap(p=>removedKeys[p]?[[p,null]]:$('#key-'+p).value?[[p,$('#key-'+p).value.trim()]]:[])),expectedRevision:data.settings.revision};}

app.addEventListener('input',e=>{settingsDirty=true;if(e.target.id.startsWith('key-')&&e.target.value)delete removedKeys[e.target.id.slice(4)];const n=$('[data-settings-save-state]');if(n)n.textContent='저장하지 않은 변경';});
app.addEventListener('change',e=>{settingsDirty=true;const p=e.target.dataset?.effortSelect;if(p){const box=$('#effort-custom-'+p);box.hidden=e.target.value!=='custom';if(!box.hidden)box.focus();}});
async function saveSettings(){if(busy)return;const payload=collectSettings();busy=true;const fields=[...app.querySelectorAll('input,select,textarea,button')];fields.forEach(n=>n.disabled=true);try{const r=await api('/api/settings/llm','PUT',payload);data.settings=r.settings;renderSettings();notice('공통 LLM 설정을 저장했습니다.');$('[data-settings-save-state]').textContent='저장됨';}finally{busy=false;fields.forEach(n=>n.disabled=false);}}
app.addEventListener('click',async e=>{const n=e.target.closest('[data-action]');if(!n||busy)return;const a=n.dataset.action;try{
if(a==='save-settings')await saveSettings();
if(a==='remove-key'){if(!confirm(names[n.dataset.provider]+' 키를 삭제할까요? 설정 저장 시 반영됩니다.'))return;removedKeys[n.dataset.provider]=true;$('#key-'+n.dataset.provider).value='';$('#key-mask-'+n.dataset.provider).textContent='저장 시 삭제';settingsDirty=true;}
if(a==='models'){if(settingsDirty)throw Error('변경한 키와 설정을 먼저 저장해 주세요.');n.disabled=true;try{const r=await api('/api/settings/llm/models?provider='+n.dataset.provider);$('#models-'+n.dataset.provider).innerHTML=r.models.map(m=>'<option value="'+esc(m)+'"></option>').join('');notice(r.models.length+'개 모델을 불러왔습니다. 모델 ID 입력란에서 선택하세요.');}finally{n.disabled=false;}}
if(a==='retry')await init();
}catch(error){notice(error.message,true);}});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();if(data?.role==='editor')saveSettings().catch(e=>notice(e.message,true));}});
window.addEventListener('beforeunload',e=>{if(settingsDirty||busy){e.preventDefault();e.returnValue='';}});
async function init(){if(app.dataset.authenticated==='false'){app.innerHTML=window.SettingsAccess.render('llm');app.setAttribute('aria-busy','false');return;}try{data=await api('/api/settings/llm');renderSettings();if(data.role!=='editor'){for(const n of app.querySelectorAll('input,select,textarea,button'))n.disabled=true;app.insertAdjacentHTML('afterbegin','<p class="paper-subtle">읽기 전용 계정입니다.</p>');}}catch(e){app.innerHTML=e.status===401?window.SettingsAccess.render('llm'):'<h2>LLM 설정</h2><p>'+esc(e.message)+'</p>'+btn('다시 불러오기','retry');}app.setAttribute('aria-busy','false');}

function initMascotSettings() {
  const section = document.querySelector('[data-mascot-settings]');
  if (!section) return;
  const select = section.querySelector('select');
  const image = section.querySelector('[data-mascot-preview]');
  const reset = section.querySelector('[data-mascot-reset]');
  const status = section.querySelector('[data-mascot-status]');
  const key = 'kyohoon-home-mascot';
  const defaultSrc = image.getAttribute('src');

  function show(src = '') {
    if (['/mascot/paper-pose.webp', '/mascot/personal-pose.webp'].includes(src) &&
        !Array.from(select.options).some(option => option.value === src)) {
      select.add(new Option('이전에 고른 모습', src));
    }
    select.value = src;
    if (select.selectedIndex < 0) select.value = '';
    image.src = select.value || defaultSrc;
    image.alt = select.selectedOptions[0].textContent;
    reset.disabled = !select.value;
  }

  function save(src) {
    try {
      if (src) localStorage.setItem(key, src);
      else localStorage.removeItem(key);
    } catch {
      status.textContent = '이 브라우저에 설정을 저장할 수 없어요.';
      show(image.getAttribute('src') === defaultSrc ? '' : image.getAttribute('src'));
      return;
    }
    show(src);
    status.textContent = src ? '홈 마스코트 모습을 저장했어요.' : '기본 모습으로 돌렸어요.';
  }

  try { show(localStorage.getItem(key) || ''); } catch { show(); }
  select.addEventListener('change', () => save(select.value));
  reset.addEventListener('click', () => save(''));
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) show(event.newValue || '');
  });
}
initMascotSettings();
init();
})();
