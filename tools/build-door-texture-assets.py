#!/usr/bin/env python3
"""Create normalized, door-leaf texture assets from the clean source maps.

The source maps remain untouched.  Every output is a semantic web asset:
double doors use one leaf crop and mirror it at runtime, mother doors keep
independent child/main crops, and side-light products keep main/side crops.
"""

from __future__ import annotations

import json
import math
import subprocess
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
CATALOG = PROJECT / "assets" / "catalog"
CROP_TOOL_SOURCE = PROJECT / "tools" / "crop-image.swift"
CROP_TOOL_BINARY = Path("/tmp/yadilo-crop-image")
FROSTED_TOOL_SOURCE = PROJECT / "tools" / "process-frosted-glass.swift"
FROSTED_TOOL_BINARY = Path("/tmp/yadilo-process-frosted-glass")

# 世瑞边门在产品实拍中是玻璃边门，不应继续把室内照片作为不透明门扇显示。
# 先裁切真实边门区域，再做一次可追溯的磨砂玻璃处理；源图仍然保留。
FROSTED_PARTS = {("d90", "shirui", "sideLight")}


SPECS = {
    "k80": {
        "ruojian": {
            "door_type": "double",
            "source": "assets/generated/series/k80/textures/k80-ruo-jian-clean-ai-v1.png",
            "parts": {"doubleLeaf": (0.0, 0.0, 0.5, 1.0)},
        },
        # These three elevations are currently available only in the source
        # catalogue.  Crop the exact front elevation, not the lifestyle
        # image or a repeating material swatch: their proportions and the
        # integrated hardware language are product-specific.
        "yijian": {
            "door_type": "double",
            "source": "assets/catalog/pdf-previews/k80/yijian/page-04.jpg",
            "parts": {"doubleLeaf": (0.137, 0.620, 0.355, 0.900)},
        },
        "heya": {
            "door_type": "double",
            "source": "assets/catalog/pdf-previews/k80/heya/page-04.jpg",
            "parts": {"doubleLeaf": (0.133, 0.620, 0.338, 0.900)},
        },
        "ouya": {
            "door_type": "double",
            "source": "assets/catalog/pdf-previews/k80/ouya/page-04.jpg",
            "parts": {"doubleLeaf": (0.132, 0.620, 0.368, 0.900)},
        },
        "yuanyin": {
            "door_type": "double",
            "source": "assets/generated/series/k80/textures/k80-yuan-yin-clean-ai-v1.png",
            "parts": {"doubleLeaf": (0.0, 0.0, 0.5, 1.0)},
        },
        "jiangchuan": {
            "door_type": "double",
            "source": "assets/generated/series/k80/textures/k80-jiang-chuan-clean-ai-v1.png",
            "parts": {"doubleLeaf": (0.0, 0.0, 0.5, 1.0)},
        },
        "jinghong": {
            "door_type": "double",
            "source": "assets/generated/series/k80/textures/k80-jing-hong-clean-ai-v1.png",
            "parts": {"doubleLeaf": (0.0, 0.0, 0.5, 1.0)},
        },
        "qingya": {
            "door_type": "mother",
            "source": "assets/generated/series/k80/textures/k80-qing-ya-clean-ai-v1.png",
            "parts": {
                "motherChild": (0.0, 0.0, 0.32, 1.0),
                "motherMain": (0.32, 0.0, 1.0, 1.0),
            },
        },
    },
    "d90": {
        "jinqu": {
            "door_type": "sideLight",
            "source": "assets/generated/series/d90/textures/d90-jinqu-clean-ai-v1.png",
            "parts": {
                "sideMain": (0.335, 0.025, 0.965, 0.995),
                "sideLight": (0.018, 0.025, 0.305, 0.995),
            },
        },
        "shirui": {
            "door_type": "sideLight",
            "source": "assets/generated/series/d90/textures/d90-shirui-clean-ai-v1.png",
            "parts": {
                "sideMain": (0.545, 0.020, 0.985, 0.985),
                "sideLight": (0.020, 0.020, 0.535, 0.985),
            },
        },
        "shicui": {
            "door_type": "double",
            "source": "assets/generated/series/d90/textures/d90-shicui-clean-ai-v1.png",
            "parts": {"doubleLeaf": (0.055, 0.018, 0.485, 0.996)},
        },
        "aige": {
            "door_type": "double",
            "source": "assets/generated/series/d90/textures/d90-aige-clean-ai-v1.png",
            "parts": {"doubleLeaf": (0.055, 0.020, 0.485, 0.996)},
        },
        "songge": {
            "door_type": "double",
            "source": "assets/generated/series/d90/textures/d90-songge-clean-ai-v1.png",
            "parts": {"doubleLeaf": (0.055, 0.018, 0.485, 0.996)},
        },
        "guanmin": {
            "door_type": "double",
            "source": "assets/generated/series/d90/textures/d90-guanmin-clean-ai-v1.png",
            "parts": {"doubleLeaf": (0.010, 0.006, 0.492, 0.998)},
        },
    },
}

PART_FILENAMES = {
    "doubleLeaf": "double-leaf",
    "motherChild": "mother-child",
    "motherMain": "mother-main",
    "sideMain": "side-main",
    "sideLight": "side-light",
}


def image_size(path: Path) -> tuple[int, int]:
    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    width = height = 0
    for line in result.stdout.splitlines():
        if "pixelWidth:" in line:
            width = int(line.split(":", 1)[1].strip())
        elif "pixelHeight:" in line:
            height = int(line.split(":", 1)[1].strip())
    if not width or not height:
        raise RuntimeError(f"无法读取图片尺寸: {path}")
    return width, height


