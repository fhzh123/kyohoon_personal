// Markdown editor (/personal/markdown).
// Rendering uses vendored, pinned builds loaded before this module:
//   /vendor/markdown-it-14.3.3.min.js  markdown-it 14.3.3, MIT licence, https://github.com/markdown-it/markdown-it
//   /vendor/purify-3.4.17.min.js       DOMPurify 3.4.17, Apache-2.0 or MPL-2.0, https://github.com/cure53/DOMPurify
// Task lists come from the small plugin in markdown-editor-core.js.
// Icons: Lucide (lucide-static 1.66.0, ISC), inlined by views/markdown-icons.mjs.
import {
  COMMANDS, applyToText, continueList, shortcutFor, taskLists,
  readViewMode, writeViewMode, applyViewMode, pdfTitle,
} from './markdown-editor-core.js?v=20261122-2';

const API = '/api/markdown';
const SAVE_DELAY = 900;
const EXPANDED_KEY = 'kyohoon-markdown-folders';
const SIDEBAR_KEY = 'kyohoon-markdown-sidebar';
const NARROW = '(max-width: 760px)';
const DRAWER = '(max-width: 1023px)';
const PREVIEW_THEME_KEY = 'kyohoon-markdown-preview-theme';
// Not a theme key (keys never start with "_"): the site's own reading style,
// defined in markdown-editor.css, light or dark with the site.
const SITE_STYLE = '_site';
const REVOKE_DELAY = 1500;

export function createRenderer(markdownit, DOMPurify, doc) {
  const md = markdownit({html: true, linkify: true, typographer: false, breaks: false});
  md.use(taskLists);
  const purify = DOMPurify;
  purify.addHook('afterSanitizeAttributes', node => {
    if (node.nodeName === 'A' && node.hasAttribute('href')) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
  });
  const config = {
    FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select', 'option', 'iframe', 'object', 'embed', 'dialog', 'template'],
    FORBID_ATTR: ['style', 'id', 'name'],
    ADD_ATTR: ['target'],
    RETURN_DOM_FRAGMENT: true,
  };
  return function render(source) {
    const fragment = purify.sanitize(md.render(source || ''), config);
    for (const input of fragment.querySelectorAll('input')) {
      if (input.getAttribute('type') !== 'checkbox') input.remove();
      else input.setAttribute('disabled', '');
    }
    return doc.importNode(fragment, true);
  };
}

