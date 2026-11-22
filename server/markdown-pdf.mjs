import {readFile, access, mkdir, mkdtemp, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import {createMarkdownEngine} from '../public/markdown-renderer.js';
import {DEFAULT_MARKDOWN_THEME, MARKDOWN_THEME_KEYS} from '../views/markdown-themes.mjs';

const engine = createMarkdownEngine(MarkdownIt);
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
let assetsPromise;
let browserPromise;

export function pdfDisposition(title) {
  const name = String(title || 'document').replace(/[\x00-\x1f\x7f/\\]/g, '_').toWellFormed() + '.pdf';
  const encoded = encodeURIComponent(name).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="document.pdf"; filename*=UTF-8''${encoded}`;
}

function assets() {
  return assetsPromise ||= Promise.all([
    readFile(new URL('../public/markdown-themes.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/fonts/WantedSans-Medium.ttf', import.meta.url)),
  ]).then(([css, font]) => ({css, font:font.toString('base64')})).catch(error => { assetsPromise = undefined; throw error; });
}

export async function buildMarkdownPdfHtml({title = '', content = '', theme = DEFAULT_MARKDOWN_THEME}) {
  if (!MARKDOWN_THEME_KEYS.includes(theme)) throw new Error('Unknown Markdown theme');
  const {css, font} = await assets();
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
  const fonts = `@font-face{font-family:"PDF Korean";src:url(data:font/ttf;base64,${font}) format("truetype");font-weight:400;font-style:normal;font-display:block;}`;
  // Chromium clones this block's padding onto every page fragment; the
  // theme's html/body print backgrounds fill the entire page canvas, including
  // the empty space below the final fragment. Override browser-print margins.
  const styles = `${fonts}\n${css.replace(families, '"PDF Korean"')}
@page { size:A4 portrait; margin:0; }
html, body { margin:0 !important; padding:0 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:"PDF Korean",sans-serif; }
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
    return puppeteer.launch({args:chromium.args.filter(arg => arg !== '--single-process'), executablePath:await chromium.executablePath(), headless:'shell', timeout:25000, protocolTimeout:25000});
  }
  const dir = fileURLToPath(new URL('../artifacts/', import.meta.url));
  await mkdir(dir, {recursive:true});
  const profile = await mkdtemp(path.join(dir, 'markdown-chrome-'));
  try {
    const browser = await puppeteer.launch({executablePath:await localChromePath(), userDataDir:profile,
      args:process.env.MARKDOWN_PDF_LOCAL_NO_SANDBOX === '1' ? ['--disable-gpu', '--no-sandbox'] : [],
      headless:true, timeout:25000, protocolTimeout:25000});
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

export function createMarkdownPdfRenderer({getBrowser = warmBrowser, timeout = 25000} = {}) {
  return async document => {
    let context, timer, expired = false;
    const work = (async () => {
      const html = await buildMarkdownPdfHtml(document);
      const browser = await getBrowser();
      if (expired) throw new Error('PDF timeout');
      context = await browser.createBrowserContext();
      if (expired) { await context.close(); throw new Error('PDF timeout'); }
      const page = await context.newPage();
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on('request', request => {
        void (allowPdfRequest(request) ? request.continue() : request.abort()).catch(() => {});
      });
      await page.emulateMediaType('print');
      await page.setContent(html, {waitUntil:'networkidle0', timeout});
      return Buffer.from(await page.pdf({format:'A4', preferCSSPageSize:true, printBackground:true, displayHeaderFooter:false, margin:{top:0, right:0, bottom:0, left:0}, timeout}));
    })();
    try {
      return await Promise.race([work, new Promise((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(new Error('PDF timeout')); }, timeout);
      })]);
    } finally {
      clearTimeout(timer);
      // Closing the isolated context closes every page, including failed loads.
      if (context) await context.close().catch(() => {});
    }
  };
}

export const renderMarkdownPdf = createMarkdownPdfRenderer();
