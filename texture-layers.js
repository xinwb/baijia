// Product-level texture layers.
//
// The catalogue images are product photographs, so the default state must keep
// the complete, photographed composition.  When a customer changes the main
// design, this module builds a canvas from three logical layers:
//   1. the original product finish (the base / cleaned underlay),
//   2. the product's main relief, light groove or continuous artwork,
//   3. optional integrated artwork that remains part of that design layer.
//
// This is intentionally data-driven.  A product never borrows another
// product's ornament and a continuous two-leaf composition is not mirrored.

const full = { kind: 'rect', x: 0, y: 0, w: 1, h: 1 };
const rect = (x, y, w, h) => ({ kind: 'rect', x, y, w, h });
const ellipse = (x, y, w, h) => ({ kind: 'ellipse', x, y, w, h });
const rects = (...items) => ({ kind: 'rects', items });
const polygon = (...points) => ({ kind: 'polygon', points });
const CLEAN_BASE_CACHE = new WeakMap();

// Jinqu's gold curve is wider than its visible highlight.  Keep one broad
// source mask for both the clean underlay and the movable relief so the
// photographed curve cannot remain behind a moved design.  The mask follows
// the full ribbon silhouette rather than the narrow outer edge only.
const jinquCurveMask = polygon(
  [.42, .03], [.88, .03], [.90, .22], [.84, .38], [.72, .56],
  [.60, .68], [.58, .76], [.72, .86], [.88, .97], [.40, .97],
  [.20, .92], [.06, .82], [.06, .68], [.22, .57], [.38, .47],
  [.53, .32], [.52, .16]
);
// The clean variant needs a neutral leaf underlay, not a partially repaired
// curve.  Rebuild the authored leaf interior from the two safe panel strips;
// the thin perimeter remains untouched so the frame and edge stay real.
const jinquFullMask = rect(.02, 0, .95, 1);

const product = (defaultLabel, mask, extra = {}) => ({
  enabled: false,
  // The right-hand "主造型强化/分格构图调整" mode separates the relief from
  // the photographed underlay, which keeps the default pair coherent when a
  // single-leaf or resized opening is composed.
  defaultDesign: 'focus',
  designableRegions: ['main', 'child'],
  designs: [
    {
      key: 'factory',
      label: '原厂主造型',
      note: defaultLabel,
      mode: 'source',
      mask
    },
    {
      key: 'clean',
      label: '净面底纹',
      note: extra.cleanNote || '隐藏纹理主造型，保留产品一体造型',
      mode: 'none',
      mask
    },
    {
      key: 'focus',
      label: '主造型强化',
      note: '独立移动 / 缩放主造型',
      mode: 'source',
      mask,
      defaultScale: 1.04
    }
  ],
  ...extra
});

