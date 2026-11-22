# Markdown PDF downloads

`GET /api/markdown/documents/:id/pdf?theme=<key>` reads the saved document under
the caller's membership. Readers and editors can download; the theme override
does not write to the document. Omitting it uses the saved theme. The response
is an uncached attachment with a UTF-8 title filename.

`server/markdown-pdf.mjs` shares Markdown options and task lists with the preview,
sanitizes raw HTML, embeds the theme stylesheet and existing Wanted Sans font,
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

## Verification

```powershell
node --test tests/*.test.mjs
node scripts/markdown-pdf-samples.mjs
```

The sample script produces every theme under `artifacts/pdf-samples/`, with
headings, Korean and English paragraphs, lists, tasks, quotes, code, tables,
a data URL image, links and horizontal rules across multiple pages. It closes
the shared browser when done. Default tests inject fake browsers/renderers
and never launch Chromium.

The Windows sample run in this worktree used
`$env:MARKDOWN_PDF_LOCAL_NO_SANDBOX = '1'` before running the script.
Linux/Vercel execution still needs a deployed smoke test.
