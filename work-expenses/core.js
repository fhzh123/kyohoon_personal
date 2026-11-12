export const todayKST = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
export const won = n => new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0}).format(n)+'원';
export const usd = n => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
export function approvalNumber(value) {
  const m=String(value||'').normalize('NFKC').trim().match(/^(?:품의(?:번호)?\s*)?(20\d{2})\s*[-–—]\s*(\d{1,8})$/);
  return m ? `${m[1]}-${Number(m[2])}` : '';
}
export function approvalsIn(value) {
  return [...new Set([...String(value||'').normalize('NFKC').matchAll(/(?<!\d)(20\d{2})\s*[-–—]\s*(\d{1,8})(?!\d)/g)].map(m=>`${m[1]}-${Number(m[2])}`))];
}
export const people = value => [...new Set(String(value||'').split(/[,;\n]/).map(x=>x.trim()).filter(Boolean))];
export function classify(merchant,memo) {
  const m=String(merchant).toLowerCase(), t=String(memo).toLowerCase();
  if(/anthropic|claude/.test(m))return 'Claude / Anthropic';
  if(/openai|chatgpt/.test(m))return 'ChatGPT / OpenAI';
  if(/google|구글|gemini/.test(m))return 'Gemini / Google Cloud';
  if(/friendli/.test(m))return 'FriendliAI';
  if(/openrouter/.test(m))return 'OpenRouter';
  if(/deepseek/.test(m))return 'DeepSeek';
  if(/runpod/.test(m))return 'Runpod';
  if(/upstage|solar/.test(m))return 'Solar / Upstage';
  if(/alibaba|qwen/.test(m))return 'Qwen / Alibaba Cloud';
  if(/perplexity/.test(m+' '+t))return 'Perplexity';
  if(/문라이트|moonlight/.test(m+' '+t))return '문라이트';
  if(/liner/.test(m+' '+t))return 'Liner';
  if(/nice|결제대행/.test(m))return /gpt|openai/.test(t)?'ChatGPT / OpenAI':'결제대행 / 서비스 확인 필요';
  if(/openai|gpt/.test(t))return 'ChatGPT / OpenAI';
  if(/anthropic|claude/.test(t))return 'Claude / Anthropic';
  return String(merchant||'미분류');
}
export function researchPurpose(memo,fallback='미기재') {
  const t=String(memo).toLowerCase();
  if(/온톨로지|ontology/.test(t))return '온톨로지 평가와 비교 실험';
  if(/홍보/.test(t))return '홍보성 자료 작성';
  const support=/서비스.*특화|특화.*평가/.test(t),operation=/모니터링|운영/.test(t);
  if(support&&operation)return '서비스 특화 평가 지원 / 운영 모니터링 (공동)';
  if(support)return '서비스 특화 평가 지원';
  if(operation)return '운영 / 모니터링 개발';
  return fallback;
}
export function issues(row) {
  const list=[];
  if(/anthropic|claude/i.test(row.merchant)&&/gpt/i.test(row.memo)&&!/claude|anthropic/i.test(row.memo)) list.push('가맹점은 Claude, 메모는 GPT로 기재');
  if(/확인 필요/.test(row.service))list.push('결제대행 가맹점: 실제 서비스 확인 필요');
  if(row.approvals.length>1)list.push('품의번호가 여러 개 기재되어 있습니다. 배분 확인 필요');
  return list;
}
export function groupRows(rows,key) {
  const result=new Map();
  for(const row of rows){const k=typeof key==='function'?key(row):row[key];const g=result.get(k)||{label:k,count:0,amount:0};g.count++;g.amount+=row.amount;result.set(k,g);}
  return [...result.values()].sort((a,b)=>b.amount-a.amount);
}
export function uniqueRows(months) {
  const seen=new Set(), rows=[];let duplicates=0;
  for(const month of [...months].sort((a,b)=>String(b.uploaded_at).localeCompare(String(a.uploaded_at))))for(const row of month.rows||[]){
    const key=row.key||`${row.cardLast4}|${row.number}|${row.date}|${row.amount}|${row.merchant}`;
    if(seen.has(key)){duplicates++;continue;}seen.add(key);rows.push({...row,sourceFile:month.file_name,sourceId:month.id});
  }
  return {rows:rows.sort((a,b)=>a.date.localeCompare(b.date)||String(a.number).localeCompare(String(b.number))),duplicates};
}
export function reportFor(months,number,{includePending=true}={}) {
  const unique=uniqueRows(months);
  const all=unique.rows.filter(r=>r.approvals.includes(number));
  const rejected=r=>/반려|취소|거절/.test(r.status)&&r.amount>=0;
  const eligible=all.filter(r=>!rejected(r));
  const rows=eligible.filter(r=>includePending||r.status==='승인');
  const sum=rs=>rs.reduce((n,r)=>n+r.amount,0);
  const partialMonths=new Set(months.filter(m=>!m.complete).map(m=>`${m.year}-${String(m.month).padStart(2,'0')}`));
  const missing=[]; const year=Number(number.split('-')[0]);
  const cutoff=todayKST().slice(0,7);for(let month=1;month<=12;month++){const ym=`${year}-${String(month).padStart(2,'0')}`;if(ym<=cutoff&&!months.some(m=>m.year===year&&m.month===month))missing.push(month);}
  const monthly=groupRows(rows,r=>r.date.slice(0,7)).sort((a,b)=>a.label.localeCompare(b.label));
  const complete=monthly.filter(m=>!partialMonths.has(m.label));
  const average=complete.length?sum(complete)/complete.length:null;
  return {number,rows,total:sum(rows),count:rows.length,approved:sum(eligible.filter(r=>r.status==='승인')),pending:sum(eligible.filter(r=>r.status!=='승인')),pendingCount:eligible.filter(r=>r.status!=='승인').length,rejectedCount:all.filter(rejected).length,vat:sum(rows.map(r=>({amount:r.vat}))),monthly,services:groupRows(rows,'service'),users:groupRows(rows,r=>people(r.users).length>1?'공동 사용':r.users||'미기재'),purposes:groupRows(rows,r=>researchPurpose(r.memo,r.purpose||'미기재')),statuses:groupRows(rows,'status'),average,partialMonths,missing,duplicates:unique.duplicates,issues:rows.filter(r=>issues(r).length),max:rows.reduce((max,r)=>!max||r.amount>max.amount?r:max,null)};
}
export function budgetFor(total,budget,fx) {
  if(!budget||!Number.isFinite(budget.amount)||budget.amount<=0)return null;
  if(budget.currency==='USD'&&(!Number.isFinite(fx)||fx<=0))return null;
  const krw=budget.currency==='USD'?budget.amount*fx:budget.amount;
  return {krw,spent:budget.currency==='USD'?total/fx:total,remaining:budget.currency==='USD'?budget.amount-total/fx:krw-total,remainingKRW:krw-total,percent:total/krw*100,currency:budget.currency};
}
export function monthStatus(month,year,number,today=todayKST()) {
  const ym=`${year}-${String(number).padStart(2,'0')}`;
  if(ym>today.slice(0,7))return {kind:'future',label:'예정',note:'아직 도래하지 않은 월'};
  if(!month)return {kind:'missing',label:'미등록',note:'월별 사용내역을 업로드해 주세요.'};
  if(month.complete)return {kind:'complete',label:'마감 확인',note:'월 전체 내역으로 표시한 파일입니다.'};
  const days=Math.max(0,Math.floor((Date.parse(today)-Date.parse(month.as_of))/86400000));
  return {kind:'stale',label:days?'갱신 확인 필요':'일부 내역',note:days?`${days}일 전 자료입니다. 새 내역이 있으면 교체해 주세요.`:'오늘 기준 자료입니다. 월 전체 내역은 아닙니다.'};
}
export function recurringFor(months,number,config={}) {
  const {rows}=reportFor(months,number);
  const candidates=rows.filter(r=>months.find(m=>m.id===r.sourceId)?.complete);
  const base=candidates.map(r=>r.date.slice(0,7)).sort().at(-1);
  const active=people(config.activeUsers||'');
  const entries=candidates.filter(r=>r.date.startsWith(base||'!'));
  const overrides=config.recurring||{};
  const included=entries.filter(r=>{
    if(Object.hasOwn(overrides,r.key))return overrides[r.key];
    const names=people(r.users),activeRow=names.length&&names.every(n=>active.includes(n));
    return activeRow&&/구독|문라이트/i.test(r.memo+' '+r.service)&&!/api|크레딧|추가구매|추가 구매/i.test(r.memo);
  });
  return {base,active,entries,included,total:included.reduce((n,r)=>n+r.amount,0)};
}
