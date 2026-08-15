#!/usr/bin/env python3
"""Build a normalized, web-sized asset catalog without touching source assets."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT / "assets"
CATALOG = ASSETS / "catalog"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".svg"}
MAX_IMAGE_SIZE = 1800

CATALOG_README = """# YADILO Web Asset Catalog

`assets/catalog/` is the normalized web delivery layer for product imagery.

- Source files are grouped under `assets/source/` for traceability.
- Generated source maps are grouped under `assets/generated/`.
- Product photos use `series/products/product/role-id.ext`.
- Hardware uses `hardware/locks/group/name.ext`.
- PDF product galleries use `pdf-previews/{series}/{product}/page-01.jpg` through `page-04.jpg`.
- Derived UI images use `derived/...` and brand images use `brand/...`.
- Door-skin maps use `derived/{series}/door-skins/{series}-{product}-{part}.png`.
  - `double-leaf` is the single-leaf source for a double door; the main leaf is mirrored in the renderer.
  - `mother-child` and `mother-main` are the two independent leaves of a mother-and-child door.
  - `side-main` and `side-light` are the main door and side-light panels of a side-light product.
- `door-textures.json` is the semantic index for these split maps and records each source crop.
- Raster images are limited to 1800 px on the longest edge; `manifest.json` records each source/output mapping.

Regenerate the normalized web catalog and door-leaf maps:

```bash
python3 tools/build-web-asset-catalog.py
python3 tools/build-pdf-product-content.py
```

Run the PDF extractor after the web catalog build so its optional source-photo
references point at the final normalized filenames.

Refresh only the door-leaf maps after changing crop rules:

