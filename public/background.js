/* Public visual preferences; no authentication tokens or private workspace data are cached. */
(()=>{
 'use strict';const root=document.documentElement,key='kyohoon-site-background',defaults={config:{images:{light:null,dark:null},speed:40},urls:{light:null,dark:null},revision:null};let state=defaults,preview=false;
 const localImage=url=>typeof url==='string'&&/^\/api\/appearance\/file\?path=localhost%2F[a-f0-9-]+\.(png|jpg|webp)$/.test(url);
 const publicImage=url=>{try{const u=new URL(url);return u.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname)&&/^\/storage\/v1\/object\/public\/site-backgrounds\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}};
 function sanitize(value){if(!value?.config||!Number.isInteger(value.config.speed)||value.config.speed<0||value.config.speed>100)return defaults;return{config:{images:{...value.config.images},speed:value.config.speed},revision:value.revision||null,urls:Object.fromEntries(['light','dark'].map(mode=>[mode,publicImage(value.urls?.[mode])||localImage(value.urls?.[mode])?value.urls[mode]:null]))};}
 function paint(){const mode=root.dataset.theme==='light'?'light':'dark',url=state.urls[mode];root.dataset.bgImage=String(!!url);root.dataset.bgPaused=String(state.config.speed===0||document.hidden);root.style.setProperty('--sky-duration',(state.config.speed?4800/state.config.speed:120)+'s');root.style.setProperty('--sky-image',url?'url('+JSON.stringify(url)+')':'none');}
 function set(value,{persist=false,draft=false}={}){state=sanitize(value);preview=draft;paint();if(persist)try{localStorage.setItem(key,JSON.stringify(state));}catch{}window.dispatchEvent(new CustomEvent('atlas-background-change',{detail:state}));}
 try{state=sanitize(JSON.parse(localStorage.getItem(key)||'null'));}catch{}paint();
 const css=document.createElement('link');css.rel='stylesheet';css.href='/background.css?v=20261115-2';
 function ensureSky(){if(!css.isConnected)document.head.append(css);if(!document.querySelector('.ambient-sky')){const sky=document.createElement('div');sky.className='ambient-sky';sky.setAttribute('aria-hidden','true');document.body.prepend(sky);}paint();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(ensureSky,100),{once:true});else setTimeout(ensureSky,100);
 new MutationObserver(paint).observe(root,{attributes:true,attributeFilter:['data-theme']});
 document.addEventListener('visibilitychange',paint);window.addEventListener('storage',e=>{if(e.key===key&&!preview)try{set(JSON.parse(e.newValue));}catch{}});
 window.AtlasBackground={get:()=>JSON.parse(JSON.stringify(state)),set};
 fetch('/api/appearance',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(value=>{if(value&&!preview)set(value,{persist:true});}).catch(()=>{});
})();
