#!/usr/bin/env python3
"""Convert PNG/JPEG stills to AVIF and update local website references."""

import argparse
import os
from pathlib import Path
import re
import tempfile

try:
    from PIL import Image, ImageOps
except ImportError:
    raise SystemExit("Install the dependency: python3 -m pip install 'Pillow>=11.3'")


ROOT = Path(__file__).resolve().parent.parent
SOURCE_TYPES = {".png", ".jpg", ".jpeg"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path, help="Image files or folders within this repository")
    parser.add_argument("--quality", type=int, default=80, help="AVIF quality, 0–100 (default: 80)")
    parser.add_argument("--remove-originals", action="store_true", help="Delete sources after conversion and reference updates")
    args = parser.parse_args()
    if not 0 <= args.quality <= 100:
        parser.error("--quality must be between 0 and 100")
    if "AVIF" not in Image.registered_extensions().values():
        parser.error("Pillow needs AVIF support; install Pillow>=11.3")

    sources = set()
    for path in args.paths:
        path = path.resolve()
        if not path.is_relative_to(ROOT) or not path.exists():
            parser.error(f"Path must exist within the repository: {path}")
        candidates = path.rglob("*") if path.is_dir() else [path]
        sources.update(p for p in candidates if p.is_file() and p.suffix.lower() in SOURCE_TYPES)

    # Refuse collisions up front so unrelated images cannot be overwritten.
    destinations = set()
    for source in sorted(sources):
        target = source.with_suffix(".avif")
        if target.exists() or target in destinations:
            parser.error(f"Destination already exists or is ambiguous: {target}")
        destinations.add(target)

    converted = []
    for source in sorted(sources):
        target = source.with_suffix(".avif")
        with Image.open(source) as original:
            if getattr(original, "n_frames", 1) > 1:
                parser.error(f"Animated images are not supported: {source}")
            image = ImageOps.exif_transpose(original)
            mode = "RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB"
            image = image.convert(mode)
            with tempfile.NamedTemporaryFile(dir=target.parent, suffix=".avif", delete=False) as temporary:
                temp_path = Path(temporary.name)
            try:
                image.save(temp_path, format="AVIF", quality=args.quality, speed=6)
                with Image.open(temp_path) as check:
                    check.load()
                    if check.size != image.size:
                        raise ValueError(f"Unexpected output dimensions for {source}")
                temp_path.replace(target)
            finally:
                temp_path.unlink(missing_ok=True)
        converted.append((source, target))
        print(f"{source.relative_to(ROOT)} -> {target.relative_to(ROOT)} ({target.stat().st_size:,} bytes)")

    # Handle relative, root-relative, and absolute site URLs without changing dimensions.
    for document in sorted(ROOT.rglob("*")):
        if document.suffix.lower() not in {".html", ".css", ".js"} or any(
            part.startswith(".") or part == "node_modules" for part in document.relative_to(ROOT).parts
        ):
            continue
        content = document.read_text()
        updated = content
        for source, target in converted:
            forms = [
                (Path(os.path.relpath(source, document.parent)).as_posix(), Path(os.path.relpath(target, document.parent)).as_posix()),
                ("/" + source.relative_to(ROOT).as_posix(), "/" + target.relative_to(ROOT).as_posix()),
            ]
            for old, new in forms:
                updated = re.sub(re.escape(old) + r"(?=[\s\"'?#)<]|$)", lambda match: new, updated)
        if updated != content:
            document.write_text(updated)
            print(f"Updated references: {document.relative_to(ROOT)}")

    if args.remove_originals:
        for source, _ in converted:
            source.unlink()
    print(f"Converted {len(converted)} image(s).")


if __name__ == "__main__":
    main()
