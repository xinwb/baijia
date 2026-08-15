import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { initAiScene } from './ai-scene.js?v=20261185';
import { addVirtualShowroom } from './showroom-architecture.js?v=20261129';
import { buildOrderPayload } from './order-adapter.js';
import { createSchemeDocument } from './scheme-store.js';
import { initSchemeUi } from './scheme-ui.js';
import { initProductInspector, compositionRule } from './product-inspector.js?v=20260814.23';
import { getTextureManifest, getTextureMapPath, getTextureRegion, getTextureStructure } from './texture-manifest.js?v=20260813.36';
import { createTextureSurfaceCanvas, getTextureSurface, TEXTURE_SURFACES } from './texture-surfaces.js?v=20261205';
import { getTextureDesigns, getDefaultTextureDesign, createTextureLayerCanvas } from './texture-layers.js?v=20261205';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const mount = $('#canvasMount');
const status = $('#modelStatus');

const PRODUCT_ALIASES = {
  jiangchuanfu: 'jiangchuan',
  jinghongfu: 'jinghong'
};
const PDF_PRODUCT_KEYS = {
  ruojian: 'ruojian',
  yijian: 'yijian',
  heya: 'heya',
  ouya: 'ouya',
  yuanyin: 'yuanyin',
  jinghong: 'jinghongfu',
  jiangchuan: 'jiangchuanfu',
  qinghuafu: 'qinghuafu'
};
const pdfProductSpecs = (product) => {
  const key = PDF_PRODUCT_KEYS[product];
  return key ? (window.YADILO_PDF_CATALOG?.[`k80:${key}`]?.pdfSpecs || {}) : {};
};
const splitPdfColorLabels = (value) => String(value || '')
  .split(/[\/／]/)
  .map((item) => item.trim())
  .filter(Boolean);
const normalizePdfTextureLabel = (value) => String(value || '')
  .replace(/\(无纹理\)/g, '（无纹理）')
  .replace(/\s+/g, ' ')
  .trim();
const pdfMaterialLabel = (value, fallback = '铝板') => {
  const text = String(value || '');
  if (/铝/.test(text)) return '铝板';
  if (/铜/.test(text)) return '铜板';
  if (/钢/.test(text)) return '钢板';
  return fallback;
};
const pdfThickness = (value, fallback = '4.5') => String(value || '').match(/\d+(?:\.\d+)?/)?.[0] || fallback;
const catalogReferenceDefaults = (product) => {
  const specs = pdfProductSpecs(product);
  const frontColors = splitPdfColorLabels(specs['外观颜色']);
  const backColors = splitPdfColorLabels(specs['背板颜色']);
  const frontTexture = normalizePdfTextureLabel(specs['饰面纹理（选配）'] || '平板（无纹理）');
  const process = specs['饰面处理工艺'] || '简雕';
  return {
    frontReferenceColor: frontColors[0] || '',
    backReferenceColor: backColors[0] || (String(specs['背板颜色'] || '').trim() === '选配' ? '选配' : ''),
    frontMaterial: pdfMaterialLabel(specs['外板材质']),
    frontThickness: pdfThickness(specs['外板材质']),
    frontProcess: process,
    frontTextureLabel: frontTexture,
    backMaterial: /热镀锌/.test(String(specs['背板材质'] || '')) ? '热镀锌钢板' : pdfMaterialLabel(specs['背板材质'], '热镀锌钢板'),
    backThickness: pdfThickness(specs['门框材质'], '2'),
    backProcess: process,
    backTextureLabel: '平板（无纹理）'
  };
};
// Door casing is not the same surface as the leaf.  The exterior casing
// follows the product's catalogue colour, while the interior casing uses the
// shared inner-reveal finish used across the K80 range unless the user picks
// another swatch explicitly.
const defaultCasingColorLabels = (product) => {
  const defaults = catalogReferenceDefaults(product);
  const productFallbacks = {
    qingya: '花繁深古铜1#'
  };
  return {
    outer: defaults.frontReferenceColor || productFallbacks[product] || 'D-22k金色',
    inner: 'D-22k金色'
  };
};
const PRODUCT_META = {
  // These are product-specific defaults inferred from the PDF detail pages.
  // They deliberately do not reuse one generic hardware combination: the
  // photographed light groove, ring ornament, smart lock and clean relief
  // each have a different physical rule.
  ruojian: {
    label: '雅帝若简', prototype: '对开门原型 · 木纹中缝灯带 · 通天拉手', defaultType: 'double',
    supportedTypes: ['single', 'mother', 'double'],
    sideLightMode: 'finish',
    thumbnail: './assets/catalog/k80/products/ruojian/front-b0019857.jpg',
    // PDF 第 31–32 页：R55H 智能锁与 SL48F 橙色通天灯带是若简的
    // 原厂组合，均以独立 3D 五金呈现，避免再把它们从模型中删除。
    supportedLocks: ['none', 'smart'], supportedHandles: ['none', 'long'],
    allowLockWithHandle: true,
    defaultOpening: 'out-left',
    // 实拍图中的数字锁位于左侧主体/活动门扇；默认视图需要保留它，
    // 用户仍可在锁具选项中切换为隐藏锁体。
    defaultLock: 'smart', defaultHandle: 'long'
  },
  yijian: {
    label: '雅帝意简', prototype: '对开门原型 · 木纹中轴 · 横向智能拉手', defaultType: 'double',
    supportedTypes: ['single', 'mother', 'double'], sideLightMode: 'finish',
    thumbnail: './assets/catalog/pdf-previews/k80/yijian/page-04.jpg',
    supportedLocks: ['none', 'smart'], supportedHandles: ['none'], allowLockWithHandle: true,
    defaultLock: 'smart', defaultHandle: 'none'
  },
  heya: {
    label: '雅帝和雅', prototype: '对开门原型 · 深古铜肌理 · 权杖灯带', defaultType: 'double',
    supportedTypes: ['single', 'mother', 'double'], sideLightMode: 'finish',
    thumbnail: './assets/catalog/pdf-previews/k80/heya/page-04.jpg',
    supportedLocks: ['none', 'smart'], supportedHandles: ['none', 'long'], allowLockWithHandle: true,
    defaultLock: 'smart', defaultHandle: 'long'
  },
  ouya: {
    label: '雅帝欧雅', prototype: '对开门原型 · 门玻一体 · 锦檀纹', defaultType: 'double',
    supportedTypes: ['single', 'mother', 'double'], sideLightMode: 'finish',
    thumbnail: './assets/catalog/pdf-previews/k80/ouya/page-04.jpg',
    supportedLocks: ['none', 'smart'], supportedHandles: ['none', 'long'], allowLockWithHandle: true,
    defaultLock: 'smart', defaultHandle: 'long'
  },
  yuanyin: {
    label: '雅帝圆隐', prototype: '子母门原型 · 左小右大 · 圆隐一体饰面', defaultType: 'mother',
    supportedTypes: ['single', 'mother', 'double'],
    sideLightMode: 'finish',
    thumbnail: './assets/catalog/k80/products/yuanyin/front-b0020027.jpg',
    // PDF 正面是门扇一体圆饰/隐形锁，不是两个独立的小圆拉手。
    // 圆饰由专属门扇纹理承载，五金面板只在用户主动选锁时出现。
    supportedLocks: ['none', 'smart'], supportedHandles: ['none'],
    allowLockWithHandle: true,
    defaultLock: 'none', defaultHandle: 'none'
  },
  jiangchuan: {
    label: '雅帝江川赋', prototype: '对开门原型 · 左右连续山水纹', defaultType: 'double',
    supportedTypes: ['single', 'mother', 'double'],
    sideLightMode: 'finish',
    thumbnail: './assets/catalog/k80/products/jiangchuan/front-b0003064.jpg',
    supportedLocks: ['none', 'smart'], supportedHandles: ['none', 'ring'],
    allowLockWithHandle: true,
    // The photographed Jiangchuan door has the two circular pulls integrated
    // into the elevation and no exposed keypad in the default scheme.
    defaultLock: 'none', defaultHandle: 'ring'
  },
  jinghong: {
    label: '雅帝荆虹赋', prototype: '对开门原型 · 中心浮雕合纹', defaultType: 'double',
    supportedTypes: ['single', 'mother', 'double'],
    sideLightMode: 'finish',
    thumbnail: './assets/catalog/k80/products/jinghong/front-b0012993.jpg',
    supportedLocks: ['none', 'smart'], supportedHandles: ['none'],
    allowLockWithHandle: false,
    // Jinghong's photographed front is a continuous relief/medallion with no
    // exposed lock or pull; hardware remains an optional configuration.
    defaultLock: 'none', defaultHandle: 'none',
    // 荆虹赋是完整的双开门连续合纹。真实照片里的中心浮雕约占整门
    // 宽度的一半，默认必须使用原图窗口，不能把主造型再放大。
    // 尺寸变化仍由 setTextureWindow() 扩展/裁切源图窗口完成，不拉伸
    // 底纹或浮雕。源图本身已经是完整对开门，中心浮雕不能再被放大；
    // 这里略微放大取景窗口，让默认浮雕比例回到实拍图的约一半门宽。
    textureZoomDefault: .90
  },
  qingya: {
    label: '雅帝清雅', prototype: '子母门原型 · 左小右大 · 中部灯带', defaultType: 'mother',
    supportedTypes: ['single', 'mother', 'double'],
    sideLightMode: 'finish',
    thumbnail: './assets/catalog/derived/k80/textures/k80-qing-ya-clean-ai-v1.png',
    supportedLocks: ['none', 'smart'], supportedHandles: ['none', 'ring', 'integrated'],
    // 清雅实拍同时有中部灯带/短拉手和一枚智能锁；两者是不同的
    // 物理件，不能因为选锁就把产品自带的灯带互相排斥掉。
    allowLockWithHandle: true,
    defaultLock: 'smart', defaultHandle: 'integrated',
    // Qingya's short gold pull is photographed inside the dark band, but it
    // is a fitting rather than a movable relief. Rebuild it independently.
    integratedHandle: {
      roles: ['main'], mirrorOnDouble: true, centerY: 1.24, scale: 1,
      // 实拍中短金色构件位于中部黑色横带的右侧，和智能锁保持一个
      // 可见的金属间距；不要把它压在门扇中线或锁体背后。
      mainInset: .235, grooveWidth: .058, height: .255, lightWidth: .028,
      railColor: 0xc28a4b, light: 0xe0ad67, intensity: .42,
      areaIntensity: 0, pointIntensity: 0
    }
  },
  qinghuafu: {
    label: '雅帝清华赋', prototype: '对开门原型 · 山水合纹 · 圆月一体饰面', defaultType: 'double',
    supportedTypes: ['single', 'mother', 'double'],
    sideLightMode: 'finish',
    // 卡片也使用同一张去掉 PDF 留白的实拍裁切，避免缩略图把目录页边框
    // 一并带进产品选择区；正面预览和卡片因此保持同一产品取景。
    thumbnail: './assets/catalog/derived/k80/door-skins/k80-qinghuafu-double-leaf.png',
    supportedLocks: ['none', 'smart'], supportedHandles: ['none', 'ring'],
    allowLockWithHandle: false,
    defaultLock: 'none', defaultHandle: 'ring'
  }
};
const COLORWAYS = {
  ruojian: [
    { key: 'yingmu', label: '影木1#', tint: 0xffffff, swatch: '#8b8176' },
    { key: 'oak', label: '美洲橡木1#', tint: 0xffffff, swatch: '#9b7150', texturePath: './assets/catalog/derived/k80/textures/k80-ruo-jian-oak-pixel-v1.png', singleTexturePath: './assets/catalog/derived/k80/textures/k80-ruo-jian-single-oak-v1.png' },
    { key: 'graphite', label: '石墨灰2#', tint: 0xffffff, swatch: '#4a4d50', texturePath: './assets/catalog/derived/k80/textures/k80-ruo-jian-graphite-pixel-v1.png', singleTexturePath: './assets/catalog/derived/k80/textures/k80-ruo-jian-single-graphite-v1.png' }
  ],
  yijian: [
    { key: 'graphite', label: '石墨灰2#', tint: 0xffffff, swatch: '#45484a' },
    { key: 'oak', label: '美洲橡木1#', tint: 0xffffff, swatch: '#9b7150' }
  ],
  heya: [
    { key: 'deep-bronze', label: '花絮深古铜1#', tint: 0xffffff, swatch: '#4e4038' }
  ],
  ouya: [
    { key: 'gold', label: 'K金色', tint: 0xffffff, swatch: '#ba9463' },
    { key: 'graphite', label: '石墨灰2#', tint: 0xffffff, swatch: '#45484a' }
  ],
  yuanyin: [
    { key: 'bronze', label: '花繁深古铜1#', tint: 0xffffff, swatch: '#5e4b3d' },
    { key: 'silver', label: '花繁银灰1#', tint: 0xd6e0e6, swatch: '#8d9295' },
    { key: 'champagne', label: '香槟铜', tint: 0xffd6aa, swatch: '#a77a50' }
  ],
  jiangchuan: [
    { key: 'green-bronze', label: '花繁青古铜4#', tint: 0xffffff, swatch: '#655f51' },
    { key: 'graphite', label: '石墨灰2#', tint: 0xc3c9cb, swatch: '#4b4d4c' },
    { key: 'deep-bronze', label: '深古铜', tint: 0xe2c09d, swatch: '#604737' }
  ],
  jinghong: [
    { key: 'green-bronze', label: '花繁青古铜3#', tint: 0xffffff, swatch: '#615e50' },
    { key: 'silver', label: '花繁银灰3#', tint: 0xd5dee1, swatch: '#878b8c' },
    { key: 'ink-gold', label: '墨金', tint: 0xe5c498, swatch: '#574a3b' }
  ],
  qingya: [
    { key: 'original', label: '原始工艺色', tint: 0xffffff, swatch: '#766d63' },
    { key: 'green-bronze', label: '青古铜', tint: 0xd7c5a3, swatch: '#625b4a' },
    { key: 'graphite', label: '石墨灰', tint: 0xbfc5c8, swatch: '#484a4b' }
  ],
  qinghuafu: [
    { key: 'ink-green', label: '墨绿雨花点', tint: 0xffffff, swatch: '#263b32' },
    { key: 'green-bronze', label: '青古铜6#', tint: 0xc9aa70, swatch: '#6b634a' },
    { key: 'deep-green', label: '深墨绿', tint: 0xc9d3c7, swatch: '#172a24' }
  ]
};
const TEXTURE_VARIANTS = [
  { key: 'factory', label: '原厂纹理', note: '保持实拍的金属反射', filter: 'none', roughness: .30, metalness: .55, bumpScale: .010, clearcoat: .20 },
  { key: 'relief', label: '浮雕强化', note: '增强凹凸与细纹层次', filter: 'contrast(1.08) saturate(1.06)', roughness: .23, metalness: .68, bumpScale: .015, clearcoat: .26 },
  { key: 'matte', label: '哑光拉丝', note: '降低高光，突出拉丝方向', filter: 'contrast(.94) saturate(.92)', roughness: .38, metalness: .48, bumpScale: .012, clearcoat: .12 }
];
const requestedProduct = new URLSearchParams(location.search).get('product') || 'ruojian';
const initialProduct = PRODUCT_ALIASES[requestedProduct] || requestedProduct;
const lockedProduct = PRODUCT_META[initialProduct] ? initialProduct : 'ruojian';
const referenceDefaults = catalogReferenceDefaults(lockedProduct);
const PRODUCT_HARDWARE_DEFAULTS = {
  ruojian: { lockPanelCode: 'R55H', handleCode: 'SL48F' },
  yijian: { lockPanelCode: 'R55H', handleCode: 'none' },
  heya: { lockPanelCode: 'R55H', handleCode: 'SL48F' },
  ouya: { lockPanelCode: 'R55H', handleCode: 'SL48F' },
  yuanyin: { lockPanelCode: 'YTF11', handleCode: 'SL-116' },
  jiangchuan: { lockPanelCode: 'YTF11', handleCode: 'JC-RING' },
  jinghong: { lockPanelCode: 'F07D', handleCode: 'SL-62' },
  qinghuafu: { lockPanelCode: 'YTF07D', handleCode: 'QHF-MOON' },
  qingya: { lockPanelCode: 'YTF11', handleCode: 'QY-BAR' }
};
const hardwareDefaults = PRODUCT_HARDWARE_DEFAULTS[lockedProduct] || PRODUCT_HARDWARE_DEFAULTS.ruojian;
const productHardwareDefaults = (product = state?.product || lockedProduct) => PRODUCT_HARDWARE_DEFAULTS[product] || PRODUCT_HARDWARE_DEFAULTS.ruojian;
const initialCasingColors = defaultCasingColorLabels(lockedProduct);

const state = {
  product: lockedProduct,
  type: PRODUCT_META[lockedProduct].defaultType,
  frontFinish: lockedProduct,
  backFinish: lockedProduct,
  frontColor: COLORWAYS[lockedProduct][0].key,
  backColor: COLORWAYS[lockedProduct][0].key,
  textureVariant: 'factory',
  frontTextureVariant: 'factory',
  backTextureVariant: 'factory',
  textureSurface: 'factory',
  frontTextureSurface: 'factory',
  backTextureSurface: 'factory',
  textureFace: 'front',
  textureRegion: 'pair',
  frontRegionTextures: {},
  backRegionTextures: {},
  frontRegionDesigns: {},
  backRegionDesigns: {},
  transom: false,
  transomType: 'none',
  lock: PRODUCT_META[lockedProduct].defaultLock,
  handle: PRODUCT_META[lockedProduct].defaultHandle,
  opening: PRODUCT_META[lockedProduct].defaultOpening || 'out-right',
  hinge: 'k80-hidden',
  wallThickness: 240,
  frameInstall: 'center',
  frameBuild: 'integral',
  handleOffsetXMm: 0,
  handleOffsetMm: 0,
  handleScale: 1,
  integratedLightEnabled: true,
  integratedLightColor: 'factory',
  integratedLightIntensity: 1,
  ringLightEnabled: true,
  ringLightColor: 'amber',
  ringLightIntensity: 1,
  // Reference-AI / K80 workbook fields. These remain separate from the
  // renderer's legacy texture and hardware keys so old saved schemes keep
  // loading while the BOM receives the complete selection chain.
  surfaceSeries: 'K80AL',
  frontMaterial: referenceDefaults.frontMaterial,
  frontThickness: referenceDefaults.frontThickness,
  frontProcess: referenceDefaults.frontProcess,
  frontTextureLabel: referenceDefaults.frontTextureLabel,
  backMaterial: referenceDefaults.backMaterial,
  backThickness: referenceDefaults.backThickness,
  backProcess: referenceDefaults.backProcess,
  backTextureLabel: referenceDefaults.backTextureLabel,
  frontReferenceColor: referenceDefaults.frontReferenceColor || COLORWAYS[lockedProduct][0]?.label || '影木1#',
  backReferenceColor: referenceDefaults.backReferenceColor || COLORWAYS[lockedProduct][0]?.label || '影木1#',
  outerCasing: 'P40',
  outerCasingColor: initialCasingColors.outer,
  innerCasing: 'W型',
  innerCasingColor: initialCasingColors.inner,
  frameProfile: 'P40',
  frameColor: 'D-22k金色',
  threshold: '标配底槛加高',
  thresholdLightEnabled: true,
  thresholdDrainEnabled: false,
  thresholdNote: '加高30mm',
  wallIntegrated: 'none',
  wallModule: 'none',
  wallLightEnabled: false,
  transomFlowerEnabled: true,
  transomMainMaterial: '铝花件',
  transomMainThickness: '3',
  transomMainProcess: '浮雕',
  transomSecondaryStyle: '花枝',
  transomSecondaryThickness: '4',
  transomSecondaryProcess: '单面简雕镂空',
  transomOuterGlass: '无',
  transomInnerGlass: '无',
  transomOuterGlassThickness: '5MM',
  transomInnerGlassThickness: '5MM',
  lockPanelCode: hardwareDefaults.lockPanelCode,
  handleCode: hardwareDefaults.handleCode,
  sealCode: 'EPDM-江阴海达',
  hingeCode: 'K80单轴暗合页',
  frameAtmosphereLightEnabled: true,
  showroomLightMode: 'gallery',
  showroomLightEnabled: true,
  showroomLightIntensity: 1,
  showroomVisible: false,
  lockOffsetXMm: 0,
  lockOffsetMm: 0,
  lockScale: 1,
  textureZoom: PRODUCT_META[lockedProduct].textureZoomDefault || 1,
  texturePanX: 0,
  texturePanY: 0,
  width: 2100,
  height: 2600,
  open: false,
  view: 'perspective',
  aiScenes: []
};

const typeSpecs = {
  single: { width: [900, 1300, 1000], height: [2200, 3000, 2400], label: '单门', mainRatio: 1 },
  mother: { width: [1100, 1700, 1300], height: [2300, 3100, 2600], label: '子母门', mainRatio: .72 },
  double: { width: [1800, 2400, 2100], height: [2300, 3200, 2600], label: '对开门', mainRatio: .5 },
  sideLight: { width: [1600, 2300, 1900], height: [2300, 3100, 2600], label: '中庭', mainRatio: 1, sideCount: 1 },
  doubleSide: { width: [2400, 3600, 3000], height: [2300, 3200, 2600], label: '双边边门', mainRatio: .5, sideCount: 2 }
};
// The guided selector passes the chosen door form into the GLB configurator.
// Keep the product's own supported-type rules authoritative, then initialise
// the dimension controls from that type instead of silently returning to the
// generic double-door defaults.
const requestedType = new URLSearchParams(location.search).get('type');
if (requestedType && typeSpecs[requestedType] && PRODUCT_META[lockedProduct].supportedTypes.includes(requestedType)) {
  state.type = requestedType;
  state.width = typeSpecs[requestedType].width[2];
  state.height = typeSpecs[requestedType].height[2];
}
const UNIVERSAL_DOOR_TYPES = ['single', 'mother', 'double'];

const hasChildLeafType = (type = state.type) => ['mother', 'double', 'doubleSide'].includes(type);
const hasSideLightType = (type = state.type) => ['sideLight', 'doubleSide'].includes(type);

// K80 product defaults come from the photographed product, not from a
// generic hardware preset.  `roles` is the physical leaf that owns the
// fitting; it prevents a single smart lock from being cloned onto both leaves
// while allowing the photographed double ring pulls to remain symmetric.
const K80_HARDWARE_PROFILES = {
  ruojian: {
    // PDF detail page 3 places the exterior keypad on the visual left leaf.
    // 若简当前版本不加载拉手或灯带模型，只保留锁具的主体门扇归属。
    smart: { roles: ['child'], doubleRoles: ['child'], centerY: 1.10, scale: .86, singleOffsetX: -.135 },
  },
  yijian: { smart: { roles: ['main'], doubleRoles: ['main'], centerY: 1.10, scale: .78 } },
  heya: { smart: { roles: ['main'], doubleRoles: ['main'], centerY: 1.10, scale: .78 } },
  ouya: { smart: { roles: ['main'], doubleRoles: ['main'], centerY: 1.10, scale: .78 } },
  yuanyin: { ring: { roles: ['main', 'child'], centerY: 1.10, scale: .96, appearance: 'bronze-ring' } },
  jiangchuan: {
    smart: { roles: ['main'], doubleRoles: ['main', 'child'], centerY: 1.08, scale: .78 },
    // PDF 中两个圆环是门面上的真实大圆饰，每扇约占门扇宽度的
    // 18% 左右；适度放大模型实例，避免被缩成“小圆拉手”。
    // The photographed pair of rings sits in the lower half of the leaf,
    // not on the visual centre line. Keep its authored size and lower the
    // shared datum to match the PDF elevation.
    ring: { roles: ['main', 'child'], centerY: .96, scale: 1.14, appearance: 'gold-ring' }
  },
  jinghong: { smart: { roles: ['main'], doubleRoles: ['main', 'child'], centerY: 1.08, scale: .78 } },
  qingya: {
    ring: { roles: ['main'], centerY: 1.14, scale: .86, appearance: 'gold-ring' },
    // The photographed smart lock and the short gold light/pull share the
    // dark horizontal band, but sit side-by-side. Keep the integrated pull
    // on the inner side of the main leaf and leave the lock's authored datum
    // on the opposite side instead of letting the two groups overlap.
    integrated: { roles: ['main'], centerY: 1.02, scale: 1, mainInset: .235 }
  },
  qinghuafu: {
    // 清华赋原图中央的“满月”不是烘焙在门面的装饰，而是 YTF07D/SL-85
    // 组合五金的正面投影。使用 GLB 内的圆环组，固定在主门扇的中缝侧，
    // 子母门仍保持一只主门拉手，对开门不会复制成两只互相重叠的圆环。
    // The photographed moon spans the meeting-stile area of both leaves;
    // the GLB ring therefore needs a product-specific scale instead of the
    // small generic ring preset used by single-leaf products.
    // The catalogue elevation places the round pull below the landscape
    // relief, around the middle/lower section of the leaf. `centerY` is the
    // Three.js vertical datum (not the texture percentage), so keep this
    // separate from the smart-lock height used by the generic hardware
    // profile. The authored ring datum is already correct; applying the old
    // 0.08 value moved the fitting nearly one metre too low.
    // The photographed light-up moon handle is a compact circular pull. The
    // previous 2.35 profile came from the raw GLB authoring scale and made it
    // read like a large portal on the door; keep the authored centre datum,
    // but render the fitting at roughly half that size.
    ring: { roles: ['main'], centerY: 1.08, scale: 1.18, appearance: 'gold-ring' },
    smart: { roles: ['main'], doubleRoles: ['main', 'child'], centerY: 1.08, scale: .78 }
  }
};

// Product-level light choices. The light remains attached to the photographed
// fitting and never becomes a generic overlay on another finish. Qinghuafu's
// round moon pull uses the same colour language as the integrated channels,
// but has its own state because it is a different physical fitting.
const K80_LIGHT_PROFILES = {
  qingya: {
    defaultColor: 'gold',
    colors: [
      { key: 'gold', label: '香槟金', value: 0xe0ad67 },
      { key: 'warm-white', label: '暖白光', value: 0xffe7c4 },
      { key: 'smoke', label: '低亮古铜', value: 0x9b6846 }
    ],
    defaultIntensity: 1
  },
  qinghuafu: {
    defaultColor: 'amber',
    colors: [
      { key: 'amber', label: '琥珀暖光', value: 0xffb95f },
      { key: 'gold', label: '香槟金', value: 0xffd18a },
      { key: 'warm-white', label: '暖白光', value: 0xfff0d0 },
      { key: 'smoke', label: '低亮古铜', value: 0x9b6846 }
    ],
    defaultIntensity: 1
  }
};

const K80_HARDWARE_GROUPS = {
  long: 'Long',
  smart: 'Smart',
  ring: 'Ring',
  recess: 'Recess',
  concealed: 'Concealed',
  integrated: 'Integrated'
};
const K80_HARDWARE_BASE_Y = { long: 1.31, smart: 1.10, ring: 1.08, recess: 1.18, concealed: 1.08, integrated: 1.22 };

// The PDF hardware references are separate product parts, not the generic
// placeholder meshes baked into yadilo-door-custom.glb. Keep the source GLBs
// keyed by their catalogue codes so a handle/lock change swaps the complete
// assembly instead of stretching one shared proxy.
const K80_REFERENCE_HARDWARE_ASSETS = {
  'SL48F': { role: 'long', path: './assets/models/hardware/k80-sl48f-full-height-pull.glb?v=20260815.81' },
  'SL-115': { role: 'long', path: './assets/models/hardware/k80-sl115-fixed-pull.glb?v=20260815.81' },
  'SL-108': { role: 'long', path: './assets/models/hardware/k80-sl108-fixed-pull.glb?v=20260815.81' },
  R55H: { role: 'smart', path: './assets/models/hardware/k80-r55h-smart-lock.glb?v=20260815.81' },
  F07D: { role: 'smart', path: './assets/models/hardware/k80-f07d-sliding-smart-lock.glb?v=20260815.81' },
  YTF07D: { role: 'smart', path: './assets/models/hardware/k80-ytf07d-sliding-smart-lock.glb?v=20260815.87' },
  'JC-RING': { role: 'ring', path: './assets/models/hardware/k80-jiangchuan-round-pull.glb?v=20260815.87' },
  'QY-BAR': { role: 'integrated', path: './assets/models/hardware/k80-qingya-center-pull.glb?v=20260815.87' },
  'QHF-MOON': { role: 'ring', path: './assets/models/hardware/k80-qinghuafu-moon-pull.glb?v=20260815.87' }
};
const k80ReferenceHardwareCache = new Map();

const finishAssets = {
  ruojian: {
    master: './assets/catalog/derived/k80/textures/k80-ruo-jian-clean-ai-v1.png',
    doubleLeaf: './assets/catalog/derived/k80/door-skins/k80-ruojian-double-leaf.png'
  },
  yijian: { master: './assets/catalog/derived/k80/door-skins/k80-yijian-double-leaf.png' },
  heya: { master: './assets/catalog/derived/k80/door-skins/k80-heya-double-leaf.png' },
  ouya: { master: './assets/catalog/derived/k80/door-skins/k80-ouya-double-leaf.png' },
  yuanyin: {
    // 使用 PDF 第 75 页的完整正面取景：圆饰/隐形锁是产品门扇的一体
    // 设计，不能再用净纹理加两个通用圆环去拼。
    master: './assets/catalog/derived/k80/textures/k80-yuan-yin-clean-v2.png',
    doubleLeaf: './assets/catalog/derived/k80/textures/k80-yuan-yin-clean-v2.png',
    base: './assets/catalog/derived/k80/textures/k80-yuan-yin-base-ai-v2.png'
  },
  jiangchuan: {
    master: './assets/catalog/derived/k80/textures/k80-jiang-chuan-clean-v2.png',
    doubleLeaf: './assets/catalog/derived/k80/textures/k80-jiang-chuan-clean-v2.png',
    base: './assets/catalog/derived/k80/textures/k80-jiang-chuan-base-ai-v1.png'
  },
  jinghong: {
    master: './assets/catalog/derived/k80/textures/k80-jing-hong-clean-ai-v1.png',
    doubleLeaf: './assets/catalog/derived/k80/door-skins/k80-jinghong-double-leaf.png',
    base: './assets/catalog/derived/k80/textures/k80-jing-hong-base-ai-v1.png'
  },
  qingya: {
    master: './assets/catalog/derived/k80/textures/k80-qing-ya-clean-ai-v1.png',
    motherChild: './assets/catalog/derived/k80/door-skins/k80-qingya-mother-child.png',
    motherMain: './assets/catalog/derived/k80/door-skins/k80-qingya-mother-main.png',
    'base-child': './assets/catalog/derived/k80/textures/k80-qing-ya-base-child-ai-v2.png',
    'base-main': './assets/catalog/derived/k80/textures/k80-qing-ya-base-main-ai-v2.png'
  },
  qinghuafu: {
    // The source photo remains available as the catalogue thumbnail. The
    // render map removes only the baked central moon so the GLB hardware is
    // the single source of truth for the handle and its depth/light.
    master: './assets/catalog/derived/k80/door-skins/k80-qinghuafu-clean-hardware-v1.png',
    doubleLeaf: './assets/catalog/derived/k80/door-skins/k80-qinghuafu-clean-hardware-v1.png',
    base: './assets/catalog/derived/k80/textures/k80-qing-hua-fu-base-ai-v1.png'
  }
};

const finishProfiles = {
  // These are not generic repeatable textures. Each source map is split into
  // physical leaf assets; only compatible door assemblies are offered.
  ruojian: {
    baseType: 'double',
    supportedTypes: ['single', 'mother', 'double'],
    textureParts: { child: 'master', main: 'master', doubleComposition: true }
  },
  yijian: { baseType: 'double', supportedTypes: ['single', 'mother', 'double'], textureParts: { child: 'master', main: 'master', doubleComposition: true } },
  heya: { baseType: 'double', supportedTypes: ['single', 'mother', 'double'], textureParts: { child: 'master', main: 'master', doubleComposition: true } },
  ouya: { baseType: 'double', supportedTypes: ['single', 'mother', 'double'], textureParts: { child: 'master', main: 'master', doubleComposition: true } },
  yuanyin: {
    baseType: 'mother',
    supportedTypes: ['single', 'mother', 'double'],
    textureParts: { child: 'master', main: 'master', doubleComposition: true }
  },
  jiangchuan: {
    baseType: 'double',
    supportedTypes: ['single', 'mother', 'double'],
    // 左右门扇共享同一张完整山水图：中缝只是物理分界，不能把一扇
    // 镜像到另一扇。左右移动时也要整体平移这张完整画面，保持画面连续。
    textureParts: { child: 'master', main: 'master', doubleComposition: true, composition: 'continuous' }
  },
  jinghong: {
    baseType: 'double',
    supportedTypes: ['single', 'mother', 'double'],
    textureParts: { child: 'master', main: 'master', doubleComposition: true }
  },
  qingya: {
    baseType: 'mother',
    supportedTypes: ['single', 'mother', 'double'],
    textureParts: { child: 'motherChild', main: 'motherMain' }
  },
  qinghuafu: {
    baseType: 'double',
    supportedTypes: ['single', 'mother', 'double'],
    textureParts: { child: 'master', main: 'master', doubleComposition: true }
  }
};

// `pair` is an explicit synchronized edit channel. `child` and `main` remain
// independent channels so a customer can deliberately change only the left
// or right leaf without losing the authored texture coordinates.
function textureEditKey(region) {
  return region === 'pair' ? 'pair' : region;
}

function textureContentRegion(region, type = state.type) {
  if (state.textureRegion === 'pair' && ['child', 'main'].includes(region)) return 'main';
  return textureEditKey(region, type) === 'pair' ? 'main' : textureEditKey(region, type);
}

// Keep the canonical type through to the renderer.  Each option below has its
// own runtime assembly; only the legacy "integrated" record shares the square
// true-transom construction.
function transomRenderMode(type = state.transomType) {
  if (!type || type === 'none') return 'none';
  if (type === 'door-extended') return 'door-extended';
  if (type === 'integrated') return 'square-true';
  return ['square-true', 'square-fake', 'square-glass', 'round-true', 'round-fake', 'round-glass'].includes(type)
    ? type
    : 'none';
}

function textureRegionsForType(type = state.type) {
  let regions;
  if (type === 'mother' || type === 'double') regions = ['pair', 'child', 'main'];
  else if (type === 'sideLight') regions = ['main', 'sideLeft'];
  else if (type === 'doubleSide') regions = ['pair', 'child', 'main', 'sideLeft', 'sideRight'];
  else regions = ['main'];
  if (state.transom && transomRenderMode() !== 'door-extended') regions.push('transom');
  return regions;
}

function transomHeightForMode(mode, openingWidth, height) {
  if (mode.startsWith('round')) {
    // A true round head is materially taller than a rectangular light. The
    // catalogue reference allocates roughly a quarter of the full doorway to
    // the fanlight; keeping the generic 340 mm strip flattened the arch into
    // an implausible shallow canopy.
    return Math.min(height * .30, Math.max(.52, openingWidth * .37));
  }
  return BASE.transom;
}

function textureRegionLabel(region, type = state.type) {
  if (region === 'pair') return type === 'mother' ? '子母门扇（同步）' : type === 'doubleSide' ? '主门扇（同步）' : '双门扇（同步）';
  if (region === 'child') return type === 'mother' ? '左侧子门（窄）' : ['double', 'doubleSide'].includes(type) ? '左侧门扇' : '子门扇';
  if (region === 'main') return type === 'mother' ? '右侧主门（宽）' : ['double', 'doubleSide'].includes(type) ? '右侧门扇' : '主门扇';
  if (region === 'sideLeft') return '左边门';
  if (region === 'sideRight') return '右边门';
  if (region === 'transom') return '气窗';
  return '门扇';
}

function textureSettings(face = state.textureFace, region = state.textureRegion) {
  const isBack = face === 'back';
  const storeKey = isBack ? 'backRegionTextures' : 'frontRegionTextures';
  const legacyColor = isBack ? state.backColor : state.frontColor;
  const legacyVariant = isBack ? state.backTextureVariant : state.frontTextureVariant;
  const legacySurface = isBack ? state.backTextureSurface : state.frontTextureSurface;
  const store = state[storeKey] ||= {};
  const editKey = textureEditKey(region);
  // When a leaf has never been edited independently, inherit the synchronized
  // pair value. Once the user changes that leaf, its own copy takes priority.
  // Selecting `pair` explicitly always uses the pair channel for both leaves.
  let current = editKey === 'pair' || state.textureRegion === 'pair'
    ? store.pair
    : store[editKey] || store.pair;
  if (!current || typeof current !== 'object') {
    const legacy = editKey === 'pair' ? (store.main || store.child) : null;
    current = legacy && typeof legacy === 'object' ? { ...legacy } : legacy;
  } else if (editKey !== 'pair' && !store[editKey]) {
    current = { ...current };
  }
  if (!current || typeof current !== 'object') {
    current = {
      color: typeof current === 'string' ? current : legacyColor,
      variant: legacyVariant || 'factory',
      surface: legacySurface || state.textureSurface || 'factory'
    };
  } else {
    current.color ||= legacyColor;
    current.variant ||= legacyVariant || 'factory';
    current.surface ||= legacySurface || state.textureSurface || 'factory';
  }
  // Do not persist an inherited pair object under the leaf key until a value
  // is changed there; this keeps the synchronized channel authoritative.
  if (editKey === 'pair' || store[editKey]) store[editKey] = current;
  return current;
}

