# YADILO Configurator Design QA

## Source visual truth

- Source: https://configurator.porsche.com/zh-CN/mode/model/Y1AAI1
- Source capture: in-app browser capture at 1280 × 720 CSS pixels, desktop configurator landing state.
- Reference state: centered global header, dominant product canvas, independent right configuration rail, floating view controls, grouped options, search, and price/summary actions.

## Implementation evidence

- Local URL: http://127.0.0.1:4173/?v=20260830#configurator
- Browser-rendered capture: [local-default-1280x720.png](audit/porsche-configurator-2026-08-02/local-default-1280x720.png)
- Implementation pixels: 1280 × 720; CSS viewport 1280 × 720; device density normalized to the browser capture (1×).
- Tested state for the saved capture: 单门、3D 默认视图、香槟金产品色、无气窗。
- Source and implementation were compared at the same desktop viewport; vehicle imagery and Porsche brand assets were intentionally replaced with YADILO door assets and terminology.

## Comparison evidence

Full-view comparison covered the header, left visual canvas/right option rail split, floating summary, render toolbar, door scale, floor/shadow treatment, and bottom/side dimension rails.

Focused comparison covered:

- Door type cards and selected-state treatment.
- Integrated transom and transom-type cards.
- Symmetric hardware on 对开门 and 双边边门.
- Height/width rail placement after resizing.
- Product color propagation to door, frame, casing, and transom.
- Half-open Three.js view with hardware attached to the moving leaves.

## Functional checks

- Four active door types are selectable: 单门、子母门、对开门、双边边门（单边边门按此前要求已删除）。
- Each active door type restores its own default dimensions and constrained min/max range.
- 对开门 and 双边边门 render two symmetric lock/handle positions; side panels remain separate leaves.
- 气窗 is integrated inside the same door opening and follows the door width; 气窗类型 appears only when 气窗 is enabled.
- Height and width slider changes keep the complete opening in the preview and keep the rails outside the rendered door.
- Product color changes update the door texture treatment, frame, casing, and integrated transom together.
- Front / 3D / half-open controls are wired; Three.js stays synchronized with the CSS assembly state.
- AI 场景 opens from both the header button and the nested label inside the preview button.
- Console check after the final local run: no page error entries.
- JavaScript syntax check: `node --check app.js` passed.

## Comparison history

1. The first Porsche-style shell pass let tall door types push the bottom width rail below the viewport. Fixed by anchoring the width rail to the preview bottom rather than to the door bottom; the post-fix 对开门 and 双边边门 captures show the full rail inside the canvas.
2. Nested labels inside AI/action buttons were not guaranteed to trigger the parent action. Fixed document-level action matching to use `closest()`, then verified the AI panel opens from the preview button.
3. The transom option was previously not surfaced as a usable follow-up choice. Added the conditional 气窗类型 group and verified all three choices render and select.

## Findings

- No actionable P0/P1/P2 findings remain for the tested desktop states.
- Intentional differences: YADILO brand, Chinese door-specific options, real door assets, and door dimension logic replace Porsche vehicle content while retaining the reference page's information architecture and motion rhythm.

## Follow-up polish

- Capture the final store-display resolution and one tablet viewport before production acceptance.
- Add more approved YADILO product photography to the finish gallery when the final asset set is confirmed.

final result: passed

## 2026-08-14 AI reference / BOM configuration rebuild QA

- Scope: local K80 若简 configurator only; four large tabs now follow the supplied AI reference hierarchy: 基础信息、门框与门套、气窗、五金配件.
- Source reconciliation: `/Users/wubin/Desktop/参考图.ai` (PDF container, 4 pages), `/Users/wubin/Desktop/入户门3D交互选购系统设计评审会议纪要.md`, `assets/source/docs/catalog/Catalog_20260806交互_zxj(1).pdf`, `assets/source/docs/design-guide/设计指导手册.pdf`, `assets/source/docs/order-system/order-rules/K80对开页面驱动配置xhh(1).xlsx`, and `assets/source/hardware/locks/catalog/智能锁选配清单.xlsx`.
- Basic reference block: door type/opening, K80AL/ST/CU process series, width × height × depth, independent front/back material, thickness, finish, texture and colour-board selections. Wood textures and metal finish processes are recorded as separate state fields.
- Frame reference block: outer casing, inner casing, frame profile and colour are independent; threshold options include atmosphere-light and drainage combinations; wall-integrated LMQ-M/LMQ-N options are present as gated engineering fields.
- Transom reference block: eight visual cards cover the seven AI/workbook forms plus no transom; flower/branch material, thickness and process, outer/inner glass and thickness are stored independently. Extended workbook values are mapped to the closest available GLB rail while preserving the canonical BOM value.
- Hardware reference block: real lock, handle, EPDM seal and hinge images are used. The stack follows lock → handle → seal → hinge and includes the BOM tree 门板 / 五金 / 配件. Battery-only lock `07LM-Y-PLUS` disables atmosphere-light checkboxes and shows the workbook constraint.
- Functional checks: switching all four tabs, selecting LMQ-M, selecting square-glass transom, selecting battery lock, and restoring only the current tab all passed. A transom reset returned to 无气窗 while width remained 2100 mm.
- Layout checks: desktop 1280 × 720 and mobile 760 × 900 reported zero horizontal overflow. The visible stage toolbar contains only 3D 视图、正面、侧面、打开主门; AI 场景 remains the unified scene entry.
- Browser console: zero page error entries after the final local run. `node --check glb-configurator.js`, `private-configurator-tabs.js`, `order-adapter.js`, and `git diff --check` passed.
- Local route: `http://127.0.0.1:8000/glb-configurator.html?product=ruojian&v=20260814.4`.

