import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

// 图片懒加载 - 延迟加载非首屏背景图
const lazyImages = document.querySelectorAll('.image-entry, .image-villa, .image-system, .store-image');
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const computedStyle = window.getComputedStyle(el);
      const bgImage = computedStyle.backgroundImage;
      // 触发浏览器预加载背景图
      if (bgImage && bgImage !== 'none') {
        const url = bgImage.slice(5, -2);
        const img = new Image();
        img.src = url;
      }
      observer.unobserve(el);
    }
  });
}, { rootMargin: '100px' });

lazyImages.forEach(img => imageObserver.observe(img));

const TYPE_DATA = [
  { name: '单门', note: '1000 × 2400 · 实物图', width: 1000, height: 2400, minW: 900, maxW: 1300, minH: 2200, maxH: 3000, transom: 0, transomHeight: 400, layout: [['main', 1]] },
  { name: '子母门', note: '1300 × 2600 · 实物图', width: 1300, height: 2600, minW: 1100, maxW: 1700, minH: 2300, maxH: 3100, transom: 0, transomHeight: 400, layout: [['child', .34], ['main', .66]] },
  { name: '对开门', note: '2100 × 2600 · 实物图', width: 2100, height: 2600, minW: 1800, maxW: 2400, minH: 2300, maxH: 3200, transom: 0, transomHeight: 400, layout: [['passive', .5], ['main', .5]] },
  { name: '双边边门', note: '3000 × 2600 · 对开 + 双边门', width: 3000, height: 2600, minW: 2400, maxW: 3600, minH: 2300, maxH: 3200, transom: 0, transomHeight: 400, layout: [['sidelight', .22], ['passive', .28], ['main', .28], ['sidelight', .22]] }
];
const FINISH_DATA = [
  { name: 'K9GBF-B-X201B', note: '星空蓝 · 双框竖肋', thumb: 'assets/source/legacy/k9/thumb-x201b.jpg', asset: 'assets/source/legacy/k9/k9-material-x201b-v1.png', design: 'x201b', mapScale: 1.02, frameTone: '#11191e' },
  { name: 'K9GBF-0102TA', note: '香槟灰平板 · 深色中梃', thumb: 'assets/source/legacy/k9/thumb-0102ta.jpg', asset: 'assets/source/legacy/k9/k9-material-0102ta-v2.png', design: 'ta', mapScale: 1.08, stripMm: 170, frameTone: '#625d56' },
  { name: 'K9GBF-0102TB', note: '岩灰平板 · 亮色中梃', thumb: 'assets/source/legacy/k9/thumb-0102tb.jpg', asset: 'assets/source/legacy/k9/k9-material-0102tb-v1.png', design: 'tb', mapScale: 1.1, stripMm: 120, frameTone: '#282a29' },
  { name: 'K9GBF-A32D', note: '油绿灰 · 四框线', thumb: 'assets/source/legacy/k9/thumb-a32d.jpg', asset: 'assets/source/legacy/k9/k9-material-a32d-v2.png', design: 'a32d', mapScale: 1.04, frameTone: '#697067' }
];
const SERIES_FINISH_DATA = [
  { name: '雅帝峥嵘产品', note: '真实实物 · 木纹模块拼接', thumb: 'assets/source/series/k80/products/zhengrong/雅帝峥嵘实物照片.jpg', asset: 'assets/source/series/k80/products/zhengrong/雅帝峥嵘纹理.jpg', textureAssets: ['assets/source/series/k80/products/zhengrong/雅帝峥嵘半幅纹理.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘半幅纹理.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘纹理.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘纹理.jpg'], design: 'yadirong', mapWidthByType: [1100, 1100, 2200, 2200], mapHeightMm: 3100, frameTone: '#5b514a', productAssets: ['assets/source/series/k80/products/zhengrong/雅帝峥嵘单门.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘子母门.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘对开门.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘对开门.jpg'] }
];
const ALL_FINISH_DATA = SERIES_FINISH_DATA;
const COLORS = [
  ['香槟金', '当前产品色', 0, '#5b514a', '#ffffff', 'none', ['assets/source/series/k80/products/zhengrong/雅帝峥嵘半幅纹理.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘半幅纹理.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘纹理.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘纹理.jpg']],
  ['米灰色', '独立米灰纹理', 0, '#918a83', '#ffffff', 'none', ['assets/source/series/k80/products/zhengrong/雅帝峥嵘半幅纹理-米灰色.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘半幅纹理-米灰色.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘纹理-米灰色.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘纹理-米灰色.jpg']],
  ['深灰色', '独立深灰纹理', 0, '#42484a', '#ffffff', 'none', ['assets/source/series/k80/products/zhengrong/雅帝峥嵘半幅纹理-深灰色.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘半幅纹理-深灰色.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘纹理-深灰色.jpg', 'assets/source/series/k80/products/zhengrong/雅帝峥嵘纹理-深灰色.jpg']]
];
const LOCKS = [['曜石黑智能锁', '指纹 / 密码 / NFC', 2600], ['静音机械锁', '经典机械锁体', 900], ['极简隐藏锁', '嵌入式拉手', 3800]];
const FRAMES = [['极窄型门框', '窄边型材 · 沿用产品色', 0, '#17191a'], ['拉丝型门框', '细腻拉丝 · 沿用产品色', 600, '#a88b66'], ['同色门框', '与门扇一体', 800, '#55504b']];
const CASINGS = [['P40 型门套', '厚型收口 · 现场适配', 1200, 'assets/source/series/k80/products/zhengrong/p40型门套.jpg'], ['WL3K 型门套', '窄边收口 · 现场适配', 900, 'assets/source/series/k80/products/zhengrong/wl3k型门套.jpg'], ['Z 型门套', '极简收口 · 现场适配', 700, 'assets/source/series/k80/products/zhengrong/z型门套.jpg']];
const HANDLES = [['曜石黑智能拉手 / 锁体', '指纹 / 密码 / NFC', 2600, 'assets/source/series/k80/products/zhengrong/把手.jpg'], ['雅帝乐长拉手 / 锁体', '竖向长拉手 · 实物参考', 1800, 'assets/source/series/k80/products/zhengrong/把手.jpg'], ['极简隐藏拉手 / 锁体', '嵌入式拉手', 3800, 'assets/source/series/k80/products/zhengrong/把手.jpg']];
const TRANSOMS = [['无气窗', '完整门体', 0], ['有气窗', '同框一体采光', 1200]];
const TRANSOM_TYPES = [['同色纹理气窗', '门扇同材一体', 0], ['长虹夹胶气窗', '暗色夹胶采光', 900], ['金属格栅气窗', '同色格栅半透', 1200]];
const GROUPS = [
  { key: 'type', title: '门型', note: 'Door structure', kind: 'type', options: TYPE_DATA.map((v, i) => [v.name, v.note, 1800 + i * 400]) },
  { key: 'finish', title: '门扇产品', note: '当前产品', kind: 'finish', options: ALL_FINISH_DATA.map((v, i) => [v.name, v.note, i * 900]) },
  { key: 'color', title: '产品颜色', note: '门扇 / 门框同色', kind: 'color', options: COLORS },
  { key: 'transom', title: '气窗', note: '可选 · 沿用本产品纹理', options: TRANSOMS },
  { key: 'transomType', title: '气窗类型', note: '同框一体 · 半透材质', options: TRANSOM_TYPES, conditional: true },
  { key: 'handle', title: '拉手 / 门锁（选配）', note: 'Integrated hardware', kind: 'asset', options: HANDLES },
  { key: 'frame', title: '门框', note: 'Inner frame', options: FRAMES },
  { key: 'casing', title: '门套（选配）', note: 'Optional casing', kind: 'asset', options: CASINGS }
];
const typeDimensions = TYPE_DATA.map(({ width, height }) => ({ width, height }));
const HALF_OPEN_ANGLE = 58;
const MIN_VIEW_PITCH = 0;
const MAX_VIEW_PITCH = 18;
const state = { type: 0, finish: 0, color: 0, transom: 0, transomType: 0, lock: 0, handle: 0, frame: 2, casing: 0, width: 1000, height: 2400, viewAngle: 18, viewPitch: 5, doorOpen: false };
const optionRoot = document.querySelector('#optionGroups');
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/'/g, "\\'");
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
let three;