function setTextureSetting(face, region, key, value) {
  const settings = textureSettings(face, region);
  settings[key] = value;
  const store = face === 'back' ? (state.backRegionTextures ||= {}) : (state.frontRegionTextures ||= {});
  store[textureEditKey(region)] = settings;
  if (textureEditKey(region) === 'main' || textureEditKey(region) === 'pair') {
    if (face === 'front' && key === 'color') state.frontColor = value;
    if (face === 'back' && key === 'color') state.backColor = value;
    if (face === 'front' && key === 'variant') state.frontTextureVariant = value;
    if (face === 'back' && key === 'variant') state.backTextureVariant = value;
    if (face === 'front' && key === 'surface') state.frontTextureSurface = value;
    if (face === 'back' && key === 'surface') state.backTextureSurface = value;
  }
}

function textureDesignSettings(face = state.textureFace, region = state.textureRegion) {
  const storeKey = face === 'back' ? 'backRegionDesigns' : 'frontRegionDesigns';
  const store = state[storeKey] ||= {};
  const editKey = textureEditKey(region);
  const contentRegion = textureContentRegion(region);
  const designs = getTextureDesigns('k80', state.product, contentRegion).filter((item) => item.mode !== 'none');
  const fallback = getDefaultTextureDesign('k80', state.product, contentRegion);
  let current = editKey === 'pair' || state.textureRegion === 'pair'
    ? store.pair
    : store[editKey] || store.pair;
  if (!current || typeof current !== 'object') {
    const legacy = editKey === 'pair' ? (store.main || store.child) : null;
    current = legacy && typeof legacy === 'object' ? { ...legacy } : legacy;
  } else if (editKey !== 'pair' && !store[editKey]) {
    current = { ...current };
  }
  if (!current || typeof current !== 'object') {
    current = {
      key: current && typeof current === 'string' ? current : fallback?.key || 'factory',
      offsetX: 0,
      offsetY: 0,
      scale: fallback?.defaultScale || 1
    };
  } else {
    if (!designs.some((item) => item.key === current.key)) current.key = fallback?.key || designs[0]?.key || 'factory';
    current.offsetX ??= 0;
    current.offsetY ??= 0;
    current.scale ??= fallback?.defaultScale || 1;
  }
  if (editKey === 'pair' || store[editKey]) store[editKey] = current;
  return current;
}

function setTextureDesignSetting(face, region, key, value) {
  const settings = textureDesignSettings(face, region);
  settings[key] = value;
  const store = face === 'back' ? (state.backRegionDesigns ||= {}) : (state.frontRegionDesigns ||= {});
  store[textureEditKey(region)] = settings;
}

function setTextureSurfaceForFace(face, surface) {
  state.textureSurface = surface;
  setTextureSetting(face, state.textureRegion, 'surface', surface);
  if (face === 'front') state.frontTextureSurface = surface;
  if (face === 'back') state.backTextureSurface = surface;
}

function renderTextureRegionControls() {
  const grid = $('#textureRegionGrid');
  if (!grid) return;
  const regions = textureRegionsForType();
  const editKey = textureEditKey(state.textureRegion);
  if (!regions.includes(state.textureRegion)) state.textureRegion = regions.includes(editKey) ? editKey : regions[0];
  const regionHint = $('#textureRegionHint');
  if (regionHint) {
    regionHint.textContent = state.type === 'mother'
      ? '同步调整 / 左侧子门（窄） / 右侧主门（宽）'
      : '同步调整 / 左侧门扇 / 右侧门扇';
  }
  const regionNote = (region) => {
    if (region === 'transom') return '独立气窗材质';
    if (region === 'pair') return state.type === 'mother' ? '左窄右宽同步调整' : '左右门扇同步调整';
    if (region === 'child') return state.type === 'mother' ? '只修改左侧窄子门' : '只修改左侧门扇';
    if (region === 'main') return state.type === 'mother' ? '只修改右侧宽主门' : '只修改右侧门扇';
    return '边门独立调整';
  };
  grid.innerHTML = regions.map((region) => `
    <button type="button" class="texture-region-card${region === state.textureRegion ? ' selected' : ''}" data-texture-region="${region}">
      <b>${textureRegionLabel(region)}</b><small>${regionNote(region)}</small>
    </button>`).join('');
  $$('[data-texture-region]').forEach((button) => button.addEventListener('click', () => {
    state.textureRegion = button.dataset.textureRegion;
    renderProductControls();
    updateTextureUi();
    syncConfigurationUi();
  }));
}

function currentColorway(face = state.textureFace, region = state.textureRegion) {
  const selected = textureSettings(face, region).color;
  return COLORWAYS[state.product].find((item) => item.key === selected) || COLORWAYS[state.product][0];
}

function currentTextureVariant(face = state.textureFace, region = state.textureRegion) {
  const selected = textureSettings(face, region).variant;
  return TEXTURE_VARIANTS.find((item) => item.key === (selected || state.textureVariant)) || TEXTURE_VARIANTS[0];
}

function currentTextureSurface(face = state.textureFace, region = state.textureRegion) {
  return getTextureSurface(textureSettings(face, region).surface || state.textureSurface || 'factory');
}

function currentTextureDesign(face = state.textureFace, region = state.textureRegion) {
  const settings = textureDesignSettings(face, region);
  const designs = getTextureDesigns('k80', state.product, textureContentRegion(region)).filter((item) => item.mode !== 'none');
  return designs.find((item) => item.key === settings.key) || designs[0] || null;
}

function renderTextureDesignControls() {
  const grid = $('#designPresetGrid');
  const tools = $('#designLayerTools');
  if (!grid || !tools) return;
  const heading = $('#designLayerHeading');
  const designs = getTextureDesigns('k80', state.product, textureContentRegion(state.textureRegion)).filter((item) => item.mode !== 'none');
  if (!designs.length) {
    if (heading) heading.hidden = true;
    grid.hidden = true;
    tools.hidden = true;
    return;
  }
  if (heading) heading.hidden = false;
  grid.hidden = false;
  const settings = textureDesignSettings(state.textureFace, state.textureRegion);
  const active = currentTextureDesign();
  if (!designs.length) {
    grid.innerHTML = '<span class="design-empty-note">本分区为产品一体底纹，不拆分主造型。</span>';
    tools.hidden = true;
    return;
  }
  grid.innerHTML = designs.map((item) => `
    <button type="button" class="design-preset-card${item.key === active?.key ? ' selected' : ''}" data-design-preset="${item.key}">
      <span class="design-preset-mark design-preset-${item.key}${item.preview ? ' has-preview' : ''}" data-design-preview="${item.preview || ''}"></span><b>${item.label}</b><small>${item.note}</small>
    </button>`).join('');
  grid.querySelectorAll('[data-design-preview]').forEach((mark) => {
    if (mark.dataset.designPreview) mark.style.backgroundImage = `url("${mark.dataset.designPreview}")`;
  });
  tools.hidden = false;
  const x = $('#designOffsetXSlider');
  const y = $('#designOffsetYSlider');
  const scale = $('#designScaleSlider');
  if (x) x.value = String(Math.round((settings.offsetX || 0) * 100));
  if (y) y.value = String(Math.round((settings.offsetY || 0) * 100));
  if (scale) scale.value = String(settings.scale ?? 1);
  const xOutput = $('#designOffsetXOutput');
  const yOutput = $('#designOffsetYOutput');
  const scaleOutput = $('#designScaleOutput');
  if (xOutput) xOutput.textContent = `${settings.offsetX > 0 ? '+' : ''}${Math.round((settings.offsetX || 0) * 100)}%`;
  if (yOutput) yOutput.textContent = `${settings.offsetY > 0 ? '+' : ''}${Math.round((settings.offsetY || 0) * 100)}%`;
  if (scaleOutput) scaleOutput.textContent = `${Math.round((settings.scale || 1) * 100)}%`;
  $$('[data-design-preset]').forEach((button) => button.addEventListener('click', async () => {
    const next = getTextureDesigns('k80', state.product, textureContentRegion(state.textureRegion)).filter((item) => item.mode !== 'none').find((item) => item.key === button.dataset.designPreset);
    setTextureDesignSetting(state.textureFace, state.textureRegion, 'key', next?.key || 'factory');
    if (next?.defaultScale) setTextureDesignSetting(state.textureFace, state.textureRegion, 'scale', next.defaultScale);
    renderProductControls();
    await applyLeafTextures();
  }));
}

function createTextureVariant(source, variantKey) {
  const variant = TEXTURE_VARIANTS.find((item) => item.key === variantKey) || TEXTURE_VARIANTS[0];
  if (variant.key === 'factory' || !source?.image) {
    const clone = source.clone();
    clone.colorSpace = THREE.SRGBColorSpace;
    return clone;
  }
  const image = source.image;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.filter = variant.filter || 'none';
  context.drawImage(image, 0, 0);
  if (variant.key === 'relief') {
    context.save();
    context.globalAlpha = .14;
    context.globalCompositeOperation = 'overlay';
    context.filter = 'contrast(1.5) brightness(1.06)';
    context.drawImage(image, 1, 1, image.width - 2, image.height - 2);
    context.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function renderProductControls() {
  const meta = PRODUCT_META[state.product];
  const supportedLocks = meta.supportedLocks || ['none', 'smart'];
  const supportedHandles = meta.supportedHandles || ['none'];
  if (!supportedLocks.includes(state.lock)) state.lock = meta.defaultLock;
  if (!supportedHandles.includes(state.handle)) state.handle = meta.defaultHandle;
  const handleFieldTitle = $('#handleFieldTitle');
  const handleFieldNote = $('#handleFieldNote');
  const hasStructuralChannel = Boolean(state.product === 'ruojian' && meta.integratedHandle);
  if (handleFieldTitle) handleFieldTitle.textContent = hasStructuralChannel ? '主体门凹槽灯带' : '外拉手';
  if (handleFieldNote) handleFieldNote.textContent = hasStructuralChannel
    ? '固定结构 · 位于主体门扇，不作为外拉手选配'
    : '按产品照片显示可用结构';
  $$('[data-lock]').forEach((button) => {
    const supported = supportedLocks.includes(button.dataset.lock);
    button.hidden = !supported;
    button.disabled = !supported;
  });
  $$('[data-handle]').forEach((button) => {
    const supported = supportedHandles.includes(button.dataset.handle);
    button.hidden = !supported;
    button.disabled = !supported;
    const copy = PRODUCT_HANDLE_CARD_COPY[state.product]?.[button.dataset.handle];
    if (copy) {
      const title = button.querySelector('b');
      const note = button.querySelector('small');
      if (title) title.textContent = copy.label;
      if (note) note.textContent = copy.note;
    }
  });
  $('#productName').textContent = meta.label;
  $('#productPrototype').textContent = `${meta.prototype} · 产品结构锁定，正背面纹理可定制`;
  $('#productThumb').style.backgroundImage = `url('${meta.thumbnail}')`;
  $('#frontFinishName').textContent = meta.label;
  $('#backFinishName').textContent = meta.label;
  document.title = `${meta.label} · K80 私人定制`;
  renderTextureRegionControls();
  const colorwayGrid = $('#colorwayGrid');
  if (colorwayGrid) {
    const selected = currentColorway();
    colorwayGrid.innerHTML = COLORWAYS[state.product].map((item) => `
      <button type="button" class="colorway-card${item.key === selected.key ? ' selected' : ''}" data-colorway="${item.key}">
        <span class="colorway-swatch" style="background:${item.swatch}"></span><b>${item.label}</b>
      </button>`).join('');
    $$('[data-colorway]').forEach((button) => button.addEventListener('click', async () => {
      setTextureSetting(state.textureFace, state.textureRegion, 'color', button.dataset.colorway);
      renderProductControls();
      await applyLeafTextures();
    }));
  }
  const activeSurface = currentTextureSurface();
  const surfaceGrid = $('#textureSurfaceGrid');
  if (surfaceGrid) {
    surfaceGrid.innerHTML = TEXTURE_SURFACES.map((item) => `
      <button type="button" class="texture-surface-card${item.key === activeSurface.key ? ' selected' : ''}" data-texture-surface="${item.key}">
        <span class="texture-surface-swatch texture-surface-${item.key}"></span><b>${item.label}</b><small>${item.note}</small>
      </button>`).join('');
    $$('[data-texture-surface]').forEach((button) => button.addEventListener('click', async () => {
      setTextureSurfaceForFace(state.textureFace, button.dataset.textureSurface);
      renderProductControls();
      await applyLeafTextures();
    }));
  }
  const activeVariant = currentTextureVariant();
  const variantGrid = $('#textureVariantGrid');
  if (variantGrid) {
    variantGrid.innerHTML = TEXTURE_VARIANTS.map((item) => `
      <button type="button" class="texture-variant-card${item.key === activeVariant.key ? ' selected' : ''}" data-texture-variant="${item.key}">
        <span class="texture-variant-swatch texture-variant-${item.key}"></span><b>${item.label}</b><small>${item.note}</small>
      </button>`).join('');
    $$('[data-texture-variant]').forEach((button) => button.addEventListener('click', async () => {
      state.textureVariant = button.dataset.textureVariant;
      setTextureSetting(state.textureFace, state.textureRegion, 'variant', state.textureVariant);
      renderProductControls();
      await applyLeafTextures();
    }));
  }
  renderTextureDesignControls();
  syncIntegratedLightUi();
  syncQinghuafuRingLightUi();
  syncConfigurationUi();
}

const BASE = {
  width: 1.30,
  height: 2.60,
  jamb: .075,
  head: .075,
  threshold: .042,
  gap: .012,
  transom: .34,
  leafThickness: .085,
  sideLight: .405,
  mainRatio: .66
};

// The authored GLB leaves a small stepped edge around each front/back skin.
// If the two leaf widths only add up to the clear opening, those stepped
// edges expose the dark interior and read as a large, artificial door gap.
// Keep the actual leaf construction and hinge datum intact, but calculate the
// closed pair span from the visible skin edge so the two finished faces meet.
const VISIBLE_FACE_EDGE_INSET = .014;
const AUTHORED_LEAF_WIDTHS = { main: .75108, child: .38692 };

function closedPairSpan(centralOpening, spec) {
  const ratio = THREE.MathUtils.clamp(spec?.mainRatio ?? .5, .05, .95);
  const mainBase = mainPivot?.userData?.baseWidth || AUTHORED_LEAF_WIDTHS.main;
  const childBase = childPivot?.userData?.baseWidth || AUTHORED_LEAF_WIDTHS.child;
  const insetFactor = VISIBLE_FACE_EDGE_INSET * (ratio / mainBase + (1 - ratio) / childBase);
  return centralOpening / Math.max(.82, 1 - insetFactor);
}

// Keep a larger finite map around the authored door skin.  The texture window
// reveals this overscan as the opening grows; it never scales the authored
// relief to fill a taller leaf.
// Generated maps include enough real-material bleed for a mother-door source
// to grow into an equal double door without scaling the authored ornament.
const TEXTURE_OVERSCAN = { x: 2.25, y: 1.55 };
const FIXED_FRAME_FINISH = { frame: 0x3f3029, casing: 0x574238, edge: 0x76604f };
const PRODUCT_FRAME_FINISH = {
  ruojian: { frame: 0x242426, casing: 0x353238, edge: 0x5a5350 },
  yuanyin: { frame: 0x3d3029, casing: 0x5a4638, edge: 0x78604e },
  jiangchuan: { frame: 0x6f5d45, casing: 0x977b53, edge: 0xb69d6d },
  jinghong: { frame: 0x59472f, casing: 0x725c40, edge: 0x9a8059 },
  qingya: { frame: 0x45352d, casing: 0x62483a, edge: 0x856b52 },
  // The catalogue elevation uses a near-black antique-bronze frame. The
  // generic brown fallback made Qinghuafu look like a different product.
  qinghuafu: { frame: 0x151515, casing: 0x242220, edge: 0x514a40 }
};

RectAreaLightUniformsLib.init();
// Keeping a drawing buffer forces an extra GPU copy on every frame. The stage
// is already captured by the browser when needed, so leave it disabled to
// keep OrbitControls responsive on Retina displays.
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.03;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'glb-canvas';
mount.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe1e0dc);
scene.fog = new THREE.Fog(0xe1e0dc, 9, 20);

const camera = new THREE.PerspectiveCamera(34, 1, .03, 40);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .07;
controls.enablePan = false;
controls.minDistance = .9;
controls.maxDistance = 10;
controls.minPolarAngle = .68;
controls.maxPolarAngle = Math.PI / 2 - .015;
controls.rotateSpeed = .62;
controls.zoomSpeed = .72;
// A manual drag and a scripted focus tween must never own the camera at the
// same time. Cancelling the tween at drag start prevents the visible jump and
// the alternating frame positions that read as flicker.
controls.addEventListener('start', () => {
  stageInteractionActive = true;
  viewTween = null;
});
controls.addEventListener('end', () => {
  stageInteractionActive = false;
});

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .035).texture;
pmrem.dispose();

const hemi = new THREE.HemisphereLight(0xd9e5ee, 0x1b2228, 1.22);
scene.add(hemi);

const key = new THREE.DirectionalLight(0xffe5c9, 3.75);
key.position.set(-3.6, 5.8, 4.8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = .2;
key.shadow.camera.far = 16;
key.shadow.camera.left = -4.2;
key.shadow.camera.right = 4.2;
key.shadow.camera.top = 5.5;
key.shadow.camera.bottom = -1.5;
key.shadow.bias = -.00018;
key.shadow.normalBias = .018;
scene.add(key);

const fill = new THREE.DirectionalLight(0xa8c7e8, 1.28);
fill.position.set(4.5, 3.1, 2.1);
scene.add(fill);

const rim = new THREE.SpotLight(0xf4bb7d, 26, 9, Math.PI / 5, .72, 1.1);
rim.position.set(1.6, 4.3, -3.3);
rim.target.position.set(0, 1.35, 0);
scene.add(rim, rim.target);

// Large soft sources create broad, continuous highlights across the metal
// skins and hardware. Point lights make a door look like plastic; showroom
// panels give the brushed finish a real architectural reflection line.
const softboxKey = new THREE.RectAreaLight(0xffe6cf, 5.2, 2.6, 4.6);
softboxKey.position.set(-2.7, 3.4, -3.2);
softboxKey.lookAt(0, 1.35, 0);
scene.add(softboxKey);
const softboxFill = new THREE.RectAreaLight(0xbad8ee, 3.0, 1.1, 3.6);
softboxFill.position.set(3.0, 2.5, -1.0);
softboxFill.lookAt(0, 1.40, 0);
scene.add(softboxFill);
const ceilingStrip = new THREE.RectAreaLight(0xfff4e7, 2.0, 3.3, .24);
ceilingStrip.position.set(-.3, 4.4, -.9);
ceilingStrip.lookAt(0, 1.25, 0);
scene.add(ceilingStrip);

function createShowroomTexture(kind) {
  const width = 512;
  const height = kind === 'wall' ? 768 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const broad = Math.sin(x * .026 + Math.sin(y * .012) * 1.7) * .55
        + Math.sin(y * .041 + x * .008) * .30
        + Math.sin((x + y) * .093) * .15;
      const fine = Math.sin(x * 1.77 + y * .61) * .48 + Math.sin(x * .37 - y * 1.31) * .24;
      const grain = (broad + fine) * (kind === 'floor' ? 8.5 : 3.2);
      const vertical = kind === 'wall' ? Math.sin(x * .15 + y * .004) * 1.4 : 0;
      const base = kind === 'floor' ? [188, 187, 183] : [218, 217, 213];
      pixels.data[index] = Math.max(0, Math.min(255, base[0] + grain + vertical));
      pixels.data[index + 1] = Math.max(0, Math.min(255, base[1] + grain * .92 + vertical));
      pixels.data[index + 2] = Math.max(0, Math.min(255, base[2] + grain * .84 + vertical));
      pixels.data[index + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  if (kind === 'floor') {
    // Low-contrast mineral veins make the polished slab read as stone without
    // competing with the product texture or creating a tiled checkerboard.
    context.save();
    context.globalAlpha = .12;
    context.strokeStyle = '#b9c0c2';
    context.lineWidth = 1.4;
    for (let index = 0; index < 4; index += 1) {
      context.beginPath();
      context.moveTo(-40, 80 + index * 155);
      context.bezierCurveTo(150, 25 + index * 155, 270, 145 + index * 155, 560, 70 + index * 155);
      context.stroke();
    }
    context.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const floorTexture = createShowroomTexture('floor');
floorTexture.repeat.set(5.5, 5.5);
const floorBump = floorTexture.clone();
floorBump.colorSpace = THREE.NoColorSpace;
floorBump.needsUpdate = true;
const floorMaterial = new THREE.MeshPhysicalMaterial({ map: floorTexture, bumpMap: floorBump, bumpScale: .028, color: 0xffffff, metalness: .18, roughness: .38, clearcoat: .46, clearcoatRoughness: .16, envMapIntensity: .98 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -.004;
floor.receiveShadow = true;
scene.add(floor);
const floorReflectionShader = {
  ...Reflector.ReflectorShader,
  fragmentShader: Reflector.ReflectorShader.fragmentShader.replace(
    'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
    'gl_FragColor = vec4( base.rgb * vec3( .76, .83, .88 ), .16 );'
  )
};
const floorReflection = new Reflector(new THREE.PlaneGeometry(18, 18), {
  clipBias: .003,
  textureWidth: 1024,
  textureHeight: 1024,
  color: 0xffffff,
  shader: floorReflectionShader
});
floorReflection.rotation.x = -Math.PI / 2;
floorReflection.position.y = .001;
floorReflection.material.transparent = true;
floorReflection.material.opacity = 1;
floorReflection.material.depthWrite = false;
scene.add(floorReflection);

const wallTexture = createShowroomTexture('wall');
wallTexture.repeat.set(2.4, 1.05);
const wallBump = wallTexture.clone();
wallBump.colorSpace = THREE.NoColorSpace;
wallBump.needsUpdate = true;
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 6),
  new THREE.MeshPhysicalMaterial({ map: wallTexture, bumpMap: wallBump, bumpScale: .012, color: 0xffffff, metalness: .04, roughness: .72, clearcoat: .08, clearcoatRoughness: .32, envMapIntensity: .25 })
);
backdrop.position.set(0, 3, -1.15);
backdrop.receiveShadow = true;
scene.add(backdrop);
const showroom = addVirtualShowroom({
  THREE,
  scene,
  backdrop,
  product: state.product,
  series: 'k80',
  floorMaterial,
  floorReflection,
  lights: { hemi, key, fill, rim, softboxKey, softboxFill, ceilingStrip }
});
showroom?.userData?.setDimensions?.({ width: state.width / 1000, height: state.height / 1000, type: state.type });

// The GLB's front casing flange sits 111 mm in front of its local origin.
// Align that flange with the showroom niche lip so the jamb/return disappears
// into the opening and the door reads as installed in the wall, not displayed
// in front of it. The offset belongs to the scene root, never to a leaf, frame,
// hinge or texture layer.
const SHOWROOM_DOOR_FORWARD_OFFSET = .055;

const grid = new THREE.GridHelper(8, 24, 0x655d57, 0x3b3734);
grid.position.y = .002;
grid.material.opacity = .20;
grid.material.transparent = true;
grid.visible = false;
scene.add(grid);

let modelRoot = null;
let mainPivot = null;
let childPivot = null;
let frameGroup = null;
let transomGroup = null;
let transomVariantGroup = null;
let runtimeCasingGroup = null;
let integratedTransomSeparator = null;
let currentLeafLayout = null;
let k80SideLightLeft = null;
let k80SideLightRight = null;
let openAngle = 0;
let viewTween = null;
let pendingCameraRefitTimer = 0;
let activeCameraFocus = null;
let stageInteractionActive = false;
let lastHardwareFocusKey = '';
let lastHardwareFocusAt = 0;
let activeSchemeId = null;
let productInspector = null;
const textureCache = new Map();
const hardwareMetalTextureCache = new Map();
// Keep the decoded source image separate from the runtime CanvasTexture so the
// same clean map can be reused without sharing/disposal bugs between leaves.
const textureImageCache = new Map();
const textureLoader = new THREE.TextureLoader();
const LOCK_SIDE_TEXTURE_PATH = './assets/catalog/derived/hardware/textures/smart-lock-ai-v1.png';
const QINGHUAFU_RING_PATTERN_PATH = './assets/catalog/derived/k80/door-skins/k80-qinghuafu-double-leaf.png';
let lockSideTexturePromise = null;
let qinghuafuRingPatternPromise = null;
const ASSET_VERSION = '20260815.88';
const TEXTURE_LOAD_ATTEMPTS = 3;
const MODEL_LOAD_ATTEMPTS = 3;
const MODEL_LOAD_TIMEOUT_MS = 45000;
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function retryAssetUrl(sourcePath, attempt = 0) {
  const url = new URL(sourcePath, document.baseURI);
  if (attempt > 0) url.searchParams.set('retry', `${ASSET_VERSION}-${attempt}`);
  return url.href;
}

async function loadTextureWithRetry(sourcePath, attempts = TEXTURE_LOAD_ATTEMPTS) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await textureLoader.loadAsync(retryAssetUrl(sourcePath, attempt));
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await wait(500 * (attempt + 1));
    }
  }
  throw lastError || new Error(`纹理加载失败：${sourcePath}`);
}

function loadTextureImageWithRetry(sourcePath) {
  if (textureImageCache.has(sourcePath)) return textureImageCache.get(sourcePath);
  const promise = loadTextureWithRetry(sourcePath).then((sourceTexture) => {
    const image = sourceTexture.image;
    sourceTexture.dispose();
    return image;
  }).catch((error) => {
    textureImageCache.delete(sourcePath);
    throw error;
  });
  textureImageCache.set(sourcePath, promise);
  return promise;
}

// Qinghuafu's round pull is part of the product artwork: its gold face carries
// the same weathered landscape/linework visible in the catalogue photograph.
// Build a square map from the real product elevation instead of painting a
// flat gold disc over the GLB. The source crop is intentionally kept in code
// so it follows the same cache/retry path as the other catalog textures.
function getQinghuafuRingPatternTexture() {
  if (qinghuafuRingPatternPromise) return qinghuafuRingPatternPromise;
  qinghuafuRingPatternPromise = loadTextureImageWithRetry(QINGHUAFU_RING_PATTERN_PATH).then((image) => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    // The source is a 740 x 1245 double-leaf elevation. Crop only the gold
    // patterned moon; the previous wider crop also captured the dark door
    // field and turned the complete ring assembly into a black disc.
    const cropSize = Math.round(image.width * .257);
    const sourceX = Math.round(image.width * .372);
    const sourceY = Math.round(image.height * .558);
    context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
  }).catch((error) => {
    qinghuafuRingPatternPromise = null;
    throw error;
  });
  return qinghuafuRingPatternPromise;
}

// A neutral brushed-metal albedo/roughness pair gives independently modelled
// pulls a real material response without projecting a product photograph onto
// the hardware geometry. The door colourway still controls the metal tint.
function getK80HardwareMetalMaps(finish = 'gold-ring') {
  if (hardwareMetalTextureCache.has(finish)) return hardwareMetalTextureCache.get(finish);
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  const roughnessCanvas = document.createElement('canvas');
  albedoCanvas.width = albedoCanvas.height = roughnessCanvas.width = roughnessCanvas.height = size;
  const albedo = albedoCanvas.getContext('2d');
  const roughness = roughnessCanvas.getContext('2d');
  const base = {
    'warm-copper': '#c98967',
    'satin-nickel': '#d7d8d6',
    'charcoal-jade': '#686f73',
    'bronze-ring': '#d6d2c8'
  }[finish] || '#e2e1dc';
  albedo.fillStyle = base;
  albedo.fillRect(0, 0, size, size);
  const sheen = albedo.createLinearGradient(0, 0, size, 0);
  sheen.addColorStop(0, 'rgba(255,255,255,.12)');
  sheen.addColorStop(.48, 'rgba(255,255,255,.02)');
  sheen.addColorStop(.72, 'rgba(30,30,30,.10)');
  sheen.addColorStop(1, 'rgba(255,255,255,.08)');
  albedo.fillStyle = sheen;
  albedo.fillRect(0, 0, size, size);
  roughness.fillStyle = '#a9a9a5';
  roughness.fillRect(0, 0, size, size);
  for (let index = 0; index < 900; index += 1) {
    const y = (index * 37) % size;
    const alpha = .035 + ((index * 17) % 9) / 180;
    albedo.strokeStyle = `rgba(${index % 5 === 0 ? 255 : 30},${index % 5 === 0 ? 255 : 30},${index % 5 === 0 ? 255 : 30},${alpha})`;
    albedo.lineWidth = index % 11 === 0 ? 1.4 : .55;
    albedo.beginPath();
    albedo.moveTo(0, y + ((index % 3) - 1) * .25);
    albedo.lineTo(size, y + ((index % 7) - 3) * .25);
    albedo.stroke();
    roughness.strokeStyle = `rgba(${index % 4 === 0 ? 218 : 110},${index % 4 === 0 ? 218 : 110},${index % 4 === 0 ? 218 : 110},${.08 + (index % 5) / 80})`;
    roughness.lineWidth = index % 11 === 0 ? 1.2 : .45;
    roughness.beginPath();
    roughness.moveTo(0, y);
    roughness.lineTo(size, y + ((index % 7) - 3) * .25);
    roughness.stroke();
  }
  const albedoMap = new THREE.CanvasTexture(albedoCanvas);
  albedoMap.colorSpace = THREE.SRGBColorSpace;
  albedoMap.wrapS = THREE.RepeatWrapping;
  albedoMap.wrapT = THREE.RepeatWrapping;
  albedoMap.repeat.set(finish === 'charcoal-jade' ? 3.2 : 2.2, finish === 'warm-copper' ? 5.8 : 3.8);
  albedoMap.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.copy(albedoMap.repeat);
  roughnessMap.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const maps = { albedo: albedoMap, roughness: roughnessMap };
  hardwareMetalTextureCache.set(finish, maps);
  return maps;
}

async function loadModelWithRetry(sourcePath, attempts = MODEL_LOAD_ATTEMPTS) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), MODEL_LOAD_TIMEOUT_MS);
    try {
      const response = await fetch(retryAssetUrl(sourcePath, attempt), {
        cache: attempt === 0 ? 'default' : 'reload',
        credentials: 'same-origin',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      return await new GLTFLoader().parseAsync(arrayBuffer, new URL('./', document.baseURI).href);
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? new Error(`模型加载超时（${MODEL_LOAD_TIMEOUT_MS / 1000}s）`)
        : error;
      if (attempt + 1 < attempts) {
        status.textContent = `资源连接中断，正在重试 ${attempt + 1}/${attempts}…`;
        await wait(900 * (attempt + 1));
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
  throw lastError || new Error(`模型加载失败：${sourcePath}`);
}

function normalizeK80HardwareCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[（）()\s]/g, '')
    .replace(/滑盖/g, '');
}

function resolveK80ReferenceHardwareCode(role, value) {
  const code = normalizeK80HardwareCode(value);
  if (role === 'ring') {
    if (code === 'JC-RING') return 'JC-RING';
    if (code === 'QHF-MOON') return 'QHF-MOON';
    return null;
  }
  if (role === 'integrated') return code === 'QY-BAR' ? 'QY-BAR' : null;
  if (role === 'long') {
    if (code.includes('SL48F')) return 'SL48F';
    if (code.includes('SL-115') || code.includes('SL115')) return 'SL-115';
    if (code.includes('SL-108') || code.includes('SL108')) return 'SL-108';
    return null;
  }
  if (code.includes('R55H')) return 'R55H';
  if (code.includes('YTF07D')) return 'YTF07D';
  if (code.includes('F07D')) return 'F07D';
  return null;
}

async function loadK80ReferenceHardwareAsset(code) {
  const definition = K80_REFERENCE_HARDWARE_ASSETS[code];
  if (!definition) return null;
  if (!k80ReferenceHardwareCache.has(code)) {
    const promise = loadModelWithRetry(definition.path).then((gltf) => gltf.scene).catch((error) => {
      k80ReferenceHardwareCache.delete(code);
      throw error;
    });
    k80ReferenceHardwareCache.set(code, promise);
  }
  return k80ReferenceHardwareCache.get(code);
}

function applyK80ReferenceHardwareFinish(root, code) {
  if (!root) return;
  const isProductPull = ['JC-RING', 'QY-BAR', 'QHF-MOON'].includes(code);
  const maps = getK80HardwareMetalMaps(
    code === 'SL48F' || isProductPull ? 'warm-copper' : code === 'SL-108' ? 'charcoal-jade' : 'satin-nickel'
  );
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const source = Array.isArray(node.material) ? node.material[0] : node.material;
    const material = source?.clone?.() || source;
    if (!material) return;
    const label = `${node.name} ${source.name || ''}`.toLowerCase();
    const isLight = /light|glow|led|amber/.test(label);
    const isGlass = !isLight && /glass|camera|touch|fingerprint|display|sensor/.test(label);
    const isJade = /jade|teal/.test(label);
    const isSilver = /silver|chrome/.test(label);
    const isDarkPullPart = /black|dark|recess|backplate|shadow/.test(label);
    const isCopper = /copper|warm|grip|pull|inlay|cover|slider|dial|shell|halo|rim|crescent/.test(label);
    if (isLight) {
      material.color?.setHex(0xffa45c);
      material.emissive?.setHex(0xd56f32);
      material.emissiveIntensity = 1.65;
      material.metalness = .06;
      material.roughness = .18;
    } else if (code.startsWith('SL') || isProductPull) {
      if (isJade) {
        material.color?.setHex(0x0d7467);
        material.metalness = .54;
        material.roughness = .25;
      } else if (isSilver) {
        material.color?.setHex(0xbec7ca);
        material.metalness = .84;
        material.roughness = .20;
      } else if (isDarkPullPart) {
        material.color?.setHex(0x15181a);
        material.metalness = .70;
        material.roughness = .27;
      } else {
        material.color?.setHex(isCopper ? 0xb4744e : 0xb9c0c4);
        material.metalness = isGlass ? .16 : .88;
        material.roughness = isGlass ? .24 : .22;
      }
    } else {
      material.color?.setHex(isGlass ? 0x11151c : /chrome|camera/.test(label) ? 0xb6c0c7 : 0x262a2e);
      material.metalness = isGlass ? .20 : .86;
      material.roughness = isGlass ? .20 : .24;
    }
    if (!isGlass && !isLight && !(isProductPull && (isJade || isSilver || isDarkPullPart))) {
      material.map = maps.albedo;
      material.roughnessMap = maps.roughness;
      material.bumpMap = maps.roughness;
      material.bumpScale = .0018;
      material.normalScale?.set(.12, .12);
    }
    material.clearcoat = .28;
    material.clearcoatRoughness = .13;
    material.envMapIntensity = 1.72;
    material.needsUpdate = true;
    node.material = material;
    node.castShadow = true;
    node.receiveShadow = true;
  });
  root.userData.referenceHardwareMaterial = true;
}

