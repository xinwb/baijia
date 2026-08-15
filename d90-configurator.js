import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { initAiScene } from './ai-scene.js?v=20261185';
import { addVirtualShowroom } from './showroom-architecture.js?v=20260817';
import { buildOrderPayload } from './order-adapter.js';
import { createSchemeDocument } from './scheme-store.js';
import { initSchemeUi } from './scheme-ui.js';
import { initProductInspector, compositionRule } from './product-inspector.js?v=20261171';
import { getTextureManifest, getTextureMapPath, getTextureRegion, getTextureStructure } from './texture-manifest.js?v=20260813.09';
import { createTextureSurfaceCanvas, getTextureSurface, TEXTURE_SURFACES } from './texture-surfaces.js?v=20261205';
import { createTextureLayerCanvas, getTextureDesigns, getDefaultTextureDesign } from './texture-layers.js?v=20260813.37';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const mount = $('#canvasMount');
const status = $('#modelStatus');

const PRODUCTS = {
  jinqu: {
    label: '金曲', subtitle: '宝马灰 · 花絮黄铜', defaultType: 'sideLight', style: 'jinqu',
    sideLightMode: 'glass-texture',
    // The photographed right leaf is the authored metal door panel. When
    // Jinqu becomes a double door, mirror this panel onto the left leaf.
    mirrorDoubleLeaf: true,
    supportedTypes: ['sideLight'],
    image: './assets/catalog/d90/products/jinqu/front-b0012605.jpg',
    cleanTexture: './assets/catalog/derived/d90/textures/d90-jinqu-clean-ai-v1.png',
    textureParts: {
      sideMain: './assets/catalog/derived/d90/door-skins/d90-jinqu-side-main.png',
      sideLight: './assets/catalog/derived/d90/door-skins/d90-jinqu-side-light.png'
    },
    supportedLocks: ['none', 'smart'], supportedHandles: ['none'],
    allowLockWithHandle: false,
    defaultLock: 'smart', defaultHandle: 'none', defaultHardware: 'smart',
  },
  shirui: {
    label: '世瑞', subtitle: '花絮黄铜 11# · 泰蓝炽彩 8#', defaultType: 'double', style: 'shirui',
    sideLightMode: 'glass-texture',
    // The photographed prototype is a true two-leaf opening: the visual left
    // leaf is one complete glass panel and the visual right leaf is the metal
    // door leaf. It is not a side-light attached outside the door casing.
    supportedTypes: ['double'],
    sideLightMaterial: 'clear-glass',
    glassTint: 0xb9c4bb,
    doubleGlassLeft: true,
    image: './assets/catalog/d90/products/shirui/front-b0019720.jpg',
    cleanTexture: './assets/catalog/derived/d90/textures/d90-shirui-clean-ai-v1.png',
    textureParts: {
      sideMain: './assets/catalog/derived/d90/door-skins/d90-shirui-side-main.png',
      sideLight: './assets/catalog/derived/d90/door-skins/d90-shirui-side-light.png'
    },
    supportedLocks: ['none', 'smart'], supportedHandles: ['none'],
    allowLockWithHandle: false,
    defaultLock: 'smart', defaultHandle: 'none', defaultHardware: 'smart',
  },
  shicui: {
    label: '拾翠', subtitle: '雅黑 · 玉石装饰', defaultType: 'double', style: 'shicui',
    sideLightMode: 'finish',
    supportedTypes: ['double'],
    image: './assets/catalog/d90/products/shicui/front-b0020010.jpg',
    cleanTexture: './assets/catalog/derived/d90/textures/d90-shicui-clean-ai-v1.png',
    textureParts: {
      doubleLeaf: './assets/catalog/derived/d90/door-skins/d90-shicui-double-leaf.png'
    },
    doubleComposition: true,
    supportedLocks: ['none', 'smart'], supportedHandles: ['none', 'integrated'],
    allowLockWithHandle: false,
    // The photographed factory configuration has one smart lock on the main
    // leaf. The turquoise jade band is part of the authored door skin; it is
    // not a separate gold pull that should replace the product texture.
    defaultLock: 'smart', defaultHandle: 'none', defaultHardware: 'smart',
    integratedHandle: {
      roles: ['main', 'child'], orientation: 'horizontal', centerY: .98,
      width: .43, height: .090, lightWidth: .34, scale: 1,
      railColor: 0x202726, light: 0x69c9b4, intensity: .72,
      areaIntensity: .10, pointIntensity: .035
    },
  },
  aige: {
    label: '爱格', subtitle: '炫光黑 · 复古浮雕', defaultType: 'double', style: 'aige',
    sideLightMode: 'finish',
    supportedTypes: ['double'],
    image: './assets/catalog/d90/products/aige/front-b0019624.jpg',
    cleanTexture: './assets/catalog/derived/d90/door-skins/d90-aige-double-leaf.png',
    textureParts: {
      // This is one complete leaf. It is applied to both leaves, not split at
      // 50%, so the top/bottom moulding and curved relief stay intact.
      doubleLeaf: './assets/catalog/derived/d90/door-skins/d90-aige-double-leaf.png'
    },
    doubleComposition: true,
    // The Aige reference is a factory double door. The two outer rings are
    // decorative door-ring pulls, not locks; the actual lock/cylinder is a
    // single opening-leaf detail at the meeting stile.
    supportedLocks: ['none', 'smart'], supportedHandles: ['none', 'long', 'ring'],
    // Keep the lock/handle choices mutually exclusive for this product: the
    // factory composition uses the long crystal pulls and door rings, while
    // the small factory cylinder is rendered on the opening leaf only.
    allowLockWithHandle: false,
    defaultLock: 'none', defaultHandle: 'long', defaultHardware: 'long',
    // The small factory bolt/cylinder is installed exactly on the meeting
    // line of the two leaves, not inside the opening leaf. Its runtime
    // placement is solved from both pivot positions after every resize.
    factoryCylinder: { role: 'opening', y: .28, scale: 1.35, anchor: 'meeting', centerBetweenLeaves: true }
  },
  songge: {
    label: '颂歌', subtitle: '炫光黑 · 曲线门花', defaultType: 'double', style: 'songge',
    sideLightMode: 'finish',
    supportedTypes: ['double'],
    image: './assets/catalog/d90/products/songge/front-b0020126.jpg',
    cleanTexture: './assets/catalog/derived/d90/textures/d90-songge-clean-ai-v1.png',
    textureParts: {
      doubleLeaf: './assets/catalog/derived/d90/door-skins/d90-songge-double-leaf.png'
    },
    doubleComposition: true,
    supportedLocks: ['none', 'smart', 'yt82'], supportedHandles: ['none', 'ring'],
    allowLockWithHandle: true,
    // PDF 实拍是高位单枚智能锁 + 下方左右水晶圆拉手；默认不能把
    // 智能锁省略成两个普通圆钮。
    defaultLock: 'smart', defaultHandle: 'ring', defaultHardware: 'smart',
  },
  guanmin: {
    label: '冠冕', subtitle: '花繁黄铜 13# · 整体拱顶门体', defaultType: 'double', style: 'guanmin',
    // The photographed product is a paired door with an integral arched top.
    // The arch extends the same door skin; it is not a separate light panel.
    supportedTypes: ['double'],
    // The authored Guanmin crop is the visual-left half of the complete
    // opening. Keep the child leaf as-is and mirror the main leaf to rebuild
    // the real left/right symmetric pair.
    mirrorMainDoubleLeaf: true,
    dimensions: { double: { width: [1700, 2200, 1800], height: [3000, 4000, 3500] } },
    image: './assets/catalog/derived/d90/door-skins/d90-guanmin-moving-leaves-v2.png',
    cleanTexture: './assets/catalog/derived/d90/door-skins/d90-guanmin-moving-leaves-v2.png',
    textureParts: {
      // This map contains the moving rectangular leaves only. The fixed
      // transom has its own embedded photo material in the GLB.
      doubleLeaf: './assets/catalog/derived/d90/door-skins/d90-guanmin-moving-leaves-v2.png'
    },
    doubleComposition: true,
    // The blue-green round pieces in PDF p.257 are part of the door relief,
    // not two extra external ring pulls. The photographed center hardware is
    // separate from that relief and is rebuilt as the product's long pull.
    supportedLocks: ['none', 'smart', 'yt82'], supportedHandles: ['none', 'long'],
    allowLockWithHandle: false,
    defaultLock: 'none', defaultHandle: 'long', defaultHardware: 'long',
  }
};

const COLORWAYS = {
  jinqu: [
    { key: 'bmw-gray', label: '宝马灰', tint: 0xffffff, swatch: '#67696a' },
    { key: 'deep-bronze', label: '深古铜', tint: 0xe7c2a1, swatch: '#5c4437' },
    { key: 'graphite', label: '石墨灰', tint: 0xc3c8ca, swatch: '#46494b' }
  ],
  shirui: [
    { key: 'brass-11', label: '花絮黄铜 11#', tint: 0xffffff, swatch: '#9a7146' },
    { key: 'blue-8', label: '泰蓝织彩 8#', tint: 0xcddbe3, swatch: '#466474' },
    { key: 'warm-brass', label: '暖黄铜', tint: 0xffdfb0, swatch: '#a87b48' }
  ],
  shicui: [
    { key: 'black', label: '雅黑', tint: 0xffffff, swatch: '#242424' },
    { key: 'graphite', label: '石墨灰', tint: 0xc5c9ca, swatch: '#4b4d4e' },
    { key: 'deep-bronze', label: '深古铜', tint: 0xd6b391, swatch: '#5a4335' }
  ],
  aige: [
    { key: 'gloss-black', label: '炫光黑', tint: 0xffffff, swatch: '#171819' },
    { key: 'green-bronze', label: '花繁青古铜', tint: 0xd7ccb4, swatch: '#5a5a4b' },
    { key: 'titanium', label: '钛灰', tint: 0xc5ccd0, swatch: '#656a6d' }
  ],
  songge: [
    { key: 'gloss-black', label: '炫光黑', tint: 0xffffff, swatch: '#171819' },
    { key: 'graphite', label: '石墨灰', tint: 0xc2c6c8, swatch: '#4c4f50' },
    { key: 'deep-bronze', label: '深古铜', tint: 0xd6b08b, swatch: '#5b4234' }
  ],
  guanmin: [
    { key: 'brass-13', label: '花繁黄铜 13#', tint: 0xffffff, swatch: '#9b744a' },
    { key: 'deep-bronze', label: '深古铜', tint: 0xddb895, swatch: '#5e4535' },
    { key: 'antique-gold', label: '旧金', tint: 0xf0d0a0, swatch: '#7b6344' }
  ]
};
const TEXTURE_VARIANTS = [
  { key: 'factory', label: '原厂纹理', note: '保持实拍的金属反射', filter: 'none', roughness: .27, metalness: .70, bumpScale: .007, clearcoat: .28 },
  { key: 'relief', label: '浮雕强化', note: '增强凹凸与细纹层次', filter: 'contrast(1.08) saturate(1.06)', roughness: .22, metalness: .78, bumpScale: .013, clearcoat: .34 },
  { key: 'matte', label: '哑光拉丝', note: '降低高光，突出拉丝方向', filter: 'contrast(.94) saturate(.92)', roughness: .36, metalness: .58, bumpScale: .010, clearcoat: .16 }
];
const requestedProduct = new URLSearchParams(location.search).get('product') || 'shirui';
const lockedProduct = PRODUCTS[requestedProduct] ? requestedProduct : 'shirui';
const defaultHardware = PRODUCTS[lockedProduct].defaultHardware;
const defaultLock = PRODUCTS[lockedProduct].defaultLock
  ?? (defaultHardware === 'smart' ? 'smart' : 'none');
const defaultHandle = PRODUCTS[lockedProduct].defaultHandle
  ?? (['long', 'ring', 'integrated'].includes(defaultHardware) ? defaultHardware : 'none');

// Each product has its own real hardware datum. The source photos are used
// only as hardware-free door-skin maps; locks, pulls and cylinders are always
// separate GLB parts. `roles` prevents a single-leaf lock from being copied to
// the child leaf, while `anchor` keeps outer decorative rings on the hinge
// side instead of moving them with the meeting stile.
const HARDWARE_PROFILES = {
  jinqu: {
    smart: { roles: ['main'], centerY: 1.05, auxRoles: ['main'], auxY: .80 },
    yt82: { roles: ['main'], centerY: 1.00 },
    long: { roles: ['main'], centerY: 1.05 },
    ring: { roles: ['main'], centerY: .99 },
    concealed: { roles: ['main'], centerY: 1.00 }
  },
  shirui: {
    smart: { roles: ['main'], centerY: 1.07, auxRoles: ['main'], auxY: .82 },
    yt82: { roles: ['main'], centerY: 1.02 },
    long: { roles: ['main'], centerY: 1.05 },
    integrated: { roles: ['main'], centerY: 1.02 },
    ring: { roles: ['main'], centerY: 1.00 },
    concealed: { roles: ['main'], centerY: 1.01 }
  },
  shicui: {
    // The photographed door has one main-leaf smart lock and one lower
    // cylinder, not two full smart locks mirrored across the pair.
    smart: { roles: ['main'], centerY: .96, auxRoles: ['main'], auxY: .64 },
    yt82: { roles: ['main'], centerY: .91 },
    long: { roles: ['main'], centerY: 1.05 },
    integrated: { roles: ['main', 'child'], centerY: .98 },
    ring: { roles: ['main'], centerY: .86 },
    concealed: { roles: ['main'], centerY: .94 }
  },
  aige: {
    // The real Aige double door has one lock on the opening leaf. The outer
    // circles are decorative door rings and must never be treated as locks.
    smart: { roles: ['main'], centerY: .99, auxRoles: ['main'], auxY: .78 },
    yt82: { roles: ['main'], centerY: .94 },
    // The source photos show slim, nearly full-height silver pulls at the
    // meeting stiles. The authored GLB is about 0.965 m tall, so do not use
    // the old .58 scale which made them look like short white U-bars.
    long: {
      roles: ['main', 'child'], centerY: 1.04, scale: 1,
      // Aige uses the real product's slim surface-mounted shaft. The generic
      // U-shaped pull in the shared GLB is hidden and replaced at runtime;
      // keep the custom geometry at its authored physical scale.
      scaleXYZ: [1, 1, 1],
      anchor: 'meeting', meetingInsetX: .10,
      appearance: 'aige-crystal-handle', extras: ['ring']
    },
    // These are the two outer decorative door rings from the product photo,
    // anchored to each hinge-side stile and scaled down to their real size.
    ring: { roles: ['main', 'child'], centerY: 1.50, scale: .82, anchor: 'hinge', anchorOffsetX: .19, appearance: 'aige-ring-ornament' },
    integrated: { roles: ['main'], centerY: 1.04 },
    concealed: { roles: ['main'], centerY: .98 }
  },
  songge: {
    // Songge uses one central smart lock and two small round cylinders.
    // In the photographed elevation the smart lock is above the paired
    // lower cylinders; the old shared datum put all three too low.
    // The photographed smart lock sits in the upper half of the leaf; the
    // old shared datum left it visibly too low. Keep the auxiliary cylinders
    // in the lower curve band, but raise the lock independently.
    smart: { roles: ['main'], centerY: 1.30, auxRoles: ['main', 'child'], auxY: .96 },
    yt82: { roles: ['main'], centerY: .98 },
    long: { roles: ['main', 'child'], centerY: 1.05 },
    // The two lower crystal cylinders sit just below the photographed curve
    // line, around 62% of the finished leaf height.
    ring: { roles: ['main', 'child'], centerY: .94, scale: .75, appearance: 'songge-crystal' },
    concealed: { roles: ['main'], centerY: 1.00 }
  },
  guanmin: {
    long: { roles: ['main', 'child'], centerY: 1.26, scale: .56, appearance: 'guanmin-crystal' },
    smart: { roles: ['main'], centerY: .92, auxRoles: ['main'], auxY: .70 },
    yt82: { roles: ['main'], centerY: .87 },
    ring: { roles: ['main', 'child'], centerY: .82, scale: .66, appearance: 'guanmin-crystal' },
    concealed: { roles: ['main'], centerY: .91 }
  }
};

const TYPE_SPECS = {
  single: { label: '单门', width: [900, 1300, 1000], height: [2200, 3000, 2400], mainRatio: 1 },
  mother: { label: '子母门', width: [1100, 1700, 1300], height: [2300, 3100, 2600], mainRatio: .66 },
  double: { label: '对开门', width: [1800, 2400, 2100], height: [2300, 3200, 2600], mainRatio: .5 },
  sideLight: { label: '单边边门', width: [1600, 2300, 1900], height: [2300, 3100, 2600], mainRatio: 1, sideCount: 1 },
  doubleSide: { label: '双边边门', width: [2400, 3600, 3000], height: [2300, 3200, 2600], mainRatio: .5, sideCount: 2 }
};

function dimensionSpecFor(type = state.type) {
  return { ...TYPE_SPECS[type], ...(PRODUCTS[state.product]?.dimensions?.[type] || {}) };
}

const hasChildLeafType = (type = state.type) => ['mother', 'double', 'doubleSide'].includes(type);
const hasSideLightType = (type = state.type) => ['sideLight', 'doubleSide'].includes(type);
const UNIVERSAL_DOOR_TYPES = ['single', 'mother', 'double'];

