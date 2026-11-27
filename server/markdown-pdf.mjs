import {readFile, access, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {buffer} from 'node:stream/consumers';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import {createMarkdownEngine} from '../public/markdown-renderer.js';
import {DEFAULT_MARKDOWN_THEME, MARKDOWN_THEME_KEYS} from '../views/markdown-themes.mjs';

const engine = createMarkdownEngine(MarkdownIt);
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
let assetsPromise;
let browserPromise;
const LAUNCH_TIMEOUT = 25000;
const RENDER_TIMEOUT = 90000;
const PROTOCOL_TIMEOUT = RENDER_TIMEOUT + 10000;

export function pdfDisposition(title) {
  const name = String(title || 'document').replace(/[\x00-\x1f\x7f/\\]/g, '_').toWellFormed() + '.pdf';
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="document.pdf"; filename*=UTF-8''${encoded}`;
}

function assets() {
  return assetsPromise ||= Promise.all([
    readFile(new URL('../public/markdown-themes.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/fonts/WantedSans-Medium.ttf', import.meta.url)),
    readFile(new URL('../public/fonts/Noto-COLRv1.ttf', import.meta.url)),
  ]).then(([css, font, emoji]) => ({css, font:font.toString('base64'), emoji:emoji.toString('base64')})).catch(error => { assetsPromise = undefined; throw error; });
}

export async function buildMarkdownPdfHtml({title = '', content = '', theme = DEFAULT_MARKDOWN_THEME}) {
  if (!MARKDOWN_THEME_KEYS.includes(theme)) throw new Error('Unknown Markdown theme');
  const {css, font, emoji} = await assets();
  // Match the preview's safe formatting subset. In particular, user CSS and
  // document-level tags must never override the trusted page layout or CSP.
  const html = sanitizeHtml(engine.render(content || ''), {
    allowedTags:[...sanitizeHtml.defaults.allowedTags, 'img', 'input', 'del', 's', 'u', 'details', 'summary', 'figure', 'figcaption', 'mark', 'sub', 'sup'],
    allowedAttributes:{
      '*':['class', 'title', 'dir', 'lang'], a:['href', 'title'], img:['src', 'alt', 'title', 'width', 'height'],
      input:['type', 'checked', 'disabled', 'class'], th:['colspan', 'rowspan', 'align'], td:['colspan', 'rowspan', 'align'],
      ol:['start', 'reversed'], li:['value'], details:['open'],
    },
    allowedSchemes:['http', 'https', 'mailto'], allowedSchemesByTag:{img:['http', 'https', 'data']},
    allowProtocolRelative:false,
    transformTags:{input:(_tag, attrs) => ({tagName:'input', attribs:{...attrs, disabled:''}})},
    exclusiveFilter:frame => frame.tag === 'input' && frame.attribs.type !== 'checkbox',
  });
  // These names cover all Korean fallbacks in markdown-themes.css. A single
  // bundled face is reused; Latin serif/mono choices remain available locally.
  const families = /"(?:Pretendard Variable|Pretendard|Noto Sans KR|Noto Serif KR|Source Han Serif KR|Nanum Myeongjo|AppleMyungjo|Batang|D2Coding|Apple SD Gothic Neo|Malgun Gothic)"/g;
  // Include sequence components: keycap bases, ZWJ, selectors and flag tags.
  // Keep this face AFTER text fonts so plain digits/#/* retain their glyphs.
  const emojiRange = 'U+0023,U+002A,U+0030-0039,U+00A9,U+00AE,U+200D,U+203C,U+2049,U+20E3,U+2122,U+2139,U+2194-2199,U+21A9-21AA,U+2300-23FF,U+24C2,U+25AA-25AB,U+25B6,U+25C0,U+25FB-27BF,U+2934-2935,U+2B00-2BFF,U+3030,U+303D,U+3297,U+3299,U+FE0E-FE0F,U+1F000-1FAFF,U+E0020-E007F';
  const fonts = `@font-face{font-family:"PDF Korean";src:url(data:font/ttf;base64,${font}) format("truetype");font-weight:400;font-style:normal;font-display:block;}
@font-face{font-family:"PDF Emoji";src:url(data:font/ttf;base64,${emoji}) format("truetype");font-weight:400;font-style:normal;font-display:block;unicode-range:${emojiRange};}`;
  // Every theme stack has a Korean fallback. Pair it with emoji before the
  // generic/system fallback, including stacks inherited by ::before/::after.
  const themeCss = css.replace(families, '"PDF Korean","PDF Emoji"');
  // Chromium clones this block's padding onto every page fragment; the
  // theme's html/body print backgrounds fill the entire page canvas, including
  // the empty space below the final fragment. Override browser-print margins.
  const styles = `${fonts}\n${themeCss}
@page { size:A4 portrait; margin:0; }
html, body { margin:0 !important; padding:0 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:"PDF Korean","PDF Emoji",sans-serif; }
.md-doc[data-md-theme] { width:100%; max-width:none; margin:0; padding:20mm; box-decoration-break:clone; -webkit-box-decoration-break:clone; border:0; border-radius:0; box-shadow:none; }
.md-doc[data-md-theme] img { max-width:100%; max-height:240mm; object-fit:contain; }
.md-doc[data-md-theme] table { max-width:100%; overflow-wrap:anywhere; }
.md-doc[data-md-theme] pre { white-space:pre-wrap; overflow-wrap:anywhere; }
`;
  const styleHash = createHash('sha256').update(styles).digest('base64');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'sha256-${styleHash}'; font-src data:; img-src data: http: https:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="markdown-pdf-javascript" content="disabled"><meta name="referrer" content="no-referrer"><title>${escape(title)}</title>
<style>${styles}</style></head><body><article class="md-doc" data-md-theme="${theme}">${html}</article></body></html>`;
}

export function allowPdfRequest(request) {
  if (request.isNavigationRequest()) return false;
  const url = request.url();
  return url.startsWith('data:') || (request.resourceType() === 'image' && /^https?:\/\//i.test(url));
}

export async function localChromePath(environment = process.env) {
  if (environment.CHROME_PATH) { await access(environment.CHROME_PATH); return environment.CHROME_PATH; }
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    ...(environment.LOCALAPPDATA ? [path.join(environment.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe')] : []),
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} }
  throw new Error('Chrome not found. Set CHROME_PATH to an installed Chrome or Edge executable.');
}

async function launchBrowser() {
  const {default:puppeteer} = await import('puppeteer-core');
  if (process.env.VERCEL && process.platform === 'linux') {
    const {default:chromium} = await import('@sparticuz/chromium');
    return puppeteer.launch({args:chromium.args.filter(arg => arg !== '--single-process'), executablePath:await chromium.executablePath(), headless:'shell', timeout:LAUNCH_TIMEOUT, protocolTimeout:PROTOCOL_TIMEOUT});
  }
  const dir = fileURLToPath(new URL('../artifacts/', import.meta.url));
  await mkdir(dir, {recursive:true});
  const profile = await mkdtemp(path.join(dir, 'markdown-chrome-'));
  try {
    const browser = await puppeteer.launch({executablePath:await localChromePath(), userDataDir:profile,
      args:process.env.MARKDOWN_PDF_LOCAL_NO_SANDBOX === '1' ? ['--disable-gpu', '--no-sandbox'] : [],
      headless:true, timeout:LAUNCH_TIMEOUT, protocolTimeout:PROTOCOL_TIMEOUT});
    browser.once('disconnected', () => { void rm(profile, {recursive:true, force:true}).catch(() => {}); });
    return browser;
  } catch (error) { await rm(profile, {recursive:true, force:true}); throw error; }
}

async function warmBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser().then(browser => {
      browser.once('disconnected', () => { browserPromise = undefined; });
      return browser;
    }).catch(error => { browserPromise = undefined; throw error; });
  }
  return browserPromise;
}

export async function closeMarkdownPdfBrowser() {
  const pending = browserPromise;
  browserPromise = undefined;
  if (pending) await (await pending).close();
}

export function createMarkdownPdfRenderer({getBrowser = warmBrowser, timeout = RENDER_TIMEOUT} = {}) {
  return async document => {
    let context, stream, timer, expired = false;
    const timeoutError = new Error('PDF timeout');
    const cleanup = () => {
      clearTimeout(timer);
      const activeContext = context;
      context = undefined;
      if (activeContext) void activeContext.close().catch(() => {});
    };
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        expired = true;
        if (stream) stream.destroy(timeoutError);
        else reject(timeoutError);
      }, timeout);
    });
    const work = (async () => {
      const html = await buildMarkdownPdfHtml(document);
      if (expired) throw timeoutError;
      const browser = await getBrowser();
      if (expired) throw timeoutError;
      context = await browser.createBrowserContext();
      if (expired) { cleanup(); throw timeoutError; }
      const page = await context.newPage();
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', request => {
        void (allowPdfRequest(request) ? request.continue() : request.abort()).catch(() => {});
      });
      await page.emulateMediaType('print');
      await page.setContent(html, {waitUntil:'load', timeout});
      if (expired) throw timeoutError;
      return page.createPDFStream({format:'A4', preferCSSPageSize:true, printBackground:true, displayHeaderFooter:false, waitForFonts:true, margin:{top:0, right:0, bottom:0, left:0}, timeout});
    })();
    try {
      stream = Readable.fromWeb(await Promise.race([work, deadline]));
      // Keep the page alive until every CDP chunk has been read or the client disconnects.
      stream.once('close', cleanup);
      // The deadline can also expire before the caller starts consuming the stream.
      stream.on('error', () => {});
      return stream;
    } catch (error) {
      cleanup();
      throw error;
    }
  };
}

export const streamMarkdownPdf = createMarkdownPdfRenderer();
export const renderMarkdownPdf = async document => buffer(await streamMarkdownPdf(document));