async function installK80ReferenceHardwareAssets() {
  const definitions = [
    { role: 'long', codes: ['SL48F', 'SL-115', 'SL-108'] },
    { role: 'smart', codes: ['R55H', 'F07D', 'YTF07D'] },
    { role: 'ring', codes: ['JC-RING', 'QHF-MOON'] },
    { role: 'integrated', codes: ['QY-BAR'] }
  ];
  for (const label of ['Main', 'Child']) {
    for (const definition of definitions) {
      const group = object(`${label}Hardware_${K80_HARDWARE_GROUPS[definition.role]}`)
        || (definition.role === 'integrated' ? ensureK80IntegratedGroup(label) : null);
      if (!group) continue;
      const anchor = group.userData.handleAnchor?.clone?.() || new THREE.Vector3(0, K80_HARDWARE_BASE_Y[definition.role], 0);
      const loaded = [];
      for (const code of definition.codes) {
        try {
          const source = await loadK80ReferenceHardwareAsset(code);
          if (!source) continue;
          const root = source.clone(true);
          root.name = `${label}Hardware_${definition.role}_${code.replace(/[^A-Z0-9]/g, '')}_Reference`;
          // The source GLBs use the same door-local XY/+Z convention as the
          // product model. Reuse the existing group anchor for x/y. Smart-lock
          // shells need the authored 64.5 mm front datum used by the Blender
          // fit audit; without it their face sits behind the door skin when
          // the leaf is closed. Fixed pulls receive a small 8 mm datum lift so
          // their cover does not z-fight with the product's integrated light.
          const rootAnchor = definition.role === 'integrated' ? new THREE.Vector3(0, 0, 0) : anchor;
          root.position.set(rootAnchor.x, rootAnchor.y, definition.role === 'smart' ? .0645 : .008);
          applyK80ReferenceHardwareFinish(root, code);
          root.visible = false;
          loaded.push([code, root]);
        } catch (error) {
          console.warn(`K80 五金参考模型 ${code} 加载失败，保留兼容模型：`, error);
        }
      }
      if (!loaded.length) continue;
      const legacyFallback = new THREE.Group();
      legacyFallback.name = `${group.name}_LegacyFallback`;
      legacyFallback.visible = false;
      while (group.children.length) legacyFallback.add(group.children[0]);
      group.add(legacyFallback);
      group.userData.legacyHardwareFallback = legacyFallback;
      group.userData.referenceHardwareRoots = Object.fromEntries(loaded);
      loaded.forEach(([, root]) => group.add(root));
    }
  }
}

function syncK80ReferenceHardwareVisibility(group, role, visible) {
  const roots = group?.userData?.referenceHardwareRoots;
  if (!roots) return;
  const selectedCode = resolveK80ReferenceHardwareCode(
    role,
    ['long', 'ring', 'integrated'].includes(role) ? state.handleCode : state.lockPanelCode
  );
  // A catalogue code that has no authored GLB must never silently display a
  // different product's pull. Keep the original compatible mesh as a clearly
  // bounded fallback until that code gets its own source model.
  const selectedRoot = selectedCode ? roots[selectedCode] : null;
  const legacyFallback = group.userData.legacyHardwareFallback;
  if (legacyFallback) legacyFallback.visible = Boolean(visible && !selectedRoot);
  Object.values(roots).forEach((root) => { root.visible = Boolean(visible && root === selectedRoot); });
}
// A slider can emit several input events before an image promise resolves.
// Each resize gets its own binding revision so a late texture load from an
// older door size can never put the old UV window back on the new geometry.
let textureBindRevision = 0;

function rememberBase(object) {
  object.userData.runtimeBase = {
    position: object.position.clone(),
    scale: object.scale.clone(),
    rotation: object.rotation.clone()
  };
}

function restoreBase(object) {
  const base = object.userData.runtimeBase;
  if (!base) return;
  object.position.copy(base.position);
  object.scale.copy(base.scale);
  object.rotation.copy(base.rotation);
}

function object(name) {
  return modelRoot?.getObjectByName(name) || null;
}

function rememberHandleAnchors() {
  ['Main', 'Child'].forEach((label) => {
    ['Smart', 'Long', 'Ring', 'Recess', 'Concealed'].forEach((groupName) => {
      const group = object(`${label}Hardware_${groupName}`);
      const parent = group?.parent;
      if (!group || !parent) return;
      group.updateWorldMatrix(true, true);
      const center = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
      parent.updateWorldMatrix(true, true);
      // Keep the fitting centre in the group's own coordinates. Storing a
      // parent-local point makes the centre drift as soon as the fitting is
      // moved; a local point remains stable for both handles and lock bodies.
      group.userData.handleAnchor = group.worldToLocal(center);
    });
  });
}

function makePhysicalMaterial(source, options = {}) {
  const color = source?.color?.clone?.() || new THREE.Color(0xffffff);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: options.metalness ?? source?.metalness ?? .54,
    roughness: options.roughness ?? source?.roughness ?? .30,
    clearcoat: options.clearcoat ?? .16,
    clearcoatRoughness: options.clearcoatRoughness ?? .20,
    envMapIntensity: options.envMapIntensity ?? 1.48,
    specularIntensity: options.specularIntensity ?? .86
  });
  return material;
}

function planarizeLeafUv(mesh) {
  const position = mesh.geometry.attributes.position;
  if (!position) return;
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  const width = Math.max(.0001, box.max.x - box.min.x);
  const height = Math.max(.0001, box.max.y - box.min.y);
  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uv[i * 2] = (position.getX(i) - box.min.x) / width;
    uv[i * 2 + 1] = (position.getY(i) - box.min.y) / height;
  }
  mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

// 若简当前版本不再配置拉手/灯带。部分历史色卡的源图仍把橙色灯带
// 烘焙在门扇纹理里，若继续直接使用会出现“模型已删除、贴图仍发光”的
// 错觉。按同一行的木纹两侧做线性补色，只清理高饱和橙色像素，不改动
// 正常木纹、门缝和门框颜色。
function removeRuojianLightBand(image) {
  if (!image?.width || !image?.height) return image;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const isLightBandPixel = (offset) => {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    return red > 132 && red - green > 36 && green - blue > 24 && red > green * 1.34;
  };
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    let x = 0;
    while (x < width) {
      const startOffset = (rowStart + x) * 4;
      if (!isLightBandPixel(startOffset)) {
        x += 1;
        continue;
      }
      const runStart = x;
      while (x < width && isLightBandPixel((rowStart + x) * 4)) x += 1;
      const runEnd = x - 1;
      const left = runStart - 1;
      const right = runEnd + 1;
      for (let fillX = runStart; fillX <= runEnd; fillX += 1) {
        const ratio = runStart === runEnd ? .5 : (fillX - runStart + 1) / (runEnd - runStart + 2);
        const targetOffset = (rowStart + fillX) * 4;
        const leftOffset = (rowStart + Math.max(0, left)) * 4;
        const rightOffset = (rowStart + Math.min(width - 1, right)) * 4;
        if (left < 0) {
          data[targetOffset] = data[rightOffset];
          data[targetOffset + 1] = data[rightOffset + 1];
          data[targetOffset + 2] = data[rightOffset + 2];
          data[targetOffset + 3] = data[rightOffset + 3];
        } else if (right >= width) {
          data[targetOffset] = data[leftOffset];
          data[targetOffset + 1] = data[leftOffset + 1];
          data[targetOffset + 2] = data[leftOffset + 2];
          data[targetOffset + 3] = data[leftOffset + 3];
        } else {
          data[targetOffset] = Math.round(data[leftOffset] * (1 - ratio) + data[rightOffset] * ratio);
          data[targetOffset + 1] = Math.round(data[leftOffset + 1] * (1 - ratio) + data[rightOffset + 1] * ratio);
          data[targetOffset + 2] = Math.round(data[leftOffset + 2] * (1 - ratio) + data[rightOffset + 2] * ratio);
          data[targetOffset + 3] = Math.round(data[leftOffset + 3] * (1 - ratio) + data[rightOffset + 3] * ratio);
        }
      }
    }
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
}

