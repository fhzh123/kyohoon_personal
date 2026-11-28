import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFile, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {calendarRoutes, validateEntry, validateCalendarSettings, rowToEvent, PALETTE_KEYS, DEFAULT_CALENDAR_SETTINGS} from '../server/calendar-routes.mjs';

const owner = {mode: 'local', role: 'editor'};

async function setup(access = owner) {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'cal-store-'));
  const routes = calendarRoutes({
    authorize: async () => access,
    send: (res, status, value) => { res.status = status; res.body = value; },
    body: async req => req.payload ?? '',
    environment: {}, rootDir, clock: () => Date.UTC(2026, 10, 28, 3),
  });
  return async (method, url, payload) => {
    const req = Object.assign(Readable.from([]), {method, url, headers: {}, payload: payload === undefined ? undefined : JSON.stringify(payload)});
    const res = {};
    assert.equal(await routes(req, res, new URL('https://x.invalid' + url)), true);
    return res;
  };
}

test('an all-day event keeps its dates and a timed one its instant', () => {
  const allDay = validateEntry({cal: 'paper', title: ' 마감 ', allDay: true, start: '2026-12-01', end: '2026-12-02'});
  assert.equal(allDay.title, '마감');
  assert.equal(allDay.starts_at, '2026-11-30T15:00:00.000Z'); // midnight in Seoul
  const back = rowToEvent({id: 'a', ...allDay, revision: 'r'});
  assert.deepEqual([back.start, back.end, back.allDay, back.editable], ['2026-12-01', '2026-12-02', true, true]);
  const timed = validateEntry({cal: 'personal', title: 'PT', start: '2026-11-28T19:00:00+09:00', end: '2026-11-28T20:00:00+09:00'});
  assert.equal(rowToEvent({id: 'b', ...timed, revision: 'r'}).start, '2026-11-28T10:00:00.000Z');
});

test('events are checked before they are stored', () => {
  const base = {cal: 'personal', title: 'x', allDay: true, start: '2026-12-01', end: '2026-12-02'};
  assert.throws(() => validateEntry({...base, cal: 'work'}), /Personal이나 Paper/);
  assert.throws(() => validateEntry({...base, title: '  '}), /제목/);
  assert.throws(() => validateEntry({...base, title: 'x'.repeat(201)}), /200자/);
  assert.throws(() => validateEntry({...base, start: '2026-02-30'}), /날짜/);
  assert.throws(() => validateEntry({...base, end: '2026-12-01'}), /늦어야/);
  assert.throws(() => validateEntry({...base, allDay: false, start: 'tomorrow', end: 'later'}), /시간/);
  assert.throws(() => validateEntry({...base, end: '2028-12-01'}), /400일/);
});

test('calendar settings need every calendar once and colours from the palette', async () => {
  assert.deepEqual(validateCalendarSettings(DEFAULT_CALENDAR_SETTINGS), DEFAULT_CALENDAR_SETTINGS);
  assert.deepEqual(DEFAULT_CALENDAR_SETTINGS.order, ['personal', 'work', 'paper']);
  assert.throws(() => validateCalendarSettings({...DEFAULT_CALENDAR_SETTINGS, order: ['personal', 'personal', 'paper']}), /순서/);
  assert.throws(() => validateCalendarSettings({...DEFAULT_CALENDAR_SETTINGS, colors: {...DEFAULT_CALENDAR_SETTINGS.colors, work: '#ff0000'}}), /색상/);
  // The browser palette and the server list must name the same colours.
  const context = {window: {}};
  vm.runInNewContext(await readFile(new URL('../public/calendar/calendar-palette.js', import.meta.url), 'utf8'), context);
  assert.deepEqual(Object.keys(context.window.CalendarPalette.colors), PALETTE_KEYS);
  assert.deepEqual(JSON.parse(JSON.stringify(context.window.CalendarPalette.defaults)), DEFAULT_CALENDAR_SETTINGS);
});

test('the owner adds, edits and deletes events; stale edits are refused', async () => {
  const call = await setup();
  const created = await call('POST', '/api/calendar/entries', {cal: 'personal', title: '수영', start: '2026-11-29T07:00:00+09:00', end: '2026-11-29T08:00:00+09:00', place: '구민 수영장'});
  assert.equal(created.status, 201);
  const {uid, revision} = created.body.event;
  const listed = await call('GET', '/api/calendar/events');
  assert.equal(listed.body.store.ready, true);
  assert.deepEqual(listed.body.events.map(e => e.title), ['수영']);
  assert.deepEqual(listed.body.settings.config, DEFAULT_CALENDAR_SETTINGS);
  const edit = {cal: 'paper', title: '리뷰', start: '2026-11-29T07:00:00+09:00', end: '2026-11-29T09:00:00+09:00'};
  const edited = await call('PATCH', '/api/calendar/entries/' + uid, {...edit, expectedRevision: revision});
  assert.equal(edited.status, 200);
  assert.equal(edited.body.event.cal, 'paper');
  assert.equal((await call('PATCH', '/api/calendar/entries/' + uid, {...edit, expectedRevision: revision})).status, 409);
  assert.equal((await call('DELETE', '/api/calendar/entries/' + uid)).status, 200);
  assert.equal((await call('DELETE', '/api/calendar/entries/' + uid)).status, 404);
  assert.equal((await call('PATCH', '/api/calendar/entries/not-a-uuid', edit)).status, 404);
  assert.equal((await call('POST', '/api/calendar/entries', {...edit, cal: 'work'})).status, 400);
});

test('settings save with a revision check', async () => {
  const call = await setup();
  const first = await call('GET', '/api/calendar/settings');
  assert.equal(first.body.revision, null);
  const config = {order: ['paper', 'personal', 'work'], colors: {...DEFAULT_CALENDAR_SETTINGS.colors, personal: 'violet'}};
  const saved = await call('PUT', '/api/calendar/settings', {config, expectedRevision: null});
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.body.config, config);
  assert.equal((await call('PUT', '/api/calendar/settings', {config, expectedRevision: null})).status, 409);
  assert.equal((await call('PUT', '/api/calendar/settings', {config, expectedRevision: saved.body.revision})).status, 200);
  assert.deepEqual((await call('GET', '/api/calendar/events')).body.settings.config, config);
});

test('only the owner reaches the calendar API', async () => {
  const anonymous = await setup(null);
  assert.equal((await anonymous('POST', '/api/calendar/entries', {})).status, 401);
  assert.equal((await anonymous('GET', '/api/calendar/settings')).status, 401);
  const member = await setup({mode: 'supabase', role: 'editor', isOwner: false});
  assert.equal((await member('GET', '/api/calendar/events')).status, 403);
  assert.equal((await member('DELETE', '/api/calendar/entries/3f0c1f8e-2b8a-4c43-9d55-0f0f0f0f0f0f')).status, 403);
  const reader = await setup({mode: 'supabase', role: 'selectstar_reader', isOwner: false});
  assert.equal((await reader('PUT', '/api/calendar/settings', {})).status, 403);
});
