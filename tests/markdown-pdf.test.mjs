import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {buildMarkdownPdfHtml, pdfDisposition, allowPdfRequest, createMarkdownPdfRenderer, localChromePath} from '../server/markdown-pdf.mjs';
import {MARKDOWN_THEME_KEYS} from '../views/markdown-themes.mjs';

test('PDF HTML embeds theme styles and Korean font, escapes the title and preserves safe Markdown', async () => {
  const html = await buildMarkdownPdfHtml({title:'한글 </title><script>alert("x")</script>', theme:'github-dark', content:'# 제목\n\n<u>밑줄</u> **강조**\n\n- [x] 완료\n- [ ] 대기\n\nhttps://example.com\n\n| 한글 | English |\n| --- | --- |\n| 값 | text |\n\n![그림](data:image/png;base64,AAAA)'});
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.title, '한글 </title><script>alert("x")</script>');
  const policy = doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
  for (const directive of ["default-src 'none'", "script-src 'none'", "object-src 'none'", "base-uri 'none'", "font-src data:", 'img-src data: http: https:']) assert.ok(policy.includes(directive));
  const article = doc.querySelector('article.md-doc[data-md-theme="github-dark"]');
  assert.equal(article.querySelector('h1').textContent, '제목');
  assert.equal(article.querySelector('u').textContent, '밑줄');
  assert.ok(article.querySelector('strong'));
  const boxes = [...article.querySelectorAll('input')];
  assert.equal(boxes.length, 2);
  assert.ok(boxes.every(input => input.disabled && input.type === 'checkbox'));
  assert.equal(boxes[0].checked, true);
  assert.equal(boxes[1].checked, false);
  assert.equal(article.querySelector('a').href, 'https://example.com/');
  assert.equal(article.querySelector('table th').textContent, '한글');
  assert.match(article.querySelector('img').src, /^data:image\/png/);
  assert.match(html, /data:font\/ttf;base64,/);
  assert.match(html, /box-decoration-break:clone/);
  assert.match(html, /padding:20mm/);
  assert.equal(doc.querySelector('link,script'), null);
});

test('PDF HTML rejects unknown themes and removes scripts, CSS, navigation and unsafe markup', async () => {
  await assert.rejects(buildMarkdownPdfHtml({theme:'"><script>'}), /Unknown Markdown theme/);
  const html = await buildMarkdownPdfHtml({content:'<script>alert(1)</script><style>body{display:none}</style><meta http-equiv="refresh" content="0;url=https://bad.invalid"><base href="https://bad.invalid"><iframe src="file:///secret"></iframe><form><input type="text"></form><img src="file:///secret" onerror="alert(1)" style="position:fixed"><u id="evil" style="color:red">안전</u><a href="javascript:alert(1)">링크</a>'});
  const doc = new JSDOM(html).window.document, article = doc.querySelector('article');
  assert.equal(article.querySelector('script,style,meta,base,iframe,form,input,[onerror],[style],[id]'), null);
  assert.equal(article.querySelector('img').hasAttribute('src'), false);
  assert.equal(article.querySelector('a').hasAttribute('href'), false);
  assert.equal(article.querySelector('u').textContent, '안전');
  for (const theme of MARKDOWN_THEME_KEYS) assert.ok(html.includes(`.md-doc[data-md-theme="${theme}"]`));
});

test('PDF attachment filename uses RFC 5987 encoding and cannot inject headers', () => {
  const header = pdfDisposition('보고서 "A" (최종)\r\n/\\');
  assert.ok(header.startsWith('attachment; filename="document.pdf"; filename*=UTF-8\'\''));
  const encoded = header.split("UTF-8''")[1];
  assert.equal(decodeURIComponent(encoded), '보고서 "A" (최종)____.pdf');
  assert.ok(encoded.includes('%28') && encoded.includes('%29'));
  assert.doesNotMatch(header, /[\r\n]/);
  assert.doesNotThrow(() => pdfDisposition('\ud800'));
});

test('PDF request guard permits data resources and HTTP images, blocking navigation and other requests', () => {
  const request = (url, type = 'image', navigation = false) => ({url:() => url, resourceType:() => type, isNavigationRequest:() => navigation});
  for (const url of ['https://example.com/image.png', 'http://example.com/image.png', 'data:image/png;base64,AAAA']) assert.equal(allowPdfRequest(request(url)), true);
  assert.equal(allowPdfRequest(request('data:font/ttf;base64,AAAA', 'font')), true);
  for (const url of ['file:///secret', 'ftp://example.com/image', 'javascript:alert(1)', 'blob:example']) assert.equal(allowPdfRequest(request(url)), false);
  for (const type of ['script', 'stylesheet', 'document', 'fetch', 'font']) assert.equal(allowPdfRequest(request('https://example.com/', type)), false);
  assert.equal(allowPdfRequest(request('https://example.com/image.png', 'image', true)), false);
  assert.equal(allowPdfRequest(request('data:text/html,test', 'document', true)), false);
});

function fakeBrowser({failPdf = false, stall = false} = {}) {
  const calls = [], handlers = {};
  const page = Object.fromEntries(['setDefaultTimeout', 'setDefaultNavigationTimeout', 'setJavaScriptEnabled', 'setRequestInterception', 'emulateMediaType', 'setContent'].map(name => [name, async (...args) => { calls.push([name, ...args]); }]));
  page.on = (event, listener) => { handlers[event] = listener; };
  page.pdf = async options => { calls.push(['pdf', options]); if (failPdf) throw Error('print failed'); if (stall) return new Promise(() => {}); return new Uint8Array([37, 80, 68, 70]); };
  const context = {newPage:async () => page, close:async () => { calls.push(['close']); }};
  return {browser:{createBrowserContext:async () => context}, calls, handlers};
}

test('PDF renderer disables JS before loading, emits A4 without headers, and always closes pages', async () => {
  for (const failPdf of [false, true]) {
    const fake = fakeBrowser({failPdf}), render = createMarkdownPdfRenderer({getBrowser:async () => fake.browser});
    if (failPdf) await assert.rejects(render({content:'본문'}), /print failed/);
    else assert.equal((await render({content:'본문'})).toString(), '%PDF');
    assert.ok(fake.calls.findIndex(([name]) => name === 'setJavaScriptEnabled') < fake.calls.findIndex(([name]) => name === 'setContent'));
    assert.deepEqual(fake.calls.find(([name]) => name === 'setJavaScriptEnabled'), ['setJavaScriptEnabled', false]);
    assert.deepEqual(fake.calls.find(([name]) => name === 'setRequestInterception'), ['setRequestInterception', true]);
    const options = fake.calls.find(([name]) => name === 'pdf')[1];
    assert.equal(options.format, 'A4');
    assert.equal(options.printBackground, true);
    assert.equal(options.displayHeaderFooter, false);
    assert.deepEqual(options.margin, {top:0, right:0, bottom:0, left:0});
    assert.equal(fake.calls.at(-1)[0], 'close');
  }
});

test('PDF render deadline closes an in-progress page and reports timeout', async () => {
  const fake = fakeBrowser({stall:true}), render = createMarkdownPdfRenderer({getBrowser:async () => fake.browser, timeout:100});
  await assert.rejects(render({content:'본문'}), /PDF timeout/);
  assert.equal(fake.calls.at(-1)[0], 'close');
});

test('Local browser path honors an explicit override', async () => {
  const filename = new URL('../package.json', import.meta.url);
  assert.equal(await localChromePath({CHROME_PATH:filename}), filename);
  await assert.rejects(localChromePath({CHROME_PATH:'artifacts/no-such-chrome.exe'}));
});
