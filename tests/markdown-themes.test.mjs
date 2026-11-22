import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { MARKDOWN_THEMES, MARKDOWN_THEME_KEYS, DEFAULT_MARKDOWN_THEME } from '../views/markdown-themes.mjs';
import { createHandler } from '../server/app.mjs';

const LEGACY_KEYS = ['ivory', 'github-dark', 'chrome', 'sprinkles'];
const EXPECTED_KEYS = [
  'ivory',
  'github-light', 'github-dark',
  'chrome',
  'sprinkles',
  'print',
  'gothic',
  'newsprint',
  'night',
  'pixyll',
  'whitey', 'whitey-dark',
  'monospace-light', 'monospace-dark',
  'ursine-polar', 'ursine-umbra',
  'xylight', 'xydark',
  'vue-light', 'vue-dark',
  'lapis-light', 'lapis-dark',
  'everforest-light', 'everforest-dark',
  'notion-light', 'notion-dark',
];

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

function extractRuleBlock(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match ? match[1] : null;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('MARKDOWN_THEMES keeps the original four keys and exports valid metadata for every theme', () => {
  assert.equal(DEFAULT_MARKDOWN_THEME, 'ivory');
  assert.deepEqual(MARKDOWN_THEMES.map(theme => theme.key), EXPECTED_KEYS);
  assert.deepEqual([...MARKDOWN_THEME_KEYS], EXPECTED_KEYS);
  assert.equal(new Set(MARKDOWN_THEME_KEYS).size, MARKDOWN_THEME_KEYS.length, 'Theme keys must be unique');

  for (const key of LEGACY_KEYS) {
    assert.ok(MARKDOWN_THEME_KEYS.includes(key), `Original theme key "${key}" must remain unchanged`);
  }

  for (const theme of MARKDOWN_THEMES) {
    assert.deepEqual(
      Object.keys(theme).sort(),
      ['description', 'family', 'key', 'name', 'source', 'variant'],
      `${theme.key} must expose the shared metadata contract fields`,
    );
    assert.match(theme.key, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${theme.key} must be lowercase kebab-case`);
    assert.ok(theme.key.length <= 40, `${theme.key} must fit the 40-char DB constraint`);
    assert.match(theme.name, /[가-힣]/, `${theme.key} name must include Korean`);
    assert.match(theme.description, /[가-힣]/, `${theme.key} description must be Korean`);
    assert.ok(theme.name.length >= 2 && theme.name.length <= 20, `${theme.key} name length`);
    assert.ok(theme.description.length >= 8 && theme.description.length <= 60, `${theme.key} description length`);
    assert.equal(typeof theme.family, 'string');
    assert.ok(theme.family.trim().length > 0, `${theme.key} family must be non-empty`);
    assert.ok(
      theme.variant === 'light' || theme.variant === 'dark',
      `${theme.key} variant must be light or dark`,
    );
    assert.match(theme.source, /^https:\/\/[^\s]+$/, `${theme.key} source must be an https URL`);
  }

  // Light/dark families share a single family name across variants.
  const pairedFamilies = ['GitHub', 'Whitey', 'Monospace', 'Ursine', 'XyDark', 'Vue', 'Lapis', 'Everforest', 'Notion'];
  for (const family of pairedFamilies) {
    const variants = new Set(MARKDOWN_THEMES.filter(t => t.family === family).map(t => t.variant));
    assert.deepEqual(variants, new Set(['light', 'dark']), `Family "${family}" must provide both light and dark variants`);
  }
});

test('markdown-themes.css uses LF endings, balanced braces, no @import/Typora UI selectors and lists every theme', () => {
  assert.equal(css.includes('\r'), false, 'CSS must keep LF line endings');
  const uncommented = stripComments(css);
  const opens = (uncommented.match(/\{/g) || []).length;
  const closes = (uncommented.match(/\}/g) || []).length;
  assert.equal(opens, closes, 'CSS braces must be balanced');

  assert.equal(/@import\b/i.test(uncommented), false, 'CSS must not use @import (blocked in PDF renderer)');
  assert.equal(/url\(\s*['"]?https?:/i.test(uncommented), false, 'CSS must not load remote assets via url()');

  for (const forbidden of ['#write', '#typora-source', '#typora-sidebar', '.md-fences', '.CodeMirror', '.megamenu']) {
    assert.equal(
      uncommented.includes(forbidden),
      false,
      `CSS must not contain Typora-specific UI selector "${forbidden}"`,
    );
  }

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

test('every theme is scoped under .md-doc[data-md-theme="<key>"], sets article bg+color, and covers all elements', () => {
  const requiredElements = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'a', 'strong', 'em', 'u', 'del',
    'blockquote', 'ul', 'ol', 'li',
    'li.task-list-item input[type="checkbox"]',
    'code', 'pre > code', 'table', 'th', 'td', 'hr', 'img',
  ];

  const screenCss = css.slice(0, css.indexOf('@media print'));

  for (const theme of MARKDOWN_THEMES) {
    const scope = `.md-doc[data-md-theme="${theme.key}"]`;
    const containerRule = extractRuleBlock(screenCss, scope);
    assert.ok(containerRule, `Missing container rule for ${scope}`);
    assert.match(containerRule, /background-color\s*:/, `${scope} must set background-color on the article`);
    assert.match(containerRule, /(?:^|\s)color\s*:/, `${scope} must set text color on the article`);
    assert.match(
      containerRule,
      new RegExp(`color-scheme\\s*:\\s*${theme.variant}\\b`),
      `${scope} must set color-scheme: ${theme.variant}`,
    );

    for (const element of requiredElements) {
      assert.ok(
        screenCss.includes(`${scope} ${element}`),
        `Theme ${theme.key} must explicitly style ${element}`,
      );
    }
  }

  // Ensure Korean font fallbacks are declared in the stylesheet.
  for (const family of ['Pretendard', 'Noto Sans KR', 'Noto Serif KR', 'Malgun Gothic']) {
    assert.ok(css.includes(family), `Missing Korean font fallback: ${family}`);
  }
});

test('signature aesthetic details are preserved across legacy and new themes', () => {
  // ivory: warm off-white page, serif body, sans headings, h1 dark rule
  assert.match(css, /\.md-doc\[data-md-theme="ivory"\][\s\S]*?#efeae5/i);
  assert.match(css, /\.md-doc\[data-md-theme="ivory"\] h1\s*\{[\s\S]*?border-bottom:\s*2px solid #2c2926/i);

  // github-dark: #1e1e1e background, code block with gutter & border
  assert.match(css, /\.md-doc\[data-md-theme="github-dark"\][\s\S]*?#1e1e1e/i);
  assert.match(css, /\.md-doc\[data-md-theme="github-dark"\] pre\s*\{[\s\S]*?linear-gradient[\s\S]*?border:/);

  // chrome: graphite #0f1113, soft silver #c5cad2, uppercase headings, #8fd3ff ice-blue accent
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\][\s\S]*?#0f1113/i);
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\][\s\S]*?#c5cad2/i);
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\][\s\S]*?#8fd3ff/i);
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\] h1,[\s\S]*?text-transform:\s*uppercase/);
  assert.match(css, /\.md-doc\[data-md-theme="chrome"\] th\s*\{[\s\S]*?text-transform:\s*uppercase/);

  // sprinkles: emoji heading prefixes, rainbow link prefix + hover color change
  for (const level of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
    assert.match(
      css,
      new RegExp(`\\.md-doc\\[data-md-theme="sprinkles"\\] ${level}::before\\s*\\{\\s*content:\\s*"[^"]+"`),
      `sprinkles must set an emoji ::before prefix on ${level}`,
    );
  }
  assert.match(css, /\.md-doc\[data-md-theme="sprinkles"\] a::before\s*\{[\s\S]*?content:\s*"🌈"/);
  assert.match(css, /\.md-doc\[data-md-theme="sprinkles"\] a:hover\s*\{[\s\S]*?color:/);

  // monospace-light & monospace-dark: markdown # heading prefixes
  for (const key of ['monospace-light', 'monospace-dark']) {
    assert.match(css, new RegExp(`\\.md-doc\\[data-md-theme="${key}"\\] h1::before\\s*\\{\\s*content:\\s*"# "`));
  }

  // whitey & whitey-dark: centered h2 rule
  for (const key of ['whitey', 'whitey-dark']) {
    assert.match(css, new RegExp(`\\.md-doc\\[data-md-theme="${key}"\\] h2::after\\s*\\{[\\s\\S]*?width:\\s*100px`));
  }

  // lapis-light & lapis-dark: filled inline-block h2 pill
  for (const key of ['lapis-light', 'lapis-dark']) {
    assert.match(css, new RegExp(`\\.md-doc\\[data-md-theme="${key}"\\] h2\\s*\\{[\\s\\S]*?display:\\s*inline-block`));
  }

  // vue-light & vue-dark: emerald #42b983 accent
  for (const key of ['vue-light', 'vue-dark']) {
    assert.match(css, new RegExp(`\\.md-doc\\[data-md-theme="${key}"\\][\\s\\S]*?#42b983`, 'i'));
  }

  // everforest-light & everforest-dark: parchment & forest slate surfaces
  assert.match(css, /\.md-doc\[data-md-theme="everforest-light"\][\s\S]*?#fffbef/i);
  assert.match(css, /\.md-doc\[data-md-theme="everforest-dark"\][\s\S]*?#2e353a/i);

  // notion-light & notion-dark: coral #ec5757 inline code
  for (const key of ['notion-light', 'notion-dark']) {
    assert.match(css, new RegExp(`\\.md-doc\\[data-md-theme="${key}"\\][\\s\\S]*?#ec5757`, 'i'));
  }
});

test('CSS includes A4 @page rules and @media print surface+color rules for every theme key', () => {
  assert.match(css, /@page\s*\{[\s\S]*?size:\s*A4[\s\S]*?margin:/);

  const printBlock = extractPrintBlock(css);
  assert.match(printBlock, /print-color-adjust:\s*exact/);
  assert.match(printBlock, /-webkit-print-color-adjust:\s*exact/);
  assert.match(printBlock, /break-after:\s*avoid/);
  assert.match(printBlock, /break-inside:\s*avoid/);
  assert.match(printBlock, /thead\s*\{[\s\S]*?display:\s*table-header-group/);

  for (const key of MARKDOWN_THEME_KEYS) {
    assert.ok(
      printBlock.includes(`html:has(.md-doc[data-md-theme="${key}"])`),
      `@media print must preserve html page background for theme "${key}"`,
    );
    assert.match(
      printBlock,
      new RegExp(`\\.md-doc\\[data-md-theme="${key}"\\]\\s*\\{[\\s\\S]*?background-color:[\\s\\S]*?color:`),
      `@media print must include explicit background-color and color rules for theme "${key}"`,
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
  for (const key of MARKDOWN_THEME_KEYS) {
    assert.ok(res.body.includes(`.md-doc[data-md-theme="${key}"]`));
  }
});