const state = {
  product: lockedProduct,
  frontProduct: lockedProduct,
  backProduct: lockedProduct,
  frontColor: COLORWAYS[lockedProduct][0].key,
  backColor: COLORWAYS[lockedProduct][0].key,
  textureVariant: 'factory',
  frontTextureVariant: 'factory',
  backTextureVariant: 'factory',
  textureSurface: 'factory',
  frontTextureSurface: 'factory',
  backTextureSurface: 'factory',
  textureFace: 'front',
  // Start paired door products in the real-world synchronized edit mode.
  // Individual leaf channels are created only after the customer explicitly
  // selects the left or right leaf and changes a value there.
  textureRegion: 'pair',
  frontRegionTextures: {},
  backRegionTextures: {},
  frontRegionDesigns: {},
  backRegionDesigns: {},
  type: PRODUCTS[lockedProduct].defaultType,
  lock: defaultLock,
  handle: defaultHandle,
  opening: 'out-right',
  hinge: 'd90-hidden',
  wallThickness: 240,
  frameInstall: 'center',
  frameBuild: 'integral',
  width: 2100,
  height: 2600,
  textureZoom: 1,
  texturePanX: 0,
  texturePanY: 0,
  handleOffsetXMm: 0,
  handleOffsetMm: 0,
  handleScale: 1,
  lockOffsetXMm: 0,
  lockOffsetMm: 0,
  lockScale: 1,
  // 世瑞目录实拍为通透/反射玻璃；磨砂只是可选材质，不能作为默认。
  shiruiGlassMaterial: 'clear',
  shiruiGlassTransparency: 84,
  shiruiGlassFrost: 8,
  shiruiGlassLightEnabled: false,
  shiruiGlassLightColor: 'warm-white',
  shiruiGlassLightIntensity: 1,
  open: false,
  view: 'perspective',
  aiScenes: []
};

// Preserve the door form chosen in the guided selector. D90 still applies its
// product-specific supportedTypes fallback during normalisation, but a valid
// selector value should be the initial state and its own dimension midpoint.
const requestedType = new URLSearchParams(location.search).get('type');
if (requestedType && TYPE_SPECS[requestedType] && PRODUCTS[lockedProduct].supportedTypes.includes(requestedType)) {
  state.type = requestedType;
  state.width = TYPE_SPECS[requestedType].width[2];
  state.height = TYPE_SPECS[requestedType].height[2];
}

const BASE = {
  width: 1.38,
  height: 2.60,
  jamb: .082,
  head: .082,
  threshold: .045,
  gap: .012,
  sideLight: .405,
  leafThickness: .090
};

// D90 product maps include a finite overscan band so a taller opening reveals
// more of the authored finish instead of stretching the photographed pattern.
// Leave enough bleed to reveal additional real-material field after a width
// or height change. The authored relief itself remains at its source density.
const TEXTURE_OVERSCAN = { x: 2.0, y: 1.50 };

// Most D90 references use the shared black galvanized frame. Guanmin is the
// exception: the arched casing and structural frame are finished in the same
// antique-bronze family as the door. Keep this product finish independent
// from the door-skin tint so frame/casing dimensions stay physically fixed.
const PRODUCT_FRAME_FINISH = {
  guanmin: { frame: 0x806039, casing: 0x654629, edge: 0xb58a50 }
};

const SHIRUI_GLASS_MATERIALS = {
  clear: { label: '通透玻璃', tint: 0xd9e8e3, roughness: .12, transmission: .78, clearcoat: .34 },
  frosted: { label: '细磨砂', tint: 0xb9c4bb, roughness: .52, transmission: .28, clearcoat: .10 },
  smoke: { label: '烟灰玻璃', tint: 0x586866, roughness: .26, transmission: .46, clearcoat: .22 },
  teal: { label: '茶青玻璃', tint: 0x71958c, roughness: .34, transmission: .40, clearcoat: .18 }
};

const SHIRUI_GLASS_LIGHTS = {
  amber: { label: '琥珀', value: 0xffae58 },
  gold: { label: '香槟', value: 0xffd18b },
  'warm-white': { label: '暖白', value: 0xffefd2 },
  ice: { label: '冰蓝', value: 0xbdeaff }
};

const SHIRUI_GLASS_LIGHT_NAME = 'ShiruiGlassEdgeLight';

const HARDWARE_BASE_Y = { long: 1.14, smart: 1.13, yt82: 1.02, ring: 1.16, concealed: 1.11, integrated: 1.04, aux: .84 };
const HARDWARE_GROUPS = { long: 'Long', smart: 'Smart', yt82: 'RoundLock', ring: 'Ring', concealed: 'Concealed', integrated: 'Integrated' };

RectAreaLightUniformsLib.init();
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
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
controls.dampingFactor = .075;
controls.enablePan = false;
controls.minDistance = .9;
controls.maxDistance = 9.5;
controls.minPolarAngle = .66;
controls.maxPolarAngle = Math.PI / 2 - .018;
controls.rotateSpeed = .62;
controls.zoomSpeed = .72;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .035).texture;
pmrem.dispose();

const hemi = new THREE.HemisphereLight(0xd9e5ee, 0x1b2228, 1.26);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe5c9, 3.95);
key.position.set(-3.8, 5.8, 4.6);
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
const fill = new THREE.DirectionalLight(0xa8c7e8, 1.22);
fill.position.set(4.2, 3.5, 2.0);
scene.add(fill);
const rim = new THREE.SpotLight(0xf4bb7d, 27, 9, Math.PI / 5, .72, 1.1);
rim.position.set(1.6, 4.2, -3.4);
rim.target.position.set(0, 1.35, 0);
scene.add(rim, rim.target);

// Architectural softboxes produce long specular bands on the metal door,
// frame, lock and handle instead of the hard plastic look of point lighting.
const softboxKey = new THREE.RectAreaLight(0xffe6cf, 5.4, 2.6, 4.8);
softboxKey.position.set(-2.8, 3.5, -3.1);
softboxKey.lookAt(0, 1.35, 0);
scene.add(softboxKey);
const softboxFill = new THREE.RectAreaLight(0xbad8ee, 3.1, 1.1, 3.8);
softboxFill.position.set(3.0, 2.6, -.9);
softboxFill.lookAt(0, 1.40, 0);
scene.add(softboxFill);
const ceilingStrip = new THREE.RectAreaLight(0xfff4e7, 2.1, 3.4, .24);
ceilingStrip.position.set(-.25, 4.4, -.85);
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
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(18, 18),
  floorMaterial
);
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
backdrop.position.set(0, 3, -1.18);
backdrop.receiveShadow = true;
scene.add(backdrop);
const showroom = addVirtualShowroom({
  THREE,
  scene,
  backdrop,
  product: lockedProduct,
  series: 'd90',
  floorMaterial,
  floorReflection,
  lights: { hemi, key, fill, rim, softboxKey, softboxFill, ceilingStrip }
});

// Keep the configurable assembly slightly in front of the showroom wall so
// the casing casts a readable gap/shadow instead of looking pasted onto the
// background. This only changes scene placement; door-part relationships and
// texture coordinates stay in the GLB's local space.
const SHOWROOM_DOOR_FORWARD_OFFSET = .22;

let modelRoot = null;
let mainPivot = null;
let childPivot = null;
let frameGroup = null;
let casingGroup = null;
let transomGroup = null;
let sideLightGroup = null;
let sideLightGroupRight = null;
let currentLayout = null;
let openAngle = 0;
let viewTween = null;
let activeCameraFocus = null;
let activeSchemeId = null;
let productInspector = null;
const textureCache = new Map();
const textureLoader = new THREE.TextureLoader();
const LOCK_SIDE_TEXTURE_PATH = './assets/catalog/derived/hardware/textures/smart-lock-ai-v1.png';
const AIGE_FRAME_SKIN_PATH = './assets/catalog/derived/d90/textures/d90-aige-clean-ai-v1.png';
let lockSideTexturePromise = null;
let aigeFrameSkinPromise = null;
const ASSET_VERSION = '20260813.08';
const TEXTURE_LOAD_ATTEMPTS = 3;
const MODEL_LOAD_ATTEMPTS = 3;
const MODEL_LOAD_TIMEOUT_MS = 45000;
const D90_ARCH_RISE = .550;
const D90_GUANMIN_TRANSOM_H = 0;
const D90_MODEL_BY_PRODUCT = {
  guanmin: './assets/models/d90-guanmin-transom-double-door.glb'
};
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
// Dimension sliders emit a burst of input events. Keep texture binding
// revisioned so an older async image load cannot restore a stale UV window
// after the door has already been resized.
let textureBindRevision = 0;

function assetUrl(path) {
  return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function rememberBase(node) {
  node.userData.runtimeBase = { position: node.position.clone(), scale: node.scale.clone(), rotation: node.rotation.clone() };
}

function restoreBase(node) {
  const base = node.userData.runtimeBase;
  if (!base) return;
  node.position.copy(base.position);
  node.scale.copy(base.scale);
  node.rotation.copy(base.rotation);
}

function object(name) {
  return modelRoot?.getObjectByName(name) || null;
}

function rememberD90HardwareScaleAnchors() {
  ['Main', 'Child'].forEach((label) => {
    ['Smart', 'RoundLock', 'Concealed', 'Long', 'Ring', 'Integrated', 'AuxCylinder'].forEach((groupName) => {
      const group = object(`${label}Hardware_${groupName}`);
      const parent = group?.parent;
      if (!group || !parent) return;
      group.updateWorldMatrix(true, true);
      const center = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
      parent.updateWorldMatrix(true, true);
      // Store the fitting centre in the group's own local coordinates. The
      // parent-local point changes when the fitting is repositioned (for
      // example the Aige factory bolt on the meeting stile), while this local
      // point remains the correct pivot for every later scale operation.
      group.userData.scaleAnchor = group.worldToLocal(center);
    });
  });
}

function setVisibility(object3d, visible) {
  if (object3d) object3d.visible = visible;
}

function makePhysicalMaterial(source, options = {}) {
  const color = options.color?.clone?.() || source?.color?.clone?.() || new THREE.Color(0xffffff);
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: options.metalness ?? source?.metalness ?? .62,
    roughness: options.roughness ?? source?.roughness ?? .26,
    clearcoat: options.clearcoat ?? .22,
    clearcoatRoughness: options.clearcoatRoughness ?? .17,
    envMapIntensity: options.envMapIntensity ?? 1.55,
    specularIntensity: options.specularIntensity ?? .88,
    transmission: options.transmission ?? source?.transmission ?? 0,
    thickness: options.thickness ?? source?.thickness ?? 0,
    ior: options.ior ?? source?.ior ?? 1.5,
    transparent: options.transparent ?? source?.transparent ?? false,
    opacity: options.opacity ?? source?.opacity ?? 1,
    depthWrite: options.depthWrite ?? source?.depthWrite ?? true,
    side: options.side ?? source?.side ?? THREE.FrontSide
  });
}

