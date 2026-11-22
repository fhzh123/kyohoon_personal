// Markdown editor screen (/personal/markdown). The server renders the frame —
// sidebar, title bar, toolbar, panes and dialogs — and public/markdown-editor.js
// fills it from /api/markdown. Nothing here imports pages.mjs, so pages.mjs can
// import this module without a cycle.
import {MARKDOWN_THEMES, DEFAULT_MARKDOWN_THEME} from './markdown-themes.mjs';
import {MARKDOWN_ICONS} from './markdown-icons.mjs';

export const MARKDOWN_ASSET_VERSION = '20261122-1';
const V = MARKDOWN_ASSET_VERSION;

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const mdIcon = name => `<svg class="md-icon" aria-hidden="true" focusable="false"><use href="#mdi-${name}"></use></svg>`;
const sprite = () => `<svg class="md-sprite" width="0" height="0" aria-hidden="true" focusable="false">${Object.entries(MARKDOWN_ICONS).map(([k, v]) => `<symbol id="mdi-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;

export const markdownHead = () => `<link rel="stylesheet" href="/markdown-themes.css?v=${V}"><link rel="stylesheet" href="/markdown-editor.css?v=${V}">`;

// Toolbar: [command, label, icon, shortcut]. Shortcuts follow GitHub and Google Docs.
const TOOL_GROUPS = [
  ['글자', [['bold', '굵게', 'bold', 'Ctrl+B'], ['italic', '기울임', 'italic', 'Ctrl+I'], ['underline', '밑줄', 'underline', 'Ctrl+U'], ['strike', '취소선', 'strike', 'Ctrl+Shift+X']]],
  ['문단', [['heading', '제목 (H1, H2, H3 순서로 바뀜)', 'heading', 'Ctrl+Alt+1'], ['quote', '인용', 'quote', 'Ctrl+Shift+.'], ['code', '코드 (여러 줄이면 코드 블록)', 'code', 'Ctrl+E']]],
  ['목록', [['bullet', '글머리 목록', 'list', 'Ctrl+Shift+8'], ['ordered', '번호 목록', 'ordered', 'Ctrl+Shift+7'], ['task', '체크박스', 'task', 'Ctrl+Shift+9']]],
  ['넣기', [['link', '링크', 'link', 'Ctrl+K'], ['image', '이미지', 'image', ''], ['table', '표', 'table', ''], ['rule', '구분선', 'rule', '']]],
];
const keyshortcut = s => s.replace('Ctrl', 'Control').replace('.', 'Period');

function toolbar() {
  const groups = TOOL_GROUPS.map(([label, tools]) => `<div class="md-tool-group" role="group" aria-label="${label}">${tools.map(([cmd, name, icon, keys]) => `<button type="button" class="md-tool" data-cmd="${cmd}" aria-label="${name}" title="${name}${keys ? ` (${keys})` : ''}"${keys ? ` aria-keyshortcuts="${keyshortcut(keys)}"` : ''}>${mdIcon(icon)}</button>`).join('')}</div>`);
  return `<div class="md-toolbar" role="toolbar" aria-label="서식 도구" aria-controls="md-source" focusgroup="toolbar wrap" data-toolbar>${groups.join('<span class="md-tool-sep" role="separator" aria-orientation="vertical"></span>')}</div>`;
}

const VIEW_BUTTONS = [['edit', '편집만'], ['split', '나란히'], ['preview', '미리보기만']];

function dialogs(editor) {
  const themes = MARKDOWN_THEMES.map(t => `<label class="md-theme-option"><input type="radio" name="theme" value="${esc(t.key)}"${t.key === DEFAULT_MARKDOWN_THEME ? ' checked' : ''}><span class="md-theme-sample" data-theme-sample="${esc(t.key)}" aria-hidden="true"></span><span class="md-theme-copy"><strong>${esc(t.name)}</strong><span>${esc(t.description)}</span></span></label>`).join('');
  return `${editor ? `<dialog class="md-dialog" id="md-name-dialog" aria-labelledby="md-name-title" closedby="any" data-name-dialog>
<form method="dialog" class="md-dialog-body" data-name-form novalidate>
<h2 id="md-name-title" data-name-title>새 폴더</h2>
<label class="md-field-label" for="md-name-input" data-name-label>폴더 이름</label>
<input class="md-field" id="md-name-input" name="name" type="text" autocomplete="off" required maxlength="120" aria-describedby="md-name-error" autofocus>
<p class="md-field-error" id="md-name-error" data-name-error></p>
<div class="md-dialog-actions"><button type="button" class="btn btn--secondary" data-dialog-cancel>취소</button><button type="submit" class="btn btn--primary" data-name-submit>만들기</button></div>
</form></dialog>
<dialog class="md-dialog" id="md-confirm-dialog" aria-labelledby="md-confirm-title" aria-describedby="md-confirm-text" data-confirm-dialog>
<form method="dialog" class="md-dialog-body">
<h2 id="md-confirm-title" data-confirm-title>삭제할까요?</h2>
<p class="md-dialog-text" id="md-confirm-text" data-confirm-text></p>
<div class="md-dialog-actions"><button type="submit" value="confirm" class="btn md-danger" data-confirm-ok>삭제</button><button type="submit" value="cancel" class="btn btn--secondary" autofocus>취소</button></div>
</form></dialog>` : ''}
<dialog class="md-dialog md-dialog--export" id="md-export-dialog" aria-labelledby="md-export-title" aria-describedby="md-export-text" closedby="any" data-export-dialog>
<form method="dialog" class="md-dialog-body" data-export-form>
<h2 id="md-export-title">PDF로 내보내기</h2>
<p class="md-dialog-text" id="md-export-text">테마를 고르면 미리보기에 바로 보입니다. 인쇄 창이 열리면 대상에서 ‘PDF로 저장’을 고르세요.</p>
<fieldset class="md-themes"><legend class="md-field-label">테마</legend>${themes}</fieldset>
<div class="md-dialog-actions"><button type="button" class="btn btn--secondary" data-dialog-cancel>취소</button><button type="submit" value="print" class="btn btn--primary">${mdIcon('printer')}<span>인쇄 창 열기</span></button></div>
</form></dialog>`;
}

