import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export const THEMES = ['ivory', 'github-dark', 'chrome', 'sprinkles'];
const DOCUMENT_FIELDS = 'id,folder_id,title,content,theme,revision,updated_at';
const TREE_FIELDS = 'id,folder_id,title,theme,updated_at';
const FOLDER_FIELDS = 'id,name,position';
// A full document may contain 500,000 multi-byte characters or JSON escapes.
const BODY_LIMIT = 4 * 1024 * 1024;
const fail = (message, status = 400, extra = {}) => Object.assign(new Error(message), {status, markdownMessage:message, ...extra});
const uuid = value => {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value)) throw fail('문서와 폴더 ID를 확인해 주세요.');
  return value.toLowerCase();
};
const text = (value, max, message) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw fail(message);
  return value.trim();
};
const pick = (row, fields) => Object.fromEntries(fields.split(',').map(key => [key, row[key]]));
const folderOut = row => pick(row, FOLDER_FIELDS);
const documentOut = row => pick(row, DOCUMENT_FIELDS);
const conflict = document => fail('다른 곳에서 먼저 수정되었습니다.', 409, {document:documentOut(document)});

export function markdownRoutes({authorize, authFetch, bearer, send, body, rootDir, environment = {}}) {
  const statePath = path.join(rootDir, 'private/markdown/state.json');
  let queue = Promise.resolve();
  const read = async () => {
    try { return JSON.parse(await readFile(statePath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {folders:{}, documents:{}}; throw error; }
  };
  const write = async state => {
    await mkdir(path.dirname(statePath), {recursive:true});
    await writeFile(statePath + '.tmp', JSON.stringify(state), {mode:0o600});
    await rename(statePath + '.tmp', statePath);
  };
  const serialize = fn => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  const inputOf = async req => {
    const input = JSON.parse(await body(req, BODY_LIMIT));
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('입력 형식을 확인해 주세요.');
    return input;
  };
  const remote = async (url, options) => {
    const response = await authFetch(url, options);
    if (!response.ok) {
      if (response.status === 401) throw fail('로그인이 필요합니다.', 401);
      if (response.status === 403) throw fail('읽기 전용 계정입니다.', 403);
      const details = await response.json().catch(() => ({}));
      if (details.code === '23503') throw fail('폴더를 찾을 수 없습니다.', 404);
      throw fail('마크다운 저장소에 연결하지 못했습니다.', 503);
    }
    return response.json();
  };

  return async (req, res, url) => {
    const pathname = url.pathname;
    if (pathname !== '/api/markdown' && !pathname.startsWith('/api/markdown/')) return false;
    try {
      const access = await authorize(req, res);
      if (!access) throw fail('로그인이 필요합니다.', 401);
      if (req.method !== 'GET' && access.role !== 'editor') throw fail('읽기 전용 계정입니다.', 403);
      const headers = {...bearer(access.token), 'Content-Type':'application/json', Prefer:'return=representation'};
      const local = access.mode === 'local';
      const rows = (resource, query, method = 'GET', value) => remote('/rest/v1/markdown_' + resource + (query ? '?' + query : ''), {
        method, headers, ...(value === undefined ? {} : {body:JSON.stringify(value)}),
      });
      const getDocument = async id => {
        const document = (await rows('documents', 'id=eq.' + id + '&select=' + DOCUMENT_FIELDS))[0];
        if (!document) throw fail('문서를 찾을 수 없습니다.', 404);
        return document;
      };
      let result;
      if (pathname === '/api/markdown/tree' && req.method === 'GET') {
        let folders, documents;
        if (local) {
          const state = await read();
          folders = Object.values(state.folders).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map(folderOut);
          documents = Object.values(state.documents).sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id)).map(row => pick(row, TREE_FIELDS));
        } else {
          [folders, documents] = await Promise.all([
            rows('folders', 'select=' + FOLDER_FIELDS + '&order=position.asc,created_at.asc,id.asc'),
            rows('documents', 'select=' + TREE_FIELDS + '&order=updated_at.desc,id.asc'),
          ]);
        }
        result = {folders, documents, role:access.role};
      } else {
        const match = pathname.match(/^\/api\/markdown\/(folders|documents)(?:\/([^/]+))?$/);
        if (!match) throw fail('찾을 수 없습니다.', 404);
        const resource = match[1], id = match[2] === undefined ? null : uuid(match[2]);
        const isFolder = resource === 'folders';
        if (id && !isFolder && req.method === 'GET') {
          const document = local ? (await read()).documents[id] : await getDocument(id);
          if (!document) throw fail('문서를 찾을 수 없습니다.', 404);
          result = documentOut(document);
        } else if ((!id && req.method === 'POST') || (id && req.method === 'PATCH')) {
          const input = await inputOf(req);
          const changes = {};
          let expected;
          if (isFolder) {
            changes.name = text(input.name, 80, '폴더 이름을 1~80자로 입력해 주세요.');
          } else {
            if (!id || Object.hasOwn(input, 'title')) changes.title = text(input.title, 120, '제목을 1~120자로 입력해 주세요.');
            if (!id || Object.hasOwn(input, 'folder_id')) changes.folder_id = uuid(input.folder_id);
            if (id) {
              expected = uuid(input.revision);
              if (Object.hasOwn(input, 'content')) {
                if (typeof input.content !== 'string' || input.content.length > 500000) throw fail('내용은 500,000자까지 입력할 수 있습니다.');
                changes.content = input.content;
              }
              if (Object.hasOwn(input, 'theme')) {
                if (!THEMES.includes(input.theme)) throw fail('테마를 확인해 주세요.');
                changes.theme = input.theme;
              }
              if (!Object.keys(changes).length) throw fail('변경할 내용을 입력해 주세요.');
            } else Object.assign(changes, {content:'', theme:'ivory'});
          }
          const persist = async () => {
            const state = local ? await read() : null;
            const current = state && id ? state[resource][id] : null;
            if (state && id && !current) throw fail(isFolder ? '폴더를 찾을 수 없습니다.' : '문서를 찾을 수 없습니다.', 404);
            if (state && id && !isFolder && current.revision !== expected) throw conflict(current);
            if (state && changes.folder_id && !state.folders[changes.folder_id]) throw fail('폴더를 찾을 수 없습니다.', 404);
            const now = new Date().toISOString();
            const row = {...changes, updated_at:now, updated_by:local ? null : access.userId};
            if (!id) Object.assign(row, {id:randomUUID(), created_at:now}, isFolder ? {position:0} : {});
            if (!isFolder) row.revision = randomUUID();
            if (state) {
              const saved = {...current, ...row};
              state[resource][id || row.id] = saved;
              await write(state);
              return saved;
            }
            // The revision predicate is checked by PostgreSQL in the same write.
            const query = (id ? 'id=eq.' + id + (!isFolder ? '&revision=eq.' + expected : '') + '&' : '') + 'select=' + (isFolder ? FOLDER_FIELDS : DOCUMENT_FIELDS);
            const saved = (await rows(resource, query, id ? 'PATCH' : 'POST', row))[0];
            if (!saved) {
              if (id && !isFolder) throw conflict(await getDocument(id));
              throw fail(isFolder ? '폴더를 찾을 수 없습니다.' : '문서를 찾을 수 없습니다.', 404);
            }
            return saved;
          };
          const saved = local ? await serialize(persist) : await persist();
          result = isFolder ? folderOut(saved) : documentOut(saved);
        } else if (id && req.method === 'DELETE') {
          const remove = async () => {
            if (local) {
              const state = await read();
              if (!state[resource][id]) throw fail(isFolder ? '폴더를 찾을 수 없습니다.' : '문서를 찾을 수 없습니다.', 404);
              delete state[resource][id];
              if (isFolder) for (const document of Object.values(state.documents)) if (document.folder_id === id) delete state.documents[document.id];
              await write(state);
            } else if (!(await rows(resource, 'id=eq.' + id + '&select=id', 'DELETE')).length) {
              throw fail(isFolder ? '폴더를 찾을 수 없습니다.' : '문서를 찾을 수 없습니다.', 404);
            }
          };
          if (local) await serialize(remove); else await remove();
          result = {ok:true};
        } else throw fail('허용되지 않은 요청입니다.', 405);
      }
      send(res, 200, result);
    } catch (error) {
      send(res, error.status || (error instanceof SyntaxError ? 400 : 503), {
        error:error.markdownMessage || (error.status === 413 ? '요청이 너무 큽니다.' : error instanceof SyntaxError ? '입력 형식을 확인해 주세요.' : '마크다운 문서를 처리하지 못했습니다.'),
        ...(error.document ? {document:error.document} : {}),
      });
    }
    return true;
  };
}
