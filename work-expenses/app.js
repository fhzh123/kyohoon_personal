import {todayKST,won,usd,approvalNumber,uniqueRows,reportFor,budgetFor,monthStatus,recurringFor,issues,people} from './core.js';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={months:[],settings:{revision:null,config:{budgets:{},recurring:{},activeUsers:''}},role:'reader',year:Number(todayKST().slice(0,4)),card:'',number:'',tab:'report',staged:[],busy:false};
let generation=0,currentReport=null;
const dateTime=value=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'미확인';
const months=()=>state.months.filter(m=>!state.card||m.card_last4===state.card);
function notice(message,type=''){const n=$('#notice');n.className=message?'alert '+type:'';n.textContent=message;}
async function api(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'요청을 처리하지 못했습니다.');return data;
}
function selectTab(tab){state.tab=tab;$('#report-view').hidden=tab!=='report';$('#files-view').hidden=tab!=='files';document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));}
function setBusy(value){state.busy=value;$('#year').disabled=value;$('#card').disabled=value;$('#reload').disabled=value;$('#upload-files').disabled=value||state.role!=='editor';document.querySelectorAll('#upload-panel button,#upload-panel input').forEach(x=>x.disabled=value);}
async function load(){
  const ticket=++generation;$('#loading').hidden=false;$('#report-view').hidden=true;$('#files-view').hidden=true;
  try{
    const data=await api('/api/card-ledger?year='+state.year);if(ticket!==generation)return;
    state.months=data.months;state.settings=data.settings;state.role=data.role;
    const cards=[...new Set(state.months.map(m=>m.card_last4))].sort();if(state.card&&!cards.includes(state.card))state.card='';
    $('#card').innerHTML='<option value="">전체 카드</option>'+cards.map(c=>`<option value="${c}">끝 ${c}</option>`).join('');$('#card').value=state.card;
    $('#upload-label').hidden=state.role!=='editor';
    $('#loading').hidden=true;renderFiles();renderSuggestions();if(state.number)renderReport();selectTab(state.tab);
  }catch(e){if(ticket!==generation)return;$('#loading').textContent=e.message+' Work에서 로그인 상태를 확인한 후 새로고침해 주세요.';notice(e.message,'error');}
}
function renderSuggestions(){
  const rows=uniqueRows(months()).rows,numbers=[...new Set(rows.flatMap(r=>r.approvals))].filter(n=>n.startsWith(state.year+'-')).sort((a,b)=>Number(a.split('-')[1])-Number(b.split('-')[1]));
  $('#approval-list').innerHTML=numbers.map(n=>`<option value="${esc(n)}"></option>`).join('');
  $('#recent-approvals').innerHTML=numbers.map(n=>`<button type="button" class="chip" data-approval="${esc(n)}">${esc(n)}</button>`).join('');
}
function renderFiles(){
  const records=months(),now=todayKST(),elapsed=Math.min(12,state.year<Number(now.slice(0,4))?12:state.year>Number(now.slice(0,4))?0:Number(now.slice(5,7)));
  const registered=new Set(records.map(m=>m.month));let stale=0;
  records.forEach(m=>{if(monthStatus(m,m.year,m.month).kind==='stale')stale++;});
  $('#file-count').textContent=`${registered.size}/12`;
  $('#month-health').innerHTML=`<div class="month-health"><span><strong>${registered.size}</strong>등록 월</span><span><strong>${Array.from({length:elapsed},(_,i)=>i+1).filter(m=>!registered.has(m)).length}</strong>미등록 월</span><span><strong>${stale}</strong>갱신 확인 파일</span></div>`;
  $('#month-grid').innerHTML=Array.from({length:12},(_,i)=>{
    const month=i+1,group=records.filter(m=>m.month===month),status=monthStatus(group[0],state.year,month);
    return `<article class="month-card is-${status.kind}"><div class="month-top"><h3>${month}월</h3>${!group.length?`<span class="status ${status.kind}">${status.label}</span>`:''}</div>${group.length?group.map(m=>{
      const s=monthStatus(m,state.year,month),last=m.rows.map(r=>r.date).sort().at(-1);
      return `<div class="month-record"><span class="status ${s.kind}">${s.label}</span> <span class="badge">끝 ${m.card_last4}</span><p class="filename" title="${esc(m.file_name)}">${esc(m.file_name)}</p><p>자료 기준일 <strong>${esc(m.as_of)}</strong><br>업로드 <strong>${dateTime(m.uploaded_at)}</strong><br>원본 파일 수정 <strong>${dateTime(m.file_modified_at)}</strong><br>마지막 거래 <strong>${esc(last)}</strong><br><strong>${m.rows.length}건</strong> 등록</p><p>${esc(s.note)}</p><div class="month-actions"><a href="/api/card-ledger/file?id=${encodeURIComponent(m.id)}" download>원본 다운로드 ↓</a>${state.role==='editor'?`<button type="button" data-upload-month="${month}">교체 업로드</button>`:''}</div></div>`;
    }).join(''):`<p class="note">${esc(status.note)}</p>${state.role==='editor'&&status.kind!=='future'?`<div class="month-actions"><button type="button" data-upload-month="${month}">＋ ${month}월 파일 등록</button></div>`:''}`}</article>`;
  }).join('');
}
function metric(label,value,note='',emphasis=false){return `<div class="metric${emphasis?' emphasis':''}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`;}
function table(headers,rows){return `<div class="scroll"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}">해당 내역이 없습니다.</td></tr>`}</tbody></table></div>`;}
function groupPanel(title,groups,total){return `<section class="panel"><h2>${title}</h2>${table(['구분','건수','사용액','비중'],groups.map(g=>`<tr><td>${esc(g.label)}</td><td class="num">${g.count}</td><td class="num">${won(g.amount)}</td><td class="num">${total?(g.amount/total*100).toFixed(1):'—'}%</td></tr>`))}</section>`;}
function renderReport(){
  const number=state.number;if(!number)return;
  const report=currentReport=reportFor(months(),number,{includePending:$('#include-pending').checked}),config=state.settings.config,budget=config.budgets?.[number];
  const incomplete=months().filter(m=>!m.complete),coverage=report.missing.length?`${report.missing.join(', ')}월 파일이 없습니다. 등록되지 않은 사용액은 포함되지 않습니다.`:'';
  const maxMonth=Math.max(1,...report.monthly.map(m=>m.amount));
  $('#report-content').innerHTML=`<header class="report-title"><div><span class="report-tag">품의 사용내역</span><h2>품의 ${esc(number)}</h2><p>${state.year}년 등록 자료 기준 / 카드 ${esc(state.card||'전체')} / 사용일자 기준 집계</p></div><button type="button" id="print-report">인쇄 / PDF 저장 ↗</button></header>
    ${coverage?`<div class="alert"><strong>누락된 월이 있습니다.</strong> ${coverage}</div>`:''}
    ${incomplete.length?`<div class="alert"><strong>일부 내역 포함</strong> ${incomplete.map(m=>`${m.month}월(끝 ${m.card_last4}, ${esc(m.as_of)} 기준)`).join(', ')}은 미마감 자료입니다. 월평균과 전월 대비 비교에서 제외합니다.</div>`:''}
    ${report.rejectedCount?`<p class="note">취소 또는 반려된 양수 거래 ${report.rejectedCount}건은 사용액에서 제외했습니다. 음수 환불 거래는 차감합니다.</p>`:''}
    <div class="metrics">${metric('누적 사용액',won(report.total),$('#include-pending').checked?'승인 대기 포함 / 반려 양수 제외':'승인 상태 거래만 집계',true)}${metric('사용 건수',report.count+'건',`승인 대기 및 기타 미승인 ${report.pendingCount}건`)}${metric('월평균 사용액',report.average===null?'—':won(report.average),'사용 발생 월 중 마감 확인 월 기준')}${metric('승인 대기 및 기타 미승인',won(report.pending),'원본 승인상태가 승인 이외인 거래')}</div>
    <section class="panel"><h2>예산과 잔액</h2><form id="budget-form" class="budget-fields"><label>품의 총예산<input id="budget-amount" type="number" min="0" max="1000000000000" step="0.01" value="${esc(budget?.amount??'')}" placeholder="예산 입력" ${state.role!=='editor'?'readonly':''}></label><label>예산 통화<select id="budget-currency" ${state.role!=='editor'?'disabled':''}><option value="KRW" ${budget?.currency!=='USD'?'selected':''}>KRW 원</option><option value="USD" ${budget?.currency==='USD'?'selected':''}>USD 달러</option></select></label><label>1달러 기준 원화 환율<input id="budget-fx" type="number" min="0.000001" max="1000000" step="any" value="${esc(budget?.fx??1355.69)}" ${state.role!=='editor'?'readonly':''}></label>${state.role==='editor'?'<button class="primary" type="submit">예산 설정 저장</button>':''}</form><div id="budget-results"></div><p class="note">환율은 직접 입력한 값입니다. 자동 실시간 시세가 아닙니다. 원화 사용액을 입력 환율로 환산한 추정치이므로 실제 달러 청구액과 다를 수 있습니다. 부가세를 사용액에 다시 더하지 않습니다.</p><p id="budget-save-state" class="note" aria-live="polite"></p></section>
    <section class="panel"><h2>결제 요약</h2>${report.count?`<ul class="summary-list"><li>등록된 내역에서 <strong>${report.count}건, ${won(report.total)}</strong>을 확인했습니다.</li><li>가장 큰 결제는 <strong>${esc(report.max.date)} ${esc(report.max.merchant)}, ${won(report.max.amount)}</strong>입니다.</li><li>사용액이 가장 큰 서비스는 <strong>${esc(report.services[0]?.label)}, ${won(report.services[0]?.amount||0)}</strong>입니다.</li><li>원본 부가세 합계는 ${won(report.vat)}이며, 이용금액에 별도로 더하지 않았습니다.</li></ul>`:'<p>이 품의번호에 해당하는 거래가 없습니다. 연도, 월별 파일 등록 여부, 원본 필수 정보와 메모의 품의번호를 확인해 주세요.</p>'}</section>
    <div class="report-grid"><section class="panel"><h2>월별 사용 흐름</h2><div class="bars">${report.monthly.map(m=>`<div class="bar-row"><span>${Number(m.label.slice(5))}월${report.partialMonths.has(m.label)?'*':''}</span><div class="bar-track"><div class="bar-fill ${report.partialMonths.has(m.label)?'partial':''}" style="width:${Math.max(0,m.amount/maxMonth*100)}%"></div></div><strong>${won(m.amount)}</strong></div>`).join('')}</div><p class="note">* 일부 내역이 포함된 월입니다.</p></section><section class="panel"><h2>월별 통계</h2>${table(['사용월','건수','사용액','전월 대비'],report.monthly.map((m,i)=>{
      const previous=report.monthly[i-1],consecutive=previous&&Number(m.label.slice(5))-Number(previous.label.slice(5))===1,compare=consecutive&&!report.partialMonths.has(m.label)&&!report.partialMonths.has(previous.label)&&previous.amount>0;
      return `<tr><td>${m.label}${report.partialMonths.has(m.label)?' (일부)':''}</td><td class="num">${m.count}</td><td class="num">${won(m.amount)}</td><td class="num">${compare?((m.amount-previous.amount)/previous.amount*100).toFixed(1)+'%':'—'}</td></tr>`;
    }))}</section></div><div class="report-grid">${groupPanel('서비스별 사용액',report.services,report.total)}${groupPanel('사용자별 사용액',report.users,report.total)}</div><p class="help-note">가맹점의 서비스명을 우선하고 메모로 보완합니다. 공동 사용은 개인에게 나누어 중복 집계하지 않습니다.</p><div class="report-grid">${groupPanel('메모 기준 업무 목적별 사용액',report.purposes,report.total)}${groupPanel('승인 상태별 사용액',report.statuses,report.total)}</div>
    <section class="panel" id="fixed-panel"></section>
    ${report.issues.length?`<section class="panel"><h2>기재 확인이 필요한 내역 ${report.issues.length}건</h2>${table(['사용일자','사용자','사용액','확인 내용','출처'],report.issues.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.users)}</td><td class="num">${won(r.amount)}</td><td>${esc(issues(r).join(' / '))}</td><td>${esc(r.sourceFile)}<small>${esc(r.sheet)} ${r.sourceRow}행</small></td></tr>`))}</section>`:''}
    <section class="panel"><h2>전체 추출 내역</h2><div class="transaction-filters"><select id="filter-month" aria-label="사용월"><option value="">전체 월</option>${report.monthly.map(m=>`<option>${m.label}</option>`).join('')}</select><select id="filter-service" aria-label="서비스"><option value="">전체 서비스</option>${report.services.map(g=>`<option>${esc(g.label)}</option>`).join('')}</select><input id="filter-text" aria-label="사용내역 검색" placeholder="사용자, 가맹점, 메모 검색"><button type="button" id="reset-filters">초기화</button></div><p class="note" id="filtered-total"></p><div class="scroll detail-scroll"><table class="transactions"><thead><tr>${['사용일자','서비스','내부 사용자','사용액','가맹점','메모 / 필수 정보','원본 번호','승인상태','출처'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody id="transactions"></tbody></table></div></section>
    <p class="help-note">카드번호는 끝 4자리만 표시합니다. 파일 간 동일 거래는 원본 번호, 승인번호와 거래 정보로 중복 제외합니다.${report.duplicates?' 중복 제외 '+report.duplicates+'건.':''} 금액은 원본 이용금액(원) 기준이며, 예산 미입력 시 잔액을 계산하지 않습니다.</p>`;
  $('#print-report').onclick=()=>window.print();
  $('#budget-form').addEventListener('input',()=>{renderBudget();$('#budget-save-state').textContent='입력값으로 미리 계산 중입니다. 저장 버튼을 누르면 다른 접속에서도 유지됩니다.';});
  $('#budget-form').onsubmit=saveBudget;
  ['#filter-month','#filter-service','#filter-text'].forEach(s=>$(s).oninput=renderTransactions);
  $('#reset-filters').onclick=()=>{['#filter-month','#filter-service','#filter-text'].forEach(s=>$(s).value='');renderTransactions();};
  renderBudget();renderTransactions();renderFixed();
}
function renderBudget(){
  const amount=Number($('#budget-amount').value),fx=Number($('#budget-fx').value),currency=$('#budget-currency').value;
  $('#budget-fx').disabled=currency!=='USD';
  const b=budgetFor(currentReport.total,{amount,currency},fx);
  if(!b){$('#budget-results').innerHTML='<div class="alert">예산을 입력하면 잔액과 집행률이 표시됩니다. 달러 예산은 양수 환율도 필요합니다.</div>';return;}
  const format=currency==='USD'?usd:won;
  $('#budget-results').innerHTML=`<div class="metrics">${metric('총예산',format(amount),currency==='USD'?won(b.krw):'원화 기준')}${metric('환산 사용액',format(b.spent),won(currentReport.total))}${metric(b.remaining<0?'예산 초과':'잔여 예산',format(Math.abs(b.remaining)),won(b.remainingKRW),true)}${metric('집행률',b.percent.toFixed(1)+'%',currency==='USD'?`입력 환율 ${fx.toLocaleString('ko-KR')}원`:'원화 사용액 기준')}</div><div class="budget-summary"><span>${b.remaining<0?'예산을 초과했습니다.':'예산 이내입니다.'}</span><span>${b.percent.toFixed(1)}% 사용</span></div><div class="budget-progress ${b.remaining<0?'over':''}" role="meter" aria-label="예산 집행률" aria-valuenow="${Math.min(100,Math.max(0,b.percent))}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.min(100,Math.max(0,b.percent))}%"></span></div>`;
}
async function saveConfig(config){
  const result=await api('/api/card-ledger/settings',{method:'PUT',body:JSON.stringify({config,expectedRevision:state.settings.revision})});state.settings=result.settings;
}
async function saveBudget(event){
  event.preventDefault();if(!event.target.reportValidity())return;
  const button=event.submitter;button.disabled=true;
  try{const config=structuredClone(state.settings.config);config.budgets??={};config.budgets[state.number]={amount:Number($('#budget-amount').value),currency:$('#budget-currency').value,fx:Number($('#budget-fx').value),title:config.budgets[state.number]?.title||''};await saveConfig(config);$('#budget-save-state').textContent='예산과 환율을 저장했습니다.';notice('예산 설정을 저장했습니다.','success');}catch(e){notice(e.message,'error');$('#budget-save-state').textContent='저장되지 않았습니다. 입력값을 확인하거나 새로고침 후 다시 저장해 주세요.';}finally{button.disabled=false;}
}
function renderTransactions(){
  const rows=currentReport.rows.filter(r=>(!$('#filter-month').value||r.date.startsWith($('#filter-month').value))&&(!$('#filter-service').value||r.service===$('#filter-service').value)&&(!$('#filter-text').value||[r.users,r.merchant,r.memo,r.required].join(' ').toLowerCase().includes($('#filter-text').value.toLowerCase())));
  $('#filtered-total').textContent=`${rows.length}건 / ${won(rows.reduce((n,r)=>n+r.amount,0))}`;
  $('#transactions').innerHTML=rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.service)}</td><td>${esc(r.users||'미기재')}</td><td class="num">${won(r.amount)}</td><td>${esc(r.merchant)}</td><td>${esc(r.memo)}<small>${esc(r.required)}</small></td><td>${esc(r.number)}</td><td>${esc(r.status)}</td><td>${esc(r.sourceFile)}<small>${esc(r.sheet)} ${r.sourceRow}행</small></td></tr>`).join('')||'<tr><td colspan="9">검색 결과가 없습니다.</td></tr>';
}
function renderFixed(){
  const r=recurringFor(months(),state.number,state.settings.config),included=new Set(r.included.map(x=>x.key));
  $('#fixed-panel').innerHTML=`<h2>월 고정비 추정</h2><p>${r.base?`${esc(r.base)} 마감 확인 내역 기준`:'마감 확인된 사용 내역이 없습니다.'} / 포함한 거래는 아래에서 조정할 수 있습니다.</p><div class="fixed-total">${won(r.total)} <small>/ 월</small></div><p>같은 구성을 유지하면 연 ${won(r.total*12)}입니다. 실제 다음 달 청구액을 보장하지 않습니다.</p><details><summary>재직자와 고정비 포함 항목 설정</summary><form id="fixed-form"><label for="active-users">고정비를 계산할 재직자 (쉼표로 구분)</label><div class="fixed-settings"><input id="active-users" value="${esc(state.settings.config.activeUsers||'')}" ${state.role!=='editor'?'readonly':''}>${state.role==='editor'?'<button type="submit" class="primary">고정비 설정 저장</button>':''}</div>${table(['포함','사용일자','서비스','사용자','사용액','메모'],r.entries.map(row=>`<tr><td><input type="checkbox" aria-label="${esc(row.date+' '+row.service+' '+row.users+' 고정비 포함')}" data-recurring="${esc(row.key)}" ${included.has(row.key)?'checked':''} ${state.role!=='editor'?'disabled':''}></td><td>${esc(row.date)}</td><td>${esc(row.service)}</td><td>${esc(row.users)}</td><td class="num">${won(row.amount)}</td><td>${esc(row.memo)}</td></tr>`))}</form></details><p class="note">가장 최근의 마감 확인 월에서 재직자 구독과 문라이트를 기본 선택합니다. API, 크레딧, 추가 구매는 기본 제외합니다. 공동 비용은 한 번만 포함합니다. 일부 월만 등록된 경우 추정이 불완전할 수 있습니다.</p>`;
  $('#fixed-form').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const config=structuredClone(state.settings.config);config.activeUsers=$('#active-users').value;config.recurring??={};document.querySelectorAll('[data-recurring]').forEach(c=>config.recurring[c.dataset.recurring]=c.checked);await saveConfig(config);renderFixed();notice('고정비 선택을 저장했습니다.','success');}catch(e){notice(e.message,'error');button.disabled=false;}};
}
function endOfMonth(year,month){return new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);}
let forcedMonth=null;
async function stageFiles(fileList){
  if(state.busy)return;
  const files=Array.from(fileList);if(!files.length)return;
  if(files.length>12){notice('한 번에 12개 이하의 파일을 선택해 주세요.','error');return;}
  const today=todayKST();
  state.staged=files.map(file=>{const match=file.name.normalize('NFC').match(/(?:^|[_\s])(\d{1,2})월/);const month=forcedMonth||Number(match?.[1])||Number(today.slice(5,7));const end=endOfMonth(state.year,month);return {file,year:state.year,month,asOf:today,complete:false,preview:null,fileBase64:null};});forcedMonth=null;renderUpload();notice('연월과 자료 기준일을 확인한 다음 파일 검사를 진행해 주세요.');$('#upload-panel').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderUpload(){
  $('#upload-panel').hidden=!state.staged.length;
  $('#upload-panel').innerHTML=`<h2>업로드할 파일 ${state.staged.length}개</h2><p class="note">자료 기준일을 실제 내려받은 날짜로 확인해 주세요. 이전 달의 월 마감 자료만 ‘마감 확인’을 선택합니다.</p><div class="scroll"><table class="upload-rows"><thead><tr><th>파일</th><th>연도</th><th>월</th><th>자료 기준일</th><th>월 마감 확인</th><th>검사 결과</th></tr></thead><tbody>${state.staged.map((s,i)=>`<tr data-stage="${i}"><td>${esc(s.file.name)}<small>${(s.file.size/1024).toFixed(1)} KB</small></td><td><input type="number" aria-label="${i+1}번 파일 연도" data-field="year" min="2020" max="2100" value="${s.year}"></td><td><input type="number" aria-label="${i+1}번 파일 월" data-field="month" min="1" max="12" value="${s.month}"></td><td><input type="date" aria-label="${i+1}번 파일 자료 기준일" data-field="asOf" max="${todayKST()}" value="${s.asOf}"></td><td><input type="checkbox" aria-label="${i+1}번 파일 월 마감 확인" data-field="complete" ${s.complete?'checked':''}></td><td class="file-preview">${s.preview?`${s.preview.count}건 / 카드 끝 ${s.preview.cardLast4}<br>${s.preview.firstDate} ~ ${s.preview.lastDate}<br>${s.replace?'기존 월 파일 교체 예정':'신규 등록 예정'}`:'검사 전'}</td></tr>`).join('')}</tbody></table></div><div class="upload-actions"><button id="inspect-upload" type="button">1. 파일 검사</button><button id="commit-upload" class="primary" type="button" ${state.staged.every(s=>s.preview)?'':'disabled'}>2. ${state.staged.some(s=>s.replace)?'기존 월 교체 포함 저장':'등록하기'}</button><button id="cancel-upload" type="button">닫기</button><span id="upload-progress" class="note" role="status" aria-live="polite"></span></div>`;
  document.querySelectorAll('[data-stage] input').forEach(input=>input.oninput=()=>{const row=input.closest('[data-stage]'),s=state.staged[Number(row.dataset.stage)];s[input.dataset.field]=input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value;state.staged.forEach(s=>s.preview=null);$('#commit-upload').disabled=true;document.querySelectorAll('.file-preview').forEach(p=>p.textContent='설정 변경됨 / 재검사 필요');});
  $('#inspect-upload').onclick=inspectFiles;$('#commit-upload').onclick=commitFiles;$('#cancel-upload').onclick=()=>{state.staged=[];renderUpload();};
}
async function payloadFor(s){if(!s.fileBase64){if(s.file.size>2*1024*1024)throw new Error('파일당 2MB 이하의 xlsx만 지원합니다.');s.fileBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'));reader.readAsDataURL(s.file);});}return {fileName:s.file.name,fileBase64:s.fileBase64,fileModifiedAt:new Date(s.file.lastModified).toISOString(),year:s.year,month:s.month,asOf:s.asOf,complete:s.complete};}
async function inspectFiles(){
  setBusy(true);let message='';
  try{
    const ids=new Set();for(let i=0;i<state.staged.length;i++){const s=state.staged[i];$('#upload-progress').textContent=`${i+1}/${state.staged.length} 파일 검사 중`;const data=await api('/api/card-ledger/inspect',{method:'POST',body:JSON.stringify(await payloadFor(s))});if(ids.has(data.id))throw new Error('같은 카드의 같은 달 파일이 두 개 선택되었습니다. 하나씩 선택해 주세요.');ids.add(data.id);s.preview=data;
      // Fetch that year's latest revisions even when the upload year differs from the viewing year.
      const manifest=s.year===state.year?state.months:(await api('/api/card-ledger?year='+s.year)).months;
      s.replace=manifest.find(m=>m.id===data.id)||null;s.expectedRevision=s.replace?.revision??null;
    }message='파일 검사가 완료되었습니다. 기존 월은 누적 추가하지 않고 교체합니다.';
  }catch(e){state.staged.forEach(s=>s.preview=null);message=e.message;notice(e.message,'error');}finally{setBusy(false);renderUpload();$('#upload-progress').textContent=message;}
}
async function commitFiles(){
  if(!state.staged.every(s=>s.preview))return;setBusy(true);let success=0;
  try{
    for(let i=0;i<state.staged.length;i++){const s=state.staged[i];$('#upload-progress').textContent=`${i+1}/${state.staged.length} 저장 중`;const result=await api('/api/card-ledger/upload',{method:'POST',body:JSON.stringify({...await payloadFor(s),expectedRevision:s.expectedRevision})});s.expectedRevision=result.month.revision;s.saved=true;success++;}
    state.staged=[];renderUpload();notice(`${success}개 월별 파일을 저장했습니다. 품의 보고서도 갱신되었습니다.`,'success');await load();
  }catch(e){state.staged=state.staged.filter(s=>!s.saved);notice(`${success}개 저장 완료. ${e.message} 나머지 파일은 저장되지 않았습니다.`,'error');renderUpload();await load();}finally{setBusy(false);if($('#commit-upload'))$('#commit-upload').disabled=!state.staged.every(s=>s.preview);}
}
const initial=new URLSearchParams(location.search);state.year=Number(initial.get('year'))||state.year;state.number=approvalNumber(initial.get('approval'));
for(let y=Math.max(2020,state.year-3);y<=Math.min(2100,state.year+2);y++){const option=document.createElement('option');option.value=y;option.textContent=y+'년';$('#year').append(option);}$('#year').value=state.year;$('#approval').value=state.number;
$('#year').onchange=()=>{state.year=Number($('#year').value);state.staged=[];renderUpload();load();};
$('#card').onchange=()=>{state.card=$('#card').value;renderFiles();renderSuggestions();if(state.number)renderReport();};
$('#reload').onclick=()=>{notice('');load();};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
$('#approval-search').onsubmit=event=>{event.preventDefault();const number=approvalNumber($('#approval').value);if(!number){$('#approval').setCustomValidity('2026-785처럼 연도-번호 형식으로 입력해 주세요.');$('#approval').reportValidity();return;}state.number=number;$('#approval').value=number;const year=Number(number.split('-')[0]);if(year!==state.year){state.year=year;if(![...$('#year').options].some(o=>o.value===String(year))){const o=document.createElement('option');o.value=year;o.textContent=year+'년';$('#year').append(o);}$('#year').value=year;load();}else renderReport();history.replaceState(null,'',`?year=${state.year}&approval=${number}`);notice('');};
$('#approval').oninput=()=>$('#approval').setCustomValidity('');$('#include-pending').onchange=()=>{if(state.number)renderReport();};
$('#recent-approvals').onclick=event=>{const button=event.target.closest('[data-approval]');if(button){$('#approval').value=button.dataset.approval;$('#approval-search').requestSubmit();}};
$('#upload-files').onchange=event=>{stageFiles(event.target.files);event.target.value='';};
$('#month-grid').onclick=event=>{const b=event.target.closest('[data-upload-month]');if(b&&!state.busy){forcedMonth=Number(b.dataset.uploadMonth);$('#upload-files').click();}};
load();
