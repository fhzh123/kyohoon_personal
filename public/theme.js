/* Appearance is local to this browser, separate from shared research data. */
(() => {
 'use strict';
 const key='kyohoon-appearance',root=document.documentElement,media=window.matchMedia?.('(prefers-color-scheme: dark)');
 const valid=value=>['dark','light','system'].includes(value);
 let preference='dark',theme='dark';
 try{const saved=localStorage.getItem(key);if(valid(saved))preference=saved;}catch{}
 function refresh(){
  for(const button of document.querySelectorAll('[data-theme-toggle]')){
   const label=button.querySelector('[data-theme-label]');
   (label||button).textContent=theme==='dark'?'라이트 모드':'다크 모드';
   button.setAttribute('aria-label',theme==='dark'?'라이트 모드로 전환':'다크 모드로 전환');
   button.setAttribute('aria-pressed',String(theme==='dark'));
   button.title=preference==='system'?'시스템 설정을 따르는 중':theme==='dark'?'현재 다크 모드':'현재 라이트 모드';
  }
  for(const b of document.querySelectorAll('[data-theme-value]'))b.setAttribute('aria-pressed',String(b.dataset.themeValue===preference));
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
 window.AtlasTheme={refresh,set:value=>apply(value,true),get:()=>theme,preference:()=>preference};
})();
