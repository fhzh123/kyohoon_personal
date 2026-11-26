"""Encode completed Blender PNGs without resizing or changing the sources.

Requires Python 3.10+ and Pillow 13.0.0 with WebP (tested: libwebp 1.6.0):
  python -m pip install Pillow==13.0.0
  python scripts/encode-mascot.py --compare --report /tmp/mascot-report.json
  python scripts/encode-mascot.py --compare --comparison-dir /tmp/mascot-review

Outputs public/mascot/play/*.webp by default; contact sheets are excluded. Q90,
method=6, alpha_quality=100 is the delivery default. --lossless preserves all
RGBA bytes, including invisible RGB, using quality=75 (compression effort,
not image quality). Lossy output discards invisible RGB only.
--compare measures Q80/85/90/95 and lossless without writing their variants.
PSNR/RMSE cover visible pixels composited over white and dark backgrounds;
transparent padding is excluded. Edge RMSE covers partial-alpha pixels only.
Comparison sheets show native-resolution crops and full images at 256px.
Use identical Pillow/libwebp versions for byte-for-byte reproducibility.
WebP options: https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#webp
"""

import argparse
import hashlib
import io
import json
import math
import platform
from pathlib import Path

try:
    import PIL
    from PIL import Image, ImageChops, ImageDraw, ImageStat, features
except ImportError as exc:
    raise SystemExit("Install Pillow: python -m pip install Pillow==13.0.0") from exc


ROOT = Path(__file__).resolve().parents[1]
EXPECTED = (
    "idle", "idle-inhale", "blink", "wave-up", "wave1", "wave-mid", "wave2", "wave-down",
    "poke", "poke-recover", "pet", "pet-nuzzle", "look", "reach",
    "eat1", "eat2", "happy", "snack",
)
BACKGROUNDS = {"white": (255, 255, 255), "dark": (24, 24, 32)}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encode(image, quality, lossless):
    stream = io.BytesIO()
    image.save(stream, "WEBP", quality=quality, lossless=lossless,
               method=6, alpha_quality=100, exact=lossless,
               icc_profile=image.info.get("icc_profile", b""))
    data = stream.getvalue()
    with Image.open(io.BytesIO(data)) as decoded:
        result = decoded.convert("RGBA")
    if image.size != result.size:
        raise ValueError("WebP dimensions changed")
    if image.getchannel("A").tobytes() != result.getchannel("A").tobytes():
        raise ValueError("WebP alpha is not pixel-exact")
    if lossless and image.tobytes() != result.tobytes():
        raise ValueError("Lossless WebP RGBA is not pixel-exact")
    return data, result


def composite(image, background):
    base = Image.new("RGBA", image.size, (*background, 255))
    return Image.alpha_composite(base, image).convert("RGB")


def rmse(diff, mask):
    if mask.getbbox() is None:
        return None
    stats = ImageStat.Stat(diff, mask)
    return math.sqrt(sum(stats.sum2) / sum(stats.count))


def metrics(source, decoded):
    alpha = source.getchannel("A")
    visible = alpha.point(lambda a: 255 if a else 0)
    edge = alpha.point(lambda a: 255 if 0 < a < 255 else 0)
    result = {"alpha_exact": True, "rgba_exact": source.tobytes() == decoded.tobytes()}
    for name, color in BACKGROUNDS.items():
        diff = ImageChops.difference(composite(source, color), composite(decoded, color))
        error = rmse(diff, visible)
        edge_error = rmse(diff, edge)
        result[name] = {
            "visible_rmse": round(error, 6) if error is not None else None,
            # null denotes zero error (infinite PSNR), or no visible pixels.
            "visible_psnr_db": round(20 * math.log10(255 / error), 6) if error else None,
            "edge_rmse": round(edge_error, 6) if edge_error is not None else None,
        }
    return result


