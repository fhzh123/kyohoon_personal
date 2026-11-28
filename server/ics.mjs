// Reads an iCalendar (.ics) feed, such as a calendar published from Outlook, and expands it
// into plain events inside a time window. Recurring series (RRULE) are expanded in the
// event's own time zone, EXDATE removes occurrences and RECURRENCE-ID overrides replace them.

// Outlook writes Windows zone names in TZID. These are the common ones; anything else is
// tried as an IANA name, then as the fixed offset of its VTIMEZONE, then as the default zone.
const WINDOWS_ZONES = {
  'Korea Standard Time': 'Asia/Seoul', 'Tokyo Standard Time': 'Asia/Tokyo', 'China Standard Time': 'Asia/Shanghai',
  'Taipei Standard Time': 'Asia/Taipei', 'Singapore Standard Time': 'Asia/Singapore', 'India Standard Time': 'Asia/Kolkata',
  'UTC': 'UTC', 'Coordinated Universal Time': 'UTC', 'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
  'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Paris', 'Central Europe Standard Time': 'Europe/Budapest',
  'Central European Standard Time': 'Europe/Warsaw', 'E. Europe Standard Time': 'Europe/Chisinau', 'FLE Standard Time': 'Europe/Kiev',
  'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver',
  'Pacific Standard Time': 'America/Los_Angeles', 'Alaskan Standard Time': 'America/Anchorage', 'Hawaiian Standard Time': 'Pacific/Honolulu',
  'AUS Eastern Standard Time': 'Australia/Sydney', 'New Zealand Standard Time': 'Pacific/Auckland',
};
export const DEFAULT_ZONE = 'Asia/Seoul';
const DAY = 864e5;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const unescapeText = value => value.replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));

/** Split the file into components with their properties. */
export function parseIcs(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const root = {type: 'ROOT', props: [], children: []};
  const stack = [root];
  for (const line of lines) {
    if (!line.trim()) continue;
    let colon = -1, quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') quoted = !quoted;
      else if (line[i] === ':' && !quoted) { colon = i; break; }
    }
    if (colon < 0) continue;
    const head = line.slice(0, colon), value = line.slice(colon + 1);
    const [rawName, ...rawParams] = head.split(';');
    const name = rawName.toUpperCase();
    if (name === 'BEGIN') { const node = {type: value.trim().toUpperCase(), props: [], children: []}; stack.at(-1).children.push(node); stack.push(node); continue; }
    if (name === 'END') { if (stack.length > 1) stack.pop(); continue; }
    const params = {};
    for (const p of rawParams) { const eq = p.indexOf('='); if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, ''); }
    stack.at(-1).props.push({name, params, value});
  }
  return root;
}

const prop = (node, name) => node.props.find(p => p.name === name);
const props = (node, name) => node.props.filter(p => p.name === name);

// ---------------------------------------------------------------- time zones
const zoneOk = new Map();
function validZone(name) {
  if (!zoneOk.has(name)) { try { new Intl.DateTimeFormat('en-US', {timeZone: name}); zoneOk.set(name, true); } catch { zoneOk.set(name, false); } }
  return zoneOk.get(name);
}
const formatters = new Map();
function zoneOffset(ms, zone) {
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-US', {timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'}));
  const parts = Object.fromEntries(formatters.get(zone).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - Math.floor(ms / 1000) * 1000;
}
/** A zone is either an IANA name or a fixed offset in ms. */
function resolveZone(tzid, vtimezones) {
  if (!tzid) return DEFAULT_ZONE;
  const clean = tzid.replace(/^\//, '');
  if (WINDOWS_ZONES[clean]) return WINDOWS_ZONES[clean];
  if (validZone(clean)) return clean;
  const vt = vtimezones.get(tzid);
  const std = vt?.children.find(c => c.type === 'STANDARD');
  const off = std && prop(std, 'TZOFFSETTO')?.value.match(/^([+-])(\d{2})(\d{2})/);
  if (off) return (off[1] === '-' ? -1 : 1) * (+off[2] * 3600e3 + +off[3] * 60e3);
  return DEFAULT_ZONE;
}
/** Wall-clock time (held in a UTC Date) in a zone, to a real instant. */
function toInstant(wall, zone) {
  if (typeof zone === 'number') return wall - zone;
  let ms = wall - zoneOffset(wall, zone);
  const again = wall - zoneOffset(ms, zone);
  return again === ms ? ms : again;
}

// ---------------------------------------------------------------- values
function parseDateValue(p, vtimezones) {
  if (!p) return null;
  const v = p.value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  if (!m[4] || p.params.VALUE === 'DATE') return {allDay: true, wall: Date.UTC(+m[1], +m[2] - 1, +m[3]), zone: 'UTC'};
  return {allDay: false, wall, zone: m[7] ? 'UTC' : resolveZone(p.params.TZID, vtimezones)};
}
function parseDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value || '');
  if (!m) return null;
  const ms = ((+(m[2] || 0) * 7 + +(m[3] || 0)) * DAY) + (+(m[4] || 0) * 3600e3) + (+(m[5] || 0) * 60e3) + (+(m[6] || 0) * 1e3);
  return m[1] === '-' ? -ms : ms;
}
function parseRule(value) {
  const rule = {};
  for (const part of value.split(';')) { const [k, v] = part.split('='); if (k && v) rule[k.toUpperCase()] = v; }
  return rule;
}

