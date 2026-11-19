import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {buildIncoming, buildSql, mondayBefore, weekdays} from '../scripts/team-resources-sync.mjs';

const page = id => `https://app.notion.com/${id.padEnd(32, '0')}`;
const tasks = [
  {url: page('aa'), '이름': 'Document Parsing', '선택': '연구', '프로젝트': null},
  {url: page('bb'), '이름': 'LIG넥스원', '선택': '과업', '프로젝트': '25-dp-022'},
  {url: page('cc'), '이름': '연차/반차/시간차/병가', '선택': '연차/반차/시간차/병가', '프로젝트': null},
  {url: page('dd'), '이름': 'KT-Agent', '선택': null, '프로젝트': null},
];
const record = (user, start, entries, extra = {}) => ({
  url: page('1' + start.replaceAll('-', '') + user.slice(0, 2)),
  '주차': '2026년 11월 2주차',
  '사람': JSON.stringify([`user://${user}`]),
  'date:날짜:start': start, 'date:날짜:end': weekdays(start, start.slice(0, 8) + String(Number(start.slice(8)) + 4).padStart(2, '0')).at(-1),
  ...Object.fromEntries(entries.flatMap(([id, hours], i) => [[`Task ${i + 1}`, JSON.stringify([page(id)])], [`Task ${i + 1} 투입시간`, hours]])),
  ...extra,
});
const JUNNYEONG = '483f9d1b-8e1e-4e00-8ac1-a061e910e806', HAEUN = '2e0d872b-594c-8198-a62c-000243eb5ebd', KYOHOON = '1aed872b-594c-819e-a168-000256075931';

test('Notion weekly records become dashboard rows without leave, in the published shape', () => {
  const incoming = buildIncoming({
    snapshot: '2026-11-19', since: '2026-11-09', tasks,
    mm: [
      record(HAEUN, '2026-11-09', [['dd', 30], ['cc', 8], ['aa', 2]]),
      record(JUNNYEONG, '2026-11-09', [['aa', 22.5], ['bb', 4]]),
      record(KYOHOON, '2026-11-09', [['aa', 40]]),
    ],
  });
  assert.deepEqual(incoming.rows.map(row => row.person), ['person-1', 'person-3']);
  const haeun = incoming.rows[1];
  assert.deepEqual(Object.keys(haeun), ['end', 'url', 'days', 'start', 'tasks', 'title', 'person']);
  assert.deepEqual(haeun.days, ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']);
  assert.deepEqual(haeun.tasks, [{hours: 30, project: 'dd'.padEnd(32, '0')}, {hours: 2, project: 'aa'.padEnd(32, '0')}]);
  assert.deepEqual(incoming.projects.map(project => [project.name, project.category, project.code]).sort(),
    [['Document Parsing', '연구', ''], ['KT-Agent', '미분류', ''], ['LIG넥스원', '과업', '25-dp-022']]);
  assert.equal(incoming.projects.every(project => project.url === `https://app.notion.com/${project.id}`), true);
});

test('records that cannot be read safely stop the sync', () => {
  const base = {snapshot: '2026-11-19', since: '2026-11-09', tasks};
  assert.throws(() => buildIncoming({...base, mm: [record('unknown-user', '2026-11-09', [['aa', 8]])]}), /대시보드에 없는 팀원/);
  assert.throws(() => buildIncoming({...base, mm: [record(HAEUN, '2026-11-09', [['ee', 8]])]}), /Task & Projects에 없는 과업/);
  assert.throws(() => buildIncoming({...base, mm: [record(HAEUN, '2026-11-02', [['aa', 8]])]}), /since/);
  assert.throws(() => buildIncoming({...base, mm: [record(HAEUN, '2026-11-09', [['aa', 8]]), record(HAEUN, '2026-11-09', [['aa', 8]])]}), /두 개/);
  assert.throws(() => buildIncoming({...base, mm: [record(HAEUN, '2026-11-09', [['aa', '8']])]}), /숫자/);
});

test('the SQL only writes an intact payload and keeps older weeks', () => {
  const incoming = buildIncoming({snapshot: '2026-11-19', since: '2026-11-09', tasks, mm: [record(HAEUN, '2026-11-09', [['aa', 8]])]});
  const sql = buildSql(incoming);
  const json = /\$sync\$(.*)\$sync\$/s.exec(sql)[1];
  assert.match(sql, new RegExp(`md5\\(t\\) = '${createHash('md5').update(json, 'utf8').digest('hex')}'`));
  assert.match(sql, /and incoming\.intact/);
  assert.match(sql, /where r->>'start' < incoming\.j->>'since'/);
  assert.match(sql, /^update public\.team_resource_snapshots/m);
  assert.doesNotMatch(buildSql(incoming, {dryRun: true}), /^update /m);
});

test('the refresh window starts on a Monday', () => {
  assert.equal(mondayBefore('2026-11-19', 5), '2026-10-12');
  assert.equal(mondayBefore('2026-11-16', 0), '2026-11-16');
});
