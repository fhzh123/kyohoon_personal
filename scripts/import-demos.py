"""Import the published demo folders without changing their source files."""
import base64
import gzip
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = re.compile(r'data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)')

def import_demo(slug, source):
    destination = ROOT / 'work-demos' / slug
    destination.mkdir(parents=True, exist_ok=True)
    originals = {}
    for source_file in sorted(source.rglob('*.html')):
        relative = source_file.relative_to(source)
        raw = source_file.read_bytes()
        originals[str(relative)] = hashlib.sha256(raw).hexdigest()
        html = raw.decode('utf-8')
        def image(match):
            data = base64.b64decode(match[2], validate=True)
            ext = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg'}[match[1]]
            name = 'resources/' + hashlib.sha256(data).hexdigest()[:24] + '.' + ext
            path = destination / name
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(data)
            return '/work/demos/' + slug + '/' + name
        html = IMAGE.sub(image, html)
        # Preserve the original synchronous JSON consumers, with each response
        # safely below Vercel's function payload limit even without compression.
        def split_json(match):
            data = match[2]
            if len(data.encode('utf-8')) < 1_000_000:
                return match[0]
            identifier = re.search(r'\bid="([^"]+)"', match[1])[1]
            scripts = []
            for i, start in enumerate(range(0, len(data), 300_000)):
                chunk = data[start:start + 300_000]
                name = f'resources/{identifier}-{i:02}.js'
                code = 'document.getElementById(' + json.dumps(identifier) + ').textContent+=' + json.dumps(chunk, ensure_ascii=False) + ';\n'
                (destination / name).write_text(code)
                scripts.append('<script src="/work/demos/' + slug + '/' + name + '"></script>')
            return '<script' + match[1] + '></script>' + ''.join(scripts)
        html = re.sub(r'<script([^>]*\btype="application/json"[^>]*)>([\s\S]*?)</script>', split_json, html)
        path = destination / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html)
    for path in destination.rglob('*'):
        if path.suffix in ['.html', '.js']:
            path.with_suffix(path.suffix + '.gz').write_bytes(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))
    return {'source_sha256': originals, 'files': len(list(destination.rglob('*')))}

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit('Usage: python3 scripts/import-demos.py DOCUMENT_PARSING_DIST ONTOLOGY_DIST')
    report = {slug: import_demo(slug, Path(source)) for slug, source in zip(['document-parsing', 'ontology'], sys.argv[1:])}
    (ROOT / 'work-demos' / 'sources.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, indent=2))