export function markdownEditorMain(access) {
  const editor = access.role === 'editor';
  const role = editor ? 'editor' : 'reader';
  return `${sprite()}<main id="main" class="md-app" data-md-app data-role="${role}" data-view="${editor ? 'split' : 'preview'}" data-state="loading" aria-busy="true">
<aside class="md-sidebar" id="md-sidebar" aria-labelledby="md-sidebar-title" data-sidebar-panel>
<div class="md-sidebar-head"><h2 id="md-sidebar-title">문서</h2><div class="md-sidebar-actions">${editor ? `<button type="button" class="md-icon-btn" data-action="new-folder" aria-label="새 폴더" title="새 폴더">${mdIcon('folder-plus')}</button>` : ''}<button type="button" class="md-icon-btn md-drawer-close" data-action="close-sidebar" aria-label="문서 목록 닫기" title="문서 목록 닫기">${mdIcon('x')}</button></div></div>
<div class="md-tree-wrap" data-tree><p class="md-tree-note">목록을 불러오는 중입니다.</p></div>
${editor ? '' : '<p class="md-readonly-note">읽기 전용 계정입니다. 문서를 열어 보고 PDF로 내보낼 수 있습니다.</p>'}
</aside>
<div class="md-scrim" data-scrim hidden></div>
<section class="md-workspace" data-workspace aria-labelledby="md-doc-title">
<div class="md-titlebar">
<button type="button" class="md-icon-btn md-sidebar-toggle" data-action="toggle-sidebar" aria-controls="md-sidebar" aria-expanded="true" aria-label="문서 목록" title="문서 목록">${mdIcon('panel')}</button>
<div class="md-heading"><p class="md-crumb" data-crumb><a class="md-crumb-home" href="/personal">Personal</a></p><h1 id="md-doc-title" data-doc-title>마크다운 에디터</h1></div>
<div class="md-title-actions">
<p class="md-save" role="status" data-save data-save-state="idle"><span class="md-save-dot" aria-hidden="true"></span><span data-save-text></span></p>${editor ? '<button type="button" class="md-text-btn" data-action="retry-save" hidden>다시 시도</button>' : ''}
${editor ? `<div class="md-views" role="group" aria-label="보기 방식">${VIEW_BUTTONS.map(([mode, label]) => `<button type="button" class="md-view-btn" data-view-mode="${mode}" aria-pressed="${mode === 'split'}">${label}</button>`).join('')}</div>` : ''}
<button type="button" class="btn btn--primary md-export" data-action="export" disabled>${mdIcon('printer')}<span>PDF로 내보내기</span></button>
</div>
</div>
${editor ? toolbar() : ''}
<div class="md-conflict" data-conflict role="alert" hidden><p data-conflict-text>다른 곳에서 먼저 수정되었습니다. 자동 저장을 멈췄습니다.</p><div class="md-conflict-actions"><button type="button" class="btn btn--secondary" data-action="load-latest">최신 내용 불러오기</button><button type="button" class="btn btn--secondary" data-action="keep-mine">내 내용으로 덮어쓰기</button></div></div>
<div class="md-panes" data-panes hidden>
${editor ? `<div class="md-pane md-pane--editor" data-pane="editor"><label class="sr-only" for="md-source">마크다운 원문</label><textarea id="md-source" class="md-source" data-source spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="# 제목&#10;&#10;여기에 마크다운으로 씁니다."></textarea></div>` : ''}
<div class="md-pane md-pane--preview" data-pane="preview"><article class="md-doc" data-md-theme="${DEFAULT_MARKDOWN_THEME}" data-preview aria-label="미리보기" tabindex="0"></article></div>
</div>
<div class="md-empty" data-empty><img src="/mascot/markdown-editor.webp" alt="" width="168" height="168" decoding="async"><h2 data-empty-title>목록을 불러오는 중입니다</h2><p data-empty-text></p><button type="button" class="btn btn--primary" data-empty-action hidden></button></div>
</section>
</main>`;
}

export const markdownTail = access => `${dialogs(access.role === 'editor')}<div class="md-print" data-print-root aria-hidden="true"></div><script src="/vendor/markdown-it-14.3.3.min.js" defer></script><script src="/vendor/purify-3.4.17.min.js" defer></script><script type="module" src="/markdown-editor.js?v=${V}"></script>`;

export const markdownGate = () => `<main id="main" class="md-gate" aria-labelledby="md-gate-title"><img src="/mascot/markdown-editor.webp" alt="연필로 공책에 글을 쓰는 마스코트" width="220" height="220" decoding="async"><p class="space-eyebrow">Personal / 글쓰기</p><h1 id="md-gate-title">마크다운 에디터</h1><p>폴더를 만들고 마크다운 문서를 씁니다.<br>로그인하면 문서를 열고 고칠 수 있습니다.</p><div class="md-gate-actions"><a class="btn btn--primary" href="/login?next=%2Fpersonal%2Fmarkdown">로그인하고 열기</a><a class="btn btn--secondary" href="/personal">Personal로 돌아가기</a></div></main>`;
