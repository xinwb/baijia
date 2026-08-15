// Product-specific texture maps and normalized source coordinates.
//
// Coordinates are normalized to each source image (0..1). A continuous pair
// keeps both leaves in one source coordinate system; split products use
// independent source maps and never mirror an image implicitly.

const rect = (x = 0, y = 0, w = 1, h = 1) => ({ x, y, w, h });
const standardZones = {
  top: { y: 0, h: .16, resize: 'fixed' },
  body: { y: .16, h: .68, resize: 'reveal' },
  bottom: { y: .84, h: .16, resize: 'fixed' }
};
// The manifest is also the product-structure source of truth. The product
// photo determines the authored map and optional side-light structures, while
// the configurator may still assemble every product as a single, mother or
// double leaf. Missing structural variants are synthesized from the same clean
// product map below; this keeps a custom door usable without pretending that a
// product has a side-light photo it does not actually have.
const doubleOnlyTypes = ['double'];

function continuousDouble(map, zones = standardZones) {
  return {
    mode: 'continuous-double',
    pair: { map, rect: rect(), seam: .5 },
    regions: {
      child: { map, rect: rect(0, 0, .5, 1), anchor: 'meeting-stile', zones },
      main: { map, rect: rect(.5, 0, .5, 1), anchor: 'meeting-stile', zones }
    }
  };
}

function continuousStructures(map, zones = standardZones, types = doubleOnlyTypes) {
  return Object.fromEntries(types.map((type) => [type, continuousDouble(map, zones)]));
}

// K80 catalog images are authored elevations, not stretchable single-leaf
// swatches. These explicit structures convert one continuous map into the
// physical door types without resampling the ornament across a new leaf.
function universalContinuous(map, sourceType = 'double', split = .28, zones = standardZones) {
  return {
    single: splitStructure({
      main: { map, rect: rect(sourceType === 'mother' ? split : .5, 0, sourceType === 'mother' ? 1 - split : .5, 1), anchor: 'outer-edge', zones }
    }),
    mother: sourceType === 'mother'
      ? continuousMother(map, split, zones)
      : doubleToMother(map, .36, zones),
    double: sourceType === 'mother'
      ? motherToDouble(map, split, zones)
      : continuousDouble(map, zones)
  };
}

function continuousMother(map, split = .28, zones = standardZones) {
  return {
    mode: 'continuous-mother',
    pair: { map, rect: rect(), seam: split },
    regions: {
      child: { map, rect: rect(0, 0, split, 1), anchor: 'outer-edge', zones },
      main: { map, rect: rect(split, 0, 1 - split, 1), anchor: 'outer-edge', zones }
    }
  };
}

// A source photographed as an equal double door cannot be re-composed into a
// mother door by moving the seam to the left. Keep the authored double-door
// seam at the center, then let the shorter child leaf consume only the right
// portion of the original left half. The discarded pixels are the outer-left
// part of that leaf; the right/main leaf remains the original right half.
function doubleToMother(map, childSpan = .36, zones = standardZones) {
  return {
    mode: 'double-to-mother',
    pair: { map, rect: rect(), seam: .5, childSpan },
    regions: {
      child: { map, rect: rect(.5 - childSpan, 0, childSpan, 1), anchor: 'meeting-stile', zones },
      main: { map, rect: rect(.5, 0, .5, 1), anchor: 'meeting-stile', zones }
    }
  };
}

// A product photographed as a mother door cannot be promoted to a double
// door by cutting the source at 50/50. Keep the authored mother seam as the
// meeting stile: the left leaf grows outward from its outer edge while the
// right/main leaf keeps the original main-leaf composition and grows toward
// its outer edge. The renderer uses the overscan around the source map for
// that extra reveal instead of squeezing the complete photograph into two
// equal panels.
function motherToDouble(map, split = .28, zones = standardZones) {
  return {
    mode: 'mother-to-double',
    pair: { map, rect: rect(), seam: split },
    regions: {
      child: { map, rect: rect(0, 0, split, 1), anchor: 'outer-edge', zones },
      main: { map, rect: rect(split, 0, 1 - split, 1), anchor: 'outer-edge', zones }
    }
  };
}

