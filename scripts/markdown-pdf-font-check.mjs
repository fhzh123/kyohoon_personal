// Run: node scripts/markdown-pdf-font-check.mjs
// CDP inspects actual glyph providers with page JavaScript disabled, just as
// in production. A second pass forces ONLY the two bundled font families.
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {buildMarkdownPdfHtml, localChromePath, allowPdfRequest} from '../server/markdown-pdf.mjs';

const output = new URL('../artifacts/pdf-samples/', import.meta.url);
await mkdir(output, {recursive:true});
const profile = await mkdtemp(fileURLToPath(new URL('../artifacts/markdown-font-check-', import.meta.url)));
const emoji = ['😀', '🎉', '✅', '🇰🇷', '👍🏽', '✏️', '👩🏽‍💻', '1️⃣', '#️⃣'];
const content = '# Heading\n\n## Subheading\n\n### Third\n\n#### Fourth\n\n##### Fifth\n\n###### Sixth\n\n' +
  emoji.map((value, i) => `<span class="emoji-${i}">${value}</span>`).join(' ') +
  '\n\n<span class="korean">한글</span> <span class="plain">ABC 0123456789 # *</span>\n\n' +
  '`😀`\n\n[Link](https://example.com)';
let browser;
const evidence = {browser:'', javascriptEnabled:false, emoji, runs:[]};
try {
  browser = await puppeteer.launch({executablePath:await localChromePath(), userDataDir:profile,
    headless:true, args:process.env.MARKDOWN_PDF_LOCAL_NO_SANDBOX === '1' ? ['--disable-gpu', '--no-sandbox'] : []});
  evidence.browser = await browser.version();
  for (const bundledOnly of [false, true]) {
    const page = await browser.newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', request => { void (allowPdfRequest(request) ? request.continue() : request.abort()).catch(() => {}); });
      await page.emulateMediaType('print');
      let html = await buildMarkdownPdfHtml({title:'Bundled emoji font verification', theme:'sprinkles', content});
      if (bundledOnly) {
        const original = html.match(/<style>([\s\S]*?)<\/style>/)[1];
        const styles = original + '\nbody, .md-doc[data-md-theme], .md-doc[data-md-theme] *, .md-doc[data-md-theme] *::before, .md-doc[data-md-theme] *::after {font-family:"PDF Korean","PDF Emoji" !important;}';
        html = html.replace(original, () => styles).replace(/style-src 'sha256-[^']+'/,
          `style-src 'sha256-${createHash('sha256').update(styles).digest('base64')}'`);
      }
      await page.setContent(html, {waitUntil:'networkidle0'});
      // Printing waits for fonts and also exercises Chromium's colour PDF path.
      await page.pdf({path:fileURLToPath(new URL(`emoji-font-check-${bundledOnly ? 'bundled-only' : 'theme'}.pdf`, output)), printBackground:true, preferCSSPageSize:true});
      const cdp = await page.createCDPSession();
      await cdp.send('DOM.enable');
      await cdp.send('CSS.enable');
      const {root} = await cdp.send('DOM.getDocument');
      const run = {bundledOnly, nodes:[]};
      const check = async (selector, family, pseudo = false) => {
        let {nodeId} = await cdp.send('DOM.querySelector', {nodeId:root.nodeId, selector});
        if (pseudo) {
          const {node} = await cdp.send('DOM.describeNode', {nodeId, depth:1});
          nodeId = node.pseudoElements?.find(item => item.pseudoType === 'before')?.nodeId;
          assert.ok(nodeId, `${selector}::before exists`);
        }
        const {fonts} = await cdp.send('CSS.getPlatformFontsForNode', {nodeId});
        const label = selector + (pseudo ? '::before' : '');
        run.nodes.push({selector:label, fonts});
        assert.ok(fonts.some(font => font.familyName === family && font.isCustomFont && font.glyphCount > 0), `${label}: ${JSON.stringify(fonts)}`);
        if (family === 'Noto Color Emoji') assert.ok(fonts.every(font => font.isCustomFont || !font.glyphCount), `${label} used a system font`);
        return fonts;
      };
      for (let i = 0; i < emoji.length; i++) await check(`.emoji-${i}`, 'Noto Color Emoji');
      for (const selector of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a']) await check(selector, 'Noto Color Emoji', true);
      await check('code', 'Noto Color Emoji');
      await check('.korean', 'Wanted Sans Medium');
      if (bundledOnly) {
        const fonts = await check('.plain', 'Wanted Sans Medium');
        assert.ok(fonts.every(font => font.familyName === 'Wanted Sans Medium'), 'Plain Latin/digits must retain the text font');
      }
      await page.screenshot({path:fileURLToPath(new URL(`emoji-font-check-${bundledOnly ? 'bundled-only' : 'theme'}.png`, output)), fullPage:true});
      evidence.runs.push(run);
      console.log(`${bundledOnly ? 'Bundled fonts only' : 'Production theme stacks'}: ${run.nodes.length} glyph-provider checks passed`);
    } finally { await page.close(); }
  }
  await writeFile(new URL('emoji-font-check.json', output), JSON.stringify(evidence, null, 2) + '\n');
} finally {
  if (browser) await browser.close();
  await rm(profile, {recursive:true, force:true});
}
