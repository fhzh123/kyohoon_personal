import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createHandler} from '../server/app.mjs';
import {homePage} from '../views/pages.mjs';
import {calendarPage} from '../views/calendar.mjs';

async function request(handler, url) {
  const req = Readable.from([]);
  Object.assign(req, {url, method: 'GET', headers: {host: 'www.kyohoon.app'}, socket: {remoteAddress: '203.0.113.9'}});
  const res = {status: 0, headers: {}, text: '', setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, writeHead(s, v) { this.status = s; for (const [n, x] of Object.entries(v)) this.setHeader(n, x); }, end(v) { this.text = v == null ? '' : String(v); }};
  await handler(req, res);
  return res;
}
const source = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('calendar draft opens on preview deployments and stays behind sign-in in production', async () => {
  const preview = await request(createHandler({environment: {VERCEL: '1', VERCEL_ENV: 'preview'}}), '/calendar');
  assert.equal(preview.status, 200);
  assert.match(preview.text, /data-cal-app/);
  const production = await request(createHandler({environment: {VERCEL: '1', VERCEL_ENV: 'production'}}), '/calendar');
  assert.equal(production.status, 303);
  assert.equal(production.headers.location, '/login?next=%2Fcalendar');
});

test('only the owner sees Calendar in the home space list', () => {
  const links = html => [...new JSDOM(html).window.document.querySelectorAll('.home-spaces a')].map(a => a.getAttribute('href'));
  assert.ok(!links(homePage()).includes('/calendar'));
  assert.ok(links(homePage({authenticated: true, markdownAllowed: true, manageHome: true})).includes('/calendar'));
});

test('calendar renders all four views from the sample schedule', async () => {
  const w = new JSDOM(calendarPage(null), {url: 'https://fixture.invalid/calendar?view=month&date=2026-11-28', runScripts: 'outside-only'}).window;
  w.matchMedia = () => ({matches: false});
  w.eval(await source('public/calendar/calendar-data.js'));
  w.eval(await source('public/calendar/calendar.js'));
  const d = w.document;
  assert.equal(d.querySelector('[data-cal-title]').textContent, '2026년 11월');
  assert.ok(d.querySelectorAll('.cal-week').length >= 5);
  for (const [view, selector] of [['day', '.cal-agenda'], ['week', '.cal-col'], ['year', '.cal-ymonth']]) {
    d.querySelector(`[data-view-btn="${view}"]`).click();
    assert.ok(d.querySelector(selector), view);
    assert.match(w.location.search, new RegExp(`view=${view}`));
  }
  assert.equal(d.querySelectorAll('.cal-ymonth').length, 12);
  w.close();
});
