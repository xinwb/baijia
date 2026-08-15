// Visual surface recipes applied to the real product-specific texture map.
// The source map is never replaced by a generic colour swatch: every recipe
// keeps the product's actual relief, grain, panel seams and composition, then
// applies a deliberately visible metal finish for the selected door face.

export const TEXTURE_SURFACES = [
  {
    key: 'factory',
    label: '原厂实拍',
    note: '保留本款完整纹理',
    filter: 'none'
  },
  {
    key: 'graphite',
    label: '深钛灰肌理',
    note: '强化纵向拉丝与凹凸',
    // Keep the original albedo readable. The previous recipe multiplied a
    // very dark overlay after a .56 brightness pass, which made one selected
    // leaf render as a black void instead of graphite metal.
    tone: [58, 72, 78], toneMix: .30, grayscale: .72, contrast: 1.08, brightness: 1.04,
    grain: 'vertical'
  },
  {
    key: 'bronze',
    label: '暖古铜肌理',
    note: '保留浮雕的铜色层次',
    tone: [132, 82, 46], toneMix: .23, grayscale: .28, contrast: 1.06, brightness: 1.02,
    grain: 'diagonal'
  },
  {
    key: 'titanium',
    label: '雾银钛肌理',
    note: '提亮金属反射与细纹',
    tone: [174, 188, 194], toneMix: .24, grayscale: .34, contrast: 1.06, brightness: 1.06,
    grain: 'horizontal'
  }
];

export function getTextureSurface(key = 'factory') {
  return TEXTURE_SURFACES.find((surface) => surface.key === key) || TEXTURE_SURFACES[0];
}

function drawGrain(context, width, height, direction) {
  if (!direction) return;
  context.save();
  context.globalAlpha = direction === 'vertical' ? .13 : .09;
  context.strokeStyle = direction === 'vertical' ? 'rgba(255,255,255,.46)' : 'rgba(255,255,255,.34)';
  context.lineWidth = direction === 'diagonal' ? 1.1 : .7;
  const step = Math.max(4, Math.round(Math.min(width, height) / 170));
  for (let offset = -height; offset < width + height; offset += step) {
    context.beginPath();
    if (direction === 'vertical') {
      context.moveTo(offset, 0);
      context.lineTo(offset + Math.sin(offset * .07) * 1.8, height);
    } else if (direction === 'horizontal') {
      context.moveTo(0, offset);
      context.lineTo(width, offset + Math.sin(offset * .05) * .8);
    } else {
      context.moveTo(offset, 0);
      context.lineTo(offset + height, height);
    }
    context.stroke();
  }
  context.restore();
}

export function createTextureSurfaceCanvas(source, key = 'factory') {
  const image = source?.image;
  if (!image) return null;
  const surface = getTextureSurface(key);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  // Do not rely on CanvasRenderingContext2D.filter here. On some Chromium
  // builds the filtered draw of a CanvasTexture silently becomes transparent
  // or black. A pixel pass is deterministic and preserves the source map.
  context.filter = 'none';
  context.drawImage(image, 0, 0);
  if (surface.tone) {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = pixels.data;
    const [toneR, toneG, toneB] = surface.tone;
    const toneMix = surface.toneMix ?? .2;
    const grayscale = surface.grayscale ?? 0;
    const contrast = surface.contrast ?? 1;
    const brightness = surface.brightness ?? 1;
    for (let index = 0; index < data.length; index += 4) {
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const luminance = r * .2126 + g * .7152 + b * .0722;
      const neutralR = r + (luminance - r) * grayscale;
      const neutralG = g + (luminance - g) * grayscale;
      const neutralB = b + (luminance - b) * grayscale;
      const adjustedR = Math.max(0, Math.min(255, (neutralR - 128) * contrast + 128) * brightness);
      const adjustedG = Math.max(0, Math.min(255, (neutralG - 128) * contrast + 128) * brightness);
      const adjustedB = Math.max(0, Math.min(255, (neutralB - 128) * contrast + 128) * brightness);
      data[index] = adjustedR * (1 - toneMix) + toneR * toneMix;
      data[index + 1] = adjustedG * (1 - toneMix) + toneG * toneMix;
      data[index + 2] = adjustedB * (1 - toneMix) + toneB * toneMix;
    }
    context.putImageData(pixels, 0, 0);
  }
  drawGrain(context, canvas.width, canvas.height, surface.grain);
  return canvas;
}
