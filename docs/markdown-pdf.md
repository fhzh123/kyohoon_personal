# Markdown PDF downloads

`GET /api/markdown/documents/:id/pdf?theme=<key>` reads the saved document under
the caller's membership. Readers and editors can download; the theme override
does not write to the document. Omitting it uses the saved theme. The response
is an uncached attachment with a UTF-8 title filename.

`server/markdown-pdf.mjs` shares Markdown options and task lists with the preview,
sanitizes raw HTML, embeds the theme stylesheet, Wanted Sans and Noto Color Emoji,
and prints A4 using Puppeteer. JavaScript and navigation are disabled. Requests
are restricted to data resources and HTTP(S) images. The CSP authorizes only the
generated stylesheet by its SHA-256 hash. Every render has its own browser
context; the browser is reused for the lifetime of the warm function.

The PDF page uses zero page margins and cloned 20 mm article padding. Chromium
repeats that padding on each page fragment, while the theme's html/body canvas
background covers every page, including the area below the final fragment.
Header/footer printing is disabled. Text and links remain native PDF objects.

## Browsers and deployment

Vercel Linux uses `@sparticuz/chromium` 153.0.0 with `puppeteer-core` 25.11.0.
The registry's latest Puppeteer was 25.18.1 when checked; 25.11.0 is deliberately
pinned because [Puppeteer's browser table](https://pptr.dev/supported-browsers)
maps it to Chrome 153, following the
[Chromium package's compatibility guidance](https://github.com/Sparticuz/chromium#install).
`vercel.json` includes the package's compressed binaries and requests 1769 MB
memory. The Linux launch removes `--single-process` so isolated contexts work.
A render has a 25 second deadline and closes its context on success or failure.

Local runs use `CHROME_PATH` when set, otherwise common Chrome/Edge locations
on Windows, Linux and macOS. The browser sandbox stays enabled by default.
In a restricted development sandbox where Chrome cannot start, explicitly set
`MARKDOWN_PDF_LOCAL_NO_SANDBOX=1` to use its local fallback flags. This setting
has no effect on the Vercel browser selection.

Wanted Sans is embedded from the existing unmodified font file; its licence
and source are recorded in `public/fonts/`. Korean serif fallbacks also use
Wanted Sans, so Korean glyphs in those themes use a sans face. Other font
choices depend on the browser's available Latin fonts.

Emoji use the official Noto Color Emoji 2.057 COLRv1 build (5,038,236 bytes,
SIL OFL 1.1). Exact release/source URLs and the checksum are in
`public/fonts/README.md`; `NotoColorEmoji-OFL.txt` contains the upstream licence.
The smaller noflags build cannot render the Korean flag; the complete COLRv1
font is less than half the size of the complete CBDT TTF in the same release.

The trusted HTML embeds the font once as a data-URL `@font-face`, with an emoji
`unicode-range` that includes variation selectors, ZWJ, skin tones, regional
indicators, tag sequences and keycap bases. Each theme's Korean fallback is
paired with `"PDF Emoji"` before its generic fallback. The body's stack also
includes it; generated heading/link `::before` content inherits the theme
stack. Text fonts precede emoji to preserve normal digits, # and * while
allowing keycap clusters to fall back to Noto. Korean mappings are retained.

This uses Chromium's webfont loader instead of OS font discovery/fontconfig
or `chromium.font()`. It works within the existing `font-src data:` CSP and
request interception policy, needs no network font requests or writable Linux
font cache, and applies to every isolated render context. The existing
`vercel.json` includeFiles glob includes `public/**`, so it ships the TTF.
Font assets are read on the first render; PDF/browser imports remain lazy.

## Verification

```powershell
node --test tests/*.test.mjs
node scripts/markdown-pdf-samples.mjs
node scripts/markdown-pdf-samples.mjs sprinkles
node scripts/markdown-pdf-font-check.mjs
```

The sample script produces every theme under `artifacts/pdf-samples/`, with
headings, Korean and English paragraphs, lists, tasks, quotes, code, tables,
a data URL image, links and horizontal rules across multiple pages. It closes
the shared browser when done. Optional theme arguments limit the theme samples.
It also writes `typed-emoji.pdf` and its Markdown source, including
😀 🎉 ✅ 🇰🇷 👍🏽, variation selectors, ZWJ and keycap examples. Default tests
inject fake browsers/renderers and never launch Chromium. The emoji unit test
checks the embedded bytes/checksum, unicode-range, all theme stacks and CSP.

The font-check script uses `CSS.getPlatformFontsForNode` through CDP with page
JavaScript disabled, without `page.evaluate`. It inspects typed emoji, all six
sprinkles heading prefixes, the link prefix and inline code. One pass uses the
production theme stacks; the other overrides all text/pseudo-element stacks
to ONLY `"PDF Korean","PDF Emoji"`. It requires the emoji glyphs to come from
the custom webfont `Noto Color Emoji`, and verifies Korean and plain Latin/digits
still use Wanted Sans. Results, screenshots and printed PDFs are written to
`artifacts/pdf-samples/emoji-font-check*`.

The verification run used Windows Chrome 157.0.8103.79: 18 glyph-provider checks
passed with production stacks and 19 with bundled-only stacks. All emoji probes
reported `Noto Color Emoji`, `isCustomFont: true`; neither pass relied on Segoe UI
Emoji. The saved evidence is `emoji-font-check.json`. Sprinkles and typed-emoji
samples were regenerated with the production renderer and JavaScript disabled.
The saved PDFs were independently rasterized with PDF.js 5.4.624 (all eight
sprinkles pages, the typed-emoji page and the bundled-only diagnostic page).
The rasterized typed-emoji page visibly includes the Korean flag and skin tone
in colour; PDF.js reads only the PDF's embedded resources, with system font use
disabled. Review PNGs and extracted text are saved beside the samples.

The Windows sample run in this worktree used
`$env:MARKDOWN_PDF_LOCAL_NO_SANDBOX = '1'` before running the script.
Linux/Vercel execution still needs a deployed smoke test.