function planarize(mesh) {
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

async function getProductTexture(productKey, part = 'master') {
  const cacheKey = `${productKey}:${part}`;
  if (textureCache.has(cacheKey)) return textureCache.get(cacheKey);
  const product = PRODUCTS[productKey];
  if (!product?.cleanTexture) throw new Error(`D90 产品 ${productKey} 缺少无五金净纹理`);
  const sourcePath = getTextureMapPath('d90', productKey, part) || product.textureParts?.[part] || product.cleanTexture;
  const promise = loadTextureWithRetry(assetUrl(sourcePath)).then((sourceTexture) => {
    const sourceImage = sourceTexture.image;
    // Product-specific maps are pre-cut into semantic regions. Guanmin's
    // moving-leaf map already excludes the fixed crown and photographed
    // handles; runtime cropping it again would remove the top blue inset and
    // distort the authored panel proportions.
    const image = sourceImage;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * TEXTURE_OVERSCAN.x);
    canvas.height = Math.round(image.height * TEXTURE_OVERSCAN.y);
    const context = canvas.getContext('2d');
    const marginX = Math.round((canvas.width - image.width) / 2);
    const marginY = Math.round((canvas.height - image.height) / 2);
    const bandX = Math.max(8, Math.round(image.width * .055));
    const bandY = Math.max(8, Math.round(image.height * .045));
    // The source door-skin files contain a very thin dark photographic edge.
    // Do not stretch that edge into the overscan area when a larger opening
    // asks for more map. Bleed from just inside the finish instead, keeping
    // the border physically thin while the real texture window expands.
    const insetX = Math.max(1, Math.round(image.width * .018));
    const insetY = Math.max(1, Math.round(image.height * .014));
    const bleedW = Math.min(bandX, image.width - insetX * 2);
    const bleedH = Math.min(bandY, image.height - insetY * 2);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, insetX, insetY, bleedW, image.height - insetY * 2, 0, marginY, marginX, image.height);
    context.drawImage(image, image.width - insetX - bleedW, insetY, bleedW, image.height - insetY * 2, marginX + image.width, marginY, marginX, image.height);
    context.drawImage(image, insetX, insetY, image.width - insetX * 2, bleedH, marginX, 0, image.width, marginY);
    context.drawImage(image, insetX, image.height - insetY - bleedH, image.width - insetX * 2, bleedH, marginX, marginY + image.height, image.width, marginY);
    context.drawImage(image, insetX, insetY, bleedW, bleedH, 0, 0, marginX, marginY);
    context.drawImage(image, image.width - insetX - bleedW, insetY, bleedW, bleedH, marginX + image.width, 0, marginX, marginY);
    context.drawImage(image, insetX, image.height - insetY - bleedH, bleedW, bleedH, 0, marginY + image.height, marginX, marginY);
    context.drawImage(image, image.width - insetX - bleedW, image.height - insetY - bleedH, bleedW, bleedH, marginX + image.width, marginY + image.height, marginX, marginY);
    context.drawImage(image, marginX, marginY);
    sourceTexture.dispose();
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

function createD90CropTexture(image, crop) {
  const width = Math.max(2, Math.round(image.width * crop.w));
  const height = Math.max(2, Math.round(image.height * crop.h));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    Math.round(image.width * crop.x), Math.round(image.height * crop.y), width, height,
    0, 0, width, height
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function getAigeFrameSkin() {
  if (aigeFrameSkinPromise) return aigeFrameSkinPromise;
  aigeFrameSkinPromise = loadTextureWithRetry(assetUrl(AIGE_FRAME_SKIN_PATH)).then((sourceTexture) => {
    const image = sourceTexture.image;
    // The clean Aige map includes the factory Greek-key surround. Use narrow
    // perimeter crops on the structural frame so the door frame keeps the
    // photographed border language while the leaf maps stay independently
    // resizable. The frame is symmetrical, but separate left/right crops keep
    // the source orientation correct on both jambs.
    const skin = {
      left: createD90CropTexture(image, { x: 0, y: 0, w: .095, h: 1 }),
      right: createD90CropTexture(image, { x: .905, y: 0, w: .095, h: 1 }),
      top: createD90CropTexture(image, { x: 0, y: 0, w: 1, h: .115 }),
      bottom: createD90CropTexture(image, { x: 0, y: .905, w: 1, h: .095 })
    };
    sourceTexture.dispose();
    return skin;
  }).catch((error) => {
    aigeFrameSkinPromise = null;
    throw error;
  });
  return aigeFrameSkinPromise;
}

function aigeFrameSkinSlot(name) {
  if (!name || name.includes('WallReturn')) return null;
  if (name.includes('Top') || name.includes('Head')) return 'top';
  if (name.includes('Threshold') || name.includes('Bottom')) return 'bottom';
  if (name.includes('Left')) return 'left';
  if (name.includes('Right')) return 'right';
  return null;
}

async function applyProductFrameSkin() {
  if (state.frontProduct !== 'aige' || !frameGroup || !casingGroup) return;
  const skin = await getAigeFrameSkin();
  [frameGroup, casingGroup].forEach((group) => {
    group.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const slot = aigeFrameSkinSlot(mesh.name);
      if (!slot) return;
      const source = mesh.userData.originalMaterial || mesh.material;
      let material = mesh.userData.aigeFrameSkinMaterial;
      if (!material) {
        material = makePhysicalMaterial(source, {
          color: new THREE.Color(0xffffff),
          metalness: .82,
          roughness: .24,
          clearcoat: .46,
          clearcoatRoughness: .10,
          envMapIntensity: 1.72,
          specularIntensity: .94
        });
        material.userData.aigeFrameSkin = true;
        mesh.userData.aigeFrameSkinMaterial = material;
      }
      planarize(mesh);
      material.map = skin[slot];
      material.bumpMap = skin[slot];
      material.bumpScale = .0032;
      material.normalScale?.set(.16, .16);
      material.needsUpdate = true;
      mesh.material = material;
    });
  });
}

function getLockSideTexture() {
  if (lockSideTexturePromise) return lockSideTexturePromise;
  lockSideTexturePromise = loadTextureWithRetry(assetUrl(LOCK_SIDE_TEXTURE_PATH)).then((sourceTexture) => {
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
  // Side finish belongs to the smart-lock housing. A flush micro-shell keeps
  // the real metal texture on the edge without producing two floating plates
  // in the normal front/three-quarter view.
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

function texturePartFor(productKey, role, type = state.type) {
  // 拾翠的中部玉石灯带是原厂门扇造型的一部分。默认必须使用包含
  // 玉石带的完整净图；如果改用 base，会把真实产品错误渲染成金色短拉手。
  if (productKey === 'shicui' && ['main', 'child'].includes(role)) return 'master';
  // Guanmin is authored as a complete arched leaf. Keep the crown, blue
  // inset, relief panels and lower medallion on one continuous door surface.
  if (productKey === 'guanmin' && ['main', 'child'].includes(role)) return 'master';
  const product = PRODUCTS[productKey];
  const manifestRegion = getTextureRegion('d90', productKey, type, role);
  if (manifestRegion?.map) return manifestRegion.map;
  if (type === 'sideLight') return role === 'side' ? 'sideLight' : 'sideMain';
  if (type === 'double' && product.doubleGlassLeft) return role === 'child' ? 'sideLight' : 'sideMain';
  if (type === 'doubleSide') return role === 'side' ? 'sideLight' : (product.doubleComposition ? 'master' : 'doubleLeaf');
  if (['mother', 'double'].includes(type) && product.doubleComposition) return 'master';
  if (['mother', 'double'].includes(type) && product.textureParts?.doubleLeaf) return 'doubleLeaf';
  return 'master';
}

function assemblyLayoutFor(type, widthMm, heightMm) {
  const width = widthMm / 1000;
  const height = heightMm / 1000;
  const opening = width - BASE.jamb * 2;
  const leafHeight = height - BASE.head - BASE.threshold;
  const spec = TYPE_SPECS[type] || TYPE_SPECS.single;
  const sideCount = spec.sideCount || 0;
  const side = sideCount ? Math.min(BASE.sideLight, opening * .34) : 0;
  const centralOpening = opening - side * sideCount;
  if (type === 'double' || type === 'doubleSide') {
    const leaf = (centralOpening - BASE.gap) / 2;
    return { main: leaf, child: leaf, side, sideLeft: side, sideRight: sideCount === 2 ? side : 0, height: leafHeight };
  }
  if (type === 'mother') {
    const main = (centralOpening - BASE.gap) * spec.mainRatio;
    return { main, child: centralOpening - BASE.gap - main, side, sideLeft: side, sideRight: 0, height: leafHeight };
  }
  if (type === 'sideLight') {
    return { main: centralOpening - BASE.gap, child: 0, side, sideLeft: side, sideRight: 0, height: leafHeight };
  }
  return { main: opening - BASE.gap, child: 0, side: 0, sideLeft: 0, sideRight: 0, height: leafHeight };
}

function textureReferenceLayoutFor(productKey, type, role, structure, regionSpec) {
  const product = PRODUCTS[productKey];
  const manifest = getTextureManifest('d90', productKey);
  // Texture density belongs to the authored product map, not to the
  // currently selected assembly. When a double door becomes a mother door,
  // the physical leaf widths change; using TYPE_SPECS[type] here would reset
  // widthScale to 1 and squeeze the whole map into each new leaf.
  const referenceType = manifest?.base?.type || product?.defaultType || type;
  const spec = TYPE_SPECS[referenceType] || TYPE_SPECS.double;
  const authoredWidth = Number(manifest?.base?.width) || spec.width[2];
  const authoredHeight = Number(manifest?.base?.height) || spec.height[2];
  const layout = assemblyLayoutFor(referenceType, authoredWidth, authoredHeight);

  // A continuous source map represents the whole authored opening. Its
  // normalized region width therefore maps to the same fraction of the
  // authored physical opening, even after the selected type changes.
  const authoredStructure = getTextureStructure('d90', productKey, referenceType);
  const pairMap = authoredStructure?.pair?.map;
  const regionMap = regionSpec?.map;
  if (pairMap && regionMap === pairMap) {
    const authoredPairWidth = (layout.main || 0) + (layout.child || 0) + BASE.gap;
    const pairRectWidth = authoredStructure.pair?.rect?.w || 1;
    const regionWidth = Math.max(.01, (regionSpec?.rect?.w || 1) / pairRectWidth);
    layout[role] = authoredPairWidth * regionWidth;
  }
  return layout;
}

// Guanmin's moving leaves contain three physically different vertical zones:
// a fixed lion relief, a quiet extensible field, and a fixed lower panel. A
// taller opening must therefore add length only to the quiet field. Rebuilding
// the canvas as a three-slice texture keeps every ornament at its authored
// millimetre size and avoids the repeated horizontal bands produced by
// revealing ordinary edge bleed outside the source photograph.
function createGuanminHeightCanvas(image, heightScale) {
  if (!image || !Number.isFinite(heightScale)) return null;
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const contentY = Math.round(sourceHeight * (1 - 1 / TEXTURE_OVERSCAN.y) / 2);
  const contentHeight = Math.round(sourceHeight / TEXTURE_OVERSCAN.y);
  const outputContentHeight = Math.max(2, Math.round(contentHeight * heightScale));
  const outputHeight = Math.max(outputContentHeight + 2, Math.round(outputContentHeight * TEXTURE_OVERSCAN.y));
  const outputY = Math.round((outputHeight - outputContentHeight) / 2);
  const topHeight = Math.round(contentHeight * .36);
  const bottomHeight = Math.round(contentHeight * .33);
  const bodyHeight = Math.max(2, contentHeight - topHeight - bottomHeight);
  const outputBodyHeight = Math.max(2, outputContentHeight - topHeight - bottomHeight);
  const bodyY = contentY + topHeight;
  const bottomY = contentY + contentHeight - bottomHeight;
  const canvas = document.createElement('canvas');
  canvas.width = sourceWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  // Fill only the unused UV margin with a quiet line from the extensible
  // field. The visible 0..1 content window is drawn exactly below.
  context.drawImage(image, 0, bodyY + Math.round(bodyHeight / 2), sourceWidth, 2, 0, 0, sourceWidth, outputHeight);
  context.drawImage(image, 0, contentY, sourceWidth, topHeight, 0, outputY, sourceWidth, topHeight);
  context.drawImage(image, 0, bodyY, sourceWidth, bodyHeight, 0, outputY + topHeight, sourceWidth, outputBodyHeight);
  context.drawImage(image, 0, bottomY, sourceWidth, bottomHeight, 0, outputY + outputContentHeight - bottomHeight, sourceWidth, bottomHeight);
  return canvas;
}

function setPhotoWindow(texture, productKey, role, leafWidth, leafHeight, config = {}) {
  const product = PRODUCTS[productKey];
  const type = config.type || state.type;
  const structure = getTextureStructure('d90', productKey, type);
  const regionSpec = config.regionSpec || getTextureRegion('d90', productKey, type, role);
  const reference = textureReferenceLayoutFor(productKey, type, role, structure, regionSpec);
  const referenceLeafWidth = role === 'side' ? reference.side : reference[role] || reference.main;
  const widthScale = THREE.MathUtils.clamp(leafWidth / Math.max(.1, referenceLeafWidth), .72, 1.45);
  const heightScale = config.physicalHeightAdapted
    ? 1
    : THREE.MathUtils.clamp(leafHeight / Math.max(.1, reference.height), .80, 1.32);
  const contentStartX = (1 - 1 / TEXTURE_OVERSCAN.x) / 2;
  const contentStartY = (1 - 1 / TEXTURE_OVERSCAN.y) / 2;
  const baseSpanX = 1 / TEXTURE_OVERSCAN.x;
  const baseSpanY = 1 / TEXTURE_OVERSCAN.y;
  const zoom = THREE.MathUtils.clamp(config.textureZoom ?? state.textureZoom, .82, 1.34);
  const sourceRect = regionSpec?.rect || { x: 0, y: 0, w: 1, h: 1 };
  const sourceX = contentStartX + sourceRect.x * baseSpanX;
  const sourceW = sourceRect.w * baseSpanX;
  const sourceY = contentStartY + sourceRect.y * baseSpanY;
  const sourceH = sourceRect.h * baseSpanY;
  // The texture is a single, finite product map. Keep its physical texel
  // density constant: a smaller leaf crops into the map and a larger leaf
  // reveals more of the overscan/map boundary. Never keep a fixed 0..1
  // window while scaling the mesh, otherwise the whole design stretches.
  let spanX;
  let x0;
  if (structure?.pair && ['child', 'main'].includes(role)) {
    // Only a source map authored as one continuous two-leaf composition may
    // be split at the centre seam. Aige, Shicui and Songge use a complete
    // single-leaf map for each leaf; splitting those maps here would crop
    // away their moulding/relief and make the pair look like one stretched
    // or partially missing door.
    const pairRect = structure?.pair?.rect || { x: 0, y: 0, w: 1, h: 1 };
    const pairX = contentStartX + pairRect.x * baseSpanX;
    const pairW = pairRect.w * baseSpanX;
    const seam = THREE.MathUtils.clamp(structure.pair.seam ?? .5, .05, .95);
    const seamX = pairX + pairW * seam;
    const authoredSpan = role === 'child' ? pairW * seam : pairW * (1 - seam);
    const desiredSpan = THREE.MathUtils.clamp(authoredSpan * widthScale / zoom, .02, role === 'child' ? seamX : 1 - seamX);
    const shiftedSeam = THREE.MathUtils.clamp(seamX + (config.texturePanX ?? state.texturePanX) * authoredSpan, desiredSpan, 1 - desiredSpan);
    spanX = desiredSpan;
    x0 = role === 'child' ? shiftedSeam - desiredSpan : shiftedSeam;
  } else {
    const baseMin = regionSpec ? sourceX : contentStartX;
    const baseWidth = regionSpec ? sourceW : baseSpanX;
    spanX = THREE.MathUtils.clamp(baseWidth * widthScale / zoom, .02, 1);
    const anchor = ['outer-edge', 'meeting-stile'].includes(regionSpec?.anchor)
      ? role === 'child' ? 'end' : 'start'
      : 'center';
    const pan = (config.texturePanX ?? state.texturePanX) * baseWidth;
    const centerX = anchor === 'start'
      ? baseMin + spanX / 2 + pan
      : anchor === 'end'
        ? baseMin + baseWidth - spanX / 2 + pan
        : baseMin + baseWidth / 2 + pan;
    x0 = THREE.MathUtils.clamp(centerX - spanX / 2, 0, 1 - spanX);
  }
  const baseMinY = regionSpec ? sourceY : contentStartY;
  const baseHeight = regionSpec ? sourceH : baseSpanY;
  const spanY = THREE.MathUtils.clamp(baseHeight * heightScale / zoom, .02, 1);
  const centerY = baseMinY + baseHeight / 2 + (config.texturePanY ?? state.texturePanY) * baseHeight;
  const y0 = THREE.MathUtils.clamp(centerY - spanY / 2, 0, 1 - spanY);
  const mirrorChild = product?.mirrorDoubleLeaf && config.type === 'double' && role === 'child';
  const mirrorMain = product?.mirrorMainDoubleLeaf && config.type === 'double' && role === 'main';
  texture.offset.set((mirrorChild || mirrorMain) ? x0 + spanX : x0, 1 - y0 - spanY);
  texture.repeat.set((mirrorChild || mirrorMain) ? -spanX : spanX, spanY);
  texture.needsUpdate = true;
}

function roleForMesh(mesh) {
  return mesh.name.includes('Child') ? 'child' : 'main';
}

function textureRegionForMesh(mesh) {
  if (/^SideLight_Right_/.test(mesh.name)) return 'sideRight';
  if (/^SideLight_/.test(mesh.name)) return 'sideLeft';
  return roleForMesh(mesh);
}

function shiruiGlassControlsAvailable() {
  return state.product === 'shirui'
    && state.type === 'double'
    && Boolean(PRODUCTS[state.product]?.doubleGlassLeft);
}

function resolvedShiruiGlassMaterial() {
  const profile = SHIRUI_GLASS_MATERIALS[state.shiruiGlassMaterial]
    || SHIRUI_GLASS_MATERIALS.frosted;
  const transparency = THREE.MathUtils.clamp(Number(state.shiruiGlassTransparency) || 68, 25, 92) / 100;
  const frost = THREE.MathUtils.clamp(Number(state.shiruiGlassFrost) || 0, 0, 100) / 100;
  return {
    ...profile,
    materialKey: Object.entries(SHIRUI_GLASS_MATERIALS).find(([, item]) => item === profile)?.[0] || 'frosted',
    transparency,
    frost,
    opacity: .25 + transparency * .65,
    roughness: THREE.MathUtils.clamp(profile.roughness + frost * .14, .06, .86),
    transmission: THREE.MathUtils.clamp(profile.transmission * (1 - frost * .16), 0, .92)
  };
}

function resolvedShiruiGlassLight() {
  const color = SHIRUI_GLASS_LIGHTS[state.shiruiGlassLightColor]
    || SHIRUI_GLASS_LIGHTS['warm-white'];
  const rawIntensity = Number(state.shiruiGlassLightIntensity);
  return {
    color: color.value,
    colorKey: Object.entries(SHIRUI_GLASS_LIGHTS).find(([, item]) => item === color)?.[0] || 'warm-white',
    intensity: THREE.MathUtils.clamp(Number.isFinite(rawIntensity) ? rawIntensity : 1, 0, 1.5),
    enabled: Boolean(state.shiruiGlassLightEnabled && shiruiGlassControlsAvailable())
  };
}

function syncShiruiGlassUi() {
  const wrapper = $('#shiruiGlassControls');
  const available = Boolean(wrapper && shiruiGlassControlsAvailable());
  if (wrapper) wrapper.hidden = !available;
  if (!available) return;
  const glass = resolvedShiruiGlassMaterial();
  const light = resolvedShiruiGlassLight();
  $$('[data-shirui-glass-material]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.shiruiGlassMaterial === glass.materialKey);
  });
  const transparencySlider = $('#shiruiGlassTransparencySlider');
  const transparencyOutput = $('#shiruiGlassTransparencyOutput');
  const frostSlider = $('#shiruiGlassFrostSlider');
  const frostOutput = $('#shiruiGlassFrostOutput');
  if (transparencySlider) transparencySlider.value = String(Math.round(glass.transparency * 100));
  if (transparencyOutput) transparencyOutput.textContent = `${Math.round(glass.transparency * 100)}%`;
  if (frostSlider) frostSlider.value = String(Math.round(glass.frost * 100));
  if (frostOutput) frostOutput.textContent = `${Math.round(glass.frost * 100)}%`;
  $$('[data-shirui-glass-light-enabled]').forEach((button) => {
    const enabled = button.dataset.shiruiGlassLightEnabled === 'true';
    button.classList.toggle('selected', enabled === Boolean(state.shiruiGlassLightEnabled));
  });
  $$('[data-shirui-glass-light-color]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.shiruiGlassLightColor === light.colorKey);
  });
  const lightSlider = $('#shiruiGlassLightIntensitySlider');
  const lightOutput = $('#shiruiGlassLightIntensityOutput');
  if (lightSlider) lightSlider.value = String(light.intensity);
  if (lightOutput) lightOutput.textContent = `${Math.round(light.intensity * 100)}%`;
}

function disposeShiruiGlassLightChildren(group) {
  group.traverse((node) => {
    if (node.isMesh || node.isLight) {
      node.geometry?.dispose?.();
      if (node.isMesh) node.material?.dispose?.();
    }
  });
  group.clear();
}

function ensureShiruiGlassLight() {
  if (!childPivot || !currentLayout?.child) return null;
  let group = childPivot.getObjectByName(SHIRUI_GLASS_LIGHT_NAME);
  if (!group) {
    group = new THREE.Group();
    group.name = SHIRUI_GLASS_LIGHT_NAME;
    group.userData.shiruiGlassLight = true;
    childPivot.add(group);
  }
  const width = Math.max(.28, currentLayout.child);
  const height = Math.max(1.2, currentLayout.height);
  const sizeChanged = Math.abs((group.userData.width || 0) - width) > .001
    || Math.abs((group.userData.height || 0) - height) > .001;
  const light = resolvedShiruiGlassLight();
  if (sizeChanged || !group.userData.built) {
    disposeShiruiGlassLightChildren(group);
    const color = new THREE.Color(light.color);
    const material = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: light.enabled ? 2.15 * light.intensity : 0,
      metalness: .08,
      roughness: .18,
      clearcoat: .24,
      clearcoatRoughness: .10,
      transparent: true,
      opacity: .84,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const insetX = Math.min(.038, width * .12);
    const insetY = Math.min(.070, height * .08);
    const bar = Math.min(.014, Math.max(.008, width * .018));
    const innerWidth = Math.max(.12, width - insetX * 2);
    const innerHeight = Math.max(.60, height - insetY * 2);
    const frontZ = BASE.leafThickness / 2 + .026;
    const addBar = (name, barWidth, barHeight, x, y) => {
      const mesh = new THREE.Mesh(createD90RoundedRectGeometry(barWidth, barHeight, .004, .003, .001), material);
      mesh.name = `${SHIRUI_GLASS_LIGHT_NAME}_${name}`;
      mesh.position.set(x, y, frontZ);
      mesh.renderOrder = 9;
      group.add(mesh);
    };
    addBar('Left', bar, innerHeight, insetX + bar / 2, height / 2);
    addBar('Right', bar, innerHeight, width - insetX - bar / 2, height / 2);
    addBar('Top', innerWidth, bar, width / 2, height - insetY - bar / 2);
    addBar('Bottom', innerWidth, bar, width / 2, insetY + bar / 2);
    const glow = new THREE.PointLight(color, light.enabled ? .34 * light.intensity : 0, .78, 2.0);
    glow.name = `${SHIRUI_GLASS_LIGHT_NAME}_Point`;
    glow.position.set(width / 2, height / 2, frontZ + .045);
    group.add(glow);
    group.userData.material = material;
    group.userData.point = glow;
    group.userData.width = width;
    group.userData.height = height;
    group.userData.built = true;
  }
  group.position.set(0, 0, 0);
  return group;
}

function applyShiruiGlassLighting() {
  const group = ensureShiruiGlassLight();
  if (!group) return;
  const light = resolvedShiruiGlassLight();
  const visible = light.enabled && childPivot?.visible;
  group.visible = Boolean(visible);
  const material = group.userData.material;
  if (material) {
    material.color.setHex(light.color);
    material.emissive.setHex(light.color);
    material.emissiveIntensity = visible ? 2.15 * light.intensity : 0;
    material.needsUpdate = true;
  }
  const point = group.userData.point;
  if (point) {
    point.color.setHex(light.color);
    point.intensity = visible ? .34 * light.intensity : 0;
    point.visible = Boolean(visible);
  }
}

async function applyTextures() {
  if (!modelRoot || !currentLayout) return;
  const revision = ++textureBindRevision;
  const layout = { ...currentLayout };
  const config = {
    type: state.type,
    textureZoom: state.textureZoom,
    texturePanX: state.texturePanX,
    texturePanY: state.texturePanY,
    layout
  };
  const jobs = [];
  modelRoot.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const leafMatch = /^DoorLeaf_(Main|Child)_(Front|Back)$/.test(mesh.name);
    const isSide = /^SideLight(?:_Right)?_Glass$/.test(mesh.name);
    if (!leafMatch && !isSide) return;
    const role = isSide ? 'side' : roleForMesh(mesh);
    const region = textureRegionForMesh(mesh);
    const face = mesh.name.endsWith('_Back') ? 'back' : 'front';
    const productKey = face === 'back' ? state.backProduct : state.frontProduct;
    const leafWidth = isSide ? layout.side : layout[role] || layout.main;
    const textureRole = region;
    const texturePart = texturePartFor(productKey, textureRole, config.type);
    const regionSpec = getTextureRegion('d90', productKey, config.type, textureRole);
    const isGlassLeaf = !isSide && config.type === 'double' && role === 'child' && PRODUCTS[productKey]?.doubleGlassLeft;
    const designSettings = !isSide && !isGlassLeaf
      ? textureDesignSettings(face, region)
      : null;
    // Use an authored base map only when the manifest explicitly provides one.
    // Otherwise createTextureLayerCanvas derives a product-local blurred
    // underlay from the same source instead of silently falling back to the
    // finished photograph and moving the whole composition twice.
    const baseTexturePath = getTextureMapPath('d90', productKey, 'base');
    const baseTexturePromise = designSettings && designSettings.key !== 'factory' && baseTexturePath
      ? getProductTexture(productKey, 'base').catch(() => null)
      : Promise.resolve(null);
    jobs.push(Promise.all([
      getProductTexture(productKey, texturePart),
      baseTexturePromise
    ]).then(([source, baseSource]) => {
      if (revision !== textureBindRevision) return;
    const sideMaterial = regionSpec?.material || PRODUCTS[productKey]?.sideLightMaterial || PRODUCTS[productKey]?.sideLightMode;
      // A missing dedicated side-light crop does not mean frosted glass. Many
      // D90 products use their own opaque metal finish on the side panel; only
      // a product/manifest entry explicitly marked frosted-glass is treated as
      // a translucent panel.
      const isFrostedGlass = (isSide || isGlassLeaf) && sideMaterial === 'frosted-glass';
      const isShiruiGlass = isGlassLeaf && productKey === 'shirui';
      const shiruiGlass = isShiruiGlass ? resolvedShiruiGlassMaterial() : null;
      const colorway = currentColorway(face, region);
      const settings = textureSettings(face, region);
      const layeredCanvas = designSettings
        ? createTextureLayerCanvas(source.image, 'd90', productKey, textureContentRegion(region), {
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
      const surfaceImage = surfaceCanvas || layeredCanvas || source.image;
      const reference = textureReferenceLayoutFor(productKey, config.type, role, getTextureStructure('d90', productKey, config.type), regionSpec);
      const physicalHeightScale = THREE.MathUtils.clamp(layout.height / Math.max(.1, reference.height), .80, 1.32);
      const physicalHeightCanvas = null;
      const surfaceTexture = physicalHeightCanvas
        ? new THREE.CanvasTexture(physicalHeightCanvas)
        : surfaceCanvas
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
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.ClampToEdgeWrapping;
      map.wrapT = THREE.ClampToEdgeWrapping;
      setPhotoWindow(map, productKey, role, leafWidth, layout.height, {
        ...config,
        regionSpec,
        physicalHeightAdapted: Boolean(physicalHeightCanvas)
      });
      const material = makePhysicalMaterial(mesh.userData.originalMaterial || mesh.material, (isFrostedGlass || isShiruiGlass) ? {
        // A glass/edge-door option must visibly carry its selected finish.
        // Use the swatch colour here; the photographed door skins use a
        // near-white albedo tint, which would wash every glass choice out.
        color: new THREE.Color(shiruiGlass?.tint ?? PRODUCTS[productKey]?.glassTint ?? colorway.swatch),
        metalness: .02,
        roughness: shiruiGlass?.roughness ?? .56,
        clearcoat: shiruiGlass?.clearcoat ?? .10,
        clearcoatRoughness: .34,
        envMapIntensity: .86,
        transmission: shiruiGlass?.transmission ?? .22,
        thickness: .014,
        ior: 1.46,
        transparent: true,
        opacity: shiruiGlass?.opacity ?? .68,
        depthWrite: false,
        side: THREE.DoubleSide
      } : {
        color: new THREE.Color(colorway.tint),
        metalness: variant.metalness,
        roughness: variant.roughness,
        clearcoat: variant.clearcoat,
        clearcoatRoughness: .15,
        envMapIntensity: 1.62,
        specularIntensity: .92
      });
      const isGuanminLeaf = productKey === 'guanmin' && !isSide;
      if (isGuanminLeaf) {
        material.transparent = true;
        material.alphaTest = .035;
        material.depthWrite = true;
        material.side = THREE.DoubleSide;
      }
      // Frosted products may still carry a blurred, product-specific map
      // (for example 世瑞's complete glass panel). Never replace it with a
      // generic frosted swatch merely because the product has no side crop.
      material.map = map;
      if (isFrostedGlass || isShiruiGlass) {
        material.bumpMap = null;
        material.normalMap = null;
      } else {
        material.bumpMap = map;
        material.bumpScale = variant.bumpScale;
        material.normalScale?.set(.18, .18);
      }
      material.userData.runtimeMaterial = true;
      if (mesh.material?.userData?.runtimeMaterial) mesh.material.dispose();
      mesh.material = material;
    }));
  });
  await Promise.all(jobs);
}

function resizeLeaf(role, pivot, width, height) {
  if (!pivot) return;
  const direction = role === 'child' ? 1 : -1;
  const baseWidth = pivot.userData.baseWidth || .58;
  const baseHeight = pivot.userData.baseHeight || 2.473;
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
    } else if (name.startsWith('D90Style_') || name.startsWith('D90PhotoMask_')) {
      part.scale.x *= width / baseWidth;
      part.scale.y *= height / baseHeight;
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
    if (index === 1) part.position.y = .28;
    if (index === 2) part.position.y = height * .52;
    if (index === 3) part.position.y = height - .28;
  });
}

