WantedSans-Medium.ttf is the existing Korean-capable Wanted Sans font from
https://github.com/wanteddev/wanted-sans, licensed under SIL OFL 1.1 (see
WantedSans-OFL.txt).

The Markdown PDF renderer embeds this file without changing it. It maps the
themes' Korean fallback families to this bundled face so rendering does not
depend on a font CDN or the server's installed Korean fonts. Korean serif
fallbacks also use Wanted Sans; Latin serif and monospace stacks are retained.

For local PDF samples, run `node scripts/markdown-pdf-samples.mjs`. The script
writes all theme samples under `artifacts/pdf-samples/` in this worktree.
Set `CHROME_PATH` to use a specific installed Chrome or Edge. On a restricted
Windows development host that cannot start Chromium's child sandbox, opt in
for that local run with `MARKDOWN_PDF_LOCAL_NO_SANDBOX=1`. This option is not
used by the Linux Vercel launcher.