async function getTexture(key, part = 'master', colorKey = '') {
  const cacheKey = `${key}:${part}:${colorKey || 'factory'}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const colorway = COLORWAYS[key]?.find((item) => item.key === colorKey);
  const colorAsset = part === 'single' ? (colorway?.singleTexturePath || colorway?.texturePath) : colorway?.texturePath;
  const asset = colorAsset && ['master', 'base', 'single', 'doubleLeaf'].includes(part)
    ? colorAsset
    : getTextureMapPath('k80', key, part) || finishAssets[key]?.[part] || finishAssets[key]?.master;
  if (!asset) throw new Error(`K80 产品 ${key} 缺少纹理源：${part}`);
  const promise = loadTextureImageWithRetry(asset).then((loadedImage) => {
    const image = key === 'ruojian' ? removeRuojianLightBand(loadedImage) : loadedImage;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * TEXTURE_OVERSCAN.x);
    canvas.height = Math.round(image.height * TEXTURE_OVERSCAN.y);
    const context = canvas.getContext('2d');
    const marginX = Math.round((canvas.width - image.width) / 2);
    const marginY = Math.round((canvas.height - image.height) / 2);
    // Fill only the generated overscan with a small clean finish patch. The
    // authored product map remains untouched in the centre; the patch is
    // tiled at its native texel scale, so changing the opening size cannot
    // stretch a cloud, relief, lock or handle into a horizontal band.
    const edgeImage = image;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    const sampleCanvas = document.createElement('canvas');
    const sampleSize = 48;
    sampleCanvas.width = sampleCanvas.height = sampleSize;
    const sampleContext = sampleCanvas.getContext('2d');
    const sampleSizeSource = Math.min(160, edgeImage.width, edgeImage.height);
    // Stay close to the outer finished edge so the generated field matches
    // the authored map's colour and grain rather than importing a different
    // AI underlay with a visible exposure jump.
    const sampleX = Math.max(1, Math.round(edgeImage.width * .025));
    const sampleY = Math.round(edgeImage.height * .42);
    sampleContext.drawImage(
      edgeImage,
      Math.min(sampleX, Math.max(0, edgeImage.width - sampleSizeSource)),
      Math.min(sampleY, Math.max(0, edgeImage.height - sampleSizeSource)),
      sampleSizeSource,
      sampleSizeSource,
      0,
      0,
      sampleSize,
      sampleSize
    );
    const pixels = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      red += pixels[index];
      green += pixels[index + 1];
      blue += pixels[index + 2];
    }
    const pixelCount = pixels.length / 4;
    const finishColor = `rgb(${Math.round(red / pixelCount)},${Math.round(green / pixelCount)},${Math.round(blue / pixelCount)})`;
    // The overscan is supplemental finish, not another copy of the product
    // artwork. Start from a colour-matched field, then add a small mirrored
    // native-scale texture patch. Mirroring removes hard tile seams while the
    // source map continues to provide all product detail in the centre.
    context.fillStyle = finishColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const patchSize = Math.min(64, edgeImage.width, edgeImage.height);
    const patch = document.createElement('canvas');
    patch.width = patch.height = patchSize;
    patch.getContext('2d').drawImage(
      edgeImage,
      Math.min(sampleX, Math.max(0, edgeImage.width - patchSize)),
      Math.min(sampleY, Math.max(0, edgeImage.height - patchSize)),
      patchSize,
      patchSize,
      0,
      0,
      patchSize,
      patchSize
    );
    const topRow = document.createElement('canvas');
    topRow.width = patchSize * 2;
    topRow.height = patchSize;
    const topRowContext = topRow.getContext('2d');
    topRowContext.drawImage(patch, 0, 0);
    topRowContext.save();
    topRowContext.translate(topRow.width, 0);
    topRowContext.scale(-1, 1);
    topRowContext.drawImage(patch, 0, 0);
    topRowContext.restore();
    const tile = document.createElement('canvas');
    tile.width = tile.height = patchSize * 2;
    const tileContext = tile.getContext('2d');
    tileContext.drawImage(topRow, 0, 0);
    tileContext.save();
    tileContext.translate(0, tile.height);
    tileContext.scale(1, -1);
    tileContext.drawImage(topRow, 0, 0);
    tileContext.restore();
    const edgePattern = context.createPattern(tile, 'repeat');
    if (edgePattern) {
      context.save();
      // Keep the generated perimeter quiet enough that the authored source
      // can dissolve into it. A strong, full-opacity tile makes the map edge
      // read like a hard rectangle as the opening is resized.
      context.globalAlpha = .48;
      context.fillStyle = edgePattern;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();
    }
    // Restore the authored source through a feathered alpha mask. The centre
    // remains pixel-identical, while the last portion of each edge fades into
    // the native-scale perimeter patch. This avoids the visible rectangular
    // seam when width/height reveals more of the overscan map.
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = image.width;
    sourceCanvas.height = image.height;
    const sourceContext = sourceCanvas.getContext('2d');
    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = 'high';
    sourceContext.drawImage(image, 0, 0);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;
    const maskContext = maskCanvas.getContext('2d');
    const maskData = maskContext.createImageData(image.width, image.height);
    const maskPixels = maskData.data;
    const featherX = Math.max(28, Math.round(image.width * .105));
    const featherY = Math.max(28, Math.round(image.height * .105));
    const smoothstep = (value) => {
      const clamped = Math.max(0, Math.min(1, value));
      return clamped * clamped * (3 - 2 * clamped);
    };
    for (let y = 0; y < image.height; y += 1) {
      const topDistance = y;
      const bottomDistance = image.height - 1 - y;
      const vertical = smoothstep(Math.min(topDistance / featherY, bottomDistance / featherY, 1));
      for (let x = 0; x < image.width; x += 1) {
        const leftDistance = x;
        const rightDistance = image.width - 1 - x;
        const horizontal = smoothstep(Math.min(leftDistance / featherX, rightDistance / featherX, 1));
        const alpha = Math.round(Math.min(horizontal, vertical) * 255);
        const offset = (y * image.width + x) * 4;
        maskPixels[offset] = 255;
        maskPixels[offset + 1] = 255;
        maskPixels[offset + 2] = 255;
        maskPixels[offset + 3] = alpha;
      }
    }
    maskContext.putImageData(maskData, 0, 0);
    sourceContext.globalCompositeOperation = 'destination-in';
    sourceContext.drawImage(maskCanvas, 0, 0);
    sourceContext.globalCompositeOperation = 'source-over';
    context.drawImage(sourceCanvas, marginX, marginY);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
  }).catch((error) => {
    textureCache.delete(cacheKey);
    throw error;
  });
  textureCache.set(cacheKey, promise);
  return promise;
}

function getLockSideTexture() {
  if (lockSideTexturePromise) return lockSideTexturePromise;
  lockSideTexturePromise = loadTextureWithRetry(LOCK_SIDE_TEXTURE_PATH).then((sourceTexture) => {
    // Reuse a narrow strip from the real smart-lock photograph as the side
    // albedo. It preserves the brushed bezel grain and dark anodized finish
    // when the door is opened, rather than leaving a flat black cube edge.
    const image = sourceTexture.image;
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const sourceX = Math.round(image.width * .265);
    const sourceY = Math.round(image.height * .17);
    const sourceWidth = Math.max(8, Math.round(image.width * .060));
    const sourceHeight = Math.max(32, Math.round(image.height * .66));
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    sourceTexture.dispose();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
  }).catch((error) => {
    lockSideTexturePromise = null;
    throw error;
  });
  return lockSideTexturePromise;
}

function addLockSideTexturePanels(body, texture) {
  if (!body?.geometry || body.userData.lockSideTexturePanels) return;
  body.geometry.computeBoundingBox();
  const bounds = body.geometry.boundingBox;
  const size = bounds.getSize(new THREE.Vector3());
  // The side finish is part of the lock housing, not two extra metal plates.
  // Use a flush micro-shell so an oblique front view cannot reveal a floating
  // rectangle or cast a second shadow beside the real rounded body.
  const sideThickness = .0014;
  const panelMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: texture,
    bumpMap: texture,
    bumpScale: .004,
    metalness: .78,
    roughness: .24,
    clearcoat: .22,
    clearcoatRoughness: .16,
    envMapIntensity: 1.78,
    specularIntensity: .94,
    side: THREE.DoubleSide
  });
  [-1, 1].forEach((direction) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(sideThickness, size.y * .84, size.z * .86), panelMaterial);
    panel.name = `${body.name}_SideTexture_${direction < 0 ? 'Left' : 'Right'}`;
    panel.position.set(direction * (size.x / 2 - sideThickness / 2 + .0001), 0, 0);
    panel.castShadow = false;
    panel.receiveShadow = true;
    panel.userData.lockSideTexture = true;
    panel.userData.flushToHousing = true;
    body.add(panel);
  });
  body.userData.lockSideTexturePanels = true;
}

let latchMetalMaterial = null;

function getLatchMetalMaterial() {
  if (latchMetalMaterial) return latchMetalMaterial;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#e9eef0');
  gradient.addColorStop(.22, '#87939b');
  gradient.addColorStop(.48, '#d7dfe2');
  gradient.addColorStop(.72, '#66727a');
  gradient.addColorStop(1, '#c5cdd1');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  // A deterministic brushed-metal grain makes the small side hardware catch
  // the showroom lights instead of reading as four flat grey boxes.
  for (let index = 0; index < 180; index += 1) {
    const y = (index * 37) % canvas.height;
    const alpha = .06 + ((index * 13) % 9) / 100;
    context.strokeStyle = `rgba(255,255,255,${alpha})`;
    context.lineWidth = index % 7 === 0 ? 1.2 : .55;
    context.beginPath();
    context.moveTo(0, y + .5);
    context.lineTo(canvas.width, y + .5);
    context.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const bumpMap = new THREE.CanvasTexture(canvas);
  bumpMap.colorSpace = THREE.NoColorSpace;
  bumpMap.wrapS = THREE.ClampToEdgeWrapping;
  bumpMap.wrapT = THREE.ClampToEdgeWrapping;
  bumpMap.anisotropy = map.anisotropy;
  latchMetalMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xcbd4d8,
    map,
    bumpMap,
    bumpScale: .0018,
    metalness: .96,
    roughness: .18,
    clearcoat: .36,
    clearcoatRoughness: .14,
    envMapIntensity: 2.15,
    specularIntensity: .98,
    side: THREE.DoubleSide
  });
  latchMetalMaterial.userData.runtimeMaterial = true;
  return latchMetalMaterial;
}

function createLatchBoltGeometry(width, depth, height, direction = 1, pointed = false) {
  const halfWidth = Math.max(.006, width / 2);
  const halfHeight = Math.max(.005, height / 2);
  const base = -direction * halfWidth;
  const tip = direction * halfWidth;
  const shoulder = tip - direction * halfWidth * .28;
  const shape = new THREE.Shape();
  shape.moveTo(base, -halfHeight);
  shape.lineTo(base, halfHeight);
  if (pointed) {
    // A real spring latch has a flat back and a sloped nose, not a sharp
    // triangular spike. Keep a small flat nose so the edge view reads like a
    // machined tongue when it meets the strike plate.
    shape.lineTo(shoulder, halfHeight * .78);
    shape.lineTo(tip, halfHeight * .24);
    shape.lineTo(tip, -halfHeight * .24);
    shape.lineTo(shoulder, -halfHeight * .78);
  } else {
    const nose = halfHeight * .38;
    shape.lineTo(tip, nose);
    shape.lineTo(tip, -nose);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(.004, depth),
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(width, height) * .075,
    bevelThickness: Math.min(depth, height) * .12
  });
  // ExtrudeGeometry's depth axis is Z; the GLB door uses Y for thickness and
  // Z for height. Center the extrusion after rotating it onto the side edge.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -depth / 2, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function sourceMeshSize(mesh) {
  mesh.geometry?.computeBoundingBox?.();
  const bounds = mesh.geometry?.boundingBox;
  if (!bounds) return new THREE.Vector3(.038, .036, .034);
  const size = bounds.getSize(new THREE.Vector3());
  size.multiply(new THREE.Vector3(
    Math.max(.001, Math.abs(mesh.scale.x)),
    Math.max(.001, Math.abs(mesh.scale.y)),
    Math.max(.001, Math.abs(mesh.scale.z))
  ));
  return size;
}

function addRuntimeLatchBolt(lockEdge, sourceMesh, material, pointed = false, variant = 'deadbolt') {
  if (!sourceMesh || sourceMesh.userData.runtimeLatchReplacement) return;
  const size = sourceMeshSize(sourceMesh);
  const sizeFactor = pointed
    ? new THREE.Vector3(.92, .90, .98)
    : variant === 'main'
      ? new THREE.Vector3(.92, .96, 1.06)
      : new THREE.Vector3(.82, .88, .90);
  size.multiply(sizeFactor);
  const direction = Math.sign(sourceMesh.position.x) || (lockEdge.name.startsWith('Main') ? -1 : 1);
  sourceMesh.visible = false;
  sourceMesh.userData.runtimeLatchReplacement = true;
  const bolt = new THREE.Mesh(
    // The edge view needs the same machined sloped nose for both shoot bolts
    // and the central deadbolt; a rounded box makes every tongue read as a
    // floating gray cuboid.
    createLatchBoltGeometry(size.x, size.y, size.z, direction, true),
    material
  );
  bolt.name = `${sourceMesh.name}_RuntimeMetal${pointed ? 'SpringLatch' : 'Bolt'}`;
  bolt.position.copy(sourceMesh.position);
  bolt.rotation.copy(sourceMesh.rotation);
  bolt.castShadow = true;
  bolt.receiveShadow = true;
  bolt.userData.runtimeLatchBolt = true;
  bolt.userData.sourceBolt = sourceMesh.name;
  bolt.userData.lockPart = pointed ? 'spring-latch' : variant;
  lockEdge.add(bolt);
  return bolt;
}

function addRuntimeSpringLatch(lockEdge, material, reference, hasBoltSources) {
  if (lockEdge.userData.runtimeLatchTop) return;
  const faceplate = lockEdge.getObjectByName(`${lockEdge.name.replace('LockEdge', '')}_LockEdge_Faceplate`);
  const source = reference || faceplate;
  if (!source) return;
  const direction = Math.sign(source.position.x) || (lockEdge.name.startsWith('Main') ? -1 : 1);
  const size = hasBoltSources
    ? new THREE.Vector3(.044, .034, .052)
    : new THREE.Vector3(.040, .036, .044);
  const bolt = new THREE.Mesh(
    createLatchBoltGeometry(size.x, size.y, size.z, direction, true),
    material
  );
  bolt.name = `${lockEdge.name.replace('LockEdge', '')}_LockEdge_Latch_RuntimeMetalWedge`;
  bolt.position.set(
    source.position.x,
    source.position.y + (hasBoltSources ? .145 : 0),
    source.position.z
  );
  bolt.castShadow = true;
  bolt.receiveShadow = true;
  bolt.userData.runtimeLatchBolt = true;
  bolt.userData.sourceBolt = 'runtime-latch';
  lockEdge.add(bolt);
  lockEdge.userData.runtimeLatchTop = true;
}

function applyLockEdgeBolts() {
  if (!modelRoot) return;
  const material = getLatchMetalMaterial();
  modelRoot.traverse((node) => {
    if (!node.name.endsWith('LockEdge')) return;
    const boltSources = [];
    const latchSources = [];
    node.traverse((child) => {
      if (!child.isMesh) return;
      if (/_LockEdge_Bolt_\d+$/.test(child.name)) boltSources.push(child);
      if (/_LockEdge_Latch$/.test(child.name)) latchSources.push(child);
    });
    // The GLB edge nodes share the same Z thickness coordinate. Their order
    // is defined by the vertical Y coordinate: top shoot bolt, main bolt,
    // bottom shoot bolt.
    const orderedBolts = [...boltSources].sort((a, b) => a.position.y - b.position.y);
    // A physical mortise lock shows three edge tongues in the opened view.
    // If the source has a dedicated angled spring-latch node, use two shoot
    // bolts plus that latch. Older GLBs contain three Bolt_* nodes *and* a
    // Latch node; hide the redundant third bolt instead of showing four
    // floating pieces. If no Latch node exists, keep three Bolt_* nodes.
    const selectedBolts = latchSources.length
      ? orderedBolts.slice(0, Math.min(2, orderedBolts.length))
      : orderedBolts.slice(0, Math.min(3, orderedBolts.length));
    orderedBolts.forEach((source) => {
      if (selectedBolts.includes(source)) return;
      source.visible = false;
      source.userData.runtimeLatchHidden = true;
    });
    selectedBolts.forEach((source, index) => {
      const variant = index === Math.floor(selectedBolts.length / 2) ? 'main' : 'shoot';
      addRuntimeLatchBolt(node, source, material, false, variant);
    });
    latchSources.forEach((source, index) => {
      if (index === 0) addRuntimeLatchBolt(node, source, material, true, 'spring-latch');
      else source.visible = false;
    });
    const needsRuntimeSpring = !latchSources.length && selectedBolts.length < 3;
    if (needsRuntimeSpring) {
      addRuntimeSpringLatch(node, material, selectedBolts[Math.floor(selectedBolts.length / 2)], Boolean(selectedBolts.length));
    }
    const runtimeSpringCount = needsRuntimeSpring ? 1 : 0;
    node.userData.runtimeLatchBoltCount = selectedBolts.length + Math.min(1, latchSources.length) + runtimeSpringCount;
  });
}

async function applyLockSideTextures() {
  if (!modelRoot) return;
  applyLockEdgeBolts();
  try {
    const texture = await getLockSideTexture();
    // Use the real brushed smart-lock side strip for the edge tongues too;
    // the procedural map remains as a safe fallback while the image loads.
    const latchMaterial = getLatchMetalMaterial();
    latchMaterial.color.set(0xffffff);
    latchMaterial.map = texture;
    latchMaterial.bumpMap = texture;
    latchMaterial.bumpScale = .0022;
    latchMaterial.metalness = .96;
    latchMaterial.roughness = .20;
    latchMaterial.needsUpdate = true;
    modelRoot.traverse((mesh) => {
      if (!mesh.isMesh) return;
      if (/SmartLock_Body$/.test(mesh.name)) addLockSideTexturePanels(mesh, texture);
      if (!/LockEdge_(Faceplate|MortiseCase|CasePocket)$/.test(mesh.name)) return;
      const material = makePhysicalMaterial(mesh.userData.originalMaterial || mesh.material, {
        metalness: mesh.name.includes('Faceplate') ? .88 : .64,
        roughness: mesh.name.includes('Faceplate') ? .22 : .34,
        clearcoat: .18,
        envMapIntensity: 1.72,
        specularIntensity: .92
      });
      material.map = texture;
      material.bumpMap = texture;
      material.bumpScale = .003;
      material.normalScale?.set(.14, .14);
      material.userData.runtimeMaterial = true;
      if (mesh.material?.userData?.runtimeMaterial) mesh.material.dispose();
      mesh.material = material;
    });
  } catch (error) {
    console.warn('门锁侧面贴图加载失败，保留 PBR 金属材质：', error);
  }
}

function roleForMesh(mesh) {
  return mesh.name.includes('_Child_') ? 'child' : 'main';
}

function textureRegionForMesh(mesh) {
  if (mesh.name === 'Transom_OpaquePanel') return 'transom';
  return roleForMesh(mesh);
}

function sourceWindow(key, role, layout = currentLeafLayout, type = state.type, hasTransom = state.transom) {
  const profile = finishProfiles[key] || finishProfiles.ruojian;
  const referenceType = typeSpecs[type] ? type : (profile.baseType || 'double');
  const reference = defaultLeafSizes(referenceType, hasTransom);
  const referenceWidth = reference[role] || reference.main;
  const currentWidth = layout?.[role] || layout?.main || referenceWidth;
  const contentStart = (1 - 1 / TEXTURE_OVERSCAN.x) / 2;
  const contentSpan = 1 / TEXTURE_OVERSCAN.x;
  const baseMin = contentStart;
  const baseMax = contentStart + contentSpan;
  const baseSpan = baseMax - baseMin;
  const widthScale = THREE.MathUtils.clamp(currentWidth / Math.max(.1, referenceWidth), .78, 1.34);
  const delta = baseSpan * (widthScale - 1);

  // Keep the structural seam fixed. For the child leaf reveal/crop from its
  // outer edge; for the main leaf do the same on its outer edge. This keeps
  // centre ornaments, ribs and meeting details from drifting or stretching.
  let min = baseMin;
  let max = baseMax;
  if (role === 'child') min -= delta;
  else max += delta;
  const span = THREE.MathUtils.clamp(max - min, .025, .92);
  min = THREE.MathUtils.clamp(min, contentStart, contentStart + 1 / TEXTURE_OVERSCAN.x - span);
  max = min + span;
  return [min, max];
}

// A texture window is a physical crop of the authored map, not a second way
// of scaling the map with the GLB. Increasing the door size therefore expands
// this window into the generated overscan; decreasing it crops at the same
// installation datum. The authored ornament keeps the same texel density.
function anchoredTextureWindow(baseMin, baseSpan, scale, zoom, anchor = 'center', bounds = {}, pan = 0) {
  const lower = Number.isFinite(bounds.min) ? bounds.min : 0;
  const upper = Number.isFinite(bounds.max) ? bounds.max : 1;
  const available = Math.max(.025, upper - lower);
  const structuralSpan = THREE.MathUtils.clamp(
    baseSpan * scale,
    .025,
    available
  );
  const structuralMin = anchor === 'end'
    ? baseMin + baseSpan - structuralSpan
    : anchor === 'start'
      ? baseMin
      : baseMin + (baseSpan - structuralSpan) / 2;
  // Geometry sizing may keep a leaf's outer/meeting datum fixed, but the
  // explicit texture zoom is a visual scale control. Apply that control from
  // the current window centre so the ornament does not walk away while it is
  // being enlarged or reduced.
  const structuralCenter = structuralMin + structuralSpan / 2;
  const desired = THREE.MathUtils.clamp(structuralSpan / Math.max(.001, zoom), .025, available);
  let min = structuralCenter - desired / 2 + pan;
  min = THREE.MathUtils.clamp(min, lower, upper - desired);
  return { min, span: desired };
}

function texturePartFor(key, role, type = state.type) {
  // 若简当前版本不加载灯带/拉手模型；其历史纹理中的橙色灯带会在
  // getTexture() 进入材质前清理，门扇只保留连续木纹与结构缝。
  if (key === 'ruojian' && role === 'main' && type === 'single') return 'single';
  if (key === 'ruojian' && ['main', 'child'].includes(role)) return 'base';
  // Qingya's photographed main-leaf crop contains the short gold pull in the
  // dark band. Use the hardware-free counterpart for every configurable
  // state; the independent integrated fitting is responsible for the pull.
  if (key === 'qingya' && role === 'main') return 'design-main';
  const manifestRegion = getTextureRegion('k80', key, type, role);
  if (manifestRegion?.map) return manifestRegion.map;
  const profile = finishProfiles[key] || finishProfiles.ruojian;
  if (role === 'transom') return 'master';
  // Most K80 source images are photographs of the complete pair. Keep the
  // center ornament and the meeting-stile light continuous by taking the two
  // leaf windows from one master map instead of mirroring a single-leaf crop.
  if (['mother', 'double', 'sideLight', 'doubleSide'].includes(type) && profile.textureParts?.doubleComposition) return 'master';
  return profile.textureParts?.[role] || profile.textureParts?.main || 'master';
}

function defaultLeafSizes(type, hasTransom = state.transom) {
  const spec = typeSpecs[type];
  const totalW = spec.width[2] / 1000;
  const totalH = spec.height[2] / 1000;
  const opening = totalW - BASE.jamb * 2;
  const leafHeight = totalH - BASE.head - BASE.threshold - (hasTransom ? BASE.transom : 0);
  const sideCount = spec.sideCount || 0;
  const side = sideCount ? Math.min(BASE.sideLight, opening * .34) : 0;
  const centralOpening = opening - side * sideCount;
  if (type === 'single') return { main: opening - BASE.gap, child: 0, side: 0, height: leafHeight };
  if (type === 'sideLight') return { main: centralOpening - BASE.gap, child: 0, side, height: leafHeight };
  const pairSpan = closedPairSpan(centralOpening, spec);
  const main = pairSpan * spec.mainRatio;
  return { main, child: pairSpan - main, side, height: leafHeight };
}

function supportedTypesForState() {
  const front = getTextureManifest('k80', state.frontFinish)?.supportedTypes
    || finishProfiles[state.frontFinish]?.supportedTypes
    || Object.keys(typeSpecs);
  const back = getTextureManifest('k80', state.backFinish)?.supportedTypes
    || finishProfiles[state.backFinish]?.supportedTypes
    || Object.keys(typeSpecs);
  const optional = Object.keys(typeSpecs).filter((type) => !UNIVERSAL_DOOR_TYPES.includes(type) && front.includes(type) && back.includes(type));
  return [...UNIVERSAL_DOOR_TYPES, ...optional];
}

function synchronizeTextureStructure(changedFace) {
  const common = supportedTypesForState();
  if (common.length) return false;
  // A front/back pair cannot be physically assembled from two different
  // source structures. Keep independent textures when their source door type
  // matches; otherwise keep the newly chosen face as the structural master.
  if (changedFace === 'front') state.backFinish = state.frontFinish;
  else state.frontFinish = state.backFinish;
  return true;
}

function fallbackTypeForState() {
  const available = supportedTypesForState();
  const preferred = [
    finishProfiles[state.frontFinish]?.baseType,
    finishProfiles[state.backFinish]?.baseType,
    'double',
    'mother',
    'single'
  ];
  return preferred.find((type) => available.includes(type)) || available[0] || 'double';
}

function reconcileType() {
  const available = supportedTypesForState();
  if (available.includes(state.type)) return false;
  state.type = fallbackTypeForState();
  updateSliderRanges();
  return true;
}

function applyTypeCards() {
  const available = new Set(supportedTypesForState());
  const activeProfile = finishProfiles[state.frontFinish] || finishProfiles.ruojian;
  const typeButtons = $$('[data-type]');
  typeButtons.forEach((button) => {
    const type = button.dataset.type;
    const supported = available.has(type);
    const spec = typeSpecs[type];
    const note = button.querySelector('small');
    // Single / mother / double are universal structural choices. Optional
    // side-light assemblies remain product-specific because they need a real
    // side-panel source rather than a fabricated glass panel.
    button.hidden = !supported;
    button.disabled = !supported;
    button.classList.toggle('selected', supported && type === state.type);
    button.classList.toggle('unavailable', !supported);
    button.setAttribute('aria-disabled', String(!supported));
    button.title = supported
      ? `${spec.label} · ${spec.width[2]} × ${spec.height[2]} mm`
      : `${activeProfile.baseType === 'mother' ? '子母门' : '对开门'}原图暂无${spec.label}净图，已禁用以避免错误切割`;
    if (note) note.textContent = supported ? `${spec.width[2]} × ${spec.height[2]}` : '本款暂不支持';
  });
  const typeGrid = typeButtons[0]?.closest('.choice-grid');
  typeGrid?.classList.toggle('single-choice', available.size === 1);
}

function setTextureWindow(texture, key, role, leafWidth, leafHeight, config = {}) {
  const type = config.type || state.type;
  const hasTransom = config.transom ?? state.transom;
  const profile = finishProfiles[key] || finishProfiles.ruojian;
  const layout = config.layout || currentLeafLayout;
  const manifest = getTextureManifest('k80', key);
  const authoredType = manifest?.base?.type || type;
  // Texture density is defined by the photographed product, never by the
  // newly selected assembly. Otherwise switching type resets widthScale to 1
  // and silently squeezes the complete source window into a narrower leaf.
  const reference = defaultLeafSizes(authoredType, false);
  const structure = getTextureStructure('k80', key, type);
  const regionSpec = config.regionSpec || getTextureRegion('k80', key, type, role);
  const contentStart = (1 - 1 / TEXTURE_OVERSCAN.x) / 2;
  const contentSpan = 1 / TEXTURE_OVERSCAN.x;
  const contentStartY = (1 - 1 / TEXTURE_OVERSCAN.y) / 2;
  const contentSpanY = 1 / TEXTURE_OVERSCAN.y;
  const zoom = THREE.MathUtils.clamp(config.textureZoom ?? state.textureZoom, .82, 2.20);
  const sourceRect = regionSpec?.rect || { x: 0, y: 0, w: 1, h: 1 };
  const sourceX = contentStart + sourceRect.x * contentSpan;
  const sourceW = sourceRect.w * contentSpan;
  const sourceY = contentStartY + sourceRect.y * contentSpanY;
  const sourceH = sourceRect.h * contentSpanY;
  let horizontalMin;
  let horizontalSpan;
  if (structure?.pair && ['child', 'main'].includes(role)) {
    // Every continuous pair uses one invariant: source texels per physical
    // metre. The authored seam is fixed. A narrower child leaf therefore
    // consumes a smaller source span at the seam (outer-left pixels are cut),
    // while a wider leaf grows only toward its outer edge into overscan.
    const pairRect = structure.pair.rect || { x: 0, y: 0, w: 1, h: 1 };
    const pairX = contentStart + pairRect.x * contentSpan;
    const pairW = pairRect.w * contentSpan;
    const seam = THREE.MathUtils.clamp(structure.pair.seam ?? .5, .05, .95);
    const seamX = pairX + pairW * seam;
    const authoredSpan = role === 'child' ? pairW * seam : pairW * (1 - seam);
    const authoredWidth = Math.max(.1, reference[role] || reference.main);
    const currentWidth = layout?.[role] || layout?.main || authoredWidth;
    const desiredSpan = THREE.MathUtils.clamp(authoredSpan * currentWidth / authoredWidth / zoom, .025, role === 'child' ? seamX : 1 - seamX);
    const pan = (config.texturePanX ?? state.texturePanX) * authoredSpan;
    const shiftedSeam = THREE.MathUtils.clamp(seamX + pan, desiredSpan, 1 - desiredSpan);
    horizontalSpan = desiredSpan;
    horizontalMin = role === 'child' ? shiftedSeam - desiredSpan : shiftedSeam;
  } else {
    const [fallbackMin, fallbackMax] = sourceWindow(key, role, layout, type, hasTransom);
    const baseMin = regionSpec ? sourceX : fallbackMin;
    const baseSpan = regionSpec ? sourceW : fallbackMax - fallbackMin;
    const referenceWidth = reference[role] || reference.main;
    const currentWidth = layout?.[role] || layout?.main || referenceWidth;
    const widthScale = THREE.MathUtils.clamp(currentWidth / Math.max(.1, referenceWidth), .55, 1.85);
    const anchor = ['outer-edge', 'meeting-stile'].includes(regionSpec?.anchor)
      ? role === 'child' ? 'end' : 'start'
      : 'center';
    const bounds = anchor === 'start'
        ? { min: 0, max: 1 }
      : anchor === 'end'
        ? { min: 0, max: 1 }
        : sourceRect.x === 0 && sourceRect.w === 1
          ? { min: 0, max: 1 }
          : { min: sourceX, max: sourceX + sourceW };
    const window = anchoredTextureWindow(
      baseMin,
      baseSpan,
      widthScale,
      zoom,
      anchor,
      bounds,
      (config.texturePanX ?? state.texturePanX) * baseSpan
    );
    horizontalMin = window.min;
    horizontalSpan = window.span;
  }
  // Keep the source texel density fixed in both directions. Smaller doors
  // crop the finite map; larger doors reveal more of it. The GLB geometry is
  // resized independently, so the map itself is never stretched with it.
  const referenceHeight = Math.max(.1, reference.height || defaultLeafSizes(authoredType, false).height);
  const heightScale = THREE.MathUtils.clamp(leafHeight / referenceHeight, .55, 1.75);
  const verticalBaseMin = regionSpec ? sourceY : contentStartY;
  const verticalBaseSpan = regionSpec ? sourceH : contentSpanY;
  const verticalWindow = anchoredTextureWindow(
    verticalBaseMin,
    verticalBaseSpan,
    heightScale,
    zoom,
    'center',
    { min: 0, max: 1 },
    (config.texturePanY ?? state.texturePanY) * verticalBaseSpan
  );
  const verticalMin = verticalWindow.min;
  const verticalSpan = verticalWindow.span;
  texture.offset.set(horizontalMin, verticalMin);
  texture.repeat.set(horizontalSpan, verticalSpan);
  texture.needsUpdate = true;
}

async function applyLeafTextures() {
  if (!modelRoot || !currentLeafLayout) return;
  const revision = ++textureBindRevision;
  const layout = { ...currentLeafLayout };
  const isDoorExtended = state.transom && transomRenderMode() === 'door-extended';
  const config = {
    product: state.product,
    type: state.type,
    // The extended option uses the ordinary door texture window over the full
    // leaf height. The separate true-transom options retain their own crop.
    transom: state.transom && !isDoorExtended,
    textureZoom: state.textureZoom,
    texturePanX: state.texturePanX,
    texturePanY: state.texturePanY,
    frontTextureVariant: state.frontTextureVariant,
    backTextureVariant: state.backTextureVariant,
    layout
  };
  const jobs = [];
  modelRoot.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const isLeaf = /^DoorLeaf_(Main|Child)_(Front|Back)$/.test(mesh.name);
    const isTransom = mesh.name === 'Transom_OpaquePanel';
    if (!isLeaf && !isTransom) return;
    const role = roleForMesh(mesh);
    const face = isLeaf && mesh.name.endsWith('_Back') ? 'back' : 'front';
    const region = isTransom ? 'transom' : textureRegionForMesh(mesh);
    const keyName = face === 'back' ? state.backFinish : state.frontFinish;
    const leafWidth = layout[role] || layout.main;
    const textureRole = isTransom ? 'transom' : region;
    const texturePart = isTransom ? 'master' : texturePartFor(keyName, textureRole, config.type);
    const regionSpec = isTransom ? null : getTextureRegion('k80', keyName, config.type, textureRole);
    const designSettings = isTransom
      ? null
      : textureDesignSettings(face, region);
    const designTransformActive = Boolean(
      designSettings
      && (
        designSettings.key !== 'factory'
        || Math.abs(Number(designSettings.offsetX) || 0) > .0001
        || Math.abs(Number(designSettings.offsetY) || 0) > .0001
        || Math.abs((Number(designSettings.scale) || 1) - 1) > .0001
      )
    );
    // 若简已移除灯带/拉手模型。纹理编辑仍沿用设计层流程，但不会再
    // 注入旧版橙色灯带贴图。
    const sourceTexturePart = !isTransom && keyName === 'ruojian' && designTransformActive
      ? 'design'
      : texturePart;
    const basePart = keyName === 'qingya'
      ? (texturePart === 'child' ? 'base-child' : ['main', 'design-main'].includes(texturePart) ? 'base-main' : 'base')
      : 'base';
    const selectedColor = textureSettings(isTransom ? 'front' : face, region).color;
    const baseTexturePromise = designSettings && (
      (keyName === 'ruojian' && designTransformActive)
      || (['yuanyin', 'jiangchuan', 'jinghong', 'qingya', 'qinghuafu'].includes(keyName) && designSettings.key !== 'factory')
    )
      ? getTexture(keyName, basePart, selectedColor).catch(() => null)
      : Promise.resolve(null);
    jobs.push(Promise.all([
      getTexture(keyName, sourceTexturePart, selectedColor),
      baseTexturePromise
    ]).then(([source, baseSource]) => {
      if (revision !== textureBindRevision) return;
      const settings = textureSettings(isTransom ? 'front' : face, region);
      const layeredCanvas = designSettings
        ? createTextureLayerCanvas(source.image, 'k80', keyName, region, {
          ...designSettings,
          baseImage: baseSource?.image || null,
          contentRect: {
            x: (1 - 1 / TEXTURE_OVERSCAN.x) / 2,
            y: (1 - 1 / TEXTURE_OVERSCAN.y) / 2,
            w: 1 / TEXTURE_OVERSCAN.x,
            h: 1 / TEXTURE_OVERSCAN.y
          }
        })
        : null;
      const layeredSource = layeredCanvas ? { image: layeredCanvas } : source;
      const surfaceCanvas = createTextureSurfaceCanvas(layeredSource, settings.surface || 'factory');
      const surfaceTexture = surfaceCanvas
        ? new THREE.CanvasTexture(surfaceCanvas)
        : layeredCanvas
          ? new THREE.CanvasTexture(layeredCanvas)
          : source.clone();
      surfaceTexture.colorSpace = THREE.SRGBColorSpace;
      surfaceTexture.wrapS = THREE.ClampToEdgeWrapping;
      surfaceTexture.wrapT = THREE.ClampToEdgeWrapping;
      surfaceTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      const variantKey = settings.variant;
      const variant = TEXTURE_VARIANTS.find((item) => item.key === variantKey) || TEXTURE_VARIANTS[0];
      const map = createTextureVariant(surfaceTexture, variant.key);
      surfaceTexture.dispose();
      map.needsUpdate = true;
      if (isTransom) {
        const masterSpanX = 1 / TEXTURE_OVERSCAN.x;
        const masterSpanY = 1 / TEXTURE_OVERSCAN.y;
        const stripSpan = masterSpanY * .16;
        map.offset.set(.5 - masterSpanX / 2, .5 + masterSpanY / 2 - stripSpan);
        map.repeat.set(masterSpanX, stripSpan);
      } else {
        setTextureWindow(map, keyName, role, leafWidth, layout.height, { ...config, regionSpec });
      }
      const materialProfile = referenceMaterialProfile(face);
      const material = makePhysicalMaterial(mesh.userData.originalMaterial || mesh.material, {
        metalness: materialProfile.metalness ?? variant.metalness,
        roughness: materialProfile.roughness ?? variant.roughness,
        clearcoat: materialProfile.clearcoat ?? variant.clearcoat,
        clearcoatRoughness: .17,
        envMapIntensity: materialProfile.envMapIntensity ?? 1.58,
        specularIntensity: .92
      });
      const colorway = currentColorway(isTransom ? 'front' : face, region);
      material.color.setHex(colorway.tint);
      if (!isTransom && materialProfile.tint) material.color.multiply(new THREE.Color(materialProfile.tint));
      material.map = map;
      material.bumpMap = map;
      material.bumpScale = materialProfile.bumpScale ?? variant.bumpScale;
      material.normalScale?.set(.24, .24);
      if (mesh.material?.userData?.runtimeMaterial) mesh.material.dispose();
      material.userData.runtimeMaterial = true;
      mesh.material = material;
    }));
  });
  await Promise.all(jobs);
  await applyK80SideLightAppearance(revision);
  syncRuntimeTransomAppearance();
}

function setVisibility(object3d, visible) {
  if (object3d) object3d.visible = visible;
}

function resizeLeaf(role, pivot, width, height) {
  if (!pivot) return;
  const direction = role === 'child' ? 1 : -1;
  const baseWidth = pivot.userData.baseWidth || (role === 'child' ? .386 : .752);
  const baseHeight = pivot.userData.baseHeight || 2.108;
  pivot.traverse((part) => {
    if (part === pivot) return;
    restoreBase(part);
    const name = part.name;
    if (/^(DoorLeaf_|Main_Core|Child_Core)/.test(name)) {
      part.scale.x *= width / baseWidth;
      part.scale.y *= height / baseHeight;
      part.position.x = direction * width / 2;
      part.position.y = height / 2;
    } else if (name.includes('FoldedEdge_Hinge') || name.includes('LeafSeal_Hinge')) {
      part.scale.y *= height / baseHeight;
      part.position.x = direction * .010;
      part.position.y = height / 2;
    } else if (name.includes('FoldedEdge_Latch') || name.includes('LeafSeal_Latch')) {
      part.scale.y *= height / baseHeight;
      part.position.x = direction * (width - .010);
      part.position.y = height / 2;
    } else if (name.includes('FoldedEdge_Bottom')) {
      part.scale.x *= width / baseWidth;
      part.position.x = direction * width / 2;
      part.position.y = .012;
    } else if (name.includes('FoldedEdge_Top')) {
      part.scale.x *= width / baseWidth;
      part.position.x = direction * width / 2;
      part.position.y = height - .012;
    }
  });

  const delta = direction * (width - baseWidth);
  const hardware = object(`${role === 'main' ? 'Main' : 'Child'}Hardware`);
  const lockEdge = object(`${role === 'main' ? 'Main' : 'Child'}LockEdge`);
  if (hardware) hardware.position.x = (hardware.userData.runtimeBase?.position.x || 0) + delta;
  if (lockEdge) lockEdge.position.x = (lockEdge.userData.runtimeBase?.position.x || 0) + delta;

  const hingePlates = object(`${role === 'main' ? 'Main' : 'Child'}LeafHingePlates`);
  hingePlates?.traverse((part) => {
    const match = part.name.match(/Hinge_(\d+)_/);
    if (!match) return;
    const index = Number(match[1]);
    part.position.y = index === 1 ? .28 : index === 2 ? height * .52 : height - .28;
  });
}

function resizeFrame(width, height, leafHeight, openingWidth) {
  if (!frameGroup) return;
  const deltaW = width - BASE.width;
  const deltaH = height - BASE.height;
  frameGroup.traverse((part) => {
    if (part === frameGroup) return;
    restoreBase(part);
    const side = part.userData.frameSide;
    const dimensions = part.userData.baseDimensions || [];
    if (side === 'left' || side === 'right') {
      const sign = side === 'left' ? -1 : 1;
      part.position.x += sign * deltaW / 2;
      if (part.name.includes('Gasket')) {
        const baseLeafHeight = Math.max(.1, dimensions[2] || currentLeafLayout.height);
        part.scale.y *= leafHeight / baseLeafHeight;
        part.position.y = BASE.threshold + leafHeight / 2;
      } else if (!part.name.includes('Hinge_')) {
        part.scale.y *= height / BASE.height;
        part.position.y += deltaH / 2;
      }
    } else if (side === 'top') {
      const baseWidth = Math.max(.1, dimensions[0] || BASE.width);
      part.scale.x *= (baseWidth + deltaW) / baseWidth;
      part.position.y += deltaH;
    } else if (side === 'bottom') {
      const baseWidth = Math.max(.1, dimensions[0] || (BASE.width - BASE.jamb * 2));
      part.scale.x *= (baseWidth + deltaW) / baseWidth;
    }
  });

  ['Main', 'Child'].forEach((label) => {
    const role = label.toLowerCase();
    const hingeX = role === 'main'
      ? (currentLeafLayout?.mainPivotX ?? openingWidth / 2)
      : (currentLeafLayout?.childPivotX ?? -openingWidth / 2);
    const hinges = object(`${label}FrameHinges`);
    if (!hinges) return;
    hinges.traverse((part) => {
      restoreBase(part);
      if (!part.name.includes(`${label}_Hinge_`)) return;
      const frameOffset = part.name.includes('FramePlate') || part.name.includes('FrameScrew')
        ? (role === 'main' ? .022 : -.022)
        : (role === 'main' ? .032 : -.032);
      part.position.x = hingeX + frameOffset;
      const match = part.name.match(/Hinge_(\d+)_/);
      if (match) {
        const index = Number(match[1]);
        part.position.y = BASE.threshold + (index === 1 ? .28 : index === 2 ? leafHeight * .52 : leafHeight - .28);
      }
    });
  });
}

function resizeCasing(width, height) {
  const casing = object('CasingGroup');
  if (!casing) return;
  const deltaW = width - BASE.width;
  const deltaH = height - BASE.height;
  casing.traverse((part) => {
    if (part === casing) return;
    restoreBase(part);
    const side = part.userData.frameSide;
    const dimensions = part.userData.baseDimensions || [];
    if (side === 'left' || side === 'right') {
      const sign = side === 'left' ? -1 : 1;
      part.position.x += sign * deltaW / 2;
      part.scale.y *= (dimensions[2] + deltaH) / dimensions[2];
      part.position.y += deltaH / 2;
    } else if (side === 'top') {
      part.scale.x *= (dimensions[0] + deltaW) / dimensions[0];
      part.position.y += deltaH;
    }
  });
}

function applyFrameInstallation() {
  const wallDelta = (Number(state.wallThickness) - 240) / 1000;
  const installRatio = { outside: -.5, center: 0, inside: .5 }[state.frameInstall] ?? 0;
  // Keep a small visible construction offset even at the nominal 240 mm wall.
  // Previously all three installation choices resolved to 0 at the default
  // wall thickness, so the selector looked interactive but never moved a part.
  const zOffset = installRatio * (.052 + Math.abs(wallDelta) * .5);
  [frameGroup, object('CasingGroup'), transomGroup, k80SideLightLeft, k80SideLightRight].forEach((group) => {
    if (!group) return;
    const base = group.userData.runtimeBase;
    if (base) group.position.z = base.position.z + zOffset;
  });
  const casing = object('CasingGroup');
  casing?.traverse((part) => {
    if (!part.name.includes('WallReturn')) return;
    const base = part.userData.runtimeBase;
    if (base) part.scale.z = base.scale.z * Math.max(.55, Number(state.wallThickness) / 240);
  });
  if (frameGroup) frameGroup.userData.installation = state.frameInstall;
  if (casing) casing.userData.wallThickness = Number(state.wallThickness);
}

const FRAME_PROFILE_SPECS = {
  'Z型': { jamb: .075, depth: .165, rebate: .022 },
  P40: { jamb: .050, depth: .118, rebate: .016 },
  P70: { jamb: .082, depth: .184, rebate: .030 },
  XMQ: { jamb: .096, depth: .205, rebate: .034 }
};

const CASING_PROFILE_SPECS = {
  'Z型': { face: .052, depth: .030, steps: 1 },
  'W型': { face: .068, depth: .032, steps: 2 },
  P40: { face: .040, depth: .026, steps: 1 },
  P70: { face: .072, depth: .034, steps: 2 },
  WLK: { face: .058, depth: .030, steps: 2 }
};
// Let both casing faces lap over the leaf/frame edge.  This is the visible
// compression joint in the real assembly; without it the casing only touches
// the door edge and disappears in an oblique view.
const CASING_LEAF_OVERLAP = .006;

function disposeRuntimeGroup(group) {
  if (!group) return;
  group.traverse((part) => {
    if (!part.isMesh) return;
    part.geometry?.dispose?.();
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    materials.filter(Boolean).forEach((material) => material.dispose?.());
  });
  group.clear();
}

const casingTextureCache = new Map();

function casingTextureKey(kind, product, colorLabel) {
  return `${kind}:${product}:${colorLabel || 'default'}`;
}

function createCasingSurfaceTexture(kind, product, colorLabel) {
  const key = casingTextureKey(kind, product, colorLabel);
  if (casingTextureCache.has(key)) return casingTextureCache.get(key);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  // Keep the map deliberately neutral: the selected colour is still supplied
  // by MeshPhysicalMaterial, while this map carries the directional finish.
  context.fillStyle = '#c8c8c8';
  context.fillRect(0, 0, size, size);
  const seed = [...`${product}:${colorLabel || ''}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const vertical = kind === 'outer';
  const lineCount = vertical ? 84 : 56;
  for (let index = 0; index < lineCount; index += 1) {
    const position = ((index * (vertical ? 19 : 31) + seed) % size) + .5;
    const alpha = .08 + ((index * 7 + seed) % 8) / 100;
    context.strokeStyle = `rgba(${index % 3 === 0 ? 255 : 45},${index % 3 === 0 ? 255 : 45},${index % 3 === 0 ? 255 : 45},${alpha})`;
    context.lineWidth = index % 9 === 0 ? 1.2 : .55;
    context.beginPath();
    if (vertical) {
      context.moveTo(position, 0);
      context.lineTo(position + ((index % 5) - 2) * .7, size);
    } else {
      context.moveTo(0, position);
      context.lineTo(size, position + ((index % 5) - 2) * .7);
    }
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(vertical ? 1.15 : 2.25, vertical ? 4.8 : 2.8);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  casingTextureCache.set(key, texture);
  return texture;
}

function runtimeProfileMaterial(name, color, roughness = .24, map = null) {
  return new THREE.MeshPhysicalMaterial({
    color,
    map,
    bumpMap: map,
    bumpScale: map ? .0035 : 0,
    metalness: .72,
    roughness,
    clearcoat: .18,
    clearcoatRoughness: .17,
    envMapIntensity: 1.52,
    specularIntensity: .88
  });
}

function addRuntimeProfileBar(group, name, dimensions, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addRuntimeCasingProfile(group, prefix, width, height, spec, z, material, direction = 'front') {
  const face = spec.face;
  const depth = spec.depth;
  const isBack = direction === 'back';
  const sign = isBack ? 1 : -1;
  const outerHalf = width / 2 - CASING_LEAF_OVERLAP + face / 2;
  ['Left', 'Right'].forEach((side) => {
    const sideSign = side === 'Left' ? -1 : 1;
    addRuntimeProfileBar(group, `${prefix}_${side}_Face`, [face, height + face * 2, depth], [sideSign * outerHalf, height / 2, z], material);
  });
  addRuntimeProfileBar(group, `${prefix}_Top_Face`, [width + face * 2 - CASING_LEAF_OVERLAP * 2, face, depth], [0, height - CASING_LEAF_OVERLAP + face / 2, z], material);
  if (spec.steps > 1) {
    const revealMat = runtimeProfileMaterial(`${prefix} stepped reveal`, material.color.clone().multiplyScalar(.62), .30, material.map);
    const inset = face * .34;
    const revealDepth = depth * .55;
    // Keep the stepped reveal inside the same face envelope as the casing.
    // Multiplying the full depth by .58 used to move it outside the door
    // instead of placing it on the visible face, which created the long
    // front/back fins seen in side view.
    const revealOffset = (depth - revealDepth) / 2;
    ['Left', 'Right'].forEach((side) => {
      const sideSign = side === 'Left' ? -1 : 1;
      addRuntimeProfileBar(group, `${prefix}_${side}_Step`, [Math.max(.012, face * .24), height + face - CASING_LEAF_OVERLAP * 2, revealDepth], [sideSign * (width / 2 - CASING_LEAF_OVERLAP + inset), height / 2, z + sign * revealOffset], revealMat);
    });
    addRuntimeProfileBar(group, `${prefix}_Top_Step`, [width + inset * 2 - CASING_LEAF_OVERLAP * 2, Math.max(.012, face * .24), revealDepth], [0, height - CASING_LEAF_OVERLAP + inset, z + sign * revealOffset], revealMat);
  }
}

function addRuntimeArchCasingProfile(group, prefix, width, height, spec, z, material, direction = 'front') {
  const face = spec.face;
  const depth = spec.depth;
  const sign = direction === 'back' ? 1 : -1;
  // A rounded-head door cannot retain the rectangular casing's top bar. Build
  // the entire casing as one full-height arched ring so its jambs turn into
  // the crown exactly like the reference elevation.
  const outerWidth = width + face * 2;
  const arch = runtimeArchExtrusion(
    runtimeArchFrameShape(outerWidth, height, face + CASING_LEAF_OVERLAP), depth, z + depth / 2,
    height / 2, material, `${prefix}_ArchFace`, 'frame', .001
  );
  group.add(arch);
  if (spec.steps > 1) {
    const revealMaterial = runtimeProfileMaterial(`${prefix} stepped arch reveal`, material.color.clone().multiplyScalar(.62), .30, material.map);
    const inset = face * .52;
    const revealDepth = depth * .55;
    // The reveal is a shallow layer on the corresponding casing face. Keep
    // its centre within the full profile instead of shifting it beyond the
    // door leaf in the thickness direction.
    const revealCenter = z + sign * (depth - revealDepth) / 2;
    const reveal = runtimeArchExtrusion(
      runtimeArchFrameShape(
        Math.max(.20, outerWidth - inset * 2),
        Math.max(.24, height - inset * 2),
        Math.max(.010, face * .24)
      ),
      revealDepth,
      revealCenter + revealDepth / 2,
      height / 2,
      revealMaterial,
      `${prefix}_ArchStep`,
      'frame',
      0
    );
    group.add(reveal);
  }
}

function applyFrameVariants() {
  if (!frameGroup) return;
  const width = state.width / 1000;
  const height = state.height / 1000;
  const openingWidth = width - BASE.jamb * 2;
  const frameSpec = FRAME_PROFILE_SPECS[state.frameProfile] || FRAME_PROFILE_SPECS.P40;
  // This configurator's default installation keeps the complete visible frame
  // inside the 85 mm leaf envelope. Profile changes may alter face width and
  // rebate detail, but must not leave a long top member projecting outward.
  const visibleFrameDepth = Math.min(BASE.leafThickness, frameSpec.depth);
  const isRound = state.transom && transomRenderMode().startsWith('round');
  const frameColor = referenceColorHex(state.frameColor, PRODUCT_FRAME_FINISH[state.product]?.frame || FIXED_FRAME_FINISH.frame);
  const outerColor = referenceColorHex(state.outerCasingColor, PRODUCT_FRAME_FINISH[state.product]?.casing || FIXED_FRAME_FINISH.casing);
  const innerColor = referenceColorHex(state.innerCasingColor, PRODUCT_FRAME_FINISH[state.product]?.edge || FIXED_FRAME_FINISH.edge);

  frameGroup.traverse((part) => {
    if (!part.isMesh) return;
    const dimensions = part.userData.baseDimensions || [];
    const side = part.userData.frameSide;
    // The baked GLB lintel was authored for the 1300 mm source door. Scaling
    // it to the configured opening produces the long, detached top beam seen
    // in perspective. Runtime casing profiles below supply the correctly
    // dimensioned top closure, so the authored lintel and its stop must never
    // remain visible in the configurable view.
    if (side === 'top' && /StructuralHead|RebateStop/.test(part.name)) {
      part.visible = false;
      return;
    }
    if (/StructuralJamb/.test(part.name) && ['left', 'right'].includes(side)) {
      const sign = side === 'left' ? -1 : 1;
      part.scale.x *= frameSpec.jamb / Math.max(.001, dimensions[0] || BASE.jamb);
      part.scale.z *= visibleFrameDepth / Math.max(.001, dimensions[1] || .165);
      part.position.x = sign * (width / 2 - frameSpec.jamb / 2);
    } else if (/StructuralHead/.test(part.name) && side === 'top') {
      const clearSpan = width - frameSpec.jamb * 2;
      part.scale.x *= clearSpan / Math.max(.001, dimensions[0] || openingWidth);
      part.scale.z *= visibleFrameDepth / Math.max(.001, dimensions[1] || .165);
    } else if (/RebateStop/.test(part.name)) {
      // Side and top rebate stops are authored on different axes. Using one
      // fallback dimension made the horizontal stop collapse after a profile
      // switch, so each direction is now resized on its true section axis.
      if (['left', 'right'].includes(side)) {
        part.scale.x *= frameSpec.rebate / Math.max(.001, dimensions[0] || .022);
      }
      if (side === 'top') {
        part.scale.y *= frameSpec.rebate / Math.max(.001, dimensions[1] || .022);
      }
    }
    if (part.material?.color && (/frame_|transom_/i.test(part.name))) {
      part.material.color.setHex(frameColor);
      part.material.needsUpdate = true;
    }
  });

  if (!runtimeCasingGroup) {
    runtimeCasingGroup = new THREE.Group();
    runtimeCasingGroup.name = 'RuntimeCasingVariants';
    frameGroup.add(runtimeCasingGroup);
  }
  disposeRuntimeGroup(runtimeCasingGroup);
  const outerSpec = CASING_PROFILE_SPECS[state.outerCasing] || CASING_PROFILE_SPECS.P40;
  const innerSpec = CASING_PROFILE_SPECS[state.innerCasing] || CASING_PROFILE_SPECS['W型'];
  // A casing may have a wider visual face, but neither casing is allowed to
  // project past the two door faces at the default installation datum.
  const visibleOuterSpec = {
    ...outerSpec,
    depth: Math.min(BASE.leafThickness, outerSpec.depth),
    // On a round head the casing turns into the visible crown. Keep that
    // crown face exactly as wide as the selected jamb so the very top reads
    // as one continuous frame instead of a hairline cap.
    ...(isRound ? { face: frameSpec.jamb } : {})
  };
  const visibleInnerSpec = { ...innerSpec, depth: Math.min(BASE.leafThickness, innerSpec.depth) };
  // The product front/exterior is the local -Z face (the handle and front
  // finish are authored on this side). Keep the outer casing flush to that
  // face and place the inner casing flush to the opposite face; both profiles
  // stay inside the same 85 mm thickness envelope as the door leaf.
  const outerCasingZ = -(BASE.leafThickness - visibleOuterSpec.depth) / 2;
  const innerCasingZ = (BASE.leafThickness - visibleInnerSpec.depth) / 2;
  const addOuterCasing = isRound ? addRuntimeArchCasingProfile : addRuntimeCasingProfile;
  const addInnerCasing = isRound ? addRuntimeArchCasingProfile : addRuntimeCasingProfile;
  const outerCasingTexture = createCasingSurfaceTexture('outer', state.product, state.outerCasingColor);
  const innerCasingTexture = createCasingSurfaceTexture('inner', 'shared-k80', state.innerCasingColor);
  addOuterCasing(runtimeCasingGroup, `OuterCasing_${state.outerCasing}`, width, height, visibleOuterSpec, outerCasingZ, runtimeProfileMaterial('Outer casing', outerColor, .24, outerCasingTexture), 'front');
  addInnerCasing(runtimeCasingGroup, `InnerCasing_${state.innerCasing}`, width - frameSpec.jamb * 2, height - .025, visibleInnerSpec, innerCasingZ, runtimeProfileMaterial('Inner casing', innerColor, .30, innerCasingTexture), 'back');
  if (!isRound) {
    // Close the head between the jambs with a correctly sized runtime member.
    // The old GLB lintel is hidden because it overhangs after resizing; leaving
    // it hidden without this replacement creates the open slot reported in
    // the configurator. This closure stays inside the same leaf-thickness
    // envelope as the jambs and casing.
    const headHeight = Math.max(BASE.head, frameSpec.jamb);
    addRuntimeProfileBar(
      runtimeCasingGroup,
      'RuntimeFrameHeadClosure',
      // Use the full frame datum, not only the clear opening. The top member
      // must terminate over the outside edges of both jambs so the default
      // GLB reads as one complete rectangular door frame.
      [Math.max(.10, width), headHeight, visibleFrameDepth],
      [0, height - headHeight / 2, 0],
      runtimeProfileMaterial('Frame head closure', frameColor, .24)
    );
  }
  if (state.frameBuild === 'assembled') {
    const joinMat = runtimeProfileMaterial('Frame assembly joint', new THREE.Color(frameColor).multiplyScalar(.72), .34);
    [-1, 1].forEach((sign) => addRuntimeProfileBar(runtimeCasingGroup, `FrameAssemblyJoint_${sign < 0 ? 'Left' : 'Right'}`, [.028, .048, .024], [sign * (width / 2 - frameSpec.jamb), height - .040, -.092], joinMat));
  }
  runtimeCasingGroup.userData = { outer: state.outerCasing, inner: state.innerCasing, frame: state.frameProfile, round: isRound };
}

function clearRuntimeTransomVariant() {
  if (!transomVariantGroup) return;
  const geometries = new Set();
  const materials = new Set();
  transomVariantGroup.traverse((part) => {
    if (!part.isMesh && !part.isLine) return;
    if (part.geometry) geometries.add(part.geometry);
    const source = Array.isArray(part.material) ? part.material : [part.material];
    source.filter(Boolean).forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  transomVariantGroup.clear();
}

function runtimeTransomOpaqueMaterial() {
  const source = object('Transom_OpaquePanel')?.material;
  const profile = referenceMaterialProfile('front');
  const material = makePhysicalMaterial(source, profile);
  if (source?.color) material.color.copy(source.color);
  if (source?.map) material.map = source.map;
  if (source?.bumpMap) material.bumpMap = source.bumpMap;
  material.bumpScale = profile.bumpScale ?? source?.bumpScale ?? .012;
  material.userData.runtimeTransomMaterial = 'opaque';
  return material;
}

function runtimeTransomFrameMaterial() {
  const material = new THREE.MeshPhysicalMaterial({
    color: referenceColorHex(state.frameColor, 0x4a4039),
    metalness: .78,
    roughness: .23,
    clearcoat: .18,
    clearcoatRoughness: .16,
    envMapIntensity: 1.58,
    specularIntensity: .92
  });
  material.userData.runtimeTransomMaterial = 'frame';
  return material;
}

function runtimeTransomGlassMaterial() {
  const glass = state.transomOuterGlass !== '无' ? state.transomOuterGlass : state.transomInnerGlass;
  const color = /长虹/.test(glass) ? 0x8fa5a8 : /磨砂/.test(glass) ? 0xa6aaa4 : /LOW/.test(glass) ? 0x789da6 : 0x6f9098;
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: .08,
    roughness: /磨砂|长虹/.test(glass) ? .42 : .24,
    transmission: .08,
    thickness: .016,
    transparent: true,
    opacity: /磨砂|长虹/.test(glass) ? .72 : .62,
    side: THREE.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.26
  });
  material.userData.runtimeTransomMaterial = 'glass';
  return material;
}

function addRuntimeTransomBar(group, width, height, x, y, z, material, name = 'RuntimeTransomFrame', depth = BASE.leafThickness) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  bar.name = name;
  bar.position.set(x, y, z);
  bar.castShadow = true;
  bar.receiveShadow = true;
  bar.userData.runtimeTransomRole = 'frame';
  group.add(bar);
  return bar;
}

function addRuntimeRectFrame(group, width, height, centerY, z, material, thickness = .022, depth = BASE.leafThickness) {
  addRuntimeTransomBar(group, width + thickness, thickness, 0, centerY + height / 2, z, material, 'RuntimeTransomFrame', depth);
  addRuntimeTransomBar(group, width + thickness, thickness, 0, centerY - height / 2, z, material, 'RuntimeTransomFrame', depth);
  addRuntimeTransomBar(group, thickness, height, -width / 2, centerY, z, material, 'RuntimeTransomFrame', depth);
  addRuntimeTransomBar(group, thickness, height, width / 2, centerY, z, material, 'RuntimeTransomFrame', depth);
}

function runtimeArchShape(width, height) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  // The reference has a genuine door-head arch: straight spring legs below
  // the curve plus a moderately raised crown. A semicircle squeezed into a
  // shallow rectangular panel produced the former cartoon-like canopy.
  const archRise = Math.min(height * .70, width * .27);
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, -halfHeight);
  shape.lineTo(-halfWidth, halfHeight - archRise);
  shape.quadraticCurveTo(0, halfHeight, halfWidth, halfHeight - archRise);
  shape.lineTo(halfWidth, -halfHeight);
  shape.closePath();
  return shape;
}

function runtimeArchFrameShape(width, height, border) {
  const outer = runtimeArchShape(width, height);
  const innerPoints = runtimeArchShape(
    Math.max(.08, width - border * 2),
    Math.max(.08, height - border * 2)
  ).getPoints(48).reverse();
  const hole = new THREE.Path();
  innerPoints.forEach((point, index) => {
    if (index === 0) hole.moveTo(point.x, point.y);
    else hole.lineTo(point.x, point.y);
  });
  hole.closePath();
  outer.holes.push(hole);
  return outer;
}

function runtimeArchExtrusion(shape, depth, frontZ, centerY, material, name, role, bevel = .002) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 36
  });
  // Keep the leading face on the same plane as the 85 mm door leaf and let
  // the full body extend rearward into the opening; this is a real cassette,
  // not a paper-thin decorative overlay.
  geometry.translate(0, 0, -depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(0, centerY, frontZ);
  mesh.castShadow = role !== 'glass';
  mesh.receiveShadow = true;
  mesh.userData.runtimeTransomRole = role;
  return mesh;
}

function runtimeTransomExtrusion(shape, depth, frontZ, centerY, material, name, role, bevel = .002) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 36
  });
  // Transom front is the local -Z face. Extrusion therefore travels toward
  // +Z into the door, keeping the cassette flush instead of projecting out
  // from the exterior facade.
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(0, centerY, frontZ);
  mesh.castShadow = role !== 'glass';
  mesh.receiveShadow = true;
  mesh.userData.runtimeTransomRole = role;
  return mesh;
}

function runtimeArchMetrics(width, height, centerY) {
  const archRise = Math.min(height * .70, width * .27);
  return {
    halfWidth: width / 2,
    bottomY: centerY - height / 2,
    springY: centerY + height / 2 - archRise,
    crownY: centerY + height / 2,
    archRise
  };
}

function addRuntimeSquareGlassGrid(group, width, height, centerY, z, material) {
  // The catalogue's square light is a real glazed cassette, not a tinted
  // rectangle with one arbitrary centre divider: three verticals + a crossbar
  // create the repeated steel glazing cells visible in the reference image.
  const verticalHeight = height - .026;
  [-.25, 0, .25].forEach((ratio, index) => {
    addRuntimeTransomBar(group, .012, verticalHeight, width * ratio, centerY, z, material, `RuntimeSquareGlassMullion_${index + 1}`);
  });
  addRuntimeTransomBar(group, width - .026, .012, 0, centerY, z, material, 'RuntimeSquareGlassCrossbar');
}

function addRuntimeArchGlassGrid(group, width, height, centerY, z, material) {
  const metrics = runtimeArchMetrics(width, height, centerY);
  // Keep the glazing cassette as one clean pane with its continuous spring
  // rail. The old free-standing vertical bars were not clipped to the curved
  // head and visibly pierced the crown in the rendered model, so the arched
  // light deliberately has no unsupported mullions.
  addRuntimeTransomBar(group, width - .026, .013, 0, metrics.springY, z, material, 'RuntimeArchGlassSpringRail');
}

