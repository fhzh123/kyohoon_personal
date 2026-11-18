import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {createHandler} from '../server/app.mjs';

test('team resource data is available to active members only and renders as a private page', async () => {
  const payload = {
    people: [{id: 'person-1', name: 'Fixture member', index: 0}],
    projects: [{id: 'fixture-project', name: 'Fixture task </script>', category: '연구', url: ''}],
    rows: [{
      person: 'person-1', title: 'Fixture week', url: '', start: '2026-10-01', end: '2026-10-02',
      days: ['2026-10-01', '2026-10-02'],
      tasks: [{project: 'fixture-project', hours: 16}],
    }],
    months: ['2026-10'], snapshot: '2026-11-18', latest: '2026-10-02',
  };
  let reads = 0;
  const handler = createHandler({
    environment: {NODE_ENV: 'production', SUPABASE_URL: 'https://fixture.invalid', SUPABASE_ANON_KEY: 'fixture-key'},
    fetcher: async (address, options) => {
      const url = new URL(address);
      if (url.pathname === '/auth/v1/user') return Response.json({id: 'fixture'});
      if (url.pathname === '/rest/v1/workspace_members') {
        return Response.json(options.headers.Authorization === 'Bearer member' ? [{user_id: 'fixture', role: 'reader'}] : []);
      }
      assert.equal(url.pathname, '/rest/v1/team_resource_snapshots');
      assert.equal(options.headers.Authorization, 'Bearer member');
      reads++;
      return Response.json([{payload}]);
    },
  });
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const request = (route, options = {}) => fetch(origin + route, {redirect: 'manual', ...options});
  try {
    for (const headers of [{}, {cookie: 'kh_access=nonmember'}]) {
      const response = await request('/work/team-resources', {headers});
      assert.equal(response.status, 303);
      assert.equal(response.headers.get('location'), '/login?next=%2Fwork%2Fteam-resources');
    }
    assert.equal(reads, 0);
    assert.equal((await request('/private/work/team-resources.json')).status, 404);

    const headers = {cookie: 'kh_access=member'};
    const response = await request('/work/team-resources', {headers});
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /private, no-store/);
    const dom = new JSDOM(await response.text(), {url: origin, runScripts: 'outside-only'});
    try {
      assert.deepEqual(JSON.parse(dom.window.document.querySelector('#resource-data').textContent), payload);
      dom.window.eval(await readFile(new URL('../public/team-resources.js', import.meta.url), 'utf8'));
      assert.equal(dom.window.document.querySelectorAll('.donut-segment').length, 1);
      assert.match(dom.window.document.querySelector('.donut-selected').textContent, /Fixture task <\/script>/);
      dom.window.document.querySelector('#tab-people').click();
      assert.ok(dom.window.document.querySelector('.allocation-area'));
      assert.doesNotMatch(dom.window.document.querySelector('.allocation-area').innerHTML, /NaN/);
    } finally {
      dom.window.close();
    }
    const head = await request('/work/team-resources/', {headers, method: 'HEAD'});
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
