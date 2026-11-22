// Markdown editor core: pure text transforms, list continuation, the task-list
// markdown-it plugin and view-mode helpers. No DOM globals at import time, so
// Node tests import this file directly and the browser loads it as a module.
//
// Every transform takes (value, start, end) — the textarea text and its
// selection — and returns an edit: {from, to, insert, selStart, selEnd}.
// `from..to` is the smallest range replaced in the old text; selStart/selEnd
// are positions in the new text. applyEdit() in markdown-editor.js writes it
// through execCommand('insertText') so the browser undo stack keeps working.

export const VIEW_MODES = ['edit', 'split', 'preview'];
export const VIEW_MODE_KEY = 'kyohoon-markdown-view';

const URL_RE = /^(?:https?:\/\/|www\.)\S+$/i;
const LIST_RE = /^(\s*)([-*+])\s+\[([ xX])\]\s+|^(\s*)([-*+])\s+|^(\s*)(\d{1,9})([.)])\s+/;

export function applyToText(value, edit) {
  return value.slice(0, edit.from) + edit.insert + value.slice(edit.to);
}

function lineBounds(value, start, end) {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  let last = end;
  if (end > start && value[end - 1] === '\n') last = end - 1;
  let to = value.indexOf('\n', Math.max(last, from));
  if (to === -1) to = value.length;
  return {from, to};
}

function runBefore(value, pos, ch) { let n = 0; while (pos - n - 1 >= 0 && value[pos - n - 1] === ch) n++; return n; }
function runAfter(value, pos, ch) { let n = 0; while (pos + n < value.length && value[pos + n] === ch) n++; return n; }

// Words picked by a double click often carry a trailing space; wrap the word only.
function trimSelection(value, start, end) {
  while (start < end && /\s/.test(value[start])) start++;
  while (end > start && /\s/.test(value[end - 1])) end--;
  return [start, end];
}

function isWrappedOutside(value, start, end, open, close) {
  if (open.length === 1 && open === close) {
    const a = runBefore(value, start, open), b = runAfter(value, end, open);
    return a % 2 === 1 && b % 2 === 1;
  }
  return value.slice(start - open.length, start) === open && value.slice(end, end + close.length) === close;
}

function isWrappedInside(sel, open, close) {
  if (sel.length < open.length + close.length) return false;
  if (open.length === 1 && open === close) {
    const a = runAfter(sel, 0, open), b = runBefore(sel, sel.length, open);
    return a % 2 === 1 && b % 2 === 1 && a < sel.length;
  }
  return sel.startsWith(open) && sel.endsWith(close);
}

export function toggleWrap(value, start, end, open, close = open, placeholder = '') {
  if (start !== end) [start, end] = trimSelection(value, start, end);
  const sel = value.slice(start, end);
  if (isWrappedOutside(value, start, end, open, close)) {
    const from = start - open.length;
    return {from, to: end + close.length, insert: sel, selStart: from, selEnd: from + sel.length};
  }
  if (sel && isWrappedInside(sel, open, close)) {
    const inner = sel.slice(open.length, sel.length - close.length);
    return {from: start, to: end, insert: inner, selStart: start, selEnd: start + inner.length};
  }
  const text = sel || placeholder;
  const selStart = start + open.length;
  return {from: start, to: end, insert: open + text + close, selStart, selEnd: selStart + text.length};
}

export const bold = (v, s, e) => toggleWrap(v, s, e, '**', '**', '굵은 글씨');
export const italic = (v, s, e) => toggleWrap(v, s, e, '*', '*', '기울인 글씨');
export const underline = (v, s, e) => toggleWrap(v, s, e, '<u>', '</u>', '밑줄 글씨');
export const strike = (v, s, e) => toggleWrap(v, s, e, '~~', '~~', '취소선 글씨');

export function code(value, start, end) {
  if (value.slice(start, end).includes('\n')) return fencedBlock(value, start, end);
  return toggleWrap(value, start, end, '`', '`', '코드');
}

