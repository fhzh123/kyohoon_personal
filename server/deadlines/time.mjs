// Turns a deadline written the way a conference site writes it ("2026-12-04 23:59:59" in "AoE",
// "UTC-12", "GMT+02", "America/Los_Angeles") into one exact moment, as an ISO string in UTC.
// The browser and the server both read this file, so it has no Node-only imports.

const LOCAL=/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

// AoE (Anywhere on Earth) is UTC-12. Bare "UTC" and "GMT" are offset 0.
export function fixedOffsetMinutes(zone){
  const z=String(zone||'').trim();
  if(/^aoe$/i.test(z))return -12*60;
  const m=/^(?:utc|gmt)\s*(?:([+-])\s*(\d{1,2})(?::?(\d{2}))?)?$/i.exec(z);
  if(!m)return null;
  if(!m[1])return 0;
  const minutes=Number(m[2])*60+Number(m[3]||0);
  if(minutes>14*60)return null;
  return (m[1]==='-'?-1:1)*minutes;
}

function ianaOffsetMinutes(zone,utcMillis){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(utcMillis));
  const get=t=>Number(parts.find(p=>p.type===t).value);
  const asUtc=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));
  return Math.round((asUtc-utcMillis)/60000);
}

export function isKnownZone(zone){
  if(fixedOffsetMinutes(zone)!==null)return true;
  try{new Intl.DateTimeFormat('en-US',{timeZone:String(zone)});return true;}catch{return false;}
}

// Returns the ISO instant, or null when the date or zone cannot be read (for example "TBD").
export function toInstant(local,zone){
  const m=LOCAL.exec(String(local||'').trim());
  if(!m)return null;
  const [y,mo,d]=m.slice(1,4);
  // A date with no time means the end of that day; a time with no seconds means :00.
  const [h,mi,s]=m[4]===undefined?['23','59','59']:[m[4],m[5],m[6]??'00'];
  const wall=Date.UTC(+y,+mo-1,+d,+h,+mi,+s);
  const check=new Date(wall);
  if(check.getUTCFullYear()!==+y||check.getUTCMonth()!==+mo-1||check.getUTCDate()!==+d)return null;
  const fixed=fixedOffsetMinutes(zone);
  if(fixed!==null)return new Date(wall-fixed*60000).toISOString();
  if(!isKnownZone(zone))return null;
  // Two passes settle the offset on either side of a daylight-saving change.
  let guess=wall-ianaOffsetMinutes(zone,wall)*60000;
  guess=wall-ianaOffsetMinutes(zone,guess)*60000;
  return new Date(guess).toISOString();
}

// How a zone is shown next to the original time: AoE keeps its name and adds the offset.
export function zoneLabel(zone){
  const z=String(zone||'').trim();
  if(/^aoe$/i.test(z)||/^utc\s*-\s*12(?::?00)?$/i.test(z))return 'AoE (UTC-12)';
  return z;
}