function rebuildRuntimeTransom(mode, openingWidth, panelHeight, centerY, totalHeight = BASE.height, bottomY = centerY - panelHeight / 2 - .060) {
  if (!transomVariantGroup) return;
  clearRuntimeTransomVariant();
  transomVariantGroup.visible = Boolean(state.transom && mode !== 'none' && mode !== 'door-extended');
  if (!transomVariantGroup.visible) return;

  const width = Math.max(.18, openingWidth - .070);
  const height = Math.max(.11, panelHeight - .045);
  // Every transom uses the same 85 mm construction depth as the door leaf.
  // Glass is thin by nature, but is retained by a full-depth steel cassette.
  const transomDepth = BASE.leafThickness;
  // The product front/exterior is the local -Z face. The previous positive
  // datum placed the whole transom cassette on the back side and made its
  // frame visibly float outside the door.
  const frontZ = -BASE.leafThickness / 2;
  const coreZ = frontZ + transomDepth / 2;
  const opaque = runtimeTransomOpaqueMaterial();
  const frame = runtimeTransomFrameMaterial();
  const glass = runtimeTransomGlassMaterial();
  const isGlass = mode === 'square-glass' || mode === 'round-glass';
  const isRound = mode.startsWith('round');
  const isFake = mode.endsWith('fake');

  if (!isRound) {
    const paneDepth = isGlass ? .006 : transomDepth;
    const infill = new THREE.Mesh(new THREE.BoxGeometry(width, height, paneDepth), isGlass ? glass : opaque);
    infill.name = isGlass ? 'RuntimeTransomGlass' : 'RuntimeTransomSurface';
    infill.position.set(0, centerY, isGlass ? frontZ + paneDepth / 2 : coreZ);
    infill.castShadow = !isGlass;
    infill.receiveShadow = true;
    infill.userData.runtimeTransomRole = isGlass ? 'glass' : 'opaque';
    transomVariantGroup.add(infill);
    addRuntimeRectFrame(transomVariantGroup, width, height, centerY, 0, frame);
    if (isGlass) {
      const rearPane = new THREE.Mesh(new THREE.BoxGeometry(width, height, paneDepth), glass.clone());
      rearPane.name = 'RuntimeTransomGlassRearPane';
      rearPane.position.set(0, centerY, frontZ + transomDepth - paneDepth / 2);
      rearPane.userData.runtimeTransomRole = 'glass';
      transomVariantGroup.add(rearPane);
      addRuntimeSquareGlassGrid(transomVariantGroup, width, height, centerY, 0, frame);
    } else {
      // The closed and false variants use a recessed panel profile. They do
      // not receive the generic full-height centre mullion used by the old
      // square asset, because that split is absent from the reference panels.
      addRuntimeRectFrame(transomVariantGroup, width - .055, height - .050, centerY, frontZ + .005, frame, .010, .010);
      if (isFake) {
        addRuntimeTransomBar(transomVariantGroup, width - .075, .008, 0, centerY - height * .12, frontZ + .008, frame, 'RuntimeSquareFalseShadowLine', .006);
      }
    }
    return;
  }

  // Rounded lights are modelled as a proper, continuous arch cassette. The
  // former TubeGeometry outlines were merely decorative floating arcs and
  // visibly failed against any real door reference.
  // A rounded head starts directly at the door-leaf top and reaches the
  // opening crown.  It owns the one legitimate horizontal divide between
  // head and leaf; leaving the legacy rectangular rail visible underneath
  // produced the unexplained second beam in the previous render.
  const frameSpec = FRAME_PROFILE_SPECS[state.frameProfile] || FRAME_PROFILE_SPECS.P40;
  // The round cassette sits inside the complete arched door frame.  The old
  // openingWidth/height pair allowed its crown to run almost to the outer
  // casing crown, which visually erased the top frame.  Derive both bounds
  // from the actual frame profile instead: the side clearance and crown
  // inset are the same as the selected jamb width, while the lower edge
  // remains exactly on the leaf head/transition rail.
  const transomBottomY = bottomY;
  const transomTopY = totalHeight - frameSpec.jamb;
  const outerWidth = Math.max(.20, openingWidth + (BASE.jamb - frameSpec.jamb) * 2);
  const outerHeight = Math.max(.20, transomTopY - transomBottomY);
  const archCenterY = (transomTopY + transomBottomY) / 2;
  const border = Math.min(frameSpec.jamb, outerWidth * .22);
  const innerWidth = Math.max(.12, outerWidth - border * 2);
  const innerHeight = Math.max(.12, outerHeight - border * 2);
  const archRing = runtimeTransomExtrusion(
    runtimeArchFrameShape(outerWidth, outerHeight, border), transomDepth,
    frontZ, archCenterY, frame, 'RuntimeRoundTransomFrame', 'frame'
  );
  transomVariantGroup.add(archRing);
  // Do not add a second complete arch ring on the face: every closed ring
  // also has a bottom edge, which duplicated the one horizontal rail that
  // should separate the arched head from the door leaves.

  if (isGlass) {
    const paneDepth = .006;
    const frontPane = runtimeTransomExtrusion(
      runtimeArchShape(innerWidth, innerHeight), paneDepth, frontZ - .001,
      archCenterY, glass, 'RuntimeRoundGlassFrontPane', 'glass', 0
    );
    const rearPane = runtimeTransomExtrusion(
      runtimeArchShape(innerWidth, innerHeight), paneDepth,
      frontZ + transomDepth - paneDepth + .001, archCenterY, glass.clone(),
      'RuntimeRoundGlassRearPane', 'glass', 0
    );
    transomVariantGroup.add(frontPane, rearPane);
    addRuntimeArchGlassGrid(transomVariantGroup, innerWidth, innerHeight, archCenterY, coreZ, frame);
  } else {
    const core = runtimeTransomExtrusion(
      runtimeArchShape(innerWidth, innerHeight), transomDepth, frontZ,
      archCenterY, opaque, 'RuntimeRoundOpaqueCore', 'opaque'
    );
    transomVariantGroup.add(core);
    if (isFake) {
      // Cosmetic false windows still have a door-thick closed head; the
      // shallow face joint is the only visual distinction from a true panel.
      const faceJoint = runtimeTransomExtrusion(
        runtimeArchFrameShape(Math.max(.10, innerWidth - .034), Math.max(.10, innerHeight - .034), .009),
        .006, frontZ + .006, archCenterY, frame, 'RuntimeRoundFalseFaceJoint', 'frame', 0
      );
      transomVariantGroup.add(faceJoint);
    }
  }
}

function syncRuntimeTransomAppearance() {
  if (!transomVariantGroup?.visible) return;
  const source = object('Transom_OpaquePanel')?.material;
  const profile = referenceMaterialProfile('front');
  const frameColor = referenceColorHex(state.frameColor, 0x4a4039);
  transomVariantGroup.traverse((part) => {
    if (!part.isMesh || !part.material) return;
    const role = part.userData.runtimeTransomRole;
    if (role === 'opaque') {
      if (source?.color) part.material.color.copy(source.color);
      if (source?.map) part.material.map = source.map;
      if (source?.bumpMap) part.material.bumpMap = source.bumpMap;
      part.material.metalness = profile.metalness ?? part.material.metalness;
      part.material.roughness = profile.roughness ?? part.material.roughness;
      part.material.clearcoat = profile.clearcoat ?? part.material.clearcoat;
      part.material.bumpScale = profile.bumpScale ?? part.material.bumpScale;
      part.material.needsUpdate = true;
    } else if (role === 'frame') {
      part.material.color.setHex(frameColor);
      part.material.needsUpdate = true;
    }
  });
}

function resizeTransom(openingWidth, height, leafHeight) {
  if (!transomGroup) return;
  const mode = transomRenderMode();
  const isDoorExtended = state.transom && mode === 'door-extended';
  const isRound = state.transom && mode.startsWith('round');
  transomGroup.visible = state.transom && !isDoorExtended;
  // The authored transom contains several source rails/panels that cannot be
  // resized to the current opening. Keep its material source, but suppress
  // every baked mesh so it cannot stack with the runtime cassette.
  transomGroup.traverse((part) => {
    if (!part.isMesh || part.userData.runtimeTransomRole) return;
    part.visible = false;
  });
  if (integratedTransomSeparator) integratedTransomSeparator.visible = isDoorExtended;
  if (!state.transom) {
    if (transomVariantGroup) transomVariantGroup.visible = false;
    return;
  }
  if (isDoorExtended) {
    // 门体加高气窗不是第二块浅色面板：门扇本体已经延伸到门洞顶部，
    // 只保留产品同色的细分割线。这样上下共用同一张纹理，也不会出现
    // 气窗与门扇之间的白色门框。
    const separatorY = BASE.threshold + leafHeight - BASE.transom;
    const separator = integratedTransomSeparator;
    if (separator) {
      separator.scale.x = Math.max(.1, openingWidth / Math.max(.1, separator.userData.baseWidth || 1));
      separator.position.set(0, separatorY, BASE.leafThickness / 2 + .004);
    }
    if (transomVariantGroup) transomVariantGroup.visible = false;
    return;
  }
  const rail = object('Transom_BottomRail');
  const panel = object('Transom_OpaquePanel');
  const mullion = object('Transom_CenterMullion');
  const structuralHead = object('Frame_Top_StructuralHead');
  const topRebateStop = object('Frame_Top_RebateStop');
  // All configurable lights are now built from independent runtime parts.
  // This prevents the baked plain panel/mullion from leaking through behind a
  // real glass grid or a curved structural head.
  // Round-head variants contain their own structural bottom rail as part of
  // the extruded arch cassette. Never retain the stock rectangular rail,
  // otherwise a second thick horizontal beam is rendered above the leaf.
  // The source GLB rail is dimensioned for its original model and is much
  // deeper than the configurable leaf. Runtime cassettes now provide the
  // correct full-thickness top/bottom members for square lights, so retaining
  // this baked rail creates the side-view beam that sticks out front and back.
  if (rail) rail.visible = false;
  if (panel) panel.visible = false;
  if (mullion) mullion.visible = false;
  // These two baked members are dimensioned for the source GLB only. The
  // configurable frame uses its runtime casing closure instead, otherwise a
  // scaled product can show a detached, overhanging lintel above the door.
  if (structuralHead) structuralHead.visible = false;
  if (topRebateStop) topRebateStop.visible = false;
  const railY = BASE.threshold + leafHeight + .030;
  // An arched head replaces the straight structural lintel, so it receives
  // the head's vertical allowance and meets the jamb crown without a gap.
  const panelTop = isRound ? height - .018 : height - BASE.head - .025;
  const panelHeight = Math.max(.12, panelTop - railY - .030);
  if (isRound) {
    const frameSpec = FRAME_PROFILE_SPECS[state.frameProfile] || FRAME_PROFILE_SPECS.P40;
    const transomBottomY = railY - .030;
    const transomTopY = height - frameSpec.jamb;
    const transomOuterWidth = Math.max(.20, openingWidth + (BASE.jamb - frameSpec.jamb) * 2);
    const transomOuterHeight = Math.max(.20, transomTopY - transomBottomY);
    const transomCenterY = (transomTopY + transomBottomY) / 2;
    const outerMetrics = runtimeArchMetrics(transomOuterWidth, transomOuterHeight, transomCenterY);
    // The stock rectangular jambs reach the old straight lintel. Stop their
    // visible structural and rebate profiles at the arch spring line so they
    // meet the round head rather than protruding above it as two square posts.
    frameGroup?.traverse((part) => {
      if (!part.isMesh || !['left', 'right'].includes(part.userData.frameSide)) return;
      if (!/StructuralJamb|RebateStop/.test(part.name)) return;
      part.scale.y *= outerMetrics.springY / Math.max(.1, height);
      part.position.y = outerMetrics.springY / 2;
    });
  }
  [rail, panel].forEach((part) => {
    if (!part) return;
    restoreBase(part);
    const baseWidth = part.userData.baseDimensions?.[0] || (BASE.width - BASE.jamb * 2);
    part.scale.x *= (openingWidth - (part === panel ? .035 : 0)) / baseWidth;
  });
  if (rail) rail.position.y = railY;
  if (panel) {
    const baseHeight = panel.userData.baseDimensions?.[2] || .25;
    panel.scale.y *= panelHeight / baseHeight;
    panel.position.y = railY + .030 + panelHeight / 2;
  }
  if (mullion) {
    restoreBase(mullion);
    const baseHeight = mullion.userData.baseDimensions?.[2] || .25;
    mullion.scale.y *= panelHeight / baseHeight;
    mullion.position.y = railY + .030 + panelHeight / 2;
  }
  rebuildRuntimeTransom(mode, openingWidth, panelHeight, railY + .030 + panelHeight / 2, height, railY - .030);
  syncRuntimeTransomAppearance();
}

function createK80SideLightGroup(side) {
  const group = new THREE.Group();
  group.name = `K80SideLightGroup_${side}`;
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x9caab1, metalness: .08, roughness: .30, transmission: .12,
    thickness: .012, ior: 1.46, transparent: true, opacity: .36,
    depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.12
  });
  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x3a3430, metalness: .78, roughness: .24, clearcoat: .26,
    clearcoatRoughness: .14, envMapIntensity: 1.72
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .022), glassMaterial);
  glass.name = `K80SideLight_${side}_Panel`;
  const left = new THREE.Mesh(new THREE.BoxGeometry(.022, 1, .078), frameMaterial);
  left.name = `K80SideLight_${side}_Frame_Left`;
  const right = left.clone();
  right.name = `K80SideLight_${side}_Frame_Right`;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1, .022, .078), frameMaterial);
  top.name = `K80SideLight_${side}_Frame_Top`;
  const bottom = top.clone();
  bottom.name = `K80SideLight_${side}_Frame_Bottom`;
  const mullion = new THREE.Mesh(new THREE.BoxGeometry(.014, 1, .072), frameMaterial);
  mullion.name = `K80SideLight_${side}_Frame_Mullion`;
  // A product-neutral center mullion is not part of every side-light. It made
  // opaque metal panels look like split frosted glass, so keep the runtime
  // reference for resize compatibility but never render this generic bar.
  mullion.visible = false;
  [glass, left, right, top, bottom].forEach((part) => {
    part.castShadow = true;
    part.receiveShadow = true;
    group.add(part);
  });
  group.userData.runtimeBase = {
    position: new THREE.Vector3(),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler()
  };
  group.userData.parts = { glass, left, right, top, bottom, mullion };
  group.visible = false;
  modelRoot.add(group);
  return group;
}

function ensureK80SideLightGroups() {
  if (!modelRoot) return;
  k80SideLightLeft ||= createK80SideLightGroup('Left');
  k80SideLightRight ||= createK80SideLightGroup('Right');
}

function resizeK80SideLightGroup(group, centerX, width, height) {
  if (!group) return;
  const { glass, left, right, top, bottom, mullion } = group.userData.parts;
  const innerWidth = Math.max(.06, width - .048);
  const innerHeight = Math.max(.08, height - .048);
  group.position.set(centerX, BASE.threshold, 0);
  glass.scale.set(innerWidth, innerHeight, 1);
  glass.position.set(0, height / 2, 0);
  [left, right].forEach((part, index) => {
    part.scale.set(1, height, 1);
    part.position.set((index ? 1 : -1) * (width / 2 - .011), height / 2, .006);
  });
  [top, bottom].forEach((part, index) => {
    part.scale.set(width, 1, 1);
    part.position.set(0, index ? .011 : height - .011, .006);
  });
  if (mullion) {
    mullion.visible = false;
    mullion.scale.set(1, height, 1);
    mullion.position.set(0, height / 2, .008);
  }
}

function resizeK80SideLights(opening, leafHeight, sideWidth, type) {
  ensureK80SideLightGroups();
  const showLeft = type === 'sideLight' || type === 'doubleSide';
  const showRight = type === 'doubleSide';
  const leftCenter = -opening / 2 + sideWidth / 2;
  const rightCenter = opening / 2 - sideWidth / 2;
  k80SideLightLeft.visible = showLeft;
  k80SideLightRight.visible = showRight;
  resizeK80SideLightGroup(k80SideLightLeft, leftCenter, sideWidth, leafHeight);
  resizeK80SideLightGroup(k80SideLightRight, rightCenter, sideWidth, leafHeight);
}

function k80SideLightSpec(key, region) {
  const regionSpec = getTextureRegion('k80', key, state.type, region) || {};
  const mode = regionSpec.material || PRODUCT_META[key]?.sideLightMode || 'finish';
  return {
    mode,
    regionSpec,
    mapKey: regionSpec.map || texturePartFor(key, region, state.type)
  };
}

async function applyK80SideLightAppearance(revision = textureBindRevision) {
  const layout = currentLeafLayout || defaultLeafSizes(state.type, state.transom);
  const config = {
    type: state.type,
    transom: state.transom,
    textureZoom: state.textureZoom,
    texturePanX: state.texturePanX,
    texturePanY: state.texturePanY,
    layout
  };
  const apply = async (group, region) => {
    const glass = group?.userData.parts?.glass;
    if (!glass) return;
    const key = state.frontFinish;
    const spec = k80SideLightSpec(key, region);
    const colorway = currentColorway('front', region);
    const variant = currentTextureVariant('front', region);
    let map = null;
    if (spec.mode !== 'frosted-glass' && spec.mapKey) {
      const source = await getTexture(key, spec.mapKey);
      if (revision !== textureBindRevision) return;
      const settings = textureSettings('front', region);
      const surfaceCanvas = createTextureSurfaceCanvas(source, settings.surface || 'factory');
      const surfaceTexture = surfaceCanvas ? new THREE.CanvasTexture(surfaceCanvas) : source.clone();
      surfaceTexture.colorSpace = THREE.SRGBColorSpace;
      surfaceTexture.wrapS = THREE.ClampToEdgeWrapping;
      surfaceTexture.wrapT = THREE.ClampToEdgeWrapping;
      surfaceTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      map = createTextureVariant(surfaceTexture, variant.key);
      surfaceTexture.dispose();
      setTextureWindow(map, key, 'side', layout.side || BASE.sideLight, layout.height, {
        ...config,
        regionSpec: spec.regionSpec
      });
    }
    const isFrosted = spec.mode === 'frosted-glass';
    const materialProfile = referenceMaterialProfile('front');
    const material = new THREE.MeshPhysicalMaterial({
      color: isFrosted ? new THREE.Color(0xb9c4bb) : new THREE.Color(colorway.tint),
      metalness: isFrosted ? .02 : materialProfile.metalness ?? variant.metalness,
      roughness: isFrosted ? .42 : materialProfile.roughness ?? variant.roughness,
      clearcoat: isFrosted ? .10 : materialProfile.clearcoat ?? variant.clearcoat,
      clearcoatRoughness: isFrosted ? .34 : .15,
      transmission: isFrosted ? .46 : 0,
      thickness: isFrosted ? .014 : 0,
      ior: 1.46,
      transparent: isFrosted,
      opacity: isFrosted ? .42 : 1,
      depthWrite: !isFrosted,
      side: THREE.DoubleSide,
      envMapIntensity: isFrosted ? .92 : materialProfile.envMapIntensity ?? 1.58,
      specularIntensity: .92
    });
    material.map = map;
    if (map && !isFrosted) {
      material.bumpMap = map;
      material.bumpScale = materialProfile.bumpScale ?? variant.bumpScale;
      material.normalScale?.set(.18, .18);
    } else {
      material.bumpMap = null;
      material.normalMap = null;
    }
    material.userData.runtimeMaterial = true;
    if (glass.material?.userData?.runtimeMaterial) glass.material.dispose();
    glass.material = material;
    group.userData.sideLightMode = spec.mode;
  };
  await Promise.all([
    apply(k80SideLightLeft, 'sideLeft'),
    apply(k80SideLightRight, 'sideRight')
  ]);
}

function createK80RoundedRectGeometry(width, height, depth, radius, bevel = 0) {
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.min(radius, halfW * .92, halfH * .92);
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfH);
  shape.lineTo(halfW - r, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
  shape.lineTo(halfW, halfH - r);
  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
  shape.lineTo(-halfW + r, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);
  shape.lineTo(-halfW, -halfH + r);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 10
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function ensureK80IntegratedGroup(label) {
  const hardware = object(`${label}Hardware`);
  if (!hardware) return null;
  const name = `${label}Hardware_Integrated`;
  let group = object(name);
  if (group) return group;
  const config = PRODUCT_META[state.product]?.integratedHandle;
  if (!config) return null;
  group = new THREE.Group();
  group.name = name;
  group.userData.hardwareType = 'integrated';
  group.userData.handleModel = state.product === 'ruojian'
    ? '若简主体门固定凹槽灯带：门扇内凹槽、橙色柔光，不显示灯具本体'
    : '纵向全高凹槽灯带拉手：内凹腔体、金属压边、发光内芯';
  const grooveWidth = config.grooveWidth ?? config.width ?? .112;
  const grooveHeight = config.height ?? 2.08;
  const lightWidth = config.lightWidth ?? grooveWidth * .26;
  const frontZ = BASE.leafThickness / 2;
  const parts = [];
  if (state.product === 'ruojian') {
    // 若简 is a recessed channel, not a rail/handle assembly. Use soft alpha
    // edges so the viewer sees continuous orange light but never a lamp body,
    // metal border, end cap, or rectangular handle outline.
    const createSoftChannelMap = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      const image = context.createImageData(canvas.width, canvas.height);
      for (let y = 0; y < canvas.height; y += 1) {
        const vertical = Math.sin(Math.PI * y / (canvas.height - 1));
        for (let x = 0; x < canvas.width; x += 1) {
          const horizontal = Math.sin(Math.PI * x / (canvas.width - 1));
          const alpha = Math.round(255 * Math.pow(Math.max(0, vertical * horizontal), .72));
          const offset = (y * canvas.width + x) * 4;
          image.data[offset] = 255;
          image.data[offset + 1] = 255;
          image.data[offset + 2] = 255;
          image.data[offset + 3] = alpha;
        }
      }
      context.putImageData(image, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.colorSpace = THREE.NoColorSpace;
      texture.needsUpdate = true;
      return texture;
    };
    const softChannelMap = createSoftChannelMap();
    const shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x120b08, map: softChannelMap, transparent: true, opacity: .68,
      depthWrite: false, depthTest: false
    });
    const lightColor = new THREE.Color(config.light ?? 0xffbe72);
    const lightMaterial = new THREE.MeshBasicMaterial({
      color: lightColor, map: softChannelMap, transparent: true,
      opacity: .78, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending
    });
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(grooveWidth * 1.65, grooveHeight - .06),
      shadowMaterial
    );
    shadow.name = `${name}_RecessShadow`;
    // The clean map is split per leaf, so the physical groove must sit clearly
    // in front of the leaf surface; otherwise only the edge of the channel is
    // visible after a mother/double crop.
    shadow.position.z = frontZ + .026;
    shadow.userData.recessDepth = config.recessDepth ?? .010;
    const lightBar = new THREE.Mesh(
      new THREE.PlaneGeometry(lightWidth * 2.35, grooveHeight - .12),
      lightMaterial
    );
    lightBar.name = `${name}_IntegratedLightBar`;
    lightBar.position.z = frontZ + .034;
    const areaLight = new THREE.RectAreaLight(
      lightColor, config.areaIntensity ?? .82, lightWidth * 1.8, grooveHeight * .80
    );
    areaLight.name = `${name}_IntegratedAreaGlow`;
    areaLight.position.set(0, 0, frontZ + .039);
    areaLight.lookAt(0, 0, 0);
    const glow = new THREE.PointLight(lightColor, config.pointIntensity ?? .08, .42, 2.1);
    glow.name = `${name}_IntegratedGlow`;
    glow.position.set(0, 0, frontZ + .045);
    parts.push(shadow, lightBar, areaLight, glow);
  } else {
    // Other products keep their authored physical fitting model: recessed
    // pocket, metal rails and end caps remain available to their own profile.
    const integratedMetalMaps = getK80HardwareMetalMaps('gold-ring');
    const channelMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x101214, metalness: .82, roughness: .24, clearcoat: .44,
      clearcoatRoughness: .12, envMapIntensity: 1.92, specularIntensity: 1
    });
    const cavityMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x050607, metalness: .30, roughness: .34, clearcoat: .18,
      clearcoatRoughness: .24, envMapIntensity: .82, specularIntensity: .55
    });
    const railMaterial = new THREE.MeshPhysicalMaterial({
      color: config.railColor ?? 0x9d6335, metalness: .88, roughness: .20,
      clearcoat: .48, clearcoatRoughness: .10, envMapIntensity: 2.08,
      specularIntensity: 1, map: integratedMetalMaps.albedo,
      roughnessMap: integratedMetalMaps.roughness, bumpMap: integratedMetalMaps.roughness,
      bumpScale: .0024
    });
    const lightColor = new THREE.Color(config.light ?? 0xffbe72);
    const lightMaterial = new THREE.MeshPhysicalMaterial({
      color: lightColor, emissive: lightColor, emissiveIntensity: config.intensity ?? 3.1,
      metalness: .10, roughness: .18, clearcoat: .22, transparent: true, opacity: .97,
      depthWrite: false
    });
    const pocket = new THREE.Mesh(
      createK80RoundedRectGeometry(grooveWidth, grooveHeight, config.recessDepth ?? .010, .016, .0025),
      channelMaterial
    );
    pocket.name = `${name}_RecessPocket`;
    pocket.position.z = frontZ + .001;
    pocket.castShadow = true;
    pocket.receiveShadow = true;
    const cavity = new THREE.Mesh(
      createK80RoundedRectGeometry(grooveWidth * .72, grooveHeight - .036, .006, .011, .001),
      cavityMaterial
    );
    cavity.name = `${name}_RecessCavity`;
    cavity.position.z = frontZ + .006;
    cavity.receiveShadow = true;
    const railWidth = config.railWidth ?? .008;
    const railHeight = grooveHeight - .078;
    [-1, 1].forEach((side) => {
      const rail = new THREE.Mesh(
        createK80RoundedRectGeometry(railWidth, railHeight, .018, .004, .001),
        railMaterial
      );
      rail.name = `${name}_MetalRail_${side < 0 ? 'Left' : 'Right'}`;
      rail.position.set(side * (grooveWidth / 2 - railWidth / 2 - .006), 0, frontZ + .012);
      rail.castShadow = true;
      rail.receiveShadow = true;
      parts.push(rail);
    });
    const lightBar = new THREE.Mesh(
      createK80RoundedRectGeometry(lightWidth, grooveHeight - .15, .006, .004, .0012),
      lightMaterial
    );
    lightBar.name = `${name}_IntegratedLightBar`;
    lightBar.position.z = frontZ + .010;
    const capMaterial = new THREE.MeshPhysicalMaterial({
      color: config.railColor ?? 0x9d6335, metalness: .90, roughness: .18,
      clearcoat: .52, clearcoatRoughness: .08, envMapIntensity: 2.14,
      map: integratedMetalMaps.albedo, roughnessMap: integratedMetalMaps.roughness,
      bumpMap: integratedMetalMaps.roughness, bumpScale: .0024
    });
    const capHeight = .026;
    [-1, 1].forEach((sign) => {
      const cap = new THREE.Mesh(
        createK80RoundedRectGeometry(grooveWidth * .68, capHeight, .018, .008, .0015),
        capMaterial
      );
      cap.name = `${name}_EndCap_${sign < 0 ? 'Bottom' : 'Top'}`;
      cap.position.set(0, sign * (grooveHeight / 2 - .026), frontZ + .016);
      cap.castShadow = true;
      parts.push(cap);
    });
    const areaLight = new THREE.RectAreaLight(
      lightColor, config.areaIntensity ?? .82, lightWidth * 1.8, grooveHeight * .80
    );
    areaLight.name = `${name}_IntegratedAreaGlow`;
    areaLight.position.set(0, 0, frontZ + .020);
    areaLight.lookAt(0, 0, 0);
    const glow = new THREE.PointLight(lightColor, config.pointIntensity ?? .34, .72, 2.1);
    glow.name = `${name}_IntegratedGlow`;
    glow.position.set(0, 0, frontZ + .028);
    parts.push(pocket, cavity, lightBar, areaLight, glow);
  }
  group.add(...parts);
  hardware.add(group);
  group.userData.runtimeBase = {
    position: new THREE.Vector3(0, K80_HARDWARE_BASE_Y.integrated, 0),
    scale: new THREE.Vector3(config.scale ?? 1, config.scale ?? 1, config.scale ?? 1),
    rotation: new THREE.Euler()
  };
  group.userData.profileScale = group.userData.runtimeBase.scale.clone();
  return group;
}

function updateK80IntegratedBase(label, group, leafWidth) {
  const config = PRODUCT_META[state.product]?.integratedHandle;
  if (!group || !config) return;
  const role = label.toLowerCase();
  const inset = .021;
  // 若简的灯槽属于主体门扇本体，必须落在门扇表面内侧而不是压在
  // 两扇门的接缝线上。`mainInset` 是从主体门扇内侧基准向门面内收的
  // 真实尺寸（约 90 mm），单门仍保持居中。
  const ruojianMainInset = ['ruojian', 'qingya'].includes(state.product)
    ? (config.mainInset ?? .090)
    : inset;
  // resizeLeaf() already moves the hardware parent by the delta between the
  // authored leaf width and the current leaf width. Use the authored width
  // here, otherwise a wider double door applies that width delta twice and
  // pushes both integrated pulls away from the meeting stile.
  const authoredWidth = role === 'main'
    ? (mainPivot?.userData?.baseWidth || AUTHORED_LEAF_WIDTHS.main)
    : (childPivot?.userData?.baseWidth || AUTHORED_LEAF_WIDTHS.child);
  const doubleHandleOutset = 0;
  // The GLB's main hardware datum is the active/main leaf's inner stile. For
  // ordinary integrated fittings that datum is the shared stile. 若简 is the
  // exception: its fixed groove is set into the主体门扇, so move it inward by
  // `mainInset` and never present it as the joint between the leaves.
  const targetHeight = config.autoFitHeight && currentLeafLayout?.height
    ? Math.max(1.4, currentLeafLayout.height - (config.verticalMargin ?? .11))
    : config.height ?? 2.08;
  const anchorX = state.type === 'single'
    // The single-door primary elevation puts the groove at roughly 30% of
    // the visible leaf width, rather than on the geometric centreline.
    ? -authoredWidth * .70 + inset
    : role === 'main'
      ? -authoredWidth + ruojianMainInset + doubleHandleOutset
      : authoredWidth - inset - doubleHandleOutset;
  group.userData.runtimeBase.position.set(anchorX, K80_HARDWARE_BASE_Y.integrated, 0);
  const authoredHeight = config.height ?? 2.08;
  const authoredScale = config.scale ?? 1;
  group.userData.runtimeBase.scale.set(
    authoredScale,
    authoredScale * (targetHeight / authoredHeight),
    authoredScale
  );
}

function resolvedIntegratedLight() {
  const profile = K80_LIGHT_PROFILES[state.product];
  if (!profile) return null;
  const choice = profile.colors.find((item) => item.key === state.integratedLightColor)
    || profile.colors.find((item) => item.key === profile.defaultColor)
    || profile.colors[0];
  return {
    profile,
    color: choice?.value ?? 0xffbe72,
    colorKey: choice?.key || profile.defaultColor,
    intensity: THREE.MathUtils.clamp(Number(state.integratedLightIntensity) || profile.defaultIntensity || 1, .35, 1.35),
    enabled: Boolean(state.integratedLightEnabled && (state.product === 'ruojian' || state.handle === 'integrated'))
  };
}

function applyIntegratedHandleLighting() {
  const light = resolvedIntegratedLight();
  const config = PRODUCT_META[state.product]?.integratedHandle;
  if (!config) return;
  ['Main', 'Child'].forEach((label) => {
    const group = object(`${label}Hardware_Integrated`);
    if (!group) return;
    group.traverse((node) => {
      if (node.name.endsWith('IntegratedLightBar')) {
        const material = node.material;
        if (material?.color) material.color.setHex(light?.enabled ? light.color : 0x101214);
        if (material?.emissive) material.emissive.setHex(light?.enabled ? light.color : 0x000000);
        if ('opacity' in (material || {})) material.opacity = light?.enabled
          ? THREE.MathUtils.clamp(.48 + light.intensity * .25, .48, .86)
          : .10;
        if ('emissiveIntensity' in (material || {})) material.emissiveIntensity = light?.enabled
          ? (config.intensity ?? 3.1) * light.intensity
          : 0;
        node.visible = true;
        if (material) material.needsUpdate = true;
      }
      if (node.name.endsWith('IntegratedAreaGlow') || node.name.endsWith('IntegratedGlow')) {
        if (light) node.color?.setHex(light.color);
        if ('intensity' in node) node.intensity = light?.enabled
          ? (node.name.endsWith('AreaGlow') ? (config.areaIntensity ?? .82) : (config.pointIntensity ?? .34)) * light.intensity
          : 0;
        node.visible = Boolean(light?.enabled);
      }
    });
  });
}

function syncIntegratedLightUi() {
  const wrapper = $('#integratedLightControls');
  const profile = K80_LIGHT_PROFILES[state.product];
  const structuralChannel = state.product === 'ruojian';
  const available = Boolean(profile && PRODUCT_META[state.product]?.integratedHandle && (structuralChannel || state.handle === 'integrated'));
  if (wrapper) wrapper.hidden = !available;
  const note = $('#integratedChannelNote');
  if (note) note.hidden = !structuralChannel;
  if (!available) {
    const slot = wrapper?.closest('.reference-handle-light-controls');
    if (slot) slot.hidden = ![...slot.querySelectorAll('.integrated-light-controls')].some((control) => !control.hidden);
    return;
  }
  const current = resolvedIntegratedLight();
  $$('[data-integrated-light-enabled]').forEach((button) => {
    const enabled = button.dataset.integratedLightEnabled === 'true';
    button.classList.toggle('selected', enabled === Boolean(state.integratedLightEnabled));
  });
  $$('[data-integrated-light-color]').forEach((button) => {
    button.hidden = !profile.colors.some((item) => item.key === button.dataset.integratedLightColor);
    button.classList.toggle('selected', button.dataset.integratedLightColor === current.colorKey);
  });
  const slider = $('#integratedLightIntensitySlider');
  const output = $('#integratedLightIntensityOutput');
  if (slider) slider.value = String(current.intensity);
  if (output) output.textContent = `${Math.round(current.intensity * 100)}%`;
  const slot = wrapper?.closest('.reference-handle-light-controls');
  if (slot) slot.hidden = ![...slot.querySelectorAll('.integrated-light-controls')].some((control) => !control.hidden);
}

function resolvedQinghuafuRingLight() {
  const profile = K80_LIGHT_PROFILES.qinghuafu;
  const choice = profile.colors.find((item) => item.key === state.ringLightColor)
    || profile.colors.find((item) => item.key === profile.defaultColor)
    || profile.colors[0];
  const rawIntensity = Number(state.ringLightIntensity);
  return {
    profile,
    color: choice?.value ?? 0xffb95f,
    colorKey: choice?.key || profile.defaultColor,
    intensity: THREE.MathUtils.clamp(Number.isFinite(rawIntensity) ? rawIntensity : (profile.defaultIntensity || 1), 0, 1.35),
    enabled: Boolean(state.ringLightEnabled && state.product === 'qinghuafu' && state.handle === 'ring')
  };
}

function syncQinghuafuRingLightUi() {
  const wrapper = $('#ringLightControls');
  const available = Boolean(wrapper && state.product === 'qinghuafu' && state.handle === 'ring');
  if (wrapper) wrapper.hidden = !available;
  if (!available) {
    const slot = wrapper?.closest('.reference-handle-light-controls');
    if (slot) slot.hidden = ![...slot.querySelectorAll('.integrated-light-controls')].some((control) => !control.hidden);
    return;
  }
  const current = resolvedQinghuafuRingLight();
  $$('[data-ring-light-enabled]').forEach((button) => {
    const enabled = button.dataset.ringLightEnabled === 'true';
    button.classList.toggle('selected', enabled === Boolean(state.ringLightEnabled));
  });
  $$('[data-ring-light-color]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.ringLightColor === current.colorKey);
  });
  const slider = $('#ringLightIntensitySlider');
  const output = $('#ringLightIntensityOutput');
  if (slider) slider.value = String(current.intensity);
  if (output) output.textContent = `${Math.round(current.intensity * 100)}%`;
  const slot = wrapper?.closest('.reference-handle-light-controls');
  if (slot) slot.hidden = ![...slot.querySelectorAll('.integrated-light-controls')].some((control) => !control.hidden);
}

function normalizeK80HardwareState() {
  if (state.lock === 'concealed') state.lock = 'none';
  const meta = PRODUCT_META[state.product] || {};
  if (!meta.supportedLocks?.includes(state.lock)) state.lock = meta.defaultLock;
  if (!meta.supportedHandles?.includes(state.handle)) state.handle = meta.defaultHandle;
}

function k80HardwareProfile(type) {
  return K80_HARDWARE_PROFILES[state.product]?.[type] || null;
}

function k80HardwareRoles(type, profile, followsOpening = false) {
  // The opening selector is defined from the exterior elevation: left-lock
  // means the left leaf owns the lock and its hinge line, right-lock means the
  // right leaf owns them. Keep symmetric pulls symmetric, but move a selected
  // lock to the active opening leaf instead of leaving it on the GLB default.
  // A double-leaf order carries a lock on each leaf. Opening direction still
  // controls the active swing, but it must not remove the matching second
  // lock from the closed elevation.
  // 子母门只有一套锁体；只有真正的对开结构（含双边边门主体）
  // 才在左右门扇各保留一套锁，避免把一个活动门错误复制成双锁。
  if (type === 'smart' && ['double', 'doubleSide'].includes(state.type) && profile?.doubleRoles) return profile.doubleRoles;
  if (type === 'smart' && !hasChildLeafType()) return ['main'];
  if (followsOpening && hasChildLeafType()) return [openingLeafRole()];
  if (type === 'integrated') {
    const integrated = PRODUCT_META[state.product]?.integratedHandle;
    // 若用户把原本的子母门改成对开门，纹理一体拉手也必须按两扇门
    // 对称生成；子母门仍只保留原产品主门扇上的那一条拉手。
    if (state.type === 'double' && integrated?.mirrorOnDouble) return ['main', 'child'];
    return integrated?.roles || [];
  }
  if (profile?.roles) return profile.roles;
  // A fixed pull is a single active-door fitting unless the catalogue
  // explicitly declares a mirrored pair. Do not duplicate one selected
  // handle across both leaves merely because the door happens to be double.
  return ['main'];
}

