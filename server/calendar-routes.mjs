import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {expandIcs} from './ics.mjs';
import {canManageHomeSettings} from './policy.mjs';

// Calendar feeds come from published Outlook calendars (.ics links). Each link is a secret:
// it stays in the server's environment and is never sent to the browser.
export const CALENDAR_FEEDS = [
  ['work', 'CALENDAR_ICS_WORK'],
  ['paper', 'CALENDAR_ICS_PAPER'],
  ['personal', 'CALENDAR_ICS_PERSONAL'],
];
// Personal and Paper events are written on this site; Selectstar only comes from Outlook.
export const OWN_CALENDARS = ['personal', 'paper'];
export const CALENDAR_IDS = ['personal', 'work', 'paper'];
// Must match the keys in public/calendar/calendar-palette.js.
export const PALETTE_KEYS = ['green', 'cobalt', 'amber', 'red', 'violet', 'teal', 'pink', 'orange', 'olive', 'slate'];
export const DEFAULT_CALENDAR_SETTINGS = {order: ['personal', 'work', 'paper'], colors: {personal: 'green', work: 'cobalt', paper: 'amber', holiday: 'red'}};

const CACHE_MS = 5 * 60e3;
const MAX_BYTES = 8 * 1024 * 1024;
const DAY = 864e5;
const ZONE = 'Asia/Seoul'; // all-day dates are kept as Korea-time midnights
const EVENT_COLUMNS = 'id,cal,title,all_day,starts_at,ends_at,place,note,revision';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const fail = (message, status = 400, code) => Object.assign(new Error(message), {status, calendarMessage: message, code});

export function feedUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim().replace(/^webcals?:\/\//i, 'https://'));
    return url.protocol === 'https:' ? url : null;
  } catch { return null; }
}

// ---------------------------------------------------------------- validation
const validDate = value => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
const dateToInstant = value => new Date(`${value}T00:00:00+09:00`);
const instantToDate = value => new Date(value).toLocaleDateString('sv-SE', {timeZone: ZONE});
const text = (value, max, label, required = false) => {
  if (value == null) value = '';
  if (typeof value !== 'string') throw fail(`${label}을 확인해 주세요.`);
  const out = value.trim();
  if (required && !out) throw fail(`${label}을 입력해 주세요.`);
  if (out.length > max) throw fail(`${label}은 ${max}자까지 쓸 수 있습니다.`);
  return out;
};

/** Checks one event from the browser and returns the stored row's fields. */
export function validateEntry(input) {
  if (!input || typeof input !== 'object') throw fail('일정 내용을 확인해 주세요.');
  if (!OWN_CALENDARS.includes(input.cal)) throw fail('Personal이나 Paper 캘린더를 골라 주세요.');
  const title = text(input.title, 200, '제목', true);
  const place = text(input.place, 200, '장소');
  const note = text(input.note, 4000, '메모');
  const allDay = input.allDay === true;
  let start, end;
  if (allDay) {
    if (!validDate(input.start) || !validDate(input.end)) throw fail('날짜를 확인해 주세요.');
    start = dateToInstant(input.start); end = dateToInstant(input.end);
  } else {
    const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
    if (!iso.test(input.start || '') || !iso.test(input.end || '')) throw fail('시간을 확인해 주세요.');
    start = new Date(input.start); end = new Date(input.end);
    if (Number.isNaN(+start) || Number.isNaN(+end)) throw fail('시간을 확인해 주세요.');
  }
  if (end <= start) throw fail('끝나는 시간이 시작보다 늦어야 합니다.');
  if (end - start > 400 * DAY) throw fail('일정은 400일까지 잡을 수 있습니다.');
  return {cal: input.cal, title, all_day: allDay, starts_at: start.toISOString(), ends_at: end.toISOString(), place, note};
}

export function validateCalendarSettings(value) {
  const order = value?.order, colors = value?.colors;
  if (!Array.isArray(order) || order.length !== CALENDAR_IDS.length || CALENDAR_IDS.some(id => !order.includes(id))) throw fail('캘린더 순서를 확인해 주세요.');
  if (!colors || typeof colors !== 'object') throw fail('캘린더 색상을 확인해 주세요.');
  const out = {};
  for (const id of [...CALENDAR_IDS, 'holiday']) {
    if (!PALETTE_KEYS.includes(colors[id])) throw fail('캘린더 색상을 확인해 주세요.');
    out[id] = colors[id];
  }
  return {order: [...order], colors: out};
}
const settingsOrDefault = config => { try { return validateCalendarSettings(config); } catch { return structuredClone(DEFAULT_CALENDAR_SETTINGS); } };

/** A stored row as the browser sees it: the same shape as an Outlook event. */
export function rowToEvent(row) {
  const allDay = row.all_day === true;
  return {
    id: 'own:' + row.id, uid: row.id, cal: row.cal, title: row.title, allDay,
    start: allDay ? instantToDate(row.starts_at) : new Date(row.starts_at).toISOString(),
    end: allDay ? instantToDate(row.ends_at) : new Date(row.ends_at).toISOString(),
    ...(row.place ? {place: row.place} : {}), ...(row.note ? {note: row.note} : {}),
    revision: row.revision, editable: true,
  };
}