// Masks are deliberately conservative.  They remove only the large visual
// motif from the underlay; the fine metal grain stays with the base layer.
// For continuous landscape/relief products, the complete map is the design
// layer because the two leaves together form one artwork.
export const TEXTURE_LAYER_MANIFEST_VERSION = '20261143';
export const TEXTURE_LAYER_MANIFEST = {
  k80: {
    ruojian: product('中缝橙色灯带与竖向主造型', rect(.45, .01, .072, .98), {
      enabled: true,
      designableRegions: ['main', 'child'],
      // The orange photographed feature is a narrow vertical recessed-light
      // strip. The wood-only base stays fixed; only this transparent strip
      // can move/scale in the custom layer editor.
      baseRepair: 'neighbor',
      extractDesign: true,
      extractMode: 'orange',
      extractThreshold: 48,
      extractFullAlpha: 80,
      maskFeather: .004,
      edgeFeather: .010,
      designs: [
        {
          key: 'factory',
          label: '竖向橙色凹槽灯带',
          note: '只保留实拍中的竖向橙色主造型',
          mode: 'source',
          mask: rect(.45, .01, .072, .98),
          preview: './assets/catalog/derived/k80/textures/k80-ruo-jian-orange-design-thumb-v1.png'
        },
        {
          key: 'focus',
          label: '灯带构图调整',
          note: '只移动 / 缩放橙色凹槽，不拉伸木纹底图',
          mode: 'source',
          mask: rect(.45, .01, .072, .98),
          preview: './assets/catalog/derived/k80/textures/k80-ruo-jian-orange-design-thumb-v1.png'
        }
      ]
    }),
    // The new catalogue elevations are locked product compositions. They
    // deliberately expose no generic motif editor until clean, separable
    // source layers are authored for each product.
    yijian: product('木纹中轴与横向智能拉手', full, { enabled: false, designs: [{ key: 'factory', label: '原厂门面', note: '保留意简原厂横向五金构图', mode: 'source', mask: full }] }),
    heya: product('深古铜肌理与通天权杖灯带', full, { enabled: false, designs: [{ key: 'factory', label: '原厂门面', note: '保留和雅原厂权杖灯带构图', mode: 'source', mask: full }] }),
    ouya: product('锦檀纹与门玻一体化构图', full, { enabled: false, designs: [{ key: 'factory', label: '原厂门面', note: '保留欧雅原厂门玻一体构图', mode: 'source', mask: full }] }),
    yuanyin: product('圆隐圆饰与上下弧线主造型', rects(
      rect(.02, .02, .94, .34),
      ellipse(.08, .35, .84, .46),
      rect(.00, .80, .80, .20)
    ), {
      enabled: true,
      designableRegions: ['main', 'child'],
      // 圆隐的金属圆饰、青绿色内圈和上下弧线是产品一体造型，
      // 不是额外通用拉手；因此随同一个主造型层同步移动。
      // The ornament is too large and too high-contrast for a blurred
      // inpaint. The runtime supplies a product-specific clean map instead.
      baseRepair: 'blur',
      extractDesign: true,
      cleanNote: '隐藏纹理主造型，保留圆隐金属底纹'
    }),
    jiangchuan: product('左右连续山水合纹', full, {
      enabled: true,
      designableRegions: ['main', 'child'],
      extractDesign: true,
      // The Jiangchuan relief is a low-contrast engraved line on the same
      // bronze tone as its base, so use a smaller difference threshold than
      // the high-contrast gold/green products.
      extractThreshold: 8,
      extractFullAlpha: 46,
      cleanNote: '隐藏连续山水主造型，保留江川金属底纹',
      designs: [
        { key: 'factory', label: '完整山水合纹', note: '左右门扇共同组成一幅画', mode: 'source', mask: full },
        { key: 'clean', label: '净面底纹', note: '隐藏连续山水主造型，保留江川金属底纹', mode: 'none', mask: full },
        { key: 'focus', label: '山水构图调整', note: '同步移动 / 缩放整幅画面', mode: 'source', mask: full, defaultScale: 1.03 }
      ]
    }),
    jinghong: product('中心浮雕圆饰', ellipse(.22, .40, .56, .42), {
      enabled: true,
      designableRegions: ['main', 'child'],
      extractDesign: true,
      cleanNote: '隐藏中心浮雕，保留荆虹金属底纹',
      maskFeather: .012
    }),
    qingya: product('中部暗色带与竖向格栅灯带', rects(
      rect(0, .54, 1, .16),
      rect(0, 0, .24, 1)
    ), {
      enabled: true,
      designableRegions: ['main', 'child'],
      extractDesign: true,
      cleanNote: '隐藏清雅主造型，保留象牙金属底纹',
      maskFeather: .006
    }),
    qinghuafu: product('左右连续山水与圆月饰面', full, {
      enabled: true,
      cleanNote: '隐藏山水圆月主造型，保留清华赋深色金属底纹',
      designableRegions: ['main', 'child'],
      extractDesign: true,
      designs: [
        { key: 'factory', label: '山水圆月合纹', note: '左右门扇共同组成一幅画', mode: 'source', mask: full },
        { key: 'clean', label: '净面底纹', note: '隐藏山水与圆月主造型', mode: 'none', mask: full },
        { key: 'focus', label: '主造型调整', note: '同步移动 / 缩放连续饰面', mode: 'source', mask: full, defaultScale: 1.03 }
      ]
    })
  },
  d90: {
    jinqu: product('金色曲线门花与侧光构图', jinquFullMask, {
      enabled: true,
      designableRegions: ['main'],
      // Jinqu is a two-material leaf: grey vertical panel on the left and
      // black metal panel on the right.  Copying a blurred average across
      // that boundary creates the brown/green ghost seen in the old clean
      // state, so repair each masked pixel from its own neighbouring panel.
      baseRepair: 'panel',
      baseRepairOptions: {
        split: .30,
        leftSampleStart: .15,
        leftSampleEnd: .25,
        leftFallbackStart: .03,
        leftFallbackEnd: .10,
        rightSampleStart: .82,
        rightSampleEnd: .96,
        topClamp: .055,
        bottomClamp: .945
      },
      cleanupMask: jinquFullMask,
      extractDesign: true,
      extractMode: 'gold',
      extractThreshold: 18,
      extractFullAlpha: 72,
      maskFeather: .004,
      edgeFeather: .018,
      cleanNote: '隐藏金色曲线门花，保留黑色基底与左侧灰纹理',
      designs: [
        { key: 'factory', label: '金色曲线门花', note: '保留金曲原厂弧线构图', mode: 'source', mask: jinquFullMask },
        { key: 'clean', label: '净面底纹', note: '隐藏弧线，保留黑灰基底', mode: 'none', mask: jinquFullMask },
        { key: 'focus', label: '曲线构图调整', note: '移动 / 缩放金色一体门花', mode: 'source', mask: jinquFullMask,
          defaultScale: 1.03
        }
      ]
    }),
    shirui: product('右门扇几何金属造型', rects(
      rect(.135, .00, .035, 1), rect(.425, .00, .035, 1),
      rect(.695, .00, .035, 1), rect(.885, .00, .035, 1)
    ), {
      enabled: true,
      designableRegions: ['main'],
      baseRepair: 'inpaint',
      maskFeather: .006,
      edgeFeather: .012,
      cleanNote: '隐藏绿色竖向嵌条，保留世瑞金属分格底纹',
      designs: [
        { key: 'factory', label: '几何绿嵌条', note: '保留世瑞原厂错位分格', mode: 'source', mask: rects(
          rect(.135, .00, .035, 1), rect(.425, .00, .035, 1),
          rect(.695, .00, .035, 1), rect(.885, .00, .035, 1)
        ) },
        { key: 'clean', label: '净面底纹', note: '隐藏绿色嵌条，保留金属面板', mode: 'none', mask: rects(
          rect(.135, .00, .035, 1), rect(.425, .00, .035, 1),
          rect(.695, .00, .035, 1), rect(.885, .00, .035, 1)
        ) },
        { key: 'focus', label: '分格构图调整', note: '移动 / 缩放几何嵌条组', mode: 'source', mask: rects(
          rect(.135, .00, .035, 1), rect(.425, .00, .035, 1),
          rect(.695, .00, .035, 1), rect(.885, .00, .035, 1)
        ), defaultScale: 1.02 }
      ]
    }),
    // 拾翠的青绿色灯带已经作为独立一体式拉手建模，黑色框线和上下
    // 浮雕属于固定门扇工艺，不再伪装成可任意移动的平面纹理。
    shicui: product('上下浮雕与玉石灯带一体结构', full, {
      enabled: false,
      designableRegions: [],
      notEditableNote: '玉石灯带由一体式拉手模型承载；门花属于固定压型结构'
    }),
    aige: product('炫光黑古典浮雕门花', rect(.06, .06, .88, .88), {
      enabled: true,
      // The double-door editor synchronizes main/child as one pair. Keep
      // both roles declared so a direct region update cannot leave one leaf
      // behind when the Aige panel is re-composed.
      designableRegions: ['main', 'child'],
      baseRepair: 'inpaint',
      // Aige's factory map is a complete leaf with black metal base plus
      // shallow classical relief. For non-factory presets extract the relief
      // from the base-repaired image so the base and the movable design are
      // separate layers instead of moving a rectangular screenshot.
      extractDesign: true,
      extractThreshold: 16,
      extractFullAlpha: 88,
      maskFeather: .006,
      edgeFeather: .018,
      cleanNote: '隐藏古典浮雕，保留黑色金属底纹；拉手和门环由五金层独立承载',
      designs: [
        { key: 'factory', label: '古典浮雕门花', note: '保留爱格单叶完整构图', mode: 'source', mask: rect(.06, .06, .88, .88) },
        { key: 'clean', label: '净面底纹', note: '隐藏内侧浮雕门花', mode: 'none', mask: rect(.06, .06, .88, .88) },
        { key: 'focus', label: '浮雕构图调整', note: '同步移动 / 缩放两侧门花', mode: 'source', mask: rect(.06, .06, .88, .88), defaultScale: 1.02 }
      ]
    }),
    songge: product('颂歌上下曲线门花', rect(.05, .05, .90, .90), {
      enabled: true,
      designableRegions: ['main'],
      baseRepair: 'inpaint',
      maskFeather: .006,
      edgeFeather: .018,
      cleanNote: '隐藏上下曲线门花，保留炫光黑底纹与门扇边界',
      designs: [
        { key: 'factory', label: '上下曲线门花', note: '保留颂歌单叶完整构图', mode: 'source', mask: rect(.05, .05, .90, .90) },
        { key: 'clean', label: '净面底纹', note: '隐藏曲线门花', mode: 'none', mask: rect(.05, .05, .90, .90) },
        { key: 'focus', label: '曲线构图调整', note: '同步移动 / 缩放两侧门花', mode: 'source', mask: rect(.05, .05, .90, .90), defaultScale: 1.02 }
      ]
    }),
    guanmin: product('冠冕下部宫廷门花', rects(
      rect(.06, .05, .40, .90),
      rect(.54, .05, .40, .90)
    ), {
      enabled: true,
      designableRegions: ['main'],
      baseRepair: 'inpaint',
      maskFeather: .006,
      edgeFeather: .016,
      cleanNote: '隐藏门扇宫廷门花，固定拱顶气窗与门框结构',
      designs: [
        { key: 'factory', label: '宫廷门花', note: '保留冠冕原厂双扇构图', mode: 'source', mask: rects(
          rect(.06, .05, .40, .90), rect(.54, .05, .40, .90)
        ) },
        { key: 'clean', label: '净面底纹', note: '隐藏下部宫廷门花', mode: 'none', mask: rects(
          rect(.06, .05, .40, .90), rect(.54, .05, .40, .90)
        ) },
        { key: 'focus', label: '门花构图调整', note: '同步移动 / 缩放两侧宫廷门花', mode: 'source', mask: rects(
          rect(.06, .05, .40, .90), rect(.54, .05, .40, .90)
        ), defaultScale: 1.015 }
      ]
    })
  }
};