function createD90RoundedRectGeometry(width, height, depth, radius, bevel = 0) {
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

function ensureAigeRealLongPull(group) {
  if (!group) return null;
  group.traverse((node) => {
    // The generic GLB pull is a large U-shaped curve. It does not match the
    // photographed Aige SL48F, which is a single slim vertical metal shaft
    // with four compact surface mounts. Hide only the legacy pull pieces;
    // the parent group is still used for the shared position/scale controls.
    if (node.name.includes('LongPull_RoundedBar') || node.name.includes('LongPull_Mount_')) node.visible = false;
    if (node.name.includes('LongPull_RecessChannel')) node.visible = false;
  });
  const existing = group.getObjectByName('AigeRealLongPull');
  if (existing) {
    existing.visible = true;
    return existing;
  }

  const root = new THREE.Group();
  root.name = 'AigeRealLongPull';
  root.userData.handleModel = '爱格 SL48F：单根细长金属拉杆、上下安装座、门面表装';
  // The GLB hardware group stores the factory datum in local leaf space. Keep
  // the custom replacement on that same meeting-stile anchor; placing it at
  // local x=0 would incorrectly put both pulls at the centre of their leaves.
  const outwardSign = group.name.startsWith('Child') ? -1 : 1;
  root.position.x = (Number(group.userData.hardwareAnchorX) || 0) + outwardSign * .065;
  const metal = new THREE.MeshPhysicalMaterial({
    color: 0xc8ced0, metalness: .97, roughness: .17,
    clearcoat: .72, clearcoatRoughness: .07, envMapIntensity: 2.2,
    specularIntensity: 1
  });
  const shadowMetal = new THREE.MeshPhysicalMaterial({
    color: 0x25282a, metalness: .84, roughness: .24,
    clearcoat: .42, clearcoatRoughness: .12, envMapIntensity: 1.55
  });
  const frontZ = BASE.leafThickness / 2;
  // The PDF/photo shows a slim pull reaching from the upper-middle to the
  // lower mounting point. Extend upward while keeping the lower mount at
  // the product's original datum; do not turn it into an oversized U-handle.
  const centerY = 1.18;
  const shaftHeight = .94;
  const shaftRadius = .020;
  const mountY = shaftHeight / 2;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftHeight, 16),
    metal
  );
  shaft.name = 'AigeRealLongPull_Shaft';
  shaft.position.set(0, centerY, frontZ + .070);
  shaft.material.flatShading = true;
  shaft.material.needsUpdate = true;
  shaft.castShadow = true;
  shaft.receiveShadow = true;

  const microHighlight = new THREE.Mesh(
    new THREE.CylinderGeometry(.0052, .0052, shaftHeight * .92, 16),
    new THREE.MeshPhysicalMaterial({
      color: 0xf1f4f4, metalness: .98, roughness: .12,
      clearcoat: .8, clearcoatRoughness: .05, envMapIntensity: 2.45
    })
  );
  microHighlight.name = 'AigeRealLongPull_ShaftHighlight';
  microHighlight.position.set(-.008, centerY, frontZ + .088);
  microHighlight.castShadow = true;

  [-1, 1].forEach((sign) => {
    const y = centerY + sign * mountY;
    const plate = new THREE.Mesh(
      createD90RoundedRectGeometry(.068, .088, .012, .009, .0015),
      shadowMetal
    );
    plate.name = `AigeRealLongPull_MountPlate_${sign < 0 ? 'Bottom' : 'Top'}`;
    plate.position.set(0, y, frontZ + .010);
    plate.castShadow = true;
    plate.receiveShadow = true;

    const bridge = new THREE.Mesh(
      createD90RoundedRectGeometry(.047, .062, .034, .008, .0015),
      shadowMetal
    );
    bridge.name = `AigeRealLongPull_Bridge_${sign < 0 ? 'Bottom' : 'Top'}`;
    bridge.position.set(0, y, frontZ + .032);
    bridge.castShadow = true;
    bridge.receiveShadow = true;

    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(.023, .023, .030, 24),
      metal
    );
    collar.name = `AigeRealLongPull_Collar_${sign < 0 ? 'Bottom' : 'Top'}`;
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, y, frontZ + .065);
    collar.castShadow = true;
    collar.receiveShadow = true;

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(.008, .008, .006, 20),
      metal
    );
    cap.name = `AigeRealLongPull_Cap_${sign < 0 ? 'Bottom' : 'Top'}`;
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0, y, frontZ + .088);
    cap.castShadow = true;

    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(.018, 18, 12),
      metal
    );
    finial.name = `AigeRealLongPull_Finial_${sign < 0 ? 'Bottom' : 'Top'}`;
    finial.position.set(0, y + sign * .058, frontZ + .060);
    finial.scale.set(.82, 1.35, .82);
    finial.castShadow = true;

    root.add(plate, bridge, collar, cap, finial);
  });
  root.add(shaft, microHighlight);
  group.add(root);
  return root;
}

function ensureAigeRealRing(group) {
  if (!group) return null;
  group.traverse((node) => {
    if (node.name.includes('RingHandle_Disc') || node.name.includes('RingHandle_Loop')) node.visible = false;
  });
  const existing = group.getObjectByName('AigeRealRing');
  if (existing) {
    existing.visible = true;
    return existing;
  }
  const root = new THREE.Group();
  root.name = 'AigeRealRing';
  root.userData.handleModel = '爱格装饰门环：银色圆环、上部玫瑰座、下部扣饰';
  root.position.x = Number(group.userData.hardwareAnchorX) || 0;
  const silver = new THREE.MeshPhysicalMaterial({
    color: 0xbfc5c6, metalness: .97, roughness: .18,
    clearcoat: .72, clearcoatRoughness: .07, envMapIntensity: 2.25,
    specularIntensity: 1
  });
  const darkSilver = new THREE.MeshPhysicalMaterial({
    color: 0x4c5051, metalness: .90, roughness: .22,
    clearcoat: .48, clearcoatRoughness: .10, envMapIntensity: 1.75
  });
  const frontZ = BASE.leafThickness / 2;
  const centerY = 1.16;
  const loop = new THREE.Mesh(new THREE.TorusGeometry(.064, .009, 16, 56), silver);
  loop.name = 'AigeRealRing_Loop';
  loop.position.set(0, centerY, frontZ + .070);
  loop.castShadow = true;
  loop.receiveShadow = true;
  const rose = new THREE.Mesh(
    createD90RoundedRectGeometry(.066, .055, .014, .011, .0015),
    darkSilver
  );
  rose.name = 'AigeRealRing_Rose';
  rose.position.set(0, centerY + .060, frontZ + .040);
  rose.castShadow = true;
  const topCap = new THREE.Mesh(new THREE.SphereGeometry(.018, 18, 12), silver);
  topCap.name = 'AigeRealRing_TopCap';
  topCap.position.set(0, centerY + .076, frontZ + .078);
  topCap.scale.set(.86, 1.18, .86);
  topCap.castShadow = true;
  const bottomClasp = new THREE.Mesh(new THREE.SphereGeometry(.013, 16, 10), silver);
  bottomClasp.name = 'AigeRealRing_BottomClasp';
  bottomClasp.position.set(0, centerY - .066, frontZ + .078);
  bottomClasp.scale.set(.82, 1.30, .82);
  bottomClasp.castShadow = true;
  root.add(loop, rose, topCap, bottomClasp);
  group.add(root);
  return root;
}

function ensureD90IntegratedGroup(label) {
  const hardware = object(`${label}Hardware`);
  const product = PRODUCTS[state.frontProduct || state.product];
  const config = product?.integratedHandle;
  if (!hardware || !config) return null;
  const name = `${label}Hardware_Integrated`;
  let group = object(name);
  if (group) return group;
  group = new THREE.Group();
  group.name = name;
  group.userData.hardwareType = 'integrated';
  const horizontal = config.orientation === 'horizontal';
  group.userData.handleModel = horizontal
    ? '横向一体凹槽灯带拉手：内凹腔体、金属压边、发光内芯'
    : '纵向全高凹槽灯带拉手：内凹腔体、金属压边、发光内芯';
  const channelMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x101214, metalness: .82, roughness: .24, clearcoat: .44,
    clearcoatRoughness: .12, envMapIntensity: 1.92, specularIntensity: 1
  });
  const cavityMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x050607, metalness: .30, roughness: .34, clearcoat: .18,
    clearcoatRoughness: .24, envMapIntensity: .82, specularIntensity: .55
  });
  const railMaterial = new THREE.MeshPhysicalMaterial({
    color: config.railColor ?? 0xb47745, metalness: .88, roughness: .20,
    clearcoat: .48, clearcoatRoughness: .10, envMapIntensity: 2.08,
    specularIntensity: 1
  });
  const lightColor = new THREE.Color(config.light ?? 0xffc78b);
  const lightMaterial = new THREE.MeshPhysicalMaterial({
    color: lightColor, emissive: lightColor, emissiveIntensity: config.intensity ?? 2.8,
    metalness: .10, roughness: .18, clearcoat: .22, transparent: true, opacity: .97,
    depthWrite: false
  });
  const grooveWidth = horizontal
    ? (config.width ?? .44)
    : (config.grooveWidth ?? config.width ?? .112);
  const grooveHeight = horizontal
    ? (config.height ?? .115)
    : (config.height ?? 2.04);
  const lightWidth = horizontal
    ? (config.lightWidth ?? grooveWidth * .76)
    : (config.lightWidth ?? grooveWidth * .26);
  const lightHeight = horizontal
    ? Math.max(.022, grooveHeight * .24)
    : Math.max(.05, grooveHeight - .15);
  const frontZ = BASE.leafThickness / 2;
  const pocket = new THREE.Mesh(
    createD90RoundedRectGeometry(grooveWidth, grooveHeight, .016, .016, .0025),
    channelMaterial
  );
  pocket.name = `${name}_RecessPocket`;
  pocket.position.z = frontZ + .005;
  pocket.castShadow = true;
  pocket.receiveShadow = true;
  const cavity = new THREE.Mesh(
    createD90RoundedRectGeometry(grooveWidth * .72, Math.max(.025, grooveHeight - .036), .008, .011, .001),
    cavityMaterial
  );
  cavity.name = `${name}_RecessCavity`;
  cavity.position.z = frontZ + .014;
  cavity.receiveShadow = true;
  const railWidth = horizontal ? Math.max(.04, grooveWidth - .078) : .012;
  const railHeight = horizontal ? .012 : Math.max(.05, grooveHeight - .078);
  [-1, 1].forEach((side) => {
    const rail = new THREE.Mesh(
      createD90RoundedRectGeometry(railWidth, railHeight, .018, .004, .001),
      railMaterial
    );
    rail.name = `${name}_MetalRail_${side < 0 ? 'Left' : 'Right'}`;
    rail.position.set(
      horizontal ? 0 : side * (grooveWidth / 2 - railWidth / 2 - .006),
      horizontal ? side * (grooveHeight / 2 - railHeight / 2 - .006) : 0,
      frontZ + .029
    );
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  });
  const lightBar = new THREE.Mesh(
    createD90RoundedRectGeometry(lightWidth, lightHeight, .010, .004, .0012),
    lightMaterial
  );
  lightBar.name = `${name}_IntegratedLightBar`;
  lightBar.position.z = frontZ + .040;
  const capMaterial = new THREE.MeshPhysicalMaterial({ color: lightColor, metalness: .78, roughness: .20, clearcoat: .28, envMapIntensity: 1.76 });
  const capWidth = horizontal ? .026 : grooveWidth * .68;
  const capHeight = horizontal ? grooveHeight * .68 : .026;
  [-1, 1].forEach((sign) => {
    const cap = new THREE.Mesh(
      createD90RoundedRectGeometry(capWidth, capHeight, .018, .008, .0015),
      capMaterial
    );
    cap.name = `${name}_EndCap_${horizontal ? (sign < 0 ? 'Left' : 'Right') : (sign < 0 ? 'Bottom' : 'Top')}`;
    cap.position.set(
      horizontal ? sign * (grooveWidth / 2 - .026) : 0,
      horizontal ? 0 : sign * (grooveHeight / 2 - .026),
      frontZ + .047
    );
    cap.castShadow = true;
    group.add(cap);
  });
  const areaLight = new THREE.RectAreaLight(
    lightColor,
    config.areaIntensity ?? .74,
    horizontal ? grooveWidth * .80 : lightWidth * 1.8,
    horizontal ? lightHeight * 1.8 : grooveHeight * .80
  );
  areaLight.name = `${name}_IntegratedAreaGlow`;
  areaLight.position.set(0, 0, frontZ + .064);
  areaLight.lookAt(0, 0, 0);
  const glow = new THREE.PointLight(lightColor, config.pointIntensity ?? .30, .72, 2.1);
  glow.name = `${name}_IntegratedGlow`;
  glow.position.set(0, 0, frontZ + .078);
  group.add(pocket, cavity, lightBar, areaLight, glow);
  hardware.add(group);
  group.userData.runtimeBase = {
    position: new THREE.Vector3(0, HARDWARE_BASE_Y.integrated, 0),
    scale: new THREE.Vector3(config.scale ?? 1, config.scale ?? 1, config.scale ?? 1),
    rotation: new THREE.Euler()
  };
  group.userData.profileScale = group.userData.runtimeBase.scale.clone();
  return group;
}

