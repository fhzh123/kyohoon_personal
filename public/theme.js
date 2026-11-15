/* Appearance is local to this browser, separate from shared research data. */
(() => {
 'use strict';
 const key='kyohoon-appearance',root=document.documentElement,media=window.matchMedia?.('(prefers-color-scheme: dark)');
 const valid=value=>['dark','light','system'].includes(value);
 let preference='dark',theme='dark';
 try{const saved=localStorage.getItem(key);if(valid(saved))preference=saved;}catch{}
 function refresh(){
  for(const button of document.querySelectorAll('[data-theme-toggle]')){
   const link=document.createElement('a');link.className=button.className;link.href='/settings';link.dataset.globalSettings='';link.setAttribute('aria-label','설정');link.title='설정';link.innerHTML='<img class="ui-icon" src="/icons/ui-settings.svg" width="18" height="18" alt="">';button.replaceWith(link);
  }
  for(const b of document.querySelectorAll('[data-theme-value]'))b.setAttribute('aria-pressed',String(b.dataset.themeValue===preference));
  for(const link of document.querySelectorAll('[data-global-settings]'))link.href='/settings?returnTo='+encodeURIComponent(location.pathname+location.search+location.hash);
  const status=document.querySelector('#appearance-status');
  if(status)status.textContent=preference==='system'?`시스템 설정에 따라 ${theme==='dark'?'다크':'라이트'} 모드가 적용 중입니다.`:'선택한 테마를 이 브라우저에 저장했습니다.';
 }
 function apply(value,persist=false){
  if(!valid(value))return;
  preference=value;theme=value==='system'?(media?.matches?'dark':'light'):value;
  root.dataset.theme=theme;root.dataset.appearance=value;root.style.colorScheme=theme;
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#080a0d':'#f7f8fa';
  if(persist)try{localStorage.setItem(key,value);}catch{}
  refresh();
 }
 apply(preference);document.addEventListener('DOMContentLoaded',refresh);
 document.addEventListener('click',event=>{const b=event.target.closest('[data-theme-toggle],[data-theme-value]');if(b&&!b.disabled)apply(b.dataset.themeValue||(theme==='dark'?'light':'dark'),true);});
 const systemChanged=()=>{if(preference==='system')apply('system');};
 if(media?.addEventListener)media.addEventListener('change',systemChanged);else media?.addListener?.(systemChanged);
 window.addEventListener('storage',event=>{if(event.key===key)apply(valid(event.newValue)?event.newValue:'dark');});
 const background=document.createElement('script');background.src='/background.js?v=20261115-2';background.defer=true;document.head.append(background);
 window.AtlasTheme={refresh,set:value=>apply(value,true),get:()=>theme,preference:()=>preference};
})();