final result: passed

## 2026-08-14 website-style visual polish QA

- Scope: local K80 私人定制 page, all four configuration tabs, stage/header treatment, reset feedback, material preview, and responsive layout.
- Brand grounding: reused the live site's ink `#171412`, warm paper `#f4f0ea`, copper-brown accents, Playfair Display headings, fine rules, and restrained square geometry. No server or deployment action was performed.
- Desktop evidence: `audit/2026-08-14-brand-polish/desktop-basic.png`, `desktop-frame.png`, `desktop-transom.png`, and `desktop-hardware.png` at 1920 × 1080.
- Responsive evidence: `audit/2026-08-14-brand-polish/mobile-basic.png` at 760 × 900; 1366 × 768 and 760 × 900 both reported zero horizontal overflow.
- Reference comparisons: `audit/2026-08-14-brand-polish/compare-reference-basic.png` and `compare-reference-hardware.png`. The reference information hierarchy is retained while visual styling now follows the YADILO website rather than the engineering-wireframe aesthetic.
- Four-tab behavior: each tab exposes exactly one tabpanel, keeps its own reset label, returns the panel to the top, and preserves the full-door overview.
- Material feedback: texture/design cards reveal a large real product preview with the selected material name, usage and weathering information; no placeholder image is used.
- Reset behavior: changing 门框制作方式 from 整体制作 to 拼装制作 and pressing the current-tab reset restored 整体制作 and displayed confirmation feedback.
- Hardware cards no longer show generic drawn placeholder glyphs; names and product rules are presented as a clean specification list, while the EPDM seal retains its real product image.
- Browser console contained zero page errors. `node --check` passed for the configuration scripts and `git diff --check` passed.
- No actionable P0/P1/P2 visual or interaction finding remains in the tested states.

final result: passed

## 2026-08-14 AI reference and meeting-notes configurator refactor QA

### Source visual truth

- Source: `/Users/wubin/Desktop/参考图.ai`, a four-page, 1920 × 1080 Illustrator/PDF reference.
- Meeting source: `/Users/wubin/Desktop/入户门3D交互选购系统设计评审会议纪要.md`.
- Source captures: `audit/2026-08-14-reference-refactor/reference-basic.png` and `audit/2026-08-14-reference-refactor/reference-hardware.png`, rendered at 3734 × 2100 pixels and normalized to 1920 × 1080 for comparison.
- Compared states: 基础信息 and 五金配件 at the desktop reference viewport.

### Implementation evidence

- Local route: `http://127.0.0.1:8000/glb-configurator.html?product=ruojian&v=20260814`.
- Browser captures: `audit/2026-08-14-reference-refactor/implementation-basic.png` and `audit/2026-08-14-reference-refactor/implementation-hardware.png`.
- Implementation pixels and CSS viewport: 1920 × 1080 at 1× density.
- Side-by-side evidence: `audit/2026-08-14-reference-refactor/compare-basic.png` and `audit/2026-08-14-reference-refactor/compare-hardware.png`, each 3840 × 1080.
- Focused comparison was performed on the 480 px right configuration rail, including tab geometry, option density, selected states, control spacing, typography and the sticky current-tab reset action. Separate crops were unnecessary because the rail remains legible in the full-resolution combined evidence.

### Functional checks