export function getTextureLayerProfile(series, productKey) {
  return TEXTURE_LAYER_MANIFEST[series]?.[productKey] || null;
}

export function getTextureDesigns(series, productKey, region = 'main') {
  const profile = getTextureLayerProfile(series, productKey);
  if (!profile?.enabled || !profile.designableRegions?.includes(region)) return [];
  return profile.designs || [];
}

export function getTextureDesign(series, productKey, region, key) {
  const designs = getTextureDesigns(series, productKey, region);
  return designs.find((item) => item.key === key) || designs[0] || null;
}

export function getDefaultTextureDesign(series, productKey, region = 'main') {
  const profile = getTextureLayerProfile(series, productKey);
  const designs = getTextureDesigns(series, productKey, region);
  return designs.find((item) => item.key === profile?.defaultDesign) || designs[0] || null;
}

function drawMaskPath(context, mask, width, height) {
  if (!mask) {
    context.rect(0, 0, width, height);
    return;
  }
  if (mask.kind === 'rects') {
    mask.items.forEach((item) => drawMaskPath(context, item, width, height));
    return;
  }
  if (mask.kind === 'polygon') {
    const points = mask.points || [];
    if (!points.length) return;
    context.moveTo((points[0][0] || 0) * width, (points[0][1] || 0) * height);
    points.slice(1).forEach(([pointX, pointY]) => context.lineTo((pointX || 0) * width, (pointY || 0) * height));
    context.closePath();
    return;
  }
  const x = (mask.x || 0) * width;
  const y = (mask.y || 0) * height;
  const w = (mask.w ?? 1) * width;
  const h = (mask.h ?? 1) * height;
  if (mask.kind === 'ellipse') {
    context.ellipse(x + w / 2, y + h / 2, Math.max(1, w / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
    return;
  }
  context.rect(x, y, w, h);
}

function createMaskCanvas(mask, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.beginPath();
  drawMaskPath(context, mask || full, width, height);
  context.fill();
  return canvas;
}

function mapNormalizedMask(mask, contentRect = null) {
  if (!contentRect || (contentRect.x === 0 && contentRect.y === 0 && contentRect.w === 1 && contentRect.h === 1)) return mask;
  if (!mask) return full;
  if (mask.kind === 'rects') return {
    kind: 'rects',
    items: mask.items.map((item) => mapNormalizedMask(item, contentRect))
  };
  if (mask.kind === 'polygon') return {
    kind: 'polygon',
    points: mask.points.map(([x, y]) => [contentRect.x + x * contentRect.w, contentRect.y + y * contentRect.h])
  };
  return {
    ...mask,
    x: contentRect.x + (mask.x || 0) * contentRect.w,
    y: contentRect.y + (mask.y || 0) * contentRect.h,
    w: (mask.w ?? 1) * contentRect.w,
    h: (mask.h ?? 1) * contentRect.h
  };
}

function createCleanBase(image, mask, repair = 'blur', repairOptions = {}) {
  const width = image.width;
  const height = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0);

  if (repair === 'panel') {
    // Preserve the two authored materials on products whose ornament crosses
    // a panel seam.  The sample column is taken at the same height, so the
    // vertical grain/lighting remains real rather than becoming a stretched
    // colour block.
    const source = context.getImageData(0, 0, width, height);
    const maskCanvas = createMaskCanvas(mask, width, height);
    const maskData = maskCanvas.getContext('2d').getImageData(0, 0, width, height).data;
    const contentRect = repairOptions.contentRect || { x: 0, y: 0, w: 1, h: 1 };
    const splitLocal = repairOptions.split ?? .5;
    const leftSampleStart = repairOptions.leftSampleStart ?? repairOptions.leftSample ?? .12;
    const leftSampleEnd = repairOptions.leftSampleEnd ?? leftSampleStart;
    const leftFallbackStart = repairOptions.leftFallbackStart ?? leftSampleStart;
    const leftFallbackEnd = repairOptions.leftFallbackEnd ?? leftSampleEnd;
    const rightSampleStart = repairOptions.rightSampleStart ?? repairOptions.rightSample ?? .82;
    const rightSampleEnd = repairOptions.rightSampleEnd ?? rightSampleStart;
    const topClamp = repairOptions.topClamp ?? 0;
    const bottomClamp = repairOptions.bottomClamp ?? 1;
    for (let y = 0; y < height; y += 1) {
      const logicalY = contentRect.h > 0 ? (y / height - contentRect.y) / contentRect.h : y / height;
      const clampedY = Math.min(bottomClamp, Math.max(topClamp, logicalY));
      const safeY = Math.min(height - 1, Math.max(0, Math.round((contentRect.y + clampedY * contentRect.h) * height)));
      for (let x = 0; x < width; x += 1) {
        if (maskData[(y * width + x) * 4 + 3] < 96) continue;
        const logicalX = contentRect.w > 0 ? (x / width - contentRect.x) / contentRect.w : x / width;
        let sampleLogicalX;
        if (logicalX < splitLocal) {
          const localX = Math.min(1, Math.max(0, logicalX / Math.max(.0001, splitLocal)));
          sampleLogicalX = leftSampleStart + (leftSampleEnd - leftSampleStart) * localX;
        } else {
          const rightStart = splitLocal;
          const localX = Math.min(1, Math.max(0, (logicalX - rightStart) / Math.max(.0001, 1 - rightStart)));
          sampleLogicalX = rightSampleStart + (rightSampleEnd - rightSampleStart) * localX;
        }
        let sampleX = Math.round((contentRect.x + sampleLogicalX * contentRect.w) * width);
        let sourceOffset = (safeY * width + Math.min(width - 1, Math.max(0, sampleX))) * 4;
        // The lower Jinqu curve crosses the grey panel. If the preferred
        // grey texture sample is itself warm/gold at that height, fall back
        // to the narrow outer grey strip instead of copying the ornament.
        if (logicalX < splitLocal && repairOptions.leftFallbackStart != null) {
          const sampleRed = source.data[sourceOffset];
          const sampleGreen = source.data[sourceOffset + 1];
          const sampleBlue = source.data[sourceOffset + 2];
          if (sampleRed - sampleBlue + (sampleGreen - sampleBlue) * .55 > (repairOptions.goldThreshold ?? 18)) {
            const fallbackX = leftFallbackStart + (leftFallbackEnd - leftFallbackStart) * Math.min(1, Math.max(0, logicalX / Math.max(.0001, splitLocal)));
            sampleX = Math.round((contentRect.x + fallbackX * contentRect.w) * width);
            sourceOffset = (safeY * width + Math.min(width - 1, Math.max(0, sampleX))) * 4;
          }
        }
        const targetOffset = (y * width + x) * 4;
        source.data[targetOffset] = source.data[sourceOffset];
        source.data[targetOffset + 1] = source.data[sourceOffset + 1];
        source.data[targetOffset + 2] = source.data[sourceOffset + 2];
        source.data[targetOffset + 3] = source.data[sourceOffset + 3];
      }
    }
    context.putImageData(source, 0, 0);
    return canvas;
  }

  if (repair === 'neighbor' && mask?.kind === 'rect') {
    const x = Math.max(0, Math.round(mask.x * width));
    const y = Math.max(0, Math.round(mask.y * height));
    const w = Math.max(1, Math.round(mask.w * width));
    const h = Math.max(1, Math.round(mask.h * height));
    const sampleW = Math.max(w, Math.min(Math.round(width * .07), width - w));
    const sourceX = Math.max(0, x - sampleW - Math.round(width * .012));
    context.save();
    context.beginPath();
    drawMaskPath(context, mask, width, height);
    context.clip();
    // Copy a neighbouring vertical grain strip at 1:1 texel density. This
    // removes only the groove and does not stretch the surrounding wood.
    context.drawImage(image, sourceX, y, w, h, x, y, w, h);
    context.restore();
    return canvas;
  }

  if (repair === 'inpaint') {
    // Propagate the real surrounding metal/finish pixels into the masked
    // motif. This is deliberately local inpainting, not a stretched colour
    // tile: the outer border and grain remain untouched and the removed
    // ornament cannot reappear as a blurred ghost when it is moved.
    const source = context.getImageData(0, 0, width, height);
    const maskCanvas = createMaskCanvas(mask, width, height);
    const maskData = maskCanvas.getContext('2d').getImageData(0, 0, width, height).data;
    const total = width * height;
    const resolved = new Uint8Array(total);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;
    for (let index = 0; index < total; index += 1) {
      if (maskData[index * 4 + 3] < 96) resolved[index] = 1;
    }
    const neighbours = (index, callback) => {
      const x = index % width;
      const y = Math.floor(index / width);
      if (x > 0) callback(index - 1);
      if (x + 1 < width) callback(index + 1);
      if (y > 0) callback(index - width);
      if (y + 1 < height) callback(index + width);
      if (x > 0 && y > 0) callback(index - width - 1);
      if (x + 1 < width && y > 0) callback(index - width + 1);
      if (x > 0 && y + 1 < height) callback(index + width - 1);
      if (x + 1 < width && y + 1 < height) callback(index + width + 1);
    };
    const fillFromResolved = (index) => {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let count = 0;
      neighbours(index, (neighbour) => {
        if (!resolved[neighbour]) return;
        const offset = neighbour * 4;
        red += source.data[offset];
        green += source.data[offset + 1];
        blue += source.data[offset + 2];
        alpha += source.data[offset + 3];
        count += 1;
      });
      if (!count) return;
      const offset = index * 4;
      source.data[offset] = red / count;
      source.data[offset + 1] = green / count;
      source.data[offset + 2] = blue / count;
      source.data[offset + 3] = alpha / count;
      resolved[index] = 1;
      queue[tail++] = index;
    };
    // Seed the flood from the mask perimeter, then fill inward one pixel
    // ring at a time. Every fill samples already-resolved real pixels.
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (resolved[index]) continue;
        let touchesResolved = false;
        neighbours(index, (neighbour) => { if (resolved[neighbour]) touchesResolved = true; });
        if (touchesResolved) fillFromResolved(index);
      }
    }
    while (head < tail) {
      const index = queue[head++];
      neighbours(index, (neighbour) => {
        if (!resolved[neighbour]) fillFromResolved(neighbour);
      });
    }
    context.putImageData(source, 0, 0);
    return canvas;
  }

  // A low-frequency blurred underlay removes the product's large ornament
  // without inventing a generic colour tile.  The actual source grain and
  // metal tone remain around the cutout, which keeps a believable base when
  // the customer moves the main design.
  context.save();
  context.beginPath();
  drawMaskPath(context, mask, width, height);
  context.clip();
  context.filter = `blur(${Math.max(8, Math.round(Math.min(width, height) * .018))}px)`;
  context.globalAlpha = .92;
  context.drawImage(image, 0, 0);
  context.restore();
  return canvas;
}