function updateD90IntegratedBase(label, group, leafWidth) {
  const product = PRODUCTS[state.frontProduct || state.product];
  const config = product?.integratedHandle;
  if (!group || !config) return;
  const role = label.toLowerCase();
  const inset = .021;
  const anchorX = config.orientation === 'horizontal'
    ? 0
    : (role === 'main' ? -leafWidth / 2 + inset : leafWidth / 2 - inset);
  group.userData.runtimeBase.position.set(anchorX, HARDWARE_BASE_Y.integrated, 0);
  group.userData.runtimeBase.scale.setScalar(config.scale ?? 1);
}

function normalizeD90HardwareState() {
  // Legacy schemes stored `concealed` as a second lock choice. It is now the
  // same physical outcome as no exterior lock, so collapse both values.
  if (state.lock === 'concealed') state.lock = 'none';
  const product = PRODUCTS[state.frontProduct || state.product];
  if (!product.supportedLocks?.includes(state.lock)) state.lock = product.defaultLock ?? 'none';
  if (!product.supportedHandles?.includes(state.handle)) state.handle = product.defaultHandle ?? 'none';
}

function hardwareProfile(productKey, type) {
  const profile = HARDWARE_PROFILES[productKey]?.[type];
  if (profile) return profile;
  return { roles: hasChildLeafType() ? ['main', 'child'] : ['main'], centerY: HARDWARE_BASE_Y[type] };
}

function hardwareRolesFor(type, profile, followsOpening = false) {
  // Opening labels are read from the exterior: the selected lock and its
  // edge/hinge detail must live on that same physical leaf. Handles that are
  // authored as a pair continue to use their product profile instead.
  if (followsOpening && hasChildLeafType()) return [openingLeafRole()];
  return profile?.roles || (hasChildLeafType() ? ['main', 'child'] : ['main']);
}

function scaleD90HardwareAroundCenter(group, targetScale) {
  const baseScale = group.userData.runtimeBase?.scale || new THREE.Vector3(1, 1, 1);
  const anchor = group.userData.scaleAnchor;
  const positionDelta = anchor
    ? new THREE.Vector3(
      anchor.x * (baseScale.x - targetScale.x),
      anchor.y * (baseScale.y - targetScale.y),
      anchor.z * (baseScale.z - targetScale.z)
    )
    : null;
  group.scale.copy(targetScale);
  if (positionDelta) group.position.add(positionDelta);
}

function positionHardwareGroup(label, type, profile, delta) {
  const groupName = HARDWARE_GROUPS[type];
  const group = groupName ? object(`${label}Hardware_${groupName}`) : object(`${label}Hardware_AuxCylinder`);
  if (!group) return;
  const base = group.userData.runtimeBase;
  const direction = label === 'Child' ? 1 : -1;
  const baseY = HARDWARE_BASE_Y[type === 'aux' ? 'aux' : type] || 0;
  let centerBetweenLeavesPlacement = false;
  group.position.y = (base?.position.y || 0) + ((profile?.centerY ?? (type === 'aux' ? profile?.auxY : baseY)) - baseY);

  // All hardware is authored around the meeting stile. The Aige ring pull is
  // the exception: it belongs near the hinge-side outer stile, so compensate
  // for the parent width delta and keep its local datum fixed.
  if (type === 'ring' && profile?.anchor === 'hinge') {
    const factoryAnchorX = group.userData.hardwareAnchorX || 0;
    const desiredX = direction * (profile.anchorOffsetX ?? .17);
    group.position.x = (base?.position.x || 0) + desiredX - factoryAnchorX - delta;
  } else if (type === 'long' && profile?.anchor === 'meeting') {
    // Aige's pulls are the two slim meeting-stile pulls. The common GLB
    // stores them at the outer datum, so apply only a small product-specific
    // inward correction; the leaf parent continues to carry resize motion.
    group.position.x = (base?.position.x || 0) + direction * (profile.meetingInsetX ?? .10);
  } else if (type === 'aux' && profile?.centerBetweenLeaves) {
    // The Aige factory cylinder is a shared meeting-stile detail. The GLB
    // stores the cylinder in each leaf's local coordinate system, so derive
    // the local offset that places its center at world x=0. This keeps the
    // bolt centered even when the opening width changes.
    const marker = group.getObjectByName(`${label}_AuxCylinder_Center`);
    const parent = group.parent;
    if (parent && marker) {
      centerBetweenLeavesPlacement = true;
    } else {
      group.position.x = base?.position.x || 0;
    }
  } else if (type === 'aux' && profile?.anchor === 'meeting') {
    // The shared auxiliary-cylinder mesh is authored at the outer hardware
    // datum. Aige's factory cylinder sits beside the meeting stile, on the
    // opening leaf only; move only this small cylinder to that datum.
    group.position.x = (base?.position.x || 0) - direction * (profile.meetingInsetX ?? .40);
  } else if (base) {
    group.position.x = base.position.x;
  }
  if (['long', 'ring', 'integrated'].includes(type) && base) {
    const offsetX = THREE.MathUtils.clamp(Number(state.handleOffsetXMm) || 0, -180, 180) / 1000;
    const offsetY = THREE.MathUtils.clamp(Number(state.handleOffsetMm) || 0, -240, 240) / 1000;
    const scale = THREE.MathUtils.clamp(Number(state.handleScale) || 1, .82, 1.18) * (profile?.scale ?? 1);
    const scaleXYZ = profile?.scaleXYZ || [1, 1, 1];
    const mirrorDirection = label === 'Child' ? -1 : 1;
    group.position.x += mirrorDirection * offsetX;
    group.position.y += offsetY;
    const targetScale = new THREE.Vector3(
      base.scale.x * scale * scaleXYZ[0],
      base.scale.y * scale * scaleXYZ[1],
      base.scale.z * scale * scaleXYZ[2]
    );
    scaleD90HardwareAroundCenter(group, targetScale);
  } else if (base) {
    const targetScale = base.scale.clone();
    if (type === 'aux' && profile?.scale) targetScale.multiplyScalar(profile.scale);
    scaleD90HardwareAroundCenter(group, targetScale);
  }
  if (centerBetweenLeavesPlacement) {
    const marker = group.getObjectByName(`${label}_AuxCylinder_Center`);
    const parent = group.parent;
    if (parent && marker) {
      parent.updateWorldMatrix(true, true);
      const meetingWorld = modelRoot?.localToWorld(new THREE.Vector3()) || new THREE.Vector3();
      const meetingLocal = parent.worldToLocal(meetingWorld);
      // The marker is a child of the scaled group. Solve its final local
      // position after the profile scale so the visible bolt, not the GLB
      // group origin, lands exactly on the physical meeting line.
      group.position.x = meetingLocal.x - marker.position.x * group.scale.x;
    }
  }
  group.userData.profilePosition = group.position.clone();
  group.userData.profileScale = group.scale.clone();
}

const D90_HARDWARE_APPEARANCES = {
  'aige-crystal': { disc: 0x252d34, loop: 0xb9c0c2, glow: 0x3a4650 },
  'aige-crystal-handle': {
    disc: 0xd8e0e3, loop: 0xaeb8bc, glow: 0x657075,
    loopMetalness: .96, loopRoughness: .22
  },
  'aige-ring-ornament': {
    disc: 0x151719, loop: 0xb4b8b8, glow: 0x1c2022,
    discMetalness: .62, discRoughness: .19, loopMetalness: .94, loopRoughness: .20
  },
  'songge-crystal': { disc: 0xa7eff5, loop: 0xc9d1d1, glow: 0x66d5d1 },
  // 冠冕的蓝绿色圆饰属于门扇造型，外露长拉手本身应是暖金属，
  // 不能把饰面宝石色误套到五金杆上。
  'guanmin-crystal': { disc: 0x2e261e, loop: 0xc58a2c, glow: 0x090807 }
};

function applyD90HardwareAppearance(group, profile) {
  const appearance = D90_HARDWARE_APPEARANCES[profile?.appearance];
  if (!group || !appearance) return;
  if (profile?.appearance === 'aige-crystal-handle') {
    // The photographed pull is surface-mounted. Replace the generic U-bar
    // with the product-specific single shaft and compact mounts.
    ensureAigeRealLongPull(group);
  } else if (profile?.appearance === 'aige-ring-ornament') {
    ensureAigeRealRing(group);
  }
  group.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.material) return;
    const material = mesh.userData.d90AppearanceMaterial || mesh.material.clone?.();
    if (!material) return;
    mesh.userData.d90AppearanceMaterial = material;
    mesh.material = material;
    const isDisc = mesh.name.includes('RingHandle_Disc');
    material.color?.setHex(isDisc ? appearance.disc : appearance.loop);
    material.metalness = isDisc ? (appearance.discMetalness ?? .36) : (appearance.loopMetalness ?? .92);
    material.roughness = isDisc ? (appearance.discRoughness ?? .12) : (appearance.loopRoughness ?? .17);
    material.clearcoat = .68;
    material.clearcoatRoughness = .08;
    material.envMapIntensity = isDisc ? 2.15 : 1.92;
    if (isDisc && material.emissive) {
      material.emissive.setHex(appearance.glow);
      material.emissiveIntensity = .12;
      material.transparent = true;
      material.opacity = .96;
      material.transmission = .16;
      material.ior = 1.46;
    }
    material.needsUpdate = true;
  });
}

function resizeSection(group, width, height) {
  if (!group) return;
  const deltaW = width - BASE.width;
  const deltaH = height - BASE.height;
  const archProfile = group.userData.archProfile;
  group.traverse((part) => {
    if (part === group) return;
    restoreBase(part);
    const side = part.userData.frameSide;
    const dimensions = part.userData.baseDimensions || [];
    if (archProfile && (side === 'left' || side === 'right')) {
      const topOffset = Number(part.userData.archedTopOffset ?? archProfile.topOffset ?? D90_ARCH_RISE);
      const baseTop = Math.max(.1, Number(dimensions[2]) || (archProfile.baseHeight - topOffset));
      const targetTop = Math.max(.1, height - topOffset);
      part.scale.y *= targetTop / baseTop;
      part.position.y = targetTop / 2;
      part.position.x += (side === 'left' ? -1 : 1) * deltaW / 2;
      return;
    }
    if (archProfile && side === 'top') {
      const baseWidth = Math.max(.1, dimensions[0] || BASE.width);
      part.scale.x *= (baseWidth + deltaW) / baseWidth;
      part.position.y += height - (archProfile.baseHeight || BASE.height);
      return;
    }
    if (side === 'left' || side === 'right') {
      const sign = side === 'left' ? -1 : 1;
      part.position.x += sign * deltaW / 2;
      if (part.name.includes('Gasket')) {
        part.scale.y *= Math.max(.1, (height - BASE.head - BASE.threshold) / Math.max(.1, dimensions[2] || 2.47));
        part.position.y = BASE.threshold + (height - BASE.head - BASE.threshold) / 2;
      } else {
        part.scale.y *= height / BASE.height;
        part.position.y += deltaH / 2;
      }
    } else if (side === 'top') {
      const baseWidth = Math.max(.1, dimensions[0] || BASE.width);
      part.scale.x *= (baseWidth + deltaW) / baseWidth;
      part.position.y += deltaH;
    } else if (side === 'bottom') {
      const baseWidth = Math.max(.1, dimensions[0] || BASE.width);
      part.scale.x *= (baseWidth + deltaW) / baseWidth;
    }
  });
}

function resizeTransom(group, width, height) {
  if (!group) return;
  const base = group.userData.runtimeBase;
  const baseWidth = Number(group.userData.baseWidth) || BASE.width;
  if (base) {
    group.position.copy(base.position);
    group.position.y += height - BASE.height;
    group.scale.copy(base.scale);
    group.scale.x *= width / baseWidth;
  } else {
    group.scale.x = width / baseWidth;
    group.position.y = height - BASE.height;
  }
}

function applyFrameInstallation() {
  const wallDelta = (Number(state.wallThickness) - 240) / 1000;
  const installRatio = { outside: -.5, center: 0, inside: .5 }[state.frameInstall] ?? 0;
  const zOffset = wallDelta * installRatio;
  [frameGroup, casingGroup, transomGroup, sideLightGroup, sideLightGroupRight].forEach((group) => {
    if (!group) return;
    const base = group.userData.runtimeBase;
    if (base) group.position.z = base.position.z + zOffset;
  });
  casingGroup?.traverse((part) => {
    if (!part.name.includes('WallReturn')) return;
    const base = part.userData.runtimeBase;
    if (base) part.scale.z = base.scale.z * Math.max(.55, Number(state.wallThickness) / 240);
  });
  if (frameGroup) frameGroup.userData.installation = state.frameInstall;
  if (casingGroup) casingGroup.userData.wallThickness = Number(state.wallThickness);
}

// 冠冕的拱形外轮廓属于门扇/固定气窗的一体化收边，不应再叠加一圈
// 独立的结构门框。GLB 中的 StructuralJamb 和 ArchStructural 是为
// 矩形门洞准备的外框件；它们会在拱顶门外形成一圈过宽的棕色门套。
// 保留 FrameGroup 本身以及合页、压条和下槛，只隐藏这三个外轮廓件，
// 这样开门时合页仍然可见，门扇和气窗之间的真实内收口也不会消失。
function applyGuanminOuterFrameVisibility() {
  if (!modelRoot) return;
  const isGuanmin = state.frontProduct === 'guanmin';
  // The photographed crown already contains the complete visible door-frame
  // contour. The GLB FrameGroup also carries anonymous structural jamb meshes
  // from the generic assembly; hiding the whole group prevents those extra
  // vertical bars and sill from leaking into the Guanmin elevation.
  if (frameGroup) frameGroup.visible = !isGuanmin;
  if (isGuanmin) {
    // The transparent crop intentionally reveals the leaf's physical edge.
    // Use the photographed bronze finish for that backing instead of the
    // generic dark insulated-core material, which reads as two stray bars.
    modelRoot.traverse((node) => {
      if (!node.isMesh || !/^(Main|Child)_(Core|FoldedEdge_|LeafSeal_)/.test(node.name)) return;
      if (/_(FoldedEdge_|LeafSeal_)/.test(node.name)) {
        node.visible = false;
        return;
      }
      const material = node.material;
      material?.color?.setHex(0x8b682e);
      if (material) {
        material.metalness = .78;
        material.roughness = .28;
        material.needsUpdate = true;
      }
    });
  }
}

// FrameGroup is the real installed jamb/head assembly. CasingGroup is an
// optional decorative outer casing from the source GLB; rendering both makes
// every ordinary product look like it has two independent door frames.
function applyD90OuterCasingVisibility() {
  if (!casingGroup) return;
  casingGroup.visible = false;
  casingGroup.traverse((node) => { node.visible = false; });
}

function resizeFrameHinges(opening, height, pivotPositions = {}) {
  ['Main', 'Child'].forEach((label) => {
    const hinges = object(`${label}FrameHinges`);
    if (!hinges) return;
    const hingeX = pivotPositions[label.toLowerCase()] ?? (label === 'Main' ? opening / 2 : -opening / 2);
    const inward = label === 'Main' ? -1 : 1;
    hinges.traverse((part) => {
      restoreBase(part);
      const match = part.name.match(/Hinge_(\d+)_/);
      if (!match) return;
      part.position.x = hingeX + (part.name.includes('FramePlate') || part.name.includes('Screw') ? inward * .018 : 0);
      const index = Number(match[1]);
      part.position.y = BASE.threshold + (index === 1 ? .28 : index === 2 ? (height - BASE.head - BASE.threshold) * .52 : (height - BASE.head - BASE.threshold) - .28);
    });
  });
}

