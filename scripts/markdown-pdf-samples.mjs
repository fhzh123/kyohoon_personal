// Run: node scripts/markdown-pdf-samples.mjs [theme ...]
// Uses CHROME_PATH or a locally installed Chrome/Edge; never starts a web server.
import {mkdir, writeFile} from 'node:fs/promises';
import {renderMarkdownPdf, closeMarkdownPdfBrowser} from '../server/markdown-pdf.mjs';
import {MARKDOWN_THEME_KEYS} from '../views/markdown-themes.mjs';

const output = new URL('../artifacts/pdf-samples/', import.meta.url);
const themes = process.argv.slice(2);
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

await mkdir(output, {recursive:true});
try {
  for (const theme of themes.length ? themes : MARKDOWN_THEME_KEYS) {
    const pdf = await renderMarkdownPdf({title:`마크다운 PDF — ${theme}`, content, theme});
    await writeFile(new URL(`${theme}.pdf`, output), pdf);
    console.log(`${theme}: ${pdf.length} bytes`);
  }
  const emojiContent = '# Typed emoji\n\n😀 🎉 ✅ 🇰🇷 👍🏽\n\n한글과 English alongside colour emoji.\n\n' +
    '## Sequences\n\n✏️ 👩🏽‍💻 1️⃣ #️⃣\n\n`😀`\n\n[Rainbow prefix](https://kyohoon.app/)';
  const emojiPdf = await renderMarkdownPdf({title:'Typed emoji', content:emojiContent, theme:'sprinkles'});
  await writeFile(new URL('typed-emoji.md', output), emojiContent + '\n');
  await writeFile(new URL('typed-emoji.pdf', output), emojiPdf);
  console.log(`typed-emoji: ${emojiPdf.length} bytes`);
} finally { await closeMarkdownPdfBrowser(); }