export function mountMarkdownEditor(root, options = {}) {
  const win = options.window || root.ownerDocument.defaultView;
  const doc = root.ownerDocument;
  const fetcher = options.fetch || ((...args) => win.fetch(...args));
  let storage = null;
  try { storage = options.storage === undefined ? win.localStorage : options.storage; } catch {}
  const render = options.render || createRenderer(options.markdownit || win.markdownit, options.DOMPurify || win.DOMPurify, doc);
  const media = q => (typeof win.matchMedia === 'function' ? win.matchMedia(q) : {matches: false, addEventListener() {}});
  const narrowQuery = media(NARROW), drawerQuery = media(DRAWER);

  const editor = root.dataset.role === 'editor';
  const saveDelay = options.saveDelay ?? SAVE_DELAY;
  const $ = sel => root.querySelector(sel);
  const el = {
    tree: $('[data-tree]'), sidebar: $('[data-sidebar-panel]'), scrim: $('[data-scrim]'), workspace: $('[data-workspace]'),
    toggle: $('[data-action=toggle-sidebar]'), crumb: $('[data-crumb]'), title: $('[data-doc-title]'),
    save: $('[data-save]'), saveText: $('[data-save-text]'), retry: $('[data-action=retry-save]'),
    exportButton: $('[data-action=export]'), toolbar: $('[data-toolbar]'), conflict: $('[data-conflict]'),
    panes: $('[data-panes]'), source: $('[data-source]'), preview: $('[data-preview]'),
    empty: $('[data-empty]'), emptyTitle: $('[data-empty-title]'), emptyText: $('[data-empty-text]'), emptyAction: $('[data-empty-action]'),
    nameDialog: doc.querySelector('[data-name-dialog]'), confirmDialog: doc.querySelector('[data-confirm-dialog]'),
    exportDialog: doc.querySelector('[data-export-dialog]'),
    themeTrigger: $('[data-theme-trigger]'), themePanel: $('[data-theme-panel]'), themeCurrent: $('[data-theme-current]'),
    themeChip: $('[data-theme-chip]'), themeToggle: $('[data-preview-theme-toggle]'),
  };

  const state = {
    folders: [], documents: [], current: null, revision: null, pending: {}, timer: 0, saving: null,
    conflict: null, failed: false, expanded: loadExpanded(), lastFolder: null, mode: 'split', sidebarOpen: true,
    theme: 'ivory', themed: loadThemed(),
  };

  // ---------- helpers ----------
  async function api(path, init = {}) {
    const response = await fetcher(API + path, {
      ...init, credentials: 'same-origin',
      headers: {'Accept': 'application/json', ...(init.body ? {'Content-Type': 'application/json'} : {}), ...(init.headers || {})},
    });
    let data = null;
    try { data = await response.json(); } catch {}
    if (!response.ok) { const error = new Error(data?.error || '요청을 처리하지 못했습니다.'); error.status = response.status; error.data = data; throw error; }
    return data;
  }
  function loadExpanded() {
    try { const v = JSON.parse(storage?.getItem(EXPANDED_KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
  }
  function loadThemed() { try { return storage?.getItem(PREVIEW_THEME_KEY) !== 'off'; } catch { return true; } }
  function saveExpanded() { try { storage?.setItem(EXPANDED_KEY, JSON.stringify(state.expanded)); } catch {} }
  const isExpanded = id => state.expanded[id] !== false;
  const folderOf = id => state.folders.find(f => f.id === id);
  const docsIn = id => state.documents.filter(d => d.folder_id === id).sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  const icon = name => `<svg class="md-icon" aria-hidden="true" focusable="false"><use href="#mdi-${name}"></use></svg>`;
  const escapeHtml = v => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  function announce(text) { setSave('idle', text); }

  // ---------- save state ----------
  function setSave(kind, text) {
    if (!el.save) return;
    el.save.dataset.saveState = kind;
    el.saveText.textContent = text;
    if (el.retry) el.retry.hidden = kind !== 'error';
  }

  function queuePatch(fields, delay = saveDelay) {
    if (!editor || !state.current) return;
    Object.assign(state.pending, fields);
    if (state.conflict) return;
    setSave('saving', '저장 중…');
    win.clearTimeout(state.timer);
    state.timer = win.setTimeout(() => { flush(); }, delay);
  }

  async function flush() {
    win.clearTimeout(state.timer);
    if (state.saving) { await state.saving.catch(() => {}); return Object.keys(state.pending).length && !state.conflict ? flush() : undefined; }
    if (!state.current || state.conflict || !Object.keys(state.pending).length) return;
    const id = state.current.id, fields = state.pending;
    state.pending = {};
    setSave('saving', '저장 중…');
    state.saving = (async () => {
      try {
        const saved = await api(`/documents/${id}`, {method: 'PATCH', body: JSON.stringify({...fields, revision: state.revision})});
        if (state.current?.id === id) { state.revision = saved.revision; Object.assign(state.current, saved, {content: state.current.content}); }
        updateListEntry(saved);
        state.failed = false;
        if (!Object.keys(state.pending).length) setSave('saved', '저장됨');
      } catch (error) {
        state.pending = {...fields, ...state.pending};
        if (error.status === 409 && state.current?.id === id) { showConflict(error.data?.document); return; }
        state.failed = true;
        setSave('error', error.status === 413 ? '저장 실패: 문서가 너무 깁니다' : '저장 실패');
        throw error;
      }
    })();
    try { await state.saving; } catch {} finally { state.saving = null; }
    if (Object.keys(state.pending).length && !state.conflict && !state.failed) return flush();
  }

  function showConflict(latest) {
    state.conflict = latest || null;
    win.clearTimeout(state.timer);
    setSave('conflict', '저장 멈춤');
    el.conflict.hidden = false;
  }
  function clearConflict() { state.conflict = null; el.conflict.hidden = true; }

  async function resolveConflict(keepMine) {
    let latest = state.conflict;
    try { if (!latest) latest = await api(`/documents/${state.current.id}`); } catch (error) { setSave('error', '최신 내용을 불러오지 못했습니다'); return; }
    clearConflict();
    if (keepMine) {
      state.revision = latest.revision;
      state.pending = {...state.pending, content: el.source.value};
      await flush();
    } else {
      state.pending = {};
      showDocument(latest);
      setSave('saved', '최신 내용을 불러왔습니다');
    }
  }

  function updateListEntry(saved) {
    const entry = state.documents.find(d => d.id === saved.id);
    if (entry) {
      const renamed = entry.title !== saved.title;
      Object.assign(entry, {title: saved.title, theme: saved.theme, updated_at: saved.updated_at, folder_id: saved.folder_id});
      if (renamed) renderTree();
    }
  }

  // ---------- tree ----------
  function renderTree() {
    const currentId = state.current?.id;
    if (!state.folders.length) {
      el.tree.innerHTML = editor
        ? `<div class="md-tree-empty"><p>아직 폴더가 없습니다.<br>폴더를 먼저 만들고 그 안에 문서를 씁니다.</p><button type="button" class="btn btn--secondary" data-action="new-folder">${icon('folder-plus')}<span>첫 폴더 만들기</span></button></div>`
        : '<p class="md-tree-note">아직 공유된 문서가 없습니다.</p>';
      return;
    }
    const folders = [...state.folders].sort((a, b) => (a.position - b.position) || a.name.localeCompare(b.name, 'ko'));
    el.tree.innerHTML = `<ul class="md-tree" role="list">${folders.map(folder => {
      const docs = docsIn(folder.id), open = isExpanded(folder.id), listId = `md-folder-${folder.id}`;
      const actions = editor ? `<div class="md-row-actions"><button type="button" class="md-icon-btn md-icon-btn--sm" data-action="new-document" data-folder="${folder.id}" aria-label="${escapeHtml(folder.name)}에 새 문서" title="새 문서">${icon('file-plus')}</button><button type="button" class="md-icon-btn md-icon-btn--sm" data-action="rename-folder" data-folder="${folder.id}" aria-label="${escapeHtml(folder.name)} 이름 바꾸기" title="이름 바꾸기">${icon('pencil')}</button><button type="button" class="md-icon-btn md-icon-btn--sm" data-action="delete-folder" data-folder="${folder.id}" aria-label="${escapeHtml(folder.name)} 삭제" title="폴더 삭제">${icon('trash')}</button></div>` : '';
      const items = docs.map(d => `<li class="md-doc-item${d.id === currentId ? ' is-current' : ''}"><a class="md-doc-link" href="?doc=${d.id}" data-doc="${d.id}"${d.id === currentId ? ' aria-current="page"' : ''}>${icon('file')}<span>${escapeHtml(d.title)}</span></a>${editor ? `<div class="md-row-actions"><button type="button" class="md-icon-btn md-icon-btn--sm" data-action="rename-document" data-doc-id="${d.id}" aria-label="${escapeHtml(d.title)} 이름 바꾸기" title="이름 바꾸기">${icon('pencil')}</button><button type="button" class="md-icon-btn md-icon-btn--sm" data-action="delete-document" data-doc-id="${d.id}" aria-label="${escapeHtml(d.title)} 삭제" title="문서 삭제">${icon('trash')}</button></div>` : ''}</li>`).join('');
      const empty = docs.length ? '' : `<li class="md-docs-empty">${editor ? `<button type="button" class="md-text-btn" data-action="new-document" data-folder="${folder.id}">${icon('file-plus')}<span>이 폴더에 첫 문서 만들기</span></button>` : '<span>문서가 없습니다.</span>'}</li>`;
      return `<li class="md-folder" data-folder-id="${folder.id}"><div class="md-folder-row"><button type="button" class="md-folder-toggle" data-action="toggle-folder" data-folder="${folder.id}" aria-expanded="${open}" aria-controls="${listId}">${icon('chevron')}${icon('folder')}<span class="md-folder-name">${escapeHtml(folder.name)}</span><span class="md-count" aria-label="문서 ${docs.length}개">${docs.length}</span></button>${actions}</div><ul class="md-docs" id="${listId}" role="list"${open ? '' : ' hidden'}>${items}${empty}</ul></li>`;
    }).join('')}</ul>`;
  }

  function renderEmpty() {
    const hasDoc = !!state.current;
    el.panes.hidden = !hasDoc;
    el.empty.hidden = hasDoc;
    el.exportButton.disabled = !hasDoc;
    if (el.toolbar) el.toolbar.hidden = !hasDoc;
    root.dataset.state = hasDoc ? 'document' : state.folders.length ? 'pick' : 'empty';
    if (hasDoc) return;
    el.title.textContent = '마크다운 에디터';
    el.crumb.innerHTML = '<a class="md-crumb-home" href="/personal">Personal</a>';
    setSave('idle', '');
    let title, text, action = '';
    if (!state.folders.length) {
      title = editor ? '첫 폴더를 만들어 시작하세요' : '아직 공유된 문서가 없습니다';
      text = editor ? '폴더 안에 마크다운 문서를 만들고, 쓰는 동안 오른쪽에서 모양을 확인합니다.' : '편집 권한이 있는 사람이 문서를 만들면 여기에서 읽을 수 있습니다.';
      if (editor) action = 'new-folder';
    } else {
      title = '문서를 골라 주세요';
      text = editor ? '왼쪽 목록에서 문서를 열거나 새 문서를 만드세요.' : '왼쪽 목록에서 읽을 문서를 고르세요.';
      if (editor) action = 'new-document';
    }
    el.emptyTitle.textContent = title;
    el.emptyText.textContent = text;
    el.emptyAction.hidden = !action;
    el.emptyAction.dataset.action = action;
    el.emptyAction.textContent = action === 'new-folder' ? '새 폴더 만들기' : '새 문서 만들기';
  }

  // ---------- document ----------
  let renderFrame = 0;
  function renderPreview() {
    renderFrame = 0;
    if (!state.current) return;
    el.preview.replaceChildren(render(el.source ? el.source.value : state.current.content));
  }
  function schedulePreview() {
    if (renderFrame) return;
    const raf = win.requestAnimationFrame?.bind(win) || (fn => win.setTimeout(fn, 16));
    renderFrame = raf(() => renderPreview()) || 1;
  }

  function showDocument(document) {
    state.current = {...document};
    state.revision = document.revision;
    state.lastFolder = document.folder_id;
    if (el.source) { el.source.value = document.content || ''; el.source.readOnly = false; }
    setPreviewTheme(document.theme || 'ivory');
    renderTitle();
    renderPreview();
    renderTree();
    renderEmpty();
  }

  function renderTitle() {
    const d = state.current; if (!d) return;
    const folder = folderOf(d.folder_id);
    el.title.textContent = d.title;
    el.crumb.innerHTML = `<a class="md-crumb-home" href="/personal">Personal</a><span aria-hidden="true">/</span><span>${escapeHtml(folder?.name || '폴더')}</span>`;
    doc.title = `${d.title} | 마크다운 에디터 | Kyohoon Jin`;
  }

  async function openDocument(id, {push = true, focus = false} = {}) {
    if (state.current?.id === id) { closeDrawer(); return; }
    await flush();
    if (state.conflict) return;
    root.setAttribute('aria-busy', 'true');
    try {
      const document = await api(`/documents/${encodeURIComponent(id)}`);
      clearConflict();
      state.pending = {};
      showDocument(document);
      setSave('saved', editor ? '저장됨' : '');
      if (push) { try { win.history.pushState({doc: id}, '', `?doc=${id}`); } catch {} }
      closeDrawer();
      if (focus && el.source && state.mode !== 'preview') el.source.focus();
    } catch (error) {
      setSave('error', error.status === 404 ? '문서를 찾을 수 없습니다' : '문서를 열지 못했습니다');
    } finally { root.setAttribute('aria-busy', 'false'); }
  }

  function closeDocument() {
    state.current = null; state.revision = null; state.pending = {};
    clearConflict();
    el.preview.replaceChildren();
    if (el.source) el.source.value = '';
    try { win.history.replaceState({}, '', win.location.pathname); } catch {}
    doc.title = '마크다운 에디터 | Kyohoon Jin';
    renderTree(); renderEmpty();
  }

  // ---------- editing ----------
  function applyEdit(edit) {
    const ta = el.source;
    ta.focus();
    ta.setSelectionRange(edit.from, edit.to);
    const expected = applyToText(ta.value, edit);
    let done = false;
    try { done = doc.execCommand?.('insertText', false, edit.insert) === true; } catch {}
    if (!done || ta.value !== expected) {
      if (ta.value !== expected) ta.setRangeText(edit.insert, edit.from, edit.to, 'end');
      ta.dispatchEvent(new win.Event('input', {bubbles: true}));
    }
    ta.setSelectionRange(edit.selStart, edit.selEnd);
  }

  function runCommand(name) {
    const fn = COMMANDS[name];
    if (!fn || !el.source || !state.current) return;
    const ta = el.source;
    applyEdit(fn(ta.value, ta.selectionStart, ta.selectionEnd));
  }

  // ---------- view mode ----------
  function setMode(mode, persist = true) {
    if (!editor) { state.mode = applyViewMode(root, 'preview'); return; }
    if (narrowQuery.matches && mode === 'split') mode = 'edit';
    state.mode = applyViewMode(root, mode);
    if (persist) writeViewMode(storage, state.mode);
    if (state.mode !== 'edit') schedulePreview();
  }

  // ---------- sidebar / drawer ----------
  function syncSidebarRole() {
    const drawer = drawerQuery.matches;
    if (drawer) {
      if (!el.workspace.inert) root.dataset.sidebar = 'closed';
      const open = root.dataset.sidebar === 'open';
      el.sidebar.setAttribute('role', 'dialog');
      el.sidebar.setAttribute('aria-label', '문서 목록');
      el.sidebar.setAttribute('aria-modal', String(open));
      el.sidebar.inert = !open;
    } else {
      el.sidebar.removeAttribute('role'); el.sidebar.removeAttribute('aria-modal'); el.sidebar.removeAttribute('aria-label');
      setOutsideInert(false); el.scrim.hidden = true;
      root.dataset.sidebar = state.sidebarOpen ? 'open' : 'closed';
      el.sidebar.inert = !state.sidebarOpen;
    }
    el.toggle.setAttribute('aria-expanded', String(root.dataset.sidebar === 'open'));
  }
  // While the drawer is open everything else on the page is inert, so focus
  // stays in the list (the shared header and footer included).
  const outside = () => [el.workspace, ...doc.querySelectorAll('.md-shell > .site-header, .md-shell > .site-footer')];
  function setOutsideInert(on) { for (const node of outside()) node.inert = on; }
  function openDrawer() {
    root.dataset.sidebar = 'open';
    el.sidebar.inert = false;
    el.sidebar.setAttribute('aria-modal', 'true');
    setOutsideInert(true); el.scrim.hidden = false;
    el.toggle.setAttribute('aria-expanded', 'true');
    (el.sidebar.querySelector('[aria-current=page]') || el.sidebar.querySelector('[data-action=close-sidebar]'))?.focus({preventScroll: true});
  }
  function closeDrawer() {
    if (!drawerQuery.matches || root.dataset.sidebar !== 'open') return;
    root.dataset.sidebar = 'closed';
    el.sidebar.inert = true; el.sidebar.setAttribute('aria-modal', 'false');
    setOutsideInert(false); el.scrim.hidden = true;
    el.toggle.setAttribute('aria-expanded', 'false');
    el.toggle.focus({preventScroll: true});
  }
  function toggleSidebar() {
    if (drawerQuery.matches) { if (root.dataset.sidebar === 'open') closeDrawer(); else openDrawer(); return; }
    state.sidebarOpen = root.dataset.sidebar !== 'open';
    try { storage?.setItem(SIDEBAR_KEY, state.sidebarOpen ? 'open' : 'closed'); } catch {}
    syncSidebarRole();
  }

  // ---------- dialogs ----------
  function openModal(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  }
  function closeModal(dialog, value = '') {
    if (typeof dialog.close === 'function') dialog.close(value); else { dialog.removeAttribute('open'); dialog.returnValue = value; dialog.dispatchEvent(new win.Event('close')); }
  }

  let nameAction = null;
  function askName({title, label, submit, value = '', max, onSubmit}) {
    const dialog = el.nameDialog, form = dialog.querySelector('[data-name-form]');
    dialog.querySelector('[data-name-title]').textContent = title;
    dialog.querySelector('[data-name-label]').textContent = label;
    dialog.querySelector('[data-name-submit]').textContent = submit;
    const input = form.elements.name;
    input.value = value; input.maxLength = max;
    input.removeAttribute('aria-invalid');
    dialog.querySelector('[data-name-error]').textContent = '';
    nameAction = {onSubmit, max, label};
    openModal(dialog);
    input.focus(); input.select();
  }
  async function submitName(event) {
    event.preventDefault();
    if (!nameAction) return;
    const form = event.currentTarget, input = form.elements.name, error = form.querySelector('[data-name-error]');
    const value = input.value.trim();
    const fail = message => { input.setAttribute('aria-invalid', 'true'); error.textContent = message; input.focus(); };
    if (!value) return fail(`${nameAction.label}을 입력해 주세요.`);
    if (value.length > nameAction.max) return fail(`${nameAction.label}은 ${nameAction.max}자까지 쓸 수 있습니다.`);
    const button = form.querySelector('[data-name-submit]');
    button.disabled = true;
    try { await nameAction.onSubmit(value); nameAction = null; closeModal(el.nameDialog); }
    catch (e) { fail(e.message || '저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { button.disabled = false; }
  }

  function confirmDelete({title, text, onConfirm}) {
    const dialog = el.confirmDialog;
    dialog.querySelector('[data-confirm-title]').textContent = title;
    dialog.querySelector('[data-confirm-text]').textContent = text;
    dialog.returnValue = '';
    dialog.addEventListener('close', async function done() {
      dialog.removeEventListener('close', done);
      const value = dialog.returnValue; dialog.returnValue = '';
      if (value === 'confirm') {
        try { await onConfirm(); } catch (e) { setSave('error', e.message || '삭제하지 못했습니다'); }
      }
    });
    openModal(dialog);
  }

  // ---------- folder / document actions ----------
  function newFolder() {
    askName({title: '새 폴더', label: '폴더 이름', submit: '만들기', max: 80, onSubmit: async name => {
      const folder = await api('/folders', {method: 'POST', body: JSON.stringify({name})});
      state.folders.push(folder); state.expanded[folder.id] = true; saveExpanded(); state.lastFolder = folder.id;
      renderTree(); renderEmpty();
      announce(`‘${folder.name}’ 폴더를 만들었습니다`);
    }});
  }
  function newDocument(folderId) {
    folderId = folderId || state.current?.folder_id || state.lastFolder || state.folders[0]?.id;
    const folder = folderOf(folderId);
    if (!folder) return newFolder();
    askName({title: `${folder.name}에 새 문서`, label: '문서 제목', submit: '만들기', max: 120, onSubmit: async title => {
      const created = await api('/documents', {method: 'POST', body: JSON.stringify({folder_id: folder.id, title})});
      await flush();
      state.documents.push({id: created.id, folder_id: created.folder_id, title: created.title, theme: created.theme, updated_at: created.updated_at});
      state.expanded[folder.id] = true; saveExpanded();
      showDocument(created);
      setSave('saved', '저장됨');
      try { win.history.pushState({doc: created.id}, '', `?doc=${created.id}`); } catch {}
      closeDrawer();
      if (state.mode === 'preview') setMode('split');
      win.setTimeout(() => el.source?.focus(), 0);
    }});
  }
  function renameFolder(id) {
    const folder = folderOf(id); if (!folder) return;
    askName({title: '폴더 이름 바꾸기', label: '폴더 이름', submit: '바꾸기', value: folder.name, max: 80, onSubmit: async name => {
      const saved = await api(`/folders/${id}`, {method: 'PATCH', body: JSON.stringify({name})});
      Object.assign(folder, saved);
      renderTree(); renderTitle();
    }});
  }
  function deleteFolder(id) {
    const folder = folderOf(id); if (!folder) return;
    const count = docsIn(id).length;
    confirmDelete({title: `‘${folder.name}’ 폴더를 삭제할까요?`, text: count ? `안에 있는 문서 ${count}개도 함께 지워지고 되돌릴 수 없습니다.` : '빈 폴더입니다. 삭제하면 되돌릴 수 없습니다.', onConfirm: async () => {
      if (state.current?.folder_id === id) { win.clearTimeout(state.timer); state.pending = {}; }
      await api(`/folders/${id}`, {method: 'DELETE'});
      state.folders = state.folders.filter(f => f.id !== id);
      state.documents = state.documents.filter(d => d.folder_id !== id);
      if (state.current?.folder_id === id) closeDocument(); else { renderTree(); renderEmpty(); }
      announce(`‘${folder.name}’ 폴더를 삭제했습니다`);
    }});
  }
  function renameDocument(id) {
    const entry = state.documents.find(d => d.id === id); if (!entry) return;
    askName({title: '문서 제목 바꾸기', label: '문서 제목', submit: '바꾸기', value: entry.title, max: 120, onSubmit: async title => {
      let revision;
      if (state.current?.id === id) { await flush(); if (state.conflict) throw new Error('다른 곳에서 먼저 수정되었습니다. 최신 내용을 먼저 불러와 주세요.'); revision = state.revision; }
      else revision = (await api(`/documents/${id}`)).revision;
      const saved = await api(`/documents/${id}`, {method: 'PATCH', body: JSON.stringify({title, revision})});
      updateListEntry(saved);
      if (state.current?.id === id) { state.revision = saved.revision; state.current.title = saved.title; renderTitle(); }
      renderTree();
    }});
  }
  function deleteDocument(id) {
    const entry = state.documents.find(d => d.id === id); if (!entry) return;
    confirmDelete({title: `‘${entry.title}’ 문서를 삭제할까요?`, text: '삭제하면 되돌릴 수 없습니다.', onConfirm: async () => {
      if (state.current?.id === id) { win.clearTimeout(state.timer); state.pending = {}; }
      await api(`/documents/${id}`, {method: 'DELETE'});
      state.documents = state.documents.filter(d => d.id !== id);
      if (state.current?.id === id) closeDocument(); else renderTree();
      announce(`‘${entry.title}’ 문서를 삭제했습니다`);
    }});
  }

  // ---------- theme ----------
  // state.theme is the theme the preview shows (and the PDF dialog starts on):
  // the document's theme, or a reader's local pick. With "미리보기에 테마 적용"
  // off the preview uses the site's own reading style instead.
  const themeInputs = name => [...doc.querySelectorAll(`input[type=radio][name="${name}"]`)];
  const themeLabel = key => themeInputs('preview-theme').find(i => i.value === key)?.dataset.themeName || key;
  function setPreviewTheme(key) {
    state.theme = key;
    el.preview.dataset.mdTheme = state.themed ? key : SITE_STYLE;
    for (const input of themeInputs('preview-theme')) input.checked = input.value === key;
    if (el.themeCurrent) el.themeCurrent.textContent = themeLabel(key);
    if (el.themeChip) el.themeChip.dataset.mdTheme = key;
  }
  function setThemed(on, persist = true) {
    state.themed = on;
    if (persist) { try { storage?.setItem(PREVIEW_THEME_KEY, on ? 'on' : 'off'); } catch {} }
    if (el.themeToggle) el.themeToggle.checked = on;
    root.dataset.previewThemed = String(on);
    setPreviewTheme(state.theme);
  }
  function chooseTheme(key) {
    setPreviewTheme(key);
    if (!state.current || !editor || key === state.current.theme) return;
    state.current.theme = key;
    queuePatch({theme: key}, 0);
  }

  // ---------- PDF download ----------
  // The server renders the stored document, so unsaved edits are saved first.
  const exportForm = el.exportDialog?.querySelector('[data-export-form]');
  const exportPart = sel => el.exportDialog?.querySelector(sel);
  let exportAbort = null;
  function exportChoice() { return exportForm.querySelector('input[name=theme]:checked')?.value || state.theme; }
  function syncExportChoice() {
    const input = exportForm.querySelector('input[name=theme]:checked');
    exportPart('[data-export-selected]').textContent = input ? `${input.dataset.themeName}${input.dataset.themeDescription ? ` · ${input.dataset.themeDescription}` : ''}` : '';
    const row = exportPart('[data-export-save-row]');
    if (row) row.hidden = !state.current || exportChoice() === state.current.theme;
  }
  function setExportBusy(busy) {
    const button = exportPart('[data-export-submit]');
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    exportPart('[data-export-label]').textContent = busy ? 'PDF 만드는 중…' : 'PDF 내려받기';
  }
  function openExport() {
    if (!state.current || !el.exportDialog) return;
    try { if (el.themePanel?.matches(':popover-open')) el.themePanel.hidePopover(); } catch {}
    for (const radio of themeInputs('theme')) radio.checked = radio.value === state.theme;
    const save = exportForm.elements['save-theme'];
    if (save) save.checked = true;
    exportPart('[data-export-error]').textContent = '';
    setExportBusy(false);
    syncExportChoice();
    el.exportDialog.returnValue = '';
    openModal(el.exportDialog);
    (exportForm.querySelector('input[name=theme]:checked') || exportPart('[data-export-submit]'))?.focus();
  }
  function downloadBlob(blob, filename) {
    const url = win.URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url; a.download = filename; a.hidden = true;
    doc.body.append(a);
    a.click();
    a.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), REVOKE_DELAY);
  }
  async function downloadPdf(event) {
    event.preventDefault();
    if (!state.current || exportAbort) return;
    const error = exportPart('[data-export-error]');
    const fail = message => { error.textContent = message; setExportBusy(false); exportAbort = null; };
    const theme = exportChoice();
    const keep = editor && theme !== state.current.theme && exportForm.elements['save-theme']?.checked;
    error.textContent = '';
    setExportBusy(true);
    const abort = exportAbort = new win.AbortController();
    if (editor) {
      if (keep) Object.assign(state.pending, {theme});
      await flush();
      if (abort.signal.aborted) return;
      if (state.conflict) return fail('다른 곳에서 먼저 수정되었습니다. 충돌을 먼저 정리한 뒤 다시 시도해 주세요.');
      if (state.failed || Object.keys(state.pending).length) return fail('저장하지 못한 내용이 있어 PDF를 만들 수 없습니다. 저장을 다시 시도해 주세요.');
      if (keep) { state.current.theme = theme; setPreviewTheme(theme); }
    }
    let response;
    try {
      response = await fetcher(`${API}/documents/${encodeURIComponent(state.current.id)}/pdf?theme=${encodeURIComponent(theme)}`, {
        credentials: 'same-origin', headers: {'Accept': 'application/pdf'}, signal: abort.signal,
      });
    } catch {
      if (abort.signal.aborted) return;
      return fail('PDF를 내려받지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
    }
    if (abort.signal.aborted) return;
    if (!response.ok || !/pdf/i.test(response.headers.get('content-type') || '')) {
      let data = null;
      try { data = await response.json(); } catch {}
      return fail(data?.error || (response.status === 401 ? '로그인이 끝났습니다. 다시 로그인해 주세요.' : 'PDF를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    }
    let blob;
    try { blob = await response.blob(); } catch { return fail('PDF를 내려받지 못했습니다. 다시 시도해 주세요.'); }
    if (abort.signal.aborted) return;
    downloadBlob(blob, `${pdfTitle(state.current.title)}.pdf`);
    exportAbort = null;
    closeModal(el.exportDialog, 'done');
    announce('PDF를 내려받았습니다');
  }

  // ---------- events ----------
  root.addEventListener('click', event => {
    const link = event.target.closest('a[data-doc]');
    if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) {
      event.preventDefault(); openDocument(link.dataset.doc); return;
    }
    const button = event.target.closest('button[data-action], button[data-view-mode], button[data-cmd]');
    if (!button || button.disabled) return;
    if (button.dataset.viewMode) return setMode(button.dataset.viewMode);
    if (button.dataset.cmd) return runCommand(button.dataset.cmd);
    const folder = button.dataset.folder, docId = button.dataset.docId;
    switch (button.dataset.action) {
      case 'toggle-sidebar': return toggleSidebar();
      case 'close-sidebar': return drawerQuery.matches ? closeDrawer() : toggleSidebar();
      case 'toggle-folder': {
        const open = button.getAttribute('aria-expanded') !== 'true';
        state.expanded[folder] = open; saveExpanded();
        button.setAttribute('aria-expanded', String(open));
        doc.getElementById(button.getAttribute('aria-controls')).hidden = !open;
        return;
      }
      case 'new-folder': return newFolder();
      case 'new-document': return newDocument(folder);
      case 'rename-folder': return renameFolder(folder);
      case 'delete-folder': return deleteFolder(folder);
      case 'rename-document': return renameDocument(docId);
      case 'delete-document': return deleteDocument(docId);
      case 'retry-save': state.failed = false; return flush();
      case 'load-latest': return resolveConflict(false);
      case 'keep-mine': return resolveConflict(true);
      case 'export': return openExport();
    }
  });
  root.addEventListener('change', event => {
    const target = event.target;
    if (target.name === 'preview-theme' && target.checked) chooseTheme(target.value);
    else if (target.matches('[data-preview-theme-toggle]')) setThemed(target.checked);
  });
  // The picker opens on the current theme, so arrow keys start from there.
  el.themePanel?.addEventListener('toggle', event => {
    if (event.newState !== 'open') return;
    const checked = el.themePanel.querySelector('input[name="preview-theme"]:checked');
    checked?.focus({preventScroll: true});
    checked?.closest('.md-theme-family')?.scrollIntoView?.({block: 'nearest'});
  });
  // Toolbar buttons keep the caret and selection in the textarea.
  el.toolbar?.addEventListener('pointerdown', event => { if (event.target.closest('button')) event.preventDefault(); });
  el.scrim.addEventListener('click', closeDrawer);
  doc.addEventListener('keydown', event => {
    if (event.key === 'Escape' && drawerQuery.matches && root.dataset.sidebar === 'open' && !doc.querySelector('dialog[open]')) { event.preventDefault(); closeDrawer(); }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && String(event.key).toLowerCase() === 's' && state.current) {
      event.preventDefault(); if (editor) flush();
    }
    // Ctrl+P: the browser's print would reproduce the page, not the document.
    // Open the PDF dialog instead; the server makes the real file.
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && String(event.key).toLowerCase() === 'p' && state.current && !doc.querySelector('dialog[open]')) {
      event.preventDefault(); openExport();
    }
  });

  if (el.source) {
    el.source.addEventListener('input', () => {
      if (!state.current) return;
      state.current.content = el.source.value;
      queuePatch({content: el.source.value});
      if (state.mode !== 'edit') schedulePreview();
    });
    el.source.addEventListener('keydown', event => {
      const cmd = shortcutFor(event);
      if (cmd) { event.preventDefault(); runCommand(cmd); return; }
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing) {
        const edit = continueList(el.source.value, el.source.selectionStart, el.source.selectionEnd);
        if (edit) { event.preventDefault(); applyEdit(edit); }
      }
    });
    // Split view: the preview follows the editor's scroll position.
    const previewPane = root.querySelector('[data-pane=preview]');
    el.source.addEventListener('scroll', () => {
      if (state.mode !== 'split') return;
      const max = el.source.scrollHeight - el.source.clientHeight;
      const ratio = max > 0 ? el.source.scrollTop / max : 0;
      previewPane.scrollTop = ratio * (previewPane.scrollHeight - previewPane.clientHeight);
    }, {passive: true});
  }

  // Toolbar: one tab stop, arrow keys between tools (native focusgroup where supported).
  if (el.toolbar && !('focusGroup' in win.HTMLElement.prototype)) {
    const items = [...el.toolbar.querySelectorAll('button')];
    items.forEach((b, i) => { b.tabIndex = i ? -1 : 0; });
    el.toolbar.addEventListener('focusin', ({target}) => { if (items.includes(target)) items.forEach(b => { b.tabIndex = b === target ? 0 : -1; }); });
    el.toolbar.addEventListener('keydown', event => {
      const i = items.indexOf(doc.activeElement); if (i < 0) return;
      const rtl = win.getComputedStyle?.(el.toolbar).direction === 'rtl';
      const steps = {ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1};
      let next = null;
      if (event.key in steps) next = (i + steps[event.key] + items.length) % items.length;
      else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = items.length - 1;
      if (next === null) return;
      event.preventDefault(); items[next].focus();
    });
  }

  if (el.nameDialog) {
    el.nameDialog.querySelector('[data-name-form]').addEventListener('submit', submitName);
    el.nameDialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => closeModal(el.nameDialog));
    el.nameDialog.addEventListener('close', () => { nameAction = null; });
  }
  if (el.exportDialog) {
    el.exportDialog.querySelector('[data-dialog-cancel]').addEventListener('click', () => closeModal(el.exportDialog));
    el.exportDialog.addEventListener('change', event => { if (event.target.name === 'theme') syncExportChoice(); });
    // Closing mid-download (Escape, 취소, a click outside) drops the request.
    el.exportDialog.addEventListener('close', () => { exportAbort?.abort(); exportAbort = null; setExportBusy(false); });
    exportForm.addEventListener('submit', downloadPdf);
  }
  if (el.confirmDialog && typeof el.confirmDialog.close !== 'function') {
    el.confirmDialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); closeModal(el.confirmDialog, event.submitter?.value || ''); });
  }
  // closedby="any" is not in every engine yet; close on a click outside the box.
  if (!('closedBy' in (win.HTMLDialogElement?.prototype || {}))) {
    const outside = (e, d) => { const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    for (const dialog of doc.querySelectorAll('.md-dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', e => { pressedOutside = outside(e, dialog); });
      dialog.addEventListener('pointerup', e => { if (pressedOutside && outside(e, dialog)) closeModal(dialog); });
    }
  }

  win.addEventListener('popstate', () => {
    const id = new win.URLSearchParams(win.location.search).get('doc');
    if (id && id !== state.current?.id) openDocument(id, {push: false});
  });
  win.addEventListener('beforeunload', event => {
    if (Object.keys(state.pending).length || state.saving) { event.preventDefault(); event.returnValue = ''; }
  });
  win.addEventListener('pagehide', () => {
    if (!editor || !state.current || state.conflict || !Object.keys(state.pending).length || state.saving) return;
    try { fetcher(`${API}/documents/${state.current.id}`, {method: 'PATCH', keepalive: true, credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...state.pending, revision: state.revision})}); } catch {}
  });
  // Re-check on resize too: some engines settle the first media match after scripts run.
  let layoutKey = '';
  const onLayout = () => {
    const key = `${narrowQuery.matches}|${drawerQuery.matches}`;
    if (key === layoutKey) return;
    layoutKey = key;
    syncSidebarRole(); setMode(readViewMode(storage, narrowQuery.matches), false);
  };
  narrowQuery.addEventListener?.('change', onLayout);
  drawerQuery.addEventListener?.('change', onLayout);
  win.addEventListener('resize', onLayout);
  win.addEventListener('load', onLayout);

  // Shortcut labels: ⌘ on Apple keyboards.
  if (/Mac|iPhone|iPad/.test(win.navigator?.platform || '')) for (const b of root.querySelectorAll('[data-cmd][title]')) b.title = b.title.replace('Ctrl', '⌘');

  // ---------- start ----------
  try { state.sidebarOpen = storage?.getItem(SIDEBAR_KEY) !== 'closed'; } catch {}
  setThemed(state.themed, false);
  root.dataset.sidebar = drawerQuery.matches ? 'closed' : (state.sidebarOpen ? 'open' : 'closed');
  onLayout();

  const ready = (async () => {
    try {
      const tree = await api('/tree');
      state.folders = tree.folders || []; state.documents = tree.documents || [];
      renderTree(); renderEmpty();
      const wanted = new win.URLSearchParams(win.location.search).get('doc');
      if (wanted && state.documents.some(d => d.id === wanted)) await openDocument(wanted, {push: false});
    } catch (error) {
      el.tree.innerHTML = '<p class="md-tree-note">목록을 불러오지 못했습니다. 새로고침해 주세요.</p>';
      el.emptyTitle.textContent = error.status === 401 ? '다시 로그인해 주세요' : '목록을 불러오지 못했습니다';
      el.emptyText.textContent = error.status === 401 ? '로그인이 끝나 문서를 불러올 수 없습니다.' : '잠시 뒤 새로고침해 주세요.';
    } finally {
      root.setAttribute('aria-busy', 'false');
    }
  })();

  return {state, ready, flush, setMode, runCommand, openDocument, openExport};
}

if (typeof document !== 'undefined') {
  const start = () => { const root = document.querySelector('[data-md-app]'); if (root && !root.__mdEditor) root.__mdEditor = mountMarkdownEditor(root); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();
}