function resizeSideLight(group, opening, height, width, centerX = -opening / 2 + width / 2) {
  if (!group) return;
  const leafHeight = height - BASE.head - BASE.threshold;
  const x = centerX;
  group.traverse((part) => {
    if (part === group) return;
    restoreBase(part);
    if (part.name === 'SideLight_Glass' || part.name === 'SideLight_Right_Glass') {
      part.scale.x *= (width - .024) / (BASE.sideLight - .024);
      part.scale.y *= (leafHeight - .026) / (BASE.height - BASE.head - BASE.threshold - .026);
      part.position.x = x;
      part.position.y = BASE.threshold + leafHeight / 2;
      return;
    }
    const side = part.userData.sideLightSide;
    if (side === 'left' || side === 'right') {
      part.position.x = x + (side === 'left' ? -1 : 1) * (width / 2 - .012);
      part.scale.y *= leafHeight / (BASE.height - BASE.head - BASE.threshold);
      part.position.y = BASE.threshold + leafHeight / 2;
    } else if (side === 'top') {
      part.scale.x *= width / BASE.sideLight;
      part.position.x = x;
      part.position.y = BASE.threshold + leafHeight - .012;
    } else if (side === 'bottom') {
      part.scale.x *= width / BASE.sideLight;
      part.position.x = x;
      part.position.y = BASE.threshold + .012;
    }
  });
}

function cloneD90SideLightGroup() {
  if (!sideLightGroup || sideLightGroupRight) return;
  sideLightGroupRight = sideLightGroup.clone(true);
  sideLightGroupRight.name = 'SideLightGroup_Right';
  sideLightGroupRight.traverse((node) => {
    if (node.name.startsWith('SideLight_')) node.name = node.name.replace(/^SideLight_/, 'SideLight_Right_');
    rememberBase(node);
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      node.userData.originalMaterial = node.material;
      if (node.name.endsWith('_Glass')) planarize(node);
    }
  });
  sideLightGroupRight.visible = false;
  modelRoot.add(sideLightGroupRight);
}

function applyHardware() {
  normalizeD90HardwareState();
  const activeProduct = state.frontProduct || state.product;
  const lockProfile = state.lock === 'none' ? null : hardwareProfile(activeProduct, state.lock);
  const handleProfile = state.handle === 'none' ? null : hardwareProfile(activeProduct, state.handle);
  const selectedLockTypes = state.lock === 'none' ? new Set() : new Set([state.lock]);
  const selectedHandleTypes = state.handle === 'none'
    ? new Set()
    : new Set([state.handle, ...(handleProfile?.extras || [])]);
  ['Main', 'Child'].forEach((label) => {
    const role = label.toLowerCase();
    const showLeaf = label === 'Main' || hasChildLeafType();
    const pivot = label === 'Main' ? mainPivot : childPivot;
    const leafWidth = currentLayout?.[role] || pivot?.userData?.baseWidth || .58;
    const direction = role === 'child' ? 1 : -1;
    const delta = direction * (leafWidth - (pivot?.userData?.baseWidth || leafWidth));
    const hardware = object(`${label}Hardware`);
    const integrated = ensureD90IntegratedGroup(label);
    if (integrated) updateD90IntegratedBase(label, integrated, leafWidth);
    // GLTF keeps every selectable hardware subgroup alive. Reset every
    // descendant first so a previous selection can never leave a stale pull
    // or lock visible when the user switches hardware type.
    hardware?.traverse((node) => {
      if (node !== hardware) node.visible = false;
    });
    ['smart', 'yt82', 'concealed'].forEach((type) => {
      const group = object(`${label}Hardware_${HARDWARE_GROUPS[type]}`);
      const profile = hardwareProfile(activeProduct, type);
      const roleEnabled = hardwareRolesFor(type, profile, type === state.lock).includes(role);
      if (group) {
        // Concealed/YTR55H is an internal lock option. Keep the group in the
        // GLB for the open-edge inspection, but do not draw a circular face or
        // keyhole on the exterior when the door is closed.
        group.visible = showLeaf && selectedLockTypes.has(type) && roleEnabled && type !== 'concealed';
        if (group.visible) group.traverse((node) => { node.visible = true; });
        positionHardwareGroup(label, type, profile, delta);
      }
    });
    ['long', 'ring', 'integrated'].forEach((type) => {
      const group = object(`${label}Hardware_${HARDWARE_GROUPS[type]}`);
      const profile = hardwareProfile(activeProduct, type);
      const roleEnabled = hardwareRolesFor(type, profile).includes(role);
      if (group) {
        group.visible = showLeaf && selectedHandleTypes.has(type) && roleEnabled;
        if (group.visible) group.traverse((node) => { node.visible = true; });
        applyD90HardwareAppearance(group, profile);
        positionHardwareGroup(label, type, profile, delta);
      }
    });
    const auxProfile = lockProfile || {};
    const aux = object(`${label}Hardware_AuxCylinder`);
    const factoryCylinder = activeProduct === 'aige'
      && state.lock === 'none'
      && state.handle === 'long';
    const factoryCylinderRole = factoryCylinder
      ? (hasChildLeafType() ? openingLeafRole() : 'main')
      : null;
    const auxEnabled = showLeaf && (
      (state.lock !== 'none'
        && (auxProfile.auxRoles || []).includes(role)
        && (!hasChildLeafType() || role === openingLeafRole()))
      || (factoryCylinder && role === factoryCylinderRole)
    );
    if (aux) {
      aux.visible = auxEnabled;
      if (aux.visible) aux.traverse((node) => { node.visible = true; });
      const auxPositionProfile = factoryCylinder
        ? {
          centerY: PRODUCTS.aige.factoryCylinder?.y ?? .72,
          scale: PRODUCTS.aige.factoryCylinder?.scale,
          anchor: PRODUCTS.aige.factoryCylinder?.anchor,
          meetingInsetX: PRODUCTS.aige.factoryCylinder?.meetingInsetX,
          centerBetweenLeaves: PRODUCTS.aige.factoryCylinder?.centerBetweenLeaves
        }
        : { centerY: auxProfile.auxY ?? HARDWARE_BASE_Y.aux };
      positionHardwareGroup(label, 'aux', auxPositionProfile, delta);
    }
    const showRole = showLeaf && (state.lock !== 'none' || state.handle !== 'none');
    if (hardware) hardware.visible = showRole;
    const lockEdge = object(`${label}LockEdge`);
    // The lock-edge faceplate is a side/edge component. It must not appear as
    // a silver vertical stripe on a closed front elevation; reveal it only
    // when the main leaf is actually opened so the latch-side construction
    // can be inspected from the oblique view.
    if (lockEdge) lockEdge.visible = showRole && state.lock !== 'none' && state.open;
  });
  applyLockPosition();
  applyShiruiGlassLighting();
  syncShiruiGlassUi();
  $$('[data-lock]').forEach((button) => button.classList.toggle('selected', button.dataset.lock === state.lock));
  $$('[data-handle]').forEach((button) => button.classList.toggle('selected', button.dataset.handle === state.handle));
}

function applyLockPosition() {
  const offsetX = THREE.MathUtils.clamp(Number(state.lockOffsetXMm) || 0, -140, 140) / 1000;
  const offsetY = THREE.MathUtils.clamp(Number(state.lockOffsetMm) || 0, -200, 200) / 1000;
  const scale = THREE.MathUtils.clamp(Number(state.lockScale) || 1, .86, 1.14);
  const type = state.lock;
  const groupName = HARDWARE_GROUPS[type];
  ['Main', 'Child'].forEach((label) => {
    const mirrorDirection = label === 'Child' ? -1 : 1;
    const group = groupName ? object(`${label}Hardware_${groupName}`) : null;
    const base = group?.userData.profilePosition;
    if (group && base) {
      group.position.copy(base);
      group.position.x += mirrorDirection * offsetX;
      group.position.y += offsetY;
      const profileScale = group.userData.profileScale || group.scale;
      const targetScale = profileScale.clone().multiplyScalar(scale);
      group.scale.copy(targetScale);
      const anchor = group.userData.scaleAnchor;
      if (anchor) {
        group.position.add(new THREE.Vector3(
          anchor.x * (profileScale.x - targetScale.x),
          anchor.y * (profileScale.y - targetScale.y),
          anchor.z * (profileScale.z - targetScale.z)
        ));
      }
    }
    const aux = object(`${label}Hardware_AuxCylinder`);
    const auxBase = aux?.userData.profilePosition;
    if (aux && auxBase && state.lock !== 'none') {
      aux.position.copy(auxBase);
      aux.position.x += mirrorDirection * offsetX;
      aux.position.y += offsetY;
      const auxProfileScale = aux.userData.profileScale || aux.scale;
      const auxTargetScale = auxProfileScale.clone().multiplyScalar(scale);
      aux.scale.copy(auxTargetScale);
      const auxAnchor = aux.userData.scaleAnchor;
      if (auxAnchor) {
        aux.position.add(new THREE.Vector3(
          auxAnchor.x * (auxProfileScale.x - auxTargetScale.x),
          auxAnchor.y * (auxProfileScale.y - auxTargetScale.y),
          auxAnchor.z * (auxProfileScale.z - auxTargetScale.z)
        ));
      }
    }
  });
  const horizontalSlider = $('#lockHorizontalSlider');
  const verticalSlider = $('#lockPositionSlider');
  const scaleSlider = $('#lockScaleSlider');
  const horizontalOutput = $('#lockHorizontalOutput');
  const verticalOutput = $('#lockPositionOutput');
  const scaleOutput = $('#lockScaleOutput');
  const visible = state.lock !== 'none';
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
  // Hinges are inspection details, not part of a closed front elevation. They
  // become visible only while the main leaf is actually swung open, so the
  // front, side and default 3D poses all match a closed installed door.
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
  // In the authored D90 model, Main is the visual right-hand leaf and Child
  // is the visual left-hand leaf when viewed from outside. The UI labels are
  // defined by the lock side in that exterior view, so map left-lock to Child
  // and right-lock to Main rather than relying on the node names.
  return opening.endsWith('left') ? 'child' : 'main';
}