function positionK80HardwareGroup(label, type, profile) {
  const groupName = K80_HARDWARE_GROUPS[type];
  const group = groupName ? object(`${label}Hardware_${groupName}`) : null;
  if (!group) return;
  const role = label.toLowerCase();
  const base = group.userData.runtimeBase;
  if (!base) return;
  const baseY = K80_HARDWARE_BASE_Y[type] || 0;
  group.position.copy(base.position);
  if (state.type === 'sideLight' && label === 'Main' && type === 'smart') {
    // In the 中庭 elevation the active door is on the right and its latch
    // stile is the shared frame beside the side panel. Keep the smart-lock
    // datum on that inner stile as the main leaf grows; never pin it to the
    // outer jamb. `MainHardware` already carries the leaf-width delta, so the
    // desired lock anchor is the current main-leaf latch edge.
    const baseWidth = mainPivot?.userData?.baseWidth || .752;
    const sourceAnchor = -baseWidth + .095;
    const currentWidth = currentLeafLayout?.main || baseWidth;
    const desiredAnchor = -currentWidth + .095;
    const parentShift = object('MainHardware')?.position.x || 0;
    // The smart-lock profile scales the authored body after this position is
    // calculated. Solve the anchor in the scaled coordinate space; otherwise
    // the body drifts through the jamb when the profile is smaller than 1:1.
    const profileScale = profile?.scale ?? 1;
    group.position.x = desiredAnchor - parentShift - sourceAnchor * profileScale;
  }
  group.position.y += (profile?.centerY ?? baseY) - baseY;
  if (state.product === 'ruojian' && state.type === 'single' && Number.isFinite(profile?.singleOffsetX)) {
    // The catalog single-door elevation places the lock to the left of the
    // off-centre light groove. The GLB lock datum is based on the pair door,
    // so apply the product-specific single-leaf correction after positioning.
    group.position.x += profile.singleOffsetX;
  }
  group.scale.copy(base.scale).multiplyScalar(profile?.scale ?? 1);
  // The authored GLB hardware datums were laid out for a narrow/main
  // prototype. Jiangchuan is a true equal-leaf double door, so keep the two
  // product rings a fixed distance from the meeting stile instead of letting
  // both instances collapse onto the same point after the leaf resize.
  if (state.product === 'jiangchuan' && type === 'ring' && ['double', 'doubleSide'].includes(state.type)) {
    const ringMesh = group.getObjectByName(`${label}_RingPull_Ring`);
    const referenceRoot = group.userData.referenceHardwareRoots?.[state.handleCode];
    const parentShift = group.parent?.position.x || 0;
    const leafWidth = currentLeafLayout?.[role] || .9;
    const meetingInset = Math.min(.16, leafWidth * .22);
    const targetFromPivot = role === 'main'
      ? -leafWidth + meetingInset
      : leafWidth - meetingInset;
    const anchorX = referenceRoot?.position.x ?? ringMesh?.position.x;
    if (Number.isFinite(anchorX)) group.position.x = targetFromPivot - parentShift - anchorX * group.scale.x;
  }
  // 清华赋的中央圆形拉手跨越两扇门的中缝，不能沿用 GLB 中为普通
  // 单扇门预留的叶片内部坐标。对开/子母门把圆环中心锁在主门与子门
  // 的相接边；切到单门时则落在门扇的锁边侧，随门宽保持真实安装关系。
  if (state.product === 'qinghuafu' && type === 'ring') {
    const ringMesh = group.getObjectByName(`${label}_RingPull_Ring`);
    const referenceRoot = group.userData.referenceHardwareRoots?.[state.handleCode];
    const parentShift = group.parent?.position.x || 0;
    const leafWidth = currentLeafLayout?.[role] || .9;
    // A single leaf has no meeting stile. Keep the large round pull at the
    // latch side but inset it by its radius plus a small metal clearance so
    // the GLB never hangs outside the leaf after the double-door crop.
    const meetingInset = state.type === 'single' ? .30 : .018;
    const targetFromPivot = role === 'main'
      ? -leafWidth + meetingInset
      : leafWidth - meetingInset;
    const anchorX = referenceRoot?.position.x ?? ringMesh?.position.x;
    if (Number.isFinite(anchorX)) group.position.x = targetFromPivot - parentShift - anchorX * group.scale.x;
  }
  group.userData.profilePosition = group.position.clone();
  group.userData.profileScale = group.scale.clone();
}

function applySingleSideLockEdge() {
  if (state.type !== 'sideLight') return;
  const lockEdge = object('MainLockEdge');
  const baseWidth = mainPivot?.userData?.baseWidth || .752;
  if (!lockEdge) return;
  // The lock edge is installed in the shared frame between the main leaf and
  // the 中庭 side panel. Restore the authored group datum plus the exact leaf
  // resize delta; this keeps the latch plate on that frame at every width.
  const currentWidth = currentLeafLayout?.main || baseWidth;
  const delta = -(currentWidth - baseWidth);
  lockEdge.position.x = (lockEdge.userData.runtimeBase?.position.x || 0) + delta;
}

const K80_HARDWARE_APPEARANCES = {
  'gold-ring': { loop: 0xc58d3d, plate: 0x4b2e18, metalness: .92, roughness: .18 },
  'bronze-ring': { loop: 0x8f735d, plate: 0x30251f, metalness: .90, roughness: .24 }
};

function ensureK80QinghuafuRingLight(label) {
  if (state.product !== 'qinghuafu') return null;
  const group = object(`${label}Hardware_Ring`);
  // The rebuilt moon handle carries its own physical halo and centre disc.
  // Do not add the older generic-ring overlay above a product-specific GLB.
  if (group?.userData?.referenceHardwareRoots?.['QHF-MOON']) return null;
  const ring = group?.getObjectByName(`${label}_RingPull_Ring`);
  const backplate = group?.getObjectByName(`${label}_RingPull_Backplate`);
  if (!group || !ring?.isMesh) return null;

  const glowName = `${label}QinghuafuRingGlow`;
  let glow = group.getObjectByName(glowName);
  let point = group.getObjectByName(`${glowName}Point`);
  let patternDisc = group.getObjectByName(`${label}QinghuafuRingPatternDisc`);
  ring.geometry.computeBoundingBox();
  const ringSize = ring.geometry.boundingBox?.getSize(new THREE.Vector3()) || new THREE.Vector3(.192, .024, .192);
  const pullRadius = Math.max(.045, Math.min(ringSize.x, ringSize.z) * .45);
  if (!patternDisc) {
    const edgeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xc89a48,
      metalness: .92,
      roughness: .18,
      clearcoat: .36,
      clearcoatRoughness: .12
    });
    const faceMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: .58,
      roughness: .30,
      clearcoat: .28,
      clearcoatRoughness: .22,
      side: THREE.DoubleSide
    });
    // A Qinghuafu pull is a solid, thick circular grip, not the open ring used
    // by the other K80 profiles. Cylinder material slots are side/front/back.
    patternDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(pullRadius, pullRadius, .034, 96),
      [edgeMaterial, faceMaterial, faceMaterial]
    );
    patternDisc.name = `${label}QinghuafuRingPatternDisc`;
    patternDisc.position.copy(backplate?.position || ring.position);
    // Door elevation is the local XY plane and the exterior faces +Z. Rotate
    // the cylinder so its caps face the viewer, then seat it just proud of
    // the skin. Leaving the default Y-axis showed only a thin horizontal edge.
    patternDisc.rotation.x = Math.PI / 2;
    patternDisc.position.z += .006;
    patternDisc.castShadow = true;
    patternDisc.receiveShadow = true;
    patternDisc.renderOrder = 7;
    patternDisc.userData.qinghuafuRingPatternMap = true;
    group.add(patternDisc);
  }
  if (!glow) {
    const lightColor = new THREE.Color(0xffc56d);
    const material = new THREE.MeshBasicMaterial({
      color: lightColor,
      transparent: true,
      opacity: .16,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    // Use a clean luminous rim around the solid disc. Reusing the shared
    // open-ring GLB geometry produced a bright horizontal slot across the
    // catalogue artwork and made the pull look like a generic ring handle.
    glow = new THREE.Mesh(new THREE.TorusGeometry(pullRadius * .98, .0075, 16, 96), material);
    glow.name = glowName;
    glow.userData.k80RingLight = true;
    glow.position.copy(patternDisc.position);
    // TorusGeometry already faces +Z, matching the door elevation.
    glow.position.z += .0205;
    glow.renderOrder = 8;
    group.add(glow);

    point = new THREE.PointLight(lightColor, .32, .58, 2.1);
    point.name = `${glowName}Point`;
    point.userData.k80RingLight = true;
    point.position.copy(patternDisc.position);
    point.position.z += .055;
    group.add(point);
  }
  return { group, ring, backplate, glow, point, patternDisc };
}

function applyQinghuafuRingPattern(texture) {
  if (!texture || state.product !== 'qinghuafu') return;
  ['Main', 'Child'].forEach((label) => {
    const group = object(`${label}Hardware_Ring`);
    if (!group) return;
    // The catalogue artwork belongs only on the circular face insert. The
    // machined loop and recessed backplate remain independent metal parts so
    // their reflections and edge highlights stay physically believable.
    const patternDisc = group.getObjectByName(`${label}QinghuafuRingPatternDisc`);
    if (patternDisc?.material) {
      const materials = Array.isArray(patternDisc.material) ? patternDisc.material : [patternDisc.material];
      // Keep the cylindrical edge brushed gold; map the photographed pattern
      // only to the two circular faces.
      materials.slice(1).forEach((material) => {
        material.map = texture;
        material.color?.setHex(0xffffff);
        material.needsUpdate = true;
      });
      patternDisc.userData.qinghuafuRingPatternMap = true;
    }
    const glow = group.getObjectByName(`${label}QinghuafuRingGlow`);
    if (glow?.material) {
      // Light is emitted by the surrounding ring, not by another opaque copy
      // of the photograph covering the patterned face.
      glow.material.map = null;
      glow.material.needsUpdate = true;
    }
  });
}

function loadQinghuafuRingPattern() {
  if (state.product !== 'qinghuafu') return;
  getQinghuafuRingPatternTexture().then((texture) => {
    applyQinghuafuRingPattern(texture);
  }).catch((error) => {
    console.warn('清华赋圆月纹理加载失败，保留金属材质：', error);
  });
}

function applyK80QinghuafuRingLighting() {
  const light = resolvedQinghuafuRingLight();
  ['Main', 'Child'].forEach((label) => {
    const result = ensureK80QinghuafuRingLight(label);
    if (!result) return;
    const visible = light.enabled && result.group.visible;
    result.glow.visible = visible;
    result.point.visible = visible;
    result.point.color.setHex(light.color);
    result.point.intensity = visible ? .32 * light.intensity : 0;
    const material = result.glow.material;
    if (material?.color) material.color.setHex(light.color);
    if (material) material.opacity = visible ? .12 + (.08 * light.intensity) : 0;
    if (material) material.needsUpdate = true;
  });
}

function applyK80HardwareAppearance(group, profile) {
  const appearance = K80_HARDWARE_APPEARANCES[profile?.appearance];
  if (!group || !appearance) return;
  const metalMaps = getK80HardwareMetalMaps(profile.appearance);
  group.traverse((mesh) => {
    let parent = mesh;
    while (parent && parent !== group) {
      if (parent.userData?.referenceHardwareMaterial) return;
      parent = parent.parent;
    }
    if (mesh.userData.k80RingLight) return;
    // The patterned face has its own product-specific physical material.
    // Do not replace it with the generic brushed-metal map.
    if (mesh.name.includes('QinghuafuRingPatternDisc')) return;
    if (!mesh.isMesh || !mesh.material) return;
    const material = mesh.userData.k80AppearanceMaterial || mesh.material.clone?.();
    if (!material) return;
    mesh.userData.k80AppearanceMaterial = material;
    mesh.material = material;
    const isLoop = mesh.name.includes('RingPull_Ring');
    const preserveQinghuafuPattern = state.product === 'qinghuafu'
      && profile?.appearance === 'gold-ring'
      && mesh.userData.qinghuafuRingPatternMap;
    material.color?.setHex(preserveQinghuafuPattern ? 0xffffff : isLoop ? appearance.loop : appearance.plate);
    material.metalness = appearance.metalness;
    material.roughness = appearance.roughness;
    material.clearcoat = .38;
    material.clearcoatRoughness = .12;
    material.envMapIntensity = 1.85;
    if (!preserveQinghuafuPattern) material.map = metalMaps.albedo;
    material.roughnessMap = metalMaps.roughness;
    material.bumpMap = metalMaps.roughness;
    material.bumpScale = .0024;
    material.normalScale?.set(.14, .14);
    material.needsUpdate = true;
  });
}

function applyHardware() {
  normalizeK80HardwareState();
  const profile = K80_HARDWARE_PROFILES[state.product] || {};
  const selectedLock = state.lock === 'none' ? null : state.lock;
  const selectedHandle = state.handle === 'none' ? null : state.handle;
  const structuralIntegratedChannel = Boolean(state.product === 'ruojian' && PRODUCT_META[state.product]?.integratedHandle);
  const hasVisibleHardware = Boolean(selectedLock || selectedHandle || structuralIntegratedChannel);
  ['Main', 'Child'].forEach((label) => {
    const role = label.toLowerCase();
    const showRole = label === 'Main' || hasChildLeafType();
    const hardware = object(`${label}Hardware`);
    ensureK80QinghuafuRingLight(label);
    const integrated = ensureK80IntegratedGroup(label);
    if (integrated) updateK80IntegratedBase(label, integrated, currentLeafLayout?.[role] || .58);
    hardware?.traverse((node) => {
      if (node !== hardware) node.visible = false;
    });
    Object.entries(K80_HARDWARE_GROUPS).forEach(([type, groupName]) => {
      const group = object(`${label}Hardware_${groupName}`);
      if (!group) return;
      const optionSelected = type === selectedLock || type === selectedHandle;
      const roleEnabled = k80HardwareRoles(type, profile[type], type === selectedLock).includes(role);
      const isStructuralChannel = structuralIntegratedChannel && type === 'integrated';
      const visible = showRole && (isStructuralChannel || optionSelected) && roleEnabled && type !== 'concealed';
      group.visible = visible;
      if (visible) group.traverse((node) => { node.visible = true; });
      syncK80ReferenceHardwareVisibility(group, type, visible);
      applyK80HardwareAppearance(group, profile[type]);
      if (state.product === 'qinghuafu' && type === 'ring') {
        const roundPull = ensureK80QinghuafuRingLight(label);
        if (roundPull) {
          // Qinghuafu uses the solid patterned disc; suppress the generic open
          // ring and rectangular backing plate inherited from the shared GLB.
          roundPull.ring.visible = false;
          if (roundPull.backplate) roundPull.backplate.visible = false;
          roundPull.patternDisc.visible = visible;
        }
      }
      positionK80HardwareGroup(label, type, profile[type]);
    });
    setVisibility(hardware, showRole && hasVisibleHardware);
    setVisibility(object(`${label}LockEdge`), showRole && state.lock !== 'none' && state.open);
  });
  applyHandlePosition();
  applyLockPosition();
  applySingleSideLockEdge();
  applyK80QinghuafuRingLighting();
  loadQinghuafuRingPattern();
  syncQinghuafuRingLightUi();
  applyIntegratedHandleLighting();
  syncIntegratedLightUi();
  $$('[data-lock]').forEach((button) => button.classList.toggle('selected', button.dataset.lock === state.lock));
  $$('[data-handle]').forEach((button) => button.classList.toggle('selected', button.dataset.handle === state.handle));
}

// Apply a customer offset/scale while retaining the authored fitting centre.
function applyK80Position(group, offsetX, offsetY, scale) {
  if (!group || !group.userData.profilePosition) return;
  const mirrorDirection = group.name.startsWith('Child') ? -1 : 1;
  const anchor = group.userData.handleAnchor || new THREE.Vector3();
  group.position.copy(group.userData.profilePosition);
  group.position.x += mirrorDirection * offsetX;
  group.position.y += offsetY;
  const profileScale = group.userData.profileScale || group.scale;
  const mirrorIntegratedHandle = group.name.endsWith('Hardware_Integrated')
    && group.name.startsWith('Child')
    && state.type === 'double'
    && PRODUCT_META[state.product]?.integratedHandle?.mirrorOnDouble;
  const targetScale = new THREE.Vector3(
    Math.abs(profileScale.x * scale) * (mirrorIntegratedHandle ? -1 : 1),
    profileScale.y * scale,
    profileScale.z * scale
  );
  group.scale.copy(targetScale);
  // The child integrated handle is mirrored as a real instance. A negative
  // X scale reverses triangle winding, so keep its thin metal/light parts
  // double-sided; otherwise WebGL back-face culling makes the mirrored
  // instance disappear from the front view.
  if (mirrorIntegratedHandle) {
    group.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      });
    });
  }
  // Keep the fitting's local centre fixed while applying the customer scale.
  // The profile scale is part of the authored fitting and must be included in
  // the same delta, otherwise a reduced smart-lock profile drifts on resize.
  if (anchor) {
    const baseScaleForPosition = new THREE.Vector3(
      profileScale.x,
      profileScale.y,
      profileScale.z
    );
    group.position.add(new THREE.Vector3(
      anchor.x * (baseScaleForPosition.x - targetScale.x),
      anchor.y * (baseScaleForPosition.y - targetScale.y),
      anchor.z * (baseScaleForPosition.z - targetScale.z)
    ));
  }
}

function applyHandlePosition() {
  const offsetX = THREE.MathUtils.clamp(Number(state.handleOffsetXMm) || 0, -180, 180) / 1000;
  const offsetY = THREE.MathUtils.clamp(Number(state.handleOffsetMm) || 0, -240, 240) / 1000;
  const scale = THREE.MathUtils.clamp(Number(state.handleScale) || 1, .82, 1.18);
  const activeHandle = ['long', 'ring', 'recess', 'integrated'].includes(state.handle);
  ['Main', 'Child'].forEach((label) => {
    const group = object(`${label}Hardware_${K80_HARDWARE_GROUPS[state.handle] || 'Long'}`);
    if (activeHandle) applyK80Position(group, offsetX, offsetY, scale);
  });
  const horizontalSlider = $('#handleHorizontalSlider');
  const verticalSlider = $('#handlePositionSlider');
  const scaleSlider = $('#handleScaleSlider');
  const horizontalOutput = $('#handleHorizontalOutput');
  const verticalOutput = $('#handlePositionOutput');
  const scaleOutput = $('#handleScaleOutput');
  $$('.handle-position-row').forEach((row) => {
    const isStructuralLightIntensity = Boolean(
      row.querySelector('#integratedLightIntensitySlider')
      && state.product === 'ruojian'
      && PRODUCT_META[state.product]?.integratedHandle
    );
    row.hidden = isStructuralLightIntensity ? false : !activeHandle;
  });
  if (horizontalSlider) horizontalSlider.value = String(state.handleOffsetXMm);
  if (verticalSlider) verticalSlider.value = String(state.handleOffsetMm);
  if (scaleSlider) scaleSlider.value = String(state.handleScale);
  if (horizontalOutput) {
    const value = Number(state.handleOffsetXMm) || 0;
    horizontalOutput.textContent = value === 0 ? '基准位置' : `${value > 0 ? '向外' : '向内'} ${Math.abs(value)} mm`;
  }
  if (verticalOutput) {
    const value = Number(state.handleOffsetMm) || 0;
    verticalOutput.textContent = value === 0 ? '基准位置' : `${value > 0 ? '上移' : '下移'} ${Math.abs(value)} mm`;
  }
  if (scaleOutput) scaleOutput.textContent = `${Math.round(scale * 100)}%`;
}

function applyLockPosition() {
  const offsetX = THREE.MathUtils.clamp(Number(state.lockOffsetXMm) || 0, -140, 140) / 1000;
  const offsetY = THREE.MathUtils.clamp(Number(state.lockOffsetMm) || 0, -200, 200) / 1000;
  const scale = THREE.MathUtils.clamp(Number(state.lockScale) || 1, .86, 1.14);
  ['Main', 'Child'].forEach((label) => {
    const group = object(`${label}Hardware_${K80_HARDWARE_GROUPS[state.lock] || 'Smart'}`);
    if (state.lock !== 'smart') return;
    applyK80Position(group, offsetX, offsetY, scale);
  });
  const horizontalSlider = $('#lockHorizontalSlider');
  const verticalSlider = $('#lockPositionSlider');
  const scaleSlider = $('#lockScaleSlider');
  const horizontalOutput = $('#lockHorizontalOutput');
  const verticalOutput = $('#lockPositionOutput');
  const scaleOutput = $('#lockScaleOutput');
  const visible = state.lock === 'smart';
  $$('.lock-position-row').forEach((row) => { row.hidden = !visible; });
  if (horizontalSlider) horizontalSlider.value = String(state.lockOffsetXMm);
  if (verticalSlider) verticalSlider.value = String(state.lockOffsetMm);
  if (scaleSlider) scaleSlider.value = String(state.lockScale);
  if (horizontalOutput) {
    const value = Number(state.lockOffsetXMm) || 0;
    horizontalOutput.textContent = value === 0 ? '基准位置' : `${value > 0 ? '向外' : '向内'} ${Math.abs(value)} mm`;
  }
  if (verticalOutput) {
    const value = Number(state.lockOffsetMm) || 0;
    verticalOutput.textContent = value === 0 ? '基准位置' : `${value > 0 ? '上移' : '下移'} ${Math.abs(value)} mm`;
  }
  if (scaleOutput) scaleOutput.textContent = `${Math.round(scale * 100)}%`;
}

function applyOpeningDetails() {
  // Keep the physical hinge and latch-edge assemblies present on the leaf.
  // They are authored under the pivots in the GLB, so the render loop rotates
  // the visible hardware with the exact same hinge axis as the door skin.
  const openChild = openingLeafRole() === 'child';
  ['Main', 'Child'].forEach((label) => {
    const isActiveLeaf = openChild ? label === 'Child' : label === 'Main';
    setVisibility(object(`${label}FrameHinges`), isActiveLeaf && state.open);
    setVisibility(object(`${label}LeafHingePlates`), isActiveLeaf && state.open);
    setVisibility(object(`${label}LockEdge`), isActiveLeaf && state.lock !== 'none' && state.open);
  });
  applyHingeStyle();
}

function openingLeafRole(opening = state.opening) {
  if (!hasChildLeafType()) return 'main';
  // In the authored K80 model, Main is the visual right-hand leaf and Child
  // is the visual left-hand leaf when viewed from outside. The UI labels are
  // defined by the lock side in that exterior view, so map left-lock to Child
  // and right-lock to Main rather than relying on the node names.
  return opening.endsWith('left') ? 'child' : 'main';
}

function applyHingeStyle() {
  const styles = {
    'k80-hidden': { color: 0x2f2925, roughness: .24, scale: 1 },
    'k80-five-axis': { color: 0x555b5d, roughness: .20, scale: 1.04 },
    'k80-external': { color: 0x8b6848, roughness: .18, scale: 1.12 }
  };
  const style = styles[state.hinge] || styles['k80-hidden'];
  ['MainFrameHinges', 'ChildFrameHinges', 'MainLeafHingePlates', 'ChildLeafHingePlates'].forEach((name) => {
    const group = object(name);
    group?.traverse((part) => {
      if (!part.isMesh) return;
      if (!part.userData.hingeMaterial) {
        part.userData.hingeMaterial = part.material?.clone?.() || part.material;
        part.material = part.userData.hingeMaterial;
      }
      if (part.material?.color) part.material.color.setHex(style.color);
      if (part.material) {
        part.material.metalness = .92;
        part.material.roughness = style.roughness;
        part.material.needsUpdate = true;
      }
      const base = part.userData.runtimeBase?.scale;
      if (base) part.scale.copy(base).multiplyScalar(style.scale);
    });
  });
}

let realtimePreviewRevision = 0;

// Reference-panel changes must rebuild the same assembly path as a product or
// size change. Previously the right panel state changed while only the text
// summary refreshed, leaving the door skin, frame and fittings visually stale.
async function refreshRealtimePreview({ focus = null, face = null } = {}) {
  if (!modelRoot) return;
  const revision = ++realtimePreviewRevision;
  // Configuration-panel edits do not go through applyDoorType. Reset the
  // authored frame/transom from their recorded base state before applying
  // another profile, so repeated selector changes never compound transforms.
  const width = state.width / 1000;
  const height = state.height / 1000;
  const openingWidth = width - BASE.jamb * 2;
  const mode = transomRenderMode();
  const leafHeight = state.transom && mode !== 'door-extended'
    ? height - BASE.head - BASE.threshold - transomHeightForMode(mode, openingWidth, height)
    : height - BASE.head - BASE.threshold;
  resizeFrame(width, height, leafHeight, openingWidth);
  resizeTransom(openingWidth, height, leafHeight);
  applyFixedFrameFinish();
  applyFrameVariants();
  applyFrameInstallation();
  applyHardware();
  applyOpeningDetails();
  await applyLeafTextures();
  if (revision !== realtimePreviewRevision) return;
  if (face) setTextureFaceView(face);
  else if (focus) setCameraFocus(focus);
  syncConfigurationUi();
}

function applyFixedFrameFinish() {
  if (!modelRoot) return;
  const frameFinish = PRODUCT_FRAME_FINISH[state.product] || FIXED_FRAME_FINISH;
  const frameColor = referenceColorHex(state.frameColor, frameFinish.frame);
  const casingColor = referenceColorHex(state.outerCasingColor, frameFinish.casing);
  const edgeColor = referenceColorHex(state.innerCasingColor || state.outerCasingColor, frameFinish.edge);
  modelRoot.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const lower = mesh.name.toLowerCase();
    if (!lower.includes('frame_') && !lower.includes('casing_') && !lower.includes('transom_')) return;
    if (lower.includes('gasket') || lower.includes('shadow') || lower.includes('opaque')) return;
    const material = mesh.userData.referenceFrameMaterial || makePhysicalMaterial(mesh.material, {
      metalness: lower.includes('step') ? .88 : .70,
      roughness: lower.includes('step') ? .19 : .27,
      clearcoat: .15,
      envMapIntensity: 1.55,
      specularIntensity: .90
    });
    mesh.userData.referenceFrameMaterial = material;
    material.color.setHex(lower.includes('casing_') ? casingColor : lower.includes('step') ? edgeColor : frameColor);
    material.needsUpdate = true;
    mesh.material = material;
  });
}

// The authored GLB contains a complete outer CasingGroup around the
// structural FrameGroup.  In the configurator that outer group reads as a
// second door套 with a gap, so the assembled product keeps only the actual
// structural frame attached to the door leaf.
function hideOuterCasingGroup() {
  const casing = object('CasingGroup');
  if (!casing) return;
  casing.visible = false;
  casing.userData.outerCasingHidden = true;
  casing.traverse((part) => {
    if (!part.isMesh) return;
    const lower = part.name.toLowerCase();
    part.visible = false;
    part.userData.outerCasingHidden = true;
    part.userData.casingPart = lower;
  });
}

function updateDimensionsUi() {
  $('#widthReadout').textContent = `${state.width} mm`;
  $('#heightReadout').textContent = `${state.height} mm`;
  $('#widthOutput').textContent = `${state.width} mm`;
  $('#heightOutput').textContent = `${state.height} mm`;
  const spec = typeSpecs[state.type];
  $('#dimensionRangeNote').textContent = `${spec.label}可调范围：宽 ${spec.width[0]}–${spec.width[1]} mm · 高 ${spec.height[0]}–${spec.height[1]} mm；K80 80 mm 全钢防盗结构，门框型材与五金保持真实尺寸。`;
  syncConfigurationUi();
}

const OPTION_LABELS = {
  opening: { 'out-left': '外开左锁', 'out-right': '外开右锁', 'in-left': '内开左锁', 'in-right': '内开右锁' },
  transom: {
    none: '无气窗', 'door-extended': '门体加高气窗', 'square-true': '方形封闭真气窗',
    'square-fake': '外方形假气窗', 'square-glass': '方形玻璃真气窗',
    'round-true': '圆弧封闭真气窗', 'round-fake': '外圆弧假气窗', 'round-glass': '圆弧玻璃真气窗',
    integrated: '方形门窗一体'
  },
  lock: { concealed: '隐藏锁体（无外露）', smart: '智能锁', none: '隐藏锁体（无外露）' },
  handle: { long: 'SL48F', ring: '双环拉手', recess: '中部凹槽拉手', integrated: '纹理一体灯带拉手', none: '无外拉手' },
  frameInstall: { outside: '靠墙外', center: '靠中装', inside: '靠墙内' },
  frameBuild: { integral: '整体制作', assembled: '拼装制作' }
};

const PRODUCT_HANDLE_CARD_COPY = {
  qinghuafu: {
    ring: { label: '圆月发光拉手', note: '中央 GLB 五金 · 暖金环光' }
  }
};

const ATMOSPHERE_LOCK_BLOCKLIST = new Set([
  '07LMK666L', '03LMA2', '07LM-Q1', '07LI-Y-SE MAX', '07LM-Y-PLUS'
]);
const REFERENCE_HINGE_LABELS = {
  'K80单轴暗合页': { state: 'k80-hidden', spec: '开启 107–110° · 承重 120 kg' },
  'K80全钢五轴合页': { state: 'k80-five-axis', spec: '开启 130–150° · 承重 160 kg' },
  'K80外合页': { state: 'k80-external', spec: '最大开启 180° · 承重 300 kg' }
};
const REFERENCE_HANDLE_LABELS = {
  none: '无外露拉手',
  'JC-RING': '江川赋双圆固定拉手',
  'QY-BAR': '清雅中部短金属拉手',
  'QHF-MOON': '清华赋圆月固定拉手'
};
const REFERENCE_GLASS_COPY = {
  '钢化玻璃': '高强度安全玻璃，适合方形真气窗；默认厚度 5 mm。',
  'LOW_E玻璃': '低辐射镀膜玻璃，减少热交换；需结合门体保温结构确认。',
  '长虹玻璃': '压花纹理玻璃，保留采光并降低直视；适合室内侧气窗。',
  '磨砂玻璃': '表面雾化处理，弱化透视并保持柔和采光。'
};
const REFERENCE_COLOR_KEYS = {
  '影木 1#': 'yingmu',
  '影木1#': 'yingmu',
  '美洲橡木 1#': 'oak',
  '美洲橡木1#': 'oak',
  'D-22k金色': 'oak',
  'E-22深古铜4#': 'graphite',
  '花絮青古铜 3#': 'green-bronze',
  '花絮青古铜3#': 'green-bronze',
  '花繁青古铜3#': 'green-bronze',
  '花絮青古铜 4#': 'green-bronze',
  '花繁青古铜4#': 'green-bronze',
  '花絮深古铜 1#': 'bronze',
  '花繁深古铜1#': 'bronze',
  '花絮银灰 1#': 'silver',
  '花繁银灰1#': 'silver',
  '花繁银灰3#': 'silver',
  '花繁青古铜3#': 'green-bronze',
  '石墨灰2#': 'graphite',
  '青古铜6#': 'green-bronze'
};
const REFERENCE_COLOR_SWATCHES = {
  '影木 1#': '#8b8176', '影木1#': '#8b8176',
  '美洲橡木 1#': '#9b7150', '美洲橡木1#': '#9b7150',
  'D-22k金色': '#b69a74',
  'E-22深古铜4#': '#5e4b3d',
  '花繁青古铜3#': '#615e50', '花繁青古铜4#': '#655f51',
  '花繁深古铜1#': '#5e4b3d', '花繁银灰1#': '#8d9295', '花繁银灰3#': '#878b8c',
  '石墨灰2#': '#4b4d4c', '青古铜6#': '#6b634a', '墨绿雨花点': '#263b32',
  '黄铜金': '#c89a5b', '宝马灰': '#54585b', '雅黑': '#252525', '泰蓝炽彩': '#315d68',
  '原始工艺色': '#766d63', '深古铜': '#604737', '墨金': '#574a3b'
};

// Reference-AI face fields are not merely BOM notes. They describe the
// physical surface that must be visible in the 3D preview. Keep the product
// photograph as the base map, then let the selected material/process change
// the PBR response without stretching or replacing the authored artwork.
const REFERENCE_MATERIAL_PROFILES = {
  '铝板': { metalness: .86, roughness: .24, clearcoat: .24, envMapIntensity: 1.68, bumpScale: .012, tint: 0xffffff },
  '钢板': { metalness: .92, roughness: .29, clearcoat: .18, envMapIntensity: 1.62, bumpScale: .014, tint: 0xf3f0eb },
  '热镀锌钢板': { metalness: .88, roughness: .34, clearcoat: .14, envMapIntensity: 1.48, bumpScale: .013, tint: 0xe7e4de },
  '铜板': { metalness: .84, roughness: .22, clearcoat: .30, envMapIntensity: 1.78, bumpScale: .013, tint: 0xffe0c3 },
  '木饰面': { metalness: .08, roughness: .52, clearcoat: .10, envMapIntensity: 1.06, bumpScale: .007, tint: 0xfff4df }
};

function referenceMaterialProfile(face = state.textureFace) {
  const material = state[`${face}Material`] || '铝板';
  const process = String(state[`${face}Process`] || '');
  const texture = String(state[`${face}TextureLabel`] || '');
  const profile = { ...(REFERENCE_MATERIAL_PROFILES[material] || REFERENCE_MATERIAL_PROFILES['铝板']) };
  if (material === '木饰面') {
    profile.roughness = Math.max(profile.roughness, .48);
    profile.metalness = .06;
  }
  if (/浮雕|精雕|镂空/.test(process) || /精雕|浮雕/.test(texture)) {
    profile.roughness = Math.max(.16, profile.roughness - .035);
    profile.bumpScale += .004;
    profile.clearcoat = Math.min(.42, profile.clearcoat + .04);
  }
  if (/哑光|磨砂/.test(process)) {
    profile.roughness = Math.min(.70, profile.roughness + .08);
    profile.clearcoat = Math.max(.04, profile.clearcoat - .06);
  }
  const thickness = Number.parseFloat(state[`${face}Thickness`]);
  if (Number.isFinite(thickness)) profile.bumpScale *= THREE.MathUtils.clamp(thickness / 3, .72, 1.34);
  return profile;
}

