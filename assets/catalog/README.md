# YADILO Web Asset Catalog

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
```

Refresh only the door-leaf maps after changing crop rules:

```bash
python3 tools/build-door-texture-assets.py
```