function renderOptions() {
  optionRoot.innerHTML = GROUPS.map(group => {
    const options = group.key === 'finish' ? ALL_FINISH_DATA : group.options;
    const body = options.map((option, index) => {
      const name = group.kind === 'finish' ? option.name : option[0];
      const note = group.kind === 'finish' ? option.note : option[1];
      if (group.kind === 'type') return `<button class="option type-preview type-${index}" data-key="${group.key}" data-index="${index}"><span>${name}</span><small>${note}</small></button>`;
      if (group.kind === 'color') return `<button class="option color-swatch" data-key="${group.key}" data-index="${index}" style="--option-color:${option[3]}"><span>${name}</span><small>${note}</small></button>`;
      if (group.kind === 'finish' || group.kind === 'asset') return `<button class="option swatch ${group.kind === 'finish' ? 'finish-swatch' : 'asset-swatch'}" data-key="${group.key}" data-index="${index}" style="background-image:url('${esc(group.kind === 'finish' ? option.thumb : option[3])}')"><span>${name}</span><small>${note}</small></button>`;
      return `<button class="option" data-key="${group.key}" data-index="${index}">${option[0]}<small>${option[1]}</small></button>`;
    }).join('');
    return `<section class="option-group ${group.conditional ? 'conditional-group' : ''}" data-group="${group.key}"><div class="option-label"><span>${group.title}</span><small>${group.note}</small></div><div class="option-options">${body}</div></section>`;
  }).join('');
  optionRoot.querySelectorAll('.option-label').forEach(label => label.setAttribute('role', 'button'));
}

function optionCost(group) {
  if (group.key === 'transomType' && !state.transom) return 0;
  const options = group.key === 'finish' ? ALL_FINISH_DATA.map((item, index) => [item.name, item.note, index * 900]) : group.options;
  return Number(options[state[group.key]]?.[2] || 0);
}
function estimate() {
  const type = TYPE_DATA[state.type];
  return 8680 + GROUPS.reduce((sum, group) => sum + optionCost(group), 0) + Math.max(0, state.width - type.width) * 1.2 + Math.max(0, state.height - type.height) * .8;
}
function finishOptions() { return ALL_FINISH_DATA }
function activeFinish() { return finishOptions()[state.finish] }
function finishAsset() { const finish = activeFinish(); return activeColor()[6]?.[state.type] || finish.textureAssets?.[state.type] || finish.asset }
function activeColor() { return COLORS[state.color] }
function textureTint() { return activeColor()[4] }
function textureFilter() { return activeColor()[5] }
function blendColor(source, target, amount) {
  const color = new THREE.Color(source).lerp(new THREE.Color(target), amount);
  return `#${color.getHexString()}`;
}
// Product color is the single finish family for the complete opening. Frame
// and casing choices still change the profile treatment, but never switch to
// an unrelated black/gold color when the user changes the product swatch.
function frameColor() {
  const base = activeColor()[3];
  return state.frame === 0 ? blendColor(base, '#111416', .24) : state.frame === 1 ? blendColor(base, '#f2ede6', .16) : base;
}
function casingColor() {
  const base = activeColor()[3];
  return state.casing === 0 ? blendColor(base, '#171718', .24) : state.casing === 1 ? blendColor(base, '#f2ede6', .08) : blendColor(base, '#282321', .1);
}
function isPaired() { return TYPE_DATA[state.type].layout.length > 1 }
function colorHex(value) { return new THREE.Color(value) }
function getTexture(asset) {
  if (!textureCache.has(asset)) {
    const texture = textureLoader.load(asset, () => renderThreeDoor(lastDimensions));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    textureCache.set(asset, texture);
  }
  return textureCache.get(asset);
}
function makeTexture(base, range) {
  const texture = base.clone();
  texture.needsUpdate = true;
  texture.offset.set(range.x, range.y);
  texture.repeat.set(range.w, range.h);
  return texture;
}
function mat(color, roughness = .72, metalness = .08) {
  return new THREE.MeshStandardMaterial({ color: colorHex(color), roughness, metalness });
}
function makeContactShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 256;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.filter = 'blur(22px)';
  context.fillStyle = 'rgba(26, 21, 18, .42)';
  context.beginPath();
  if (context.roundRect) context.roundRect(30, 78, 580, 100, 24);
  else context.rect(30, 78, 580, 100);
  context.fill();
  context.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
function addBox(group, { x, y, z = 0, w, h, d, color, material }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material || mat(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
function addCylinder(group, { x, y, z, radius, depth, color, material }) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 32), material || mat(color));
  mesh.position.set(x, y, z);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
