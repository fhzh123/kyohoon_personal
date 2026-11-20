// Re-tones the research journal's legacy navy surfaces to the neutral Work palette.
// The legacy stylesheets hard-code hundreds of blue-grey hex values. Instead of editing
// them, this script reads them and writes `work-app/research-tone.css`: the same
// selectors and declarations, with only the low-chroma blue hues desaturated (lightness
// and alpha kept). Accents, category and status colours are left untouched.
// `node scripts/build-research-tone.mjs` writes the file; `--check` only verifies it.
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';

const root = fileURLToPath(new URL('../', import.meta.url));
// Every stylesheet the research page loads, in the page's order, so the copied colour
// declarations keep the same cascade among themselves.
const SOURCES = ['work-app/workspace.bundle.css', 'public/theme.css', 'public/typography.css', 'public/taste.css', 'public/atmosphere.css', 'public/space-navigation.css', 'public/work-shell.css'];
const OUTPUT = 'work-app/research-tone.css';
// One id-level bump for every copied selector: each copy beats its original while the
// copies keep their original order among themselves. The shared sidebar and top bar
// stay on their own tokens.
const BUMP = ':not(#ws-tone):not(.ws-sidebar *, .ws-topbar *)';
// Every declaration of these properties is copied, re-toned or not, so a light-mode
// base rule never outranks a dark-mode rule that happened to need no change.
const COLOR_PROPS = /^(--|color$|background|border(?!-(radius|width|style|collapse|spacing|image-(width|outset|slice|repeat)))|outline(?!-(offset|width|style))|box-shadow$|text-shadow$|fill$|stroke$|caret-color$|accent-color$|text-decoration-color$|text-decoration$|scrollbar-color$|column-rule)/;

const srgbToLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklch([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map(v => srgbToLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360};
}

function fromOklch({L, C, H}) {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(v => Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255));
}

// Navy and blue-grey surfaces, borders and muted text. Saturated blues (accents,
// the primary button, category colours) have far higher chroma and stay as they are.
function neutral(rgb) {
  const c = toOklch(rgb);
  const bluish = c.H >= 205 && c.H <= 290;
  const limit = c.L > 0.82 ? 0.03 : 0.075;
  if (!bluish || c.C < 0.012 || c.C > limit) return null;
  return fromOklch({L: c.L, C: Math.min(c.C, 0.009), H: 255});
}

const hex2 = n => n.toString(16).padStart(2, '0');
const COLOR = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+%?))?\s*\)/gi;

export function retone(value) {
  let changed = false;
  const next = value.replace(COLOR, (match, hex, r, g, b, alpha) => {
    let rgb, tail = '';
    if (hex) {
      const full = hex.length <= 4 ? [...hex].map(ch => ch + ch).join('') : hex;
      rgb = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
      tail = full.slice(6);
    } else rgb = [r, g, b].map(Number);
    const out = neutral(rgb);
    if (!out) return match;
    changed = true;
    if (hex) return '#' + out.map(hex2).join('') + tail;
    return alpha ? `rgba(${out.join(',')},${alpha})` : `rgb(${out.join(',')})`;
  });
  return changed ? next : null;
}

// The bump has to sit before any pseudo-element (::placeholder, ::-webkit-scrollbar-thumb:hover).
const PSEUDO_ELEMENT = /::|:(?:before|after|first-line|first-letter)(?![\w-])/i;

export function scopeSelector(selector) {
  const s = selector.trim();
  const at = s.search(PSEUDO_ELEMENT);
  return at < 0 ? s + BUMP : s.slice(0, at) + BUMP + s.slice(at);
}

export async function buildTone() {
  const out = postcss.root();
  for (const file of SOURCES) {
    const css = await readFile(path.join(root, file), 'utf8');
    postcss.parse(css, {from: file}).walkRules(rule => {
      if (rule.parent?.type === 'atrule' && /keyframes/i.test(rule.parent.name)) return;
      // The page background belongs to background.css (the image chosen in 설정 > 배경). A bumped
      // copy here would outrank it and pin the research page to the default sky.
      if (rule.selector.includes('.ambient-sky')) return;
      const decls = [];
      rule.each(node => {
        if (node.type !== 'decl' || !COLOR_PROPS.test(node.prop)) return;
        decls.push(node.clone({value: retone(node.value) ?? node.value}));
      });
      if (!decls.length) return;
      const selectors = rule.selectors.map(scopeSelector);
      let target = out;
      // Rebuild the @media/@supports chain around the rule.
      const chain = [];
      for (let p = rule.parent; p && p.type === 'atrule'; p = p.parent) chain.unshift(p);
      for (const at of chain) {
        const key = `${at.name} ${at.params}`;
        let found = target.last?.type === 'atrule' && `${target.last.name} ${target.last.params}` === key ? target.last : null;
        if (!found) { found = postcss.atRule({name: at.name, params: at.params}); target.append(found); }
        target = found;
      }
      target.append(postcss.rule({selector: selectors.join(',\n'), nodes: decls}));
    });
  }
  const header = '/* Generated by scripts/build-research-tone.mjs from the research page stylesheets. Do not edit. */\n';
  return header + out.toString().replace(/\n{2,}/g, '\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const next = await buildTone();
  const target = path.join(root, OUTPUT);
  if (process.argv.includes('--check')) {
    const current = await readFile(target, 'utf8').catch(() => '');
    if (current !== next) { console.error('research-tone.css is out of date. Run node scripts/build-research-tone.mjs'); process.exit(1); }
    console.log('Research tone is in sync.');
  } else {
    await writeFile(target, next);
    console.log(`Research tone written: ${next.length} bytes.`);
  }
}
