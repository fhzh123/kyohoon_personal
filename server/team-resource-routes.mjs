import {readFile} from 'node:fs/promises';
import path from 'node:path';

const route = '/work/team-resources';
const htmlType = 'text/html; charset=utf-8';
const sourceHref = value => /^https:\/\/app\.notion\.com\/(p\/)?[0-9a-f]{32}$/.test(value) ? value : 'https://app.notion.com/';
const dateText = date => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replaceAll('-', '.') : '—';

export function teamResourceRoutes({authorize, authFetch, bearer, redirect, rootDir, send}) {
  return async (req, res, url) => {
    if (url.pathname !== route && url.pathname !== route + '/') return false;
    if (!['GET', 'HEAD'].includes(req.method)) {
      send(res, 405, {error: '허용되지 않은 요청입니다.'});
      return true;
    }

    const access = await authorize(req, res);
    if (!access) {
      redirect(res, '/login?next=' + encodeURIComponent(route + url.search));
      return true;
    }

    const template = await readFile(path.join(rootDir, 'views/team-resources.html'), 'utf8');
    let data;
    if (access.mode === 'local') {
      // Optional localhost fixture. Production only reads the authenticated data source.
      data = await readFile(path.join(rootDir, 'private/work/team-resources.json'), 'utf8')
        .then(JSON.parse)
        .catch(error => {
          if (error.code !== 'ENOENT') throw error;
          return null;
        });
    } else {
      const result = await authFetch('/rest/v1/team_resource_snapshots?id=eq.current&select=payload', {
        headers: bearer(access.token),
      });
      if (result.ok) [data] = (await result.json()).map(row => row.payload);
    }

    if (!data?.months?.length || !data.people?.length || !Array.isArray(data.rows)) {
      send(res, 503, req.method === 'HEAD' ? '' :
        '<!doctype html><html lang="ko"><meta charset="utf-8"><title>팀 리소스</title><main><h1>팀 리소스를 불러올 수 없습니다</h1><p>잠시 후 다시 시도해 주세요.</p><a href="/work">Selectstar 홈</a></main></html>', htmlType);
      return true;
    }

    const values = {
      DATA: JSON.stringify(data).replaceAll('<', '\\u003c'),
      SOURCE: sourceHref(data.source),
      SNAPSHOT: dateText(data.snapshot),
      LATEST: dateText(data.latest),
      RECORDS: String(data.rows.length),
    };
    const html = template.replace(/\{\{(DATA|SOURCE|SNAPSHOT|LATEST|RECORDS)\}\}/g, (_, key) => values[key]);
    send(res, 200, req.method === 'HEAD' ? '' : html, htmlType);
    return true;
  };
}