function referenceColorHex(label, fallback = 0x76604f) {
  const value = REFERENCE_COLOR_SWATCHES[label];
  if (!value) return fallback;
  const parsed = Number.parseInt(String(value).replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultReferenceColorLabel(product = state.product, face = 'front') {
  const defaults = catalogReferenceDefaults(product);
  const requested = face === 'back' ? defaults.backReferenceColor : defaults.frontReferenceColor;
  return requested || COLORWAYS[product]?.[0]?.label || '影木1#';
}

function referenceAtmosphereLightAllowed() {
  return !ATMOSPHERE_LOCK_BLOCKLIST.has(String(state.lockPanelCode || '').trim());
}

function syncReferenceUi() {
  const meta = PRODUCT_META[state.product] || {};
  const values = {
    type: state.type,
    surfaceSeries: state.surfaceSeries,
    typeLabel: typeSpecs[state.type]?.label || '门型',
    width: `${state.width} mm`,
    height: `${state.height} mm`,
    depth: `${Math.max(80, Number(state.wallThickness || 120) - 120)} mm`,
    frontFinish: meta.label,
    backFinish: meta.label,
    frontMaterial: state.frontMaterial,
    backMaterial: state.backMaterial,
    frontThickness: `${state.frontThickness} mm`,
    backThickness: `${state.backThickness} mm`,
    frontProcess: state.frontProcess,
    backProcess: state.backProcess,
    frontTextureLabel: state.frontTextureLabel,
    backTextureLabel: state.backTextureLabel,
    frontReferenceColor: state.frontReferenceColor,
    backReferenceColor: state.backReferenceColor,
    outerCasing: state.outerCasing,
    outerCasingColor: state.outerCasingColor,
    innerCasing: state.innerCasing,
    innerCasingColor: state.innerCasingColor,
    frameProfile: state.frameProfile,
    frameColor: state.frameColor,
    threshold: state.threshold,
    wallIntegrated: state.wallIntegrated,
    transomType: OPTION_LABELS.transom[state.transomType] || state.transomType,
    lockPanelCode: state.lockPanelCode,
    handleCode: REFERENCE_HANDLE_LABELS[state.handleCode] || state.handleCode,
    sealCode: state.sealCode,
    hingeCode: state.hingeCode,
    hingeSpec: REFERENCE_HINGE_LABELS[state.hingeCode]?.spec || '开启角度与承重随合页型号联动',
    lightSummary: state.product === 'ruojian'
      ? '雅帝若简 · SL48F 橙色通天灯带拉手'
      : `${meta.label} · 结构灯光按产品配置`
  };
  $$('[data-ref-output]').forEach((node) => {
    const key = node.dataset.refOutput;
    if (values[key] != null) node.textContent = values[key];
  });
  const noHandlePreview = {
    ruojian: './assets/catalog/k80/products/ruojian/front-b0019857.jpg',
    yuanyin: './assets/catalog/k80/products/yuanyin/front-b0020027.jpg',
    jinghong: './assets/catalog/k80/products/jinghong/front-b0012993.jpg'
  }[state.product];
  const hardwarePreview = {
    SL48F: './assets/generated/hardware/references/k80-sl48f-full-height-pull.png',
    'SL-115': './assets/generated/hardware/references/k80-sl115-fixed-pull.png',
    'SL-108': './assets/generated/hardware/references/k80-sl108-fixed-pull.png',
    'JC-RING': './assets/generated/hardware/references/k80-jiangchuan-round-pull.png',
    'QY-BAR': './assets/generated/hardware/references/k80-qingya-center-pull.png',
    'QHF-MOON': './assets/generated/hardware/references/k80-qinghuafu-moon-pull.png'
  }[state.handleCode] || noHandlePreview || './assets/generated/hardware/references/handle-lever-v2.png';
  $$('[data-ref-hardware-preview="handle"]').forEach((node) => {
    node.src = hardwarePreview;
    node.alt = `${state.handleCode || '固定拉手'} 门用执手示意图`;
  });
  $('[data-ref-type-icon]')?.setAttribute('data-ref-type', state.type);
  const typeImage = {
    single: './assets/catalog/derived/k80/door-types/door-single-v2.png',
    mother: './assets/catalog/derived/k80/door-types/door-mother-v2.png',
    double: './assets/catalog/derived/k80/door-types/door-double-v2.png'
  }[state.type] || './assets/catalog/derived/k80/door-types/door-double-v2.png';
  const typeImageNode = $('[data-ref-type-image]');
  if (typeImageNode) {
    typeImageNode.src = typeImage;
    typeImageNode.alt = `${values.typeLabel}示意图`;
  }
  $$('.pdf-color-current').forEach((preview) => {
    const face = preview.closest('[data-reference-face]')?.dataset.referenceFace;
    const field = preview.dataset.refPreview || (face === 'back' ? 'backReferenceColor' : 'frontReferenceColor');
    const selected = state[field];
    const swatch = REFERENCE_COLOR_SWATCHES[selected] || COLORWAYS[state.product]?.find((item) => item.label === selected)?.swatch || '#b69a74';
    preview.querySelector('i')?.style.setProperty('background', swatch);
  });
  $$('[data-ref-field]').forEach((control) => {
    const field = control.dataset.refField;
    const value = state[field];
    if (value == null) return;
    control.classList.toggle('selected', String(control.dataset.refValue) === String(value));
    if (control.matches('input, select, textarea') && control.type !== 'checkbox' && document.activeElement !== control) control.value = String(value);
  });
  // Products without a protruding pull still keep this row visible. It makes
  // the product-specific "无外露拉手" rule explicit instead of leaving an
  // unexplained gap in the hardware BOM.
  const ruojianHandleRow = $('[data-hardware-part="handle"]');
  if (ruojianHandleRow) ruojianHandleRow.hidden = false;
  const ruojianLightSlot = $('.reference-handle-light-controls');
  if (ruojianLightSlot && state.product === 'ruojian') ruojianLightSlot.hidden = true;
  ['front', 'back'].forEach((face) => {
    const material = state[`${face}Material`];
    const woodOnly = material === '木饰面';
    $$(`[data-ref-field="${face}Process"]`).forEach((control) => {
      control.disabled = woodOnly;
      control.classList.toggle('is-disabled', woodOnly);
      control.title = woodOnly ? '木饰面仅记录纹理，不配置表面工艺' : '';
      const line = control.closest('.reference-face-line');
      if (line) line.hidden = woodOnly;
    });
  });
  $$('[data-ref-check]').forEach((control) => {
    const field = control.dataset.refCheck;
    control.checked = Boolean(state[field]);
  });
  const transomToggle = $('[data-ref-check="transom"]');
  if (transomToggle) {
    transomToggle.checked = Boolean(state.transom && state.transomType !== 'none');
    transomToggle.closest('.pdf-section-toggle')?.classList.toggle('is-disabled', false);
  }
  const transomEnabled = Boolean(state.transom && state.transomType !== 'none');
  $$('.transom-reference-option').forEach((option) => {
    option.disabled = !transomEnabled;
    option.classList.toggle('is-disabled', !transomEnabled);
  });
  $$('[data-ref-check="transomFlowerEnabled"]').forEach((control) => {
    control.disabled = !transomEnabled;
    control.closest('label')?.classList.toggle('is-disabled', !transomEnabled);
  });
  const lightAllowed = referenceAtmosphereLightAllowed();
  if (!lightAllowed) {
    state.frameAtmosphereLightEnabled = false;
    state.thresholdLightEnabled = false;
    state.wallLightEnabled = false;
  }
  $$('[data-ref-check="frameAtmosphereLightEnabled"], [data-ref-check="thresholdLightEnabled"], [data-ref-check="wallLightEnabled"]').forEach((control) => {
    control.disabled = !lightAllowed;
    control.closest('label')?.classList.toggle('is-disabled', !lightAllowed);
  });
  const warning = $('[data-light-warning]');
  if (warning) {
    warning.hidden = lightAllowed;
    warning.textContent = lightAllowed ? '' : '当前锁具为电池供电，页面驱动表不允许接入氛围灯。';
  }
  const craftNote = $('[data-craft-note="transom"]');
  if (craftNote) {
    const glass = state.transomOuterGlass !== '无' ? state.transomOuterGlass : state.transomInnerGlass;
    const thickness = state.transomOuterGlass !== '无' ? state.transomOuterGlassThickness : state.transomInnerGlassThickness;
    craftNote.textContent = glass && glass !== '无'
      ? `${glass} · ${thickness} · ${REFERENCE_GLASS_COPY[glass] || '玻璃类型与工艺说明随页面驱动表记录。'}`
      : `花件：${state.transomMainMaterial} ${state.transomMainThickness} mm · ${state.transomMainProcess}；未启用玻璃气窗。`;
  }
  const thresholdDrain = $('[data-ref-check="thresholdDrainEnabled"]');
  if (thresholdDrain) {
    const drainAllowed = /排水/.test(state.threshold || '') || state.opening.startsWith('in-');
    thresholdDrain.disabled = !drainAllowed || !lightAllowed;
    thresholdDrain.closest('label')?.classList.toggle('is-disabled', thresholdDrain.disabled);
  }
}

const REFERENCE_FACE_FIELDS = new Set([
  'frontMaterial', 'frontThickness', 'frontProcess', 'frontTextureLabel',
  'backMaterial', 'backThickness', 'backProcess', 'backTextureLabel'
]);
const REFERENCE_FRAME_FIELDS = new Set([
  'outerCasing', 'outerCasingColor', 'innerCasing', 'innerCasingColor',
  'frameProfile', 'frameColor', 'threshold', 'thresholdNote',
  'wallIntegrated', 'wallModule'
]);
const REFERENCE_HARDWARE_FIELDS = new Set(['lockPanelCode', 'handleCode', 'sealCode', 'hingeCode']);

// The PDF reference panel exposes a business label for the selected graphic
// texture, while the renderer works with the product-specific design layer
// and surface recipe. Keep both in sync so changing the select is immediately
// visible on the real door instead of only changing the text summary.
function applyReferenceTextureLabel(face, label) {
  const normalized = String(label || '').replace(/\(无纹理\)/g, '（无纹理）');
  const designs = getTextureDesigns('k80', state.product, 'main');
  const hasDesign = (key) => designs.some((item) => item.key === key);
  const isFlat = /平板|无纹理/.test(normalized);
  const isLaser = /3D激光精雕|精雕/.test(normalized);
  const isWoodgrain = /506榆木|木纹/.test(normalized);
  const designKey = isFlat && hasDesign('clean')
    ? 'clean'
    : (isLaser || isWoodgrain) && hasDesign('focus')
      ? 'focus'
      : !isFlat && hasDesign('factory')
        ? 'factory'
        : designs[0]?.key || 'factory';
  const design = designs.find((item) => item.key === designKey);
  setTextureDesignSetting(face, 'pair', 'key', designKey);
  setTextureDesignSetting(face, 'pair', 'scale', design?.defaultScale || 1);
  // Use the existing product map for every option; the variant changes the
  // actual relief/finish treatment without replacing it with a generic tile.
  const variant = isLaser ? 'relief' : isWoodgrain ? 'matte' : 'factory';
  setTextureSetting(face, 'pair', 'variant', variant);
}

function applySurfaceSeriesPreview(series) {
  const preset = {
    K80AL: { frontMaterial: '铝板', backMaterial: '铝板', surface: 'factory' },
    K80ST: { frontMaterial: '钢板', backMaterial: '热镀锌钢板', surface: 'graphite' },
    K80CU: { frontMaterial: '铜板', backMaterial: '铜板', surface: 'bronze' }
  }[series] || { frontMaterial: '铝板', backMaterial: '铝板', surface: 'factory' };
  // A series is a physical finish family, not only a BOM label. Apply it to
  // both faces and the real surface recipe so the left preview changes at
  // once while keeping the selected front/back design layers intact.
  state.frontMaterial = preset.frontMaterial;
  state.backMaterial = preset.backMaterial;
  setTextureSurfaceForFace('front', preset.surface);
  setTextureSurfaceForFace('back', preset.surface);
}

function applyReferenceField(field, value) {
  if (!field) return;
  if (field === 'type') {
    if (!supportedTypesForState().includes(value)) return;
    state.type = value;
    updateSliderRanges();
    renderProductControls();
    applyDoorType();
  } else if (field === 'opening') {
    state.opening = value;
    applyHardware();
    applyOpeningDetails();
  } else if (field === 'transomType') {
    state.transomType = value;
    state.transom = value !== 'none';
    if (value === 'square-glass') {
      state.transomOuterGlass = state.transomOuterGlass === '无' ? '钢化玻璃' : state.transomOuterGlass;
      state.transomOuterGlassThickness ||= '5MM';
    } else if (value === 'round-glass') {
      state.transomOuterGlass = state.transomOuterGlass === '无' ? '长虹玻璃' : state.transomOuterGlass;
      state.transomOuterGlassThickness ||= '6MM';
    } else if (!value || value === 'none' || value.endsWith('-fake') || value === 'door-extended') {
      state.transomOuterGlass = '无';
      state.transomInnerGlass = '无';
    }
    applyDoorType();
  } else if (field === 'lockPanelCode') {
    state.lockPanelCode = value;
    state.lock = value === 'none' ? 'none' : 'smart';
    void refreshRealtimePreview({ focus: 'hardware' });
  } else if (field === 'handleCode') {
    state.handleCode = value;
    const productHandleType = {
      'JC-RING': 'ring',
      'QHF-MOON': 'ring',
      'QY-BAR': 'integrated'
    }[value];
    state.handle = value === 'none' ? 'none' : productHandleType || 'long';
    void refreshRealtimePreview({ focus: 'hardware' });
  } else if (field === 'hingeCode') {
    state.hingeCode = value;
    state.hinge = REFERENCE_HINGE_LABELS[value]?.state || 'k80-hidden';
    // The hinge itself is hidden behind the closed leaf. Rebuild its material
    // first, then open the active leaf and move to the dedicated hinge view.
    void refreshRealtimePreview().then(() => focusHardwareConfiguration('hinge'));
  } else if (field === 'threshold') {
    state.threshold = value;
    if (/氛围灯/.test(value)) state.thresholdLightEnabled = true;
    if (/排水/.test(value)) state.thresholdDrainEnabled = true;
    void refreshRealtimePreview({ focus: 'frame-top' });
  } else if (field === 'wallIntegrated') {
    state.wallIntegrated = value;
    if (value === 'none') { state.wallModule = 'none'; state.wallLightEnabled = false; }
    void refreshRealtimePreview({ focus: 'frame-top' });
  } else if (field === 'surfaceSeries') {
    state.surfaceSeries = value;
    applySurfaceSeriesPreview(value);
    void refreshRealtimePreview({ focus: 'surface' });
  } else if (field === 'frontReferenceColor' || field === 'backReferenceColor') {
    state[field] = value;
    const face = field.startsWith('front') ? 'front' : 'back';
    const colorKey = REFERENCE_COLOR_KEYS[value] || COLORWAYS[state.product]?.find((item) => item.label === value)?.key;
    if (colorKey && COLORWAYS[state.product]?.some((item) => item.key === colorKey)) {
      state[`${face}Color`] = colorKey;
      setTextureSetting(face, 'pair', 'color', colorKey);
    }
    renderProductControls();
    void refreshRealtimePreview({ face });
  } else if (REFERENCE_FACE_FIELDS.has(field)) {
    state[field] = value;
    const face = field.startsWith('front') ? 'front' : 'back';
    if (value === '木饰面') state[`${face}Process`] = '无';
    if (field.endsWith('TextureLabel')) applyReferenceTextureLabel(face, value);
    void refreshRealtimePreview({ face });
  } else if (REFERENCE_FRAME_FIELDS.has(field)) {
    state[field] = value;
    void refreshRealtimePreview({ focus: 'frame-top' });
  } else if (REFERENCE_HARDWARE_FIELDS.has(field)) {
    state[field] = value;
    void refreshRealtimePreview({ focus: 'hardware' });
  } else if (Object.prototype.hasOwnProperty.call(state, field)) {
    state[field] = value;
    if (/^transom/.test(field)) void refreshRealtimePreview({ focus: 'transom' });
  }
  syncChoiceButtons();
  syncReferenceUi();
  syncConfigurationUi();
}

function syncConfigurationUi() {
  const meta = PRODUCT_META[state.product];
  const color = currentColorway();
  const surface = currentTextureSurface();
  const type = typeSpecs[state.type];
  const transomMode = transomRenderMode();
  const transomHeight = state.transom && transomMode !== 'door-extended'
    ? Math.round(transomHeightForMode(transomMode, state.width / 1000 - BASE.jamb * 2, state.height / 1000) * 1000)
    : 0;
  const clearWidth = Math.max(0, state.width - Math.round((BASE.jamb * 2 + BASE.gap) * 1000));
  const clearHeight = Math.max(0, state.height - Math.round((BASE.head + BASE.threshold) * 1000) - transomHeight);
  const casingWidth = state.width + 120;
  const casingHeight = state.height + 60;
  if ($('#productSectionSummary')) $('#productSectionSummary').textContent = `${meta.label} · ${textureRegionLabel(state.textureRegion)} ${surface.label} · ${color.label}`;
  if ($('#structureSectionSummary')) $('#structureSectionSummary').textContent = `${type.label} · ${OPTION_LABELS.opening[state.opening]}`;
  if ($('#transomSectionSummary')) $('#transomSectionSummary').textContent = OPTION_LABELS.transom[state.transomType];
  if ($('#dimensionSectionSummary')) $('#dimensionSectionSummary').textContent = `${state.width} × ${state.height} mm`;
  if ($('#clearOpeningReadout')) $('#clearOpeningReadout').textContent = `${clearWidth} × ${clearHeight} mm`;
  if ($('#casingReadout')) $('#casingReadout').textContent = `${casingWidth} × ${casingHeight} mm`;
  if ($('#wallThicknessOutput')) $('#wallThicknessOutput').textContent = `${state.wallThickness} mm`;
  if ($('#frameSectionSummary')) $('#frameSectionSummary').textContent = `固定工艺色 · ${OPTION_LABELS.frameBuild[state.frameBuild]}`;
  const lockSummary = state.lock === 'none' ? OPTION_LABELS.lock.none : (state.lockPanelCode || OPTION_LABELS.lock[state.lock]);
  const handleSummary = state.handle === 'none' ? OPTION_LABELS.handle.none : (state.handle === 'long' ? (state.handleCode || OPTION_LABELS.handle.long) : OPTION_LABELS.handle[state.handle]);
  if ($('#hardwareSectionSummary')) $('#hardwareSectionSummary').textContent = `${lockSummary} · ${handleSummary}`;
  const rule = compositionRule({ sourceType: getTextureManifest('k80', state.frontFinish)?.base?.type, type: state.type });
  if ($('#compositionLogicNote')) $('#compositionLogicNote').innerHTML = `<b>${rule.title}</b>${rule.text}`;
  syncReferenceUi();
  productInspector?.update();
}

function currentAssemblyBounds() {
  if (!modelRoot) return new THREE.Box3(new THREE.Vector3(-1, 0, -.2), new THREE.Vector3(1, 2.6, .2));
  modelRoot.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(modelRoot, true);
}

function cameraPose(view = state.view) {
  const bounds = currentAssemblyBounds();
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const aspect = Math.max(.5, mount.clientWidth / Math.max(1, mount.clientHeight));
  const verticalDistance = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const screenWidth = view === 'side' ? Math.max(size.z, .65) : size.x;
  const horizontalDistance = screenWidth / aspect / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  // The 3D pose is viewed obliquely, so the raw vertical/horizontal fit is
  // not enough: the near jamb and the opened leaf project beyond the frustum.
  // Keep a deliberate physical margin so every supported door size remains
  // fully visible instead of being cropped when a slider changes dimensions.
  const distance = Math.max(verticalDistance, horizontalDistance) * 1.42 + .32;
  const target = new THREE.Vector3(center.x, Math.max(.9, center.y), view === 'side' ? center.z : 0);
  let position;
  if (view === 'front') position = new THREE.Vector3(center.x, target.y, distance);
  else if (view === 'back') position = new THREE.Vector3(center.x, target.y, -distance);
  else if (view === 'side') position = new THREE.Vector3(center.x + distance, target.y, center.z + .12);
  else position = new THREE.Vector3(distance * .31, target.y + distance * .10, distance * .95);
  return { position, target };
}

function focusDistance(regionWidth, regionHeight, padding = 1.08) {
  const aspect = Math.max(.5, mount.clientWidth / Math.max(1, mount.clientHeight));
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const vertical = regionHeight / (2 * Math.tan(halfFov));
  const horizontal = regionWidth / aspect / (2 * Math.tan(halfFov));
  return Math.max(vertical, horizontal) * padding + .12;
}

function cameraFocusPose(focus) {
  const bounds = currentAssemblyBounds();
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const frontTarget = (x, y) => new THREE.Vector3(x, y, 0);
  let target;
  let distance;

  if (focus === 'surface') {
    target = frontTarget(center.x, center.y);
    distance = focusDistance(size.x * .90, size.y * .72, 1.04);
    return { position: new THREE.Vector3(target.x, target.y, distance), target };
  }
  if (focus === 'hardware') {
    const lockSide = state.opening.endsWith('left') ? -1 : 1;
    target = frontTarget(center.x + lockSide * Math.min(size.x * .13, .28), Math.min(bounds.max.y - .36, Math.max(bounds.min.y + .58, 1.12)));
    distance = focusDistance(Math.min(1.18, size.x * .62), Math.min(1.48, size.y * .60), 1.08);
    return { position: new THREE.Vector3(target.x + lockSide * .08, target.y + .02, distance), target };
  }
  if (focus === 'hinge') {
    // The active K80 leaf is authored around its outer frame-side pivot:
    // right-lock products use Main (+X), left-lock products use Child (-X).
    const hingeSide = state.opening.endsWith('left') ? -1 : 1;
    target = new THREE.Vector3(center.x + hingeSide * size.x * .43, Math.min(bounds.max.y - .45, Math.max(bounds.min.y + .62, 1.16)), 0);
    distance = focusDistance(Math.min(.72, size.x * .42), Math.min(1.60, size.y * .64), 1.04);
    return { position: new THREE.Vector3(target.x + hingeSide * distance * .58, target.y + .08, distance * .86), target };
  }
  if (focus === 'transom') {
    target = frontTarget(center.x, bounds.max.y - Math.min(.30, size.y * .12));
    distance = focusDistance(size.x * .94, Math.min(.72, size.y * .30), 1.08);
    return { position: new THREE.Vector3(target.x, target.y, distance), target };
  }
  if (focus === 'frame') {
    target = frontTarget(center.x + size.x * .28, center.y);
    distance = focusDistance(Math.min(1.45, size.x * .78), Math.min(2.28, size.y * .90), 1.08);
    return { position: new THREE.Vector3(target.x + distance * .22, target.y + distance * .035, distance * .98), target };
  }
  if (focus === 'frame-top') {
    // Right-front elevated overview: keeps the complete head, both jambs and
    // the outer casing in one frame while exposing their depth relationship.
    target = new THREE.Vector3(center.x + size.x * .10, center.y + size.y * .08, 0);
    distance = focusDistance(size.x * 1.16, size.y * 1.02, 1.14);
    return {
      position: new THREE.Vector3(target.x + distance * .56, target.y + distance * .42, distance * .82),
      target
    };
  }
  if (focus === 'sidelight') {
    target = frontTarget(bounds.min.x + size.x * .20, center.y);
    distance = focusDistance(size.x * .48, size.y * .84, 1.08);
    return { position: new THREE.Vector3(target.x, target.y, distance), target };
  }
  if (focus === 'dimensions') return cameraPose('front');
  if (focus === 'structure') {
    const pose = cameraPose('perspective');
    pose.position.lerp(pose.target, .10);
    return pose;
  }
  return cameraPose(state.view);
}

function applyCameraPose(pose, immediate = false, duration = 620) {
  const samePose = (first, second) => first && second
    && first.position.distanceToSquared(second.position) < .000004
    && first.target.distanceToSquared(second.target) < .000004;
  // A tab click can emit both a pointer and focus request. Recreating an
  // identical tween from slightly different intermediate camera positions
  // makes the canvas flash; retain the active destination instead.
  if (!immediate && (
    stageInteractionActive
    || (viewTween && samePose(viewTween.toPose, pose))
    || samePose({ position: camera.position, target: controls.target }, pose)
  )) return;
  if (immediate) {
    viewTween = null;
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    controls.update();
    return;
  }
  // Flush any residual OrbitControls damping before using the current pose as
  // the next tween origin. The tween owns camera coordinates until it ends.
  const dampingEnabled = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = dampingEnabled;
  viewTween = {
    start: performance.now(),
    duration,
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: pose.position,
    toTarget: pose.target,
    toPose: { position: pose.position.clone(), target: pose.target.clone() }
  };
}

function setCameraFocus(focus, immediate = false) {
  activeCameraFocus = focus === 'overview' ? null : focus;
  mount.dataset.cameraFocus = activeCameraFocus || 'overview';
  applyCameraPose(activeCameraFocus ? cameraFocusPose(activeCameraFocus) : cameraPose(state.view), immediate, 680);
  const visualView = ['structure', 'frame', 'frame-top', 'hinge'].includes(activeCameraFocus) ? 'perspective' : activeCameraFocus ? 'front' : state.view;
  $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === visualView));
}

function refitActiveCamera(immediate = false) {
  if (activeCameraFocus) setCameraFocus(activeCameraFocus, immediate);
  else setView(state.view, immediate);
}

function setView(view, immediate = false) {
  activeCameraFocus = null;
  mount.dataset.cameraFocus = 'overview';
  state.view = view;
  const pose = cameraPose(view);
  applyCameraPose(pose, immediate, 520);
  $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
}

// Texture framing is a material edit, not a new camera focus. Keep the whole
// door in the perspective panorama while zoom/pan sliders are dragged; only
// switch once when the user arrived from a front/back or hardware focus.
function lockTexturePanoramaView() {
  if (state.view !== 'perspective' || activeCameraFocus) setView('perspective');
}

function setTextureFaceView(face = 'front') {
  const nextFace = face === 'back' ? 'back' : 'front';
  state.textureFace = nextFace;
  $$('[data-texture-face]').forEach((button) => button.classList.toggle('selected', button.dataset.textureFace === nextFace));
  // Surface editing needs enough context to compare the whole assembly. The
  // interior face gets its own true back-facing main view so the user can see
  // the material rather than editing a front-facing proxy.
  setView(nextFace === 'back' ? 'back' : 'perspective');
}

function setDoorOpenState(open, { refit = true } = {}) {
  const nextOpen = Boolean(open);
  const changed = state.open !== nextOpen;
  state.open = nextOpen;
  $('#toggleDoorOpen').classList.toggle('active', state.open);
  $('#toggleDoorOpen').textContent = state.open ? '关闭主门' : '打开主门';
  $('#doorPoseReadout').textContent = state.open
    ? `${state.opening.endsWith('left') ? '左锁' : '右锁'}门扇开启 78° · 合页轴转动`
    : `闭合状态 · ${state.opening.endsWith('left') ? '左锁' : '右锁'} · 80 mm 全钢门扇结构`;
  if (changed) applyOpeningDetails();
  if (changed && refit) {
    window.clearTimeout(pendingCameraRefitTimer);
    pendingCameraRefitTimer = window.setTimeout(() => refitActiveCamera(), 980);
  }
  return changed;
}

function focusHardwareConfiguration(focus = 'hardware') {
  const normalizedFocus = focus === 'hinge' ? 'hinge' : 'hardware';
  const now = performance.now();
  // A click on a hardware option can emit pointerdown, focusin and tab-level
  // events together. Coalesce that burst so it opens/refits only once.
  if (
    state.open
    && activeCameraFocus === normalizedFocus
    && lastHardwareFocusKey === normalizedFocus
    && now - lastHardwareFocusAt < 320
  ) return;
  lastHardwareFocusKey = normalizedFocus;
  lastHardwareFocusAt = now;
  const startedOpening = setDoorOpenState(true, { refit: false });
  // Start the camera movement together with the door swing, then refit once
  // the leaf reaches its open depth so the hinge remains fully in frame.
  setCameraFocus(normalizedFocus);
  if (startedOpening || normalizedFocus === 'hinge') {
    window.clearTimeout(pendingCameraRefitTimer);
    pendingCameraRefitTimer = window.setTimeout(() => setCameraFocus(normalizedFocus), 980);
  }
}

async function applyDoorType({ fitCamera = true } = {}) {
  if (!modelRoot) return;
  const spec = typeSpecs[state.type];
  const width = state.width / 1000;
  const height = state.height / 1000;
  const openingWidth = width - BASE.jamb * 2;
  const mode = transomRenderMode();
  const isDoorExtended = state.transom && mode === 'door-extended';
  const activeTransomHeight = state.transom && !isDoorExtended
    ? transomHeightForMode(mode, openingWidth, height)
    : 0;
  const leafHeight = height - BASE.head - BASE.threshold - activeTransomHeight;
  const sideCount = typeSpecs[state.type].sideCount || 0;
  const sideWidth = sideCount ? Math.min(BASE.sideLight, openingWidth * .34) : 0;
  const centralOpening = openingWidth - sideWidth * sideCount;
  let childWidth = 0;
  let mainWidth = centralOpening - BASE.gap;
  if (hasChildLeafType()) {
    const pairSpan = closedPairSpan(centralOpening, spec);
    mainWidth = pairSpan * spec.mainRatio;
    childWidth = pairSpan - mainWidth;
  }
  const mainPivotX = state.type === 'doubleSide' ? openingWidth / 2 - sideWidth : openingWidth / 2;
  const childPivotX = state.type === 'doubleSide' ? -openingWidth / 2 + sideWidth : -openingWidth / 2;
  currentLeafLayout = {
    main: mainWidth, child: childWidth, side: sideWidth,
    mainPivotX, childPivotX, height: leafHeight
  };
  showroom?.userData?.setDimensions?.({ width, height, type: state.type });

  mainPivot.position.set(mainPivotX, BASE.threshold, 0);
  childPivot.position.set(childPivotX, BASE.threshold, 0);
  mainPivot.visible = true;
  childPivot.visible = hasChildLeafType();
  resizeLeaf('main', mainPivot, mainWidth, leafHeight);
  if (hasChildLeafType()) resizeLeaf('child', childPivot, childWidth, leafHeight);
  resizeFrame(width, height, leafHeight, openingWidth);
  resizeCasing(width, height);
  resizeTransom(openingWidth, height, leafHeight);
  applyFrameVariants();
  resizeK80SideLights(openingWidth, leafHeight, sideWidth || BASE.sideLight, state.type);
  applyFrameInstallation();
  applyHardware();
  applyOpeningDetails();
  await applyLeafTextures();
  updateDimensionsUi();
  applyTypeCards();
  if (fitCamera) refitActiveCamera();
}

async function loadModel() {
  try {
    const gltf = await loadModelWithRetry(`./assets/models/yadilo-door-custom.glb?v=${ASSET_VERSION}`);
    modelRoot = gltf.scene;
    modelRoot.name = 'YADILO_K80_Assembly';
    modelRoot.position.z = SHOWROOM_DOOR_FORWARD_OFFSET;
    scene.add(modelRoot);
    mainPivot = object('MainLeafPivot');
    childPivot = object('ChildLeafPivot');
    frameGroup = object('FrameGroup');
    transomGroup = object('TransomGroup');
    if (!mainPivot || !childPivot || !frameGroup) throw new Error('GLB 缺少门扇转轴或门框分组');
    if (transomGroup) {
      transomVariantGroup = new THREE.Group();
      transomVariantGroup.name = 'RuntimeTransomVariants';
      transomVariantGroup.visible = false;
      transomGroup.add(transomVariantGroup);
    }
    ensureK80SideLightGroups();
    // This separator belongs to the continuous door skin, not to the hidden
    // transom assembly. It is deliberately a thin inset line with the same
    // finish family as the product frame, so the extended option reads as one
    // taller door with a manufacturing joint.
    const separatorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x5c5048, metalness: .66, roughness: .28, clearcoat: .18,
      envMapIntensity: 1.42
    });
    integratedTransomSeparator = new THREE.Mesh(
      new THREE.BoxGeometry(1, .008, .006), separatorMaterial
    );
    integratedTransomSeparator.name = 'IntegratedTransomSeparator';
    integratedTransomSeparator.userData.baseWidth = 1;
    integratedTransomSeparator.visible = false;
    modelRoot.add(integratedTransomSeparator);
    rememberHandleAnchors();
    await installK80ReferenceHardwareAssets();

    modelRoot.traverse((node) => {
      rememberBase(node);
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.userData.originalMaterial = node.material;
      if (/^DoorLeaf_(Main|Child)_(Front|Back)$/.test(node.name) || node.name === 'Transom_OpaquePanel') planarizeLeafUv(node);
      if (node.material) {
        const materialName = node.name.toLowerCase();
        node.material.envMapIntensity = materialName.includes('hardware') || materialName.includes('lock') || materialName.includes('handle') ? 1.85 : 1.38;
        if ('specularIntensity' in node.material) node.material.specularIntensity = materialName.includes('hardware') ? .94 : .82;
        node.material.needsUpdate = true;
      }
    });
    hideOuterCasingGroup();
    await applyLockSideTextures();
    applyFixedFrameFinish();
    // The HTML fallback values are for the first paint only. Reapply the
    // active door type before the first interaction so the slider min/max and
    // its displayed value are the same physical profile as the GLB assembly.
    updateSliderRanges();
    await applyDoorType({ fitCamera: false });
    setView('perspective', true);
    $('#meshCount').textContent = `${modelRoot.getObjectsByProperty('isMesh', true).length} meshes`;
    status.textContent = 'K80 分层金属门模型已加载';
    $('.glb-status').innerHTML = '<i></i> GLB 已加载';
  } catch (error) {
    console.error(error);
    status.textContent = `模型读取失败：${error.message} · 可刷新重试`;
    $('.glb-status').innerHTML = '<i style="background:#c8786b"></i> GLB 读取失败';
  }
}

function updateSliderRanges(reset = true) {
  const spec = typeSpecs[state.type];
  const width = $('#widthSlider');
  const height = $('#heightSlider');
  width.min = spec.width[0];
  width.max = spec.width[1];
  if (reset) width.value = spec.width[2];
  height.min = spec.height[0];
  height.max = spec.height[1];
  if (reset) height.value = spec.height[2];
  if (reset) {
    state.width = spec.width[2];
    state.height = spec.height[2];
  }
}

$$('[data-type]').forEach((button) => button.addEventListener('click', async () => {
  if (!supportedTypesForState().includes(button.dataset.type)) return;
  state.type = button.dataset.type;
  updateSliderRanges();
  $$('[data-type]').forEach((item) => item.classList.toggle('selected', item === button));
  renderProductControls();
  await applyDoorType();
}));

$$('[data-texture-face]').forEach((button) => button.addEventListener('click', async () => {
  setTextureFaceView(button.dataset.textureFace);
  renderProductControls();
  const typeChanged = reconcileType();
  applyTypeCards();
  if (typeChanged) await applyDoorType();
  else await applyLeafTextures();
}));

$$('[data-transom-type]').forEach((button) => button.addEventListener('click', async () => {
  state.transomType = button.dataset.transomType;
  state.transom = state.transomType !== 'none';
  $$('[data-transom-type]').forEach((item) => item.classList.toggle('selected', item === button));
  await applyDoorType();
}));

// Delegated handlers cover the AI-reference controls injected by
// private-configurator-tabs.js after this module has evaluated. They also
// keep the legacy engineering controls and the reference view on one state.
const referencePanel = $('.order-panel');
const syncReferenceFaceView = (target) => {
  const face = target?.closest('[data-reference-face]')?.dataset.referenceFace;
  if (face) setTextureFaceView(face);
};
referencePanel?.addEventListener('click', (event) => {
  const control = event.target.closest('[data-ref-field]');
  if (!control || control.matches('input, select, textarea')) return;
  syncReferenceFaceView(control);
  applyReferenceField(control.dataset.refField, control.dataset.refValue);
});
referencePanel?.addEventListener('change', (event) => {
  const control = event.target.closest('[data-ref-check], [data-ref-field]');
  if (!control) return;
  syncReferenceFaceView(control);
  if (control.matches('[data-ref-check]')) {
    const field = control.dataset.refCheck;
    if (field === 'transom') {
      state.transom = control.checked;
      if (control.checked && (!state.transomType || state.transomType === 'none')) state.transomType = 'square-true';
      if (!control.checked) {
        state.transomType = 'none';
        state.transomOuterGlass = '无';
        state.transomInnerGlass = '无';
      }
      applyDoorType();
      syncReferenceUi();
      syncConfigurationUi();
      return;
    }
    state[field] = control.checked;
    if (field === 'thresholdLightEnabled' && control.checked) state.threshold = state.threshold.includes('氛围灯') ? state.threshold : '底槛氛围灯';
    if (field === 'thresholdDrainEnabled' && control.checked) state.threshold = state.threshold.includes('排水') ? state.threshold : '底槛内排水';
    if (field === 'wallLightEnabled' && control.checked && state.wallIntegrated === 'none') state.wallIntegrated = 'LMQ-M';
    void refreshRealtimePreview({ focus: field === 'frameAtmosphereLightEnabled' ? 'hardware' : 'frame' });
    syncReferenceUi();
    syncConfigurationUi();
    return;
  }
  if (control.matches('select')) applyReferenceField(control.dataset.refField, control.value);
});
referencePanel?.addEventListener('focusin', (event) => syncReferenceFaceView(event.target));
referencePanel?.addEventListener('input', (event) => {
  const control = event.target.closest('[data-ref-field]');
  if (!control || !control.matches('input, textarea')) return;
  applyReferenceField(control.dataset.refField, control.value);
});

$$('[data-lock]').forEach((button) => button.addEventListener('click', () => {
  state.lock = button.dataset.lock;
  state.lockPanelCode = state.lock === 'none' ? 'none' : productHardwareDefaults().lockPanelCode;
  if (state.lock !== 'none' && state.handle !== 'none' && !PRODUCT_META[state.product].allowLockWithHandle) state.handle = 'none';
  applyHardware();
  setCameraFocus('hardware');
  syncConfigurationUi();
}));

$$('[data-handle]').forEach((button) => button.addEventListener('click', () => {
  state.handle = button.dataset.handle;
  state.handleCode = state.handle === 'none' ? 'none' : state.handle === 'long' ? productHardwareDefaults().handleCode : state.handle;
  if (state.handle !== 'none' && state.lock !== 'none' && !PRODUCT_META[state.product].allowLockWithHandle) state.lock = 'none';
  applyHardware();
  setCameraFocus('hardware');
  syncConfigurationUi();
}));

$$('[data-integrated-light-enabled]').forEach((button) => button.addEventListener('click', () => {
  state.integratedLightEnabled = button.dataset.integratedLightEnabled === 'true';
  applyIntegratedHandleLighting();
  syncIntegratedLightUi();
}));

$$('[data-integrated-light-color]').forEach((button) => button.addEventListener('click', () => {
  state.integratedLightColor = button.dataset.integratedLightColor;
  applyIntegratedHandleLighting();
  syncIntegratedLightUi();
}));