function applyHingeStyle() {
  const styles = {
    'd90-hidden': { color: 0x282b2c, roughness: .24, scale: 1 },
    'd90-heavy': { color: 0x8a6a4b, roughness: .18, scale: 1.14 }
  };
  const style = styles[state.hinge] || styles['d90-hidden'];
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

function applyStyle() {
  if (!modelRoot) return;
  modelRoot.traverse((node) => {
    if (node.name.startsWith('D90Style_')) {
      // The original D90 photo already contains the raised panels, decorative
      // ribbons and stone inserts. Keep the modeled relief layers available for
      // future clean-map assets, but do not double them over the real photo.
      node.visible = false;
    } else if (node.name.startsWith('D90PhotoMask_')) {
      // The old guanmin-only mask was authored for the previous arched
      // one-leaf photo and left a black wedge over the rectangular GLB. The
      // current PDF-derived paired map already contains the correct door
      // body, so never draw that stale mask on either face.
      node.visible = false;
    }
  });
  const frameFinish = PRODUCT_FRAME_FINISH[state.frontProduct];
  if (frameFinish) {
    [frameGroup, casingGroup].forEach((group) => {
      group?.traverse((node) => {
        if (!node.isMesh || node.name.includes('Gasket')) return;
        if (!node.userData.productFrameMaterial) {
          node.userData.productFrameMaterial = node.material?.clone?.() || node.material;
          node.material = node.userData.productFrameMaterial;
        }
        const material = node.material;
        const color = node.name.startsWith('Casing_')
          ? frameFinish.casing
          : node.name.includes('Rebate') || node.name.includes('InnerStep')
            ? frameFinish.edge
            : frameFinish.frame;
        material.color?.setHex(color);
        material.metalness = .82;
        material.roughness = node.name.startsWith('Casing_') ? .24 : .20;
        material.clearcoat = .28;
        material.clearcoatRoughness = .14;
        material.envMapIntensity = 1.45;
        material.needsUpdate = true;
      });
    });
  }
}

function updateDimensionsUi() {
  $('#widthReadout').textContent = `${state.width} mm`;
  $('#heightReadout').textContent = `${state.height} mm`;
  $('#widthOutput').textContent = `${state.width} mm`;
  $('#heightOutput').textContent = `${state.height} mm`;
  const spec = dimensionSpecFor(state.type);
  const transomNote = state.frontProduct === 'guanmin' ? ` · 完整拱形门扇 · 拱顶与浮雕随门扇一体` : '';
  $('#dimensionRangeNote').textContent = `${spec.label}可调范围：宽 ${spec.width[0]}–${spec.width[1]} mm · 高 ${spec.height[0]}–${spec.height[1]} mm；D90 门厚 90 mm，合页、锁体和拉手保持安装基准${transomNote}。`;
  $('#modelStatus').textContent = `D90 ${PRODUCTS[state.frontProduct].label} · ${spec.label} · 真实照片贴图`;
  syncConfigurationUi();
}

const OPTION_LABELS = {
  opening: { 'out-left': '外开左锁', 'out-right': '外开右锁', 'in-left': '内开左锁', 'in-right': '内开右锁' },
  lock: { none: '隐藏锁体（无外露）', concealed: '隐藏锁体（无外露）', smart: '07 型智能锁', yt82: 'YT82 圆形锁' },
  handle: { none: '无拉手', long: 'SL48F 通天拉手', ring: '环形拉手', integrated: '纹理一体灯带拉手' },
  frameInstall: { outside: '靠墙外', center: '靠中装', inside: '靠墙内' },
  frameBuild: { integral: '整体制作', assembled: '拼装制作' }
};

function hardwareSummaryLabel() {
  if (state.frontProduct === 'aige' && state.handle === 'long') {
    return 'SL48F 通天拉手 · 双侧装饰门环';
  }
  return OPTION_LABELS.handle[state.handle];
}

function lockSummaryLabel() {
  if (state.frontProduct === 'aige' && state.lock === 'none' && state.handle === 'long') {
    return '产品自带单锁芯';
  }
  return OPTION_LABELS.lock[state.lock];
}

function syncConfigurationUi() {
  const product = PRODUCTS[state.product];
  const color = currentColorway();
  const surface = currentTextureSurface();
  const type = TYPE_SPECS[state.type];
  const clearWidth = Math.max(0, state.width - Math.round((BASE.jamb * 2 + BASE.gap) * 1000));
  const fixedTransom = 0;
  const clearHeight = Math.max(0, state.height - Math.round((BASE.head + BASE.threshold) * 1000));
  const casingWidth = state.width + 132;
  const casingHeight = state.height + 66;
  const isGuanmin = state.frontProduct === 'guanmin';
  if ($('#productSectionSummary')) $('#productSectionSummary').textContent = `${product.label} · ${textureRegionLabel(state.textureRegion)} ${surface.label} · ${color.label}`;
  if ($('#structureSectionSummary')) $('#structureSectionSummary').textContent = `${type.label} · ${OPTION_LABELS.opening[state.opening]}`;
  if ($('#dimensionSectionSummary')) $('#dimensionSectionSummary').textContent = `${state.width} × ${state.height} mm`;
  if ($('#clearOpeningReadout')) $('#clearOpeningReadout').textContent = `${clearWidth} × ${clearHeight} mm`;
  if ($('#casingReadoutLabel')) $('#casingReadoutLabel').textContent = isGuanmin ? '门框总尺寸' : '外门套总尺寸';
  if ($('#casingReadout')) $('#casingReadout').textContent = isGuanmin ? `${state.width} × ${state.height} mm` : `${casingWidth} × ${casingHeight} mm`;
  if ($('#wallThicknessOutput')) $('#wallThicknessOutput').textContent = `${state.wallThickness} mm`;
  if ($('#frameSectionSummary')) $('#frameSectionSummary').textContent = `固定工艺色 · ${OPTION_LABELS.frameBuild[state.frameBuild]}`;
  if ($('#frameSectionTitle')) $('#frameSectionTitle').textContent = isGuanmin ? '门框与收口' : '门框与门套';
  if ($('#hardwareSectionSummary')) $('#hardwareSectionSummary').textContent = `${lockSummaryLabel()} · ${hardwareSummaryLabel()}`;
  const rule = compositionRule({ sourceType: getTextureManifest('d90', state.frontProduct)?.base?.type, type: state.type });
  if ($('#compositionLogicNote')) $('#compositionLogicNote').innerHTML = `<b>${rule.title}</b>${rule.text}`;
  productInspector?.update();
}

function supportedTypesForState() {
  const front = PRODUCTS[state.frontProduct]?.supportedTypes
    || getTextureManifest('d90', state.frontProduct)?.supportedTypes
    || Object.keys(TYPE_SPECS);
  const back = PRODUCTS[state.backProduct]?.supportedTypes
    || getTextureManifest('d90', state.backProduct)?.supportedTypes
    || Object.keys(TYPE_SPECS);
  // A product's authored structure is authoritative. Returning all generic
  // door types here made Aige (a real double-door source) incorrectly show a
  // mother-door conversion that had no valid texture or hardware layout.
  const common = front.filter((type) => back.includes(type));
  const optional = Object.keys(TYPE_SPECS).filter((type) => !UNIVERSAL_DOOR_TYPES.includes(type) && common.includes(type));
  return [...new Set([...common, ...optional])];
}

function synchronizeTextureStructure(changedFace) {
  const front = PRODUCTS[state.frontProduct]?.supportedTypes
    || getTextureManifest('d90', state.frontProduct)?.supportedTypes
    || Object.keys(TYPE_SPECS);
  const back = PRODUCTS[state.backProduct]?.supportedTypes
    || getTextureManifest('d90', state.backProduct)?.supportedTypes
    || Object.keys(TYPE_SPECS);
  const common = front.filter((type) => back.includes(type));
  if (common.length) return false;
  // Front and back may use different textures, but they must describe the
  // same physical door structure. If a newly selected source has no common
  // assembly with the other face, keep the newly edited face as the master.
  if (changedFace === 'front') state.backProduct = state.frontProduct;
  else state.frontProduct = state.backProduct;
  return true;
}

function reconcileType() {
  const available = supportedTypesForState();
  if (available.includes(state.type)) return false;
  const preferred = [
    PRODUCTS[state.frontProduct]?.defaultType,
    PRODUCTS[state.backProduct]?.defaultType,
    'double',
    'sideLight',
    'single'
  ];
  state.type = preferred.find((type) => available.includes(type)) || available[0] || 'double';
  updateSliderRanges(true);
  return true;
}

function d90SideLightMode(productKey, type = 'sideLight') {
  if (!['sideLight', 'doubleSide'].includes(type)) return null;
  const region = type === 'doubleSide' ? 'sideLeft' : 'sideLeft';
  const regionSpec = getTextureRegion('d90', productKey, type, region);
  return regionSpec?.material || PRODUCTS[productKey]?.sideLightMaterial || PRODUCTS[productKey]?.sideLightMode || 'finish';
}

function d90SideLightLabel(productKey, type) {
  const mode = d90SideLightMode(productKey, type);
  if (mode === 'frosted-glass') return type === 'doubleSide' ? '左右整片磨砂玻璃' : '左侧整片磨砂玻璃';
  if (mode === 'glass-texture' || mode === 'glass') return type === 'doubleSide' ? '左右玻璃纹理' : '左侧玻璃纹理';
  return type === 'doubleSide' ? '左右产品纹理' : '左侧产品纹理';
}

function applyTypeCards() {
  const available = new Set(supportedTypesForState());
  const activeProduct = PRODUCTS[state.frontProduct] || PRODUCTS.shicui;
  const typeButtons = $$('[data-door-type]');
  typeButtons.forEach((button) => {
    const type = button.dataset.doorType;
    const supported = available.has(type);
    const spec = TYPE_SPECS[type];
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
      : `${activeProduct.defaultType === 'sideLight' ? '单边边门原型' : '对开门原图'}暂无${spec.label}净图，已禁用以避免错误切割`;
    if (note) note.textContent = supported
      ? (type === 'sideLight' || type === 'doubleSide' ? d90SideLightLabel(state.frontProduct, type) : type === 'double' && activeProduct.doubleGlassLeft ? '左侧整扇玻璃' : type === 'double' ? '左右镜像转轴' : type === 'mother' ? '左小右大分割' : '独立门扇')
      : '本款暂不支持';
  });
  const typeGrid = typeButtons[0]?.closest('.choice-grid');
  typeGrid?.classList.toggle('single-choice', available.size === 1);
  const typeNote = $('#doorTypePrototypeNote');
  if (typeNote) {
    const typeLabels = [...available].map((type) => TYPE_SPECS[type]?.label).filter(Boolean);
    typeNote.textContent = typeLabels.length === 1
      ? `实拍原型：${activeProduct.label} · ${activeProduct.doubleGlassLeft ? '对开门 · 左侧整扇玻璃' : typeLabels[0]}；其他门型已禁用，避免错误拼接门扇纹理。`
      : `实拍原型：${activeProduct.label} · 可用结构 ${typeLabels.join(' / ')}。`;
  }
}

function getAssemblyLayout() {
  const width = state.width / 1000;
  const height = state.height / 1000;
  const layout = assemblyLayoutFor(state.type, state.width, state.height);
  return { ...layout, type: state.type, opening: width - BASE.jamb * 2, width, heightTotal: height };
}

async function applyAssembly({ fitCamera = true } = {}) {
  if (!modelRoot) return;
  currentLayout = getAssemblyLayout();
  const mainPivotX = currentLayout.type === 'doubleSide' ? currentLayout.opening / 2 - currentLayout.side : currentLayout.opening / 2;
  const childPivotX = currentLayout.type === 'doubleSide' ? -currentLayout.opening / 2 + currentLayout.side : -currentLayout.opening / 2;
  currentLayout.mainPivotX = mainPivotX;
  currentLayout.childPivotX = childPivotX;
  mainPivot.position.set(mainPivotX, BASE.threshold, 0);
  childPivot.position.set(childPivotX, BASE.threshold, 0);
  mainPivot.visible = true;
  childPivot.visible = hasChildLeafType();
  resizeLeaf('main', mainPivot, currentLayout.main, currentLayout.height);
  if (hasChildLeafType()) resizeLeaf('child', childPivot, currentLayout.child, currentLayout.height);
  resizeSection(frameGroup, currentLayout.width, currentLayout.heightTotal);
  resizeSection(casingGroup, currentLayout.width, currentLayout.heightTotal);
  // The optional outer casing is not part of the visible product assembly.
  // Keep only FrameGroup so the installed door has one coherent frame.
  applyD90OuterCasingVisibility();
  if (transomGroup) transomGroup.visible = false;
  const hingeHeight = currentLayout.heightTotal;
  resizeFrameHinges(currentLayout.opening, hingeHeight, { main: mainPivotX, child: childPivotX });
  sideLightGroup.visible = hasSideLightType();
  sideLightGroupRight && (sideLightGroupRight.visible = state.type === 'doubleSide');
  resizeSideLight(sideLightGroup, currentLayout.opening, currentLayout.heightTotal, currentLayout.side || BASE.sideLight, -currentLayout.opening / 2 + (currentLayout.side || BASE.sideLight) / 2);
  resizeSideLight(sideLightGroupRight, currentLayout.opening, currentLayout.heightTotal, currentLayout.side || BASE.sideLight, currentLayout.opening / 2 - (currentLayout.side || BASE.sideLight) / 2);
  applyFrameInstallation();
  applyStyle();
  applyGuanminOuterFrameVisibility();
  applyHardware();
  applyOpeningDetails();
  await applyTextures();
  await applyProductFrameSkin();
  updateDimensionsUi();
  applyTypeCards();
  if (fitCamera) refitActiveCamera();
}

function currentBounds() {
  modelRoot?.updateWorldMatrix(true, true);
  return modelRoot ? new THREE.Box3().setFromObject(modelRoot, true) : new THREE.Box3(new THREE.Vector3(-1, 0, -.2), new THREE.Vector3(1, 2.6, .2));
}

function cameraPose(view = state.view) {
  const bounds = currentBounds();
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const aspect = Math.max(.5, mount.clientWidth / Math.max(1, mount.clientHeight));
  const verticalDistance = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const screenWidth = view === 'side' ? Math.max(size.z, .68) : size.x;
  const horizontalDistance = screenWidth / aspect / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const distance = Math.max(verticalDistance, horizontalDistance) * 1.17 + .25;
  const target = new THREE.Vector3(center.x, Math.max(.92, center.y), view === 'side' ? center.z : 0);
  let position;
  if (view === 'front') position = new THREE.Vector3(center.x, target.y, distance);
  else if (view === 'side') position = new THREE.Vector3(center.x + distance, target.y, center.z + .12);
  else position = new THREE.Vector3(distance * .32, target.y + distance * .10, distance * .95);
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
  const bounds = currentBounds();
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
    target = frontTarget(center.x + lockSide * Math.min(size.x * .13, .30), Math.min(bounds.max.y - .36, Math.max(bounds.min.y + .58, 1.12)));
    distance = focusDistance(Math.min(1.22, size.x * .62), Math.min(1.50, size.y * .60), 1.08);
    return { position: new THREE.Vector3(target.x + lockSide * .08, target.y + .02, distance), target };
  }
  if (focus === 'hinge') {
    const hingeSide = state.opening.endsWith('left') ? 1 : -1;
    target = new THREE.Vector3(center.x + hingeSide * size.x * .40, Math.min(bounds.max.y - .45, Math.max(bounds.min.y + .62, 1.16)), 0);
    distance = focusDistance(Math.min(.74, size.x * .42), Math.min(1.62, size.y * .64), 1.04);
    return { position: new THREE.Vector3(target.x + hingeSide * distance * .46, target.y + .08, distance * .72), target };
  }
  if (focus === 'frame') {
    target = frontTarget(center.x + size.x * .28, center.y);
    distance = focusDistance(Math.min(1.50, size.x * .78), Math.min(2.32, size.y * .90), 1.08);
    return { position: new THREE.Vector3(target.x + distance * .22, target.y + distance * .035, distance * .98), target };
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
  if (immediate) {
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    controls.update();
    return;
  }
  viewTween = { start: performance.now(), duration, fromPosition: camera.position.clone(), fromTarget: controls.target.clone(), toPosition: pose.position, toTarget: pose.target };
}

function setCameraFocus(focus, immediate = false) {
  activeCameraFocus = focus === 'overview' ? null : focus;
  mount.dataset.cameraFocus = activeCameraFocus || 'overview';
  applyCameraPose(activeCameraFocus ? cameraFocusPose(activeCameraFocus) : cameraPose(state.view), immediate, 680);
  const visualView = ['structure', 'frame', 'hinge'].includes(activeCameraFocus) ? 'perspective' : activeCameraFocus ? 'front' : state.view;
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

async function loadModel() {
  try {
    const modelPath = D90_MODEL_BY_PRODUCT[state.frontProduct] || './assets/models/d90-door-custom.glb';
    const gltf = await loadModelWithRetry(`${modelPath}?v=${ASSET_VERSION}`);
    modelRoot = gltf.scene;
    modelRoot.name = 'YADILO_D90_Assembly';
    modelRoot.position.z = SHOWROOM_DOOR_FORWARD_OFFSET;
    scene.add(modelRoot);
    mainPivot = object('MainLeafPivot');
    childPivot = object('ChildLeafPivot');
    frameGroup = object('FrameGroup');
    casingGroup = object('CasingGroup');
    transomGroup = object('GuanminTransomGroup');
    sideLightGroup = object('SideLightGroup');
    if (!mainPivot || !childPivot || !frameGroup || !casingGroup || !sideLightGroup) throw new Error('D90 GLB 缺少门扇转轴、门框或边门结构');
    cloneD90SideLightGroup();
    modelRoot.traverse((node) => {
      rememberBase(node);
      if (!node.isMesh) return;
      node.castShadow = true;
      node.receiveShadow = true;
      node.userData.originalMaterial = node.material;
      if (/^DoorLeaf_(Main|Child)_(Front|Back)$/.test(node.name) || /^SideLight(?:_Right)?_Glass$/.test(node.name)) planarize(node);
      if (node.material) {
        const materialName = node.name.toLowerCase();
        node.material.envMapIntensity = materialName.includes('hardware') || materialName.includes('lock') || materialName.includes('handle') ? 1.90 : 1.42;
        if ('specularIntensity' in node.material) node.material.specularIntensity = materialName.includes('hardware') ? .95 : .84;
        node.material.needsUpdate = true;
      }
    });
    rememberD90HardwareScaleAnchors();
    await applyLockSideTextures();
    await applyAssembly({ fitCamera: false });
    setView('perspective', true);
    $('#meshCount').textContent = `${modelRoot.getObjectsByProperty('isMesh', true).length} meshes`;
    const assetLabel = $('#modelAssetLabel');
    if (assetLabel) assetLabel.textContent = `MODEL / ${modelPath.split('/').pop()}`;
    $('.glb-status').innerHTML = '<i></i> D90 GLB 已加载';
  } catch (error) {
    console.error(error);
    status.textContent = `模型读取失败：${error.message} · 可刷新重试`;
    $('.glb-status').innerHTML = '<i style="background:#c8786b"></i> D90 GLB 读取失败';
  }
}

function updateSliderRanges(reset = true) {
  const spec = dimensionSpecFor(state.type);
  $('#widthSlider').min = spec.width[0];
  $('#widthSlider').max = spec.width[1];
  $('#heightSlider').min = spec.height[0];
  $('#heightSlider').max = spec.height[1];
  if (reset) {
    state.width = spec.width[2];
    state.height = spec.height[2];
    $('#widthSlider').value = state.width;
    $('#heightSlider').value = state.height;
  }
}

// `pair` is an explicit synchronized edit channel. `child` and `main` remain
// independent channels so the customer can deliberately change only the left
// or right leaf without losing the authored texture coordinates.
function textureEditKey(region) {
  return region === 'pair' ? 'pair' : region;
}

function textureContentRegion(region, type = state.type) {
  if (state.textureRegion === 'pair' && ['child', 'main'].includes(region)) return 'main';
  return textureEditKey(region) === 'pair' ? 'main' : textureEditKey(region);
}

function textureRegionsForType(type = state.type) {
  let regions;
  if (type === 'mother' || type === 'double') regions = ['pair', 'child', 'main'];
  else if (type === 'sideLight') regions = ['main', 'sideLeft'];
  else if (type === 'doubleSide') regions = ['pair', 'child', 'main', 'sideLeft', 'sideRight'];
  else regions = ['main'];
  return regions;
}

function textureRegionLabel(region, type = state.type) {
  if (region === 'pair') return type === 'mother' ? '子母门扇（同步）' : type === 'doubleSide' ? '主门扇（同步）' : '双门扇（同步）';
  if (region === 'child') return ['mother', 'double', 'doubleSide'].includes(type) ? '左侧门扇' : '子门扇';
  if (region === 'main') return ['mother', 'double', 'doubleSide'].includes(type) ? '右侧门扇' : '主门扇';
  if (region === 'sideLeft') return '左边门';
  if (region === 'sideRight') return '右边门';
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
  // A leaf inherits the synchronized pair until it is changed explicitly.
  // Selecting `pair` always reads the pair channel for both physical leaves.
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
  // Do not persist an inherited pair object under a leaf key until that leaf
  // is actually edited. This keeps synchronization authoritative by default.
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

function setTextureSurfaceForFace(face, surface) {
  state.textureSurface = surface;
  // Surface choices follow the active synchronization channel only. A leaf
  // that has already been customized independently must not be overwritten.
  setTextureSetting(face, state.textureRegion, 'surface', surface);
  if (face === 'front') state.frontTextureSurface = surface;
  if (face === 'back') state.backTextureSurface = surface;
}

function textureDesignSettings(face = state.textureFace, region = state.textureRegion) {
  const storeKey = face === 'back' ? 'backRegionDesigns' : 'frontRegionDesigns';
  const store = state[storeKey] ||= {};
  const editKey = textureEditKey(region);
  const contentRegion = textureContentRegion(region);
  const designs = getTextureDesigns('d90', state.product, contentRegion).filter((item) => item.mode !== 'none');
  const fallback = getDefaultTextureDesign('d90', state.product, contentRegion);
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

function currentTextureDesign(face = state.textureFace, region = state.textureRegion) {
  const settings = textureDesignSettings(face, region);
  const designs = getTextureDesigns('d90', state.product, textureContentRegion(region)).filter((item) => item.mode !== 'none');
  return designs.find((item) => item.key === settings.key) || designs[0] || null;
}

function renderTextureDesignControls() {
  const grid = $('#designPresetGrid');
  const tools = $('#designLayerTools');
  const heading = $('#designLayerHeading');
  if (!grid || !tools) return;
  const designs = getTextureDesigns('d90', state.product, textureContentRegion(state.textureRegion)).filter((item) => item.mode !== 'none');
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
  grid.innerHTML = designs.map((item) => `
    <button type="button" class="design-preset-card${item.key === active?.key ? ' selected' : ''}" data-design-preset="${item.key}">
      <span class="design-preset-mark design-preset-${item.key}"></span><b>${item.label}</b><small>${item.note}</small>
    </button>`).join('');
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
    const next = getTextureDesigns('d90', state.product, textureContentRegion(state.textureRegion)).filter((item) => item.mode !== 'none')
      .find((item) => item.key === button.dataset.designPreset);
    setTextureDesignSetting(state.textureFace, state.textureRegion, 'key', next?.key || 'factory');
    if (next?.defaultScale) setTextureDesignSetting(state.textureFace, state.textureRegion, 'scale', next.defaultScale);
    renderProductControls();
    await applyTextures();
  }));
}

function renderTextureRegionControls() {
  const grid = $('#textureRegionGrid');
  if (!grid) return;
  const regions = textureRegionsForType();
  const editKey = textureEditKey(state.textureRegion);
  if (!regions.includes(state.textureRegion)) state.textureRegion = regions.includes(editKey) ? editKey : regions[0];
  const regionNote = (region) => {
    if (region === 'pair') return '左右门扇同步调整';
    if (region === 'child') return '只修改左侧门扇';
    if (region === 'main') return '只修改右侧门扇';
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
  const product = PRODUCTS[state.product];
  const supportedLocks = product.supportedLocks || ['none', 'smart', 'yt82'];
  const supportedHandles = product.supportedHandles || ['none'];
  if (!supportedLocks.includes(state.lock)) state.lock = product.defaultLock ?? 'none';
  if (!supportedHandles.includes(state.handle)) state.handle = product.defaultHandle ?? 'none';
  $$('[data-lock]').forEach((button) => {
    const supported = supportedLocks.includes(button.dataset.lock);
    button.hidden = !supported;
    button.disabled = !supported;
  });
  $$('[data-handle]').forEach((button) => {
    const supported = supportedHandles.includes(button.dataset.handle);
    button.hidden = !supported;
    button.disabled = !supported;
  });
  $('#productName').textContent = product.label;
  $('#productPrototype').textContent = `${TYPE_SPECS[product.defaultType].label}原型 · 产品结构锁定，正背面纹理可定制`;
  $('#productThumb').style.backgroundImage = `url('${product.image}')`;
  $('#frontFinishName').textContent = product.label;
  const noneLockCard = document.querySelector('[data-lock="none"]');
  const noneLockTitle = noneLockCard?.querySelector('b');
  const noneLockNote = noneLockCard?.querySelector('small');
  if (product.factoryCylinder) {
    if (noneLockTitle) noneLockTitle.textContent = '产品自带单锁芯';
    if (noneLockNote) noneLockNote.textContent = '仅开启侧显示一枚锁芯';
  } else {
    if (noneLockTitle) noneLockTitle.textContent = '隐藏锁体（无外露）';
    if (noneLockNote) noneLockNote.textContent = '不显示第二个锁面';
  }
  $('#backFinishName').textContent = product.label;
  document.title = `${product.label} · D90 私人定制`;
  renderTextureRegionControls();
  renderTextureDesignControls();
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
      await applyTextures();
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
      await applyTextures();
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
      await applyTextures();
    }));
  }
  syncShiruiGlassUi();
  syncConfigurationUi();
}

