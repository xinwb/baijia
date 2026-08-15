/*
 * Fixed architectural layer for the YADILO product showroom.
 *
 * The door GLB remains the only configurable product object.  The wall,
 * reveal, trims and light lines are a separate exhibition fit-out: they do
 * not inherit door dimensions, door pivots, texture crops or hardware.
 */

const SHOWROOM_PRESETS = {
  k80: {
    base: {
      wall: 0x6f716c,
      backdrop: 0x8c8d87,
      recess: 0x2c2b28,
      trim: 0x1b1b19,
      wood: 0x624735,
      floor: 0xb6b4ae,
      floorReflection: 0xdfe4e2,
      light: 0xffb86a,
      background: 0xe1e0dc,
      fog: 0xe1e0dc,
      sideSlats: true,
      sideMetals: true,
      ceilingHousing: true,
      wallLights: true,
      warmFactor: 1,
      coolFactor: 1,
      ceilingFactor: 1,
      stripFactor: 1,
      wallRoughness: .76,
      recessRoughness: .39,
      floorRoughness: .38,
      floorMetalness: .18,
      floorClearcoat: .46,
      keyLight: 0xffe5c9,
      fillLight: 0xa8c7e8,
      rimLight: 0xf4bb7d,
      keyIntensity: 3.75,
      fillIntensity: 1.28,
      rimIntensity: 26,
      softboxKeyIntensity: 5.2,
      softboxFillIntensity: 3.0,
      ceilingStripIntensity: 2.0
    },
    ruojian: {
      wall: 0x8b8b84, backdrop: 0xb7b5ae, recess: 0x393631, trim: 0x24211e,
      wood: 0x76513a, floor: 0xc8c4bc, light: 0xffc47c, warmFactor: 1.12
    },
    yuanyin: {
      wall: 0x62564e, backdrop: 0x7c7067, recess: 0x211b18, trim: 0x181412,
      wood: 0x765039, floor: 0xaba59d, light: 0xffb56a, warmFactor: 1.18,
      sideSlats: true
    },
    jiangchuan: {
      wall: 0x626567, backdrop: 0x777a79, recess: 0x25292a, trim: 0x121516,
      wood: 0x594235, floor: 0xa9aaa8, light: 0xffc788, warmFactor: .96,
      sideSlats: false, coolFactor: 1.12
    },
    jinghong: {
      wall: 0x353736, backdrop: 0x444744, recess: 0x151716, trim: 0x0d0f0f,
      wood: 0x423329, floor: 0x777875, light: 0xffa75c, warmFactor: 1.08,
      sideSlats: false, wallRoughness: .68
    },
    qingya: {
      wall: 0x969790, backdrop: 0xd0cec7, recess: 0x3a3d39, trim: 0x1b1d1a,
      wood: 0x795a43, floor: 0xd1cec5, light: 0xffcf9a, warmFactor: 1.05,
      coolFactor: 1.06
    },
    qinghuafu: {
      wall: 0x4e5550, backdrop: 0x616963, recess: 0x19231f, trim: 0x0c1110,
      wood: 0x503b2e, floor: 0x969995, light: 0xffc06c, warmFactor: 1.15,
      sideSlats: false, wallRoughness: .70, coolFactor: .92
    }
  },
  d90: {
    base: {
      wall: 0x4d5050,
      backdrop: 0x666968,
      recess: 0x1d2020,
      trim: 0x101212,
      wood: 0x4d392c,
      floor: 0x979896,
      floorReflection: 0xc9d0ce,
      light: 0xffbd73,
      background: 0x393d3d,
      fog: 0x393d3d,
      sideSlats: false,
      sideMetals: true,
      ceilingHousing: true,
      wallLights: true,
      warmFactor: 1.05,
      coolFactor: 1.04,
      ceilingFactor: 1.08,
      stripFactor: 1,
      wallRoughness: .70,
      recessRoughness: .34,
      floorRoughness: .32,
      floorMetalness: .24,
      floorClearcoat: .52,
      keyLight: 0xffe0c0,
      fillLight: 0xb4d5e6,
      rimLight: 0xffb36c,
      keyIntensity: 3.45,
      fillIntensity: 1.45,
      rimIntensity: 29,
      softboxKeyIntensity: 5.0,
      softboxFillIntensity: 3.35,
      ceilingStripIntensity: 2.35
    },
    jinqu: {
      wall: 0x4b4e4e, backdrop: 0x656968, recess: 0x171a1a, trim: 0x111313,
      wood: 0x4a372b, floor: 0x999a96, light: 0xffc27a, warmFactor: 1.12
    },
    shirui: {
      wall: 0x667672, backdrop: 0x8d9991, recess: 0x20302e, trim: 0x101817,
      wood: 0x665e50, floor: 0xb3b9b2, light: 0xffe3ba, warmFactor: .72,
      coolFactor: 1.32, ceilingFactor: 1.16, sideMetals: false, wallRoughness: .78
    },
    shicui: {
      wall: 0x303536, backdrop: 0x454b4b, recess: 0x111718, trim: 0x0b0f0f,
      wood: 0x3d342b, floor: 0x707674, light: 0x9de3d1, warmFactor: .52,
      coolFactor: 1.44, stripFactor: 1.22, wallRoughness: .64
    },
    aige: {
      wall: 0x353636, backdrop: 0x4b4d4b, recess: 0x151616, trim: 0x0d0e0e,
      wood: 0x4c382a, floor: 0x7e807e, light: 0xffb66a, warmFactor: 1.15,
      coolFactor: .86, wallRoughness: .62
    },
    songge: {
      wall: 0x292a2a, backdrop: 0x3b3d3c, recess: 0x111111, trim: 0x090a0a,
      wood: 0x533b2b, floor: 0x6d6e6c, light: 0xffad60, warmFactor: 1.26,
      coolFactor: .74, wallRoughness: .60
    },
    guanmin: {
      wall: 0x34302c, backdrop: 0x45403a, recess: 0x17110d, trim: 0x241811,
      wood: 0x65442c, floor: 0x73716c, light: 0xffb96e, warmFactor: 1.42,
      coolFactor: .58, sideSlats: true, wallRoughness: .58, recessRoughness: .30
    }
  }
};