def comparison_sheet(path, source, variants):
    images = [("PNG", source)] + [(name, image) for name, image in variants.items()]
    tile, label = 256, 24
    sheet = Image.new("RGB", (tile * len(images), (tile + label) * 4), "#eeeeee")
    draw = ImageDraw.Draw(sheet)
    box = source.getchannel("A").getbbox()
    if box is None:
        box = (0, 0, *source.size)
    center_x = (box[0] + box[2]) // 2
    # Top third emphasizes face/helmet and anti-aliased silhouette at 1:1.
    center_y = box[1] + (box[3] - box[1]) // 3
    crop = (center_x - tile // 2, center_y - tile // 2,
            center_x + tile // 2, center_y + tile // 2)
    for row, (bg_name, color) in enumerate(BACKGROUNDS.items()):
        for column, (name, image) in enumerate(images):
            for detail in (False, True):
                y = (row * 2 + int(detail)) * (tile + label)
                x = column * tile
                draw.text((x + 5, y + 5), f"{name} / {bg_name} / {'1:1 crop' if detail else '256px'}", fill="black")
                frame = composite(image, color)
                if detail:
                    frame = composite(image.crop(crop), color)
                else:
                    frame.thumbnail((tile, tile), Image.Resampling.LANCZOS)
                sheet.paste(color, (x, y + label, x + tile, y + label + tile))
                sheet.paste(frame, (x + (tile-frame.width)//2, y + label + (tile-frame.height)//2))
    sheet.save(path)


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input-dir", type=Path, default=ROOT / "artifacts/mascot-frames")
    parser.add_argument("--output-dir", type=Path, help="Default: public/mascot/play")
    parser.add_argument("--expect", nargs="+", default=EXPECTED, metavar="STEM", help="Required pose stems; missing files abort the whole batch")
    parser.add_argument("--quality", type=int, choices=range(101), default=90, metavar="0..100")
    parser.add_argument("--lossless", action="store_true", help="Preserve every RGBA byte; quality becomes 75 (compression effort)")
    parser.add_argument("--compare", action="store_true")
    parser.add_argument("--report", type=Path, help="Optional JSON report (must end in .json)")
    parser.add_argument("--comparison-dir", type=Path, help="Optional visual QA PNGs outside the input directory; implies --compare")
    args = parser.parse_args()
    if args.report and args.report.suffix.lower() != ".json":
        parser.error("--report must end in .json")
    args.input_dir = args.input_dir.resolve()
    args.output_dir = (args.output_dir or ROOT / "public/mascot/play").resolve()
    if args.comparison_dir:
        args.comparison_dir = args.comparison_dir.resolve()
        if args.comparison_dir == args.input_dir:
            parser.error("--comparison-dir must differ from --input-dir")
        args.compare = True
    return args


def main():
    args = parse_args()
    if not features.check("webp"):
        raise ValueError("This Pillow build has no WebP support")
    paths = sorted(p for p in args.input_dir.glob("*.png") if "contact" not in p.stem.lower())
    missing = sorted(set(args.expect) - {p.stem for p in paths})
    if missing:
        raise ValueError("Render batch incomplete; missing PNGs: " + ", ".join(missing))
    if not paths:
        raise ValueError("No source PNGs")
    # Snapshot the entire batch before writing. Recheck on completion so a
    # concurrent Blender render cannot silently produce a mixed-version batch.
    snapshots = {path: path.read_bytes() for path in paths}
    sources = {}
    for path, data in snapshots.items():
        with Image.open(io.BytesIO(data)) as image:
            if image.format != "PNG" or getattr(image, "n_frames", 1) != 1:
                raise ValueError(f"Expected a single-frame PNG: {path}")
            sources[path] = image.convert("RGBA")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if args.comparison_dir:
        args.comparison_dir.mkdir(parents=True, exist_ok=True)
    quality = 75 if args.lossless else args.quality
    selected = "lossless" if args.lossless else f"q{quality}"
    settings = {selected: (quality, args.lossless)}
    if args.compare:
        settings.update({f"q{q}": (q, False) for q in (80, 85, 90, 95)})
        settings["lossless"] = (75, True)
    report = {
        "python": platform.python_version(), "pillow": PIL.__version__,
        "libwebp": features.version("webp"), "selected": selected,
        "method": 6, "alpha_quality": 100, "exact": args.lossless,
        "metric_scope": "alpha>0 pixels; white and RGB(24,24,32) composites; edge: 0<alpha<255; PSNR null means zero error or empty mask",
        "files": [], "totals": {},
    }
    pending_outputs = {}
    for path, image in sources.items():
        row = {"file": path.name, "png_bytes": len(snapshots[path]),
               "png_sha256": digest(snapshots[path]), "size": list(image.size), "variants": {}}
        decoded_variants = {}
        for name, (q, lossless) in settings.items():
            data, decoded = encode(image, q, lossless)
            row["variants"][name] = {"bytes": len(data), "sha256": digest(data),
                                      "quality": q, "lossless": lossless, "exact": lossless,
                                      **metrics(image, decoded)}
            decoded_variants[name] = decoded
            if name == selected:
                pending_outputs[args.output_dir / (path.stem + ".webp")] = data
        if args.comparison_dir:
            comparison_sheet(args.comparison_dir / (path.stem + "-comparison.png"), image, decoded_variants)
        report["files"].append(row)
        print(f"Checked {path.name}: {len(snapshots[path]):,} -> {row['variants'][selected]['bytes']:,} bytes", flush=True)
    for path, data in snapshots.items():
        if path.read_bytes() != data:
            raise ValueError(f"Source changed during encoding; rerun after Blender completes: {path}")
    if paths != sorted(p for p in args.input_dir.glob("*.png") if "contact" not in p.stem.lower()):
        raise ValueError("PNG set changed during encoding; rerun after Blender completes")
    for output, data in pending_outputs.items():
        output.write_bytes(data)
    total_png = sum(row["png_bytes"] for row in report["files"])
    print(f"Pillow {PIL.__version__}; libwebp {features.version('webp')}; {len(paths)} PNGs; alpha exact for every variant")
    for name in settings:
        total = sum(row["variants"][name]["bytes"] for row in report["files"])
        saved = total_png - total
        report["totals"][name] = {"png_bytes": total_png, "webp_bytes": total, "saved_bytes": saved, "saved_percent": round(100 * saved / total_png, 4)}
        print(f"{name:>8}: {total_png:,} -> {total:,} bytes; saved {saved:,} ({saved / total_png:.2%})")
    for row in report["files"]:
        size = row["variants"][selected]["bytes"]
        print(f"  {row['file']:<20} {row['png_bytes']:>9,} -> {size:>8,}")
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