function copyImageToCanvas(image, width = image.width, height = image.height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  // AI-repaired base maps can have a different pixel density from the
  // product master map. Normalize the canvas before compositing; otherwise
  // the untouched remainder of the larger canvas becomes a visible
  // rectangle around the moved ornament.
  context.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
  return canvas;
}

function applyLayerMask(canvas, mask, feather = 0, edgeFeather = .05) {
  const width = canvas.width;
  const height = canvas.height;
  const context = canvas.getContext('2d');
  context.globalCompositeOperation = 'destination-in';
  if (feather > 0) {
    const maskCanvas = createMaskCanvas(mask, width, height);
    const featheredMask = document.createElement('canvas');
    featheredMask.width = width;
    featheredMask.height = height;
    const maskContext = featheredMask.getContext('2d');
    maskContext.filter = `blur(${Math.max(1, Math.round(Math.min(width, height) * feather))}px)`;
    maskContext.drawImage(maskCanvas, 0, 0);
    context.drawImage(featheredMask, 0, 0);
  } else {
    context.beginPath();
    drawMaskPath(context, mask, width, height);
    context.fillStyle = '#fff';
    context.fill();
  }
  // A moved/scaled design layer can expose its source-map edge over the
  // repaired underlay. Fade the outer canvas edge into the same underlay so
  // no rectangular frame or bright seam is introduced by customization.
  if (edgeFeather > 0) {
    const edgeMask = document.createElement('canvas');
    edgeMask.width = width;
    edgeMask.height = height;
    const edgeContext = edgeMask.getContext('2d');
    const pad = Math.max(2, Math.round(Math.min(width, height) * edgeFeather));
    edgeContext.filter = `blur(${Math.max(1, Math.round(pad * .65))}px)`;
    edgeContext.fillStyle = '#fff';
    edgeContext.fillRect(pad, pad, Math.max(1, width - pad * 2), Math.max(1, height - pad * 2));
    context.globalCompositeOperation = 'destination-in';
    context.drawImage(edgeMask, 0, 0);
  }
  context.globalCompositeOperation = 'source-over';
  return canvas;
}