export function getShowroomPreset(series = 'k80', product = 'qinghuafu') {
  const seriesPreset = SHOWROOM_PRESETS[series] || SHOWROOM_PRESETS.k80;
  return { ...seriesPreset.base, ...(seriesPreset[product] || {}) };
}

function addBox(THREE, group, name, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.userData.baseSize = [...size];
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  group.add(mesh);
  return mesh;
}

function addFrame(THREE, group, prefix, width, height, depth, position, material, rail = .045) {
  const [x, y, z] = position;
  return [
    addBox(THREE, group, `${prefix}_Top`, [width, rail, depth], [x, y + height / 2, z], material),
    addBox(THREE, group, `${prefix}_Bottom`, [width, rail, depth], [x, y - height / 2, z], material),
    addBox(THREE, group, `${prefix}_Left`, [rail, height, depth], [x - width / 2, y, z], material),
    addBox(THREE, group, `${prefix}_Right`, [rail, height, depth], [x + width / 2, y, z], material)
  ];
}

function resizeBox(mesh, size, position) {
  if (!mesh) return;
  const base = mesh.userData.baseSize || size;
  mesh.scale.set(size[0] / base[0], size[1] / base[1], size[2] / base[2]);
  mesh.position.set(...position);
}

function createWallTexture(THREE, kind = 'stone') {
  const width = 384;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const base = kind === 'wood' ? [92, 62, 43] : [155, 157, 151];
  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const broad = Math.sin(x * .035 + Math.sin(y * .018) * 1.8) * 6
        + Math.sin(y * .022 + x * .009) * 4;
      const fine = Math.sin(x * 1.31 + y * .43) * 2.2 + Math.sin(x * .19 - y * .87) * 1.4;
      const grain = kind === 'wood' ? Math.sin(x * .14 + y * .006) * 10 : broad + fine;
      image.data[index] = Math.max(0, Math.min(255, base[0] + grain));
      image.data[index + 1] = Math.max(0, Math.min(255, base[1] + grain * .94));
      image.data[index + 2] = Math.max(0, Math.min(255, base[2] + grain * .88));
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  if (kind === 'stone') {
    context.save();
    context.globalAlpha = .12;
    context.strokeStyle = '#eef0eb';
    context.lineWidth = 2;
    for (let index = 0; index < 4; index += 1) {
      context.beginPath();
      context.moveTo(-30, 84 + index * 132);
      context.bezierCurveTo(120, 26 + index * 132, 260, 142 + index * 132, 430, 72 + index * 132);
      context.stroke();
    }
    context.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function physicalMaterial(THREE, texture, options = {}) {
  const bump = texture?.clone();
  if (bump) {
    bump.colorSpace = THREE.NoColorSpace;
    bump.needsUpdate = true;
  }
  return new THREE.MeshPhysicalMaterial({
    map: texture || null,
    bumpMap: bump || null,
    bumpScale: options.bumpScale ?? .018,
    color: options.color ?? 0xffffff,
    metalness: options.metalness ?? .05,
    roughness: options.roughness ?? .60,
    clearcoat: options.clearcoat ?? .08,
    clearcoatRoughness: .28,
    envMapIntensity: options.envMapIntensity ?? .40
  });
}

function addLightLine(THREE, group, name, position, height, color, controls) {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.2,
    roughness: .28,
    metalness: .08
  });
  const mesh = addBox(THREE, group, name, [.024, height, .025], position, material, { castShadow: false, receiveShadow: false });
  const area = new THREE.RectAreaLight(color, 1.4, .09, height * .74);
  area.position.set(position[0], position[1], position[2] + .055);
  area.lookAt(0, 1.9, .03);
  group.add(area);
  const point = new THREE.PointLight(color, .08, 2.2, 2);
  point.position.set(position[0], position[1], position[2] + .12);
  group.add(point);
  controls.strips.push({ mesh, material, area, point });
}

