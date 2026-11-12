import XLSX from 'xlsx';
import {createHash,randomUUID} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {approvalsIn,classify,approvalNumber,todayKST} from '../work-expenses/core.js';

export const MAX_FILE_BYTES=2*1024*1024;
export const LEDGER_SELECT='id,year,month,card_last4,file_name,file_modified_at,uploaded_at,as_of,complete,revision,sha256,rows,warnings';
export const fail=(message,status=400)=>Object.assign(new Error(message),{status,ledgerMessage:message});
export function validDate(value) {
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function checkArchive(bytes){
  if(bytes.length<22||bytes.readUInt32LE(0)!==0x04034b50)throw fail('xlsx 형식의 엑셀 파일을 선택해 주세요.');
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw fail('손상된 엑셀 파일입니다.');
  const count=bytes.readUInt16LE(end+10);let offset=bytes.readUInt32LE(end+16),total=0;
  if(count>500)throw fail('시트나 첨부 객체가 너무 많은 파일입니다.');
  for(let i=0;i<count;i++){
    if(offset+46>bytes.length||bytes.readUInt32LE(offset)!==0x02014b50)throw fail('손상된 엑셀 파일입니다.');
    const flags=bytes.readUInt16LE(offset+8),method=bytes.readUInt16LE(offset+10),size=bytes.readUInt32LE(offset+20),raw=bytes.readUInt32LE(offset+24),local=bytes.readUInt32LE(offset+42);
    total+=raw;if(flags&1||total>32*1024*1024||raw>16*1024*1024||![0,8].includes(method))throw fail('암호화되었거나 처리 한도를 초과한 엑셀입니다.');
    if(local+30>bytes.length||bytes.readUInt32LE(local)!==0x04034b50)throw fail('손상된 엑셀 파일입니다.');
    const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
    if(start+size>bytes.length)throw fail('손상된 엑셀 파일입니다.');
    try{const inflated=method===8?inflateRawSync(bytes.subarray(start,start+size),{maxOutputLength:Math.max(1,raw)}):bytes.subarray(start,start+size);if(inflated.length!==raw)throw Error();}catch{throw fail('압축 형식이 올바르지 않은 엑셀입니다.');}
    offset+=46+bytes.readUInt16LE(offset+28)+bytes.readUInt16LE(offset+30)+bytes.readUInt16LE(offset+32);
  }
}
const norm=value=>String(value??'').normalize('NFC').replace(/\s+/g,'').trim();
function dateOf(value){
  if(value instanceof Date)return value.toISOString().slice(0,10);
  if(typeof value==='number'&&value<100000){const d=XLSX.SSF.parse_date_code(value);if(d)return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;}
  const m=String(value).trim().match(/^(20\d{2})[-./년\s]?(\d{2})[-./월\s]?(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:'';
}
function amountOf(value){if(typeof value==='number')return value;let s=String(value).trim().replace(/[,₩원\s]/g,'');if(/^\([\d.]+\)$/.test(s))s='-'+s.slice(1,-1);return s!==''?Number(s):NaN;}
export function parseLedger(bytes,{fileName,year,month,asOf,complete=false,fileModifiedAt=null}={}) {
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>MAX_FILE_BYTES)throw fail('파일은 2MB 이하의 xlsx여야 합니다.',413);
  if(!/\.xlsx$/i.test(fileName||''))throw fail('xlsx 파일만 지원합니다.');
  if(!Number.isInteger(year)||year<2020||year>2100||!Number.isInteger(month)||month<1||month>12)throw fail('사용 연월을 확인해 주세요.');
  if(!validDate(asOf)||asOf>todayKST())throw fail('자료 기준일은 오늘 이전의 올바른 날짜여야 합니다.');
  const ym=`${year}-${String(month).padStart(2,'0')}`,end=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
  if(asOf<ym+'-01'||(complete&&asOf<end))throw fail('월 마감 자료는 해당 월 말일 이후를 기준일로 지정해 주세요.');
  checkArchive(bytes);
  let book;try{book=XLSX.read(bytes,{type:'buffer',cellDates:true,cellHTML:false,cellFormula:false,sheetRows:10002});}catch{throw fail('엑셀을 읽을 수 없습니다. 암호와 파일 형식을 확인해 주세요.');}
  const sheetName=book.SheetNames.includes('ExpenseData')?'ExpenseData':book.SheetNames[0],sheet=book.Sheets[sheetName];
  const grid=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:true});
  const head=grid.findIndex(r=>r.some(v=>norm(v)==='사용일자')&&r.some(v=>/^(이용금액\(원\)|사용금액|이용금액|금액)$/.test(norm(v))));
  if(head<0)throw fail('사용일자와 이용금액(원) 열을 찾을 수 없습니다. 법인카드 사용내역 원본을 선택해 주세요.');
  const headers=grid[head].map(norm),col=(aliases)=>headers.findIndex(x=>aliases.map(norm).includes(x));
  const columns={date:col(['사용일자']),amount:col(['이용금액(원)','사용금액','이용금액','금액']),vat:col(['부가세(원)','부가세']),users:col(['내부 사용자','사용자']),memo:col(['메모']),required:col(['필수 정보','품의번호']),merchant:col(['가맹점명','가맹점']),number:col(['번호']),approval:col(['승인번호']),time:col(['사용시간']),card:col(['카드번호']),purpose:col(['용도']),status:col(['제출 및 승인상태','승인상태','상태'])};
  if(['memo','merchant','card'].some(k=>columns[k]<0))throw fail('메모, 가맹점명, 카드번호 열이 필요합니다.');
  if(grid.length>=10002)throw fail('파일당 10,000행 이하만 처리할 수 있습니다.');
  const rows=[],cards=new Set(),warnings=[],seen=new Set();let duplicates=0;
  for(let i=head+1;i<grid.length;i++){
    const values=grid[i],get=k=>values[columns[k]]??'';
    if(values.every(v=>v===''||v===null))continue;
    if(/합계|총계/.test(String(get('date')))||/합계|총계/.test(String(get('number'))))continue;
    const date=dateOf(get('date')),amount=amountOf(get('amount'));
    if(!validDate(date)||!Number.isSafeInteger(amount)||Math.abs(amount)>1e12)throw fail(`${i+1}행의 사용일자 또는 이용금액을 확인해 주세요. 해당 행을 제외하고 저장하지 않습니다.`);
    if(!date.startsWith(ym))throw fail(`${i+1}행에 ${ym} 이외의 거래가 있습니다. 업로드 연월을 확인해 주세요.`);
    if(date>asOf)throw fail(`${i+1}행의 거래일이 자료 기준일보다 늦습니다.`);
    const cardLast4=String(get('card')).replace(/\D/g,'').slice(-4);if(!/^\d{4}$/.test(cardLast4))throw fail(`${i+1}행의 카드 끝 4자리를 확인할 수 없습니다.`);cards.add(cardLast4);
    const text=k=>String(get(k)).normalize('NFC').trim().slice(0,4000);
    const row={date,amount,vat:Number.isFinite(amountOf(get('vat')))?amountOf(get('vat')):0,users:text('users'),memo:text('memo'),required:text('required'),merchant:text('merchant'),number:text('number'),status:text('status')||'미기재',purpose:text('purpose'),cardLast4,sheet:sheetName,sourceRow:i+1};
    row.approvals=approvalsIn(row.required+' '+row.memo);row.service=classify(row.merchant,row.memo);
    row.key=createHash('sha256').update([cardLast4,text('approval'),row.number,date,text('time'),amount,row.merchant].join('|')).digest('hex').slice(0,32);
    if(seen.has(row.key)){duplicates++;continue;}seen.add(row.key);rows.push(row);
  }
  if(!rows.length)throw fail('거래 내역이 없는 파일입니다.');
  if(cards.size!==1)throw fail('카드 한 장의 월별 내역을 업로드해 주세요. 여러 카드가 섞여 있습니다.');
  if(duplicates)warnings.push(`같은 거래 ${duplicates}건을 중복 제외했습니다.`);
  const cardLast4=[...cards][0];
  return {id:`${ym}-${cardLast4}`,year,month,card_last4:cardLast4,file_name:String(fileName).normalize('NFC').replace(/[\x00-\x1f/\\]/g,'_').slice(0,180),file_modified_at:fileModifiedAt&&Number.isFinite(Date.parse(fileModifiedAt))?new Date(fileModifiedAt).toISOString():null,uploaded_at:new Date().toISOString(),as_of:asOf,complete:Boolean(complete),revision:randomUUID(),sha256:createHash('sha256').update(bytes).digest('hex'),rows,warnings,file_base64:bytes.toString('base64')};
}
export function validateConfig(config){
  if(!config||typeof config!=='object'||Array.isArray(config))throw fail('설정 형식이 올바르지 않습니다.');
  const result={budgets:{},recurring:config.recurring||{},activeUsers:String(config.activeUsers??'').slice(0,1000)};
  if(!result.recurring||typeof result.recurring!=='object'||Array.isArray(result.recurring)||Object.entries(result.recurring).some(([k,v])=>!/^[-a-zA-Z0-9]{1,80}$/.test(k)||typeof v!=='boolean'))throw fail('고정비 선택 형식이 올바르지 않습니다.');
  if(Object.keys(result.recurring).length>2000)throw fail('고정비 선택이 너무 많습니다.');
  for(const [number,b]of Object.entries(config.budgets||{})){
    if(!approvalNumber(number)||number!==approvalNumber(number)||!b||!['KRW','USD'].includes(b.currency)||!Number.isFinite(b.amount)||b.amount<0||b.amount>1e12||!Number.isFinite(b.fx)||b.fx<=0||b.fx>1e6)throw fail('품의 예산과 환율을 확인해 주세요.');
    result.budgets[number]={amount:b.amount,currency:b.currency,fx:b.fx,title:String(b.title||'').slice(0,150)};
  }
  return result;
}