def ensure_crop_tool() -> Path:
    """Compile the CoreGraphics cropper once; sips centers crop offsets on macOS."""
    if not CROP_TOOL_SOURCE.exists():
        raise FileNotFoundError(CROP_TOOL_SOURCE)
    if not CROP_TOOL_BINARY.exists() or CROP_TOOL_BINARY.stat().st_mtime < CROP_TOOL_SOURCE.stat().st_mtime:
        subprocess.run(
            ["swiftc", str(CROP_TOOL_SOURCE), "-o", str(CROP_TOOL_BINARY)],
            check=True,
        )
    return CROP_TOOL_BINARY


def ensure_frosted_tool() -> Path:
    if not FROSTED_TOOL_SOURCE.exists():
        raise FileNotFoundError(FROSTED_TOOL_SOURCE)
    if not FROSTED_TOOL_BINARY.exists() or FROSTED_TOOL_BINARY.stat().st_mtime < FROSTED_TOOL_SOURCE.stat().st_mtime:
        subprocess.run(
            ["swiftc", str(FROSTED_TOOL_SOURCE), "-o", str(FROSTED_TOOL_BINARY)],
            check=True,
        )
    return FROSTED_TOOL_BINARY


def crop(source: Path, target: Path, window: tuple[float, float, float, float]) -> dict[str, int | str]:
    width, height = image_size(source)
    x0, y0, x1, y1 = window
    left = max(0, min(width - 1, math.floor(width * x0)))
    top = max(0, min(height - 1, math.floor(height * y0)))
    right = max(left + 1, min(width, math.ceil(width * x1)))
    bottom = max(top + 1, min(height, math.ceil(height * y1)))
    crop_width = right - left
    crop_height = bottom - top
    target.parent.mkdir(parents=True, exist_ok=True)
    crop_tool = ensure_crop_tool()
    subprocess.run(
        [
            str(crop_tool),
            str(source),
            str(target),
            str(left),
            str(top),
            str(crop_width),
            str(crop_height),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    out_width, out_height = image_size(target)
    try:
        target_path = str(target.relative_to(PROJECT))
    except ValueError:
        target_path = str(target)
    return {
        "path": target_path,
        "source": str(source.relative_to(PROJECT)),
        "sourceWindow": [x0, y0, x1, y1],
        "width": out_width,
        "height": out_height,
        "bytes": target.stat().st_size,
    }


def process_frosted_glass(source: Path, target: Path) -> None:
    frosted_tool = ensure_frosted_tool()
    subprocess.run(
        [str(frosted_tool), str(source), str(target)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )


def main() -> None:
    generated: dict[str, dict[str, dict[str, object]]] = {}
    count = 0
    for series, products in SPECS.items():
        generated[series] = {}
        for product, spec in products.items():
            source = PROJECT / spec["source"]
            if not source.exists():
                raise FileNotFoundError(source)
            product_dir = CATALOG / "derived" / series / "door-skins"
            parts: dict[str, object] = {}
            for part, window in spec["parts"].items():
                target = product_dir / f"{series}-{product}-{PART_FILENAMES[part]}.png"
                if (series, product, part) in FROSTED_PARTS:
                    raw_target = Path("/tmp") / f"yadilo-{series}-{product}-{PART_FILENAMES[part]}-raw.png"
                    crop(source, raw_target, window)
                    process_frosted_glass(raw_target, target)
                    out_width, out_height = image_size(target)
                    part_entry = {
                        "path": str(target.relative_to(PROJECT)),
                        "source": str(source.relative_to(PROJECT)),
                        "sourceWindow": list(window),
                        "width": out_width,
                        "height": out_height,
                        "bytes": target.stat().st_size,
                        "treatment": "frosted-glass",
                    }
                    parts[part] = part_entry
                else:
                    parts[part] = crop(source, target, window)
                count += 1
            generated[series][product] = {
                "doorType": spec["door_type"],
                "source": str(source.relative_to(PROJECT)),
                "parts": parts,
                "assembly": (
                    {"child": "doubleLeaf", "main": "doubleLeaf", "mirrorMain": True}
                    if spec["door_type"] == "double"
                    else {"child": "motherChild", "main": "motherMain"}
                    if spec["door_type"] == "mother"
                    else {"main": "sideMain", "side": "sideLight"}
                ),
            }
    index = {
        "version": 1,
        "description": "按门扇拆分的真实纹理资产；双开门主门运行时镜像，子母门和边门使用独立分片。",
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "sourceAssetsPreserved": True,
        "count": count,
        "series": generated,
    }
    index_path = CATALOG / "door-textures.json"
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n")
    manifest_path = CATALOG / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        manifest_entries = manifest.setdefault("assets", [])
        entries_by_path = {entry.get("path"): entry for entry in manifest_entries}
        for series_entries in generated.values():
            for product_entry in series_entries.values():
                for part_entry in product_entry["parts"].values():
                    path = part_entry["path"]
                    manifest_entry = {
                        "source": part_entry["source"],
                        "path": path,
                        "width": part_entry["width"],
                        "height": part_entry["height"],
                        "bytes": part_entry["bytes"],
                        "kind": "door-skin",
                    }
                    if part_entry.get("treatment"):
                        manifest_entry["treatment"] = part_entry["treatment"]
                    if path in entries_by_path:
                        entries_by_path[path].update(manifest_entry)
                    else:
                        manifest_entries.append(manifest_entry)
                        entries_by_path[path] = manifest_entry
        manifest["generatedAt"] = index["generatedAt"]
        manifest["doorTextureIndex"] = "assets/catalog/door-textures.json"
        manifest["count"] = len(manifest_entries)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"generated={count}")
    print(f"index={index_path}")


if __name__ == "__main__":
    main()