function clearGroup(group) {
  group.traverse(child => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach(material => material.dispose());
    else child.material?.dispose();
  });
  group.clear();
}
function initThree() {
  if (three) return three;
  const stage = $('#doorStage');
  const mount = document.createElement('div');
  mount.id = 'threeDoorMount';
  stage.appendChild(mount);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  mount.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  // Porsche's source configurator lets the product own the visual field. Keep
  // the door large enough to read its material and hardware while reserving a
  // lower band for the floor and directional shadow.
  const camera = new THREE.PerspectiveCamera(29, 1, .1, 20);
  camera.position.set(0, .12, 6.4);
  scene.add(new THREE.HemisphereLight(0xf7f4ee, 0x6c6259, 1.7));
  const key = new THREE.DirectionalLight(0xfff3e6, 3.2);
  key.position.set(-3.4, 4.8, 4.6);
  // Keep the shadow treatment consistent: the long, soft ground shadow below
  // is the visible shadow catcher, so the door must not add a hard projection
  // with a second unrelated silhouette on top of it.
  key.castShadow = false;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = .1;
  key.shadow.camera.far = 16;
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdce9ff, 1.05);
  fill.position.set(3.6, 2.4, 3.2);
  scene.add(fill);
  const backFill = new THREE.DirectionalLight(0xc9d3dc, .7);
  backFill.position.set(0, 3.2, -4.6);
  scene.add(backFill);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshStandardMaterial({ color: 0x786f67, roughness: .94, metalness: .02 })
  );
  floor.name = 'threeGround';
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: makeContactShadowTexture(), transparent: true, depthWrite: false, toneMapped: false })
  );
  contactShadow.name = 'threeContactShadow';
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.renderOrder = 2;
  scene.add(contactShadow);
  const root = new THREE.Group();
  scene.add(root);
  three = { mount, renderer, scene, camera, root, floor, contactShadow };
  return three;
}
let lastDimensions;
function paintThree() {
  if (!three) return;
  // The camera orbits the assembled door, so the floor and its shadow remain
  // fixed in world space while the user freely explores the model.
  $('#doorStage').classList.toggle('is-3d-active', state.doorOpen || Math.abs(state.viewAngle) > 1 || Math.abs(state.viewPitch) > 1);
  const yaw = THREE.MathUtils.degToRad(state.viewAngle);
  state.viewPitch = THREE.MathUtils.clamp(state.viewPitch, MIN_VIEW_PITCH, MAX_VIEW_PITCH);
  const pitch = THREE.MathUtils.degToRad(state.viewPitch);
  // Leave a quiet breathing band below the configurator toolbar so the top
  // profile never disappears under the chrome when the door is enlarged.
  const targetY = -.08;
  const radius = 6.9;
  const planarRadius = Math.cos(pitch) * radius;
  three.camera.position.set(
    Math.sin(yaw) * planarRadius,
    targetY + Math.sin(pitch) * radius,
    Math.cos(yaw) * planarRadius
  );
  three.camera.lookAt(0, targetY, 0);
  three.root.rotation.set(0, 0, 0);
  three.renderer.render(three.scene, three.camera);
}
function renderThreeDoor(dimensions) {
  if (!dimensions) return;
  lastDimensions = dimensions;
  const { mount, renderer, camera, root, floor, contactShadow } = initThree();
  const bounds = mount.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  renderer.setSize(bounds.width, bounds.height, false);
  camera.aspect = bounds.width / bounds.height;
  camera.updateProjectionMatrix();
  clearGroup(root);

  const type = TYPE_DATA[state.type], finish = activeFinish(), hasTransom = state.transom === 1;
  const scale = 1 / 1000, w = state.width * scale, h = state.height * scale;
  const frame = 48 * scale, transomDivider = 2 * scale;
  const casing = ([40, 30, 18][state.casing] || 40) * scale;
  const frameDepth = 82 * scale, casingDepth = 120 * scale, leafDepth = 54 * scale;
  const leafCenterZ = -leafDepth / 2 + 28 * scale;
  // The rear skin belongs to the leaf itself, just behind the leaf's back
  // face. Keeping it here (instead of at the wall's rear) makes open doors
  // rotate as one physical slab and keeps the same texture on both sides.
  const backSkinDepth = 8 * scale, backSkinZ = leafCenterZ - leafDepth / 2 - backSkinDepth / 2 - 1 * scale;
  const transomH = dimensions.transomMm * scale, leafH = dimensions.leafHeightMm * scale;
  const innerW = w - frame * 2, innerLeafH = leafH - frame * 2;
  const frameMat = mat(frameColor(), .34, .32), casingMat = mat(casingColor(), .4, .24);
  const baseTexture = getTexture(finishAsset());
  const textureReady = !!baseTexture.image;
  // One continuous material map spans the complete leaf opening. Each leaf
  // receives only its physical slice, so switching to Three.js cannot stretch
  // or restart the grain at a meeting stile.
  const mapW = finish.mapWidthByType?.[state.type] || finish.mapWidthMm || type.maxW * (finish.mapScale || 1.04), mapH = finish.mapHeightMm || type.maxH * (finish.mapScale || 1.04);
  const mapSize = { w: mapW * scale, h: mapH * scale };
  const mapRepeat = { w: Math.min(.98, innerW / mapSize.w), h: Math.min(.98, innerLeafH / mapSize.h) };
  const fullMapRepeatH = Math.min(.98, (transomH + innerLeafH) / mapSize.h);
  const mapOffset = { x: (1 - mapRepeat.w) / 2, y: (1 - fullMapRepeatH) / 2 };

  root.position.y = -.03;
  // Fit both dimensions. Using max here makes portrait doors overflow the
  // camera and leaves no room for the floor or its shadow.
  const fit = Math.min(.98, Math.max(.58, 2.2 / h), 2.2 / w);
  root.scale.setScalar(fit);
  const floorY = root.position.y - (h * fit) / 2 - .025;
  floor.position.set(0, floorY, -.12);
  contactShadow.position.set(.16, floorY + .006, .46);
  contactShadow.rotation.z = THREE.MathUtils.degToRad(-18);
  contactShadow.scale.set(Math.max(1.62, w * fit * 1.78), Math.max(1.08, 1.34 * fit), 1);

  // Casing and frame are hollow four-sided profiles. The previous solid
  // slabs visually sealed the opening whenever the leaf was turned aside.
  const casingOuterW = w + casing * 2, casingOuterH = h + casing * 2;
  const casingZ = -casingDepth / 2, frameZ = -frameDepth / 2 + 6 * scale;
  addBox(root, { x: 0, y: casingOuterH / 2 - casing / 2, z: casingZ, w: casingOuterW, h: casing, d: casingDepth, color: casingColor(), material: casingMat });
  addBox(root, { x: 0, y: -casingOuterH / 2 + casing / 2, z: casingZ, w: casingOuterW, h: casing, d: casingDepth, color: casingColor(), material: casingMat });
  addBox(root, { x: -w / 2 - casing / 2, y: 0, z: casingZ, w: casing, h: h, d: casingDepth, color: casingColor(), material: casingMat });
  addBox(root, { x: w / 2 + casing / 2, y: 0, z: casingZ, w: casing, h: h, d: casingDepth, color: casingColor(), material: casingMat });
  addBox(root, { x: -w / 2 + frame / 2, y: 0, z: frameZ, w: frame, h: h, d: frameDepth, color: frameColor(), material: frameMat });
  addBox(root, { x: w / 2 - frame / 2, y: 0, z: frameZ, w: frame, h: h, d: frameDepth, color: frameColor(), material: frameMat });
  addBox(root, { x: 0, y: h / 2 - frame / 2, z: frameZ, w: w, h: frame, d: frameDepth, color: frameColor(), material: frameMat });
  addBox(root, { x: 0, y: -h / 2 + frame / 2, z: frameZ, w: w, h: frame, d: frameDepth, color: frameColor(), material: frameMat });

  if (hasTransom) {
    const transomContentH = transomH - transomDivider;
    const ty = h / 2 - frame - transomContentH / 2;
    const transomRepeat = { w: Math.min(.98, innerW / mapSize.w), h: Math.min(.98, transomContentH / mapSize.h) };
    const transomTex = textureReady ? makeTexture(baseTexture, { x: (1 - transomRepeat.w) / 2, y: mapOffset.y + innerLeafH / mapSize.h, w: transomRepeat.w, h: transomRepeat.h }) : null;
    const tMat = new THREE.MeshStandardMaterial({ map: transomTex, color: colorHex(state.transomType === 1 ? '#6c7777' : textureTint()), roughness: .58, metalness: .02, side: THREE.DoubleSide, transparent: state.transomType !== 0, opacity: state.transomType === 0 ? 1 : .88 });
    addBox(root, { x: 0, y: ty, z: leafCenterZ, w: innerW, h: transomContentH, d: leafDepth, material: tMat });
    addBox(root, { x: 0, y: h / 2 - transomH - frame + transomDivider / 2, z: -frameDepth / 2 + 6 * scale, w: w - frame * 2, h: transomDivider, d: frameDepth, color: frameColor(), material: frameMat });
    addBox(root, { x: 0, y: ty, z: backSkinZ, w: innerW, h: transomContentH, d: backSkinDepth, material: tMat.clone() });
    if (state.transomType === 2) {
      for (let i = -3; i <= 3; i++)addBox(root, { x: i * innerW / 7, y: ty, z: leafDepth * .6, w: 8 * scale, h: transomContentH, d: 16 * scale, color: frameColor(), material: frameMat });
    }
  }

  let cursor = -innerW / 2;
  type.layout.forEach(([role, share]) => {
    const lw = innerW * share;
    const cx = cursor + lw / 2;
    const cy = -h / 2 + frame + innerLeafH / 2;
    const openable = role !== 'sidelight';
    // Hinges follow the actual assembly: the single-door lock is on the
    // meeting side, the sidelight door hinges away from the sidelight, and
    // paired leaves open symmetrically from their outside jambs.
    const hingeRight = role === 'main';
    const hingeX = hingeRight ? cursor + lw : cursor;
    const leafPivot = new THREE.Group();
    leafPivot.name = `${role}-leaf-pivot`;
    leafPivot.position.set(openable ? hingeX : 0, 0, leafCenterZ);
    if (openable) {
      const roleAngle = state.doorOpen ? (state.type === 1 && role === 'child' ? HALF_OPEN_ANGLE * .68 : HALF_OPEN_ANGLE) : 0;
      leafPivot.rotation.y = THREE.MathUtils.degToRad((hingeRight ? 1 : -1) * roleAngle);
    }
    root.add(leafPivot);
    const localCx = openable ? cx - hingeX : cx;
    const tx0 = mapOffset.x + (cursor + innerW / 2) / mapSize.w;
    const tex = textureReady ? makeTexture(baseTexture, { x: tx0, y: mapOffset.y, w: lw / mapSize.w, h: innerLeafH / mapSize.h }) : null;
    const leafMat = new THREE.MeshStandardMaterial({ map: tex, color: textureReady ? colorHex(textureTint()) : colorHex(frameColor()), roughness: .68, metalness: .03, side: THREE.DoubleSide, emissive: textureReady ? colorHex(textureTint()) : colorHex(frameColor()), emissiveIntensity: .045 });
    addBox(leafPivot, { x: localCx, y: cy, z: 0, w: lw, h: innerLeafH, d: leafDepth, material: leafMat });
    // A separate rear skin sits beyond the casing back, using the same
    // physical texture slice as the front leaf instead of a black backing.
    addBox(leafPivot, { x: localCx, y: cy, z: backSkinZ - leafCenterZ, w: lw, h: innerLeafH, d: backSkinDepth, material: leafMat.clone() });
    addBox(leafPivot, { x: openable ? cursor - hingeX : cursor, y: cy, z: -frameDepth / 2 + 22 * scale - leafCenterZ, w: frame * .36, h: innerLeafH, d: 20 * scale, color: frameColor(), material: frameMat });
    addDoorDesign(leafPivot, finish.design, role, localCx, cy, lw, innerLeafH, scale, frameMat, leafCenterZ);
    if (openable) addHinges(leafPivot, localCx, cy, lw, innerLeafH, scale, hingeRight);
    if (role === 'main' || ([2, 3].includes(state.type) && role === 'passive')) {
      const hardwareFrontZ = leafDepth / 2 + 6 * scale;
      addHardware(leafPivot, localCx, cy, lw, innerLeafH, scale, role, hardwareFrontZ);
    }
    cursor += lw;
  });
  addBox(root, { x: innerW / 2, y: -h / 2 + frame + innerLeafH / 2, z: -frameDepth / 2 + 22 * scale, w: frame * .36, h: innerLeafH, d: 20 * scale, color: frameColor(), material: frameMat });
  paintThree();
}
function addDoorDesign(root, design, role, cx, cy, w, h, scale, frameMat, zOffset = 0) {
  const profile = 12 * scale, inset = (role === 'child' ? 42 : 72) * scale;
  if (design === 'x201b') {
    const iw = w - inset * 2, ih = h - inset * 2, z = 72 * scale;
    // Keep the continuous material visible; the X201B pattern is a raised
    // frame plus ribs, not a second flat colour panel over the texture.
    addBox(root, { x: cx, y: cy + ih / 2 - profile / 2, z: z - zOffset, w: iw, h: profile, d: 10 * scale, material: frameMat });
    addBox(root, { x: cx, y: cy - ih / 2 + profile / 2, z: z - zOffset, w: iw, h: profile, d: 10 * scale, material: frameMat });
    addBox(root, { x: cx - iw / 2 + profile / 2, y: cy, z: z - zOffset, w: profile, h: ih, d: 10 * scale, material: frameMat });
    addBox(root, { x: cx + iw / 2 - profile / 2, y: cy, z: z - zOffset, w: profile, h: ih, d: 10 * scale, material: frameMat });
    const gap = 38 * scale;
    for (let x = cx - iw / 2 + gap; x < cx + iw / 2 - gap / 2; x += gap) addBox(root, { x, y: cy, z: 74 * scale - zOffset, w: 4 * scale, h: ih - profile * 2, d: 6 * scale, color: '#18262d' });
  }
  if (design === 'ta' || design === 'tb') {
    const strip = Math.min(w * .22, (design === 'ta' ? 170 : 120) * scale);
    const side = role === 'main' ? -1 : 1;
    addBox(root, { x: cx + side * (w / 2 - strip / 2), y: cy, z: 74 * scale - zOffset, w: strip, h: h, d: 16 * scale, color: design === 'ta' ? '#3b3936' : '#b4ab9a' });
  }
  if (design === 'a32d') {
    addBox(root, { x: cx, y: cy + h * .14, z: 72 * scale - zOffset, w: w - inset * 2, h: h * .48, d: profile, color: '#747b72' });
    addBox(root, { x: cx, y: cy - h * .28, z: 72 * scale - zOffset, w: w - inset * 2, h: h * .22, d: profile, color: '#747b72' });
  }
}
function addHinges(root, cx, cy, w, h, scale, hingeRight) {
  const hingeX = cx + (hingeRight ? 1 : -1) * (w / 2 - 11 * scale);
  const hingeMat = mat('#252728', .3, .72);
  [-.31, 0, .31].forEach(position => {
    addBox(root, { x: hingeX, y: cy + h * position, z: -20 * scale, w: 22 * scale, h: 94 * scale, d: 8 * scale, material: hingeMat });
    addCylinder(root, { x: hingeX, y: cy + h * position, z: -25 * scale, radius: 4 * scale, depth: 10 * scale, material: hingeMat });
  });
}
function addHardware(root, cx, cy, w, h, scale, role = 'main', frontZ = 32 * scale) {
  const bottom = 900 * scale;
  const x = [2, 3].includes(state.type) && role === 'passive' ? cx + w / 2 - 80 * scale : (isPaired() || state.type === 0) ? cx - w / 2 + 80 * scale : cx + w / 2 - 92 * scale;
  const y = cy - h / 2 + bottom + 55 * scale;
  const darkMetal = mat('#111415', .23, .82);
  const darkFace = mat('#25292a', .3, .62);
  const satinMetal = mat('#b9bec0', .2, .9);
  const warmMetal = mat('#b9a889', .24, .7);
  const faceZ = frontZ + 10 * scale;
  if (state.handle === 1) {
    addBox(root, { x, y: cy, z: frontZ, w: 26 * scale, h: 620 * scale, d: 16 * scale, material: satinMetal });
    addBox(root, { x, y: cy + 287 * scale, z: faceZ, w: 38 * scale, h: 28 * scale, d: 5 * scale, material: satinMetal });
    addBox(root, { x, y: cy - 287 * scale, z: faceZ, w: 38 * scale, h: 28 * scale, d: 5 * scale, material: satinMetal });
    addCylinder(root, { x, y: cy + 287 * scale, z: faceZ + 4 * scale, radius: 5 * scale, depth: 8 * scale, material: darkFace });
    addCylinder(root, { x, y: cy - 287 * scale, z: faceZ + 4 * scale, radius: 5 * scale, depth: 8 * scale, material: darkFace });
  } else if (state.handle === 2) {
    addBox(root, { x, y, z: frontZ, w: 22 * scale, h: 116 * scale, d: 18 * scale, material: darkMetal });
    addBox(root, { x, y, z: faceZ, w: 14 * scale, h: 80 * scale, d: 4 * scale, material: darkFace });
    addCylinder(root, { x, y: y + 24 * scale, z: faceZ + 4 * scale, radius: 4 * scale, depth: 8 * scale, material: satinMetal });
  } else if (state.lock === 1) {
    addBox(root, { x, y, z: frontZ, w: 34 * scale, h: 90 * scale, d: 18 * scale, material: darkMetal });
    addBox(root, { x, y, z: faceZ, w: 42 * scale, h: 98 * scale, d: 4 * scale, material: darkFace });
    addBox(root, { x: x - 42 * scale, y: y + 18 * scale, z: faceZ + 5 * scale, w: 72 * scale, h: 10 * scale, d: 16 * scale, material: warmMetal });
    addCylinder(root, { x: x + 18 * scale, y: y - 18 * scale, z: faceZ + 4 * scale, radius: 7 * scale, depth: 8 * scale, material: warmMetal });
  } else {
    const bodyH = state.lock === 2 ? 170 : 138;
    addBox(root, { x, y, z: frontZ, w: 44 * scale, h: bodyH * scale, d: 24 * scale, material: darkMetal });
    addBox(root, { x, y, z: faceZ, w: 48 * scale, h: (bodyH + 8) * scale, d: 4 * scale, material: darkFace });
    addBox(root, { x, y: y + 28 * scale, z: faceZ + 4 * scale, w: 24 * scale, h: 22 * scale, d: 4 * scale, material: darkMetal });
    addCylinder(root, { x, y: y - 35 * scale, z: faceZ + 5 * scale, radius: 11 * scale, depth: 10 * scale, material: satinMetal });
    addBox(root, { x, y: y - 70 * scale, z: faceZ + 3 * scale, w: 24 * scale, h: 52 * scale, d: 10 * scale, material: darkFace });
  }
}
function leafMarkup(role, index, finish) {
  const hardwareRole = role === 'main' || ([2, 3].includes(state.type) && role === 'passive');
  const hardwareClass = role === 'passive' ? 'passive-side' : (isPaired() || state.type === 0 ? 'meeting-side' : '');
  const hardware = hardwareRole ? `<div class="door-hardware hardware-${state.lock} handle-${state.handle} ${hardwareClass}" data-hotspot="lock"><i></i><b></b></div>` : '';
  const label = role === 'sidelight' ? '边门' : role === 'child' ? '子门' : role === 'passive' ? '副门' : '主门';
  return `<div class="door-leaf leaf-${role}" data-role="${role}" aria-label="${label}"><div class="leaf-design design-${finish.design}"></div>${hardware}</div>`;
}
function renderAssembly() {
  const type = TYPE_DATA[state.type], finish = activeFinish(), hasTransom = state.transom === 1;
  const sceneElement = $('#doorScene'), scene = sceneElement.getBoundingClientRect();
  const transomMm = hasTransom ? (type.transomHeight || 400) : 0;
  const leafHeightMm = state.height - transomMm;
  const maxH = Math.max(440, Math.floor((scene.height - 124) * .94));
  const maxW = Math.max(360, Math.floor((scene.width - 118) * .78));
  // Keep a little headroom at the default size, so height changes grow from
  // the threshold instead of every door appearing at the same maximum height.
  const pxPerMm = Math.min(maxH / Math.max(state.height, 2200), maxW / state.width, .42);
  const frameMm = 48;
  const frameStroke = Math.max(8, Math.round(frameMm * pxPerMm));
  const transomDivider = hasTransom ? Math.max(1, Math.round(2 * pxPerMm)) : 0;
  const casingMm = [40, 30, 18][state.casing] || 40;
  const casingWidth = Math.max(2, Math.round(casingMm * pxPerMm));
  const outerW = Math.round(state.width * pxPerMm), outerH = Math.round(state.height * pxPerMm), transomH = Math.round(transomMm * pxPerMm);
  const frameH = outerH - transomH;
  const opening = $('#doorOpening');
  opening.className = `door-opening assembly type-${state.type} casing-${state.casing}${hasTransom ? ' has-transom' : ''}`;
  const hardwareBottom = Math.round(900 * pxPerMm);
  const lockMm = state.handle === 1 ? { w: 26, h: 620 } : state.handle === 2 ? { w: 18, h: 110 } : state.lock === 1 ? { w: 16, h: 56 } : state.lock === 2 ? { w: 12, h: 116 } : { w: 44, h: 138 };
  const lockWidth = Math.max(4, Math.round(lockMm.w * pxPerMm));
  const lockHeight = Math.max(14, Math.round(lockMm.h * pxPerMm));
  const lockSide = Math.max(6, Math.round(80 * pxPerMm));
  // Each finish owns one maximum-size material canvas for this door type.
  // Resizing only changes the viewport over that canvas; it never rescales it.
  const mapScale = finish.mapScale || 1.04;
  const mapWidthMm = Math.round(finish.mapWidthByType?.[state.type] || finish.mapWidthMm || type.maxW * mapScale), mapHeightMm = Math.round(finish.mapHeightMm || type.maxH * mapScale);
  const mapWidth = Math.round(mapWidthMm * pxPerMm), mapHeight = Math.round(mapHeightMm * pxPerMm);
  const finishSize = `${mapWidth}px ${mapHeight}px`;
  const profile = Math.max(2, Math.round(12 * pxPerMm));
  const designInset = Math.max(12, Math.round(72 * pxPerMm));
  const stripFull = Math.max(24, Math.round((finish.stripMm || 140) * pxPerMm));
  opening.style.cssText = `--frame-stroke:${frameStroke}px;--transom-divider:${transomDivider}px;--transom-offset:${transomH}px;--casing-width:${casingWidth}px;--frame-color:${frameColor()};--casing-color:${casingColor()};--finish-filter:${textureFilter()};--finish-image:url('${finishAsset()}');--finish-size:${finishSize};--finish-map-width:${mapWidth}px;--finish-map-height:${mapHeight}px;--map-width-mm:${mapWidthMm};--map-height-mm:${mapHeightMm};--px-per-mm:${pxPerMm};--profile:${profile}px;--profile-wide:${Math.round(profile * 1.6)}px;--profile-gap:${Math.round(profile * 3.8)}px;--design-inset:${designInset}px;--design-inset-small:${Math.round(designInset * .68)}px;--design-inset-child:${Math.round(designInset * .45)}px;--center-strip-full:${stripFull}px;--center-strip-half:${Math.round(stripFull / 2)}px;--transom-inset:${Math.round(frameStroke * 1.2)}px;--transom-inset-wide:${Math.round(frameStroke * 1.6)}px;--hardware-bottom:${hardwareBottom}px;--hardware-width:${lockWidth}px;--hardware-height:${lockHeight}px;--hardware-side:${lockSide}px;width:${outerW}px;height:${outerH}px;grid-template-rows:${hasTransom ? `${transomH}px ` : ''}${frameH}px;`;
  const model = $('#doorModel');
  model.style.cssText = `--view-angle:${state.viewAngle}deg;--door-depth:28px;--frame-color:${frameColor()};--casing-color:${casingColor()};width:${outerW}px;height:${outerH}px;`;
  model.className = `door-model ${state.viewAngle < 0 ? 'view-left' : state.viewAngle > 0 ? 'view-right' : 'view-front'}`;
  const textureLayer = '<div class="surface-map"></div>';
  const transom = hasTransom ? `<div class="integrated-transom transom-${state.transomType} design-${finish.design}" data-hotspot="transom"><div class="transom-map"></div><div class="transom-design"></div><div class="glass-veil"></div><div class="transom-bars"></div></div>` : '';
  const leaves = type.layout.map(([role], index) => leafMarkup(role, index, finish)).join('');
  const columns = type.layout.map(([, share]) => `${share}fr`).join(' ');
  opening.innerHTML = `${transom}<div class="door-frame" style="grid-template-columns:${columns}">${textureLayer}${leaves}</div>`;
  const assembly = opening.getBoundingClientRect();
  const rulerBounds = $('.scene-sliders').getBoundingClientRect();
  sceneElement.style.setProperty('--door-left', `${assembly.left - rulerBounds.left}px`);
  sceneElement.style.setProperty('--door-top', `${assembly.top - rulerBounds.top}px`);
  sceneElement.style.setProperty('--door-width', `${assembly.width}px`);
  sceneElement.style.setProperty('--door-height', `${assembly.height}px`);
  $('#doorStage').style.setProperty('--assembly-left', `${assembly.left - scene.left}px`);
  $('#doorStage').style.setProperty('--assembly-bottom', `${scene.bottom - assembly.bottom}px`);
  $('#doorStage').style.setProperty('--assembly-right', `${scene.right - assembly.right}px`);
  return { transomMm, leafHeightMm, outerW, outerH };
}

