(() => {
  'use strict';
  function start(config){
    const idle=Number(config.idleMs),initial=Number(config.lastActive),initialNow=Number(config.serverNow);
    if(!(idle>0&&initial>0&&initialNow>0))return;
    const key='kh-activity:'+config.sessionKey,logoutKey='kh-logout:'+config.sessionKey;
    let offset=initialNow-Date.now(),lastActive=initial,confirmed=initial,lastSent=Date.now(),pending=false,ended=false;
    let deadlineTimer,syncTimer,publishTimer,lastPublished=0;
    const events=new AbortController(),signal=events.signal;
    const now=()=>Date.now()+offset;
    const readShared=()=>{try{const value=Number(localStorage.getItem(key));return value>0&&value<=now()+60000?value:0;}catch{return 0;}};
    const publish=()=>{publishTimer=null;if(ended)return;try{localStorage.setItem(key,String(lastActive));lastPublished=Date.now();}catch{}};
    const stop=()=>{ended=true;events.abort();clearTimeout(deadlineTimer);clearTimeout(syncTimer);clearTimeout(publishTimer);};
    const navigate=reason=>{
      if(ended)return;stop();
      try{localStorage.setItem(logoutKey,String(now()));}catch{}
      const next=location.pathname+location.search+location.hash;
      const destination='/login?'+(reason==='idle'?'reason=idle&':'')+'next='+encodeURIComponent(next);
      if(config.navigate)config.navigate(destination);else location.assign(destination);
    };
    const adopt=value=>{
      if(Number.isFinite(value.serverNow))offset=value.serverNow-Date.now();
      if(Number.isFinite(value.lastActive)){confirmed=Math.max(confirmed,value.lastActive);lastActive=Math.max(lastActive,confirmed);}
      scheduleDeadline();
    };
    async function expire(){
      if(ended)return;
      lastActive=Math.max(lastActive,readShared());
      if(now()<lastActive+idle){scheduleDeadline();return;}
      try{
        // An active sibling tab may have just renewed the cookie. The server
        // checks that deadline before allowing this tab to clear the session.
        const response=await fetch('/api/auth/idle-logout',{method:'POST',credentials:'same-origin',cache:'no-store',signal});
        if(response.status===409){adopt(await response.json());publish();return;}
      }catch{}
      navigate('idle');
    }
    function scheduleDeadline(){
      clearTimeout(deadlineTimer);if(ended)return;
      deadlineTimer=setTimeout(expire,Math.max(0,lastActive+idle-now()));
    }
    async function flush(){
      syncTimer=null;if(ended||pending)return;
      lastActive=Math.max(lastActive,readShared());
      if(now()>=lastActive+idle){expire();return;}
      if(lastActive<=confirmed)return;
      pending=true;lastSent=Date.now();
      try{
        const response=await fetch('/api/auth/activity',{method:'POST',credentials:'same-origin',cache:'no-store',keepalive:true,signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({lastActivity:Math.floor(lastActive)})});
        if(response.status===401){navigate('session');return;}
        if(response.ok)adopt(await response.json());
      }catch{}
      finally{
        pending=false;
        if(!ended&&lastActive>confirmed)scheduleSync();
      }
    }
    function scheduleSync(){
      if(ended||syncTimer||pending)return;
      // A request is scheduled only after real interaction, never by polling.
      syncTimer=setTimeout(flush,Math.max(0,30000-(Date.now()-lastSent)));
    }
    function activity(){
      if(ended)return;
      lastActive=Math.max(lastActive,readShared());
      if(now()>=lastActive+idle){expire();return;}
      lastActive=now();scheduleDeadline();scheduleSync();
      if(Date.now()-lastPublished>=1000)publish();
      else if(!publishTimer)publishTimer=setTimeout(publish,1000);
    }
    function check(){
      if(ended)return;lastActive=Math.max(lastActive,readShared());
      if(now()>=lastActive+idle)expire();else{scheduleDeadline();if(lastActive>confirmed)scheduleSync();}
    }
    for(const type of ['pointerdown','keydown','input','scroll','touchstart'])document.addEventListener(type,activity,{capture:true,passive:true,signal});
    window.addEventListener('storage',event=>{
      if(event.key===logoutKey&&Number(event.newValue)>=initial){navigate('session');return;}
      if(event.key===key)check();
    },{signal});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();},{signal});
    window.addEventListener('focus',check,{signal});
    window.addEventListener('pageshow',check,{signal});
    window.addEventListener('pagehide',()=>{if(!ended){publish();if(lastActive>confirmed)flush();}},{signal});
    document.addEventListener('submit',event=>{
      if(event.target instanceof HTMLFormElement&&new URL(event.target.action,location.href).pathname==='/api/auth/logout'){
        try{localStorage.setItem(logoutKey,String(now()));}catch{}
        stop();
      }
    },{capture:true,signal});
    lastActive=Math.max(lastActive,readShared());check();
    return {stop};
  }
  window.KyohoonIdleSession={start};
  const script=document.currentScript;
  if(script?.dataset.lastActive)start(script.dataset);
})();
