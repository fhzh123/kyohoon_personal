// Run: node scripts/markdown-pdf-samples.mjs [--long] [theme ...]
// Uses CHROME_PATH or a locally installed Chrome/Edge. --long tests the HTTP download.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdir, writeFile} from 'node:fs/promises';
import {renderMarkdownPdf, closeMarkdownPdfBrowser} from '../server/markdown-pdf.mjs';
import {MARKDOWN_THEME_KEYS} from '../views/markdown-themes.mjs';
import {createHandler} from '../server/app.mjs';

const output = new URL('../artifacts/pdf-samples/', import.meta.url);
const long = process.argv.includes('--long');
const themes = process.argv.slice(2).filter(arg => arg !== '--long');
for (const theme of themes) if (!MARKDOWN_THEME_KEYS.includes(theme)) throw new Error(`Unknown Markdown theme: ${theme}`);
const image = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="100" viewBox="0 0 420 100"><rect width="420" height="100" fill="#4a8072"/><circle cx="60" cy="50" r="28" fill="#e7cc8f"/><path d="M115 70L185 24L250 70L320 32L390 70" fill="none" stroke="#fff" stroke-width="4"/></svg>').toString('base64');
const section = index => `
## ${index}. 한글과 English — 문서 확인

한국어 문장이 PDF에서도 선명하게 보이는지 확인합니다. 문서를 선택하고 복사할 수 있어야 합니다. **굵은 글씨**, *기울임*, <u>밑줄</u>, ~~취소선~~과 \`inline code\`를 함께 확인합니다.

This is selectable English text. Long paragraphs should wrap naturally and keep the same inner margins on every page. [클릭할 수 있는 링크](https://kyohoon.app/)도 유지합니다.

- 첫 번째 항목: 한글과 English
- 두 번째 항목
  - 안쪽 목록

1. 순서가 있는 목록
2. 다음 항목

- [x] 완료한 작업
- [ ] 남은 작업

> 인용문도 테마의 배경과 글자색을 따릅니다.
> A quotation with **emphasis** and a link to https://example.com.

\`\`\`javascript
const message = '안녕하세요, PDF!';
console.log(message);
// A long line wraps without crossing the page edge: abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789
\`\`\`

| 항목 | 내용 | 상태 |
| :--- | :--- | ---: |
| 문서 | 한국어와 English | 확인 |
| 테마 | 본문, 표, 코드 | 완료 |

<img src="${image}" alt="데이터 URL 이미지">

---
`;
const content = '# 마크다운 PDF 확인\n\nA4 · 전체 배경 · 페이지마다 같은 여백\n' + Array.from({length:9}, (_, i) => section(i + 1)).join('\n');

const sample = long ? content + Array.from({length:245}, (_, i) => section(i + 10)).join('\n') + '\n## End of long sample\n' : content;
const id = '11111111-1111-4111-8111-111111111111';
const title = '마크다운 PDF 확인';

async function downloadLongSample(theme) {
  const handler = createHandler({environment:{SUPABASE_URL:'https://fixture.invalid', SUPABASE_ANON_KEY:'fixture'}, fetcher:async url => {
    if (url.endsWith('/auth/v1/user')) return Response.json({id});
    if (url.includes('/workspace_members?')) return Response.json([{user_id:id, role:'editor', is_owner:true}]);
    if (url.includes('/markdown_documents?')) return Response.json([{id, title, content:sample, theme}]);
    throw new Error(`Unexpected fixture request: ${url}`);
  }});
  const server = createServer(handler).listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api/markdown/documents/${id}/pdf?theme=${theme}`;
    const response = await fetch(url, {headers:{cookie:'kh_access=fixture'}, signal:AbortSignal.timeout(155000)});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('transfer-encoding'), 'chunked');
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.match(pdf.subarray(0, 8).toString(), /^%PDF-/);
    assert.match(pdf.subarray(-30).toString(), /%%EOF\s*$/);
    assert.ok(pdf.length > 4.5 * 1024 * 1024);
    return pdf;
  } finally {
    server.close();
  }
}

await mkdir(output, {recursive:true});
try {
  for (const theme of themes.length ? themes : MARKDOWN_THEME_KEYS) {
    const start = performance.now();
    const pdf = long ? await downloadLongSample(theme) : await renderMarkdownPdf({title:`${title} — ${theme}`, content, theme});
    await writeFile(new URL(`${theme}${long ? '-long' : ''}.pdf`, output), pdf);
    console.log(`${theme}: ${sample.length} characters, ${pdf.length} PDF bytes, ${Math.round(performance.now() - start)} ms`);
  }
  const emojiContent = '# Typed emoji\n\n😀 🎉 ✅ 🇰🇷 👍🏽\n\n한글과 English alongside colour emoji.\n\n' +
    '## Sequences\n\n✏️ 👩🏽‍💻 1️⃣ #️⃣\n\n`😀`\n\n[Rainbow prefix](https://kyohoon.app/)';
  const emojiPdf = await renderMarkdownPdf({title:'Typed emoji', content:emojiContent, theme:'sprinkles'});
  await writeFile(new URL('typed-emoji.md', output), emojiContent + '\n');
  await writeFile(new URL('typed-emoji.pdf', output), emojiPdf);
  console.log(`typed-emoji: ${emojiPdf.length} bytes`);
} finally { await closeMarkdownPdfBrowser(); }
