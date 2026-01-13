
import { IntensityMap, ColorStop } from '../types';

/**
 * 转换 hex 为 rgb 对象
 */
function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * Alpha 混合算法
 */
function blend(dst: {r:number, g:number, b:number, a:number}, src: {r:number, g:number, b:number, a:number}) {
  const alpha = src.a;
  const invAlpha = 1.0 - alpha;
  return {
    r: src.r * alpha + dst.r * invAlpha,
    g: src.g * alpha + dst.g * invAlpha,
    b: src.b * alpha + dst.b * invAlpha,
    a: src.a + dst.a * invAlpha
  };
}

/**
 * 检测是否为文字/地名像素
 */
function isLabelPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 128) return false;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 110; // 文字通常较暗
}

/**
 * 检测是否为边界/线划像素
 */
function isBoundaryPixel(r: number, g: number, b: number): boolean {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 180 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20; // 灰色或黑色线条
}

/**
 * 执行区域自动填充（自动上色核心逻辑）
 */
export function autoFillRegion(intensityMap: IntensityMap, bgColor: { r: number; g: number; b: number }) {
  const { data: intensities, width, height, labelMask, originalImage } = intensityMap;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(originalImage, 0, 0);
  const pixData = ctx.getImageData(0, 0, width, height).data;

  const visited = new Uint8Array(width * height);
  const queue: [number, number][] = [];
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  
  for (let dy = -80; dy <= 80; dy += 15) {
    for (let dx = -80; dx <= 80; dx += 15) {
      const sx = centerX + dx;
      const sy = centerY + dy;
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
      const sidx = sy * width + sx;
      const sr = pixData[sidx * 4], sg = pixData[sidx * 4 + 1], sb = pixData[sidx * 4 + 2];
      const distToBg = Math.sqrt(Math.pow(sr - bgColor.r, 2) + Math.pow(sg - bgColor.g, 2) + Math.pow(sb - bgColor.b, 2));
      
      if (distToBg > 10 && labelMask[sidx] === 0 && !isBoundaryPixel(sr, sg, sb)) {
        queue.push([sx, sy]);
        visited[sidx] = 1;
      }
    }
  }

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    const cidx = cy * width + cx;
    intensities[cidx] = 0.1;
    const neighbors = [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]];
    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nidx = ny * width + nx;
        if (!visited[nidx] && labelMask[nidx] === 0) {
          const nr = pixData[nidx * 4], ng = pixData[nidx * 4 + 1], nb = pixData[nidx * 4 + 2];
          const distToBg = Math.sqrt(Math.pow(nr - bgColor.r, 2) + Math.pow(ng - bgColor.g, 2) + Math.pow(nb - bgColor.b, 2));
          if (distToBg > 8 && !isBoundaryPixel(nr, ng, nb)) {
            visited[nidx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  addHeatPoint(intensityMap, centerX, centerY, Math.min(width, height) / 3, 0.6);
}

export async function extractIntensity(
  image: HTMLImageElement,
  bgColor: { r: number; g: number; b: number },
  sensitivity: number = 0.05
): Promise<IntensityMap> {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create canvas context');

  ctx.drawImage(image, 0, 0);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const { data, width, height } = imageData;
  
  const intensities = new Float32Array(width * height);
  const labelMask = new Uint8Array(width * height);
  let hasExistingHeat = false;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const idx = i / 4;

    if (isLabelPixel(r, g, b, a)) {
      labelMask[idx] = 1;
    }

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const s = max === 0 ? 0 : chroma / max;

    const distToBg = Math.sqrt(Math.pow(r - bgColor.r, 2) + Math.pow(g - bgColor.g, 2) + Math.pow(b - bgColor.b, 2));
    
    if (distToBg > 40 && s > 0.15 && labelMask[idx] === 0) {
      let h = 0;
      if (chroma !== 0) {
        if (max === r) h = ((g - b) / chroma) % 6;
        else if (max === g) h = (b - r) / chroma + 2;
        else h = (r - g) / chroma + 4;
        h = h * 60; if (h < 0) h += 360;
      }
      if (h <= 250 || h >= 310) {
        intensities[idx] = Math.max(0.01, 1 - (h / 240));
        hasExistingHeat = true;
      }
    }
  }

  const intensityMap = { data: intensities, labelMask, width, height, originalImage: image };
  if (!hasExistingHeat) {
    autoFillRegion(intensityMap, bgColor);
  }
  return intensityMap;
}

/**
 * 手动添加热力点 (标准高斯分布算法)
 * strength: 能量累加快慢 (0.01 - 1.0)
 * opacity: 笔触能量上限/浓度 (0.01 - 1.0)
 */
export function addHeatPoint(
  intensityMap: IntensityMap,
  x: number,
  y: number,
  radius: number,
  strength: number,
  opacity: number = 1.0
) {
  const { data, width, height, labelMask } = intensityMap;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sigma = radius / 2.2;
  const twoSigmaSq = 2 * sigma * sigma;
  const minX = Math.max(0, x0 - radius);
  const maxX = Math.min(width - 1, x0 + radius);
  const minY = Math.max(0, y0 - radius);
  const maxY = Math.min(height - 1, y0 + radius);

  for (let iy = minY; iy <= maxY; iy++) {
    for (let ix = minX; ix <= maxX; ix++) {
      const idx = iy * width + ix;
      if (labelMask[idx] === 1) continue;
      const distSq = (ix - x) ** 2 + (iy - y) ** 2;
      const dist = Math.sqrt(distSq);
      if (dist < radius) {
        const gaussian = Math.exp(-distSq / twoSigmaSq);
        const fadeOut = (1 - dist / radius);
        // strength 影响累加速度，opacity 限制笔触在该点的“透明度/浓度”体现
        const energyAdded = gaussian * fadeOut * strength * opacity;
        data[idx] = Math.min(1.0, data[idx] + energyAdded);
      }
    }
  }
}

/**
 * 橡皮擦功能：根据高斯分布减少热力强度
 */
export function removeHeatPoint(
  intensityMap: IntensityMap,
  x: number,
  y: number,
  radius: number,
  strength: number,
  opacity: number = 1.0
) {
  const { data, width, height, labelMask } = intensityMap;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sigma = radius / 2.2;
  const twoSigmaSq = 2 * sigma * sigma;
  const minX = Math.max(0, x0 - radius);
  const maxX = Math.min(width - 1, x0 + radius);
  const minY = Math.max(0, y0 - radius);
  const maxY = Math.min(height - 1, y0 + radius);

  for (let iy = minY; iy <= maxY; iy++) {
    for (let ix = minX; ix <= maxX; ix++) {
      const idx = iy * width + ix;
      if (labelMask[idx] === 1) continue;
      const distSq = (ix - x) ** 2 + (iy - y) ** 2;
      const dist = Math.sqrt(distSq);
      if (dist < radius) {
        const gaussian = Math.exp(-distSq / twoSigmaSq);
        const fadeOut = (1 - dist / radius);
        const energyRemoved = gaussian * fadeOut * strength * opacity;
        data[idx] = Math.max(0.0, data[idx] - energyRemoved);
      }
    }
  }
}

/**
 * 渲染函数：层级叠染 + 地名强保护
 */
export function renderHeatmap(
  ctx: CanvasRenderingContext2D,
  intensityMap: IntensityMap,
  stops: ColorStop[],
  globalOpacity: number = 1.0,
  blur: number = 0.0 
) {
  const { width, height, data, labelMask, originalImage } = intensityMap;
  const layerStops = [...stops].reverse();
  const layers = layerStops.map(s => ({ ...hexToRgb(s.color), alpha: s.alpha }));

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(originalImage, 0, 0);

  const currentImageData = ctx.getImageData(0, 0, width, height);
  const pixels = currentImageData.data;
  const thresholds = [0.01, 0.25, 0.5, 0.75];

  for (let i = 0; i < data.length; i++) {
    if (labelMask[i] === 1) continue;
    const intensity = data[i];
    if (intensity < 0.01) continue;

    const pxIdx = i * 4;
    let currentColor = { r: pixels[pxIdx], g: pixels[pxIdx + 1], b: pixels[pxIdx + 2], a: 1.0 };

    for (let j = 0; j < layers.length; j++) {
      const threshold = thresholds[j];
      if (intensity >= threshold) {
        const layer = layers[j];
        let factor = 1.0;
        if (blur > 0) {
          const range = 0.25 * blur;
          if (intensity < threshold + range) {
            factor = (intensity - threshold) / range;
          }
        }
        currentColor = blend(currentColor, { 
          r: layer.r, 
          g: layer.g, 
          b: layer.b, 
          a: layer.alpha * globalOpacity * factor 
        });
      }
    }
    pixels[pxIdx] = currentColor.r;
    pixels[pxIdx + 1] = currentColor.g;
    pixels[pxIdx + 2] = currentColor.b;
  }
  ctx.putImageData(currentImageData, 0, 0);
}
