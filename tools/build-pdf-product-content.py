#!/usr/bin/env python3
"""Extract the YADILO PDF catalogue into product galleries and specifications."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import pdfplumber


PROJECT = Path(__file__).resolve().parents[1]
PDF = PROJECT / "assets/source/docs/catalog/Catalog_20260806交互_zxj(1).pdf"
CATALOG_DATA = PROJECT / "catalog-data.js"
GENERATED_PREVIEWS = PROJECT / "assets/generated/pdf-previews"
OUTPUT = PROJECT / "catalog-pdf-data.js"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

LABELS = {
    "外观颜色": "外观颜色",
    "背板颜色": "背板颜色",
    "外板材质": "外板材质",
    "背板材质": "背板材质",
    "饰面纹理": "饰面纹理（选配）",
    "饰面处理工艺": "饰面处理工艺",
    "防盗结构": "防盗结构",
    "门框材质": "门框材质",
    "保温隔音": "保温隔音",
    "门套": "门套",
    "密封条材": "密封条材",
    "铰链规格": "铰链规格",
    "五金配置": "五金配置",
}


def compact(value: str) -> str:
    return re.sub(r"\s+", "", value or "")


def normalized_label(value: str) -> str:
    value = compact(value)
    value = value.replace("﹙", "(").replace("﹚", ")")
    value = value.replace("（", "(").replace("）", ")")
    value = value.replace("选配", "")
    return value.replace("(", "").replace(")", "")


def product_rows() -> list[dict[str, object]]:
    source = CATALOG_DATA.read_text(encoding="utf-8")
    rows: list[dict[str, object]] = []
    for series, block in re.findall(r"const (k80|d90) = \[(.*?)\]\.map", source, flags=re.S):
        matches = re.findall(
            r"\['([^']+)', '([^']+)', '([^']+)', (\d+), '([^']+)'",
            block,
        )
        for slug, name, latin, page, tags in matches:
            rows.append({
                "series": series,
                "slug": slug,
                "name": name,
                "latin": latin,
                "page": int(page),
                "tags": tags,
            })
    if len(rows) != 58:
        raise RuntimeError(f"Expected 58 products in catalog-data.js, found {len(rows)}")
    return rows


def row_groups(words: list[dict[str, object]]) -> list[tuple[float, str]]:
    groups: list[dict[str, object]] = []
    for word in sorted(words, key=lambda item: (float(item["top"]), float(item["x0"]))):
        top = float(word["top"])
        group = next((item for item in groups if abs(float(item["top"]) - top) <= 2.2), None)
        if group is None:
            group = {"top": top, "words": []}
            groups.append(group)
        group["words"].append(word)
    return [
        (
            float(group["top"]),
            "".join(item["text"] for item in sorted(group["words"], key=lambda value: float(value["x0"]))),
        )
        for group in sorted(groups, key=lambda item: float(item["top"]))
    ]


def extract_specs(page) -> dict[str, str]:
    words = [word for word in page.extract_words(x_tolerance=1, y_tolerance=3) if 325 <= float(word["top"]) <= 560]
    result: dict[str, str] = {}
    for column_words in (
        [word for word in words if float(word["x0"]) < 300],
        [word for word in words if float(word["x0"]) >= 300],
    ):
        rows = row_groups(column_words)
        label_rows: list[tuple[float, str]] = []
        for top, text in rows:
            key = normalized_label(text)
            for alias, canonical in LABELS.items():
                if key == alias or key.startswith(alias):
                    label_rows.append((top, canonical))
                    break
        for index, (top, canonical) in enumerate(label_rows):
            next_top = label_rows[index + 1][0] if index + 1 < len(label_rows) else 560
            value_words = [
                word for word in column_words
                if top + 4 < float(word["top"]) < next_top - 2
            ]
            value = compact(
                "".join(
                    item["text"]
                    for item in sorted(value_words, key=lambda item: (float(item["top"]), float(item["x0"])))
                )
            )
            if value:
                result[canonical] = value
    return result


def extract_intro(page, series: str) -> str:
    text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
    lines = text.splitlines()
    marker = next((index for index, line in enumerate(lines) if compact(line).upper() == series.upper()), None)
    if marker is None:
        return ""
    collected: list[str] = []
    for line in lines[marker + 1:]:
        clean = compact(line)
        if not clean or clean.isdigit():
            continue
        if not re.search(r"[\u4e00-\u9fff]", clean):
            if collected:
                break
            continue
        collected.append(clean)
    return "".join(collected)


def render_gallery(product: dict[str, object]) -> list[str]:
    series = str(product["series"])
    slug = str(product["slug"])
    page = int(product["page"])
    target_dir = GENERATED_PREVIEWS / series / slug
    target_dir.mkdir(parents=True, exist_ok=True)
    gallery = [f"assets/catalog/pdf-previews/{series}/{slug}/page-{index:02d}.jpg" for index in range(1, 5)]
    with tempfile.TemporaryDirectory(prefix=f"pdf-{series}-{slug}-", dir=PROJECT / "tmp/pdfs") as temp:
        prefix = Path(temp) / "page"
        subprocess.run(
            [
                "pdftoppm", "-f", str(page), "-l", str(page + 3),
                "-jpeg", "-r", "120", "-jpegopt", "quality=82",
                str(PDF), str(prefix),
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        rendered = sorted(Path(temp).glob("page-*.jpg"))
        if len(rendered) != 4:
            raise RuntimeError(f"Expected four rendered pages for {series}:{slug}, found {len(rendered)}")
        for index, source in enumerate(rendered, start=1):
            shutil.copyfile(source, target_dir / f"page-{index:02d}.jpg")
    return gallery


def source_gallery(product: dict[str, object]) -> list[str]:
    directory = PROJECT / "assets/catalog" / str(product["series"]) / "products" / str(product["slug"])
    if not directory.is_dir():
        return []
    return [
        str(path.relative_to(PROJECT))
        for path in sorted(directory.iterdir())
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]


def main() -> None:
    GENERATED_PREVIEWS.mkdir(parents=True, exist_ok=True)
    products = product_rows()
    data: dict[str, dict[str, object]] = {}
    with pdfplumber.open(PDF) as document:
        for product in products:
            page_number = int(product["page"])
            cover_page = document.pages[page_number - 1]
            specs = extract_specs(document.pages[page_number + 2])
            gallery = render_gallery(product)
            record: dict[str, object] = {
                "pdfPage": page_number,
                "pdfIntro": extract_intro(cover_page, str(product["series"])),
                "gallery": gallery,
                "sourceGallery": source_gallery(product),
                "pdfSpecs": specs,
                "catalogSource": "assets/source/docs/catalog/Catalog_20260806交互_zxj(1).pdf",
            }
            if "防盗结构" in specs:
                record["thickness"] = specs["防盗结构"]
            if "门框材质" in specs:
                record["frame"] = specs["门框材质"]
            if "门套" in specs:
                record["casing"] = specs["门套"]
            if "密封条材" in specs:
                record["seal"] = specs["密封条材"]
            if "铰链规格" in specs:
                record["hinge"] = specs["铰链规格"]
            if "五金配置" in specs:
                record["hardware"] = specs["五金配置"]
            data[f"{product['series']}:{product['slug']}"] = record
    OUTPUT.write_text(
        "/* Generated from the 2026 YADILO PDF catalogue. Do not hand-edit. */\n"
        "window.YADILO_PDF_CATALOG = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(f"products={len(data)}")
    print(f"previews={len(list(GENERATED_PREVIEWS.rglob('page-*.jpg')))}")
    print(f"output={OUTPUT}")


if __name__ == "__main__":
    main()