function updateSelection() {
  optionRoot.querySelectorAll('.option').forEach(button => button.classList.toggle('selected', Number(button.dataset.index) === state[button.dataset.key]));
  const transomTypeGroup = $('[data-group="transomType"]');
  if (transomTypeGroup) transomTypeGroup.hidden = !state.transom;
  const doorAction = document.querySelector('[data-door-action="toggle-open"]');
  if (doorAction) {
    doorAction.classList.toggle('selected', state.doorOpen);
    doorAction.setAttribute('aria-pressed', String(state.doorOpen));
    doorAction.textContent = state.doorOpen ? '关闭门扇' : '半开门';
  }
  document.querySelectorAll('[data-view-angle]').forEach(button => {
    const selected = Number(button.dataset.viewAngle) === state.viewAngle && state.viewPitch === 0;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}
function updateLabels(dimensions) {
  const type = TYPE_DATA[state.type], finish = activeFinish(), hasTransom = state.transom === 1, price = estimate();
  $('#doorWidth').min = type.minW; $('#doorWidth').max = type.maxW; $('#doorWidth').value = state.width;
  $('#doorHeight').min = type.minH; $('#doorHeight').max = type.maxH; $('#doorHeight').value = state.height;
  document.querySelectorAll('[data-dimension="width"]').forEach(el => { el.min = type.minW; el.max = type.maxW; el.value = state.width });
  document.querySelectorAll('[data-dimension="height"]').forEach(el => { el.min = type.minH; el.max = type.maxH; el.value = state.height });
  $('.dimension-hint').textContent = `${type.name}可定制范围：${type.minW}–${type.maxW} × ${type.minH}–${type.maxH} mm`;
  $('#widthRangeValue').textContent = `${state.width} mm`; $('#heightRangeValue').textContent = `${state.height} mm`;
  $('#dimensionWidth').textContent = `W ${state.width} mm`; $('#dimensionHeight').textContent = `H ${state.height} mm`;
  $('#panelModelName').textContent = `雅帝乐 ${type.name}`;
  $('#configProgress').textContent = `${hasTransom ? 3 : 2} / 5`;
  $('#headerCount').textContent = '1';
  $('#orderType').textContent = type.name; $('#orderTexture').textContent = finish.name;
  $('#orderTransom').textContent = hasTransom ? TRANSOM_TYPES[state.transomType][0] : '无气窗';
  $('#orderHandle').textContent = HANDLES[state.handle][0]; $('#orderFrame').textContent = `${FRAMES[state.frame][0]} / ${CASINGS[state.casing][0]}`;
  $('#orderSize').textContent = `${state.width} × ${state.height} mm`; $('#orderPrice').textContent = `¥ ${Math.round(price).toLocaleString()}`;
  $('#previewPrice') && ($('#previewPrice').textContent = `¥ ${Math.round(price).toLocaleString()}`);
  $('#previewStateLabel') && ($('#previewStateLabel').textContent = state.doorOpen ? '半开 · 可拖动查看' : state.viewPitch > 0 || Math.abs(state.viewAngle) > 1 ? '3D · 可拖动查看' : '正面 · 可拖动查看');
  $('#orderVisual').innerHTML = `<div class="mini-door type-${state.type}" style="--mini-image:url('${finishAsset()}');--mini-frame:${frameColor()}"></div>`;
}
function update() {
  const type = TYPE_DATA[state.type];
  state.width = Math.min(type.maxW, Math.max(type.minW, Number(state.width) || type.width));
  state.height = Math.min(type.maxH, Math.max(type.minH, Number(state.height) || type.height));
  typeDimensions[state.type] = { width: state.width, height: state.height };
  updateSelection();
  const dimensions = renderAssembly();
  updateLabels(dimensions);
  renderThreeDoor(dimensions);
  // The configurator is intentionally a fixed desktop canvas. Selecting a
  // control must never scroll the door under the fixed navigation bar.
  if (window.scrollY) window.scrollTo(0, 0);
}

function focusGroup(key) {
  const group = $(`[data-group="${key}"]`); if (!group) return;
  group.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); group.classList.add('hotspot-focus');
  setTimeout(() => group.classList.remove('hotspot-focus'), 1000);
}
function openOrder() { $('#backdrop').classList.add('open'); $('#orderDrawer').classList.add('open') }
function closeOrder() { $('#backdrop').classList.remove('open'); $('#orderDrawer').classList.remove('open') }

const aiPanel = $('#aiPanel');
const aiPromptList = $('#aiPromptList');
const aiResult = $('#aiResult');
let aiPrompts = [];
let selectedAiPrompt = 0;

const siteHeader = document.querySelector('.site-header');
const menuToggle = document.querySelector('[data-menu-toggle]');
function setMenuOpen(open) {
  siteHeader?.classList.toggle('menu-open', open);
  menuToggle?.setAttribute('aria-expanded', String(open));
}
menuToggle?.addEventListener('click', event => {
  event.stopPropagation();
  setMenuOpen(!siteHeader?.classList.contains('menu-open'));
});
document.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
document.addEventListener('click', event => {
  if (siteHeader?.classList.contains('menu-open') && !event.target.closest('.site-nav')) setMenuOpen(false);
});

function aiScenePrompts() {
  const type = TYPE_DATA[state.type], finish = activeFinish();
  const transom = state.transom ? TRANSOM_TYPES[state.transomType][0] : '无气窗';
  const hardware = HANDLES[state.handle][0], frame = `${FRAMES[state.frame][0]}门框、${CASINGS[state.casing][0]}`;
  const door = `雅帝乐 ${type.name}，${finish.name}（${finish.note}），${transom}，${hardware}，${frame}，门洞尺寸 ${state.width}×${state.height}mm`;
  return [
    { title: '现代住宅 · 清晨入户', tag: '自然光', prompt: `真实建筑摄影，${door}，安装在现代极简住宅的入户玄关，浅灰微水泥墙面、浅橡木地面、低矮绿植与简洁壁灯，清晨柔和侧光，门体材质纹理和五金细节清晰，室内设计杂志质感，广角但不夸张，垂直构图，无人，无文字，无水印。` },
    { title: '独栋别墅 · 黄昏门廊', tag: '高级感', prompt: `高端真实建筑摄影，${door}，应用于现代独栋别墅的石材门廊，米灰天然石材、暖色线性灯、整洁台阶与少量景观植物，黄昏蓝调时刻，室内暖光从门缝和侧窗透出，准确还原门型比例、颜色、纹理和门锁，电影级但自然的光线，垂直构图，无人，无文字，无水印。` },
    { title: '城市公寓 · 夜间回家', tag: '生活感', prompt: `真实室内空间摄影，${door}，安装在城市高层公寓的入户区域，暖白墙面、深色木地板、艺术装饰画、柔和落地灯，夜晚安静归家氛围，门体是画面主体且保持完整结构，材质和五金真实可见，写实室内设计照片，垂直构图，无人，无文字，无水印。` }
  ];
}

function renderAiPrompts() {
  aiPrompts = aiScenePrompts();
  selectedAiPrompt = 0;
  $('#aiConfigSummary').textContent = `${TYPE_DATA[state.type].name} · ${activeFinish().name} · ${state.width} × ${state.height} mm`;
  aiPromptList.innerHTML = aiPrompts.map((item, index) => `<button type="button" class="ai-prompt ${index === 0 ? 'selected' : ''}" data-prompt-index="${index}"><span class="ai-prompt-number">0${index + 1}</span><span><b>${item.title}</b><small>${item.tag}</small></span><i aria-hidden="true">›</i></button>`).join('');
  aiResult.innerHTML = '';
}
function openAi() { renderAiPrompts(); $('#aiBackdrop').classList.add('open'); aiPanel.classList.add('open'); aiPanel.setAttribute('aria-hidden', 'false') }
function closeAi() { $('#aiBackdrop').classList.remove('open'); aiPanel.classList.remove('open'); aiPanel.setAttribute('aria-hidden', 'true') }
function showAiMessage(message, type = '') { aiResult.className = `ai-result ${type}`; aiResult.textContent = message }
function showAiImage(url) { aiResult.className = 'ai-result has-image'; aiResult.innerHTML = `<img src="${url}" alt="AI 生成的门应用场景" /><a href="${url}" target="_blank" rel="noreferrer">打开大图 ↗</a>` }
async function generateAiImage() {
  const config = window.YADILO_AI_CONFIG || {};
  if (!config.endpoint) { showAiMessage('尚未配置 AI 服务端代理。', 'error'); return }
  const button = $('#generateAiImage');
  button.disabled = true; button.classList.add('loading'); button.innerHTML = '<span class="ai-spinner" aria-hidden="true"></span> 正在生成…';
  showAiMessage('正在为你的门匹配真实空间与光线，请稍候…', 'loading');
  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), Number(config.timeoutMs) || 60000);
    let response;
    try {
      response = await fetch(config.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.model || 'gpt-image-2', prompt: aiPrompts[selectedAiPrompt].prompt, size: '1024x1536', quality: 'high' }), signal: controller.signal });
    } catch (requestError) {
      if (requestError?.name === 'AbortError') throw new Error('AI 生成超时，请稍后重试');
      throw requestError;
    } finally { window.clearTimeout(timeout); }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || data.error || data.message || `请求失败（${response.status}）`);
    const result = data.data?.[0];
    const url = result?.url || (result?.b64_json ? `data:image/png;base64,${result.b64_json}` : '');
    if (!url) throw new Error('接口没有返回图片地址');
    showAiImage(url);
  } catch (error) { showAiMessage(`生成失败：${error.message}`, 'error') }
  finally { button.disabled = false; button.classList.remove('loading'); button.innerHTML = '<span aria-hidden="true">✦</span> 生成场景 <span>→</span>' }
}

