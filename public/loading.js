(() => {
  'use strict';
  let delayed;
  const markup = `<div class="research-loading-card"><h2>연구일지를 불러오는 중</h2><p id="research-loading-stage">연구 공간을 준비하고 있습니다.</p><div class="loading-actions" hidden><button type="button" data-loading-retry>다시 시도</button><a href="/work">Selectstar 홈으로</a></div></div>`;
  const element = () => document.querySelector('#research-loading');
  function show(message = '연구 공간에 연결하고 있습니다.') {
    let overlay = element();
    if (!overlay) {
      overlay = document.createElement('div'); overlay.id='research-loading'; overlay.className='research-loading';
      overlay.setAttribute('role','status'); overlay.setAttribute('aria-live','polite'); overlay.innerHTML=markup; document.body.append(overlay);
    }
    overlay.hidden=false; overlay.classList.remove('is-error');
    overlay.querySelector('.loading-actions').hidden=true;
    document.querySelector('.app-shell')?.setAttribute('inert','');
    document.body.setAttribute('aria-busy','true'); stage(message);
    clearTimeout(delayed); delayed=setTimeout(()=>fail('연결이 지연되고 있습니다. 다시 시도하거나 Selectstar 홈으로 돌아가 주세요.'),20000);
  }
  function stage(message) { const label=document.querySelector('#research-loading-stage'); if(label)label.textContent=message; }
  function done() { clearTimeout(delayed); if(element())element().hidden=true; document.querySelector('.app-shell')?.removeAttribute('inert'); document.body.removeAttribute('aria-busy'); }
  function fail(message) { clearTimeout(delayed); const overlay=element(); if(!overlay)return; stage(message); overlay.classList.add('is-error'); overlay.querySelector('.loading-actions').hidden=false;document.body.removeAttribute('aria-busy'); }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-loading-retry]')){location.reload();return;}
    const link=event.target.closest('a[href]');
    if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download'))return;
    const url=new URL(link.href,location.href);
    if(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search)return;
    if(url.origin===location.origin&&url.pathname==='/work/app/index.html')show();
  });
  window.addEventListener('pageshow',event=>{if(event.persisted)done();});
  window.addEventListener('hashchange',()=>{if(window.ResearchAtlas)done();});
  window.ResearchLoading={show,stage,done,fail};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(element())show();});
  else if(element())show();
})();