```bash
python3 tools/build-door-texture-assets.py
```
"""

PRODUCT_KEYS = {
    "金曲": "jinqu",
    "世瑞": "shirui",
    "拾翠": "shicui",
    "冠冕": "guanmin",
    "爱格": "aige",
    "颂歌": "songge",
    "若简": "ruojian",
    "圆隐": "yuanyin",
    "江川赋": "jiangchuan",
    "荆虹赋": "jinghong",
    "清雅": "qingya",
}


def slug(value: str) -> str:
    value = value.lower().replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value or "asset"


def product_key(folder: str) -> str:
    for label, key in PRODUCT_KEYS.items():
        if label in folder:
            return key
    return slug(folder)


def image_role(name: str) -> str:
    if "正视" in name:
        return "front"
    if "外装拉手" in name:
        return "hardware-pull"
    if "执手" in name or "把手" in name:
        return "hardware-handle"
    if "铰链" in name:
        return "hardware-hinge"
    if "背板" in name:
        return "hardware-backplate"
    if "门套" in name:
        return "casing"
    if "气窗" in name:
        return "transom"
    if "单门" in name:
        return "door-single"
    if "子母门" in name:
        return "door-mother"
    if "对开门" in name:
        return "door-double"
    if "实物照片" in name:
        return "product-photo"
    if "饰面" in name:
        return "finish"
    if "纹理" in name:
        return "texture"
    return "detail"


def photo_id(name: str) -> str | None:
    match = re.search(r"(B\d{4,})(?:-(\d+))?", name, flags=re.IGNORECASE)
    if not match:
        return None
    return match.group(1).lower() + (f"-{match.group(2)}" if match.group(2) else "")


def target_for(source: Path) -> Path:
    rel = source.relative_to(ASSETS)
    parts = rel.parts
    filename = source.name
    ext = source.suffix.lower()
    target_ext = ".jpg" if ext == ".jpeg" else ext

    if (
        len(parts) >= 6
        and parts[0] == "source"
        and parts[1] == "series"
        and parts[2] in {"d90", "k80"}
        and parts[3] == "products"
    ):
        series = parts[2]
        product = product_key(parts[4])
        role = image_role(filename)
        identifier = photo_id(filename)
        if role == "detail" and identifier:
            name = f"detail-{identifier}{target_ext}"
        elif identifier:
            name = f"{role}-{identifier}{target_ext}"
        else:
            name = f"{role}-{slug(source.stem)}{target_ext}"
        return CATALOG / series / "products" / product / name

    if len(parts) >= 5 and parts[:3] == ("source", "hardware", "locks"):
        group = "07" if "07型" in parts else "08-kfv" if "08、KFV型" in parts else "reference"
        name = slug(source.stem)
        if "07LM-Y" in filename:
            name = "smart-lock-07lm-y-plus"
        elif "拉手07LM" in filename:
            name = "pull-handle-07lm-q1-face"
        elif "YT82" in filename:
            name = "lock-yt82"
        elif "YT83" in filename:
            name = "lock-yt83"
        elif "YTR55H" in filename:
            name = "lock-ytr55h-concealed"
        elif "室内执手" in filename:
            name = "indoor-handle-kfv-reference"
        return CATALOG / "hardware" / "locks" / group / f"{name}{target_ext}"

    if len(parts) >= 5 and parts[:4] == ("generated", "series", "k80", "textures"):
        return CATALOG / "derived" / "k80" / "textures" / f"{slug(source.stem)}{target_ext}"
    if len(parts) >= 5 and parts[:4] == ("generated", "series", "d90", "textures"):
        return CATALOG / "derived" / "d90" / "textures" / f"{slug(source.stem)}{target_ext}"
    if len(parts) >= 4 and parts[:3] == ("generated", "hardware", "textures"):
        return CATALOG / "derived" / "hardware" / "textures" / f"{slug(source.stem)}{target_ext}"

    if len(parts) >= 5 and parts[:2] == ("generated", "pdf-previews"):
        return CATALOG / "pdf-previews" / Path(*parts[2:])

    if len(parts) >= 4 and parts[:3] == ("source", "legacy", "brand"):
        return CATALOG / "brand" / f"{slug(source.stem)}{target_ext}"

    if len(parts) >= 4 and parts[:3] == ("source", "legacy", "k9"):
        return CATALOG / "derived" / "legacy" / f"{slug(source.stem)}{target_ext}"

    return CATALOG / "derived" / "legacy" / f"{slug(source.stem)}{target_ext}"


def unique_target(target: Path, used: set[Path]) -> Path:
    if target not in used and not target.exists():
        return target
    stem, suffix = target.stem, target.suffix
    index = 2
    while True:
        candidate = target.with_name(f"{stem}-{index}{suffix}")
        if candidate not in used and not candidate.exists():
            return candidate
        index += 1


def image_size(path: Path) -> tuple[int | None, int | None]:
    if path.suffix.lower() == ".svg":
        return None, None
    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    width = height = None
    for line in result.stdout.splitlines():
        if "pixelWidth:" in line:
            width = int(line.split(":", 1)[1].strip())
        elif "pixelHeight:" in line:
            height = int(line.split(":", 1)[1].strip())
    return width, height


def convert(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.suffix.lower() == ".svg":
        shutil.copy2(source, target)
        return
    command = ["sips", "-Z", str(MAX_IMAGE_SIZE)]
    if target.suffix.lower() == ".jpg":
        command.extend(["-s", "format", "jpeg", "-s", "formatOptions", "82"])
    command.extend([str(source), "--out", str(target)])
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def main() -> None:
    if CATALOG.exists():
        shutil.rmtree(CATALOG)
    CATALOG.mkdir(parents=True)
    sources = sorted(
        path for path in ASSETS.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS and "catalog" not in path.parts
    )
    used: set[Path] = set()
    entries = []
    for source in sources:
        target = unique_target(target_for(source), used)
        used.add(target)
        convert(source, target)
        width, height = image_size(target)
        entries.append({
            "source": str(source.relative_to(PROJECT)),
            "path": str(target.relative_to(PROJECT)),
            "width": width,
            "height": height,
            "bytes": target.stat().st_size,
        })
    manifest = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "maxImageSize": MAX_IMAGE_SIZE,
        "sourceAssetsPreserved": True,
        "count": len(entries),
        "assets": entries,
    }
    (CATALOG / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (CATALOG / "README.md").write_text(CATALOG_README)
    subprocess.run(
        ["python3", str(PROJECT / "tools" / "build-door-texture-assets.py")],
        check=True,
    )
    print(f"normalized={len(entries)}")
    print(f"catalog={CATALOG}")
    print(f"catalog_bytes={sum(entry['bytes'] for entry in entries)}")


if __name__ == "__main__":
    main()