- Four large tabs work with mouse and keyboard arrow navigation: 基础信息、门框与门套、气窗、五金配件.
- Basic information now starts with 门型、开向 and 包框尺寸, then continues to notes and front/back finish controls.
- Hardware is ordered as lock/panel, handle, hinge and seal; the new EPDM seal card uses a real product image and includes 江阴海达 and process copy.
- Each tab has an independent “还原为默认款式” action. A changed frame installation value was restored from 靠墙外 to 靠中装 without changing another tab.
- Changing tabs preserves the full-door overview instead of forcing a hardware/frame close-up.
- Desktop 1366 × 768 and narrow 760 × 900 checks showed zero horizontal overflow; all four tabs remained visible.
- Browser console: zero page error entries. JavaScript syntax checks and `git diff --check` passed.

### Required fidelity surfaces

- Fonts and typography: Noto Sans SC is retained; black/white hierarchy, condensed tab labels and small technical annotations match the source rhythm.
- Spacing and layout: black 72 px global header, dominant light product canvas, independent white right rail, top-aligned view controls and sticky reset bar reproduce the source composition.
- Colors and tokens: the implementation uses the source's black, white, neutral gray and pale tan AI-scene accent; selected states are high-contrast black.
- Image quality and assets: the original YADILO mark and top action glyphs were cropped from the supplied vector reference; the live door remains the sharper real GLB/product texture instead of being replaced by the reference's wireframe placeholder. The seal image is a dedicated project asset, not a placeholder.
- Copy and content: labels follow the meeting-approved taxonomy. Real K80 product names, dimensions and controls are retained where they are more accurate than the generic reference values.

### Comparison history

1. Initial state retained six vertical accordions and opened hardware/frame close-ups. Fixed by introducing four top-level tabs, keeping every tab on the full-door overview, and adding a single current-tab reset action.
2. First tab pass placed product texture controls above door type and dimensions and placed hinges before locks. Fixed the ordering to match the meeting and reference hierarchy: type/opening/dimensions first; locks/handles before hinge and seal.
3. The first header pass compressed the supplied logo and overlapped AI Scene with dimension readouts. Fixed by using the original reference crop at its intended aspect ratio, using the supplied action icon crops, and separating width/height/AI controls vertically.
4. Post-fix side-by-side comparison found no remaining P0/P1/P2 layout or interaction issue. The real shaded GLB and expanded product-specific controls are intentional production differences from the reference wireframe.

### Findings

- No actionable P0/P1/P2 findings remain in the tested states.
- P3 follow-up: the exact line-art material treatment from the Illustrator mock is intentionally not applied to the live GLB because it would hide verified product textures and hardware details.

final result: passed

## 2026-08-11 non-distorting composition and product-inspector QA

- Scope: K80 and D90 GLB configurators, including door-type conversion, physical-size changes, and product education interactions.
- Mapping invariant: texture texel density, main-design aspect ratio, hardware dimensions, center seam, and hardware anchors remain independent from the selected opening width and height.
- Double to mother-and-child: the right main leaf keeps the authored right-half crop and original scale; the narrower left leaf removes content from the outer-left edge while keeping the source seam fixed. No horizontal compression is used.
- Mother-and-child to double: the right main leaf and source seam remain fixed; additional base material is revealed toward the outer-left edge. Main design and handle geometry are not enlarged.
- Dimension changes: width and height reveal or crop the overscanned texture field in physical proportion; decorative geometry stays uniformly scaled and circular motifs remain circular.
- Product education: a new Product Inspector opens from the preview toolbar or inline links and provides interactive tabs for composition logic, main design, hinge, and lock body. Hinge and lock tabs use large product images and move the Three.js camera to the relevant physical detail; hinge inspection also opens the main leaf.
- K80 evidence: `audit/2026-08-11-texture-logic-after-double.png`, `audit/2026-08-11-texture-logic-after-mother.png`, `audit/2026-08-11-yuanyin-mother.png`, `audit/2026-08-11-yuanyin-double.png`, `audit/2026-08-11-qinghuafu-mother.png`, and `audit/2026-08-11-product-inspector-hinge.png`.
- D90 evidence: `audit/2026-08-11-d90-texture-max.png` and `audit/2026-08-11-d90-product-inspector-lock.png`.
- Console verification: no page errors were recorded in the final K80 and D90 runs.
- Syntax verification: `node --check` passed for `product-inspector.js`, `glb-configurator.js`, and `d90-configurator.js`; `git diff --check` passed.

final result: passed

## 2026-08-11 configuration camera-focus QA