// ---------------------------------------------------------------- storage
// Signed in through Supabase: two owner-only tables (supabase/calendar.sql).
// The local preview server: one JSON file under private/.
function supabaseStore({authFetch, bearer, token}) {
  const call = async (p, options = {}) => {
    const response = await authFetch(p, {...options, headers: {...bearer(token), ...options.headers}});
    if (response.status === 404 || response.status === 400) {
      const detail = await response.clone().json().catch(() => ({}));
      if (detail.code === 'PGRST205' || detail.code === '42P01') throw fail('일정 저장소가 아직 준비되지 않았습니다.', 503, 'store_missing');
    }
    if (response.status === 409) throw fail('같은 일정이 이미 있습니다.', 409, 'conflict');
    if (!response.ok) throw fail('일정 저장소에 연결하지 못했습니다.', 503);
    return response;
  };
  const json = {'Content-Type': 'application/json', Prefer: 'return=representation'};
  return {
    async list(from, to) {
      const q = `select=${EVENT_COLUMNS}&ends_at=gt.${encodeURIComponent(from)}&starts_at=lt.${encodeURIComponent(to)}&order=starts_at.asc&limit=5000`;
      return (await call('/rest/v1/calendar_events?' + q)).json();
    },
    async create(row) { return (await (await call('/rest/v1/calendar_events', {method: 'POST', headers: json, body: JSON.stringify(row)})).json())[0]; },
    async update(id, expected, row) {
      const rows = await (await call(`/rest/v1/calendar_events?id=eq.${id}&revision=eq.${expected}`, {method: 'PATCH', headers: json, body: JSON.stringify(row)})).json();
      return rows[0] || null;
    },
    async remove(id) { return (await (await call(`/rest/v1/calendar_events?id=eq.${id}`, {method: 'DELETE', headers: json})).json())[0] || null; },
    async exists(id) { return (await (await call(`/rest/v1/calendar_events?id=eq.${id}&select=id`)).json()).length > 0; },
    async settings() { return (await (await call('/rest/v1/calendar_settings?id=eq.site&select=config,revision')).json())[0] || null; },
    async saveSettings(expected, row) {
      try {
        const r = await call('/rest/v1/calendar_settings' + (expected ? `?id=eq.site&revision=eq.${expected}` : ''), {method: expected ? 'PATCH' : 'POST', headers: json, body: JSON.stringify(row)});
        return (await r.json())[0] || null;
      } catch (error) {
        if (error.code === 'conflict') return null; // another window created the row first
        throw error;
      }
    },
  };
}

function localStore(file) {
  let writes = Promise.resolve();
  const read = async () => { try { return JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return {events: [], settings: null}; throw e; } };
  const write = async state => { await mkdir(path.dirname(file), {recursive: true}); await writeFile(file + '.tmp', JSON.stringify(state), {mode: 0o600}); await rename(file + '.tmp', file); };
  const change = fn => { const r = writes.then(async () => { const state = await read(); const out = fn(state); await write(state); return out; }); writes = r.catch(() => {}); return r; };
  return {
    async list(from, to) { return (await read()).events.filter(e => e.ends_at > from && e.starts_at < to).sort((a, b) => a.starts_at.localeCompare(b.starts_at)); },
    create: row => change(state => { state.events.push(row); return row; }),
    update: (id, expected, row) => change(state => { const i = state.events.findIndex(e => e.id === id && e.revision === expected); if (i < 0) return null; state.events[i] = {...state.events[i], ...row}; return state.events[i]; }),
    remove: id => change(state => { const i = state.events.findIndex(e => e.id === id); return i < 0 ? null : state.events.splice(i, 1)[0]; }),
    async exists(id) { return (await read()).events.some(e => e.id === id); },
    async settings() { return (await read()).settings; },
    saveSettings: (expected, row) => change(state => { if ((state.settings?.revision ?? null) !== expected) return null; state.settings = row; return row; }),
  };
}

