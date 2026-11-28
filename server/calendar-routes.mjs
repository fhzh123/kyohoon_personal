import {expandIcs} from './ics.mjs';
import {canManageHomeSettings} from './policy.mjs';

// Calendar feeds come from published Outlook calendars (.ics links). Each link is a secret:
// it stays in the server's environment and is never sent to the browser.
export const CALENDAR_FEEDS = [
  ['work', 'CALENDAR_ICS_WORK'],
  ['paper', 'CALENDAR_ICS_PAPER'],
  ['personal', 'CALENDAR_ICS_PERSONAL'],
];
const CACHE_MS = 5 * 60e3;
const MAX_BYTES = 8 * 1024 * 1024;
const DAY = 864e5;

export function feedUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim().replace(/^webcals?:\/\//i, 'https://'));
    return url.protocol === 'https:' ? url : null;
  } catch { return null; }
}

export function calendarRoutes({authorize, send, environment, fetcher = fetch, clock = () => Date.now()}) {
  const cache = new Map();
  async function load(cal, url) {
    const hit = cache.get(cal);
    if (hit && hit.href === url.href && clock() - hit.at < CACHE_MS) return hit;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetcher(url.href, {signal: controller.signal, headers: {accept: 'text/calendar'}, redirect: 'follow'});
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), {status: response.status});
      const text = await response.text();
      if (text.length > MAX_BYTES) throw new Error('too large');
      if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('not a calendar');
      const entry = {href: url.href, at: clock(), text};
      cache.set(cal, entry);
      return entry;
    } finally { clearTimeout(timer); }
  }
  return async (req, res, url) => {
    if (url.pathname !== '/api/calendar/events') return false;
    if (req.method !== 'GET') { send(res, 405, {error: '허용되지 않은 요청입니다.'}); return true; }
    const access = await authorize(req, res).catch(() => null);
    if (!access) { send(res, 401, {error: '로그인 후 일정을 볼 수 있습니다.'}); return true; }
    if (!canManageHomeSettings(access)) { send(res, 403, {error: '이 일정은 소유자만 볼 수 있습니다.'}); return true; }
    const feeds = CALENDAR_FEEDS.map(([cal, key]) => [cal, feedUrl(environment[key])]).filter(([, u]) => u);
    if (!feeds.length) { send(res, 200, {connected: false, calendars: [], events: [], errors: []}); return true; }
    const now = clock(), from = now - 400 * DAY, to = now + 400 * DAY;
    const results = await Promise.all(feeds.map(async ([cal, u]) => {
      try {
        const {text, at} = await load(cal, u);
        return {cal, at, events: expandIcs(text, {cal, from, to})};
      } catch (error) {
        const stale = cache.get(cal);
        const reason = error.status ? `Outlook이 ${error.status} 응답을 보냈습니다.` : error.name === 'AbortError' ? 'Outlook 응답이 늦어 중단했습니다.' : '게시 링크를 읽지 못했습니다.';
        return {cal, at: stale?.at ?? null, events: stale ? expandIcs(stale.text, {cal, from, to}) : [], error: reason};
      }
    }));
    send(res, 200, {
      connected: true,
      calendars: results.map(r => r.cal),
      fetchedAt: Math.min(...results.map(r => r.at ?? now)),
      events: results.flatMap(r => r.events),
      errors: results.filter(r => r.error).map(r => ({cal: r.cal, message: r.error})),
    });
    return true;
  };
}
