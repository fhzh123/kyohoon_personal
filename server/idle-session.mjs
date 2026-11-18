import {createHmac,timingSafeEqual} from 'node:crypto';

export const IDLE_MS=3*60*60*1000;
export const SESSION_COOKIE_AGE=7*24*60*60;
// Bind the activity timestamp to an existing server-only session credential.
// Rotating that credential also re-signs the unchanged activity timestamp.
export function sealIdle(lastActive,credential){
  const value=String(lastActive);
  return value+'.'+createHmac('sha256',credential).update('kyohoon-idle-v1:'+value).digest('base64url');
}
export function readIdle(value,credential,now=Date.now()){
  if(typeof value!=='string'||!credential)return null;
  const match=/^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(value);if(!match)return null;
  const lastActive=Number(match[1]);if(lastActive>now+60000)return null;
  const expected=Buffer.from(sealIdle(lastActive,credential)),actual=Buffer.from(value);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null;
  return {lastActive,expiresAt:lastActive+IDLE_MS};
}
