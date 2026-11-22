WantedSans-Medium.ttf is the existing Korean-capable Wanted Sans font from
https://github.com/wanteddev/wanted-sans, licensed under SIL OFL 1.1 (see
WantedSans-OFL.txt).

The Markdown PDF renderer embeds this file without changing it. It maps the
themes' Korean fallback families to this bundled face so rendering does not
depend on a font CDN or the server's installed Korean fonts. Korean serif
fallbacks also use Wanted Sans; Latin serif and monospace stacks are retained.

Noto-COLRv1.ttf is the unmodified, full-colour 2D Noto Color Emoji font from
the official googlefonts/noto-emoji release:

- Release: https://github.com/googlefonts/noto-emoji/releases/tag/v2026-09-24-unicode18_0
- Font version: 2.057 (Unicode 18.0), internal version string
  `Version 2.057;GOOG;noto-emoji:20260911:fc4ca365e7c20e78278ae702aa20434bfe704c8f`.
- Exact source: https://raw.githubusercontent.com/googlefonts/noto-emoji/v2026-09-24-unicode18_0/2D/fonts/Noto-COLRv1.ttf
- Size: 5,038,236 bytes (4.805 MiB).
- SHA-256: `b8e25ea68db82f9e4d0aee921f4420be2be39887bd5c893a2ad98710531f9d0c`.
- Licence: SIL Open Font License 1.1; the upstream font licence is copied
  verbatim in NotoColorEmoji-OFL.txt from
  https://raw.githubusercontent.com/googlefonts/noto-emoji/v2026-09-24-unicode18_0/2D/fonts/LICENSE.

This is the smallest complete standalone colour build in that release:
the CBDT NotoColorEmoji.ttf is 10,730,124 bytes, and the COLRv1 emojicompat
build is 5,233,108 bytes. The smaller noflags and flagsonly builds each omit
required emoji (including the Korean flag or ordinary emoji respectively).
COLRv1 is supported by the pinned Chromium 153 PDF renderer. No font
conversion, subsetting, CDN access or system font installation is required.

The PDF embeds it as the data-URL webfont "PDF Emoji", restricted to emoji
codepoints and sequence components with unicode-range. Every theme's Korean
fallback is paired with this face, including stacks inherited by generated
heading/link prefixes. Text fonts precede emoji so ordinary digits, # and *
keep their text appearance while keycap sequences can use Noto. Body uses
the same pair. The font CSP already allows data URLs; Vercel's public/**
includeFiles rule ships both fonts and their licences in the function bundle.

For local PDF samples, run `node scripts/markdown-pdf-samples.mjs`. The script
writes all theme samples under `artifacts/pdf-samples/` in this worktree.
Pass `sprinkles` to regenerate just that theme; either run also writes the
typed-emoji.md / typed-emoji.pdf example with flags and skin-tone sequences.
Run `node scripts/markdown-pdf-font-check.mjs` for CDP glyph-provider checks
with JavaScript disabled, including a second render restricted to the two
bundled families. It saves the evidence JSON, PDFs and screenshots beside
the samples and fails if a system emoji font supplies any tested glyph.
Set `CHROME_PATH` to use a specific installed Chrome or Edge. On a restricted
Windows development host that cannot start Chromium's child sandbox, opt in
for that local run with `MARKDOWN_PDF_LOCAL_NO_SANDBOX=1`. This option is not
used by the Linux Vercel launcher.