- Scope: K80 and D90 configurator option panels now drive contextual Three.js camera poses while preserving manual orbit and zoom.
- Verified focus targets: finish/texture (front surface), door type/opening (whole-door perspective), transom (top rail), dimensions (full front), frame/casing (angled jamb detail), lock/handle (hardware close-up), and D90 世瑞 side-light glass (left glass leaf).
- K80 evidence: `audit/2026-08-11-camera-focus/06-k80-transom-focus.png`, `audit/2026-08-11-camera-focus/04-k80-visible-hardware-focus.png`, and `audit/2026-08-11-camera-focus/05-k80-frame-focus-final.png`.
- D90 evidence: `audit/2026-08-11-camera-focus/07-d90-hardware-focus.png` and `audit/2026-08-11-camera-focus/08-d90-sidelight-focus.png`.
- Dimension persistence: after opening 尺寸 and changing width from 2100 mm to 2080 mm, the active camera focus remained `dimensions` and the output updated to `2080 mm`.
- Manual reset: clicking 3D 视图 restored `overview` and the perspective view button became active.
- Accordion behavior: opening another top-level group closes the previous group and moves the camera to the new subject.
- Console verification: no page error entries on the final D90 run.
- Syntax verification: `node --check` passed for `configurator-panel-behavior.js`, `glb-configurator.js`, and `d90-configurator.js`.

final result: passed

## 2026-08-11 product-led configurator layout QA

- Reference: `https://configurator.porsche.cn/zh-CN/mode/model/9923B2`.
- Reference structure checked live: restrained black global header, dominant product media area, independent light configuration rail, compact floating camera controls, generous option spacing and collapsible configuration groups.
- Scope: K80 and D90 GLB configurators. Product data, door geometry, texture controls, dimensions, hardware and save/AI interactions were preserved.
- Before/after comparison: `audit/2026-08-11-porsche-layout/08-before-after.jpg` at 1159 × 863.
- Final K80 desktop capture: `audit/2026-08-11-porsche-layout/05-after-desktop-final.png` at 1159 × 863.
- Final D90 desktop capture: `audit/2026-08-11-porsche-layout/06-d90-desktop.png` at 1159 × 863.
- Final K80 tablet capture: `audit/2026-08-11-porsche-layout/07-k80-tablet-1024.png` at 1024 × 768.
- Desktop split verified: 769 px product canvas + 390 px configuration rail; tablet split verified: 674 px product canvas + 350 px configuration rail with zero horizontal overflow.
- Configuration density: only one top-level subsystem opens at a time. Opening 门型与开启 closed 当前产品与饰面 and revealed the expected opening-direction controls.
- Showroom treatment: architectural portal, fins, gold light strips, plinths, floor inlays and wall mark removed. Neutral wall/floor, physical cast shadow, floor reflection and broad warm/cool soft lights remain.
- Console verification: no error entries on the final K80 and D90 desktop states.
- Syntax verification: `node --check` passed for both configurator scripts, the panel behavior module and showroom architecture module.
- Intentional difference: Porsche vehicle and brand assets are not copied; the source layout rhythm is applied to the existing YADILO door content and controls.

final result: passed

## 2026-08-07 catalogue and product-flow QA

- Reference capture: https://www.porsche.cn/china/zh/ was opened successfully in the in-app browser at 1280 × 720. Only the reference site's information architecture, full-screen hero rhythm, fixed header, reveal pacing, and catalogue-to-configurator flow were carried over; Porsche code, logo, copy, and protected imagery were not reused.
- Local content source: `assets/source/docs/catalog/Catalog_20260806交互_zxj(1).pdf`, 369 pages. The catalogue index is normalized to 58 products: 45 K80 products and 13 D90 products. Every product cover path and every generated PDF preview used by `catalog-data.js` was checked for existence.
- New routes checked: `/index.html`, `/product.html?series=d90&product=shirui`, `/compare.html`, and `/door-lab.html?series=k80&v=20260908`.
- Visual checks: desktop screenshots confirmed the homepage hero, series cards, product detail page, comparison page, and both K80/D90 configuration states. The GLB preview was allowed to finish loading before capture; the K80 model reported 147 meshes and the D90 model reported 271 meshes.
- Interaction checks: homepage menu opened and locked the page; K80/D90 product filtering updated the rail; the comparison selector changed its table column; the configuration page switched K80 → D90, opened and closed the main door, selected an independent hidden lock plus long handle, and changed width 1800 → 2100 mm and height 2600 → 3000 mm with the preview remaining inside the canvas.
- Layout check: all four routes reported no horizontal overflow at the 1280 × 720 desktop viewport. Local HTTP checks returned 200 for all new HTML, CSS, JS, and representative PDF preview assets.

final result: passed