function splitStructure(regions, zones = standardZones) {
  return {
    mode: 'split-independent',
    regions: Object.fromEntries(Object.entries(regions).map(([role, spec]) => [
      role,
      { ...spec, zones: spec.zones || zones }
    ]))
  };
}

export const TEXTURE_MANIFEST_VERSION = '20260813.36';

export const TEXTURE_MANIFEST = {
  k80: {
    ruojian: {
      label: '雅帝若简',
      base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['single', 'mother', 'double'],
      maps: {
        // The photographed map remains the authored reference. The runtime
        // door face uses the clean wood underlay plus the real GLB recessed
        // light channel, so the orange strip is never baked twice.
        master: { path: './assets/catalog/derived/k80/textures/k80-ruo-jian-clean-ai-v1.png', sourceSize: [874, 1800] },
        single: { path: './assets/catalog/derived/k80/textures/k80-ruo-jian-single-clean-v1.png', sourceSize: [629, 1800] },
        base: { path: './assets/catalog/derived/k80/textures/k80-ruo-jian-design-ai-v1.png', sourceSize: [873, 1800] },
        // Runtime design source. The layer engine extracts only the orange
        // strip from this map; the wood-only base remains fixed underneath.
        design: { path: './assets/catalog/derived/k80/textures/k80-ruo-jian-clean-ai-v1.png', sourceSize: [874, 1800] },
        // Audit/thumbnail asset: the isolated transparent orange strip.
        designLayer: { path: './assets/catalog/derived/k80/textures/k80-ruo-jian-orange-design-v1.png', sourceSize: [874, 1800] },
        legacyLeaf: { path: './assets/catalog/derived/k80/door-skins/k80-ruojian-double-leaf.png', sourceSize: [1800, 437] }
      },
      // The catalog elevation is a single-leaf composition: the light groove
      // sits left of centre and the broad wood field continues on its right.
      // Keep the photographed continuous pair for double doors, but do not
      // use its right half as a centered single-door texture.
      structures: {
        single: splitStructure({
          main: { map: 'single', rect: rect(), anchor: 'outer-edge' }
        }),
        mother: doubleToMother('master', .36),
        double: continuousDouble('master')
      }
    },
    yijian: {
      label: '雅帝意简', base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['single', 'mother', 'double'],
      maps: { master: { path: './assets/catalog/derived/k80/door-skins/k80-yijian-double-leaf.png', sourceSize: [278, 659] } },
      structures: universalContinuous('master', 'double')
    },
    heya: {
      label: '雅帝和雅', base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['single', 'mother', 'double'],
      maps: { master: { path: './assets/catalog/derived/k80/door-skins/k80-heya-double-leaf.png', sourceSize: [262, 663] } },
      structures: universalContinuous('master', 'double')
    },
    ouya: {
      label: '雅帝欧雅', base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['single', 'mother', 'double'],
      maps: { master: { path: './assets/catalog/derived/k80/door-skins/k80-ouya-double-leaf.png', sourceSize: [301, 674] } },
      structures: universalContinuous('master', 'double')
    },
    yuanyin: {
      label: '雅帝圆隐',
      base: { width: 1300, height: 2600, type: 'mother' },
      supportedTypes: ['single', 'mother', 'double'],
      maps: {
        // Full real mother/child composition: left child is about 28%,
        // right main leaf carries the integrated circular Yuan Yin ornament.
        master: { path: './assets/catalog/derived/k80/textures/k80-yuan-yin-clean-v2.png', sourceSize: [887, 1774] },
        clean: { path: './assets/catalog/derived/k80/textures/k80-yuan-yin-clean-v2.png', sourceSize: [887, 1774] },
        base: { path: './assets/catalog/derived/k80/textures/k80-yuan-yin-base-ai-v2.png', sourceSize: [887, 1774] }
      },
      // The real seam is left of centre: the narrow leaf is the child leaf
      // and the wider leaf is the active main leaf.
      structures: universalContinuous('master', 'mother', .28)
    },
    jiangchuan: {
      label: '雅帝江川赋',
      base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['single', 'mother', 'double'],
      maps: {
        // Clean map reconstructed from the real Jiangchuan front photo:
        // continuous two-leaf composition, without the photographed lock/handles/frame.
        master: { path: './assets/catalog/derived/k80/textures/k80-jiang-chuan-clean-v2.png', sourceSize: [1003, 1568] },
        base: { path: './assets/catalog/derived/k80/textures/k80-jiang-chuan-base-ai-v1.png', sourceSize: [1003, 1568] },
        legacyLeaf: { path: './assets/catalog/derived/k80/door-skins/k80-jiangchuan-double-leaf.png', sourceSize: [498, 1581] }
      },
      structures: universalContinuous('master', 'double', .5, {
        top: { y: 0, h: .30, resize: 'fixed' },
        body: { y: .30, h: .40, resize: 'reveal' },
        bottom: { y: .70, h: .30, resize: 'fixed' }
      })
    },
    jinghong: {
      label: '雅帝荆虹赋',
      base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['single', 'mother', 'double'],
      maps: {
        master: { path: './assets/catalog/derived/k80/textures/k80-jing-hong-clean-ai-v1.png', sourceSize: [1154, 1800] },
        base: { path: './assets/catalog/derived/k80/textures/k80-jing-hong-base-ai-v1.png', sourceSize: [1004, 1566] },
        legacyLeaf: { path: './assets/catalog/derived/k80/door-skins/k80-jinghong-double-leaf.png', sourceSize: [502, 1566] }
      },
      structures: universalContinuous('master', 'double', .5)
    },
    qingya: {
      label: '雅帝清雅',
      base: { width: 1300, height: 2600, type: 'mother' },
      supportedTypes: ['single', 'mother', 'double'],
      maps: {
        child: { path: './assets/catalog/derived/k80/door-skins/k80-qingya-mother-child.png', sourceSize: [264, 1911] },
        main: { path: './assets/catalog/derived/k80/door-skins/k80-qingya-mother-main.png', sourceSize: [560, 1911] },
        // Hardware-free main-leaf map. The short gold pull is rebuilt as a
        // separate fitting instead of being included in the movable relief.
        'design-main': { path: './assets/catalog/derived/k80/textures/k80-qing-ya-design-main-ai-v1.png', sourceSize: [560, 1911] },
        'base-child': { path: './assets/catalog/derived/k80/textures/k80-qing-ya-base-child-ai-v2.png', sourceSize: [264, 1911] },
        'base-main': { path: './assets/catalog/derived/k80/textures/k80-qing-ya-base-main-ai-v2.png', sourceSize: [560, 1911] }
      },
      structures: {
        single: splitStructure({
          main: { map: 'main', rect: rect(), anchor: 'outer-edge' }
        }),
        mother: splitStructure({
          child: { map: 'child', rect: rect(), anchor: 'outer-edge' },
          main: { map: 'main', rect: rect(), anchor: 'outer-edge' }
        }),
        double: splitStructure({
          child: { map: 'child', rect: rect(), anchor: 'outer-edge' },
          main: { map: 'main', rect: rect(), anchor: 'outer-edge' }
        })
      }
    },
    qinghuafu: {
      label: '雅帝清华赋',
      base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['single', 'mother', 'double'],
      maps: {
        master: { path: './assets/catalog/derived/k80/door-skins/k80-qinghuafu-clean-hardware-v1.png', sourceSize: [967, 1627] },
        base: { path: './assets/catalog/derived/k80/textures/k80-qing-hua-fu-base-ai-v1.png', sourceSize: [967, 1627] }
      },
      structures: universalContinuous('master', 'double', .5)
    }
  },
  d90: {
    jinqu: {
      label: '金曲',
      base: { width: 1900, height: 2600, type: 'sideLight' },
      supportedTypes: ['sideLight'],
      maps: {
        main: { path: './assets/catalog/derived/d90/door-skins/d90-jinqu-side-main.png', sourceSize: [619, 1556] },
        side: { path: './assets/catalog/derived/d90/door-skins/d90-jinqu-side-light.png', sourceSize: [283, 1556] },
        master: { path: './assets/catalog/derived/d90/textures/d90-jinqu-clean-ai-v1.png', sourceSize: [1800, 1101] }
      },
      structures: {
        sideLight: splitStructure({
          main: { map: 'main', rect: rect(), anchor: 'outer-edge' },
          sideLeft: { map: 'side', rect: rect(), anchor: 'outer-edge', material: 'glass' }
        }),
        // The original Jinqu side-light is a real narrow glass panel. A
        // mother-door option keeps that panel and only gives it a child-leaf
        // pivot so the left side can open instead of replacing it with a
        // stretched copy of the right metal leaf.
        mother: splitStructure({
          child: { map: 'side', rect: rect(), anchor: 'outer-edge', material: 'glass' },
          main: { map: 'main', rect: rect(), anchor: 'outer-edge' }
        }),
        // The right metal leaf is the authored source for both equal leaves;
        // d90-configurator mirrors only the left leaf for Jinqu.
        double: splitStructure({
          child: { map: 'main', rect: rect(), anchor: 'outer-edge' },
          main: { map: 'main', rect: rect(), anchor: 'outer-edge' }
        })
      }
    },
    shirui: {
      label: '世瑞',
      base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['double'],
      maps: {
        main: { path: './assets/catalog/derived/d90/door-skins/d90-shirui-side-main.png', sourceSize: [624, 1073] },
        side: { path: './assets/catalog/derived/d90/door-skins/d90-shirui-side-light.png', sourceSize: [730, 1073] },
        master: { path: './assets/catalog/derived/d90/textures/d90-shirui-clean-ai-v1.png', sourceSize: [1800, 1412] }
      },
      structures: {
        double: splitStructure({
          child: { map: 'side', rect: rect(), anchor: 'outer-edge', material: 'frosted-glass' },
          main: { map: 'main', rect: rect(), anchor: 'outer-edge' }
        })
      }
    },
    shicui: {
      label: '拾翠',
      base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['double'],
      maps: {
        master: { path: './assets/catalog/derived/d90/door-skins/d90-shicui-double-leaf.png', sourceSize: [427, 1555] },
      // Optional editable underlay for non-factory finish variants. The
      // factory map below intentionally keeps the photographed turquoise jade
      // band because it is part of 拾翠's authored door design.
      base: { path: './assets/catalog/derived/d90/textures/d90-shicui-base-ai-v1.png', sourceSize: [725, 2170] }
      },
      // The authored skin is one complete leaf. Use it for both leaves;
      // splitting it at 50% would crop away the top/bottom moulding and jade
      // band. Hardware remains separate and is added only from the selected
      // lock/handle profile.
      structures: {
        double: splitStructure({
          child: { map: 'master', rect: rect(), anchor: 'outer-edge' },
          main: { map: 'master', rect: rect(), anchor: 'outer-edge' }
        })
      }
    },
    aige: {
      label: '爱格',
      base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['double'],
      maps: {
        // The reference panel is a decorative sample, not a door leaf. The
        // runtime skin is the complete authored single-leaf panel.
        master: { path: './assets/catalog/derived/d90/door-skins/d90-aige-double-leaf.png', sourceSize: [423, 1566] }
      },
      structures: {
        double: splitStructure({
          child: { map: 'master', rect: rect(), anchor: 'outer-edge' },
          main: { map: 'master', rect: rect(), anchor: 'outer-edge' }
        })
      }
    },
    songge: {
      label: '颂歌',
      base: { width: 2100, height: 2600, type: 'double' },
      supportedTypes: ['double'],
      maps: {
        master: { path: './assets/catalog/derived/d90/door-skins/d90-songge-double-leaf.png', sourceSize: [425, 1561] }
      },
      // Like Aige, this is a complete single-leaf authored panel, not a
      // two-leaf canvas. Reusing it for both leaves preserves the full curved
      // relief instead of displaying only its left/right half.
      structures: {
        double: splitStructure({
          child: { map: 'master', rect: rect(), anchor: 'outer-edge' },
          main: { map: 'master', rect: rect(), anchor: 'outer-edge' }
        })
      }
    },
    guanmin: {
      label: '冠冕',
      // The reference photo is two complete arched leaves. The crown, blue
      // inset, relief panels and lower medallion all belong to each moving
      // leaf; there is no separate fixed transom.
      base: { width: 1800, height: 3500, type: 'double', fixedTransomMm: 0 },
      supportedTypes: ['double'],
      maps: {
        master: { path: './assets/catalog/derived/d90/door-skins/d90-guanmin-double-leaf-alpha.png', sourceSize: [434, 1734] },
        // The master map is one complete arched leaf. Runtime hardware stays
        // separate so the relief and blue inset remain part of the door skin.
        'leaf-clean': { path: './assets/catalog/derived/d90/door-skins/d90-guanmin-moving-leaves-v2.png', sourceSize: [927, 1200] },
        transom: { path: './assets/catalog/derived/d90/door-skins/d90-guanmin-fixed-transom-v2.png', sourceSize: [848, 600] }
      },
      structures: {
        // This is a complete single-leaf arched crop. Apply it once to each
        // leaf; do not split the crop at 50%, which would remove half of the
        // crown and half of every lower relief panel.
        double: splitStructure({
          child: { map: 'master', rect: rect(), anchor: 'outer-edge' },
          main: { map: 'master', rect: rect(), anchor: 'outer-edge' }
        })
      }
    }
  }
};

