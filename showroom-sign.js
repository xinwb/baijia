import * as THREE from 'three';

const SIGN_TEXT = '雅帝乐私人订制';

function createSignTexture(renderer, label = SIGN_TEXT) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '600 174px "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  context.shadowColor = 'rgba(255, 202, 125, .34)';
  context.shadowBlur = 18;
  context.fillStyle = '#e2b878';
  context.fillText(label, 1024, 204);
  context.shadowBlur = 0;
  context.font = '500 28px Inter, "Helvetica Neue", Arial, sans-serif';
  context.fillStyle = 'rgba(229, 199, 154, .78)';
  context.fillText('YADILO  ·  PRIVATE CUSTOM', 1024, 352);
  context.fillStyle = 'rgba(229, 199, 154, .48)';
  context.fillRect(624, 401, 800, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 8);
  texture.needsUpdate = true;
  return texture;
}

function addBar(group, width, height, depth, material, x, y, z) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  bar.position.set(x, y, z);
  bar.castShadow = true;
  group.add(bar);
  return bar;
}

/**
 * Adds a fixed architectural wall plaque to the showroom, independent of
 * the door assembly. It intentionally lives on the wall, so door resizing,
 * leaf opening and hardware changes cannot move or distort the lettering.
 */
export function addShowroomSign({ scene, backdrop, renderer, label = SIGN_TEXT } = {}) {
  if (!scene || !backdrop) return null;

  const group = new THREE.Group();
  group.name = 'YADILO_Showroom_Sign';
  group.userData.role = 'showroom-wall-sign';

  const boardWidth = 2.18;
  const boardHeight = .52;
  const wallZ = Number.isFinite(backdrop.position.z) ? backdrop.position.z : -1.15;
  const wallY = Number.isFinite(backdrop.position.y) ? backdrop.position.y : 3;
  const boardY = wallY + .11;
  const frontZ = wallZ + .032;
  group.position.set(0, 0, 0);

  const boardMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x17191b,
    metalness: .82,
    roughness: .24,
    clearcoat: .50,
    clearcoatRoughness: .14,
    envMapIntensity: 1.15
  });
  const edgeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xb48752,
    metalness: .86,
    roughness: .20,
    clearcoat: .60,
    clearcoatRoughness: .12,
    envMapIntensity: 1.35
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(boardWidth, boardHeight, .046), boardMaterial);
  board.position.set(0, boardY, frontZ);
  board.castShadow = true;
  board.receiveShadow = true;
  group.add(board);

  const borderZ = frontZ + .028;
  const borderInset = .055;
  addBar(group, boardWidth - borderInset * 2, .010, .010, edgeMaterial, 0, boardY + boardHeight / 2 - borderInset, borderZ);
  addBar(group, boardWidth - borderInset * 2, .010, .010, edgeMaterial, 0, boardY - boardHeight / 2 + borderInset, borderZ);
  addBar(group, .010, boardHeight - borderInset * 2, .010, edgeMaterial, -boardWidth / 2 + borderInset, boardY, borderZ);
  addBar(group, .010, boardHeight - borderInset * 2, .010, edgeMaterial, boardWidth / 2 - borderInset, boardY, borderZ);

  const texture = createSignTexture(renderer, label);
  const textMaterial = new THREE.MeshPhysicalMaterial({
    map: texture,
    transparent: true,
    alphaTest: .02,
    color: 0xffffff,
    metalness: .78,
    roughness: .22,
    clearcoat: .48,
    clearcoatRoughness: .14,
    emissive: 0x2a1a0b,
    emissiveIntensity: .16,
    side: THREE.FrontSide
  });
  const text = new THREE.Mesh(new THREE.PlaneGeometry(1.86, .465), textMaterial);
  text.name = 'YADILO_Showroom_Sign_Lettering';
  text.position.set(0, boardY, borderZ + .006);
  text.castShadow = true;
  text.renderOrder = 3;
  group.add(text);

  // Tiny fasteners keep the plaque from reading as a floating flat texture.
  const screwMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd5b27e,
    metalness: .92,
    roughness: .18,
    clearcoat: .65,
    clearcoatRoughness: .1
  });
  const screwGeometry = new THREE.CylinderGeometry(.014, .014, .009, 24);
  const screwPositions = [
    [-boardWidth / 2 + .11, boardY + boardHeight / 2 - .11],
    [boardWidth / 2 - .11, boardY + boardHeight / 2 - .11],
    [-boardWidth / 2 + .11, boardY - boardHeight / 2 + .11],
    [boardWidth / 2 - .11, boardY - boardHeight / 2 + .11]
  ];
  screwPositions.forEach(([x, y]) => {
    const screw = new THREE.Mesh(screwGeometry, screwMaterial);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(x, y, borderZ + .012);
    screw.castShadow = true;
    group.add(screw);
  });

  const glow = new THREE.PointLight(0xe0a96d, .18, 2.4, 2);
  glow.position.set(0, boardY, borderZ + .10);
  group.add(glow);

  group.userData.label = label;
  scene.add(group);
  return group;
}