// ---------------------------------------------------------------- routes
export function calendarRoutes({authorize, send, environment = {}, fetcher = fetch, clock = () => Date.now(), authFetch, bearer, body, rootDir = '.'}) {
  const cache = new Map();
  const local = localStore(path.join(rootDir, 'private/calendar/state.json'));
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
  async function outlook(from, to) {
    const feeds = CALENDAR_FEEDS.map(([cal, key]) => [cal, feedUrl(environment[key])]).filter(([, u]) => u);
    if (!feeds.length) return {connected: false, calendars: [], fetchedAt: null, events: [], errors: []};
    const now = clock();
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
    return {
      connected: true,
      calendars: results.map(r => r.cal),
      fetchedAt: Math.min(...results.map(r => r.at ?? now)),
      events: results.flatMap(r => r.events),
      errors: results.filter(r => r.error).map(r => ({cal: r.cal, message: r.error})),
    };
  }
  const readJson = async (req, max) => {
    try { return JSON.parse(await body(req, max) || '{}'); } catch (error) { throw fail(error.status === 413 ? '내용이 너무 깁니다.' : '요청 내용을 읽지 못했습니다.', error.status === 413 ? 413 : 400); }
  };

  return async (req, res, url) => {
    const p = url.pathname;
    if (p !== '/api/calendar/events' && p !== '/api/calendar/settings' && !p.startsWith('/api/calendar/entries')) return false;
    try {
      const access = await authorize(req, res).catch(() => null);
      if (!access) throw fail('로그인 후 일정을 볼 수 있습니다.', 401);
      if (!canManageHomeSettings(access)) throw fail('이 일정은 소유자만 볼 수 있습니다.', 403);
      const store = access.mode === 'local' ? local : supabaseStore({authFetch, bearer, token: access.token});

      if (p === '/api/calendar/events') {
        if (req.method !== 'GET') throw fail('허용되지 않은 요청입니다.', 405);
        const now = clock(), from = now - 400 * DAY, to = now + 400 * DAY;
        const fromIso = new Date(from).toISOString(), toIso = new Date(to).toISOString();
        const [feed, own, settings] = await Promise.all([
          outlook(from, to),
          store.list(fromIso, toIso).then(rows => ({ready: true, events: rows.map(rowToEvent)}), error => ({ready: false, events: [], message: error.calendarMessage || '일정 저장소에 연결하지 못했습니다.'})),
          store.settings().catch(() => null),
        ]);
        send(res, 200, {
          ...feed,
          events: [...feed.events, ...own.events],
          store: own.ready ? {ready: true} : {ready: false, message: own.message},
          settings: {config: settingsOrDefault(settings?.config), revision: settings?.revision ?? null},
        });
        return true;
      }

      if (p === '/api/calendar/settings') {
        if (req.method === 'GET') {
          const row = await store.settings();
          send(res, 200, {config: settingsOrDefault(row?.config), revision: row?.revision ?? null, defaults: DEFAULT_CALENDAR_SETTINGS});
          return true;
        }
        if (req.method !== 'PUT') throw fail('허용되지 않은 요청입니다.', 405);
        const input = await readJson(req, 4000);
        const config = validateCalendarSettings(input.config);
        const expected = input.expectedRevision ?? null;
        if (expected !== null && !UUID.test(expected)) throw fail('설정 버전을 확인해 주세요.');
        const row = {id: 'site', config, revision: randomUUID(), updated_at: new Date(clock()).toISOString()};
        const saved = await store.saveSettings(expected, row);
        if (!saved) throw fail('다른 창에서 캘린더 설정을 바꿨습니다. 새로고침 후 다시 저장해 주세요.', 409);
        send(res, 200, {config: saved.config, revision: saved.revision});
        return true;
      }

      // /api/calendar/entries (POST) and /api/calendar/entries/<uuid> (PATCH, DELETE)
      const id = p.slice('/api/calendar/entries'.length).replace(/^\//, '');
      if (!id) {
        if (req.method !== 'POST') throw fail('허용되지 않은 요청입니다.', 405);
        const fields = validateEntry(await readJson(req, 12000));
        const stamp = new Date(clock()).toISOString();
        const row = await store.create({id: randomUUID(), ...fields, revision: randomUUID(), created_at: stamp, updated_at: stamp});
        send(res, 201, {event: rowToEvent(row)});
        return true;
      }
      if (!UUID.test(id)) throw fail('일정을 찾을 수 없습니다.', 404);
      if (req.method === 'PATCH') {
        const input = await readJson(req, 12000);
        if (!UUID.test(input.expectedRevision || '')) throw fail('일정 버전을 확인해 주세요.');
        const fields = validateEntry(input);
        const row = await store.update(id, input.expectedRevision, {...fields, revision: randomUUID(), updated_at: new Date(clock()).toISOString()});
        if (!row) throw (await store.exists(id)) ? fail('다른 창에서 이 일정을 바꿨습니다. 새로고침 후 다시 수정해 주세요.', 409) : fail('일정을 찾을 수 없습니다.', 404);
        send(res, 200, {event: rowToEvent(row)});
        return true;
      }
      if (req.method === 'DELETE') {
        const row = await store.remove(id);
        if (!row) throw fail('일정을 찾을 수 없습니다.', 404);
        send(res, 200, {deleted: rowToEvent(row)});
        return true;
      }
      throw fail('허용되지 않은 요청입니다.', 405);
    } catch (error) {
      if (!error.calendarMessage) console.error('calendar route failed', error);
      send(res, error.status || 503, {error: error.calendarMessage || '일정을 처리하지 못했습니다.', ...(error.code ? {code: error.code} : {})});
      return true;
    }
  };
}