export function getTextureManifest(series, product) {
  return TEXTURE_MANIFEST[series]?.[product] || null;
}

export function getTextureStructure(series, product, type) {
  const manifest = getTextureManifest(series, product);
  if (!manifest) return null;
  const direct = manifest.structures?.[type];
  if (direct) return direct;
  const baseStructure = manifest.structures?.[manifest.base.type];
  if (!baseStructure) return null;

  const baseRegions = baseStructure.regions || {};
  const map = baseStructure.pair?.map
    || baseRegions.main?.map
    || baseRegions.child?.map
    || baseRegions.sideLeft?.map
    || 'master';
  const mapRect = baseStructure.pair?.rect || rect();
  const cloneRegion = (source, fallbackRect = rect()) => ({
    ...(source || {}),
    map: source?.map || map,
    rect: source?.rect || fallbackRect,
    anchor: source?.anchor || 'outer-edge',
    zones: source?.zones || standardZones
  });

  // A single leaf uses one complete authored leaf where available. For a
  // continuous two-leaf photograph, use the main/right half so the full pair
  // is never squashed into a narrow single leaf.
  if (type === 'single') {
    const main = baseRegions.main || baseRegions.child || baseRegions.sideLeft;
    const singleRect = baseStructure.mode === 'continuous-double'
      ? (baseRegions.main?.rect || rect(.5, 0, .5, 1))
      : (main?.rect || mapRect);
    return splitStructure({ main: cloneRegion(main, singleRect) });
  }

  // Pair-photo conversion is product-aware: an equal double map preserves its
  // center seam and crops the outer-left part of the child leaf, while a
  // mother-door source keeps its authored seam for promotion to double.
  // Independent authored leaf maps remain independent instead of being
  // mirrored or stretched.
  if (type === 'mother') {
    if (baseStructure.mode === 'continuous-double') {
      return doubleToMother(map, .36, baseRegions.main?.zones || standardZones);
    }
    const child = cloneRegion(baseRegions.child || baseRegions.main || baseRegions.sideLeft);
    const main = cloneRegion(baseRegions.main || baseRegions.child || baseRegions.sideLeft);
    return splitStructure({ child, main });
  }

  // A mother-door source can be promoted to an equal two-leaf structure by
  // using the same continuous map at a 50/50 seam. Independent leaf sources
  // are retained as full authored leaf maps on both sides.
  if (type === 'double') {
    if (baseStructure.mode === 'continuous-mother') {
      return motherToDouble(map, baseStructure.pair?.seam ?? .28, baseRegions.main?.zones || standardZones);
    }
    if (baseStructure.mode === 'continuous-double') return baseStructure;
    const child = cloneRegion(baseRegions.child || baseRegions.main || baseRegions.sideLeft);
    const main = cloneRegion(baseRegions.main || baseRegions.child || baseRegions.sideLeft);
    return splitStructure({ child, main });
  }

  // Optional product-specific side-door structures keep their authored
  // source when no exact variant exists.
  return baseStructure;
}

export function getTextureRegion(series, product, type, role) {
  const structure = getTextureStructure(series, product, type);
  return structure?.regions?.[role] || structure?.regions?.main || null;
}

export function getTextureMapPath(series, product, map = 'master') {
  return getTextureManifest(series, product)?.maps?.[map]?.path || null;
}