function createDifferenceDesignLayer(image, baseImage, mask, feather = 0, edgeFeather = .05, threshold = 24, fullAlphaAt = 96) {
  const width = image.width;
  const height = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const sourceContext = document.createElement('canvas').getContext('2d');
  const baseContext = document.createElement('canvas').getContext('2d');
  const sourceCanvas = sourceContext.canvas;
  const baseCanvas = baseContext.canvas;
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  baseCanvas.width = width;
  baseCanvas.height = height;
  sourceContext.drawImage(image, 0, 0, width, height);
  baseContext.drawImage(baseImage, 0, 0, width, height);
  const sourceData = sourceContext.getImageData(0, 0, width, height);
  const baseData = baseContext.getImageData(0, 0, width, height);
  // The clean base and the photographed map share the same texel grid. Keep
  // only pixels that materially differ from the base, so moving a full-frame
  // landscape never drags a rectangular green/black backing with it. Small
  // grain and AI-repair differences stay in the fixed base layer.
  const activeColumns = new Uint32Array(width);
  const activeRows = new Uint32Array(height);
  for (let i = 0; i < sourceData.data.length; i += 4) {
    const dr = sourceData.data[i] - baseData.data[i];
    const dg = sourceData.data[i + 1] - baseData.data[i + 1];
    const db = sourceData.data[i + 2] - baseData.data[i + 2];
    const difference = Math.sqrt(dr * dr + dg * dg + db * db);
    const alpha = Math.max(0, Math.min(255, ((difference - threshold) / fullAlphaAt) * 255));
    sourceData.data[i + 3] = alpha;
    if (alpha > 90) {
      activeColumns[(i / 4) % width] += 1;
      activeRows[Math.floor((i / 4) / width)] += 1;
    }
  }
  // AI cleanup maps can differ by one bright/dark column at their crop edge.
  // Do not let that column become a movable rectangular border. Remove only
  // isolated lines that run almost the full height/width; real door motifs
  // are wider and remain untouched.
  const clearArtifactColumn = (x) => {
    for (let y = 0; y < height; y += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const targetX = x + dx;
        if (targetX < 0 || targetX >= width) continue;
        sourceData.data[(y * width + targetX) * 4 + 3] = 0;
      }
    }
  };
  const columnArtifactThreshold = height * .58;
  for (let x = 0; x < width; x += 1) {
    if (activeColumns[x] <= columnArtifactThreshold) continue;
    let end = x;
    while (end + 1 < width && activeColumns[end + 1] > columnArtifactThreshold) end += 1;
    const groupWidth = end - x + 1;
    const neighbourLeft = x > 4 ? activeColumns[x - 5] : 0;
    const neighbourRight = end + 5 < width ? activeColumns[end + 5] : 0;
    if (groupWidth <= Math.max(12, width * .035) && neighbourLeft < height * .34 && neighbourRight < height * .34) {
      for (let clearX = x; clearX <= end; clearX += 1) clearArtifactColumn(clearX);
    }
    x = end;
  }
  const clearArtifactRow = (y) => {
    for (let x = 0; x < width; x += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const targetY = y + dy;
        if (targetY < 0 || targetY >= height) continue;
        sourceData.data[(targetY * width + x) * 4 + 3] = 0;
      }
    }
  };
  const rowArtifactThreshold = width * .58;
  for (let y = 0; y < height; y += 1) {
    if (activeRows[y] <= rowArtifactThreshold) continue;
    let end = y;
    while (end + 1 < height && activeRows[end + 1] > rowArtifactThreshold) end += 1;
    const groupHeight = end - y + 1;
    const neighbourTop = y > 4 ? activeRows[y - 5] : 0;
    const neighbourBottom = end + 5 < height ? activeRows[end + 5] : 0;
    if (groupHeight <= Math.max(12, height * .035) && neighbourTop < width * .34 && neighbourBottom < width * .34) {
      for (let clearY = y; clearY <= end; clearY += 1) clearArtifactRow(clearY);
    }
    y = end;
  }
  context.putImageData(sourceData, 0, 0);
  return applyLayerMask(canvas, mask, feather, edgeFeather);
}