export function fencedBlock(value, start, end) {
  const {from, to} = lineBounds(value, start, end);
  const block = value.slice(from, to);
  const lines = block.split('\n');
  if (lines.length >= 2 && /^```/.test(lines[0]) && /^```\s*$/.test(lines[lines.length - 1])) {
    const inner = lines.slice(1, -1).join('\n');
    return {from, to, insert: inner, selStart: from, selEnd: from + inner.length};
  }
  const insert = '```\n' + block + '\n```';
  return {from, to, insert, selStart: from + 4, selEnd: from + 4 + block.length};
}

function headingLevel(line) { const m = /^(#{1,6})\s+/.exec(line); return m ? m[1].length : 0; }

export function setHeading(value, start, end, level) {
  const {from} = lineBounds(value, start, start);
  let to = value.indexOf('\n', from); if (to === -1) to = value.length;
  const line = value.slice(from, to);
  const current = headingLevel(line);
  const body = line.replace(/^#{1,6}\s+/, '');
  const next = current === level ? 0 : level;
  const prefix = next ? '#'.repeat(next) + ' ' : '';
  const insert = prefix + body;
  const oldPrefix = line.length - body.length;
  const shift = prefix.length - oldPrefix;
  const clamp = p => Math.max(from + prefix.length, Math.min(from + insert.length, p + shift));
  return {from, to, insert, selStart: clamp(start), selEnd: clamp(Math.max(start, Math.min(end, to)))};
}

// H1 -> H2 -> H3 -> plain -> H1 on the caret's line.
export function cycleHeading(value, start, end) {
  const {from} = lineBounds(value, start, start);
  let to = value.indexOf('\n', from); if (to === -1) to = value.length;
  const level = headingLevel(value.slice(from, to));
  const next = level === 0 ? 1 : level >= 3 ? 0 : level + 1;
  if (next === 0) return setHeading(value, start, end, level);
  return setHeading(value, start, end, next);
}

function listKind(line) {
  const m = LIST_RE.exec(line);
  if (!m) return null;
  if (m[3] !== undefined) return {kind: 'task', indent: m[1], length: m[0].length};
  if (m[5] !== undefined) return {kind: 'bullet', indent: m[4], length: m[0].length};
  return {kind: 'ordered', indent: m[6], length: m[0].length};
}

function prefixLines(value, start, end, transform) {
  const {from, to} = lineBounds(value, start, end);
  const lines = value.slice(from, to).split('\n');
  const result = transform(lines);
  const insert = result.lines.join('\n');
  if (start === end) {
    const shift = result.firstShift;
    const pos = Math.max(from + result.firstPrefix, start + shift);
    return {from, to, insert, selStart: pos, selEnd: pos};
  }
  return {from, to, insert, selStart: from, selEnd: from + insert.length};
}

export function toggleQuote(value, start, end) {
  return prefixLines(value, start, end, lines => {
    const filled = lines.filter(l => l.trim());
    const remove = filled.length > 0 && filled.every(l => /^\s*>/.test(l));
    const out = lines.map(l => remove ? l.replace(/^(\s*)>\s?/, '$1') : (l.trim() ? '> ' + l : '>'));
    const first = lines[0], next = out[0];
    return {lines: out, firstShift: next.length - first.length, firstPrefix: remove ? 0 : 2};
  });
}

function toggleList(value, start, end, kind) {
  return prefixLines(value, start, end, lines => {
    const allEmpty = lines.every(l => !l.trim());
    const target = (l, i) => l.trim() || (allEmpty && i === 0);
    const marked = lines.filter(target);
    const remove = marked.length > 0 && marked.every(l => listKind(l)?.kind === kind);
    let n = 0, firstPrefix = 0;
    const out = lines.map((l, i) => {
      if (!target(l, i)) return l;
      const found = listKind(l);
      const indent = found ? found.indent : (/^\s*/.exec(l)[0]);
      const body = found ? l.slice(found.length) : l.slice(indent.length);
      if (remove) { if (i === 0) firstPrefix = indent.length; return indent + body; }
      n++;
      const marker = kind === 'ordered' ? `${n}. ` : kind === 'task' ? '- [ ] ' : '- ';
      if (i === 0) firstPrefix = indent.length + marker.length;
      return indent + marker + body;
    });
    return {lines: out, firstShift: out[0].length - lines[0].length, firstPrefix};
  });
}

export const bulletList = (v, s, e) => toggleList(v, s, e, 'bullet');
export const orderedList = (v, s, e) => toggleList(v, s, e, 'ordered');
export const taskList = (v, s, e) => toggleList(v, s, e, 'task');

export function link(value, start, end) {
  if (start !== end) [start, end] = trimSelection(value, start, end);
  const sel = value.slice(start, end);
  if (URL_RE.test(sel)) {
    const text = '링크 텍스트';
    return {from: start, to: end, insert: `[${text}](${sel})`, selStart: start + 1, selEnd: start + 1 + text.length};
  }
  const text = sel || '링크 텍스트', url = 'https://';
  const insert = `[${text}](${url})`;
  if (!sel) return {from: start, to: end, insert, selStart: start + 1, selEnd: start + 1 + text.length};
  const urlStart = start + text.length + 3;
  return {from: start, to: end, insert, selStart: urlStart, selEnd: urlStart + url.length};
}

export function image(value, start, end) {
  if (start !== end) [start, end] = trimSelection(value, start, end);
  const sel = value.slice(start, end);
  if (URL_RE.test(sel)) {
    const alt = '이미지 설명';
    return {from: start, to: end, insert: `![${alt}](${sel})`, selStart: start + 2, selEnd: start + 2 + alt.length};
  }
  const alt = sel || '이미지 설명', url = 'https://';
  const urlStart = start + alt.length + 4;
  return {from: start, to: end, insert: `![${alt}](${url})`, selStart: urlStart, selEnd: urlStart + url.length};
}

// Puts a block on its own paragraph: a blank line before and after, so a `---`
// never turns the line above it into a heading.
function blockInsert(value, start, end, block, selFrom, selTo) {
  const before = value.slice(0, start), after = value.slice(end);
  const prefix = !before || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const suffix = !after ? '\n' : after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const base = start + prefix.length;
  const insert = prefix + block + suffix;
  if (selFrom === undefined) { const p = start + insert.length; return {from: start, to: end, insert, selStart: p, selEnd: p}; }
  return {from: start, to: end, insert, selStart: base + selFrom, selEnd: base + selTo};
}

export const TABLE_TEMPLATE = '| 열 1 | 열 2 | 열 3 |\n| --- | --- | --- |\n| 내용 | 내용 | 내용 |\n| 내용 | 내용 | 내용 |';
export const table = (v, s, e) => blockInsert(v, s, e, TABLE_TEMPLATE, 2, 5);
export const rule = (v, s, e) => blockInsert(v, s, e, '---');

// Enter inside a list item starts the next item; Enter on an empty item ends the list.
export function continueList(value, start, end) {
  if (start !== end) return null;
  const from = value.lastIndexOf('\n', start - 1) + 1;
  let to = value.indexOf('\n', start); if (to === -1) to = value.length;
  const line = value.slice(from, to);
  const m = LIST_RE.exec(line);
  if (!m || start - from < m[0].length) return null;
  const found = listKind(line);
  if (!line.slice(m[0].length).trim()) {
    if (to !== start) return null;
    return {from, to, insert: found.indent, selStart: from + found.indent.length, selEnd: from + found.indent.length};
  }
  let marker;
  if (found.kind === 'task') marker = `${m[2]} [ ] `;
  else if (found.kind === 'bullet') marker = `${m[5]} `;
  else marker = `${Number(m[7]) + 1}${m[8]} `;
  const insert = '\n' + found.indent + marker;
  return {from: start, to: start, insert, selStart: start + insert.length, selEnd: start + insert.length};
}

export const COMMANDS = {
  bold, italic, underline, strike, heading: cycleHeading, quote: toggleQuote, code,
  bullet: bulletList, ordered: orderedList, task: taskList, link, image, table, rule,
  h1: (v, s, e) => setHeading(v, s, e, 1), h2: (v, s, e) => setHeading(v, s, e, 2), h3: (v, s, e) => setHeading(v, s, e, 3),
};

// Standard shortcuts (GitHub / Google Docs). Keys are matched on event.key in
// lower case with Ctrl or Cmd held.
export const SHORTCUTS = [
  {cmd: 'bold', key: 'b'}, {cmd: 'italic', key: 'i'}, {cmd: 'underline', key: 'u'},
  {cmd: 'strike', key: 'x', shift: true}, {cmd: 'code', key: 'e'}, {cmd: 'link', key: 'k'},
  {cmd: 'quote', key: '.', shift: true, code: 'Period'}, {cmd: 'ordered', key: '7', shift: true, code: 'Digit7'},
  {cmd: 'bullet', key: '8', shift: true, code: 'Digit8'}, {cmd: 'task', key: '9', shift: true, code: 'Digit9'},
  {cmd: 'h1', key: '1', alt: true, code: 'Digit1'}, {cmd: 'h2', key: '2', alt: true, code: 'Digit2'}, {cmd: 'h3', key: '3', alt: true, code: 'Digit3'},
];

export function shortcutFor(event) {
  if (!(event.ctrlKey || event.metaKey)) return null;
  const key = String(event.key || '').toLowerCase();
  for (const s of SHORTCUTS) {
    if (!!s.shift !== !!event.shiftKey || !!s.alt !== !!event.altKey) continue;
    if (key === s.key || (s.code && event.code === s.code)) return s.cmd;
  }
  return null;
}

// markdown-it plugin: `- [ ] item` / `- [x] item` become disabled checkboxes,
// with the class names the themes style (li.task-list-item input[type=checkbox]).
export function taskLists(md) {
  md.core.ruler.after('inline', 'task-lists', state => {
    const tokens = state.tokens;
    for (let i = 2; i < tokens.length; i++) {
      const inline = tokens[i];
      if (inline.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue;
      const m = /^\[([ xX])\](?:[ \t ]|$)/.exec(inline.content);
      if (!m) continue;
      let remove = m[0].length;
      const children = inline.children || [];
      while (remove > 0 && children.length && children[0].type === 'text') {
        const t = children[0];
        if (t.content.length <= remove) { remove -= t.content.length; children.shift(); }
        else { t.content = t.content.slice(remove); remove = 0; }
      }
      if (remove > 0) continue;
      const box = new state.Token('html_inline', '', 0);
      box.content = `<input class="task-list-item-checkbox" type="checkbox" disabled${m[1] === ' ' ? '' : ' checked'}> `;
      children.unshift(box);
      inline.children = children;
      const item = tokens[i - 2];
      item.attrJoin('class', 'task-list-item');
      for (let j = i - 3; j >= 0; j--) {
        const t = tokens[j];
        if ((t.type === 'bullet_list_open' || t.type === 'ordered_list_open') && t.level === item.level - 1) {
          if (!String(t.attrGet('class') || '').includes('contains-task-list')) t.attrJoin('class', 'contains-task-list');
          break;
        }
      }
    }
  });
}

export function readViewMode(storage, narrow = false) {
  let mode = null;
  try { mode = storage?.getItem(VIEW_MODE_KEY); } catch {}
  if (!VIEW_MODES.includes(mode)) mode = 'split';
  return narrow && mode === 'split' ? 'edit' : mode;
}

export function writeViewMode(storage, mode) {
  if (!VIEW_MODES.includes(mode)) return;
  try { storage?.setItem(VIEW_MODE_KEY, mode); } catch {}
}

// Shows one pane or both and keeps the switch's pressed state in step.
export function applyViewMode(root, mode) {
  if (!VIEW_MODES.includes(mode)) mode = 'split';
  root.dataset.view = mode;
  for (const button of root.querySelectorAll('[data-view-mode]')) button.setAttribute('aria-pressed', String(button.dataset.viewMode === mode));
  const editor = root.querySelector('[data-pane=editor]'), preview = root.querySelector('[data-pane=preview]');
  if (editor) editor.hidden = mode === 'preview';
  if (preview) preview.hidden = mode === 'edit';
  return mode;
}

// A file name for the printed PDF: no characters an OS refuses in file names.
export function pdfTitle(title) {
  const clean = String(title || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || '마크다운 문서';
}
