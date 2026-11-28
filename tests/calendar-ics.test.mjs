import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {expandIcs} from '../server/ics.mjs';
import {calendarRoutes, feedUrl} from '../server/calendar-routes.mjs';

const fixture = () => readFile(new URL('./fixtures/outlook-sample.ics', import.meta.url), 'utf8');
const window = {cal: 'work', from: Date.UTC(2026, 0, 1), to: Date.UTC(2027, 1, 1)};
const kst = iso => new Date(iso).toLocaleString('sv-SE', {timeZone: 'Asia/Seoul'}).slice(0, 16);

test('Outlook weekly series expands in Korea time with EXDATE and a moved occurrence', async () => {
  const events = expandIcs(await fixture(), window);
  const meetings = events.filter(e => e.title.startsWith('AI 1팀')).map(e => [kst(e.start), e.title]).sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(meetings.map(m => m[0]), ['2026-11-02 10:00', '2026-11-16 14:00', '2026-11-23 10:00', '2026-11-30 10:00', '2026-12-07 10:00', '2026-12-14 10:00', '2026-12-21 10:00', '2026-12-28 10:00']);
  assert.equal(meetings[1][1], 'AI 1팀 주간 회의 (시간 변경)');
  const first = events.find(e => e.title === 'AI 1팀 주간 회의');
  assert.equal(first.place, '회의실 A');
  assert.equal(first.note, '지난주 진행 상황\n이번 주 배정');
});

test('monthly by weekday, all-day ranges, UTC and other zones, cancelled events', async () => {
  const events = expandIcs(await fixture(), window);
  assert.deepEqual(events.filter(e => e.title === '고객사 정기 미팅').map(e => kst(e.start)), ['2026-10-06 15:00', '2026-11-03 15:00', '2026-12-01 15:00', '2027-01-05 15:00']);
  const trip = events.find(e => e.title === '학회 참석');
  assert.deepEqual([trip.allDay, trip.start, trip.end], [true, '2026-12-03', '2026-12-06']);
  assert.equal(kst(events.find(e => e.title === '해외 미팅').start), '2026-11-20 10:00');
  // 17:00 in Los Angeles during daylight time (UTC-7) is 09:00 the next day in Seoul.
  assert.equal(kst(events.find(e => e.title === '미국 팀 싱크').start), '2026-07-11 09:00');
  assert.ok(!events.some(e => e.title === '취소된 일정'));
});

async function call(handler, access) {
  const req = Object.assign(Readable.from([]), {url: '/api/calendar/events', method: 'GET', headers: {}});
  const res = {status: 0, body: null};
  const send = (_, status, body) => { res.status = status; res.body = body; };
  const rootDir = await mkdtemp(path.join(tmpdir(), 'cal-ics-'));
  const routes = calendarRoutes({authorize: async () => access, send, rootDir, ...handler});
  assert.equal(await routes(req, {}, new URL('https://x.invalid/api/calendar/events')), true);
  return res;
}

test('events API is owner-only, keeps the feed link on the server and reports failures', async () => {
  const text = await fixture();
  let calls = 0;
  const fetcher = async url => { calls++; assert.equal(url, 'https://outlook.office365.com/owa/calendar/abc/calendar.ics'); return new Response(text); };
  const environment = {CALENDAR_ICS_WORK: 'webcal://outlook.office365.com/owa/calendar/abc/calendar.ics'};
  const clock = () => Date.UTC(2026, 10, 28);
  assert.equal((await call({environment, fetcher, clock}, null)).status, 401);
  assert.equal((await call({environment, fetcher, clock}, {role: 'editor', mode: 'supabase', isOwner: false})).status, 403);
  const ok = await call({environment, fetcher, clock}, {role: 'editor', mode: 'supabase', isOwner: true});
  assert.equal(ok.status, 200);
  assert.equal(ok.body.connected, true);
  assert.deepEqual(ok.body.calendars, ['work']);
  assert.ok(ok.body.events.length > 5);
  assert.ok(!JSON.stringify(ok.body).includes('outlook.office365.com'));
  const none = await call({environment: {}, fetcher, clock}, {role: 'editor', mode: 'local'});
  assert.deepEqual([none.body.connected, none.body.events.length], [false, 0]);
  const broken = await call({environment, fetcher: async () => new Response('nope', {status: 404}), clock}, {role: 'editor', mode: 'local'});
  assert.equal(broken.body.errors[0].cal, 'work');
  assert.equal(feedUrl('http://insecure.example/cal.ics'), null);
});