function createColorDesignLayer(image, mask, feather = 0, edgeFeather = .05, threshold = 18) {
  const width = image.width;
  const height = image.height;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const context = sourceCanvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const red = pixels.data[i];
    const green = pixels.data[i + 1];
    const blue = pixels.data[i + 2];
    // Gold/bronze metal has a warm chroma (red and green above blue), while
    // the Jinqu grey and black panels are close to neutral. Keep the real
    // highlight/edge pixels and discard the neutral panel behind the relief.
    const goldness = red - blue + (green - blue) * .55;
    pixels.data[i + 3] = Math.max(0, Math.min(255, ((goldness - threshold) / 80) * 255));
  }
  context.putImageData(pixels, 0, 0);
  return applyLayerMask(sourceCanvas, mask, feather, edgeFeather);
}

function createOrangeDesignLayer(image, mask, feather = 0, edgeFeather = .05, threshold = 48, fullAlphaAt = 80) {
  const width = image.width;
  const height = image.height;
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const context = sourceCanvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, width, height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const red = pixels.data[i];
    const green = pixels.data[i + 1];
    const blue = pixels.data[i + 2];
    // The Ruojian groove is the warm, high-red channel in the photographed
    // map. Keep its real orange light and dark recess, but discard the wood
    // panels around it before the layer is moved over the fixed base.
    const orangeStrength = red - green;
    const blueGuard = red - blue > 76 ? 1 : 0;
    pixels.data[i + 3] = blueGuard
      ? Math.max(0, Math.min(255, ((orangeStrength - threshold) / fullAlphaAt) * 255))
      : 0;
  }
  context.putImageData(pixels, 0, 0);
  return applyLayerMask(sourceCanvas, mask, feather, edgeFeather);
}

