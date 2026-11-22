import test from 'node:test';
import assert from 'node:assert/strict';
import {createMarkdownPdfRenderer, allowPdfRequest, buildMarkdownPdfHtml, pdfDisposition} from '../server/markdown-pdf.mjs';

test('PDF request policy blocks navigation, executable resources and local schemes', () => {
  const request = (url, type = 'image', navigation = false) => ({url:() => url, resourceType:() => type, isNavigationRequest:() => navigation});
  for (const url of ['https://example.com/image.png', 'http://example.com/image.png', 'data:image/png;base64,AA==']) {
    assert.equal(allowPdfRequest(request(url)), true, url);
    assert.equal(allowPdfRequest(request(url, 'image', true)), false, url);
  }
  for (const url of ['file:///private/secret', 'ftp://example.com/a', 'javascript:alert(1)', 'blob:https://example.com/id']) assert.equal(allowPdfRequest(request(url)), false, url);
  for (const type of ['script', 'stylesheet', 'document', 'fetch', 'xhr', 'font']) assert.equal(allowPdfRequest(request('https://example.com/a', type)), false, type);
});

test('PDF markup preserves safe formatting and removes document controls', async () => {
  const html = await buildMarkdownPdfHtml({title:'한글 <"title"> & test', theme:'github-dark', content:'<meta http-equiv="refresh" content="0;url=https://example.com">\n<script>throw Error(1)</script>\n<style>body{display:none}</style>\n<form action="https://example.com"><input type="password"></form>\n\n<u>밑줄</u>\n\n- [x] 완료\n- [ ] 준비\n\n[링크](https://example.com)\n\n<img src="file:///secret" onerror="alert(1)">'});
  assert.match(html, /<title>한글 &lt;&quot;title&quot;&gt; &amp; test<\/title>/);
  assert.match(html, /<article class="md-doc" data-md-theme="github-dark">/);
  assert.match(html, /script-src 'none'/);
  assert.match(html, /base-uri 'none'/);
  assert.match(html, /font-src data:/);
  assert.match(html, /data:font\/ttf;base64,/);
  const article = html.slice(html.indexOf('<article'));
  assert.match(article, /<u>밑줄<\/u>/);
  assert.match(article, /class="task-list-item"/);
  assert.match(article, /type="checkbox"[^>]*disabled/);
  assert.match(article, /href="https:\/\/example.com"/);
  assert.doesNotMatch(article, /<script|<style|<form|<meta|onerror|file:|password/);
});

test('PDF filenames retain Korean and encode header delimiters', () => {
  const value = pdfDisposition('한글 "제목"\r\n.pdf');
  assert.ok(value.startsWith('attachment; filename="document.pdf"; filename*=UTF-8\'\''));
  assert.doesNotMatch(value, /\r|\n/);
  assert.ok(value.includes(encodeURIComponent('한글')));
});

function fakeBrowser({pdfError, contentDelay = 0} = {}) {
  const calls = [];
  const page = {
    setDefaultTimeout:() => {}, setDefaultNavigationTimeout:() => {},
    setJavaScriptEnabled:async value => calls.push(['javascript', value]),
    setRequestInterception:async value => calls.push(['interception', value]),
    on:() => {}, emulateMediaType:async value => calls.push(['media', value]),
    setContent:async () => { calls.push(['content']); if (contentDelay) await new Promise(resolve => setTimeout(resolve, contentDelay)); },
    pdf:async options => { calls.push(['pdf', options]); if (pdfError) throw pdfError; return new Uint8Array([37, 80, 68, 70]); },
  };
  const context = {newPage:async () => page, close:async () => { calls.push(['close']); }};
  return {calls, browser:{createBrowserContext:async () => context}};
}

test('PDF renderer disables scripts before loading and always closes its isolated context', async () => {
  for (const pdfError of [null, new Error('print failure')]) {
    const {calls, browser} = fakeBrowser({pdfError});
    const render = createMarkdownPdfRenderer({getBrowser:async () => browser});
    const pending = render({title:'문서', content:'# 제목', theme:'ivory'});
    if (pdfError) await assert.rejects(pending, /print failure/);
    else assert.deepEqual(await pending, Buffer.from('%PDF'));
    assert.ok(calls.findIndex(([name]) => name === 'javascript') < calls.findIndex(([name]) => name === 'content'));
    assert.deepEqual(calls.find(([name]) => name === 'javascript'), ['javascript', false]);
    assert.deepEqual(calls.find(([name]) => name === 'interception'), ['interception', true]);
    const options = calls.find(([name]) => name === 'pdf')[1];
    assert.equal(options.printBackground, true);
    assert.equal(options.displayHeaderFooter, false);
    assert.equal(options.preferCSSPageSize, true);
    assert.deepEqual(options.margin, {top:0, right:0, bottom:0, left:0});
    assert.equal(calls.at(-1)[0], 'close');
  }
});

test('PDF renderer timeout closes a page whose load never completes', async () => {
  const {calls, browser} = fakeBrowser({contentDelay:60});
  const render = createMarkdownPdfRenderer({getBrowser:async () => browser, timeout:15});
  await assert.rejects(render({title:'문서', content:'본문', theme:'ivory'}), /timeout/i);
  assert.equal(calls.at(-1)[0], 'close');
});