function addSideSlat(THREE, group, x, y, z, height, material, index) {
  return addBox(THREE, group, `Showroom_WoodSlat_${index}`, [.075, height, .13], [x, y, z], material, { castShadow: true, receiveShadow: true });
}

export function addVirtualShowroom({
  THREE,
  scene,
  backdrop,
  product = 'qinghuafu',
  series = 'k80',
  floorMaterial = null,
  floorReflection = null,
  lights = {}
} = {}) {
  if (!THREE || !scene || !backdrop || scene.getObjectByName('YADILO_Virtual_Showroom')) return null;

  const group = new THREE.Group();
  group.name = 'YADILO_Virtual_Showroom';
  group.userData.role = 'fixed-showroom-architecture';

  const controls = { strips: [], product: null, style: null };
  const wallTexture = createWallTexture(THREE, 'stone');
  wallTexture.repeat.set(2.2, 2.8);
  const woodTexture = createWallTexture(THREE, 'wood');
  woodTexture.repeat.set(1.0, 3.8);
  const palette = getShowroomPreset(series, product);
  const wallMaterial = physicalMaterial(THREE, wallTexture, { color: palette.wall, roughness: .76, bumpScale: .025, envMapIntensity: .28 });
  const recessMaterial = physicalMaterial(THREE, null, { color: palette.recess, metalness: .16, roughness: .39, clearcoat: .22, envMapIntensity: .60 });
  const trimMaterial = physicalMaterial(THREE, null, { color: palette.trim, metalness: .72, roughness: .24, clearcoat: .32, envMapIntensity: 1.12 });
  const woodMaterial = physicalMaterial(THREE, woodTexture, { roughness: .48, bumpScale: .016, envMapIntensity: .34 });
  const plinthMaterial = physicalMaterial(THREE, null, { color: 0x2a2926, metalness: .48, roughness: .30, clearcoat: .24, envMapIntensity: .82 });

  // A stone wall is kept behind the model as a real receiving surface. The
  // dark panel is the back of the door reveal, not a raised panel in front of
  // the product. Keeping it behind the leaf lets the structural jamb/casing
  // sit in the opening while retaining a deep shadow around the installation.
  const stoneWall = addBox(THREE, group, 'Showroom_StoneWall', [8.8, 5.15, .12], [0, 2.48, -.10], wallMaterial, { castShadow: false, receiveShadow: true });
  const doorNiche = addBox(THREE, group, 'Showroom_DoorNiche', [3.15, 3.95, .12], [0, 2.08, .02], recessMaterial, { castShadow: false, receiveShadow: true });
  const nicheTrim = addFrame(THREE, group, 'Showroom_NicheTrim', 3.30, 4.10, .10, [0, 2.08, .185], trimMaterial, .055);
  const topShadow = addBox(THREE, group, 'Showroom_TopShadow', [3.34, .09, .16], [0, 4.18, .16], trimMaterial);
  const floorPlinth = addBox(THREE, group, 'Showroom_FloorPlinth', [6.8, .16, .26], [0, .08, .00], plinthMaterial);

  // Warm wood / metal side articulation follows the exhibition walls seen in
  // the catalogue, but stays outside the configurable door opening.
  const sideSlats = [];
  [-2.56, -2.39, -2.22, 2.22, 2.39, 2.56].forEach((x, index) => {
    sideSlats.push(addSideSlat(THREE, group, x, 2.38, .04, 4.35, woodMaterial, index));
  });
  const sideMetals = [];
  [-1.80, 1.80].forEach((x, index) => {
    sideMetals.push(addBox(THREE, group, `Showroom_SideMetal_${index}`, [.035, 4.25, .10], [x, 2.28, .11], trimMaterial));
  });

  const warmWash = new THREE.RectAreaLight(0xffe0b8, 1.35, 2.8, 3.5);
  warmWash.position.set(-2.55, 3.25, -.20);
  warmWash.lookAt(0, 1.7, .10);
  group.add(warmWash);
  const coolWash = new THREE.RectAreaLight(0xd5e6ef, .92, 2.2, 3.2);
  coolWash.position.set(2.65, 3.05, -.12);
  coolWash.lookAt(0, 1.7, .10);
  group.add(coolWash);
  const ceilingWash = new THREE.RectAreaLight(0xfff1dd, 1.55, 4.1, .24);
  ceilingWash.position.set(0, 4.55, -.08);
  ceilingWash.lookAt(0, 1.1, .05);
  group.add(ceilingWash);

  const wallLights = [];
  [-1.70, 1.70].forEach((x, index) => {
    addLightLine(THREE, group, `Showroom_WallLight_${index}`, [x, 2.35, .255], 4.25, palette.light, controls);
    wallLights.push(controls.strips[controls.strips.length - 1]);
  });
  const ceilingHousing = addBox(THREE, group, 'Showroom_CeilingLightHousing', [4.7, .05, .16], [0, 4.52, .08], trimMaterial, { castShadow: false, receiveShadow: true });

  const architecture = {
    stoneWall, doorNiche, nicheTrim, topShadow, floorPlinth, sideSlats, sideMetals,
    ceilingHousing, wallLights
  };

  // The product GLB already owns the real structural frame.  A closed
  // showroom trim around the niche reads as a second door casing, so the
  // exhibition layer keeps the recess and its shadow but removes this outer
  // ring from the visible assembly.
  architecture.nicheTrim.forEach((trim) => {
    trim.visible = false;
    trim.userData.showroomOuterCasing = true;
  });

  const lighting = {
    gallery: { warm: 1.00, cool: 1.00, ceiling: 1.00, strip: 1.00 },
    daylight: { warm: .30, cool: 1.35, ceiling: 1.18, strip: .30 },
    evening: { warm: 1.35, cool: .16, ceiling: .58, strip: 1.24 }
  };

  function applyPresentationStyle(next) {
    controls.style = next;
    wallMaterial.color.setHex(next.wall);
    wallMaterial.roughness = next.wallRoughness ?? .76;
    wallMaterial.bumpScale = next.wallBumpScale ?? .025;
    wallMaterial.envMapIntensity = next.wallEnvMapIntensity ?? .28;
    recessMaterial.color.setHex(next.recess);
    recessMaterial.roughness = next.recessRoughness ?? .39;
    trimMaterial.color.setHex(next.trim);
    woodMaterial.color.setHex(next.wood);
    plinthMaterial.color.setHex(next.trim);
    [wallMaterial, recessMaterial, trimMaterial, woodMaterial, plinthMaterial].forEach((material) => {
      material.needsUpdate = true;
    });

    if (backdrop?.material) {
      backdrop.material.color.setHex(next.backdrop);
      backdrop.material.roughness = next.wallRoughness ?? .72;
      backdrop.material.needsUpdate = true;
    }
    if (floorMaterial) {
      floorMaterial.color.setHex(next.floor);
      floorMaterial.roughness = next.floorRoughness ?? .38;
      floorMaterial.metalness = next.floorMetalness ?? .18;
      floorMaterial.clearcoat = next.floorClearcoat ?? .46;
      floorMaterial.needsUpdate = true;
    }
    if (floorReflection?.material?.color?.setHex) floorReflection.material.color.setHex(next.floorReflection);
    if (scene.background?.setHex) scene.background.setHex(next.background);
    if (scene.fog?.color?.setHex) scene.fog.color.setHex(next.fog);

    const setLight = (light, color, intensity) => {
      if (!light) return;
      if (light.color?.setHex && color != null) light.color.setHex(color);
      if (intensity != null) light.intensity = intensity;
    };
    setLight(lights.hemi, next.fillLight, next.fillIntensity * .92);
    setLight(lights.key, next.keyLight, next.keyIntensity);
    setLight(lights.fill, next.fillLight, next.fillIntensity);
    setLight(lights.rim, next.rimLight, next.rimIntensity);
    setLight(lights.softboxKey, next.keyLight, next.softboxKeyIntensity);
    setLight(lights.softboxFill, next.fillLight, next.softboxFillIntensity);
    setLight(lights.ceilingStrip, next.light, next.ceilingStripIntensity);

    architecture.sideSlats.forEach((slat) => { slat.visible = next.sideSlats !== false; });
    architecture.sideMetals.forEach((metal) => { metal.visible = next.sideMetals !== false; });
    architecture.ceilingHousing.visible = next.ceilingHousing !== false;
    controls.strips.forEach(({ mesh, area, point }) => {
      const visible = next.wallLights !== false;
      mesh.visible = visible;
      area.visible = visible;
      point.visible = visible;
    });
  }

  function setProduct(nextProduct) {
    const next = getShowroomPreset(series, nextProduct);
    controls.product = nextProduct;
    applyPresentationStyle(next);
    controls.strips.forEach(({ material }) => {
      material.color.setHex(next.light);
      material.emissive.setHex(next.light);
      material.needsUpdate = true;
    });
  }

  function setLighting({ mode = 'gallery', intensity = 1, enabled = true } = {}) {
    const preset = lighting[mode] || lighting.gallery;
    const power = enabled ? THREE.MathUtils.clamp(Number(intensity) || 1, .25, 1.6) : 0;
    const style = controls.style || getShowroomPreset(series, product);
    warmWash.intensity = 1.35 * preset.warm * power * (style.warmFactor ?? 1);
    coolWash.intensity = .92 * preset.cool * power * (style.coolFactor ?? 1);
    ceilingWash.intensity = 1.55 * preset.ceiling * power * (style.ceilingFactor ?? 1);
    controls.strips.forEach(({ material, area, point }) => {
      material.emissiveIntensity = 2.2 * preset.strip * power * (style.stripFactor ?? 1);
      area.intensity = 1.4 * preset.strip * power * (style.stripFactor ?? 1);
      point.intensity = .08 * preset.strip * power * (style.stripFactor ?? 1);
      material.needsUpdate = true;
    });
  }

  function setDimensions({ width = 2.1, height = 2.6, type = 'double' } = {}) {
    const doorWidth = Math.max(.72, Number(width) || 2.1);
    const doorHeight = Math.max(2.0, Number(height) || 2.6);
    const nicheWidth = doorWidth + .52;
    const nicheHeight = doorHeight + .56;
    const nicheBottom = .10;
    const nicheCenterY = nicheBottom + nicheHeight / 2;
    const wallHeight = Math.max(4.55, nicheBottom + nicheHeight + .88);
    const wallWidth = Math.max(5.65, nicheWidth + 2.45);
    const trimWidth = nicheWidth + .14;
    const trimHeight = nicheHeight + .14;
    const trimCenterY = nicheCenterY;
    const sideInset = Math.max(1.72, nicheWidth / 2 + .78);
    const sideSlatGap = .17;
    const sideSlatHeight = Math.max(3.25, wallHeight - .20);
    const sideMetalHeight = Math.max(3.05, wallHeight - .30);

    resizeBox(architecture.stoneWall, [wallWidth, wallHeight, .12], [0, wallHeight / 2, -.10]);
    resizeBox(architecture.doorNiche, [nicheWidth, nicheHeight, .12], [0, nicheCenterY, .02]);
    resizeBox(architecture.nicheTrim[0], [trimWidth, .055, .10], [0, trimCenterY + trimHeight / 2, .185]);
    resizeBox(architecture.nicheTrim[1], [trimWidth, .055, .10], [0, trimCenterY - trimHeight / 2, .185]);
    resizeBox(architecture.nicheTrim[2], [.055, trimHeight, .10], [-trimWidth / 2, trimCenterY, .185]);
    resizeBox(architecture.nicheTrim[3], [.055, trimHeight, .10], [trimWidth / 2, trimCenterY, .185]);
    resizeBox(architecture.topShadow, [trimWidth + .04, .09, .16], [0, nicheBottom + nicheHeight + .10, .16]);
    resizeBox(architecture.floorPlinth, [wallWidth + .20, .16, .26], [0, .08, .00]);

    architecture.sideSlats.forEach((slat, index) => {
      const side = index < 3 ? -1 : 1;
      const localIndex = index % 3;
      const x = side * (sideInset + localIndex * sideSlatGap);
      resizeBox(slat, [.075, sideSlatHeight, .13], [x, sideSlatHeight / 2, .04]);
    });
    architecture.sideMetals.forEach((metal, index) => {
      const side = index === 0 ? -1 : 1;
      resizeBox(metal, [.035, sideMetalHeight, .10], [side * (nicheWidth / 2 + .23), sideMetalHeight / 2, .11]);
    });
    resizeBox(architecture.ceilingHousing, [Math.min(wallWidth - .60, nicheWidth + 1.55), .05, .16], [0, wallHeight - .08, .08]);

    const stripHeight = Math.max(3.05, wallHeight - .28);
    const stripOffset = Math.max(1.62, nicheWidth / 2 + .36);
    controls.strips.forEach(({ mesh, area, point }, index) => {
      const side = index === 0 ? -1 : 1;
      mesh.scale.y = stripHeight / (mesh.userData.baseSize?.[1] || 4.25);
      mesh.position.set(side * stripOffset, stripHeight / 2, .255);
      area.position.set(side * stripOffset, stripHeight / 2, .31);
      area.height = stripHeight * .74;
      area.lookAt(0, nicheCenterY, .03);
      point.position.set(side * stripOffset, stripHeight / 2, .375);
    });
    warmWash.position.set(-Math.max(1.55, nicheWidth / 2 + .78), wallHeight * .72, -.20);
    warmWash.lookAt(0, nicheCenterY, .10);
    coolWash.position.set(Math.max(1.55, nicheWidth / 2 + .78), wallHeight * .67, -.12);
    coolWash.lookAt(0, nicheCenterY, .10);
    ceilingWash.position.set(0, wallHeight - .05, -.08);
    ceilingWash.lookAt(0, nicheCenterY * .60, .05);
    wallTexture.repeat.set(Math.max(1.7, wallWidth / 3.35), Math.max(2.2, wallHeight / 1.75));
    woodTexture.repeat.set(1.0, Math.max(2.8, wallHeight / 1.12));
    wallTexture.needsUpdate = true;
    woodTexture.needsUpdate = true;
    group.userData.dimensions = { width: doorWidth, height: doorHeight, type, wallWidth, wallHeight, nicheWidth, nicheHeight };
  }

  group.userData.setProduct = setProduct;
  group.userData.setLighting = setLighting;
  group.userData.setDimensions = setDimensions;
  group.userData.setVisible = (visible) => {
    group.visible = Boolean(visible);
  };
  group.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    object.userData.showroomFixed = true;
    object.renderOrder = object.material.transparent ? 2 : 0;
  });
  scene.add(group);
  setProduct(product);
  setLighting();
  setDimensions();
  group.visible = false;
  return group;
}