// ---------------------------------------------------------------- recurrence
const utcDay = (y, m, d) => Date.UTC(y, m, d);
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function monthCandidates(y, m, rule, startDay) {
  const out = [];
  const len = daysInMonth(y, m);
  if (rule.BYMONTHDAY) {
    for (const raw of rule.BYMONTHDAY.split(',')) {
      const n = +raw, d = n > 0 ? n : len + n + 1;
      if (d >= 1 && d <= len) out.push(utcDay(y, m, d));
    }
  } else if (rule.BYDAY) {
    for (const raw of rule.BYDAY.split(',')) {
      const mm = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(raw);
      if (!mm) continue;
      const wd = WEEKDAYS.indexOf(mm[2]);
      const days = [];
      for (let d = 1; d <= len; d++) if (new Date(Date.UTC(y, m, d)).getUTCDay() === wd) days.push(utcDay(y, m, d));
      if (!mm[1]) out.push(...days);
      else { const n = +mm[1], pick = n > 0 ? days[n - 1] : days[days.length + n]; if (pick !== undefined) out.push(pick); }
    }
  } else if (startDay <= len) out.push(utcDay(y, m, startDay));
  return out.sort((a, b) => a - b);
}
const setPos = (list, rule) => {
  if (!rule.BYSETPOS) return list;
  const out = [];
  for (const raw of rule.BYSETPOS.split(',')) { const n = +raw, v = n > 0 ? list[n - 1] : list[list.length + n]; if (v !== undefined) out.push(v); }
  return [...new Set(out)].sort((a, b) => a - b);
};