function createDesignLayer(image, mask, feather = 0, edgeFeather = .05, baseImage = null, extractDesign = false, extractThreshold = 24, extractFullAlpha = 96, extractMode = null) {
  if (extractMode === 'gold') {
    return createColorDesignLayer(image, mask, feather, edgeFeather, extractThreshold);
  }
  if (extractMode === 'orange') {
    return createOrangeDesignLayer(image, mask, feather, edgeFeather, extractThreshold, extractFullAlpha);
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (extractDesign && baseImage) {
    return createDifferenceDesignLayer(image, baseImage, mask, feather, edgeFeather, extractThreshold, extractFullAlpha);
  }
  context.drawImage(image, 0, 0);
  return applyLayerMask(canvas, mask, feather, edgeFeather);
}

function isIdentityTransform(transform, design) {
  const scale = Number(transform?.scale ?? 1);
  const offsetX = Number(transform?.offsetX ?? 0);
  const offsetY = Number(transform?.offsetY ?? 0);
  return Math.abs(offsetX) < .0001 && Math.abs(offsetY) < .0001 && Math.abs(scale - (design?.defaultScale || 1)) < .0001;
}

// Returns null for the untouched factory state. Callers can then keep the
// original THREE.Texture, avoiding a second canvas and preserving exact
// source pixels in the default product view.
export function createTextureLayerCanvas(image, series, productKey, region, transform = {}) {
  if (!image) return null;
  const profile = getTextureLayerProfile(series, productKey);
  const designs = getTextureDesigns(series, productKey, region);
  if (!profile || !designs.length) return null;
  const design = getTextureDesign(series, productKey, region, transform.key || profile.defaultDesign);
  if (!design) return null;
  if (design.key === profile.defaultDesign && design.mode === 'source' && isIdentityTransform(transform, design)) return null;
  const mask = mapNormalizedMask(design.mask || full, transform.contentRect);
  const cleanupMask = mapNormalizedMask(design.cleanupMask || profile.cleanupMask || design.mask || full, transform.contentRect);

  // Some products contain an integrated ornament that cannot be removed
  // safely by blurring the photographed map. A dedicated clean base keeps
  // the real metal grain while the original map remains the movable design
  // layer. Factory still returns null above and therefore stays pixel-exact.
  const base = transform.baseImage
    ? copyImageToCanvas(transform.baseImage, image.width, image.height)
    : (() => {
      const cacheKey = `${design.key}:${profile.baseRepair || 'blur'}:${JSON.stringify(cleanupMask)}`;
      let cache = CLEAN_BASE_CACHE.get(image);
      if (!cache) {
        cache = new Map();
        CLEAN_BASE_CACHE.set(image, cache);
      }
      if (!cache.has(cacheKey)) cache.set(cacheKey, createCleanBase(image, cleanupMask, profile.baseRepair, {
        ...(profile.baseRepairOptions || {}),
        contentRect: transform.contentRect
      }));
      return copyImageToCanvas(cache.get(cacheKey));
    })();
  if (design.mode === 'none') return base;
  const underlay = copyImageToCanvas(base);

  const layer = createDesignLayer(
    image,
    mask,
    profile.maskFeather || 0,
    profile.edgeFeather ?? .05,
    base,
    Boolean(profile.extractDesign),
    profile.extractThreshold ?? 24,
    profile.extractFullAlpha ?? 96,
    profile.extractMode || null
  );
  const context = base.getContext('2d');
  const offsetX = Number(transform.offsetX || 0) * image.width;
  const offsetY = Number(transform.offsetY || 0) * image.height;
  const scale = Number(transform.scale || design.defaultScale || 1);
  context.save();
  context.translate(image.width / 2 + offsetX, image.height / 2 + offsetY);
  context.scale(scale, scale);
  context.translate(-image.width / 2, -image.height / 2);
  context.drawImage(layer, 0, 0);
  context.restore();
  // Keep a moved layer inside the finite source map. Without this small
  // underlay guard, translating a full-frame design exposes its source edge
  // as a bright vertical/horizontal line on the door face. The guard only
  // covers the side the layer moved away from; the original design pixels
  // and their scale remain untouched.
  if (profile.clipTransformedEdges !== false) {
    const edgePad = Math.min(
      Math.round(Math.min(image.width, image.height) * .18),
      Math.max(Math.abs(offsetX), Math.abs(offsetY)) + Math.round(Math.min(image.width, image.height) * .022)
    );
    if (offsetX > 0 && edgePad > 0) context.drawImage(underlay, 0, 0, edgePad, image.height, 0, 0, edgePad, image.height);
    if (offsetX < 0 && edgePad > 0) context.drawImage(underlay, image.width - edgePad, 0, edgePad, image.height, image.width - edgePad, 0, edgePad, image.height);
    if (offsetY > 0 && edgePad > 0) context.drawImage(underlay, 0, 0, image.width, edgePad, 0, 0, image.width, edgePad);
    if (offsetY < 0 && edgePad > 0) context.drawImage(underlay, 0, image.height - edgePad, image.width, edgePad, 0, image.height - edgePad, image.width, edgePad);
  }
  return base;
}
