/**
 * PatPlacer Image Processor Module
 * Handles image loading, resizing, color matching, dithering, and post-processing
 * Adapted from Wplace-AutoBot's image-processor.js for modularity
 */

(function() {
  'use strict';

  /**
   * ImageProcessor Class
   * Core image processing engine for PatPlacer
   */
  class ImageProcessor {
    constructor(imageSrc = null) {
      this.imageSrc = imageSrc;
      this.img = null;
      this.canvas = null;
      this.ctx = null;
      
      // Dithering buffers
      this._ditherWorkBuf = null;
      this._ditherEligibleBuf = null;
      
      // Color caches for performance
      this._colorCache = new Map();
      this._labCache = new Map();
      this._hsvCache = new Map();
      this._hslCache = new Map();
      this._xyzCache = new Map();
      this._luvCache = new Map();
      this._yuvCache = new Map();
      this._oklabCache = new Map();
      this._lchCache = new Map();
      
      // Configuration
      this.TRANSPARENCY_THRESHOLD = 128;
      this.WHITE_THRESHOLD = 230;
      this.COLOR_CACHE_LIMIT = 15000;
    }

    // ============================================================
    // IMAGE LOADING
    // ============================================================

    /**
     * Load image from source URL/data URL
     */
    async load() {
      if (!this.imageSrc) {
        throw new Error('No image source provided');
      }

      return new Promise((resolve, reject) => {
        this.img = new Image();
        this.img.crossOrigin = 'anonymous';
        this.img.onload = () => {
          this.canvas = document.createElement('canvas');
          this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
          this.canvas.width = this.img.width;
          this.canvas.height = this.img.height;
          this.ctx.drawImage(this.img, 0, 0);
          resolve();
        };
        this.img.onerror = reject;
        this.img.src = this.imageSrc;
      });
    }
    
    /**
     * Load image from ImageBitmap (used when bitmap is already available)
     */
    async loadFromBitmap(bitmap) {
      this.img = bitmap;
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.canvas.width = bitmap.width;
      this.canvas.height = bitmap.height;
      this.ctx.drawImage(bitmap, 0, 0);
      // Clear caches when loading new image
      this.clearCaches();
    }

    /**
     * Generate preview with resizing
     */
    generatePreview(width, height) {
      if (!this.canvas) {
        throw new Error('Image not loaded. Call load() first.');
      }

      const previewCanvas = document.createElement('canvas');
      const previewCtx = previewCanvas.getContext('2d');
      previewCanvas.width = width;
      previewCanvas.height = height;

      previewCtx.imageSmoothingEnabled = false;
      previewCtx.drawImage(this.canvas, 0, 0, width, height);

      return previewCanvas.toDataURL();
    }

    /**
     * Get the internal canvas element
     */
    getCanvas() {
      return this.canvas;
    }

    /**
     * Get image dimensions
     */
    getDimensions() {
      if (!this.canvas) throw new Error('Image not loaded');
      return { width: this.canvas.width, height: this.canvas.height };
    }

    /**
     * Get raw RGBA pixel data
     */
    getPixelData() {
      if (!this.ctx) throw new Error('Image not loaded');
      return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    }

    /**
     * Get ImageData object
     */
    getImageData() {
      if (!this.ctx) throw new Error('Image not loaded');
      return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Set pixel data back to canvas
     */
    setPixelData(data) {
      if (!this.ctx) throw new Error('Image not loaded');
      const imageData = new ImageData(
        new Uint8ClampedArray(data),
        this.canvas.width,
        this.canvas.height
      );
      this.ctx.putImageData(imageData, 0, 0);
    }

    /**
     * Get canvas as data URL
     */
    toDataURL(type = 'image/png') {
      if (!this.canvas) throw new Error('Image not loaded');
      return this.canvas.toDataURL(type);
    }

    /**
     * Create ImageBitmap from current canvas state
     */
    async createImageBitmap() {
      if (!this.canvas) throw new Error('Image not loaded');
      return await createImageBitmap(this.canvas);
    }

    // ============================================================
    // RESAMPLING METHODS
    // ============================================================

    /**
     * Resize image with specified resampling method
     */
    resize(newWidth, newHeight, method = 'nearest') {
      if (!this.canvas || !this.ctx) throw new Error('Image not loaded');

      const resampledCanvas = this.resampleImage(this.canvas, newWidth, newHeight, method);
      
      this.canvas.width = newWidth;
      this.canvas.height = newHeight;
      this.ctx.clearRect(0, 0, newWidth, newHeight);
      this.ctx.drawImage(resampledCanvas, 0, 0);

      return this.getPixelData();
    }

    /**
     * Route to appropriate resampling method
     */
    resampleImage(source, dstW, dstH, method = 'nearest') {
      const srcW = source.width;
      const factor = srcW / dstW;
      const isInteger = Math.abs(factor - Math.round(factor)) < 1e-6;

      // Non-integer factors: only nearest and bilinear work
      if (!isInteger) {
        if (method === 'bilinear') return this.resampleBilinear(source, dstW, dstH);
        return this.resampleNearest(source, dstW, dstH);
      }

      const intFactor = Math.max(1, Math.round(factor));
      
      switch (method) {
        case 'bilinear': return this.resampleBilinear(source, dstW, dstH);
        case 'box': return this.resampleBox(source, dstW, dstH, intFactor);
        case 'median': return this.resampleMedian(source, dstW, dstH, intFactor);
        case 'dominant': return this.resampleDominant(source, dstW, dstH, intFactor);
        default: return this.resampleNearest(source, dstW, dstH);
      }
    }

    /**
     * Nearest neighbor (pixel-perfect, sharp edges)
     */
    resampleNearest(source, dstW, dstH) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = dstW;
      canvas.height = dstH;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, 0, 0, dstW, dstH);
      return canvas;
    }

    /**
     * Bilinear (smooth, anti-aliased)
     */
    resampleBilinear(source, dstW, dstH) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = dstW;
      canvas.height = dstH;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, dstW, dstH);
      return canvas;
    }

    /**
     * Box filter (average of pixels in block)
     */
    resampleBox(source, dstW, dstH, factor) {
      const srcCanvas = document.createElement('canvas');
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      srcCanvas.width = source.width;
      srcCanvas.height = source.height;
      srcCtx.drawImage(source, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, source.width, source.height).data;
      
      const dstCanvas = document.createElement('canvas');
      const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
      dstCanvas.width = dstW;
      dstCanvas.height = dstH;
      const dstImageData = dstCtx.createImageData(dstW, dstH);
      const dstData = dstImageData.data;

      const sw = source.width, sh = source.height;

      for (let y = 0; y < dstH; y++) {
        const sy0 = y * factor;
        const sy1 = Math.min(sh, sy0 + factor);
        for (let x = 0; x < dstW; x++) {
          const sx0 = x * factor;
          const sx1 = Math.min(sw, sx0 + factor);
          let r = 0, g = 0, b = 0, a = 0, cnt = 0;
          
          for (let yy = sy0; yy < sy1; yy++) {
            let p = (yy * sw + sx0) * 4;
            for (let xx = sx0; xx < sx1; xx++) {
              r += srcData[p]; g += srcData[p + 1];
              b += srcData[p + 2]; a += srcData[p + 3];
              cnt++; p += 4;
            }
          }
          
          const q = (y * dstW + x) * 4;
          dstData[q] = Math.round(r / cnt);
          dstData[q + 1] = Math.round(g / cnt);
          dstData[q + 2] = Math.round(b / cnt);
          dstData[q + 3] = Math.round(a / cnt);
        }
      }
      
      dstCtx.putImageData(dstImageData, 0, 0);
      return dstCanvas;
    }

    /**
     * Median filter (median color in block - reduces noise)
     */
    resampleMedian(source, dstW, dstH, factor) {
      const srcCanvas = document.createElement('canvas');
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      srcCanvas.width = source.width;
      srcCanvas.height = source.height;
      srcCtx.drawImage(source, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, source.width, source.height).data;
      
      const dstCanvas = document.createElement('canvas');
      const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
      dstCanvas.width = dstW;
      dstCanvas.height = dstH;
      const dstImageData = dstCtx.createImageData(dstW, dstH);
      const dstData = dstImageData.data;

      const sw = source.width, sh = source.height;
      const rHist = new Uint32Array(16);
      const gHist = new Uint32Array(16);
      const bHist = new Uint32Array(16);
      const aHist = new Uint32Array(16);
      const binToByte = (bin) => (bin * 17) | 0;

      for (let y = 0; y < dstH; y++) {
        const sy0 = y * factor;
        const sy1 = Math.min(sh, sy0 + factor);
        for (let x = 0; x < dstW; x++) {
          rHist.fill(0); gHist.fill(0); bHist.fill(0); aHist.fill(0);
          const sx0 = x * factor;
          const sx1 = Math.min(sw, sx0 + factor);
          
          for (let yy = sy0; yy < sy1; yy++) {
            let p = (yy * sw + sx0) * 4;
            for (let xx = sx0; xx < sx1; xx++) {
              rHist[srcData[p] >> 4]++;
              gHist[srcData[p + 1] >> 4]++;
              bHist[srcData[p + 2] >> 4]++;
              aHist[srcData[p + 3] >> 4]++;
              p += 4;
            }
          }
          
          const half = ((sx1 - sx0) * (sy1 - sy0)) >> 1;
          const medianFrom = (hist) => {
            let acc = 0;
            for (let i = 0; i < 16; i++) {
              acc += hist[i];
              if (acc > half) return binToByte(i);
            }
            return binToByte(15);
          };
          
          const q = (y * dstW + x) * 4;
          dstData[q] = medianFrom(rHist);
          dstData[q + 1] = medianFrom(gHist);
          dstData[q + 2] = medianFrom(bHist);
          dstData[q + 3] = medianFrom(aHist);
        }
      }
      
      dstCtx.putImageData(dstImageData, 0, 0);
      return dstCanvas;
    }

    /**
     * Dominant color (most frequent color in block - preserves hard edges)
     */
    resampleDominant(source, dstW, dstH, factor) {
      const srcCanvas = document.createElement('canvas');
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      srcCanvas.width = source.width;
      srcCanvas.height = source.height;
      srcCtx.drawImage(source, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, source.width, source.height).data;
      
      const dstCanvas = document.createElement('canvas');
      const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
      dstCanvas.width = dstW;
      dstCanvas.height = dstH;
      const dstImageData = dstCtx.createImageData(dstW, dstH);
      const dstData = dstImageData.data;

      const sw = source.width, sh = source.height;
      const counts = new Uint32Array(4096);

      for (let y = 0; y < dstH; y++) {
        const sy0 = y * factor;
        const sy1 = Math.min(sh, sy0 + factor);
        for (let x = 0; x < dstW; x++) {
          counts.fill(0);
          const sx0 = x * factor;
          const sx1 = Math.min(sw, sx0 + factor);
          let bestIdx = 0, bestCount = -1;
          
          for (let yy = sy0; yy < sy1; yy++) {
            let p = (yy * sw + sx0) * 4;
            for (let xx = sx0; xx < sx1; xx++) {
              const r = srcData[p] >> 4;
              const g = srcData[p + 1] >> 4;
              const b = srcData[p + 2] >> 4;
              const idx = (r << 8) | (g << 4) | b;
              const c = (counts[idx] = (counts[idx] + 1) >>> 0);
              if (c > bestCount) { bestCount = c; bestIdx = idx; }
              p += 4;
            }
          }
          
          const r = ((bestIdx >> 8) & 0xF) * 17;
          const g = ((bestIdx >> 4) & 0xF) * 17;
          const b = (bestIdx & 0xF) * 17;
          const q = (y * dstW + x) * 4;
          dstData[q] = r; dstData[q + 1] = g; dstData[q + 2] = b; dstData[q + 3] = 255;
        }
      }
      
      dstCtx.putImageData(dstImageData, 0, 0);
      return dstCanvas;
    }

    // ============================================================
    // COLOR SPACE CONVERSIONS
    // ============================================================

    /**
     * RGB to LAB (perceptually uniform)
     */
    _rgbToLab(r, g, b) {
      // Normalize and gamma correct
      let x = r / 255.0, y = g / 255.0, z = b / 255.0;
      x = x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
      y = y > 0.04045 ? Math.pow((y + 0.055) / 1.055, 2.4) : y / 12.92;
      z = z > 0.04045 ? Math.pow((z + 0.055) / 1.055, 2.4) : z / 12.92;

      // To XYZ (sRGB matrix)
      let X = x * 0.4124564 + y * 0.3575761 + z * 0.1804375;
      let Y = x * 0.2126729 + y * 0.7151522 + z * 0.0721750;
      let Z = x * 0.0193339 + y * 0.1191920 + z * 0.9503041;

      // Normalize for D65
      X /= 0.95047; Y /= 1.00000; Z /= 1.08883;

      // To LAB
      X = X > 0.008856 ? Math.pow(X, 1/3) : (7.787 * X + 16/116);
      Y = Y > 0.008856 ? Math.pow(Y, 1/3) : (7.787 * Y + 16/116);
      Z = Z > 0.008856 ? Math.pow(Z, 1/3) : (7.787 * Z + 16/116);

      return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
    }

    /**
     * Get LAB with caching
     */
    _getLab(r, g, b) {
      const key = (r << 16) | (g << 8) | b;
      let v = this._labCache.get(key);
      if (!v) {
        v = this._rgbToLab(r, g, b);
        this._labCache.set(key, v);
      }
      return v;
    }

    /**
     * RGB to HSV
     */
    _rgbToHsv(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const delta = max - min;
      let h = 0;
      const s = max === 0 ? 0 : delta / max;
      const v = max;

      if (delta !== 0) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
      }
      return [h, s, v];
    }

    /**
     * RGB to Oklab (modern perceptual color space)
     */
    _rgbToOklab(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
      g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
      b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

      const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
      const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
      const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

      const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);

      return [
        0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
        1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
        0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
      ];
    }

    /**
     * Oklab to RGB
     */
    _oklabToRgb(l, a, b) {
      const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

      const l3 = l_ * l_ * l_;
      const m3 = m_ * m_ * m_;
      const s3 = s_ * s_ * s_;

      let r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      let b2 = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

      r = r > 0.0031308 ? 1.055 * Math.pow(r, 1.0 / 2.4) - 0.055 : 12.92 * r;
      g = g > 0.0031308 ? 1.055 * Math.pow(g, 1.0 / 2.4) - 0.055 : 12.92 * g;
      b2 = b2 > 0.0031308 ? 1.055 * Math.pow(b2, 1.0 / 2.4) - 0.055 : 12.92 * b2;

      return [
        Math.round(Math.max(0, Math.min(1, r)) * 255),
        Math.round(Math.max(0, Math.min(1, g)) * 255),
        Math.round(Math.max(0, Math.min(1, b2)) * 255)
      ];
    }

    /**
     * RGB to HSL
     */
    _rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }
      return [h * 360, s * 100, l * 100];
    }

    /**
     * HSL to RGB
     */
    _hslToRgb(h, s, l) {
      h /= 360; s /= 100; l /= 100;
      let r, g, b;
      if (s === 0) {
        r = g = b = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
      }
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    /**
     * HSV to RGB
     */
    _hsvToRgb(h, s, v) {
      const c = v * s;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = v - c;
      let r = 0, g = 0, b = 0;

      if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
      else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
      else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
      else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
      else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
      else if (h >= 300 && h < 360) { r = c; g = 0; b = x; }

      return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
      ];
    }

    /**
     * RGB to XYZ
     */
    _rgbToXyz(r, g, b) {
      let x = r / 255.0, y = g / 255.0, z = b / 255.0;
      x = x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
      y = y > 0.04045 ? Math.pow((y + 0.055) / 1.055, 2.4) : y / 12.92;
      z = z > 0.04045 ? Math.pow((z + 0.055) / 1.055, 2.4) : z / 12.92;

      const X = x * 0.4124564 + y * 0.3575761 + z * 0.1804375;
      const Y = x * 0.2126729 + y * 0.7151522 + z * 0.0721750;
      const Z = x * 0.0193339 + y * 0.1191920 + z * 0.9503041;
      return [X, Y, Z];
    }

    /**
     * XYZ to RGB
     */
    _xyzToRgb(x, y, z) {
      let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
      let g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
      let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

      r = r > 0.0031308 ? 1.055 * Math.pow(r, 1.0 / 2.4) - 0.055 : 12.92 * r;
      g = g > 0.0031308 ? 1.055 * Math.pow(g, 1.0 / 2.4) - 0.055 : 12.92 * g;
      b = b > 0.0031308 ? 1.055 * Math.pow(b, 1.0 / 2.4) - 0.055 : 12.92 * b;

      return [
        Math.round(Math.max(0, Math.min(1, r)) * 255),
        Math.round(Math.max(0, Math.min(1, g)) * 255),
        Math.round(Math.max(0, Math.min(1, b)) * 255)
      ];
    }

    /**
     * RGB to LUV
     */
    _rgbToLuv(r, g, b) {
      const [X, Y, Z] = this._rgbToXyz(r, g, b);
      const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
      const yr = Y / Yn;
      const L = yr > 0.008856 ? 116 * Math.pow(yr, 1/3) - 16 : 903.3 * yr;

      const denom = X + 15 * Y + 3 * Z;
      const denomN = Xn + 15 * Yn + 3 * Zn;
      const up = denom === 0 ? 0 : (4 * X) / denom;
      const vp = denom === 0 ? 0 : (9 * Y) / denom;
      const upN = (4 * Xn) / denomN;
      const vpN = (9 * Yn) / denomN;

      const u = 13 * L * (up - upN);
      const v = 13 * L * (vp - vpN);
      return [L, u, v];
    }

    /**
     * LUV to RGB
     */
    _luvToRgb(l, u, v) {
      const Xn = 0.95047, Yn = 1.00000, Zn = 1.08883;
      const upN = (4 * Xn) / (Xn + 15 * Yn + 3 * Zn);
      const vpN = (9 * Yn) / (Xn + 15 * Yn + 3 * Zn);

      const Y = l > 8 ? Yn * Math.pow((l + 16) / 116, 3) : Yn * l / 903.3;
      const up = u / (13 * l) + upN;
      const vp = v / (13 * l) + vpN;

      const X = Y * 9 * up / (4 * vp);
      const Z = Y * (12 - 3 * up - 20 * vp) / (4 * vp);
      return this._xyzToRgb(X, Y, Z);
    }

    /**
     * RGB to YUV
     */
    _rgbToYuv(r, g, b) {
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const U = -0.14713 * r - 0.28886 * g + 0.436 * b;
      const V = 0.615 * r - 0.51499 * g - 0.10001 * b;
      return [Y, U, V];
    }

    /**
     * YUV to RGB
     */
    _yuvToRgb(y, u, v) {
      const r = y + 1.13983 * v;
      const g = y - 0.39465 * u - 0.58060 * v;
      const b = y + 2.03211 * u;
      return [
        Math.round(Math.max(0, Math.min(255, r))),
        Math.round(Math.max(0, Math.min(255, g))),
        Math.round(Math.max(0, Math.min(255, b)))
      ];
    }

    /**
     * LAB to LCH
     */
    _labToLch(l, a, b) {
      const c = Math.sqrt(a * a + b * b);
      let h = Math.atan2(b, a) * 180 / Math.PI;
      if (h < 0) h += 360;
      return [l, c, h];
    }

    /**
     * LCH to LAB
     */
    _lchToLab(l, c, h) {
      const hRad = h * Math.PI / 180;
      const a = c * Math.cos(hRad);
      const b = c * Math.sin(hRad);
      return [l, a, b];
    }

    // ============================================================
    // COLOR MATCHING
    // ============================================================

    /**
     * Find closest palette color using specified algorithm
     * @param {number} r,g,b - Input color
     * @param {Array} palette - [[r,g,b], ...] or [{r,g,b}, ...]
     * @param {string} algorithm - 'rgb', 'lab', 'oklab', 'hsv'
     * @param {Object} options - { enableChromaPenalty, chromaPenaltyWeight }
     */
    findClosestPaletteColor(r, g, b, palette, algorithm = 'lab', options = {}) {
      if (!palette || palette.length === 0) return [0, 0, 0];

      const { enableChromaPenalty = false, chromaPenaltyWeight = 0.15 } = options;

      // Normalize palette format
      const normPalette = palette.map(c => 
        Array.isArray(c) ? c : [c.r, c.g, c.b]
      );

      // RGB (Legacy weighted euclidean)
      if (algorithm === 'rgb') {
        let best = [0, 0, 0], bestDist = Infinity;
        for (const [pr, pg, pb] of normPalette) {
          const rmean = (pr + r) / 2;
          const rdiff = pr - r, gdiff = pg - g, bdiff = pb - b;
          const dist = Math.sqrt(
            (((512 + rmean) * rdiff * rdiff) >> 8) +
            4 * gdiff * gdiff +
            (((767 - rmean) * bdiff * bdiff) >> 8)
          );
          if (dist < bestDist) { bestDist = dist; best = [pr, pg, pb]; }
        }
        return best;
      }

      // HSV
      if (algorithm === 'hsv') {
        const [ht, st, vt] = this._rgbToHsv(r, g, b);
        let best = null, bestDist = Infinity;
        for (const [pr, pg, pb] of normPalette) {
          const [hp, sp, vp] = this._rgbToHsv(pr, pg, pb);
          const dh = Math.min(Math.abs(ht - hp), 360 - Math.abs(ht - hp)) / 360;
          const dist = dh * dh + (st - sp) ** 2 + (vt - vp) ** 2;
          if (dist < bestDist) { bestDist = dist; best = [pr, pg, pb]; }
        }
        return best || [0, 0, 0];
      }

      // OKLAB
      if (algorithm === 'oklab') {
        const [lt, at, bt] = this._rgbToOklab(r, g, b);
        let best = null, bestDist = Infinity;
        for (const [pr, pg, pb] of normPalette) {
          const [lp, ap, bp] = this._rgbToOklab(pr, pg, pb);
          const dist = (lt - lp) ** 2 + (at - ap) ** 2 + (bt - bp) ** 2;
          if (dist < bestDist) { bestDist = dist; best = [pr, pg, pb]; }
        }
        return best || [0, 0, 0];
      }

      // LAB (default - best for human perception)
      const [Lt, at, bt] = this._getLab(r, g, b);
      const targetChroma = Math.sqrt(at * at + bt * bt);
      let best = null, bestDist = Infinity;

      for (const [pr, pg, pb] of normPalette) {
        const [Lp, ap, bp] = this._getLab(pr, pg, pb);
        let dist = (Lt - Lp) ** 2 + (at - ap) ** 2 + (bt - bp) ** 2;

        // Chroma penalty for saturated colors
        if (enableChromaPenalty && targetChroma > 20) {
          const candChroma = Math.sqrt(ap * ap + bp * bp);
          if (candChroma < targetChroma) {
            dist += (targetChroma - candChroma) ** 2 * chromaPenaltyWeight;
          }
        }

        if (dist < bestDist) { bestDist = dist; best = [pr, pg, pb]; }
      }

      return best || [0, 0, 0];
    }

    /**
     * Check if pixel is white
     */
    isWhitePixel(r, g, b, threshold = this.WHITE_THRESHOLD) {
      return r >= threshold && g >= threshold && b >= threshold;
    }

    /**
     * Resolve target RGB to closest available color with caching
     */
    resolveColor(targetRgb, availableColors, options = {}) {
      const {
        exactMatch = false,
        algorithm = 'lab',
        enableChromaPenalty = false,
        chromaPenaltyWeight = 0.15,
        whiteThreshold = this.WHITE_THRESHOLD
      } = options;

      if (!availableColors || availableColors.length === 0) {
        return { id: null, rgb: targetRgb };
      }

      const cacheKey = `${targetRgb[0]},${targetRgb[1]},${targetRgb[2]}|${algorithm}|${enableChromaPenalty ? 'c' : 'nc'}|${chromaPenaltyWeight}|${exactMatch ? 'exact' : 'closest'}`;

      if (this._colorCache.has(cacheKey)) {
        return this._colorCache.get(cacheKey);
      }

      // Check for exact match
      if (exactMatch) {
        const match = availableColors.find(
          (c) => c.rgb[0] === targetRgb[0] && c.rgb[1] === targetRgb[1] && c.rgb[2] === targetRgb[2]
        );
        const result = match ? { id: match.id, rgb: [...match.rgb] } : { id: null, rgb: targetRgb };
        this._colorCache.set(cacheKey, result);
        return result;
      }

      // Check for white pixel matching
      if (
        targetRgb[0] >= whiteThreshold &&
        targetRgb[1] >= whiteThreshold &&
        targetRgb[2] >= whiteThreshold
      ) {
        const whiteEntry = availableColors.find(
          (c) => c.rgb[0] >= whiteThreshold && c.rgb[1] >= whiteThreshold && c.rgb[2] >= whiteThreshold
        );
        if (whiteEntry) {
          const result = { id: whiteEntry.id, rgb: [...whiteEntry.rgb] };
          this._colorCache.set(cacheKey, result);
          return result;
        }
      }

      // Find nearest color
      let bestId = availableColors[0].id;
      let bestRgb = [...availableColors[0].rgb];
      let bestScore = Infinity;

      if (algorithm === 'legacy') {
        for (let i = 0; i < availableColors.length; i++) {
          const c = availableColors[i];
          const [r, g, b] = c.rgb;
          const rmean = (r + targetRgb[0]) / 2;
          const rdiff = r - targetRgb[0];
          const gdiff = g - targetRgb[1];
          const bdiff = b - targetRgb[2];
          const dist = Math.sqrt(
            (((512 + rmean) * rdiff * rdiff) >> 8) +
            4 * gdiff * gdiff +
            (((767 - rmean) * bdiff * bdiff) >> 8)
          );
          if (dist < bestScore) {
            bestScore = dist;
            bestId = c.id;
            bestRgb = [...c.rgb];
            if (dist === 0) break;
          }
        }
      } else {
        const [Lt, at, bt] = this._getLab(targetRgb[0], targetRgb[1], targetRgb[2]);
        const targetChroma = Math.sqrt(at * at + bt * bt);
        const penaltyWeight = enableChromaPenalty ? chromaPenaltyWeight : 0;

        for (let i = 0; i < availableColors.length; i++) {
          const c = availableColors[i];
          const [r, g, b] = c.rgb;
          const [L2, a2, b2] = this._getLab(r, g, b);
          const dL = Lt - L2;
          const da = at - a2;
          const db = bt - b2;
          let dist = dL * dL + da * da + db * db;

          if (penaltyWeight > 0 && targetChroma > 20) {
            const candChroma = Math.sqrt(a2 * a2 + b2 * b2);
            if (candChroma < targetChroma) {
              const cd = targetChroma - candChroma;
              dist += cd * cd * penaltyWeight;
            }
          }

          if (dist < bestScore) {
            bestScore = dist;
            bestId = c.id;
            bestRgb = [...c.rgb];
            if (dist === 0) break;
          }
        }
      }

      const result = { id: bestId, rgb: bestRgb };
      this._colorCache.set(cacheKey, result);

      // Limit cache size
      if (this._colorCache.size > 20000) this._colorCache.clear();

      return result;
    }

    // ============================================================
    // DITHERING
    // ============================================================

    /**
     * Ensure dithering buffers exist
     */
    _ensureDitherBuffers(n) {
      if (!this._ditherWorkBuf || this._ditherWorkBuf.length !== n * 3) {
        this._ditherWorkBuf = new Float32Array(n * 3);
      }
      if (!this._ditherEligibleBuf || this._ditherEligibleBuf.length !== n) {
        this._ditherEligibleBuf = new Uint8Array(n);
      }
      return { work: this._ditherWorkBuf, eligible: this._ditherEligibleBuf };
    }

    /**
     * Apply dithering with multiple algorithm support
     */
    applyDithering(imageData, width, height, palette, options = {}) {
      const {
        method = 'floyd',
        strength = 0.5,
        algorithm = 'lab',
        enableChromaPenalty = false,
        chromaPenaltyWeight = 0.15,
        paintTransparentPixels = false,
        paintWhitePixels = true,
        transparencyThreshold = this.TRANSPARENCY_THRESHOLD,
        whiteThreshold = this.WHITE_THRESHOLD
      } = options;

      // Error diffusion methods
      const errorDiffusion = ['floyd', 'atkinson', 'jarvis', 'stucki', 'burkes', 'sierra'];
      const ordered = ['bayer2', 'bayer4', 'bayer8', 'random'];

      if (errorDiffusion.includes(method)) {
        return this._applyErrorDiffusion(imageData, width, height, palette, method, options);
      } else if (ordered.includes(method)) {
        return this._applyOrderedDither(imageData, width, height, palette, method, strength, options);
      } else {
        console.warn(`Unknown dithering: ${method}, using floyd`);
        return this._applyErrorDiffusion(imageData, width, height, palette, 'floyd', options);
      }
    }

    /**
     * Error diffusion dithering (Floyd-Steinberg, Atkinson, etc.)
     */
    _applyErrorDiffusion(imageData, width, height, palette, method, options) {
      const data = new Uint8ClampedArray(imageData);
      const n = width * height;
      const { work, eligible } = this._ensureDitherBuffers(n);
      let totalValid = 0;

      const {
        algorithm = 'lab',
        enableChromaPenalty = false,
        chromaPenaltyWeight = 0.15,
        paintTransparentPixels = false,
        paintWhitePixels = true,
        transparencyThreshold = this.TRANSPARENCY_THRESHOLD,
        whiteThreshold = this.WHITE_THRESHOLD
      } = options;

      // Init buffers
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const i4 = idx * 4;
          const r = data[i4], g = data[i4 + 1], b = data[i4 + 2], a = data[i4 + 3];

          const isEligible = 
            (paintTransparentPixels || a >= transparencyThreshold) &&
            (paintWhitePixels || !this.isWhitePixel(r, g, b, whiteThreshold));

          eligible[idx] = isEligible ? 1 : 0;
          work[idx * 3] = r;
          work[idx * 3 + 1] = g;
          work[idx * 3 + 2] = b;

          if (!isEligible) data[i4 + 3] = 0;
        }
      }

      // Get kernel
      const kernel = this._getDitherKernel(method);

      // Diffuse error function
      const diffuse = (nx, ny, er, eg, eb, factor) => {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) return;
        const nidx = ny * width + nx;
        if (!eligible[nidx]) return;
        const base = nidx * 3;
        work[base] = Math.min(255, Math.max(0, work[base] + er * factor));
        work[base + 1] = Math.min(255, Math.max(0, work[base + 1] + eg * factor));
        work[base + 2] = Math.min(255, Math.max(0, work[base + 2] + eb * factor));
      };

      // Process pixels
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (!eligible[idx]) continue;

          const base = idx * 3;
          const r0 = work[base], g0 = work[base + 1], b0 = work[base + 2];
          const i4 = idx * 4;
          const a = data[i4 + 3];

          // Transparent pixel handling
          if (paintTransparentPixels && a < transparencyThreshold) {
            data[i4] = 0; data[i4 + 1] = 0; data[i4 + 2] = 0; data[i4 + 3] = 0;
            totalValid++;
            continue;
          }

          // Find closest color
          const [nr, ng, nb] = this.findClosestPaletteColor(
            r0, g0, b0, palette, algorithm, { enableChromaPenalty, chromaPenaltyWeight }
          );

          data[i4] = nr; data[i4 + 1] = ng; data[i4 + 2] = nb; data[i4 + 3] = 255;
          totalValid++;

          // Diffuse error
          const er = r0 - nr, eg = g0 - ng, eb = b0 - nb;
          for (const { dx, dy, weight } of kernel.offsets) {
            diffuse(x + dx, y + dy, er, eg, eb, weight / kernel.divisor);
          }
        }
      }

      return { data, totalValidPixels: totalValid };
    }

    /**
     * Apply posterization (color quantization by levels)
     * @private
     */
    _applyPosterize(data, width, height, levels) {
      const result = new Uint8ClampedArray(data);
      const step = 256 / levels;

      for (let i = 0; i < result.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const value = result[i + c];
          result[i + c] = Math.floor(value / step) * step;
        }
      }

      return result;
    }

    /**
     * Ordered dithering (Bayer matrix)
     */
    _applyOrderedDither(imageData, width, height, palette, method, strength, options) {
      const data = new Uint8ClampedArray(imageData);
      let totalValid = 0;

      const {
        algorithm = 'lab',
        enableChromaPenalty = false,
        chromaPenaltyWeight = 0.15,
        paintTransparentPixels = false,
        paintWhitePixels = true,
        transparencyThreshold = this.TRANSPARENCY_THRESHOLD,
        whiteThreshold = this.WHITE_THRESHOLD
      } = options;

      const matrix = this._getBayerMatrix(method);
      const matrixSize = matrix ? matrix.length : 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

          const isTransparent = a < transparencyThreshold;
          const isEligible = 
            (paintTransparentPixels || !isTransparent) &&
            (paintWhitePixels || !this.isWhitePixel(r, g, b, whiteThreshold));

          if (!isEligible) { data[i + 3] = 0; continue; }

          if (paintTransparentPixels && isTransparent) {
            data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
            totalValid++;
            continue;
          }

          // Get threshold
          let threshold = method === 'random' 
            ? Math.random() 
            : matrix[y % matrixSize][x % matrixSize];

          const noise = (threshold - 0.5) * 64 * strength;
          const nr = Math.max(0, Math.min(255, r + noise));
          const ng = Math.max(0, Math.min(255, g + noise));
          const nb = Math.max(0, Math.min(255, b + noise));

          const [pr, pg, pb] = this.findClosestPaletteColor(
            nr, ng, nb, palette, algorithm, { enableChromaPenalty, chromaPenaltyWeight }
          );

          data[i] = pr; data[i + 1] = pg; data[i + 2] = pb; data[i + 3] = 255;
          totalValid++;
        }
      }

      return { data, totalValidPixels: totalValid };
    }

    /**
     * Get dithering kernel by name
     */
    _getDitherKernel(method) {
      const kernels = {
        floyd: {
          divisor: 16,
          offsets: [
            { dx: 1, dy: 0, weight: 7 },
            { dx: -1, dy: 1, weight: 3 },
            { dx: 0, dy: 1, weight: 5 },
            { dx: 1, dy: 1, weight: 1 }
          ]
        },
        atkinson: {
          divisor: 8,
          offsets: [
            { dx: 1, dy: 0, weight: 1 }, { dx: 2, dy: 0, weight: 1 },
            { dx: -1, dy: 1, weight: 1 }, { dx: 0, dy: 1, weight: 1 },
            { dx: 1, dy: 1, weight: 1 }, { dx: 0, dy: 2, weight: 1 }
          ]
        },
        jarvis: {
          divisor: 48,
          offsets: [
            { dx: 1, dy: 0, weight: 7 }, { dx: 2, dy: 0, weight: 5 },
            { dx: -2, dy: 1, weight: 3 }, { dx: -1, dy: 1, weight: 5 },
            { dx: 0, dy: 1, weight: 7 }, { dx: 1, dy: 1, weight: 5 },
            { dx: 2, dy: 1, weight: 3 }, { dx: -2, dy: 2, weight: 1 },
            { dx: -1, dy: 2, weight: 3 }, { dx: 0, dy: 2, weight: 5 },
            { dx: 1, dy: 2, weight: 3 }, { dx: 2, dy: 2, weight: 1 }
          ]
        },
        stucki: {
          divisor: 42,
          offsets: [
            { dx: 1, dy: 0, weight: 8 }, { dx: 2, dy: 0, weight: 4 },
            { dx: -2, dy: 1, weight: 2 }, { dx: -1, dy: 1, weight: 4 },
            { dx: 0, dy: 1, weight: 8 }, { dx: 1, dy: 1, weight: 4 },
            { dx: 2, dy: 1, weight: 2 }, { dx: -2, dy: 2, weight: 1 },
            { dx: -1, dy: 2, weight: 2 }, { dx: 0, dy: 2, weight: 4 },
            { dx: 1, dy: 2, weight: 2 }, { dx: 2, dy: 2, weight: 1 }
          ]
        },
        burkes: {
          divisor: 32,
          offsets: [
            { dx: 1, dy: 0, weight: 8 }, { dx: 2, dy: 0, weight: 4 },
            { dx: -2, dy: 1, weight: 2 }, { dx: -1, dy: 1, weight: 4 },
            { dx: 0, dy: 1, weight: 8 }, { dx: 1, dy: 1, weight: 4 },
            { dx: 2, dy: 1, weight: 2 }
          ]
        },
        sierra: {
          divisor: 32,
          offsets: [
            { dx: 1, dy: 0, weight: 5 }, { dx: 2, dy: 0, weight: 3 },
            { dx: -2, dy: 1, weight: 2 }, { dx: -1, dy: 1, weight: 4 },
            { dx: 0, dy: 1, weight: 5 }, { dx: 1, dy: 1, weight: 4 },
            { dx: 2, dy: 1, weight: 2 }, { dx: -1, dy: 2, weight: 2 },
            { dx: 0, dy: 2, weight: 3 }, { dx: 1, dy: 2, weight: 2 }
          ]
        }
      };
      return kernels[method] || kernels.floyd;
    }

    /**
     * Get Bayer matrix by method
     */
    _getBayerMatrix(method) {
      if (method === 'bayer2') {
        return [[0/4, 2/4], [3/4, 1/4]];
      }
      if (method === 'bayer4') {
        return [
          [0/16, 8/16, 2/16, 10/16],
          [12/16, 4/16, 14/16, 6/16],
          [3/16, 11/16, 1/16, 9/16],
          [15/16, 7/16, 13/16, 5/16]
        ];
      }
      if (method === 'bayer8') {
        return [
          [0/64, 32/64, 8/64, 40/64, 2/64, 34/64, 10/64, 42/64],
          [48/64, 16/64, 56/64, 24/64, 50/64, 18/64, 58/64, 26/64],
          [12/64, 44/64, 4/64, 36/64, 14/64, 46/64, 6/64, 38/64],
          [60/64, 28/64, 52/64, 20/64, 62/64, 30/64, 54/64, 22/64],
          [3/64, 35/64, 11/64, 43/64, 1/64, 33/64, 9/64, 41/64],
          [51/64, 19/64, 59/64, 27/64, 49/64, 17/64, 57/64, 25/64],
          [15/64, 47/64, 7/64, 39/64, 13/64, 45/64, 5/64, 37/64],
          [63/64, 31/64, 55/64, 23/64, 61/64, 29/64, 53/64, 21/64]
        ];
      }
      return null;
    }

    /**
     * Apply simple quantization (no dithering)
     */
    applySimpleQuantization(imageData, width, height, palette, options = {}) {
      const {
        algorithm = 'lab',
        enableChromaPenalty = false,
        chromaPenaltyWeight = 0.15,
        paintTransparentPixels = false,
        paintWhitePixels = true,
        transparencyThreshold = this.TRANSPARENCY_THRESHOLD,
        whiteThreshold = this.WHITE_THRESHOLD
      } = options;

      const data = new Uint8ClampedArray(imageData);
      let totalValid = 0;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        const isTransparent = a < transparencyThreshold;

        const isEligible =
          (paintTransparentPixels || !isTransparent) &&
          (paintWhitePixels || !this.isWhitePixel(r, g, b, whiteThreshold));

        if (!isEligible) { data[i + 3] = 0; continue; }

        if (paintTransparentPixels && isTransparent) {
          data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
          totalValid++;
          continue;
        }

        const [nr, ng, nb] = this.findClosestPaletteColor(
          r, g, b, palette, algorithm, { enableChromaPenalty, chromaPenaltyWeight }
        );

        data[i] = nr; data[i + 1] = ng; data[i + 2] = nb; data[i + 3] = 255;
        totalValid++;
      }

      return { data, totalValidPixels: totalValid };
    }

    // ============================================================
    // PRE-PROCESSING FILTERS
    // ============================================================

    /**
     * Apply pre-blur (before downscaling)
     */
    applyPreBlur(mode, radius) {
      if (!mode || mode === 'none' || radius <= 0) return;
      
      const r = Math.max(0, Math.floor(radius));
      if (mode === 'box') this._boxBlur(r);
      else if (mode === 'gaussian') this._gaussianBlur(r);
      else if (mode === 'kuwahara') this._kuwaharaFilter(r);
    }

    /**
     * Box blur
     */
    _boxBlur(r) {
      if (r <= 0 || !this.canvas) return;
      const w = this.canvas.width, h = this.canvas.height;
      const imgData = this.ctx.getImageData(0, 0, w, h);
      const src = imgData.data;
      const tmp = new Uint8ClampedArray(src.length);
      const win = 2 * r + 1;

      // Horizontal
      for (let y = 0; y < h; y++) {
        let rs = 0, gs = 0, bs = 0, as = 0;
        const yoff = y * w * 4;
        for (let k = -r; k <= r; k++) {
          const xx = Math.max(0, Math.min(w - 1, k));
          const p = yoff + xx * 4;
          rs += src[p]; gs += src[p + 1]; bs += src[p + 2]; as += src[p + 3];
        }
        for (let x = 0; x < w; x++) {
          const i = yoff + x * 4;
          tmp[i] = rs / win | 0; tmp[i + 1] = gs / win | 0;
          tmp[i + 2] = bs / win | 0; tmp[i + 3] = as / win | 0;
          const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r + 1);
          const p0 = yoff + x0 * 4, p1 = yoff + x1 * 4;
          rs += src[p1] - src[p0]; gs += src[p1 + 1] - src[p0 + 1];
          bs += src[p1 + 2] - src[p0 + 2]; as += src[p1 + 3] - src[p0 + 3];
        }
      }

      // Vertical
      const out = new Uint8ClampedArray(src.length);
      for (let x = 0; x < w; x++) {
        let rs = 0, gs = 0, bs = 0, as = 0;
        const xoff = x * 4;
        for (let k = -r; k <= r; k++) {
          const yy = Math.max(0, Math.min(h - 1, k));
          const p = yy * w * 4 + xoff;
          rs += tmp[p]; gs += tmp[p + 1]; bs += tmp[p + 2]; as += tmp[p + 3];
        }
        for (let y = 0; y < h; y++) {
          const i = y * w * 4 + xoff;
          out[i] = rs / win | 0; out[i + 1] = gs / win | 0;
          out[i + 2] = bs / win | 0; out[i + 3] = as / win | 0;
          const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r + 1);
          const p0 = y0 * w * 4 + xoff, p1 = y1 * w * 4 + xoff;
          rs += tmp[p1] - tmp[p0]; gs += tmp[p1 + 1] - tmp[p0 + 1];
          bs += tmp[p1 + 2] - tmp[p0 + 2]; as += tmp[p1 + 3] - tmp[p0 + 3];
        }
      }

      imgData.data.set(out);
      this.ctx.putImageData(imgData, 0, 0);
    }

    /**
     * Gaussian blur (3 box blur passes)
     */
    _gaussianBlur(r) {
      for (let i = 0; i < 3; i++) this._boxBlur(Math.max(1, r));
    }

    /**
     * Kuwahara filter (edge-preserving smoothing)
     */
    _kuwaharaFilter(r) {
      const canvas = this.canvas;
      const w = canvas.width | 0;
      const h = canvas.height | 0;
      if (r <= 0 || w === 0 || h === 0) return;

      const ctx = this.ctx;
      const img = ctx.getImageData(0, 0, w, h);
      const s = img.data;
      const out = new Uint8ClampedArray(s.length);

      // Build integral images for fast region sum calculation
      const sw = w + 1;
      const sh = h + 1;
      const N = sw * sh;
      const iR = new Float64Array(N);
      const iG = new Float64Array(N);
      const iB = new Float64Array(N);
      const iC = new Float64Array(N);
      const iL = new Float64Array(N);
      const iL2 = new Float64Array(N);

      const idx = (x, y) => y * sw + x;

      // Build integral images
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = (y * w + x) * 4;
          const a = s[p + 3] | 0;
          const c = (a >= 128) ? 1 : 0;
          const r0 = s[p] | 0;
          const g0 = s[p + 1] | 0;
          const b0 = s[p + 2] | 0;
          const lum = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;

          const ii = idx(x + 1, y + 1);
          const left = idx(x, y + 1);
          const up = idx(x + 1, y);
          const upleft = idx(x, y);

          iR[ii] = iR[left] + iR[up] - iR[upleft] + (c ? r0 : 0);
          iG[ii] = iG[left] + iG[up] - iG[upleft] + (c ? g0 : 0);
          iB[ii] = iB[left] + iB[up] - iB[upleft] + (c ? b0 : 0);
          iC[ii] = iC[left] + iC[up] - iC[upleft] + c;
          iL[ii] = iL[left] + iL[up] - iL[upleft] + (c ? lum : 0);
          iL2[ii] = iL2[left] + iL2[up] - iL2[upleft] + (c ? lum * lum : 0);
        }
      }

      const rectSum = (ii, x0, y0, x1, y1) => {
        const a = idx(x0, y0);
        const b = idx(x1, y0);
        const c = idx(x0, y1);
        const d = idx(x1, y1);
        return ii[d] - ii[b] - ii[c] + ii[a];
      };

      const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

      // Process each pixel
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = (y * w + x) * 4;
          const a = s[p + 3] | 0;

          // Skip transparent pixels
          if (a < 128) {
            out[p] = s[p];
            out[p + 1] = s[p + 1];
            out[p + 2] = s[p + 2];
            out[p + 3] = a;
            continue;
          }

          // Define 4 regions (quadrants)
          const x0 = Math.max(0, x - r);
          const x1 = x;
          const x2 = Math.min(w - 1, x + r);
          const y0 = Math.max(0, y - r);
          const y1 = y;
          const y2 = Math.min(h - 1, y + r);

          const regions = [
            { x0: x0, y0: y0, x1: x1, y1: y1 }, // Top-left
            { x0: x1, y0: y0, x1: x2, y1: y1 }, // Top-right
            { x0: x0, y0: y1, x1: x1, y1: y2 }, // Bottom-left
            { x0: x1, y0: y1, x1: x2, y1: y2 }  // Bottom-right
          ];

          let bestVar = 1e20;
          let mR = s[p];
          let mG = s[p + 1];
          let mB = s[p + 2];

          // Find region with minimum variance
          for (let k = 0; k < 4; k++) {
            const rx0 = regions[k].x0;
            const ry0 = regions[k].y0;
            const rx1 = regions[k].x1;
            const ry1 = regions[k].y1;

            const ex0 = rx0;
            const ey0 = ry0;
            const ex1 = rx1 + 1;
            const ey1 = ry1 + 1;

            const cnt = rectSum(iC, ex0, ey0, ex1, ey1);
            if (cnt <= 0) continue;

            const sumL = rectSum(iL, ex0, ey0, ex1, ey1);
            const sumL2 = rectSum(iL2, ex0, ey0, ex1, ey1);
            const meanL = sumL / cnt;
            const variance = (sumL2 / cnt) - meanL * meanL;

            if (variance < bestVar) {
              bestVar = variance;
              const sr = rectSum(iR, ex0, ey0, ex1, ey1);
              const sg = rectSum(iG, ex0, ey0, ex1, ey1);
              const sb = rectSum(iB, ex0, ey0, ex1, ey1);
              mR = clampByte((sr / cnt) | 0);
              mG = clampByte((sg / cnt) | 0);
              mB = clampByte((sb / cnt) | 0);
            }
          }

          out[p] = mR;
          out[p + 1] = mG;
          out[p + 2] = mB;
          out[p + 3] = 255;
        }
      }

      img.data.set(out);
      this.ctx.putImageData(img, 0, 0);
    }

    /**
     * Apply unsharp mask (sharpening)
     */
    applySharpen(amount, radius, threshold) {
      if (amount <= 0 || radius <= 0 || !this.canvas) return;

      const w = this.canvas.width, h = this.canvas.height;
      const origData = this.ctx.getImageData(0, 0, w, h);
      const orig = new Uint8ClampedArray(origData.data);

      // Create blurred version
      this._gaussianBlur(radius);
      const blurData = this.ctx.getImageData(0, 0, w, h).data;

      // Restore original and apply sharpening
      const k = amount / 100;
      for (let i = 0; i < orig.length; i += 4) {
        const dr = orig[i] - blurData[i];
        const dg = orig[i + 1] - blurData[i + 1];
        const db = orig[i + 2] - blurData[i + 2];

        if (Math.abs(dr) >= threshold) orig[i] = Math.min(255, Math.max(0, orig[i] + k * dr));
        if (Math.abs(dg) >= threshold) orig[i + 1] = Math.min(255, Math.max(0, orig[i + 1] + k * dg));
        if (Math.abs(db) >= threshold) orig[i + 2] = Math.min(255, Math.max(0, orig[i + 2] + k * db));
      }

      origData.data.set(orig);
      this.ctx.putImageData(origData, 0, 0);
    }

    // ============================================================
    // POST-PROCESSING
    // ============================================================

    /**
     * Apply edge overlay (draws black edges)
     */
    applyEdgeOverlay(imageData, width, height, algorithm = 'sobel', threshold = 60, thickness = 1, thinEdges = false) {
      // Detect edges with optional NMS thinning
      const edges = this._detectEdges(imageData, width, height, algorithm, threshold, thinEdges);
      const result = new Uint8ClampedArray(imageData);

      // Apply thickness by dilating edges (if thickness > 1)
      const processed = this._dilateEdges(edges, width, height, thickness);

      for (let i = 0; i < processed.length; i++) {
        if (processed[i] > 128) {
          const idx = i * 4;
          result[idx] = 0;     // R
          result[idx + 1] = 0; // G
          result[idx + 2] = 0; // B
          result[idx + 3] = 255; // A
        }
      }

      return result;
    }

    /**
     * Simplify regions by merging small color areas
     */
    simplifyRegions(imageData, width, height, minArea) {
      if (minArea <= 0) return new Uint8ClampedArray(imageData);

      const thr = Math.max(1, Math.floor(minArea || 0));
      if (width === 0 || height === 0) return new Uint8ClampedArray(imageData);

      const result = new Uint8ClampedArray(imageData);
      const visited = new Uint8Array(width * height);
      const qx = new Int32Array(width * height);
      const qy = new Int32Array(width * height);
      let qs = 0, qe = 0;

      function idx(x, y) { return (y * width + x) << 2; }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const li = y * width + x;
          if (visited[li]) continue;

          const p = li << 2;
          const a = result[p + 3] | 0;
          if (a < 128) {
            visited[li] = 1;
            continue;
          }

          const r0 = result[p] | 0;
          const g0 = result[p + 1] | 0;
          const b0 = result[p + 2] | 0;
          const key = ((r0 << 16) | (g0 << 8) | b0) >>> 0;

          qs = 0;
          qe = 0;
          qx[qe] = x;
          qy[qe] = y;
          qe++;

          const comp = [];
          const borderColors = {};
          visited[li] = 1;

          while (qs < qe) {
            const cx0 = qx[qs];
            const cy0 = qy[qs];
            qs++;
            const pi = idx(cx0, cy0);
            comp.push(pi);

            const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (let k = 0; k < 4; k++) {
              const nx = cx0 + neighbors[k][0];
              const ny = cy0 + neighbors[k][1];
              if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

              const l2 = ny * width + nx;
              if (visited[l2]) continue;

              const p2 = idx(nx, ny);
              const a2 = result[p2 + 3] | 0;
              if (a2 < 128) {
                visited[l2] = 1;
                continue;
              }

              const r = result[p2] | 0;
              const g = result[p2 + 1] | 0;
              const b = result[p2 + 2] | 0;
              const k2 = ((r << 16) | (g << 8) | b) >>> 0;

              if (k2 === key) {
                visited[l2] = 1;
                qx[qe] = nx;
                qy[qe] = ny;
                qe++;
              } else {
                borderColors[k2] = (borderColors[k2] || 0) + 1;
              }
            }
          }

          if (comp.length > 0 && comp.length < thr) {
            let bestKey = -1;
            let bestCnt = -1;
            for (const ks in borderColors) {
              const c = borderColors[ks] | 0;
              if (c > bestCnt) {
                bestCnt = c;
                bestKey = Number(ks) | 0;
              }
            }

            if (bestKey >= 0) {
              const nr = (bestKey >>> 16) & 255;
              const ng = (bestKey >>> 8) & 255;
              const nb = bestKey & 255;
              for (let i = 0; i < comp.length; i++) {
                const p3 = comp[i];
                result[p3] = nr;
                result[p3 + 1] = ng;
                result[p3 + 2] = nb;
                result[p3 + 3] = 255;
              }
            }
          }
        }
      }

      return result;
    }

    /**
     * Erode edges by shrinking them inward
     */
    erodeEdges(imageData, width, height, amount) {
      if (amount <= 0) return new Uint8ClampedArray(imageData);

      const result = new Uint8ClampedArray(imageData);

      for (let iteration = 0; iteration < amount; iteration++) {
        const temp = new Uint8ClampedArray(result);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            const alpha = temp[idx + 3];

            // Check if any neighbor is transparent
            let hasTransparentNeighbor = false;
            for (let dy = -1; dy <= 1 && !hasTransparentNeighbor; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nidx = ((y + dy) * width + (x + dx)) * 4;
                if (temp[nidx + 3] < 128) {
                  hasTransparentNeighbor = true;
                  break;
                }
              }
            }

            if (hasTransparentNeighbor && alpha > 128) {
              result[idx + 3] = 0; // Make transparent
            }
          }
        }
      }

      return result;
    }

    /**
     * Apply mode filter (median-like filtering)
     */
    applyModeFilter(imageData, width, height, radius) {
      if (radius <= 0 || width === 0 || height === 0) return new Uint8ClampedArray(imageData);

      const n = radius | 0;
      if (n <= 1) return new Uint8ClampedArray(imageData);

      const left = Math.floor((n - 1) / 2);
      const right = n - left - 1;
      const result = new Uint8ClampedArray(imageData);
      const out = new Uint8ClampedArray(imageData);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const a = imageData[i + 3] | 0;

          // Skip transparent pixels
          if (a < 128) {
            out[i] = imageData[i];
            out[i + 1] = imageData[i + 1];
            out[i + 2] = imageData[i + 2];
            out[i + 3] = a;
            continue;
          }

          const counts = {};
          let best = 0;
          let bR = imageData[i];
          let bG = imageData[i + 1];
          let bB = imageData[i + 2];

          for (let dy = -left; dy <= right; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= height) continue;

            for (let dx = -left; dx <= right; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= width) continue;

              const j = (yy * width + xx) * 4;
              if ((imageData[j + 3] | 0) < 128) continue;

              const key = ((imageData[j] | 0) << 16) | ((imageData[j + 1] | 0) << 8) | (imageData[j + 2] | 0);
              const c = (counts[key] || 0) + 1;
              counts[key] = c;

              if (c > best) {
                best = c;
                bR = imageData[j];
                bG = imageData[j + 1];
                bB = imageData[j + 2];
              }
            }
          }

          out[i] = bR;
          out[i + 1] = bG;
          out[i + 2] = bB;
          out[i + 3] = 255;
        }
      }

      return out;
    }

    _detectEdges(imageData, width, height, algorithm, threshold = 60, applyNMS = false) {
      const gray = new Uint8ClampedArray(width * height);
      const magnitude = new Float32Array(width * height);
      const direction = applyNMS ? new Int8Array(width * height) : null;

      // Convert to grayscale
      for (let i = 0; i < imageData.length; i += 4) {
        const idx = i / 4;
        gray[idx] = Math.round(0.299 * imageData[i] + 0.587 * imageData[i + 1] + 0.114 * imageData[i + 2]);
      }

      // Apply edge detection and store magnitude + direction
      switch (algorithm) {
        case 'sobel':
          this._sobelEdgeDetection(gray, magnitude, direction, width, height);
          break;
        case 'prewitt':
          this._prewittEdgeDetection(gray, magnitude, direction, width, height);
          break;
        case 'roberts':
          this._robertsEdgeDetection(gray, magnitude, direction, width, height);
          break;
        case 'laplacian':
          this._laplacianEdgeDetection(gray, magnitude, width, height);
          break;
        default:
          this._sobelEdgeDetection(gray, magnitude, direction, width, height);
      }

      const edges = new Uint8ClampedArray(width * height);

      // Apply non-maximum suppression if requested
      if (applyNMS && direction) {
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const mag = magnitude[i];
            if (mag < threshold) continue;

            const dir = direction[i];
            let m1 = 0, m2 = 0;

            // Compare with neighbors along gradient direction
            if (dir === 0) {  // Horizontal
              m1 = magnitude[i - 1];
              m2 = magnitude[i + 1];
            } else {  // Vertical
              m1 = magnitude[i - width];
              m2 = magnitude[i + width];
            }

            // Keep only if local maximum
            if (mag >= m1 && mag >= m2) {
              edges[i] = 255;
            }
          }
        }
      } else {
        // Simple thresholding
        for (let i = 0; i < edges.length; i++) {
          edges[i] = magnitude[i] > threshold ? 255 : 0;
        }
      }

      return edges;
    }

    /**
     * Sobel edge detection
     * @private
     */
    _sobelEdgeDetection(gray, magnitude, direction, width, height) {
      const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let gx = 0, gy = 0;
          let idx = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixelIdx = (y + ky) * width + (x + kx);
              gx += sobelX[idx] * gray[pixelIdx];
              gy += sobelY[idx] * gray[pixelIdx];
              idx++;
            }
          }
          const i = y * width + x;
          magnitude[i] = Math.abs(gx) + Math.abs(gy);

          // Store gradient direction for NMS
          if (direction) {
            const ax = Math.abs(gx);
            const ay = Math.abs(gy);
            direction[i] = ax >= ay ? 0 : 1;  // 0=horizontal, 1=vertical
          }
        }
      }
    }

    /**
     * Prewitt edge detection
     * @private
     */
    _prewittEdgeDetection(gray, magnitude, direction, width, height) {
      const prewittX = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
      const prewittY = [1, 1, 1, 0, 0, 0, -1, -1, -1];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let gx = 0, gy = 0;
          let idx = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixelIdx = (y + ky) * width + (x + kx);
              gx += prewittX[idx] * gray[pixelIdx];
              gy += prewittY[idx] * gray[pixelIdx];
              idx++;
            }
          }
          const i = y * width + x;
          magnitude[i] = Math.abs(gx) + Math.abs(gy);

          if (direction) {
            const ax = Math.abs(gx);
            const ay = Math.abs(gy);
            direction[i] = ax >= ay ? 0 : 1;
          }
        }
      }
    }

    /**
     * Roberts edge detection
     * @private
     */
    _robertsEdgeDetection(gray, magnitude, direction, width, height) {
      for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
          const idx = y * width + x;
          const gx = gray[idx] - gray[idx + width + 1];
          const gy = gray[idx + 1] - gray[idx + width];
          magnitude[idx] = Math.abs(gx) + Math.abs(gy);

          if (direction) {
            const ax = Math.abs(gx);
            const ay = Math.abs(gy);
            direction[idx] = ax >= ay ? 0 : 1;
          }
        }
      }
    }

    /**
     * Laplacian edge detection
     * @private
     */
    _laplacianEdgeDetection(gray, magnitude, width, height) {
      // Laplacian kernel for edge detection
      const laplacianKernel = [0, -1, 0, -1, 4, -1, 0, -1, 0];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sum = 0;
          let idx = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixelIdx = (y + ky) * width + (x + kx);
              sum += laplacianKernel[idx] * gray[pixelIdx];
              idx++;
            }
          }
          magnitude[y * width + x] = Math.abs(sum);
        }
      }
    }

    _dilateEdges(edges, width, height, thickness) {
      const t = Math.max(1, Math.min(6, thickness || 1));
      const dilationCount = t - 1;
      if (dilationCount <= 0) return new Uint8ClampedArray(edges);

      const dilated = new Uint8ClampedArray(edges);
      const tmp = new Uint8ClampedArray(edges.length);

      for (let k = 0; k < dilationCount; k++) {
        tmp.fill(0);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (dilated[i] > 128) { tmp[i] = 255; continue; }
            if ((x > 0 && dilated[i - 1] > 128) ||
                (x + 1 < width && dilated[i + 1] > 128) ||
                (y > 0 && dilated[i - width] > 128) ||
                (y + 1 < height && dilated[i + width] > 128)) {
              tmp[i] = 255;
            }
          }
        }
        dilated.set(tmp);
      }

      return dilated;
    }

    /**
     * Apply outline (expand edges outward)
     */
    applyOutline(imageData, width, height, thickness) {
      const t = Math.max(0, Math.floor(thickness || 0));
      if (t <= 0) return new Uint8ClampedArray(imageData);

      const data = new Uint8ClampedArray(imageData);
      const mask = new Uint8Array(width * height);

      // Create binary mask
      for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
        mask[i] = data[p + 3] >= 128 ? 1 : 0;
      }

      // Dilate mask
      const dilated = new Uint8Array(mask);
      const tmp = new Uint8Array(mask.length);

      for (let k = 0; k < t; k++) {
        tmp.fill(0);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (dilated[i]) { tmp[i] = 1; continue; }
            if ((x > 0 && dilated[i - 1]) ||
                (x + 1 < width && dilated[i + 1]) ||
                (y > 0 && dilated[i - width]) ||
                (y + 1 < height && dilated[i + width])) {
              tmp[i] = 1;
            }
          }
        }
        dilated.set(tmp);
      }

      // Draw outline where dilated but not original
      for (let i = 0; i < dilated.length; i++) {
        if (dilated[i] && !mask[i]) {
          const p = i * 4;
          data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 255;
        }
      }

      return data;
    }

    // ============================================================
    // COLOR CORRECTION
    // ============================================================

    /**
     * Apply brightness, contrast, saturation adjustments
     */
    applyColorCorrection(imageData, brightness = 0, contrast = 0, saturation = 0, hue = 0, gamma = 1.0) {
      const result = new Uint8ClampedArray(imageData);

      for (let i = 0; i < result.length; i += 4) {
        let r = result[i], g = result[i + 1], b = result[i + 2];

        // Brightness
        if (brightness !== 0) {
          r = Math.max(0, Math.min(255, r + brightness * 2.55));
          g = Math.max(0, Math.min(255, g + brightness * 2.55));
          b = Math.max(0, Math.min(255, b + brightness * 2.55));
        }

        // Contrast
        if (contrast !== 0) {
          const factor = (contrast + 100) / 100;
          r = Math.max(0, Math.min(255, (r - 128) * factor + 128));
          g = Math.max(0, Math.min(255, (g - 128) * factor + 128));
          b = Math.max(0, Math.min(255, (b - 128) * factor + 128));
        }

        // Saturation
        if (saturation !== 0) {
          const [h, s, l] = this._rgbToHsl(r, g, b);
          const newS = Math.max(0, Math.min(100, s + saturation));
          [r, g, b] = this._hslToRgb(h, newS, l);
        }

        // Hue rotation
        if (hue !== 0) {
          const [h, s, l] = this._rgbToHsl(r, g, b);
          const newH = (h + hue) % 360;
          [r, g, b] = this._hslToRgb(newH, s, l);
        }

        // Gamma correction
        if (gamma !== 1.0) {
          const invGamma = 1.0 / gamma;
          r = Math.pow(r / 255, invGamma) * 255;
          g = Math.pow(g / 255, invGamma) * 255;
          b = Math.pow(b / 255, invGamma) * 255;
        }

        result[i] = Math.round(r);
        result[i + 1] = Math.round(g);
        result[i + 2] = Math.round(b);
      }

      return result;
    }

    // ============================================================
    // CONVENIENCE WRAPPERS
    // ============================================================

    /**
     * Adjust colors on current image (wrapper for applyColorCorrection)
     * @param {Object} opts - { brightness, contrast, saturation, hue, gamma }
     */
    adjustColors(opts = {}) {
      if (!this.ctx) throw new Error('Image not loaded');
      const { brightness = 0, contrast = 0, saturation = 0, hue = 0, gamma = 1.0 } = opts;
      const imageData = this.getPixelData();
      const corrected = this.applyColorCorrection(imageData, brightness, contrast, saturation, hue, gamma);
      this.setPixelData(corrected);
    }

    /**
     * Blur current image
     * @param {string} mode - 'box' or 'gaussian'
     * @param {number} radius - blur radius
     */
    blur(mode = 'box', radius = 1) {
      if (!this.ctx) throw new Error('Image not loaded');
      this.applyPreBlur(mode, radius);
    }

    /**
     * Sharpen current image (wrapper for applySharpen)
     * @param {number} amount - 0-1 strength
     * @param {number} radius - blur radius for unsharp mask
     * @param {number} threshold - edge threshold
     */
    sharpen(amount = 0.5, radius = 1, threshold = 0) {
      if (!this.ctx) throw new Error('Image not loaded');
      this.applySharpen(amount, radius, threshold);
    }

    /**
     * Apply edge overlay
     */
    edgeOverlay(algorithm, threshold, thickness, thinEdges) {
      if (!this.ctx) throw new Error('Image not loaded');
      const imageData = this.getPixelData();
      const result = this.applyEdgeOverlay(imageData, this.canvas.width, this.canvas.height, algorithm, threshold, thickness, thinEdges);
      this.setPixelData(result);
    }

    /**
     * Apply posterization
     */
    posterize(levels) {
      if (!this.ctx) throw new Error('Image not loaded');
      const imageData = this.getPixelData();
      const result = this._applyPosterize(imageData, this.canvas.width, this.canvas.height, levels);
      this.setPixelData(result);
    }

    /**
     * Apply mode filter
     */
    modeFilter(radius) {
      if (!this.ctx) throw new Error('Image not loaded');
      const imageData = this.getPixelData();
      const result = this.applyModeFilter(imageData, this.canvas.width, this.canvas.height, radius);
      this.setPixelData(result);
    }

    /**
     * Simplify regions
     */
    simplify(minArea) {
      if (!this.ctx) throw new Error('Image not loaded');
      const imageData = this.getPixelData();
      const result = this.simplifyRegions(imageData, this.canvas.width, this.canvas.height, minArea);
      this.setPixelData(result);
    }

    /**
     * Erode edges
     */
    erode(amount) {
      if (!this.ctx) throw new Error('Image not loaded');
      const imageData = this.getPixelData();
      const result = this.erodeEdges(imageData, this.canvas.width, this.canvas.height, amount);
      this.setPixelData(result);
    }

    /**
     * Quantize image to palette without dithering
     * @param {Array} palette - Array of color objects with {id, r, g, b}
     * @param {string} colorSpace - Color matching algorithm
     */
    quantize(palette, colorSpace = 'lab', options = {}) {
      if (!this.ctx) throw new Error('Image not loaded');
      const imageData = this.getPixelData();
      const result = this.applySimpleQuantization(imageData, this.canvas.width, this.canvas.height, palette, {
        algorithm: colorSpace,
        paintTransparentPixels: options.paintTransparentPixels || false,
        paintWhitePixels: options.paintWhitePixels !== undefined ? options.paintWhitePixels : true,
        transparencyThreshold: options.transparencyThreshold || 128
      });
      this.setPixelData(result.data);
    }

    /**
     * Apply dithering to current image and quantize to palette
     * @param {string} method - Dithering algorithm name
     * @param {Array} palette - Color palette array
     * @param {number} strength - Dithering strength (0-1)
     * @param {string} colorSpace - Color matching algorithm
     */
    dither(method = 'floyd-steinberg', palette, strength = 0.5, colorSpace = 'lab', options = {}) {
      if (!this.ctx) throw new Error('Image not loaded');
      const w = this.canvas.width;
      const h = this.canvas.height;
      const imageData = this.getPixelData();
      
      // Map method names to internal names
      const methodMap = {
        'floyd-steinberg': 'floyd',
        'atkinson': 'atkinson',
        'jarvis': 'jarvis',
        'stucki': 'stucki',
        'burkes': 'burkes',
        'sierra': 'sierra',
        'bayer2': 'bayer2',
        'bayer4': 'bayer4',
        'bayer8': 'bayer8',
        'ordered': 'bayer4',
        'random': 'random'
      };
      
      const internalMethod = methodMap[method] || method;
      
      const result = this.applyDithering(imageData, w, h, palette, {
        method: internalMethod,
        strength: strength,
        algorithm: colorSpace,
        paintTransparentPixels: options.paintTransparentPixels || false,
        paintWhitePixels: options.paintWhitePixels !== undefined ? options.paintWhitePixels : true,
        transparencyThreshold: options.transparencyThreshold || 128
      });
      
      // applyDithering returns { data, totalValidPixels }
      if (result && result.data) {
        this.setPixelData(result.data);
      }
    }

    // ============================================================
    // UTILITY
    // ============================================================

    /**
     * Clear all caches
     */
    clearCaches() {
      this._colorCache.clear();
      this._labCache.clear();
      this._ditherWorkBuf = null;
      this._ditherEligibleBuf = null;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
      this.clearCaches();
      if (this.canvas) {
        this.canvas.width = 0;
        this.canvas.height = 0;
      }
      this.img = null;
      this.canvas = null;
      this.ctx = null;
    }

    /**
     * Create file uploader
     */
    static createImageUploader() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/gif,image/webp';
        input.onchange = () => {
          if (input.files && input.files[0]) {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.readAsDataURL(input.files[0]);
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    }
  }

  // Export to window
  window.PatPlacerImageProcessor = ImageProcessor;
  console.log('[PatPlacer] ImageProcessor module loaded');

})();