$$('[data-door-type]').forEach((button) => button.addEventListener('click', async () => {
  if (!supportedTypesForState().includes(button.dataset.doorType)) return;
  state.type = button.dataset.doorType;
  updateSliderRanges(true);
  renderProductControls();
  await applyAssembly();
}));

$$('[data-texture-face]').forEach((button) => button.addEventListener('click', async () => {
  state.textureFace = button.dataset.textureFace;
  $$('[data-texture-face]').forEach((item) => item.classList.toggle('selected', item === button));
  renderProductControls();
  await applyTextures();
}));

$$('[data-lock]').forEach((button) => button.addEventListener('click', () => {
  state.lock = button.dataset.lock;
  const product = PRODUCTS[state.frontProduct || state.product];
  if (state.lock !== 'none' && state.handle !== 'none' && !product.allowLockWithHandle) state.handle = 'none';
  updateHandleUi();
  applyHardware();
  syncConfigurationUi();
}));

$$('[data-handle]').forEach((button) => button.addEventListener('click', () => {
  state.handle = button.dataset.handle;
  const product = PRODUCTS[state.frontProduct || state.product];
  if (state.handle !== 'none' && state.lock !== 'none' && !product.allowLockWithHandle) state.lock = 'none';
  updateHandleUi();
  applyHardware();
  syncConfigurationUi();
}));

$$('[data-opening]').forEach((button) => button.addEventListener('click', () => {
  state.opening = button.dataset.opening;
  $$('[data-opening]').forEach((item) => item.classList.toggle('selected', item === button));
  // Move the selected lock/auxiliary cylinder and the visible hinge assembly
  // at the moment the opening direction changes, not on the next option click.
  applyHardware();
  applyOpeningDetails();
  syncConfigurationUi();
  if (state.open) $('#doorPoseReadout').textContent = `${state.opening.endsWith('left') ? '左锁' : '右锁'}门扇开启 76° · 合页轴转动`;
}));

$$('[data-hinge]').forEach((button) => button.addEventListener('click', () => {
  state.hinge = button.dataset.hinge;
  $$('[data-hinge]').forEach((item) => item.classList.toggle('selected', item === button));
  syncConfigurationUi();
}));

$$('[data-frame-install]').forEach((button) => button.addEventListener('click', () => {
  state.frameInstall = button.dataset.frameInstall;
  $$('[data-frame-install]').forEach((item) => item.classList.toggle('selected', item === button));
  applyFrameInstallation();
  syncConfigurationUi();
}));

$$('[data-frame-build]').forEach((button) => button.addEventListener('click', () => {
  state.frameBuild = button.dataset.frameBuild;
  $$('[data-frame-build]').forEach((item) => item.classList.toggle('selected', item === button));
  if (frameGroup) frameGroup.userData.buildMethod = state.frameBuild;
  syncConfigurationUi();
}));

$('#wallThicknessSlider')?.addEventListener('input', (event) => {
  state.wallThickness = Number(event.target.value);
  applyFrameInstallation();
  syncConfigurationUi();
});

$('#widthSlider').addEventListener('input', async (event) => {
  state.width = Number(event.target.value);
  await applyAssembly({ fitCamera: false });
  refitActiveCamera();
});

$('#heightSlider').addEventListener('input', async (event) => {
  state.height = Number(event.target.value);
  await applyAssembly({ fitCamera: false });
  refitActiveCamera();
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

const updateTextureDesignUi = () => {
  const settings = textureDesignSettings(state.textureFace, state.textureRegion);
  const x = $('#designOffsetXSlider');
  const y = $('#designOffsetYSlider');
  const scale = $('#designScaleSlider');
  const xOutput = $('#designOffsetXOutput');
  const yOutput = $('#designOffsetYOutput');
  const scaleOutput = $('#designScaleOutput');
  if (x) x.value = String(Math.round((settings.offsetX || 0) * 100));
  if (y) y.value = String(Math.round((settings.offsetY || 0) * 100));
  if (scale) scale.value = String(settings.scale ?? 1);
  if (xOutput) xOutput.textContent = `${settings.offsetX > 0 ? '+' : ''}${Math.round((settings.offsetX || 0) * 100)}%`;
  if (yOutput) yOutput.textContent = `${settings.offsetY > 0 ? '+' : ''}${Math.round((settings.offsetY || 0) * 100)}%`;
  if (scaleOutput) scaleOutput.textContent = `${Math.round((settings.scale || 1) * 100)}%`;
};

const updateHandleUi = () => {
  const horizontalSlider = $('#handleHorizontalSlider');
  const verticalSlider = $('#handlePositionSlider');
  const scaleSlider = $('#handleScaleSlider');
  const horizontalOutput = $('#handleHorizontalOutput');
  const verticalOutput = $('#handlePositionOutput');
  const scaleOutput = $('#handleScaleOutput');
  const visible = state.handle !== 'none';
  $$('.handle-position-row').forEach((row) => { row.hidden = !visible; });
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
  if (scaleOutput) scaleOutput.textContent = `${Math.round((Number(state.handleScale) || 1) * 100)}%`;
};

$('#handlePositionSlider')?.addEventListener('input', (event) => {
  state.handleOffsetMm = Number(event.target.value);
  updateHandleUi();
  applyHardware();
});

$('#handleHorizontalSlider')?.addEventListener('input', (event) => {
  state.handleOffsetXMm = Number(event.target.value);
  updateHandleUi();
  applyHardware();
});

$('#handleScaleSlider')?.addEventListener('input', (event) => {
  state.handleScale = Number(event.target.value);
  updateHandleUi();
  applyHardware();
});

$('#lockPositionSlider')?.addEventListener('input', (event) => {
  state.lockOffsetMm = Number(event.target.value);
  applyLockPosition();
});

$('#lockHorizontalSlider')?.addEventListener('input', (event) => {
  state.lockOffsetXMm = Number(event.target.value);
  applyLockPosition();
});

$('#lockScaleSlider')?.addEventListener('input', (event) => {
  state.lockScale = Number(event.target.value);
  applyLockPosition();
});

$('#textureZoomSlider')?.addEventListener('input', async (event) => {
  state.textureZoom = Number(event.target.value);
  updateTextureUi();
  await applyTextures();
});

$('#texturePanXSlider')?.addEventListener('input', async (event) => {
  state.texturePanX = Number(event.target.value);
  updateTextureUi();
  await applyTextures();
});

$('#texturePanYSlider')?.addEventListener('input', async (event) => {
  state.texturePanY = Number(event.target.value);
  updateTextureUi();
  await applyTextures();
});

$('#designOffsetXSlider')?.addEventListener('input', async (event) => {
  setTextureDesignSetting(state.textureFace, state.textureRegion, 'offsetX', Number(event.target.value) / 100);
  updateTextureDesignUi();
  await applyTextures();
});

$('#designOffsetYSlider')?.addEventListener('input', async (event) => {
  setTextureDesignSetting(state.textureFace, state.textureRegion, 'offsetY', Number(event.target.value) / 100);
  updateTextureDesignUi();
  await applyTextures();
});

$('#designScaleSlider')?.addEventListener('input', async (event) => {
  setTextureDesignSetting(state.textureFace, state.textureRegion, 'scale', Number(event.target.value));
  updateTextureDesignUi();
  await applyTextures();
});

$('#resetTextureView')?.addEventListener('click', async () => {
  state.textureZoom = 1;
  state.texturePanX = 0;
  state.texturePanY = 0;
  updateTextureUi();
  await applyTextures();
});

$$('[data-shirui-glass-material]').forEach((button) => button.addEventListener('click', async () => {
  state.shiruiGlassMaterial = button.dataset.shiruiGlassMaterial;
  syncShiruiGlassUi();
  await applyTextures();
}));

$('#shiruiGlassTransparencySlider')?.addEventListener('input', async (event) => {
  state.shiruiGlassTransparency = Number(event.target.value);
  syncShiruiGlassUi();
  await applyTextures();
});

$('#shiruiGlassFrostSlider')?.addEventListener('input', async (event) => {
  state.shiruiGlassFrost = Number(event.target.value);
  syncShiruiGlassUi();
  await applyTextures();
});

$$('[data-shirui-glass-light-enabled]').forEach((button) => button.addEventListener('click', () => {
  state.shiruiGlassLightEnabled = button.dataset.shiruiGlassLightEnabled === 'true';
  applyShiruiGlassLighting();
  syncShiruiGlassUi();
}));

$$('[data-shirui-glass-light-color]').forEach((button) => button.addEventListener('click', () => {
  state.shiruiGlassLightColor = button.dataset.shiruiGlassLightColor;
  applyShiruiGlassLighting();
  syncShiruiGlassUi();
}));

$('#shiruiGlassLightIntensitySlider')?.addEventListener('input', (event) => {
  state.shiruiGlassLightIntensity = Number(event.target.value);
  applyShiruiGlassLighting();
  syncShiruiGlassUi();
});

function currentSchemeDocument() {
  const frontColor = currentColorway('front', 'main');
  const backColor = currentColorway('back', 'main');
  const frontSurface = currentTextureSurface('front', 'main');
  const backSurface = currentTextureSurface('back', 'main');
  const type = TYPE_SPECS[state.type];
  const { aiScenes, ...stateConfig } = state;
  const config = {
    ...stateConfig,
    typeLabel: type?.label,
    lockLabel: lockSummaryLabel(),
    handleLabel: OPTION_LABELS.handle[state.handle],
    frontColorLabel: frontColor.label,
    backColorLabel: backColor.label,
    frontTextureSurfaceLabel: frontSurface.label,
    backTextureSurfaceLabel: backSurface.label
  };
  const document = createSchemeDocument({
    id: activeSchemeId,
    series: 'D90',
    product: state.product,
    productLabel: PRODUCTS[state.product].label,
    config,
    orderPayload: buildOrderPayload({
      series: 'D90', product: state.product, productLabel: PRODUCTS[state.product].label,
      typeLabel: type?.label, colorLabel: frontColor.label, backColorLabel: backColor.label, state
    }),
    aiScenes
  });
  activeSchemeId = document.id;
  return document;
}

function syncChoiceButtons() {
  const choices = [
    ['[data-door-type]', 'doorType', 'type'],
    ['[data-texture-face]', 'textureFace', 'textureFace'],
    ['[data-opening]', 'opening', 'opening'],
    ['[data-hinge]', 'hinge', 'hinge'],
    ['[data-frame-install]', 'frameInstall', 'frameInstall'],
    ['[data-frame-build]', 'frameBuild', 'frameBuild'],
    ['[data-lock]', 'lock', 'lock'],
    ['[data-handle]', 'handle', 'handle']
  ];
  choices.forEach(([selector, dataKey, stateKey]) => {
    $$(selector).forEach((button) => button.classList.toggle('selected', button.dataset[dataKey] === state[stateKey]));
  });
}

async function applySavedScheme(scheme) {
  if (scheme.series !== 'D90' || scheme.product !== state.product) {
    window.alert(`该方案属于 ${scheme.series} · ${scheme.productLabel}，请从对应产品入口打开。`);
    return;
  }
  activeSchemeId = scheme.id;
  Object.assign(state, scheme.config || {});
  state.product = lockedProduct;
  state.frontProduct = lockedProduct;
  state.backProduct = lockedProduct;
  state.frontTextureVariant ||= state.textureVariant || 'factory';
  state.backTextureVariant ||= state.textureVariant || 'factory';
  state.frontTextureSurface ||= state.textureSurface || 'factory';
  state.backTextureSurface ||= state.textureSurface || 'factory';
  normalizeD90HardwareState();
  state.aiScenes = scheme.aiScenes || [];
  if (!supportedTypesForState().includes(state.type)) state.type = PRODUCTS[state.product].defaultType;
  updateSliderRanges(false);
  $('#widthSlider').value = String(state.width);
  $('#heightSlider').value = String(state.height);
  $('#wallThicknessSlider').value = String(state.wallThickness);
  renderProductControls();
  syncChoiceButtons();
  updateTextureUi();
  updateHandleUi();
  await applyAssembly();
  applyFrameInstallation();
  applyHardware();
  setView(state.view || 'perspective');
}

function configuratorSnapshot() {
  const front = currentColorway('front', 'main');
  const back = currentColorway('back', 'main');
  const frontSurface = currentTextureSurface('front', 'main');
  const backSurface = currentTextureSurface('back', 'main');
  return {
    series: 'D90', product: state.product, productName: PRODUCTS[state.product].label,
    type: state.type, typeName: TYPE_SPECS[state.type]?.label, width: state.width, height: state.height,
    frontColor: front.label, backColor: back.label,
    frontTextureVariant: currentTextureVariant('front', 'main').label,
    backTextureVariant: currentTextureVariant('back', 'main').label,
    frontTextureSurface: frontSurface.label,
    backTextureSurface: backSurface.label,
    lock: lockSummaryLabel(), handle: hardwareSummaryLabel(),
    opening: OPTION_LABELS.opening[state.opening], hinge: state.hinge,
    wallThickness: state.wallThickness, frameInstall: OPTION_LABELS.frameInstall[state.frameInstall], frameBuild: OPTION_LABELS.frameBuild[state.frameBuild],
    textureView: { face: state.textureFace, zoom: state.textureZoom, panX: state.texturePanX, panY: state.texturePanY }
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

$$('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

$('#toggleDoorOpen').addEventListener('click', () => {
  state.open = !state.open;
  $('#toggleDoorOpen').classList.toggle('active', state.open);
  $('#toggleDoorOpen').textContent = state.open ? '关闭主门' : '打开主门';
  $('#doorPoseReadout').textContent = state.open
    ? `${state.opening.endsWith('left') ? '左锁' : '右锁'}门扇开启 76° · 合页轴转动`
    : `闭合状态 · ${state.opening.endsWith('left') ? '左锁' : '右锁'} · D90 门扇厚度 90 mm`;
  window.setTimeout(() => refitActiveCamera(), 960);
});

$('#resetView').addEventListener('click', () => setView('perspective'));

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

productInspector = initProductInspector({
  getContext: () => {
    const manifest = getTextureManifest('d90', state.frontProduct);
    const region = getTextureRegion('d90', state.frontProduct, state.type, 'main');
    const design = currentTextureDesign('front', 'main');
    return {
      productLabel: PRODUCTS[state.product].label,
      sourceType: manifest?.base?.type,
      type: state.type,
      texturePath: getTextureMapPath('d90', state.frontProduct, region?.map || 'master'),
      designLabel: design?.label || '产品一体主造型',
      designNote: design?.note,
      width: `${state.width} mm`,
      height: `${state.height} mm`,
      wallThickness: `${state.wallThickness || 120} mm`,
      frameLabel: `${state.frameProfile || state.frameInstall || 'D90'} 门框 · ${state.outerCasing || '标准门套'}`,
      frameColor: state.frameColor || state.outerCasingColor || '当前色板',
      frameInstall: state.frameInstall || '居中安装',
      threshold: state.threshold || '标准底槛',
      transomLabel: OPTION_LABELS.transom?.[state.transomType] || state.transomType || '无气窗',
      transomMaterial: state.transomMainMaterial,
      transomProcess: state.transomMainProcess,
      glassThickness: state.transomOuterGlassThickness || state.transomInnerGlassThickness || '—',
      hardwareLabel: `${lockSummaryLabel()} · ${hardwareSummaryLabel()}`,
      handleLabel: hardwareSummaryLabel(),
      sealLabel: state.sealCode || 'EPDM-江阴海达',
      hingeLabel: state.hinge === 'd90-heavy' ? 'D90 重载外合页' : 'D90 标配暗合页',
      lockLabel: `${lockSummaryLabel()} · ${hardwareSummaryLabel()}`,
      lockImage: state.lock === 'yt82' ? './assets/catalog/derived/hardware/textures/circular-lock-ai-v1.png' : './assets/catalog/derived/hardware/textures/smart-lock-ai-v1.png'
    };
  },
  onInspect: (part, detail = {}) => {
    const focus = detail.focus || ({ hinge: 'hinge', lock: 'hardware', hardware: 'hardware', frame: 'frame', transom: 'sidelight', composition: 'surface', design: 'surface' }[part] || 'surface');
    if (part === 'hinge' && !state.open) $('#toggleDoorOpen').click();
    if (['composition', 'design', 'frame', 'transom'].includes(part) && state.open) $('#toggleDoorOpen').click();
    window.setTimeout(() => setCameraFocus(focus), part === 'hinge' || state.open ? 760 : 40);
  }
});

// Let the assembled model itself open the product detail panel. The hit test
// walks object names to the nearest engineering group, so frame, glass,
// hardware and door-skin clicks remain meaningful after runtime rebuilding.
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

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(.05, clock.getDelta());
  const targetAngle = state.open ? THREE.MathUtils.degToRad(state.opening.startsWith('in-') ? -76 : 76) : 0;
  openAngle = THREE.MathUtils.damp(openAngle, targetAngle, 7.5, delta);
  const openChild = openingLeafRole() === 'child';
  if (mainPivot) mainPivot.rotation.y = openChild ? 0 : openAngle;
  if (childPivot) childPivot.rotation.y = openChild ? -openAngle : 0;
  applyOpeningDetails();
  if (viewTween) {
    const t = Math.min(1, (performance.now() - viewTween.start) / viewTween.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(viewTween.fromPosition, viewTween.toPosition, eased);
    controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, eased);
    if (t >= 1) viewTween = null;
  }
  controls.update();
  renderer.render(scene, camera);
}

renderProductControls();
updateTextureUi();
updateHandleUi();
updateSliderRanges(true);
resize();
loadModel();
animate();
