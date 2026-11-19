// Builds the SQL that refreshes the 팀 리소스 snapshot (team_resource_snapshots, id = current)
// from the Notion weekly MM records. The weekly scheduled task queries Notion, saves the raw
// rows to a JSON file and runs:
//
//   node scripts/team-resources-sync.mjs <input.json> --dry-run > check.sql   (read-only preview)
//   node scripts/team-resources-sync.mjs <input.json> > sync.sql
//
// The input holds rows exactly as the Notion SQL queries return them:
//   {
//     "snapshot": "YYYY-MM-DD",          // run date (KST)
//     "since": "YYYY-MM-DD",             // every week starting on or after this date is replaced
//     "mm": [ ...개별_MM_모음 rows with "date:날짜:start" >= since ... ],
//     "tasks": [ ...all Task & Projects rows (url, 이름, 선택, 프로젝트) ... ]
//   }
//
// Weeks before `since` stay as they are in the database, so only a few recent rows ever pass
// through the scheduled task. The SQL merges inside Postgres in one statement and refuses to
// write when nothing came in.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Notion user id -> dashboard person. Order and ids match the published snapshot.
export const PEOPLE = [
  {notion: '483f9d1b-8e1e-4e00-8ac1-a061e910e806', id: 'person-1', name: '정준녕', index: 0},
  {notion: '2c3d872b-594c-81d1-911f-000228d6172b', id: 'person-2', name: '김창완', index: 1},
  {notion: '2e0d872b-594c-8198-a62c-000243eb5ebd', id: 'person-3', name: '민하은', index: 2},
];
// Team members whose records are deliberately left out of the dashboard (진교훈).
export const EXCLUDED_PEOPLE = new Set(['1aed872b-594c-819e-a168-000256075931']);
// Tasks in this Notion category are leave or holidays and never count as work.
export const LEAVE_CATEGORY = '연차/반차/시간차/병가';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const pageId = url => {
  const match = /^https:\/\/(?:app\.notion\.com|www\.notion\.so)\/(?:p\/)?(?:[^/?#]*-)?([0-9a-f]{32})(?:[?#].*)?$/.exec(String(url ?? '').trim());
  if (!match) throw new Error(`Notion 페이지 주소가 아닙니다: ${url}`);
  return match[1];
};
const list = value => {
  if (value == null || value === '') return [];
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error(`목록 형식이 아닙니다: ${value}`);
  return parsed;
};
const userId = value => String(value).replace(/^user:\/\//, '');
const utc = date => new Date(date + 'T00:00:00Z');
const iso = date => date.toISOString().slice(0, 10);

export function weekdays(start, end) {
  const days = [];
  for (let d = utc(start); d <= utc(end); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(iso(d));
  }
  return days;
}

// The Monday `weeks` weeks before the Monday of `date`.
export function mondayBefore(date, weeks) {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 * weeks);
  return iso(d);
}

export function buildIncoming({snapshot, since, mm, tasks}) {
  if (!ISO_DATE.test(snapshot ?? '') || !ISO_DATE.test(since ?? '')) throw new Error('snapshot과 since는 YYYY-MM-DD 형식이어야 합니다.');
  if (!Array.isArray(mm) || !Array.isArray(tasks)) throw new Error('mm과 tasks 목록이 필요합니다.');
  if (!tasks.length) throw new Error('Task & Projects 목록이 비어 있습니다.');

  const catalog = new Map();
  for (const task of tasks) {
    const id = pageId(task.url);
    catalog.set(id, {
      id,
      url: `https://app.notion.com/${id}`,
      code: String(task['프로젝트'] ?? '').trim(),
      name: String(task['이름'] ?? '').trim() || '이름 없는 과업',
      category: String(task['선택'] ?? '').trim() || '미분류',
    });
  }

  const people = new Map(PEOPLE.map(person => [person.notion, person]));
  const rows = [], skipped = [], seen = new Set();
  for (const record of mm) {
    const owners = list(record['사람']).map(userId);
    const start = record['date:날짜:start'], end = record['date:날짜:end'] || start;
    const title = String(record['주차'] ?? '').trim();
    if (owners.length !== 1) { skipped.push(`${title}: 사람이 ${owners.length}명입니다.`); continue; }
    if (EXCLUDED_PEOPLE.has(owners[0])) continue;
    const person = people.get(owners[0]);
    if (!person) throw new Error(`대시보드에 없는 팀원의 기록입니다: ${owners[0]} (${title})`);
    if (!ISO_DATE.test(start ?? '') || !ISO_DATE.test(end ?? '')) throw new Error(`날짜가 없는 기록입니다: ${title}`);
    if (start < since) throw new Error(`since(${since}) 이전 기록이 들어왔습니다: ${title}`);
    const key = person.id + '|' + start;
    if (seen.has(key)) throw new Error(`같은 주의 기록이 두 개입니다: ${person.name} ${start}`);
    seen.add(key);

    const work = [];
    for (let n = 1; n <= 5; n++) {
      const links = list(record[`Task ${n}`]), hours = record[`Task ${n} 투입시간`];
      if (!links.length && (hours == null || hours === 0)) continue;
      if (links.length !== 1) throw new Error(`${person.name} ${title}: Task ${n}에 과업이 ${links.length}개입니다.`);
      if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0) throw new Error(`${person.name} ${title}: Task ${n} 투입시간이 숫자가 아닙니다.`);
      const id = pageId(links[0]);
      const project = catalog.get(id);
      if (!project) throw new Error(`${person.name} ${title}: Task & Projects에 없는 과업입니다 (${id}).`);
      if (project.category === LEAVE_CATEGORY || hours === 0) continue;
      work.push({hours, project: id});
    }
    if (!work.length) { skipped.push(`${person.name} ${title}: 업무 시간이 없습니다.`); continue; }
    rows.push({
      end, url: `https://app.notion.com/${pageId(record.url)}`, days: weekdays(start, end), start,
      tasks: work, title, person: person.id,
    });
  }
  rows.sort((a, b) => a.start.localeCompare(b.start) || a.person.localeCompare(b.person));
  // Only the tasks these weeks use; older weeks keep the names already in the snapshot.
  const used = new Set(rows.flatMap(row => row.tasks.map(task => task.project)));
  const projects = [...catalog.values()].filter(project => used.has(project.id));
  return {snapshot, since, rows, projects, people: PEOPLE.map(({id, name, index}) => ({id, name, index})), skipped};
}

// One statement: keep weeks before `since`, append the incoming weeks, refresh project names
// from Notion, then recompute months and the latest record date.
export function buildSql(incoming, {dryRun = false} = {}) {
  const json = JSON.stringify({since: incoming.since, snapshot: incoming.snapshot, rows: incoming.rows, projects: incoming.projects, people: incoming.people});
  let tag = 'sync';
  while (json.includes(`$${tag}$`)) tag += 'x';
  // The checksum turns a copy error anywhere in the JSON into a no-op instead of a bad write.
  const checksum = createHash('md5').update(json, 'utf8').digest('hex');
  return `with raw as (select $${tag}$${json}$${tag}$::text as t),
incoming as (select t::jsonb as j, md5(t) = '${checksum}' as intact from raw),
current_payload as (select payload from public.team_resource_snapshots where id = 'current'),
all_rows as (
  select r from current_payload, jsonb_array_elements(payload->'rows') r, incoming
  where r->>'start' < incoming.j->>'since'
  union all
  select r from incoming, jsonb_array_elements(incoming.j->'rows') r
),
used as (select distinct t->>'project' as id from all_rows, jsonb_array_elements(r->'tasks') t),
catalog as (
  select p->>'id' as id, p from incoming, jsonb_array_elements(incoming.j->'projects') p
  union all
  select p->>'id', p from current_payload, jsonb_array_elements(payload->'projects') p
  where not exists (select 1 from incoming, jsonb_array_elements(incoming.j->'projects') q where q->>'id' = p->>'id')
),
bounds as (select min(r->>'start') as first_day, max(r->>'end') as last_day from all_rows),
next_payload as (
  select jsonb_build_object(
    'people', incoming.j->'people',
    'projects', (select coalesce(jsonb_agg(catalog.p order by catalog.id), '[]'::jsonb) from catalog join used on used.id = catalog.id),
    'rows', (select jsonb_agg(r order by r->>'start', r->>'person') from all_rows),
    'months', (select jsonb_agg(to_char(m, 'YYYY-MM') order by m)
               from generate_series(date_trunc('month', bounds.first_day::date), date_trunc('month', bounds.last_day::date), interval '1 month') m),
    'snapshot', incoming.j->>'snapshot',
    'latest', bounds.last_day,
    'source', coalesce((select payload->>'source' from current_payload), 'https://app.notion.com/p/2edf7db422828093abb7ec1c43148254')
  ) as payload
  from incoming, bounds
)
${dryRun ? `select jsonb_array_length(next_payload.payload->'rows') as rows, jsonb_array_length(next_payload.payload->'projects') as projects,
  next_payload.payload->>'latest' as latest, next_payload.payload->'months' as months,
  (select count(*) from used) - (select count(*) from used join catalog on catalog.id = used.id) as missing_projects,
  next_payload.payload = (select payload from current_payload) as unchanged,
  incoming.intact
from next_payload, incoming;` : `update public.team_resource_snapshots s
set payload = next_payload.payload, updated_at = now()
from next_payload, incoming
where s.id = 'current'
  and incoming.intact
  and jsonb_array_length(incoming.j->'rows') > 0
  and (select count(*) from used) = (select count(*) from used join catalog on catalog.id = used.id)
returning jsonb_array_length(s.payload->'rows') as rows, s.payload->>'latest' as latest, s.payload->'months' as months, s.updated_at;`}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  if (!file) { console.error('사용법: node scripts/team-resources-sync.mjs <input.json> [--dry-run]'); process.exit(2); }
  const incoming = buildIncoming(JSON.parse(await readFile(file, 'utf8')));
  if (!incoming.rows.length) { console.error('가져온 주간 기록이 없습니다. 아무것도 쓰지 않습니다.'); process.exit(1); }
  const weeks = [...new Set(incoming.rows.map(row => row.start))];
  console.error(`주간 기록 ${incoming.rows.length}개 (${weeks.join(', ')}), 과업 ${incoming.projects.length}개`);
  for (const note of incoming.skipped) console.error('건너뜀: ' + note);
  process.stdout.write(buildSql(incoming, {dryRun: process.argv.includes('--dry-run')}));
}
