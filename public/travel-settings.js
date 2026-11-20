(()=>{
 // 여행의 흔적 페이지 안의 색상 설정 창. 주소 끝이 #colors면 바로 엽니다.
 const dialog=document.querySelector('#travel-colors-dialog');
 if(dialog){
  const open=()=>{if(!dialog.open)dialog.showModal?.();};
  document.querySelector('[data-travel-colors-open]')?.addEventListener('click',open);
  dialog.querySelector('[data-travel-colors-close]')?.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  if(location.hash==='#colors')open();
 }
 const app=document.querySelector('#travel-settings');if(!app||app.dataset.authenticated==='false')return;
 const defaults={conference:'#e16a79',tour:'#6098e8',unvisited:'#6f9c80'},labels={conference:'학회',tour:'관광',unvisited:'방문 기록 없음'};let saved,config,editable=false,busy=false,dirty=false;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const api=async(method='GET',body)=>{const r=await fetch('/api/settings/travel',{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Error(value.error||'색상을 저장하지 못했습니다.');return value;};
 function status(text,error=false){const n=app.querySelector('[data-travel-color-status]');n.textContent=text;n.classList.toggle('error',error);}
 function render(){app.innerHTML='<p class="travel-colors-intro">학회와 관광으로 다녀온 지역, 아직 기록이 없는 지역의 색상을 정합니다.</p>'+(!editable?'<p class="paper-subtle">Reader 계정은 색상을 변경할 수 없습니다.</p>':'')+'<div class="travel-color-fields">'+Object.keys(labels).map(key=>'<label for="travel-color-'+key+'"><span>'+labels[key]+'</span><input id="travel-color-'+key+'" type="color" data-travel-color="'+key+'" value="'+esc(config[key])+'" '+(!editable?'disabled':'')+'><output for="travel-color-'+key+'">'+esc(config[key])+'</output></label>').join('')+'</div><div class="background-save"><p class="paper-subtle" data-travel-color-status role="status">저장하면 모든 방문자에게 같은 색상이 표시됩니다.</p><div class="paper-actions"><button type="button" class="paper-btn" data-travel-color-reset '+(!editable?'disabled':'')+'>기본 색상</button><button type="button" class="paper-btn primary" data-travel-color-save '+(!editable?'disabled':'')+'>색상 저장</button></div></div>';}
 app.addEventListener('input',e=>{const key=e.target.dataset.travelColor;if(!editable||busy||!key)return;config[key]=e.target.value;e.target.nextElementSibling.textContent=e.target.value;dirty=true;status('저장하지 않은 변경');});
 app.addEventListener('click',async e=>{const reset=e.target.closest('[data-travel-color-reset]'),save=e.target.closest('[data-travel-color-save]');if(!editable||busy||(!reset&&!save))return;if(reset){config={...defaults};dirty=true;render();status('기본 색상을 미리보고 있습니다. 색상 저장을 누르면 적용됩니다.');return;}try{busy=true;for(const n of app.querySelectorAll('button,input'))n.disabled=true;status('색상을 저장하고 있습니다.');saved=await api('PUT',{config,expectedRevision:saved.revision});config={...saved.config};dirty=false;render();status('지구본 색상을 저장했습니다.');window.dispatchEvent(new CustomEvent('travel-colors',{detail:{...config}}));}catch(error){status(error.message,true);}finally{busy=false;for(const n of app.querySelectorAll('button,input'))n.disabled=!editable;}});
 window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
 (async()=>{try{saved=await api();config={...defaults,...saved.config};editable=saved.role==='editor';render();}catch(error){app.innerHTML='<p class="paper-subtle" role="alert">'+esc(error.message)+'</p>';}})();
})();
