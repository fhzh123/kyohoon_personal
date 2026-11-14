import {fail} from './paper-core.mjs';
const endpoints={openai:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com/v1',gemini:'https://generativelanguage.googleapis.com/v1beta'};
function headers(provider,key){return provider==='openai'?{Authorization:'Bearer '+key}:provider==='anthropic'?{'x-api-key':key,'anthropic-version':'2023-06-01'}:{'x-goog-api-key':key};}
async function request(provider,key,path,body,fetcher){
  let response;try{response=await fetcher(endpoints[provider]+path,{method:body?'POST':'GET',headers:{...headers(provider,key),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(110000),redirect:'error'});}catch{throw fail('모델 연결이 끊겼거나 응답 시간이 초과되었습니다. 입력은 보존됩니다.',504);}
  if(!response.ok){const s=response.status;throw fail(s===401||s===403?'API 키 또는 모델 접근 권한을 확인해 주세요.':s===429?'API 사용 한도 또는 호출 빈도를 확인해 주세요.':s===404?'이 계정에서 사용할 수 없는 모델 ID입니다.':s===400?'모델이 요청을 처리하지 못했습니다. PDF 지원 여부, 파일 크기와 모델 ID를 확인해 주세요.':'모델 제공사에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',s===429?429:502);}
  try{return await response.json();}catch{throw fail('모델 응답을 읽지 못했습니다.',502);}
}
export async function listModels(provider,key,fetcher=fetch){
  const ids=[];let next='';
  for(let page=0;page<5;page++){const p=provider==='openai'?'/models':provider==='gemini'?'/models?pageSize=1000'+(next?'&pageToken='+encodeURIComponent(next):''):'/models?limit=100'+(next?'&after_id='+encodeURIComponent(next):'');
    const r=await request(provider,key,p,null,fetcher);
    for(const m of r.data||r.models||[]){if(provider==='gemini'&&m.supportedGenerationMethods&&!m.supportedGenerationMethods.includes('generateContent'))continue;ids.push((m.id||m.name||'').replace(/^models\//,''));}
    next=provider==='gemini'?r.nextPageToken:provider==='anthropic'&&r.has_more?r.last_id:null;if(!next)break;
  }return [...new Set(ids)].filter(Boolean).sort();
}
export async function generate({provider,key,model,system,user,pdf},fetcher=fetch){
  let response,text;
  if(provider==='openai'){
    const content=[{type:'input_text',text:user}];if(pdf)content.unshift({type:'input_file',filename:pdf.name,file_data:'data:application/pdf;base64,'+pdf.base64});
    response=await request(provider,key,'/responses',{model,instructions:system,input:[{role:'user',content}],max_output_tokens:7000,store:false},fetcher);
    if(response.status==='incomplete')throw fail('모델의 출력 길이를 초과했습니다. 쟁점이나 메모를 나누어 다시 실행해 주세요.',422);
    text=(response.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n');
  }else if(provider==='anthropic'){
    const content=[{type:'text',text:user}];if(pdf)content.unshift({type:'document',source:{type:'base64',media_type:'application/pdf',data:pdf.base64}});
    response=await request(provider,key,'/messages',{model,max_tokens:7000,system,messages:[{role:'user',content}]},fetcher);
    if(response.stop_reason==='max_tokens')throw fail('모델의 출력 길이를 초과했습니다. 메모를 나누어 다시 실행해 주세요.',422);
    text=(response.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
  }else{
    const parts=[{text:user}];if(pdf)parts.unshift({inlineData:{mimeType:'application/pdf',data:pdf.base64}});
    response=await request(provider,key,'/models/'+encodeURIComponent(model.replace(/^models\//,''))+':generateContent',{systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts}],generationConfig:{maxOutputTokens:10000}},fetcher);
    const candidate=response.candidates?.[0];if(candidate?.finishReason&&candidate.finishReason!=='STOP')throw fail('모델이 응답을 완료하지 못했습니다. 입력 길이와 제공사 정책을 확인해 주세요.',422);
    text=(candidate?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('\n');
  }
  if(!text?.trim())throw fail('모델이 텍스트를 반환하지 않았습니다. 입력과 모델을 확인해 주세요.',502);
  return {text,provider,model,usage:response.usage||response.usageMetadata||null};
}
