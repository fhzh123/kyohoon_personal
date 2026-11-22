import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { MARKDOWN_THEMES, MARKDOWN_THEME_KEYS, DEFAULT_MARKDOWN_THEME } from '../views/markdown-themes.mjs';
import { createHandler } from '../server/app.mjs';

const EXPECTED_KEYS = ['ivory', 'github-dark', 'chrome', 'sprinkles'];
const cssPath = new URL('../public/markdown-themes.css', import.meta.url);
const css = await readFile(cssPath, 'utf8');

function extractPrintBlock(source) {
  const start = source.indexOf('@media print');
  assert.notEqual(start, -1, 'CSS must define a @media print block');
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  assert.fail('Unclosed @media print block');
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('MARKDOWN_THEMES exports the four fixed keys with concise Korean metadata', () => {
  assert.deepEqual(MARKDOWN_THEMES.map(theme => theme.key), EXPECTED_KEYS);
  assert.deepEqual([...MARKDOWN_THEME_KEYS], EXPECTED_KEYS);
  assert.equal(DEFAULT_MARKDOWN_THEME, 'ivory');
  for (const theme of MARKDOWN_THEMES) {
    assert.deepEqual(Object.keys(theme).sort(), ['description', 'key', 'name']);
    assert.match(theme.name, /[가-힣]/, `${theme.key} name must be Korean`);
    assert.match(theme.description, /[가-힣]/, `${theme.key} description must be Korean`);
    assert.ok(theme.name.length >= 2 && theme.name.length <= 20);
    assert.ok(theme.description.length >= 8 && theme.description.length <= 60);
  }
});

test('markdown-themes.css uses LF endings, balanced braces and documents every theme in its header', () => {
  assert.equal(css.includes('\r'), false, 'CSS must keep LF line endings');
  const uncommented = stripComments(css);
  const opens = (uncommented.match(/\{/g) || []).length;
  const closes = (uncommented.match(/\}/g) || []).length;
  assert.equal(opens, closes, 'CSS braces must be balanced');

  const headerMatch = css.match(/^\/\*([\s\S]*?)\*\//);
  assert.ok(headerMatch, 'CSS must begin with a header comment');
  const header = headerMatch[1];
  for (const theme of MARKDOWN_THEMES) {
    assert.ok(
      header.includes(`${theme.key} — ${theme.name}: ${theme.description}`),
      `Header comment must list ${theme.key} with its Korean name and description`,
    );
  }
});

test('every theme is scoped under .md-doc[data-md-theme="<key>"] and covers all required markdown elements', () => {
  const requiredElements = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'a', 'strong', 'em', 'u', 'del',
    'blockquote', 'ul', 'ol', 'li',
    'li.task-list-item input[type="checkbox"]',
    'code', 'pre > code', 'table', 'th', 'td', 'hr', 'img',
  ];

  for (const key of EXPECTED_KEYS) {
    const scope = `.md-doc[data-md-theme="${key}"]`;
    assert.ok(css.includes(scope), `Missing theme container selector ${scope}`);
    for (const element of requiredElements) {
      assert.ok(
        css.includes(`${scope} ${element}`),
        `Theme ${key} must explicitly style ${element}`,
      );
    }
  }

  // Ensure Korean font fallbacks are declared in the stylesheet.
  for (const family of ['Pretendard', 'Noto Sans KR', 'Noto Serif KR', 'Malgun Gothic']) {
    assert.ok(css.includes(family), `Missing Korean font fallback: ${family}`);
  }
});

test('each theme implements its signature aesthetic details without unscoped selectors', () => {
  // ivory: warm off-white page, serif body, sans headings, h1 dark rule, slate blockquote bar
  assert.match(css, /\.md-doc\[data-md-theme="ivory"\][\s\S]*?#efeae5/i);
  assert.match(css, /\.md-doc\[data-md-theme="ivory"\] h1\s*\{[\s\S]*?border-bottom:\s*2px solid #2c2926/i);

  // github-dark: #1e1e1e background, bordered tables, code block with gutter & border
  assert.match(css, /\.md-doc\[data-md-theme="github-dark"\][\s\S]*?#1e1e1e/i);
  assert.match(css, /\.md-doc\[data-md-theme="github-dark"\] pre\s*\{[\s\S]*?linear-gradient[\s\S]*?border:/);

  // chrome: graphite #0f1113, soft silver #c5cad2, uppercase headings, #8fd3ff ice-blue accent
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\][\s\S]*?#0f1113/i);
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\][\s\S]*?#c5cad2/i);
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\][\s\S]*?#8fd3ff/i);
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\] h1,[\s\S]*?text-transform:\s*uppercase/);
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\] th\s*\{[\s\S]*?text-transform:\s*uppercase/);

  // sprinkles: emoji heading prefixes, rainbow link prefix + hover color change, thin rules
  for (const level of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    assert.match(
      css,
      new RegExp(`\\.md-doc\\[data-md-theme="sprinkles"\\] ${level}::before\\s*\\{\\s*content:\\s*"[^"]+"`),
      `sprinkles must set an emoji ::before prefix on ${level}`,
    );
  }
  assert.match(css, /\.md-doc\[data-md-theme="sprinkles"\] a::before\s*\{[\s\S]*?content:\s*"🌈"/);
  assert.match(css, /\.md-doc\[data-md-theme="sprinkles"\] a:hover\s*\{[\s\S]*?color:/);
});

test('CSS includes A4 @page rules and @media print rules for every theme key', () => {
  assert.match(css, /@page\s*\{[\s\S]*?size:\s*A4[\s\S]*?margin:/);

  const printBlock = extractPrintBlock(css);
  assert.match(printBlock, /print-color-adjust:\s*exact/);
  assert.match(printBlock, /-webkit-print-color-adjust:\s*exact/);
  assert.match(printBlock, /break-after:\s*avoid/);
  assert.match(printBlock, /break-inside:\s*avoid/);
  assert.match(printBlock, /thead\s*\{[\s\S]*?display:\s*table-header-group/);

  for (const key of EXPECTED_KEYS) {
    assert.ok(
      printBlock.includes(`.md-doc[data-md-theme="${key}"]`),
      `@media print must include explicit rules for theme "${key}"`,
    );
  }
});

test('public/markdown-themes.css is served at /markdown-themes.css with text/css content type', async () => {
  const handler = createHandler({ environment: { NODE_ENV: 'development' } });
  const req = Readable.from([]);
  req.url = '/markdown-themes.css';
  req.method = 'GET';
  req.headers = { host: 'localhost:3000' };
  req.socket = { remoteAddress: '127.0.0.1' };
  const res = {
    status: 0,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    writeHead(status, values) {
      this.status = status;
      for (const [k, v] of Object.entries(values)) this.setHeader(k, v);
    },
    end(value) { this.body = Buffer.isBuffer(value) ? value.toString('utf8') : String(value ?? ''); },
  };
  await handler(req, res);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/css/);
  for (const key of EXPECTED_KEYS) {
    assert.ok(res.body.includes(`.md-doc[data-md-theme="${key}"]`));
  }
});