$('#integratedLightIntensitySlider')?.addEventListener('input', (event) => {
  state.integratedLightIntensity = Number(event.target.value);
  applyIntegratedHandleLighting();
  setCameraFocus('hardware');
  syncIntegratedLightUi();
});

$$('[data-ring-light-enabled]').forEach((button) => button.addEventListener('click', () => {
  state.ringLightEnabled = button.dataset.ringLightEnabled === 'true';
  applyK80QinghuafuRingLighting();
  syncQinghuafuRingLightUi();
}));

$$('[data-ring-light-color]').forEach((button) => button.addEventListener('click', () => {
  state.ringLightColor = button.dataset.ringLightColor;
  applyK80QinghuafuRingLighting();
  syncQinghuafuRingLightUi();
}));

$('#ringLightIntensitySlider')?.addEventListener('input', (event) => {
  state.ringLightIntensity = Number(event.target.value);
  applyK80QinghuafuRingLighting();
  setCameraFocus('hardware');
  syncQinghuafuRingLightUi();
});

$$('[data-opening]').forEach((button) => button.addEventListener('click', () => {
  state.opening = button.dataset.opening;
  $$('[data-opening]').forEach((item) => item.classList.toggle('selected', item === button));
  // Rebuild hardware immediately. Without this call the GLB keeps the
  // product's default lock leaf until another unrelated option changes.
  applyHardware();
  applyOpeningDetails();
  setCameraFocus('hardware');
  syncConfigurationUi();
  if (state.open) $('#doorPoseReadout').textContent = `${state.opening.endsWith('left') ? '左锁' : '右锁'}门扇开启 78° · 合页轴转动`;
}));

$$('[data-hinge]').forEach((button) => button.addEventListener('click', () => {
  state.hinge = button.dataset.hinge;
  state.hingeCode = state.hinge === 'k80-five-axis' ? 'K80全钢五轴合页' : state.hinge === 'k80-external' ? 'K80外合页' : 'K80单轴暗合页';
  $$('[data-hinge]').forEach((item) => item.classList.toggle('selected', item === button));
  focusHardwareConfiguration('hinge');
  syncConfigurationUi();
}));

$$('[data-frame-install]').forEach((button) => button.addEventListener('click', () => {
  state.frameInstall = button.dataset.frameInstall;
  $$('[data-frame-install]').forEach((item) => item.classList.toggle('selected', item === button));
  applyFrameInstallation();
  syncConfigurationUi();
  setCameraFocus('frame-top');
}));

$$('[data-frame-build]').forEach((button) => button.addEventListener('click', () => {
  state.frameBuild = button.dataset.frameBuild;
  $$('[data-frame-build]').forEach((item) => item.classList.toggle('selected', item === button));
  if (frameGroup) frameGroup.userData.buildMethod = state.frameBuild;
  void refreshRealtimePreview({ focus: 'frame-top' });
}));

$('#wallThicknessSlider')?.addEventListener('input', (event) => {
  state.wallThickness = Number(event.target.value);
  // Wall thickness is judged on the depth axis. Switch once when dragging
  // starts and retain the side pose while the user continues adjusting.
  if (state.view !== 'side' || activeCameraFocus) setView('side');
  void refreshRealtimePreview();
});

$('#widthSlider').addEventListener('input', async (event) => {
  state.width = Number(event.target.value);
  await applyDoorType({ fitCamera: false });
  refitActiveCamera();
});

$('#heightSlider').addEventListener('input', async (event) => {
  state.height = Number(event.target.value);
  await applyDoorType({ fitCamera: false });
  refitActiveCamera();
});

$$('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

$('#toggleDoorOpen').addEventListener('click', () => {
  setDoorOpenState(!state.open);
});

$('#toggleGrid')?.addEventListener('click', () => {
  grid.visible = !grid.visible;
  $('#toggleGrid').classList.toggle('active', grid.visible);
});

$('#resetView')?.addEventListener('click', () => setView('perspective'));

window.addEventListener('yadilo:reset-config-tab', async (event) => {
  const tab = event.detail?.tab || 'basic';
  const meta = PRODUCT_META[state.product];
  if (tab === 'basic') {
    state.type = meta.defaultType;
    state.frontFinish = state.product;
    state.backFinish = state.product;
    state.frontColor = COLORWAYS[state.product][0].key;
    state.backColor = COLORWAYS[state.product][0].key;
    state.textureFace = 'front';
    state.textureRegion = 'pair';
    state.frontRegionTextures = {};
    state.backRegionTextures = {};
    state.frontRegionDesigns = {};
    state.backRegionDesigns = {};
    state.textureZoom = meta.textureZoomDefault || 1;
    state.texturePanX = 0;
    state.texturePanY = 0;
    state.surfaceSeries = 'K80AL';
    const defaults = catalogReferenceDefaults(state.product);
    state.frontMaterial = defaults.frontMaterial;
    state.frontThickness = defaults.frontThickness;
    state.frontProcess = defaults.frontProcess;
    state.frontTextureLabel = defaults.frontTextureLabel;
    state.backMaterial = defaults.backMaterial;
    state.backThickness = defaults.backThickness;
    state.backProcess = defaults.backProcess;
    state.backTextureLabel = defaults.backTextureLabel;
    state.frontReferenceColor = defaultReferenceColorLabel(state.product, 'front');
    state.backReferenceColor = defaultReferenceColorLabel(state.product, 'back');
    state.opening = meta.defaultOpening || 'out-right';
    updateSliderRanges(true);
    $('#widthSlider').value = String(state.width);
    $('#heightSlider').value = String(state.height);
    $('#configurationNotes')?.value && ($('#configurationNotes').value = '');
    if ($('#configurationNotesCount')) $('#configurationNotesCount').textContent = '0';
    renderProductControls();
    applyTypeCards();
    syncChoiceButtons();
    updateTextureUi();
    await applyDoorType();
    return;
  }
  if (tab === 'frame') {
    const casingDefaults = defaultCasingColorLabels(state.product);
    state.wallThickness = 240;
    state.frameInstall = 'center';
    state.frameBuild = 'integral';
    state.outerCasing = 'P40';
    state.outerCasingColor = casingDefaults.outer;
    state.innerCasing = 'W型';
    state.innerCasingColor = casingDefaults.inner;
    state.frameProfile = 'P40';
    state.frameColor = 'D-22k金色';
    state.threshold = '标配底槛加高';
    state.thresholdLightEnabled = true;
    state.thresholdDrainEnabled = false;
    state.thresholdNote = '加高30mm';
    state.wallIntegrated = 'none';
    state.wallModule = 'none';
    state.wallLightEnabled = false;
    $('#wallThicknessSlider').value = '240';
    syncChoiceButtons();
    applyFrameInstallation();
    syncConfigurationUi();
    return;
  }
  if (tab === 'transom') {
    state.transom = false;
    state.transomType = 'none';
    state.transomFlowerEnabled = true;
    state.transomMainMaterial = '铝花件';
    state.transomMainThickness = '3';
    state.transomMainProcess = '浮雕';
    state.transomSecondaryStyle = '花枝';
    state.transomSecondaryThickness = '4';
    state.transomSecondaryProcess = '单面简雕镂空';
    state.transomOuterGlass = '无';
    state.transomInnerGlass = '无';
    state.transomOuterGlassThickness = '5MM';
    state.transomInnerGlassThickness = '5MM';
    syncChoiceButtons();
    await applyDoorType();
    return;
  }
  if (tab === 'hardware') {
    state.lock = meta.defaultLock;
    state.handle = meta.defaultHandle;
    state.hinge = 'k80-hidden';
    state.handleOffsetXMm = 0;
    state.handleOffsetMm = 0;
    state.handleScale = 1;
    state.lockOffsetXMm = 0;
    state.lockOffsetMm = 0;
    state.lockScale = 1;
    const hardware = PRODUCT_HARDWARE_DEFAULTS[state.product] || PRODUCT_HARDWARE_DEFAULTS.ruojian;
    state.lockPanelCode = hardware.lockPanelCode;
    state.handleCode = hardware.handleCode;
    state.sealCode = 'EPDM-江阴海达';
    state.hingeCode = 'K80单轴暗合页';
    state.frameAtmosphereLightEnabled = true;
    normalizeK80HardwareState();
    syncChoiceButtons();
    applyHardware();
    applyHandlePosition();
    applyLockPosition();
    syncConfigurationUi();
  }
});

$('#handlePositionSlider')?.addEventListener('input', (event) => {
  state.handleOffsetMm = Number(event.target.value);
  applyHandlePosition();
  setCameraFocus('hardware');
});

$('#handleHorizontalSlider')?.addEventListener('input', (event) => {
  state.handleOffsetXMm = Number(event.target.value);
  applyHandlePosition();
  setCameraFocus('hardware');
});

$('#handleScaleSlider')?.addEventListener('input', (event) => {
  state.handleScale = Number(event.target.value);
  applyHandlePosition();
  setCameraFocus('hardware');
});

$('#lockPositionSlider')?.addEventListener('input', (event) => {
  state.lockOffsetMm = Number(event.target.value);
  applyLockPosition();
  setCameraFocus('hardware');
});

$('#lockHorizontalSlider')?.addEventListener('input', (event) => {
  state.lockOffsetXMm = Number(event.target.value);
  applyLockPosition();
  setCameraFocus('hardware');
});

$('#lockScaleSlider')?.addEventListener('input', (event) => {
  state.lockScale = Number(event.target.value);
  applyLockPosition();
  setCameraFocus('hardware');
});

const updateTextureUi = () => {
  const zoom = $('#textureZoomSlider');
  const panX = $('#texturePanXSlider');
  const panY = $('#texturePanYSlider');
  const zoomOutput = $('#textureZoomOutput');
  const panXOutput = $('#texturePanXOutput');
  const panYOutput = $('#texturePanYOutput');
  if (zoom) zoom.value = String(state.textureZoom);
  if (panX) panX.value = String(state.texturePanX);
  if (panY) panY.value = String(state.texturePanY);
  if (zoomOutput) zoomOutput.textContent = `${Math.round(state.textureZoom * 100)}%`;
  if (panXOutput) panXOutput.textContent = `${state.texturePanX > 0 ? '+' : ''}${Math.round(state.texturePanX * 100)}%`;
  if (panYOutput) panYOutput.textContent = `${state.texturePanY > 0 ? '+' : ''}${Math.round(state.texturePanY * 100)}%`;
};

$('#textureZoomSlider')?.addEventListener('input', async (event) => {
  state.textureZoom = Number(event.target.value);
  lockTexturePanoramaView();
  updateTextureUi();
  await applyLeafTextures();
});

$('#texturePanXSlider')?.addEventListener('input', async (event) => {
  state.texturePanX = Number(event.target.value);
  lockTexturePanoramaView();
  updateTextureUi();
  await applyLeafTextures();
});

$('#texturePanYSlider')?.addEventListener('input', async (event) => {
  state.texturePanY = Number(event.target.value);
  lockTexturePanoramaView();
  updateTextureUi();
  await applyLeafTextures();
});

function updateTextureDesignUi() {
  const settings = textureDesignSettings(state.textureFace, state.textureRegion);
  const x = $('#designOffsetXSlider');
  const y = $('#designOffsetYSlider');
  const scale = $('#designScaleSlider');
  if (x) x.value = String(Math.round((settings.offsetX || 0) * 100));
  if (y) y.value = String(Math.round((settings.offsetY || 0) * 100));
  if (scale) scale.value = String(settings.scale ?? 1);
  const xOutput = $('#designOffsetXOutput');
  const yOutput = $('#designOffsetYOutput');
  const scaleOutput = $('#designScaleOutput');
  if (xOutput) xOutput.textContent = `${settings.offsetX > 0 ? '+' : ''}${Math.round((settings.offsetX || 0) * 100)}%`;
  if (yOutput) yOutput.textContent = `${settings.offsetY > 0 ? '+' : ''}${Math.round((settings.offsetY || 0) * 100)}%`;
  if (scaleOutput) scaleOutput.textContent = `${Math.round((settings.scale || 1) * 100)}%`;
}

$('#designOffsetXSlider')?.addEventListener('input', async (event) => {
  setTextureDesignSetting(state.textureFace, state.textureRegion, 'offsetX', Number(event.target.value) / 100);
  lockTexturePanoramaView();
  updateTextureDesignUi();
  await applyLeafTextures();
});

$('#designOffsetYSlider')?.addEventListener('input', async (event) => {
  setTextureDesignSetting(state.textureFace, state.textureRegion, 'offsetY', Number(event.target.value) / 100);
  lockTexturePanoramaView();
  updateTextureDesignUi();
  await applyLeafTextures();
});

$('#designScaleSlider')?.addEventListener('input', async (event) => {
  setTextureDesignSetting(state.textureFace, state.textureRegion, 'scale', Number(event.target.value));
  lockTexturePanoramaView();
  updateTextureDesignUi();
  await applyLeafTextures();
});

$('#resetTextureView')?.addEventListener('click', async () => {
  state.textureZoom = 1;
  state.texturePanX = 0;
  state.texturePanY = 0;
  lockTexturePanoramaView();
  updateTextureUi();
  await applyLeafTextures();
});

function currentSchemeDocument() {
  const frontColor = currentColorway('front', 'main');
  const backColor = currentColorway('back', 'main');
  const frontSurface = currentTextureSurface('front', 'main');
  const backSurface = currentTextureSurface('back', 'main');
  const frontDesign = currentTextureDesign('front', 'main');
  const backDesign = currentTextureDesign('back', 'main');
  const type = typeSpecs[state.type];
  const { aiScenes, ...stateConfig } = state;
  const config = {
    ...stateConfig,
    typeLabel: type?.label,
    lockLabel: OPTION_LABELS.lock[state.lock],
    handleLabel: OPTION_LABELS.handle[state.handle],
    frontColorLabel: frontColor.label,
    backColorLabel: backColor.label,
    frontTextureSurfaceLabel: frontSurface.label,
    backTextureSurfaceLabel: backSurface.label,
    frontMainDesignLabel: frontDesign?.label || '产品一体主造型',
    backMainDesignLabel: backDesign?.label || '产品一体主造型',
    surfaceSeriesLabel: state.surfaceSeries,
    frontMaterialLabel: state.frontMaterial,
    backMaterialLabel: state.backMaterial,
    outerCasingLabel: state.outerCasing,
    innerCasingLabel: state.innerCasing,
    thresholdLabel: state.threshold,
    transomLabel: OPTION_LABELS.transom[state.transomType] || state.transomType,
    lockPanelCodeLabel: state.lockPanelCode,
    handleCodeLabel: state.handleCode,
    sealCodeLabel: state.sealCode,
    hingeCodeLabel: state.hingeCode
  };
  const document = createSchemeDocument({
    id: activeSchemeId,
    series: 'K80',
    product: state.product,
    productLabel: PRODUCT_META[state.product].label,
    config,
    orderPayload: buildOrderPayload({
      series: 'K80', product: state.product, productLabel: PRODUCT_META[state.product].label,
      typeLabel: type?.label, colorLabel: frontColor.label, backColorLabel: backColor.label, state
    }),
    aiScenes
  });
  activeSchemeId = document.id;
  return document;
}

function syncChoiceButtons() {
  const choices = [
    ['[data-type]', 'type'],
    ['[data-texture-face]', 'textureFace'],
    ['[data-transom-type]', 'transomType'],
    ['[data-opening]', 'opening'],
    ['[data-hinge]', 'hinge'],
    ['[data-frame-install]', 'frameInstall'],
    ['[data-frame-build]', 'frameBuild'],
    ['[data-lock]', 'lock'],
    ['[data-handle]', 'handle']
  ];
  choices.forEach(([selector, key]) => {
    $$(selector).forEach((button) => button.classList.toggle('selected', button.dataset[key.replace('textureFace', 'textureFace')] === state[key]));
  });
}

function updateShowroomLightUi() {
  const power = $('#showroomLightPower');
  const output = $('#showroomLightIntensityOutput');
  const slider = $('#showroomLightIntensitySlider');
  if (power) {
    power.classList.toggle('active', Boolean(state.showroomLightEnabled));
    power.setAttribute('aria-pressed', String(Boolean(state.showroomLightEnabled)));
    power.textContent = state.showroomLightEnabled ? '灯带开启' : '灯带关闭';
  }
  if (slider) slider.value = String(state.showroomLightIntensity ?? 1);
  if (output) output.textContent = `${Math.round((state.showroomLightIntensity ?? 1) * 100)}%`;
  $$('[data-showroom-light]').forEach((button) => {
    button.classList.toggle('active', button.dataset.showroomLight === state.showroomLightMode);
  });
}

function updateShowroomVisibilityUi() {
  const button = $('#toggleShowroomArchitecture');
  if (!button) return;
  const visible = state.showroomVisible === true;
  button.classList.toggle('active', visible);
  button.setAttribute('aria-pressed', String(visible));
  button.textContent = visible ? '隐藏展厅' : '展厅效果';
}

function applyShowroomVisibility() {
  const visible = state.showroomVisible === true;
  showroom?.userData?.setVisible?.(visible);
  if (!visible && showroomLightPanel && !showroomLightPanel.hidden) {
    showroomLightPanel.hidden = true;
    showroomLightToggle?.setAttribute('aria-expanded', 'false');
  }
  updateShowroomVisibilityUi();
}

function applyShowroomLighting() {
  showroom?.userData?.setLighting?.({
    mode: state.showroomLightMode || 'gallery',
    intensity: Number(state.showroomLightIntensity ?? 1),
    enabled: state.showroomLightEnabled !== false
  });
  updateShowroomLightUi();
}

const showroomLightPanel = $('#showroomLightPanel');
const showroomLightToggle = $('#toggleShowroomLights');
$('#toggleShowroomArchitecture')?.addEventListener('click', () => {
  state.showroomVisible = !state.showroomVisible;
  applyShowroomVisibility();
});
showroomLightToggle?.addEventListener('click', () => {
  if (!showroomLightPanel) return;
  const opening = showroomLightPanel.hidden;
  showroomLightPanel.hidden = !opening;
  showroomLightToggle.setAttribute('aria-expanded', String(opening));
});
$('#closeShowroomLightPanel')?.addEventListener('click', () => {
  if (!showroomLightPanel) return;
  showroomLightPanel.hidden = true;
  showroomLightToggle?.setAttribute('aria-expanded', 'false');
});
$('#showroomLightPower')?.addEventListener('click', () => {
  state.showroomLightEnabled = !state.showroomLightEnabled;
  applyShowroomLighting();
});
$$('[data-showroom-light]').forEach((button) => button.addEventListener('click', () => {
  state.showroomLightMode = button.dataset.showroomLight;
  applyShowroomLighting();
}));
$('#showroomLightIntensitySlider')?.addEventListener('input', (event) => {
  state.showroomLightIntensity = Number(event.target.value);
  applyShowroomLighting();
});

async function applySavedScheme(scheme) {
  if (scheme.series !== 'K80' || scheme.product !== state.product) {
    window.alert(`该方案属于 ${scheme.series} · ${scheme.productLabel}，请从对应产品入口打开。`);
    return;
  }
  activeSchemeId = scheme.id;
  Object.assign(state, scheme.config || {});
  state.product = lockedProduct;
  const catalogDefaults = catalogReferenceDefaults(state.product);
  const productHardware = PRODUCT_HARDWARE_DEFAULTS[state.product] || PRODUCT_HARDWARE_DEFAULTS.ruojian;
  state.surfaceSeries ||= 'K80AL';
  state.frontMaterial ||= catalogDefaults.frontMaterial;
  state.frontThickness ||= catalogDefaults.frontThickness;
  state.frontProcess ||= catalogDefaults.frontProcess;
  state.frontTextureLabel ||= catalogDefaults.frontTextureLabel;
  state.backMaterial ||= catalogDefaults.backMaterial;
  state.backThickness ||= catalogDefaults.backThickness;
  state.backProcess ||= catalogDefaults.backProcess;
  state.backTextureLabel ||= catalogDefaults.backTextureLabel;
  state.frontReferenceColor ||= defaultReferenceColorLabel(state.product, 'front');
  state.backReferenceColor ||= defaultReferenceColorLabel(state.product, 'back');
  const validReferenceLabels = new Set((COLORWAYS[state.product] || []).map((item) => item.label));
  if (catalogReferenceDefaults(state.product).backReferenceColor === '选配') validReferenceLabels.add('选配');
  if (!validReferenceLabels.has(state.frontReferenceColor)) state.frontReferenceColor = defaultReferenceColorLabel(state.product, 'front');
  if (!validReferenceLabels.has(state.backReferenceColor)) state.backReferenceColor = defaultReferenceColorLabel(state.product, 'back');
  state.outerCasing ||= 'P40';
  state.outerCasingColor ||= defaultCasingColorLabels(state.product).outer;
  state.innerCasing ||= 'W型';
  state.innerCasingColor ||= defaultCasingColorLabels(state.product).inner;
  state.frameProfile ||= 'P40';
  state.frameColor ||= 'D-22k金色';
  state.threshold ||= '标配底槛加高';
  state.thresholdNote ||= '加高30mm';
  state.wallIntegrated ||= 'none';
  state.wallModule ||= 'none';
  state.transomMainMaterial ||= '铝花件';
  state.transomMainThickness ||= '3';
  state.transomMainProcess ||= '浮雕';
  state.transomSecondaryStyle ||= '花枝';
  state.transomSecondaryThickness ||= '4';
  state.transomSecondaryProcess ||= '单面简雕镂空';
  state.transomOuterGlass ||= '无';
  state.transomInnerGlass ||= '无';
  state.transomOuterGlassThickness ||= '5MM';
  state.transomInnerGlassThickness ||= '5MM';
  state.lockPanelCode ||= productHardware.lockPanelCode;
  state.handleCode ||= productHardware.handleCode;
  state.sealCode ||= 'EPDM-江阴海达';
  state.hingeCode ||= state.hinge === 'k80-five-axis' ? 'K80全钢五轴合页' : state.hinge === 'k80-external' ? 'K80外合页' : 'K80单轴暗合页';
  state.frontTextureVariant ||= state.textureVariant || 'factory';
  state.backTextureVariant ||= state.textureVariant || 'factory';
  state.frontTextureSurface ||= state.textureSurface || 'factory';
  state.backTextureSurface ||= state.textureSurface || 'factory';
  normalizeK80HardwareState();
  state.aiScenes = scheme.aiScenes || [];
  if (!supportedTypesForState().includes(state.type)) state.type = fallbackTypeForState();
  updateSliderRanges(false);
  $('#widthSlider').value = String(state.width);
  $('#heightSlider').value = String(state.height);
  $('#wallThicknessSlider').value = String(state.wallThickness);
  renderProductControls();
  applyTypeCards();
  updateTextureUi();
  syncChoiceButtons();
  applyShowroomLighting();
  applyShowroomVisibility();
  await applyDoorType();
  applyFrameInstallation();
  applyHardware();
  setView(state.view || 'perspective');
}

let productSwitchInFlight = null;
async function switchConfiguratorProduct(productKey) {
  const nextProduct = PRODUCT_ALIASES[productKey] || productKey;
  if (!PRODUCT_META[nextProduct]) return;
  if (productSwitchInFlight) await productSwitchInFlight;
  if (state.product === nextProduct) {
    window.dispatchEvent(new CustomEvent('yadilo:quick-product-changed', { detail: { product: nextProduct } }));
    return;
  }
  productSwitchInFlight = (async () => {
    const meta = PRODUCT_META[nextProduct];
    const defaults = catalogReferenceDefaults(nextProduct);
    const hardware = PRODUCT_HARDWARE_DEFAULTS[nextProduct] || PRODUCT_HARDWARE_DEFAULTS.ruojian;
    const firstColor = COLORWAYS[nextProduct]?.[0]?.key || 'graphite';
    state.product = nextProduct;
    state.frontFinish = nextProduct;
    state.backFinish = nextProduct;
    state.frontColor = firstColor;
    state.backColor = firstColor;
    state.textureVariant = 'factory';
    state.frontTextureVariant = 'factory';
    state.backTextureVariant = 'factory';
    state.textureSurface = 'factory';
    state.frontTextureSurface = 'factory';
    state.backTextureSurface = 'factory';
    state.textureFace = 'front';
    state.textureRegion = 'pair';
    state.frontRegionTextures = {};
    state.backRegionTextures = {};
    state.frontRegionDesigns = {};
    state.backRegionDesigns = {};
    state.textureZoom = meta.textureZoomDefault || 1;
    state.texturePanX = 0;
    state.texturePanY = 0;
    state.type = meta.defaultType;
    state.opening = meta.defaultOpening || 'out-right';
    state.lock = meta.defaultLock;
    state.handle = meta.defaultHandle;
    state.hinge = 'k80-hidden';
    state.transom = false;
    state.transomType = 'none';
    state.surfaceSeries = 'K80AL';
    state.frontMaterial = defaults.frontMaterial;
    state.frontThickness = defaults.frontThickness;
    state.frontProcess = defaults.frontProcess;
    state.frontTextureLabel = defaults.frontTextureLabel;
    state.backMaterial = defaults.backMaterial;
    state.backThickness = defaults.backThickness;
    state.backProcess = defaults.backProcess;
    state.backTextureLabel = defaults.backTextureLabel;
    state.frontReferenceColor = defaultReferenceColorLabel(nextProduct, 'front');
    state.backReferenceColor = defaultReferenceColorLabel(nextProduct, 'back');
    state.lockPanelCode = hardware.lockPanelCode;
    state.handleCode = hardware.handleCode;
    state.sealCode = 'EPDM-江阴海达';
    state.hingeCode = 'K80单轴暗合页';
    const casingDefaults = defaultCasingColorLabels(nextProduct);
    state.outerCasing = 'P40';
    state.outerCasingColor = casingDefaults.outer;
    state.innerCasing = 'W型';
    state.innerCasingColor = casingDefaults.inner;
    state.frameProfile = 'P40';
    state.frameColor = 'D-22k金色';
    state.threshold = '标配底槛加高';
    state.thresholdLightEnabled = true;
    state.thresholdDrainEnabled = false;
    state.thresholdNote = '加高30mm';
    state.wallIntegrated = 'none';
    state.wallModule = 'none';
    state.wallLightEnabled = false;
    state.frameAtmosphereLightEnabled = true;
    state.integratedLightEnabled = true;
    state.ringLightEnabled = true;
    state.open = false;
    if (!supportedTypesForState().includes(state.type)) state.type = fallbackTypeForState();
    normalizeK80HardwareState();
    updateSliderRanges(true);
    if ($('#widthSlider')) $('#widthSlider').value = String(state.width);
    if ($('#heightSlider')) $('#heightSlider').value = String(state.height);
    renderProductControls();
    applyTypeCards();
    updateTextureUi();
    syncChoiceButtons();
    await applyDoorType();
    applyFrameInstallation();
    applyHardware();
    applyHandlePosition();
    applyLockPosition();
    syncConfigurationUi();
    const url = new URL(window.location.href);
    url.searchParams.set('series', 'k80');
    url.searchParams.set('product', nextProduct);
    url.searchParams.delete('catalogId');
    url.searchParams.delete('from');
    window.history.replaceState({ ...(window.history.state || {}), product: nextProduct }, '', `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new CustomEvent('yadilo:quick-product-changed', { detail: { product: nextProduct, label: meta.label } }));
  })();
  try {
    await productSwitchInFlight;
  } finally {
    productSwitchInFlight = null;
  }
}

window.addEventListener('yadilo:quick-product-change', (event) => {
  switchConfiguratorProduct(event.detail?.product).catch((error) => console.error('快速选品切换失败', error));
});

function configuratorSnapshot() {
  const front = currentColorway('front', 'main');
  const back = currentColorway('back', 'main');
  const frontSurface = currentTextureSurface('front', 'main');
  const backSurface = currentTextureSurface('back', 'main');
  const frontDesign = currentTextureDesign('front', 'main');
  const backDesign = currentTextureDesign('back', 'main');
  return {
    series: 'K80', product: state.product, productName: PRODUCT_META[state.product].label,
    type: state.type, typeName: typeSpecs[state.type]?.label, width: state.width, height: state.height,
    frontColor: front.label, backColor: back.label, transom: state.transomType,
    frontTextureVariant: currentTextureVariant('front', 'main').label,
    backTextureVariant: currentTextureVariant('back', 'main').label,
    frontTextureSurface: frontSurface.label,
    backTextureSurface: backSurface.label,
    frontMainDesign: frontDesign?.label || '产品一体主造型',
    backMainDesign: backDesign?.label || '产品一体主造型',
    lock: OPTION_LABELS.lock[state.lock], handle: OPTION_LABELS.handle[state.handle],
    opening: OPTION_LABELS.opening[state.opening], hinge: state.hinge,
    wallThickness: state.wallThickness, frameInstall: OPTION_LABELS.frameInstall[state.frameInstall], frameBuild: OPTION_LABELS.frameBuild[state.frameBuild],
    surfaceSeries: state.surfaceSeries, frontMaterial: state.frontMaterial, frontProcess: state.frontProcess,
    backMaterial: state.backMaterial, backProcess: state.backProcess, outerCasing: state.outerCasing,
    innerCasing: state.innerCasing, frameProfile: state.frameProfile, threshold: state.threshold,
    thresholdLightEnabled: state.thresholdLightEnabled, thresholdDrainEnabled: state.thresholdDrainEnabled,
    transomFlowerEnabled: state.transomFlowerEnabled, transomMainProcess: state.transomMainProcess,
    lockPanelCode: state.lockPanelCode, handleCode: state.handleCode, sealCode: state.sealCode,
    atmosphereLightAllowed: referenceAtmosphereLightAllowed(),
    textureView: { zoom: state.textureZoom, panX: state.texturePanX, panY: state.texturePanY },
    showroomLighting: { mode: state.showroomLightMode, enabled: state.showroomLightEnabled, intensity: state.showroomLightIntensity }
  };
}

function getAiReferenceImage() {
  renderer.render(scene, camera);
  const source = renderer.domElement;
  if (!source.width || !source.height) return '';
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#171514';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .88);
}

initSchemeUi({ getCurrent: currentSchemeDocument, applyScheme: applySavedScheme });
initAiScene({
  getSnapshot: configuratorSnapshot,
  getReferenceImage: getAiReferenceImage,
  onResults: (results) => { state.aiScenes = results; }
});

function resize() {
  const width = Math.max(1, mount.clientWidth);
  const height = Math.max(1, mount.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', () => {
  resize();
  if (modelRoot) refitActiveCamera(true);
});

window.addEventListener('yadilo:camera-focus', (event) => {
  if (!modelRoot) return;
  setCameraFocus(event.detail?.focus || 'overview');
});

window.addEventListener('yadilo:hardware-focus', (event) => {
  if (!modelRoot) return;
  focusHardwareConfiguration(event.detail?.focus || 'hardware');
});

productInspector = initProductInspector({
  getContext: () => {
    const manifest = getTextureManifest('k80', state.frontFinish);
    const region = getTextureRegion('k80', state.frontFinish, state.type, 'main');
    const design = currentTextureDesign('front', 'main');
    return {
      productLabel: PRODUCT_META[state.product].label,
      sourceType: manifest?.base?.type,
      type: state.type,
      texturePath: getTextureMapPath('k80', state.frontFinish, region?.map || 'master'),
      designLabel: design?.label || '产品一体主造型',
      designNote: design?.note,
      width: `${state.width} mm`,
      height: `${state.height} mm`,
      wallThickness: `${state.wallThickness || 120} mm`,
      frameLabel: `${state.frameProfile || state.outerCasing || 'P40'} 门框 · ${state.outerCasing || '标准门套'}`,
      frameColor: state.frameColor || state.outerCasingColor || '当前色板',
      frameInstall: state.frameInstall === 'inside' ? '内嵌安装' : state.frameInstall === 'outside' ? '外置安装' : '居中安装',
      threshold: state.threshold || '标准底槛',
      transomLabel: OPTION_LABELS.transom[state.transomType] || '无气窗',
      transomMaterial: state.transomMainMaterial,
      transomProcess: state.transomMainProcess,
      glassThickness: state.transomOuterGlassThickness || state.transomInnerGlassThickness || '—',
      hardwareLabel: `${OPTION_LABELS.lock[state.lock] || state.lock || '锁具'} · ${OPTION_LABELS.handle[state.handle] || state.handle || '执手'}`,
      handleLabel: OPTION_LABELS.handle[state.handle] || state.handle,
      sealLabel: state.sealCode || 'EPDM-江阴海达',
      hingeLabel: state.hinge === 'k80-five-axis' ? 'K80 全钢五轴合页' : state.hinge === 'k80-external' ? 'K80 重载外合页' : 'K80 单轴暗合页',
      lockLabel: `${OPTION_LABELS.lock[state.lock]} · ${OPTION_LABELS.handle[state.handle]}`,
      lockImage: state.lock === 'smart' ? './assets/generated/hardware/references/lock-smart-v2.png' : './assets/catalog/derived/hardware/textures/arch-lock.svg'
    };
  },
  onInspect: (part, detail = {}) => {
    const focus = detail.focus || ({ hinge: 'hinge', lock: 'hardware', hardware: 'hardware', frame: 'frame', transom: 'transom', composition: 'surface', design: 'surface' }[part] || 'surface');
    if (part === 'hinge') {
      focusHardwareConfiguration('hinge');
      return;
    }
    if (['composition', 'design', 'frame', 'transom'].includes(part) && state.open) $('#toggleDoorOpen').click();
    window.setTimeout(() => setCameraFocus(focus), state.open ? 760 : 40);
  }
});

// A model part is an information entry point, not only a visual surface. Keep
// the hit test on the Three.js assembly so it follows every resized/opened
// state and also works for runtime hardware that is added after GLB loading.
const inspectorRaycaster = new THREE.Raycaster();
const inspectorPointer = new THREE.Vector2();
let inspectorPointerDown = null;
function inspectorPartForObject(object3d) {
  let node = object3d;
  while (node && node !== modelRoot) {
    const name = String(node.name || '').toLowerCase();
    if (/hinge|leafhinge|framehinge/.test(name)) return 'hinge';
    if (/lock|handle|hardware|latch|bolt|cylinder|pull|ring/.test(name)) return 'hardware';
    if (/transom|sidelight|glass|flower|ornament/.test(name)) return 'transom';
    if (/frame|casing|jamb|threshold|step|sill|gasket|seal/.test(name)) return 'frame';
    if (/doorleaf|leaf|panel|skin|front|back|design|surface/.test(name)) return 'composition';
    node = node.parent;
  }
  return 'composition';
}
renderer.domElement.addEventListener('pointerdown', (event) => {
  inspectorPointerDown = { x: event.clientX, y: event.clientY };
});
renderer.domElement.addEventListener('pointerup', (event) => {
  if (!inspectorPointerDown || !modelRoot) return;
  const moved = Math.hypot(event.clientX - inspectorPointerDown.x, event.clientY - inspectorPointerDown.y);
  inspectorPointerDown = null;
  if (moved > 6) return;
  const rect = renderer.domElement.getBoundingClientRect();
  inspectorPointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  inspectorPointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  inspectorRaycaster.setFromCamera(inspectorPointer, camera);
  const hit = inspectorRaycaster.intersectObjects(modelRoot.children, true).find((item) => item.object.visible);
  if (hit) productInspector?.inspect(inspectorPartForObject(hit.object), { preview: true });
});

window.addEventListener('yadilo:reference-ready', () => {
  syncReferenceUi();
  syncConfigurationUi();
});

renderProductControls();
// The HTML contains a default choice for the legacy demo state.  Sync it
// immediately so a product-specific default (for example 若简的外开左锁)
// is reflected before the first model frame is rendered.
syncChoiceButtons();
applyShowroomLighting();
applyShowroomVisibility();

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(.05, clock.getDelta());
  const targetAngle = state.open ? THREE.MathUtils.degToRad(state.opening.startsWith('in-') ? -78 : 78) : 0;
  openAngle = THREE.MathUtils.damp(openAngle, targetAngle, 7.5, delta);
  const openChild = openingLeafRole() === 'child';
  if (mainPivot) mainPivot.rotation.y = openChild ? 0 : openAngle;
  if (childPivot) childPivot.rotation.y = openChild ? -openAngle : 0;
  if (viewTween) {
    const tween = viewTween;
    const t = Math.min(1, (performance.now() - tween.start) / tween.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
    if (t >= 1) viewTween = null;
    // Keep damping off for the full tween frame, including its final frame.
    // OrbitControls otherwise applies one stale inertial offset immediately
    // after our pose, which produces a tiny but repeated visual pulse.
    const dampingEnabled = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = dampingEnabled;
  } else {
    controls.update();
  }
  renderer.render(scene, camera);
}

resize();
updateTextureUi();
applyHandlePosition();
loadModel();
animate();
window.dispatchEvent(new CustomEvent('yadilo:configurator-ready'));