/** Wall-clock start times of a series, in order, until the rule or the window ends. */
function* occurrences(startWall, rule, windowEndWall) {
  const freq = rule.FREQ, interval = Math.max(1, +(rule.INTERVAL || 1));
  const count = rule.COUNT ? +rule.COUNT : Infinity;
  let until = Infinity;
  if (rule.UNTIL) { const u = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/.exec(rule.UNTIL); if (u) until = Date.UTC(+u[1], +u[2] - 1, +u[3], +(u[4] ?? 23), +(u[5] ?? 59), +(u[6] ?? 59)); }
  const s = new Date(startWall), timeOfDay = startWall - utcDay(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const months = rule.BYMONTH ? rule.BYMONTH.split(',').map(n => +n - 1) : null;
  const weekdays = rule.BYDAY ? rule.BYDAY.split(',').map(d => WEEKDAYS.indexOf(d.slice(-2))) : null;
  let n = 0;
  const emit = function* (days) {
    for (const day of days) {
      const t = day + timeOfDay;
      if (t < startWall) continue;
      if (t > until || n >= count || t > windowEndWall) return false;
      n++;
      yield t;
    }
    return true;
  };
  for (let i = 0; i < 20000; i++) {
    let days = [];
    if (freq === 'DAILY') {
      const d = startWall - timeOfDay + i * interval * DAY, dt = new Date(d);
      if ((!months || months.includes(dt.getUTCMonth())) && (!weekdays || weekdays.includes(dt.getUTCDay()))) days = [d];
    } else if (freq === 'WEEKLY') {
      const wkst = WEEKDAYS.indexOf(rule.WKST || 'MO');
      const base = startWall - timeOfDay - ((s.getUTCDay() - wkst + 7) % 7) * DAY + i * interval * 7 * DAY;
      const wanted = weekdays || [s.getUTCDay()];
      for (let k = 0; k < 7; k++) { const d = base + k * DAY; if (wanted.includes(new Date(d).getUTCDay())) days.push(d); }
    } else if (freq === 'MONTHLY') {
      const total = s.getUTCMonth() + i * interval, y = s.getUTCFullYear() + Math.floor(total / 12), m = total % 12;
      if (!months || months.includes(m)) days = setPos(monthCandidates(y, m, rule, s.getUTCDate()), rule);
    } else if (freq === 'YEARLY') {
      const y = s.getUTCFullYear() + i * interval;
      for (const m of months || [s.getUTCMonth()]) days.push(...monthCandidates(y, m, months || rule.BYDAY || rule.BYMONTHDAY ? rule : {}, s.getUTCDate()));
      days = setPos(days.sort((a, b) => a - b), rule);
    } else { yield startWall; return; }
    const more = yield* emit(days);
    if (!more) return;
    const periodStart = days[0] ?? startWall + i * interval * DAY;
    if (periodStart > windowEndWall + 366 * DAY) return;
  }
}

// ---------------------------------------------------------------- events
const text = (node, name) => { const p = prop(node, name); return p ? unescapeText(p.value).trim() : ''; };
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

/**
 * @param {string} source the .ics text
 * @param {{cal:string, from:number, to:number}} options window as instants (ms)
 */
export function expandIcs(source, {cal, from, to}) {
  const root = parseIcs(source);
  const calendar = root.children.find(c => c.type === 'VCALENDAR') || root;
  const vtimezones = new Map(calendar.children.filter(c => c.type === 'VTIMEZONE').map(c => [prop(c, 'TZID')?.value, c]));
  const vevents = calendar.children.filter(c => c.type === 'VEVENT');
  const overrides = new Map();
  for (const ev of vevents) {
    const rid = parseDateValue(prop(ev, 'RECURRENCE-ID'), vtimezones);
    if (!rid) continue;
    const uid = text(ev, 'UID');
    if (!overrides.has(uid)) overrides.set(uid, new Set());
    overrides.get(uid).add(rid.allDay ? rid.wall : toInstant(rid.wall, rid.zone));
  }
  const out = [];
  for (const ev of vevents) {
    if (text(ev, 'STATUS').toUpperCase() === 'CANCELLED') continue;
    const start = parseDateValue(prop(ev, 'DTSTART'), vtimezones);
    if (!start) continue;
    const end = parseDateValue(prop(ev, 'DTEND'), vtimezones);
    const length = end ? (end.allDay ? end.wall - start.wall : toInstant(end.wall, end.zone) - toInstant(start.wall, start.zone)) : (parseDuration(prop(ev, 'DURATION')?.value) ?? (start.allDay ? DAY : 0));
    const uid = text(ev, 'UID') || `${cal}-${start.wall}`;
    const title = text(ev, 'SUMMARY') || '(제목 없음)';
    const place = text(ev, 'LOCATION');
    const note = text(ev, 'DESCRIPTION').replace(/\n{3,}/g, '\n\n').slice(0, 400);
    const isOverride = Boolean(prop(ev, 'RECURRENCE-ID'));
    const ruleProp = !isOverride && prop(ev, 'RRULE');
    const skip = new Set(overrides.get(uid) || []);
    for (const ex of props(ev, 'EXDATE')) {
      for (const v of ex.value.split(',')) {
        const d = parseDateValue({params: ex.params, value: v}, vtimezones);
        if (d) skip.add(d.allDay ? d.wall : toInstant(d.wall, d.zone));
      }
    }
    // The window in the event's own wall clock, padded by a day each side for zone offsets.
    const windowEndWall = to + 2 * DAY;
    const starts = ruleProp ? occurrences(start.wall, parseRule(ruleProp.value), windowEndWall) : [start.wall];
    for (const wall of starts) {
      const key = start.allDay ? wall : toInstant(wall, start.zone);
      if (ruleProp && skip.has(key)) continue;
      if (start.allDay) {
        const endWall = wall + Math.max(length, DAY);
        if (endWall <= from - DAY || wall >= to + DAY) continue;
        out.push({id: `${cal}:${uid}:${isoDay(wall)}`, cal, title, start: isoDay(wall), end: isoDay(endWall), allDay: true, ...(place && {place}), ...(note && {note})});
      } else {
        const s = key, e = key + Math.max(length, 0);
        if (e < from || s > to) continue;
        out.push({id: `${cal}:${uid}:${s}`, cal, title, start: new Date(s).toISOString(), end: new Date(e).toISOString(), allDay: false, ...(place && {place}), ...(note && {note})});
      }
      if (out.length > 5000) return out;
    }
  }
  return out;
}