let pressTimer;
let dragView;
function toggleDoorOpen() {
  state.doorOpen = !state.doorOpen;
  if (state.doorOpen && Math.abs(state.viewAngle) <= 1 && Math.abs(state.viewPitch) <= 1) {
    state.viewAngle = 18;
    state.viewPitch = 5;
    document.querySelectorAll('[data-render-mode]').forEach(item => item.classList.toggle('selected', item.dataset.renderMode === '3d'));
  }
  update();
}
function cancelPress() { clearTimeout(pressTimer); pressTimer = undefined }
$('#doorScene').addEventListener('pointerdown', event => {
  if (event.target.closest('.view-angle-control,.scene-sliders,input,button')) return;
  const key = event.target.closest('[data-hotspot]')?.dataset.hotspot;
  if (key) pressTimer = setTimeout(() => focusGroup(key === 'transom' ? 'transomType' : 'handle'), 520);
  dragView = { x: event.clientX, y: event.clientY, angle: state.viewAngle, pitch: state.viewPitch, moved: false };
  event.currentTarget.setPointerCapture?.(event.pointerId);
});
$('#doorScene').addEventListener('pointermove', event => {
  if (!dragView) return;
  const dx = event.clientX - dragView.x, dy = event.clientY - dragView.y;
  if (Math.hypot(dx, dy) > 4) { dragView.moved = true; cancelPress() }
  if (!dragView.moved) return;
  state.viewAngle = dragView.angle + dx * .28;
  state.viewPitch = THREE.MathUtils.clamp(dragView.pitch - dy * .18, MIN_VIEW_PITCH, MAX_VIEW_PITCH);
  updateSelection();
  paintThree();
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(name => $('#doorScene').addEventListener(name, event => {
  cancelPress();
  if (dragView) event.currentTarget.releasePointerCapture?.(event.pointerId);
  dragView = undefined;
}));
$('#doorScene').addEventListener('dblclick', event => {
  if (event.target.closest('.view-angle-control,.scene-sliders,input,button')) return;
  toggleDoorOpen();
});

optionRoot.addEventListener('click', event => {
  const label = event.target.closest('.option-label');
  if (label) { label.closest('.option-group')?.classList.toggle('is-collapsed'); return; }
  const option = event.target.closest('.option'); if (!option) return;
  const key = option.dataset.key, index = Number(option.dataset.index);
  if (key === 'type') {
    typeDimensions[state.type] = { width: state.width, height: state.height }; state.type = index;
    state.width = typeDimensions[index].width; state.height = typeDimensions[index].height;
    state.transom = TYPE_DATA[index].transom; state.transomType = 0;
  } else if (key === 'transom') {
    const next = index === 1;
    if (next !== Boolean(state.transom)) state.height += next ? TYPE_DATA[state.type].transomHeight : -TYPE_DATA[state.type].transomHeight;
    state.transom = index;
  } else if (key === 'handle') {
    state.handle = index;
    state.lock = index === 0 ? 0 : 2;
  } else state[key] = index;
  update();
});
$('#optionSearch').addEventListener('input', event => {
  const query = event.target.value.trim().toLowerCase();
  optionRoot.querySelectorAll('.option-group').forEach(group => {
    let visible = 0;
    group.querySelectorAll('.option').forEach(option => {
      const match = !query || option.textContent.toLowerCase().includes(query);
      option.hidden = !match; if (match) visible++;
    });
    group.hidden = Boolean(query && !visible);
    if (query && visible) group.classList.remove('is-collapsed');
  });
});
document.querySelectorAll('[data-render-mode]').forEach(button => button.addEventListener('click', () => {
  const mode = button.dataset.renderMode;
  document.querySelectorAll('[data-render-mode]').forEach(item => item.classList.toggle('selected', item === button));
  state.viewPitch = mode === '3d' ? 5 : 0; state.viewAngle = mode === '3d' ? 18 : 0;
  if (mode === 'front') state.doorOpen = false;
  update();
}));
document.querySelector('[data-door-action="toggle-open"]')?.addEventListener('click', toggleDoorOpen);
document.querySelectorAll('[data-render-action="fullscreen"]').forEach(button => button.addEventListener('click', () => $('#doorScene').requestFullscreen?.()));
['doorWidth', 'doorHeight'].forEach(id => $("#" + id).addEventListener('input', event => { state[id === 'doorWidth' ? 'width' : 'height'] = Number(event.target.value); update() }));
document.querySelectorAll('[data-dimension]').forEach(input => input.addEventListener('input', event => { state[event.target.dataset.dimension] = Number(event.target.value); update() }));
document.querySelectorAll('[data-view-angle]').forEach(button => button.addEventListener('click', () => {
  state.viewAngle = Number(button.dataset.viewAngle) || 0;
  state.viewPitch = 0;
  update();
}));
document.addEventListener('click', event => {
  const target = event.target;
  if (target.closest?.('[data-open-order]')) openOrder();
  if (target.closest?.('[data-close-order]') || target.matches?.('#backdrop')) closeOrder();
  if (target.closest?.('[data-open-ai]')) openAi();
  if (target.closest?.('[data-close-ai]') || target.matches?.('#aiBackdrop')) closeAi();
  if (target.closest?.('[data-back-to-top]')) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (target.closest?.('[data-copy-scheme]')) {
    const schemeUrl = `${location.origin}${location.pathname}#configurator`;
    navigator.clipboard?.writeText(schemeUrl).catch(() => {});
    $('#toast').textContent = '方案链接已复制';
    $('#toast').classList.add('show');
    setTimeout(() => $('#toast').classList.remove('show'), 2200);
  }
  const prompt = event.target.closest('[data-prompt-index]');
  if (prompt) { selectedAiPrompt = Number(prompt.dataset.promptIndex); aiPromptList.querySelectorAll('.ai-prompt').forEach(item => item.classList.toggle('selected', item === prompt)) }
  if (target.closest?.('#generateAiImage')) generateAiImage();
  if (target.closest?.('#submitOrder')) {
    const name = $('#customerName').value.trim(), phone = $('#customerPhone').value.trim();
    $('#toast').textContent = name && /^1\d{10}$/.test(phone) ? '方案已提交，顾问会尽快与你联系' : '请填写正确的称呼和手机号码';
    $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 2400);
  }
});
addEventListener('resize', () => requestAnimationFrame(update));
renderOptions(); update();
